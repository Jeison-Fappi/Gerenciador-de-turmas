// ==========================================================
// PAINEL - app.js (depende de turmas.js e storage.js)
// ==========================================================

let alunoEditando = null;

const $ = (s) => document.querySelector(s);
function situacao(faltas) {
  if (faltas >= FALTAS_RISCO) return { classe: "sit-risco", texto: "Em risco" };
  if (faltas >= FALTAS_ALERTA) return { classe: "sit-atencao", texto: "Em atenção" };
  return { classe: "sit-regular", texto: "Regular" };
}

function toast(icon, title) {
  Swal.fire({ toast: true, position: "top-end", icon, title, timer: 2000, showConfirmButton: false });
}

function erroCampo(input, msg) {
  input.classList.add("is-invalid");
  input.parentElement.querySelector(".invalid-feedback").textContent = msg;
  input.focus();
}

function limparErros(modal) {
  modal.querySelectorAll(".is-invalid").forEach((e) => e.classList.remove("is-invalid"));
}

// ---------- Cabeçalho ----------
$("#dataHoje").innerText = new Date().toLocaleDateString("pt-BR", {
  weekday: "long", day: "numeric", month: "long", year: "numeric",
});

// ---------- Números do topo ----------
function atualizarCards() {
  let totalFaltas = 0, emAtencao = 0, emRisco = 0;

  const ativos = alunosAtivos();
  for (const a of ativos) {
    const f = faltasDoAluno(a);
    totalFaltas += f;
    if (f >= FALTAS_RISCO) emRisco++;
    else if (f >= FALTAS_ALERTA) emAtencao++;
  }

  $("#totalAlunos").innerText = ativos.length;
  $("#totalFaltas").innerText = totalFaltas;
  $("#mediaFaltas").innerText = (ativos.length ? totalFaltas / ativos.length : 0).toFixed(1);
  $("#emAtencao").innerText = emAtencao;
  $("#emRisco").innerText = emRisco;
  $("#emAtencao").parentElement.classList.toggle("has", emAtencao > 0);
  $("#emRisco").parentElement.classList.toggle("has", emRisco > 0);
}

// ---------- Tabela ----------
function atualizarTabela(lista = alunosAtivos()) {
  const tabela = $("#tabelaAlunos");

  if (lista.length === 0) {
    tabela.innerHTML = `<tr><td colspan="5"><div class="vazio">
      <i class="bi bi-people fs-3 d-block mb-2"></i>
      ${alunosAtivos().length === 0
        ? alunos.length ? "Não há alunos ativos. Alunos arquivados podem ser reativados abaixo." : 'Nenhum aluno cadastrado ainda. Clique em "Novo aluno" para começar.'
        : "Nenhum aluno encontrado com esse filtro."}
    </div></td></tr>`;
    return;
  }

  tabela.innerHTML = lista.map((a) => {
    const f = faltasDoAluno(a);
    const s = situacao(f);
    const pct = Math.min(f / FALTAS_RISCO, 1) * 100;
    return `
      <tr>
        <td><div class="who"><span class="avatar">${esc(iniciais(a.nome))}</span>${esc(a.nome)}</div></td>
        <td><span class="chip">${esc(a.turma)}</span></td>
        <td>
          <div class="faltas">
            <b class="num">${f}</b>
            <div class="bar"><i class="${s.classe}" style="width:${pct}%"></i></div>
          </div>
        </td>
        <td><span class="badge-sit ${s.classe}">${s.texto}</span></td>
        <td class="acts">
          <button class="ibtn" onclick="abrirCalendario('${a.id}')" title="Calendário de observações"><i class="bi bi-calendar3"></i></button>
          <button class="ibtn" onclick="abrirEdicao('${a.id}')" title="Editar"><i class="bi bi-pencil"></i></button>
          <button class="ibtn" onclick="alternarArquivoAluno('${a.id}', true)" title="Arquivar aluno"><i class="bi bi-archive"></i></button>
          <button class="ibtn del" onclick="excluirAluno('${a.id}')" title="Excluir definitivamente"><i class="bi bi-trash3"></i></button>
        </td>
      </tr>`;
  }).join("");
}

let arquivadosVisiveis = false;

function atualizarListaArquivados() {
  const arquivados = alunos.filter((aluno) => aluno.arquivado);
  const secao = $("#secaoArquivados");
  const botao = $("#alternarListaArquivados");
  const conteudo = $("#conteudoArquivados");
  const tabela = $("#tabelaAlunosArquivados");
  if (!arquivados.length) arquivadosVisiveis = false;
  secao.classList.toggle("d-none", arquivados.length === 0);
  botao.textContent = arquivadosVisiveis ? "Ocultar alunos" : `Ver alunos arquivados (${arquivados.length})`;
  botao.setAttribute("aria-expanded", String(arquivadosVisiveis));
  conteudo.classList.toggle("d-none", !arquivadosVisiveis);
  if (!arquivados.length) {
    tabela.replaceChildren();
    return;
  }
  tabela.innerHTML = arquivados.map((aluno) => `
    <tr class="linha-arquivada">
      <td><div class="who"><span class="avatar avatar-arquivado">${esc(iniciais(aluno.nome))}</span>${esc(aluno.nome)} <span class="badge-arquivado">Arquivado</span></div></td>
      <td><span class="chip">${esc(aluno.turma)}</span></td>
      <td>${faltasDoAluno(aluno)}</td>
      <td class="acts">
        <button class="ibtn" onclick="abrirCalendario('${aluno.id}')" title="Consultar histórico"><i class="bi bi-calendar3"></i></button>
        <button class="btn-ghost btn-reativar" onclick="alternarArquivoAluno('${aluno.id}', false)">Reativar</button>
        <button class="ibtn del" onclick="excluirAluno('${aluno.id}')" title="Excluir definitivamente"><i class="bi bi-trash3"></i></button>
      </td>
    </tr>`).join("");
}

$("#alternarListaArquivados").addEventListener("click", () => {
  arquivadosVisiveis = !arquivadosVisiveis;
  atualizarListaArquivados();
});

function atualizarSistema() {
  atualizarCards();
  aplicarFiltros();
  atualizarListaArquivados();
}

function popularTurmas() {
  const turmaNova = $("#turmaAluno");
  const turmaEdicao = $("#editarTurma");
  const filtro = $("#filtroTurma");
  turmaNova.innerHTML = '<option value="">Selecione a turma</option>';
  turmaEdicao.innerHTML = '<option value="">Selecione a turma</option>';
  filtro.innerHTML = '<option value="TODAS">Todas as turmas</option>';

  turmas.forEach((nome) => {
    for (const select of [turmaNova, filtro]) {
      const option = document.createElement("option");
      option.value = nome;
      option.textContent = nome;
      select.append(option);
    }
  });
  cadastroTurmas.forEach((registro) => {
    const option = document.createElement("option");
    option.value = registro.nome;
    option.textContent = registro.arquivada ? `${registro.nome} (arquivada)` : registro.nome;
    turmaEdicao.append(option);
  });
  const turmaImportacao = $("#turmaImportacao");
  if (turmaImportacao) {
    turmaImportacao.replaceChildren(new Option("Selecione a turma", ""));
    turmas.forEach((nome) => turmaImportacao.append(new Option(nome, nome)));
  }
}

let nomesArquivoImportacao = [];
let alunosImportacaoPendentes = [];

function prepararImportacaoAlunos() {
  const turma = $("#turmaImportacao").value;
  const resultado = $("#resultadoImportacao");
  const botao = $("#btnConfirmarImportacaoAlunos");
  const existentes = new Set(alunos.map((aluno) => aluno.nome.trim().toLocaleLowerCase("pt-BR")));
  const vistos = new Set();
  let invalidos = 0;
  alunosImportacaoPendentes = [];

  nomesArquivoImportacao.forEach((valor) => {
    const nome = String(valor || "").trim().replace(/\s+/g, " ");
    if (!nome || nome.length > 120) { invalidos++; return; }
    const chave = nome.toLocaleLowerCase("pt-BR");
    if (existentes.has(chave) || vistos.has(chave)) { invalidos++; return; }
    vistos.add(chave);
    alunosImportacaoPendentes.push(nome);
  });

  if (!nomesArquivoImportacao.length) {
    botao.disabled = true;
    return;
  }
  resultado.textContent = `${alunosImportacaoPendentes.length} aluno(s) prontos para importar. ${invalidos} linha(s) vazia(s), duplicada(s) ou inválida(s) serão ignoradas.`;
  botao.disabled = !turma || alunosImportacaoPendentes.length === 0;
}

$("#arquivoAlunos").addEventListener("change", async (event) => {
  const arquivo = event.target.files[0];
  nomesArquivoImportacao = [];
  alunosImportacaoPendentes = [];
  $("#resultadoImportacao").textContent = "";
  $("#btnConfirmarImportacaoAlunos").disabled = true;
  if (!arquivo) return;
  if (typeof XLSX === "undefined") {
    $("#resultadoImportacao").textContent = "Não foi possível carregar o leitor de planilhas. Verifique a conexão e recarregue a página.";
    return;
  }
  try {
    const buffer = await arquivo.arrayBuffer();
    const planilha = XLSX.read(buffer, { type: "array" });
    const linhas = XLSX.utils.sheet_to_json(planilha.Sheets[planilha.SheetNames[0]], { header: 1, defval: "", raw: false });
    const cabecalho = (linhas.shift() || []).map((c) => String(c).trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
    const coluna = cabecalho.findIndex((c) => ["nome", "aluno", "nome do aluno"].includes(c));
    if (coluna < 0) throw new Error("Inclua uma coluna chamada Nome na primeira linha do arquivo.");
    nomesArquivoImportacao = linhas.map((linha) => linha[coluna]);
    prepararImportacaoAlunos();
  } catch (error) {
    $("#resultadoImportacao").textContent = error.message || "Não foi possível ler o arquivo selecionado.";
  }
});

$("#turmaImportacao").addEventListener("change", prepararImportacaoAlunos);
$("#btnConfirmarImportacaoAlunos").addEventListener("click", async () => {
  const botao = $("#btnConfirmarImportacaoAlunos");
  const turma = $("#turmaImportacao").value;
  if (!turma || !alunosImportacaoPendentes.length) return;
  botao.disabled = true;
  botao.textContent = "Importando...";
  try {
    const quantidade = await criarAlunosEmLote(alunosImportacaoPendentes, turma);
    atualizarSistema();
    $("#resultadoImportacao").textContent = `${quantidade} aluno(s) importado(s) para ${turma}.`;
    nomesArquivoImportacao = [];
    alunosImportacaoPendentes = [];
    $("#arquivoAlunos").value = "";
    toast("success", `${quantidade} aluno(s) importado(s)`);
  } catch (error) {
    console.error(error);
    $("#resultadoImportacao").textContent = error?.code === "23505"
      ? "O arquivo contém um aluno que já está cadastrado. Revise a lista e tente novamente."
      : "Não foi possível concluir a importação. Verifique a conexão e tente novamente.";
  } finally {
    botao.textContent = "Importar alunos";
    botao.disabled = !turma || alunosImportacaoPendentes.length === 0;
  }
});

$("#modalImportarAlunos").addEventListener("hidden.bs.modal", () => {
  nomesArquivoImportacao = [];
  alunosImportacaoPendentes = [];
  $("#arquivoAlunos").value = "";
  $("#resultadoImportacao").textContent = "";
  $("#btnConfirmarImportacaoAlunos").disabled = true;
});

function formatarAgenda(agenda) {
  const dias = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const turnos = { manha: "manhã", tarde: "tarde" };
  const porDia = new Map();
  (agenda || []).forEach((slot) => {
    const [dia, turno] = slot.split(":");
    if (!porDia.has(dia)) porDia.set(dia, []);
    porDia.get(dia).push(turnos[turno] || turno);
  });
  return [...porDia.entries()].map(([dia, turnosDia]) => `${dias[Number(dia)]}: ${turnosDia.join(" e ")}`).join(" · ") || "Sem agenda semanal";
}

function renderizarTurmas() {
  const lista = $("#listaTurmas");
  lista.replaceChildren();
  if (!cadastroTurmas.length) {
    const vazio = document.createElement("li");
    vazio.className = "list-group-item text-muted";
    vazio.textContent = "Nenhuma turma cadastrada.";
    lista.append(vazio);
    return;
  }
  cadastroTurmas.forEach((registro) => {
    const item = document.createElement("li");
    item.className = "list-group-item d-flex justify-content-between align-items-center gap-3 flex-wrap";
    const info = document.createElement("div");
    const nome = document.createElement("strong");
    nome.textContent = registro.nome + (registro.arquivada ? " (arquivada)" : "");
    const agenda = document.createElement("div");
    agenda.className = "small text-muted";
    agenda.textContent = formatarAgenda(registro.agenda);
    info.append(nome, agenda);
    const acoes = document.createElement("div");
    acoes.className = "d-flex gap-2";
    const editar = document.createElement("button");
    editar.type = "button";
    editar.className = "btn-ghost";
    editar.textContent = "Editar";
    editar.addEventListener("click", () => editarTurma(registro));
    const arquivar = document.createElement("button");
    arquivar.type = "button";
    arquivar.className = "btn-ghost";
    arquivar.textContent = registro.arquivada ? "Reativar" : "Arquivar";
    arquivar.addEventListener("click", () => alternarArquivoTurma(registro));
    acoes.append(editar, arquivar);
    item.append(info, acoes);
    lista.append(item);
  });
}

let turmaEmEdicao = null;
function cancelarEdicaoTurma() {
  turmaEmEdicao = null;
  $("#formTurma").reset();
  $("#btnSalvarTurma").textContent = "Adicionar turma";
  $("#cancelarEdicaoTurma").classList.add("d-none");
  $("#erroTurma").textContent = "";
}

function editarTurma(registro) {
  turmaEmEdicao = registro.nome;
  $("#nomeTurma").value = registro.nome;
  document.querySelectorAll('[name="agendaTurma"]').forEach((input) => {
    input.checked = (registro.agenda || []).includes(input.value);
  });
  $("#btnSalvarTurma").textContent = "Salvar alterações";
  $("#cancelarEdicaoTurma").classList.remove("d-none");
  $("#nomeTurma").focus();
}

async function alternarArquivoTurma(registro) {
  const arquivada = !registro.arquivada;
  const resultado = await Swal.fire({
    title: arquivada ? `Arquivar ${esc(registro.nome)}?` : `Reativar ${esc(registro.nome)}?`,
    text: arquivada ? "A turma e o histórico serão preservados; ela deixará de aparecer para novas chamadas." : "A turma voltará a aparecer nas chamadas.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: arquivada ? "Arquivar" : "Reativar",
    cancelButtonText: "Cancelar",
  });
  if (!resultado.isConfirmed) return;
  try {
    await arquivarTurma(registro.nome, arquivada);
    popularTurmas();
    renderizarTurmas();
    atualizarSistema();
    toast("success", arquivada ? "Turma arquivada" : "Turma reativada");
  } catch (error) {
    console.error(error);
    falhaSalvar(error);
  }
}

$("#modalTurmas").addEventListener("show.bs.modal", () => {
  cancelarEdicaoTurma();
  renderizarTurmas();
});
$("#modalTurmas").addEventListener("shown.bs.modal", () => $("#nomeTurma").focus());
$("#modalTurmas").addEventListener("hidden.bs.modal", cancelarEdicaoTurma);
$("#cancelarEdicaoTurma").addEventListener("click", cancelarEdicaoTurma);

$("#formTurma").addEventListener("submit", async (event) => {
  event.preventDefault();
  const nome = $("#nomeTurma").value.trim();
  const erro = $("#erroTurma");
  erro.textContent = "";
  if (!nome) {
    erro.textContent = "Informe o nome da turma.";
    $("#nomeTurma").focus();
    return;
  }
  const duplicada = cadastroTurmas.some((r) => r.nome !== turmaEmEdicao && r.nome.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"));
  if (duplicada) {
    erro.textContent = "Essa turma já está cadastrada.";
    $("#nomeTurma").focus();
    return;
  }
  const agenda = [...document.querySelectorAll('[name="agendaTurma"]:checked')].map((input) => input.value);
  const botao = $("#btnSalvarTurma");
  const estavaEditando = turmaEmEdicao !== null;
  botao.disabled = true;
  try {
    await salvarTurma(nome, agenda, turmaEmEdicao);
    cancelarEdicaoTurma();
    popularTurmas();
    renderizarTurmas();
    atualizarSistema();
    toast("success", estavaEditando ? "Turma atualizada" : "Turma cadastrada");
  } catch (error) {
    erro.textContent = error?.code === "23505" ? "Essa turma já está cadastrada." : "Não foi possível salvar a turma. Tente novamente.";
    console.error(error);
  } finally {
    botao.disabled = false;
  }
});

// ---------- Cadastro ----------
async function cadastrarAluno() {
  const modal = $("#modalNovo");
  const inputNome = $("#nomeAluno");
  const inputTurma = $("#turmaAluno");
  const nome = inputNome.value.trim();
  limparErros(modal);

  if (nome === "") return erroCampo(inputNome, "Digite o nome do aluno.");
  if (inputTurma.value === "") return erroCampo(inputTurma, "Selecione uma turma.");
  if (alunos.some((a) => a.nome.toLowerCase() === nome.toLowerCase()))
    return erroCampo(inputNome, "Esse aluno já está cadastrado.");

  try {
    await criarAluno(nome, inputTurma.value);
  } catch (e) {
    if (e && e.code === "23505") return erroCampo(inputNome, "Esse aluno já está cadastrado.");
    return falhaSalvar(e);
  }
  atualizarSistema();

  inputNome.value = "";
  inputTurma.selectedIndex = 0;
  bootstrap.Modal.getInstance(modal).hide();
  toast("success", "Aluno cadastrado");
}

$("#modalNovo").addEventListener("shown.bs.modal", () => $("#nomeAluno").focus());
$("#modalNovo").addEventListener("hidden.bs.modal", () => limparErros($("#modalNovo")));
$("#nomeAluno").addEventListener("keydown", (e) => e.key === "Enter" && cadastrarAluno());

// ---------- Edição ----------
function abrirEdicao(id) {
  alunoEditando = alunos.find((a) => a.id === id);
  if (!alunoEditando) return toast("error", "Aluno não encontrado");

  limparErros($("#modalEditar"));
  $("#editarNome").value = alunoEditando.nome;
  $("#editarTurma").value = alunoEditando.turma;
  $("#editarFaltasAnt").value = alunoEditando.faltasAnteriores || 0;
  bootstrap.Modal.getOrCreateInstance($("#modalEditar")).show();
}

async function salvarEdicao() {
  const nome = $("#editarNome").value.trim();
  const turma = $("#editarTurma").value;
  limparErros($("#modalEditar"));

  if (nome === "") return erroCampo($("#editarNome"), "Digite o nome do aluno.");
  if (turma === "") return erroCampo($("#editarTurma"), "Selecione uma turma.");

  alunoEditando.nome = nome;
  alunoEditando.turma = turma;
  alunoEditando.faltasAnteriores = Math.max(0, parseInt($("#editarFaltasAnt").value) || 0);
  try {
    await atualizarAluno(alunoEditando);
  } catch (e) {
    if (e && e.code === "23505") return erroCampo($("#editarNome"), "Já existe um aluno com esse nome.");
    return falhaSalvar(e);
  }
  atualizarSistema();
  bootstrap.Modal.getInstance($("#modalEditar")).hide();
  toast("success", "Aluno atualizado");
}

// ---------- Arquivamento e exclusão ----------
async function alternarArquivoAluno(id, arquivado) {
  const aluno = alunos.find((item) => item.id === id);
  if (!aluno) return;
  const resultado = await Swal.fire({
    title: arquivado ? `Arquivar ${esc(aluno.nome)}?` : `Reativar ${esc(aluno.nome)}?`,
    text: arquivado
      ? "O aluno e o histórico serão preservados. Ele deixará de aparecer nas chamadas e indicadores ativos."
      : "O aluno voltará a aparecer nas chamadas e indicadores ativos.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: arquivado ? "Arquivar" : "Reativar",
    cancelButtonText: "Cancelar",
  });
  if (!resultado.isConfirmed) return;
  try {
    await atualizarArquivoAluno(id, arquivado);
    atualizarSistema();
    toast("success", arquivado ? "Aluno arquivado" : "Aluno reativado");
  } catch (error) {
    falhaSalvar(error);
  }
}

function excluirAluno(id) {
  const a = alunos.find((x) => x.id === id);
  if (!a) return;

  Swal.fire({
    title: `Excluir ${esc(a.nome)} definitivamente?`,
    text: "A exclusão remove também as presenças e observações deste aluno e não pode ser desfeita.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Excluir",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#c90969",
  }).then(async (r) => {
    if (r.isConfirmed) {
      try {
        await removerAluno(id);
      } catch (e) {
        return falhaSalvar(e);
      }
      atualizarSistema();
      toast("success", "Aluno removido");
    }
  });
}

function abrirCalendario(id) {
  window.location.href = `calendario.html?id=${id}`;
}

// ---------- Pesquisa + filtro de turma ----------
function aplicarFiltros() {
  const texto = $("#pesquisa").value.toLowerCase();
  const turma = $("#filtroTurma").value;

  atualizarTabela(
    alunosAtivos().filter(
      (a) =>
        (a.nome.toLowerCase().includes(texto) || a.turma.toLowerCase().includes(texto)) &&
        (turma === "TODAS" || a.turma === turma),
    ),
  );
}

$("#pesquisa").addEventListener("input", aplicarFiltros);
$("#filtroTurma").addEventListener("change", aplicarFiltros);

// ---------- Início ----------
function verificarImportacao() {
  const antigos = JSON.parse(localStorage.getItem("alunos") || "[]");
  if (antigos.length && !localStorage.getItem("importado_ok")) {
    $("#qtdImportar").innerText = antigos.length;
    $("#bannerImportar").classList.remove("d-none");
  }
}

function dispensarImportacao() {
  localStorage.setItem("importado_ok", "1");
  $("#bannerImportar").classList.add("d-none");
}

async function importarAgora() {
  const btn = $("#btnImportar");
  btn.disabled = true;
  btn.innerText = "Importando...";
  try {
    const r = await importarDoNavegador();
    localStorage.setItem("importado_ok", "1");
    $("#bannerImportar").classList.add("d-none");
    await carregarDados();
    popularTurmas();
    atualizarSistema();
    toast("success", `Importado: ${r.alunos} aluno(s) e ${r.presencas} registro(s) de chamada`);
  } catch (e) {
    falhaSalvar(e);
    btn.disabled = false;
    btn.innerText = "Importar";
  }
}

(async () => {
  if (!(await exigirLogin())) return;
  try {
    await carregarDados();
  } catch (e) {
    return falhaSalvar(e);
  }
  popularTurmas();
  atualizarSistema();
  verificarImportacao();
})();
