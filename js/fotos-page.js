const fotos$ = (seletor) => document.querySelector(seletor);

let turmaFotosAtual = "";
let fotosTurmaAtual = [];
let arquivosFotosSelecionados = [];
let carregamentoFotos = 0;

function statusFotos(texto, erro = false) {
  const elemento = fotos$("#statusFotos");
  elemento.textContent = texto;
  elemento.classList.toggle("erro", erro);
}

function atualizarBotaoFotos() {
  const botao = fotos$("#enviarFotos");
  botao.disabled = !turmaFotosAtual || arquivosFotosSelecionados.length === 0 || botao.dataset.enviando === "1";
  botao.textContent = arquivosFotosSelecionados.length
    ? `Enviar ${arquivosFotosSelecionados.length} foto(s)`
    : "Enviar fotos";
}

function preencherTurmasFotos() {
  const select = fotos$("#turmaFotos");
  select.replaceChildren(new Option("Selecione uma turma", ""));
  cadastroTurmas.forEach((registro) => {
    const nome = registro.arquivada ? `${registro.nome} (arquivada)` : registro.nome;
    select.append(new Option(nome, registro.nome));
  });
}

function tamanhoFoto(bytes) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function carregarFotosTurma() {
  const sequencia = ++carregamentoFotos;
  const galeria = fotos$("#galeriaFotos");
  const total = fotos$("#totalFotos");
  if (!turmaFotosAtual) {
    galeria.innerHTML = '<div class="fotos-vazio">Selecione uma turma para consultar as fotos.</div>';
    total.textContent = "";
    return;
  }

  galeria.innerHTML = '<div class="fotos-vazio">Carregando fotos...</div>';
  try {
    const fotos = await listarFotosTurma(turmaFotosAtual);
    const comUrl = await Promise.all(fotos.map(async (foto) => {
      try {
        return { ...foto, url: await urlFotoTurma(foto.storage_path) };
      } catch (error) {
        console.error(error);
        return { ...foto, url: "" };
      }
    }));
    if (sequencia !== carregamentoFotos) return;
    fotosTurmaAtual = comUrl;
    total.textContent = `${comUrl.length} foto(s)`;
    galeria.innerHTML = comUrl.length
      ? comUrl.map((foto) => `
          <article class="foto-card">
            ${foto.url
              ? `<img class="foto-preview" src="${esc(foto.url)}" alt="${esc(foto.nome_arquivo)}" loading="lazy" />`
              : '<div class="foto-preview d-flex align-items-center justify-content-center text-muted">Pré-visualização indisponível</div>'}
            <div class="foto-info">
              <span class="foto-nome" title="${esc(foto.nome_arquivo)}">${esc(foto.nome_arquivo)}</span>
              <span class="foto-data">${new Date(foto.criado_em).toLocaleString("pt-BR")} · ${tamanhoFoto(foto.tamanho_bytes)}</span>
            </div>
            <div class="foto-acoes">
              <button class="btn-ghost" type="button" data-baixar-foto="${esc(foto.id)}" ${foto.url ? "" : "disabled"}>
                <i class="bi bi-download"></i> Baixar
              </button>
            </div>
          </article>`).join("")
      : '<div class="fotos-vazio">Ainda não há fotos cadastradas para esta turma.</div>';
  } catch (error) {
    console.error(error);
    if (sequencia !== carregamentoFotos) return;
    galeria.innerHTML = '<div class="fotos-vazio">Não foi possível carregar as fotos. Confira se a migração do Supabase foi executada.</div>';
    total.textContent = "";
  }
}

fotos$("#turmaFotos").addEventListener("change", async (event) => {
  turmaFotosAtual = event.target.value;
  fotos$("#arquivosFotos").disabled = !turmaFotosAtual;
  if (!turmaFotosAtual) {
    arquivosFotosSelecionados = [];
    fotos$("#arquivosFotos").value = "";
  }
  atualizarBotaoFotos();
  await carregarFotosTurma();
});

fotos$("#arquivosFotos").addEventListener("change", (event) => {
  const arquivos = [...event.target.files];
  const invalidos = arquivos.filter((arquivo) =>
    !TIPOS_FOTO_TURMA.has(arquivo.type) || arquivo.size > TAMANHO_MAXIMO_FOTO || arquivo.size === 0);
  arquivosFotosSelecionados = arquivos.filter((arquivo) => !invalidos.includes(arquivo));
  const mensagem = arquivosFotosSelecionados.length
    ? `${arquivosFotosSelecionados.length} imagem(ns) pronta(s)${invalidos.length ? `; ${invalidos.length} arquivo(s) fora do formato ou do limite foram ignorados` : ""}.`
    : invalidos.length ? "Selecione imagens JPG, PNG ou WebP de até 10 MB." : "";
  statusFotos(mensagem, invalidos.length > 0 && arquivosFotosSelecionados.length === 0);
  atualizarBotaoFotos();
});

fotos$("#enviarFotos").addEventListener("click", async () => {
  const botao = fotos$("#enviarFotos");
  if (!turmaFotosAtual || !arquivosFotosSelecionados.length) return;
  const arquivos = [...arquivosFotosSelecionados];
  const turma = turmaFotosAtual;
  let enviadas = 0;
  const falhas = [];
  fotos$("#turmaFotos").disabled = true;
  fotos$("#arquivosFotos").disabled = true;
  botao.dataset.enviando = "1";
  botao.disabled = true;
  statusFotos("Enviando imagens...");

  for (const arquivo of arquivos) {
    try {
      await enviarFotoTurma(arquivo, turma);
      enviadas++;
    } catch (error) {
      console.error(error);
      falhas.push(arquivo.name);
    }
  }

  arquivosFotosSelecionados = [];
  fotos$("#arquivosFotos").value = "";
  botao.dataset.enviando = "0";
  fotos$("#turmaFotos").disabled = false;
  fotos$("#arquivosFotos").disabled = !turmaFotosAtual;
  atualizarBotaoFotos();
  await carregarFotosTurma();
  statusFotos(falhas.length
    ? `${enviadas} enviada(s). Falha ao enviar: ${falhas.join(", ")}.`
    : `${enviadas} foto(s) enviada(s) para ${turma}.`, falhas.length > 0);
});

fotos$("#galeriaFotos").addEventListener("click", async (event) => {
  const botao = event.target.closest("[data-baixar-foto]");
  if (!botao) return;
  const foto = fotosTurmaAtual.find((item) => item.id === botao.dataset.baixarFoto);
  if (!foto) return;
  botao.disabled = true;
  try {
    const url = await urlFotoTurma(foto.storage_path, foto.nome_arquivo);
    const link = document.createElement("a");
    link.href = url;
    link.download = foto.nome_arquivo;
    link.rel = "noopener";
    document.body.append(link);
    link.click();
    link.remove();
  } catch (error) {
    console.error(error);
    statusFotos("Não foi possível baixar a imagem. Atualize a página e tente novamente.", true);
  } finally {
    botao.disabled = false;
  }
});

(async () => {
  if (!(await exigirLogin())) return;
  try {
    await carregarDados();
    preencherTurmasFotos();
    fotos$("#arquivosFotos").disabled = cadastroTurmas.length === 0 || !turmaFotosAtual;
    statusFotos(cadastroTurmas.length ? "" : "Cadastre uma turma antes de enviar fotos.");
    await carregarFotosTurma();
  } catch (error) {
    console.error(error);
    statusFotos("Não foi possível carregar os dados. Recarregue a página e tente novamente.", true);
  }
})();
