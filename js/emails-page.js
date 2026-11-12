const $ = (selector) => document.querySelector(selector);
const formatarDataHora = (valor) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(valor));
const nomeCategoria = {
  acompanhamento: "Acompanhamento (5–6)", alerta: "Alerta (7–9)", sequencia: "Faltas consecutivas",
  apoio: "Convite para conversar", limite: "Limite atingido (13+)",
};
const nomeStatus = { pendente: "Pendente", enviando: "Enviando", enviado: "Enviado", cancelado: "Cancelado", falha: "Falha" };

function escapeHtmlEmail(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function renderizarDestinatarios() {
  const lista = alunosAtivos();
  $("#tabelaEmails").innerHTML = lista.map((aluno) => `<tr data-aluno="${aluno.id}">
    <td>${escapeHtmlEmail(aluno.nome)}</td><td>${escapeHtmlEmail(aluno.turma)}</td>
    <td><input class="form-control email-destinatario" type="email" value="${escapeHtmlEmail(aluno.email)}" maxlength="254" aria-label="E-mail de ${escapeHtmlEmail(aluno.nome)}"></td>
    <td class="text-center"><input class="form-check-input email-teste" type="checkbox" ${aluno.emailTeste ? "checked" : ""} aria-label="Marcar ${escapeHtmlEmail(aluno.nome)} como aluno de teste"></td>
    <td><button class="ibtn salvar-email" type="button" title="Salvar e-mail" aria-label="Salvar e-mail"><i class="bi bi-check2"></i></button></td>
  </tr>`).join("") || '<tr><td colspan="5">Nenhum aluno ativo cadastrado.</td></tr>';

  $("#tabelaEmails").querySelectorAll(".salvar-email").forEach((button) => button.addEventListener("click", async () => {
    const row = button.closest("tr");
    const input = row.querySelector(".email-destinatario");
    const email = input.value.trim();
    if (email && !input.checkValidity()) { input.reportValidity(); return; }
    button.disabled = true;
    try {
      await salvarEmailAluno(row.dataset.aluno, email, row.querySelector(".email-teste").checked);
      mostrarAvisoEmail("E-mail salvo.", false);
    } catch (error) {
      console.error(error);
      mostrarAvisoEmail("Não foi possível salvar. Confirme se a migração SQL foi aplicada.", true);
    } finally { button.disabled = false; }
  }));
}

function mostrarAvisoEmail(mensagem, erro) {
  const aviso = $("#avisoEmails");
  aviso.className = `small mb-3 ${erro ? "text-danger" : "text-success"}`;
  aviso.textContent = mensagem;
}

async function carregarFilaEmail() {
  const filtro = $("#filtroFilaEmail").value;
  let consulta = sb.from("fila_emails_frequencia").select("*").order("agendada_para", { ascending: false }).limit(500);
  if (filtro === "ativos") consulta = consulta.in("status", ["pendente", "enviando"]);
  const { data, error } = await consulta;
  if (error) throw error;
  $("#tabelaFilaEmails").innerHTML = (data || []).map((item) => `<tr>
    <td>${escapeHtmlEmail(item.nome_aluno)}</td><td>${escapeHtmlEmail(item.turma)}</td>
    <td>${item.total_faltas} (${item.faltas_consecutivas} seguidas)</td><td>${nomeCategoria[item.categoria] || escapeHtmlEmail(item.categoria)}</td>
    <td>${formatarDataHora(item.agendada_para)}</td><td class="email-status">${nomeStatus[item.status] || escapeHtmlEmail(item.status)}</td>
    <td>${item.status === "pendente" ? `<button class="ibtn cancelar-email" type="button" data-id="${item.id}" title="Cancelar envio" aria-label="Cancelar envio"><i class="bi bi-x-circle"></i></button>` : ""}</td>
  </tr>`).join("") || '<tr><td colspan="7">Nenhum envio nesta visualização.</td></tr>';
  $("#tabelaFilaEmails").querySelectorAll(".cancelar-email").forEach((button) => button.addEventListener("click", async () => {
    const confirmar = await Swal.fire({ title: "Cancelar este envio?", text: "O e-mail permanecerá no histórico com status cancelado.", icon: "question", showCancelButton: true, confirmButtonText: "Cancelar envio", cancelButtonText: "Voltar" });
    if (!confirmar.isConfirmed) return;
    const { data: cancelado, error: cancelError } = await sb.rpc("cancelar_email_frequencia", { p_id: button.dataset.id });
    if (cancelError || !cancelado) { await Swal.fire("Não foi possível cancelar", "O envio pode já ter sido iniciado.", "warning"); return; }
    await carregarFilaEmail();
  }));
}

function lerArquivoEmails(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: "array" });
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
        const registros = rows.map((row) => {
          const normalizado = Object.fromEntries(Object.entries(row).map(([key, value]) => [String(key).trim().toLowerCase(), value]));
          const email = String(normalizado.email || "").trim().toLowerCase();
          const ehTeste = ["1", "true", "sim", "yes", "x"].includes(String(normalizado.eh_teste || "").trim().toLowerCase());
          return { aluno_id: String(normalizado.aluno_id || "").trim(), email, eh_teste: ehTeste };
        }).filter((registro) => registro.aluno_id && registro.email);
        if (!registros.length || registros.some((registro) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registro.email))) throw new Error("O arquivo precisa ter aluno_id e e-mail válido em cada linha preenchida.");
        resolve(registros);
      } catch (error) { reject(error); }
    };
    reader.readAsArrayBuffer(file);
  });
}

async function importarEmails(file) {
  const registros = await lerArquivoEmails(file);
  const idsAtivos = new Set(alunosAtivos().map((aluno) => aluno.id));
  if (registros.some((registro) => !idsAtivos.has(registro.aluno_id))) throw new Error("O arquivo contém um aluno que não está ativo no cadastro.");
  await salvarEmailsEmLote(registros);
  renderizarDestinatarios();
  mostrarAvisoEmail(`${registros.length} destinatário(s) atualizado(s).`, false);
}

function baixarModeloEmails() {
  const linhas = alunosAtivos().map((aluno) => ({
    aluno_id: aluno.id,
    nome: aluno.nome,
    turma: aluno.turma,
    email: aluno.email || "",
    eh_teste: aluno.emailTeste ? "sim" : "nao",
  }));
  const sheet = XLSX.utils.json_to_sheet(linhas, { header: ["aluno_id", "nome", "turma", "email", "eh_teste"] });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Destinatarios");
  XLSX.writeFile(workbook, "destinatarios-frequencia.xlsx");
}

async function iniciarPaginaEmails() {
  if (!(await exigirLogin())) return;
  try {
    await carregarDados();
    renderizarDestinatarios();
    const [{ data: config, error: erroConfig }, { data: equipe, error: erroEquipe }] = await Promise.all([
      sb.from("email_automacao_config").select("modo,data_inicio").eq("id", 1).single(),
      sb.from("equipe").select("user_id").limit(1),
    ]);
    if (erroConfig || erroEquipe) throw erroConfig || erroEquipe;
    const modo = { desativado: "Desativado", teste: "Teste: apenas destinatários marcados", producao: "Produção" }[config.modo] || config.modo;
    $("#modoEmailAtual").textContent = `Modo atual: ${modo}${config.data_inicio ? ` · válido a partir de ${new Date(`${config.data_inicio}T12:00:00`).toLocaleDateString("pt-BR")}` : ""}`;
    await carregarFilaEmail();
  } catch (error) {
    console.error(error);
    $("#modoEmailAtual").textContent = "Não foi possível carregar a configuração. Verifique a instalação da migração SQL e as permissões da equipe.";
    mostrarAvisoEmail("Não foi possível carregar os dados da fila. Confirme a migração SQL e a política de acesso da equipe.", true);
  }
}

$("#filtroFilaEmail").addEventListener("change", () => carregarFilaEmail().catch(console.error));
$("#baixarModeloEmails").addEventListener("click", baixarModeloEmails);
$("#arquivoEmails").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try { await importarEmails(file); }
  catch (error) { mostrarAvisoEmail(error.message || "Falha ao importar arquivo.", true); }
  finally { event.target.value = ""; }
});

iniciarPaginaEmails();
