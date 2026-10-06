

// ---------- Data de hoje no cabeçalho ----------
document.querySelector("#dataHoje").innerText = new Date().toLocaleDateString(
  "pt-BR",
  { weekday: "long", day: "numeric", month: "long", year: "numeric" },
);

// ---------- Elementos do dashboard ----------
const totalAlunosElemento = document.querySelector("#totalAlunos");
const totalFaltasElemento = document.querySelector("#totalFaltas");
const emAtencaoElemento = document.querySelector("#emAtencao");
const emRiscoElemento = document.querySelector("#emRisco");
const mediaFaltasElemento = document.querySelector("#mediaFaltas");
const melhorAlunoElemento = document.querySelector("#melhorAluno");

// ---------- Elementos da tabela ----------
const tabela = document.querySelector("#tabelaAlunos");
const pesquisa = document.querySelector("#pesquisa");
const filtroTurma = document.querySelector("#filtroTurma");

// ---------- Dados ----------
let alunos = [];
let alunoEditando = null;

// ==========================================================
// ATUALIZA OS CARDS
// ==========================================================
function atualizarCards() {
  totalAlunosElemento.innerText = alunos.length;

  let totalFaltas = 0;
  let emAtencao = 0;
  let emRisco = 0;
  let melhorAluno = alunos[0]; 

  for (let aluno of alunos) {
    totalFaltas += aluno.faltas;

    if (aluno.faltas < melhorAluno.faltas) {
      melhorAluno = aluno;
    }

    if (aluno.faltas >= 5) {
      emRisco++;
    } else if (aluno.faltas >= 3) {
      emAtencao++;
    }
  }

  totalFaltasElemento.innerText = totalFaltas;
  emAtencaoElemento.innerText = emAtencao;
  emRiscoElemento.innerText = emRisco;

  const media = alunos.length > 0 ? totalFaltas / alunos.length : 0;
  mediaFaltasElemento.innerText = media.toFixed(1);

  
  melhorAlunoElemento.innerText = melhorAluno ? melhorAluno.nome : "-";
}

// ==========================================================
// ATUALIZA A TABELA
// ==========================================================
function atualizarTabela(lista = alunos) {
  tabela.innerHTML = "";

  if (lista.length === 0) {
    tabela.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted py-4">
          <i class="bi bi-search"></i>
          Nenhum aluno encontrado. Cadastre um aluno para começar.
        </td>
      </tr>`;
    return;
  }

  for (let aluno of lista) {
    let classe = "sit-regular";
    let textoSituacao = "Regular";

    if (aluno.faltas >= 5) {
      classe = "sit-risco";
      textoSituacao = "Em Risco";
    } else if (aluno.faltas >= 3) {
      classe = "sit-atencao";
      textoSituacao = "Em Atenção";
    }

    tabela.innerHTML += `
      <tr>
        <td>
          <div class="d-flex align-items-center">
            <span class="avatar">${aluno.nome.charAt(0).toUpperCase()}</span>
            ${aluno.nome}
          </div>
        </td>
        <td>${aluno.turma}</td>
        <td>${aluno.faltas}</td>
        <td><span class="badge-sit ${classe}">${textoSituacao}</span></td>
        <td>
          <div class="btn-group" role="group">
            <button class="btn btn-success btn-sm" onclick="adicionarFalta('${aluno.id}')" title="Adicionar falta">
              <i class="bi bi-plus"></i>
            </button>
            <button class="btn btn-danger btn-sm" onclick="removerFalta('${aluno.id}')" title="Remover falta">
              <i class="bi bi-dash"></i>
            </button>
            <button class="btn btn-warning btn-sm" onclick="abrirEdicao('${aluno.id}')" title="Editar">
              <i class="bi bi-pencil-fill"></i>
            </button>
            <button class="btn btn-info btn-sm text-white" onclick="abrirCalendario('${aluno.id}')" title="Calendário de observações">
              <i class="bi bi-calendar3"></i>
            </button>
            <button class="btn btn-dark btn-sm" onclick="excluirAluno('${aluno.id}')" title="Excluir">
              <i class="bi bi-trash-fill"></i>
            </button>
          </div>
        </td>
      </tr>`;
  }
}

// ==========================================================
// CARREGAR TURMAS NOS SELECTS
// ==========================================================
function preencherSelect(seletor) {
  const select = document.querySelector(seletor);
  turmas.forEach((turma) => {
    select.innerHTML += `<option value="${turma}">${turma}</option>`;
  });
}

function carregarTurmas() {
  preencherSelect("#turmaAluno");
  preencherSelect("#editarTurma");
}

function carregarFiltroTurmas() {
  preencherSelect("#filtroTurma");
}

// ==========================================================
// ATUALIZA TODO O SISTEMA
// ==========================================================
function atualizarSistema() {
  atualizarCards();
  atualizarTabela();
}

// ==========================================================
// FALTAS
// ==========================================================
function adicionarFalta(id) {
  const aluno = alunos.find((a) => a.id === id);
  aluno.faltas++;
  salvarDados();
  atualizarSistema();
}

function removerFalta(id) {
  const aluno = alunos.find((a) => a.id === id);

  if (aluno.faltas > 0) {
    aluno.faltas--;
    salvarDados();
  }

  atualizarSistema();
}

// ==========================================================
// CADASTRAR ALUNO
// ==========================================================
function cadastrarAluno() {
  const nome = document.querySelector("#nomeAluno").value.trim();
  const turma = document.querySelector("#turmaAluno").value;

  if (nome === "") {
    Swal.fire({ icon: "warning", title: "Campo obrigatório", text: "Digite o nome do aluno." });
    return;
  }

  if (turma === "") {
    Swal.fire({ icon: "warning", title: "Turma obrigatória", text: "Selecione uma turma para o aluno." });
    return;
  }

  const existe = alunos.find((a) => a.nome.toLowerCase() === nome.toLowerCase());

  if (existe) {
    Swal.fire({ icon: "error", title: "Aluno já cadastrado" });
    return;
  }

  alunos.push({ id: crypto.randomUUID(), nome, turma, faltas: 0 });

  salvarDados();
  atualizarSistema();

  document.querySelector("#nomeAluno").value = "";
  document.querySelector("#turmaAluno").selectedIndex = 0;

  Swal.fire({ icon: "success", title: "Aluno cadastrado!", timer: 1500, showConfirmButton: false });
}

// ==========================================================
// EDIÇÃO
// ==========================================================
function abrirEdicao(id) {
  alunoEditando = alunos.find((aluno) => aluno.id === id);

  if (!alunoEditando) {
    Swal.fire({ icon: "error", title: "Aluno não encontrado" });
    return;
  }

  document.querySelector("#editarNome").value = alunoEditando.nome;
  document.querySelector("#editarTurma").value = alunoEditando.turma;

  new bootstrap.Modal(document.querySelector("#modalEditar")).show();
}

function salvarEdicao() {
  const novoNome = document.querySelector("#editarNome").value.trim();
  const novaTurma = document.querySelector("#editarTurma").value;

  if (novoNome === "") {
    Swal.fire({ icon: "warning", title: "Digite o nome do aluno." });
    return;
  }

  if (novaTurma === "") {
    Swal.fire({ icon: "warning", title: "Selecione uma turma." });
    return;
  }

  alunoEditando.nome = novoNome;
  alunoEditando.turma = novaTurma;

  salvarDados();
  atualizarSistema();

  bootstrap.Modal.getInstance(document.querySelector("#modalEditar")).hide();

  Swal.fire({ icon: "success", title: "Aluno atualizado!", timer: 1500, showConfirmButton: false });
}

// ==========================================================
// EXCLUIR ALUNO
// ==========================================================
function excluirAluno(id) {
  Swal.fire({
    title: "Deseja realmente excluir?",
    text: "Essa ação não poderá ser desfeita.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sim",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#dc3545",
  }).then((resultado) => {
    if (resultado.isConfirmed) {
      alunos = alunos.filter((aluno) => aluno.id !== id);
      salvarDados();
      atualizarSistema();
      Swal.fire({ icon: "success", title: "Aluno removido!", timer: 1500, showConfirmButton: false });
    }
  });
}

// ==========================================================
// CALENDÁRIO DO ALUNO
// ==========================================================
function abrirCalendario(id) {
  window.location.href = `calendario.html?id=${id}`;
}

// ==========================================================
// PESQUISA E FILTRO (agora funcionam juntos)
// ==========================================================
function aplicarFiltros() {
  const texto = pesquisa.value.toLowerCase();
  const turmaSelecionada = filtroTurma.value;

  const resultado = alunos.filter((aluno) => {
    const bateTexto =
      aluno.nome.toLowerCase().includes(texto) ||
      aluno.turma.toLowerCase().includes(texto);
    const bateTurma =
      turmaSelecionada === "TODAS" || aluno.turma === turmaSelecionada;

    return bateTexto && bateTurma;
  });

  atualizarTabela(resultado);
}

pesquisa.addEventListener("keyup", aplicarFiltros);
filtroTurma.addEventListener("change", aplicarFiltros);

// ==========================================================
// INICIALIZAÇÃO
// ==========================================================
carregarTurmas();
carregarFiltroTurmas();
carregarDados();
atualizarSistema();
