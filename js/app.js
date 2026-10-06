// ==========================================================
// PAINEL - app.js (depende de turmas.js e storage.js)
// ==========================================================

let alunoEditando = null;

const $ = (s) => document.querySelector(s);
function situacao(faltas) {
  if (faltas >= 5) return { classe: "sit-risco", texto: "Em risco" };
  if (faltas >= 3) return { classe: "sit-atencao", texto: "Em atenção" };
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

  for (const a of alunos) {
    const f = faltasDoAluno(a);
    totalFaltas += f;
    if (f >= 5) emRisco++;
    else if (f >= 3) emAtencao++;
  }

  $("#totalAlunos").innerText = alunos.length;
  $("#totalFaltas").innerText = totalFaltas;
  $("#mediaFaltas").innerText = (alunos.length ? totalFaltas / alunos.length : 0).toFixed(1);
  $("#emAtencao").innerText = emAtencao;
  $("#emRisco").innerText = emRisco;
  $("#emAtencao").parentElement.classList.toggle("has", emAtencao > 0);
  $("#emRisco").parentElement.classList.toggle("has", emRisco > 0);
}

// ---------- Tabela ----------
function atualizarTabela(lista = alunos) {
  const tabela = $("#tabelaAlunos");

  if (lista.length === 0) {
    tabela.innerHTML = `<tr><td colspan="5"><div class="vazio">
      <i class="bi bi-people fs-3 d-block mb-2"></i>
      ${alunos.length === 0 ? 'Nenhum aluno cadastrado ainda. Clique em "Novo aluno" para começar.' : "Nenhum aluno encontrado com esse filtro."}
    </div></td></tr>`;
    return;
  }

  tabela.innerHTML = lista.map((a) => {
    const f = faltasDoAluno(a);
    const s = situacao(f);
    const pct = Math.min(f / 5, 1) * 100;
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
          <button class="ibtn del" onclick="excluirAluno('${a.id}')" title="Excluir"><i class="bi bi-trash3"></i></button>
        </td>
      </tr>`;
  }).join("");
}

function atualizarSistema() {
  atualizarCards();
  aplicarFiltros();
}

// ---------- Turmas nos selects ----------
["#turmaAluno", "#editarTurma", "#filtroTurma"].forEach((sel) => {
  turmas.forEach((t) => ($(sel).innerHTML += `<option value="${esc(t)}">${esc(t)}</option>`));
});

// ---------- Cadastro ----------
function cadastrarAluno() {
  const modal = $("#modalNovo");
  const inputNome = $("#nomeAluno");
  const inputTurma = $("#turmaAluno");
  const nome = inputNome.value.trim();
  limparErros(modal);

  if (nome === "") return erroCampo(inputNome, "Digite o nome do aluno.");
  if (inputTurma.value === "") return erroCampo(inputTurma, "Selecione uma turma.");
  if (alunos.some((a) => a.nome.toLowerCase() === nome.toLowerCase()))
    return erroCampo(inputNome, "Esse aluno já está cadastrado.");

  alunos.push({ id: crypto.randomUUID(), nome, turma: inputTurma.value, faltasAnteriores: 0 });
  salvarDados();
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

function salvarEdicao() {
  const nome = $("#editarNome").value.trim();
  const turma = $("#editarTurma").value;
  limparErros($("#modalEditar"));

  if (nome === "") return erroCampo($("#editarNome"), "Digite o nome do aluno.");
  if (turma === "") return erroCampo($("#editarTurma"), "Selecione uma turma.");

  alunoEditando.nome = nome;
  alunoEditando.turma = turma;
  alunoEditando.faltasAnteriores = Math.max(0, parseInt($("#editarFaltasAnt").value) || 0);
  salvarDados();
  atualizarSistema();
  bootstrap.Modal.getInstance($("#modalEditar")).hide();
  toast("success", "Aluno atualizado");
}

// ---------- Exclusão ----------
function excluirAluno(id) {
  const a = alunos.find((x) => x.id === id);

  Swal.fire({
    title: `Excluir ${a.nome}?`,
    text: "Essa ação não pode ser desfeita.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Excluir",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#b42338",
  }).then((r) => {
    if (r.isConfirmed) {
      alunos = alunos.filter((x) => x.id !== id);
      removerPresencasDoAluno(id);
      salvarDados();
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
    alunos.filter(
      (a) =>
        (a.nome.toLowerCase().includes(texto) || a.turma.toLowerCase().includes(texto)) &&
        (turma === "TODAS" || a.turma === turma),
    ),
  );
}

$("#pesquisa").addEventListener("input", aplicarFiltros);
$("#filtroTurma").addEventListener("change", aplicarFiltros);

// ---------- Início ----------
carregarDados();
atualizarSistema();
