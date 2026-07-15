// ==========================================================
// CONTROLE DE PRESENÇA
// Desafio de Front-End
// ==========================================================

// ==========================================================
// TÍTULO DA PÁGINA
// ==========================================================

const titulo = document.querySelector("#titulo");

titulo.innerText = "Bem-vindo ao Controle sistema gerenciador de turma";
titulo.style.color = "#0d6efd";
titulo.style.fontSize = "50px";
titulo.style.fontWeight = "900";

// ==========================================================
// ELEMENTOS DO DASHBOARD
// ==========================================================

const totalAlunosElemento = document.querySelector("#totalAlunos");
const totalFaltasElemento = document.querySelector("#totalFaltas");
const emAtencaoElemento = document.querySelector("#emAtencao");
const emRiscoElemento = document.querySelector("#emRisco");
const mediaFaltasElemento = document.querySelector("#mediaFaltas");
const melhorAlunoElemento = document.querySelector("#melhorAluno");

// ==========================================================
// ELEMENTOS DA TABELA
// ==========================================================

const tabela = document.querySelector("#tabelaAlunos");
const pesquisa = document.querySelector("#pesquisa");

// ==========================================================
// DADOS DO SISTEMA
// ==========================================================

let alunos = [];

// ==========================================================
// ALUNO EM EDIÇÃO
// ==========================================================

// Guarda o aluno que está sendo editado
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

  let media = 0;

  if (alunos.length > 0) {
    media = totalFaltas / alunos.length;
  }

  mediaFaltasElemento.innerText = media.toFixed(1);

  melhorAlunoElemento.innerText = melhorAluno.nome;
}

// ==========================================================
// ATUALIZA A TABELA
// ==========================================================

function atualizarTabela(lista = alunos) {
  tabela.innerHTML = "";

  if (lista.length === 0) {
    tabela.innerHTML = `
            <tr>

                <td colspan="5" class="text-center text-danger py-4">

                    <i class="bi bi-search"></i>

                    Nenhum aluno cadastrado.

                    Clique em "Novo aluno" para começar.

                </td>

            </tr>
        `;

    return;
  }

  for (let aluno of lista) {
    let cor = "#198754";
    let textoSituacao = "Regular";

    if (aluno.faltas >= 5) {
      cor = "#dc3545";
      textoSituacao = "Em Risco";
    } else if (aluno.faltas >= 3) {
      cor = "#ffc107";
      textoSituacao = "Em Atenção";
    }

    let linha = `

            <tr>

                <td>

                    <div class="d-flex align-items-center">

                        <span
                            style="
                                width:12px;
                                height:12px;
                                border-radius:50%;
                                background:${cor};
                                display:inline-block;
                                margin-right:10px;
                                flex-shrink:0;
                            ">
                        </span>

                        ${aluno.nome}

                    </div>

                </td>

                <td>${aluno.turma}</td>

                <td>${aluno.faltas}</td>

                <td>

                    ${textoSituacao}

                </td>

                <td>

                    <div class="btn-group" role="group">

                        <button
                            class="btn btn-success btn-sm"
                            onclick="adicionarFalta('${aluno.id}')"
                            title="Adicionar Falta">

                            <i class="bi bi-plus"></i>

                        </button>

                        <button
                            class="btn btn-danger btn-sm"
                            onclick="removerFalta('${aluno.id}')"
                            title="Remover Falta">

                            <i class="bi bi-dash"></i>

                        </button>

                        <button
                            class="btn btn-warning btn-sm"
                            onclick="abrirEdicao('${aluno.id}')"
                            title="Editar">

                            <i class="bi bi-pencil-fill"></i>

                        </button>

                        <button
                            class="btn btn-info btn-sm text-white"
                            onclick="abrirCalendario('${aluno.id}')"
                            title="Calendário de Observações">

                            <i class="bi bi-calendar3"></i>

                        </button>

                        <button
                            class="btn btn-dark btn-sm"
                            onclick="excluirAluno('${aluno.id}')"
                            title="Excluir">

                            <i class="bi bi-trash-fill"></i>

                        </button>

                    </div>

                </td>

            </tr>

        `;

    tabela.innerHTML += linha;
  }
}

// ==========================================================
// CARREGAR TURMAS NOS SELECTS
// ==========================================================

function carregarTurmas() {
  const selectCadastro = document.querySelector("#turmaAluno");

  turmas.forEach((turma) => {
    selectCadastro.innerHTML += `

            <option value="${turma}">
                ${turma}
            </option>

        `;
  });

  const selectEdicao = document.querySelector("#editarTurma");

  turmas.forEach((turma) => {
    selectEdicao.innerHTML += `

            <option value="${turma}">
                ${turma}
            </option>

        `;
  });
}

// ==========================================================
// CARREGAR DADOS
// ==========================================================

function carregarDados() {
  const dados = localStorage.getItem("alunos");

  if (dados) {
    alunos = JSON.parse(dados);
  } else {
    alunos = [];
  }
}

// ==========================================================
// SALVAR DADOS
// ==========================================================

function salvarDados() {
  localStorage.setItem(
    "alunos",

    JSON.stringify(alunos),
  );
}

// ==========================================================
// ATUALIZA TODO O SISTEMA
// ==========================================================

function atualizarSistema() {
  atualizarCards();
  atualizarTabela();
}

// ==========================================================
// ADICIONAR FALTA
// ==========================================================

function adicionarFalta(id) {
  const aluno = alunos.find((a) => a.id === id);

  aluno.faltas++;

  salvarDados();

  atualizarSistema();
}

// ==========================================================
// REMOVER FALTA
// ==========================================================

function removerFalta(id) {
  const aluno = alunos.find((a) => a.id === id);

  if (aluno.faltas > 0) {
    aluno.faltas--;

    salvarDados();
  }

  atualizarSistema();
}

// ==========================================================
// CARREGAR FILTRO DE TURMAS
// ==========================================================

function carregarFiltroTurmas() {
  const select = document.querySelector("#filtroTurma");

  turmas.forEach((turma) => {
    select.innerHTML += `

            <option value="${turma}">
                ${turma}
            </option>

        `;
  });
}

// ==========================================================
// CADASTRAR ALUNO
// ==========================================================

function cadastrarAluno() {
  const nome = document.querySelector("#nomeAluno").value.trim();

  const turma = document.querySelector("#turmaAluno").value;

  // Validação nome

  if (nome === "") {
    Swal.fire({
      icon: "warning",

      title: "Campo obrigatório",

      text: "Digite o nome do aluno.",
    });

    return;
  }

  // Validação turma

  if (turma === "") {
    Swal.fire({
      icon: "warning",

      title: "Turma obrigatória",

      text: "Selecione uma turma para o aluno.",
    });

    return;
  }

  // Verifica aluno duplicado

  const existe = alunos.find(
    (aluno) => aluno.nome.toLowerCase() === nome.toLowerCase(),
  );

  if (existe) {
    Swal.fire({
      icon: "error",

      title: "Aluno já cadastrado",
    });

    return;
  }

  // Cria novo aluno

  const novoAluno = {
    id: crypto.randomUUID(),

    nome,

    turma,

    faltas: 0,
  };

  // Adiciona no array

  alunos.push(novoAluno);

  // Salva no localStorage

  salvarDados();

  // Atualiza tela

  atualizarSistema();

  // Limpa formulário

  document.querySelector("#nomeAluno").value = "";

  document.querySelector("#turmaAluno").selectedIndex = 0;

  // Mensagem sucesso

  Swal.fire({
    icon: "success",

    title: "Aluno cadastrado!",

    timer: 1500,

    showConfirmButton: false,
  });
}

// ==========================================================
// ABRIR EDIÇÃO
// ==========================================================

function abrirEdicao(id) {
  alunoEditando = alunos.find((aluno) => aluno.id === id);

  if (!alunoEditando) {
    Swal.fire({
      icon: "error",
      title: "Aluno não encontrado",
    });

    return;
  }

  document.querySelector("#editarNome").value = alunoEditando.nome;

  document.querySelector("#editarTurma").value = alunoEditando.turma;

  const modal = new bootstrap.Modal(document.querySelector("#modalEditar"));

  modal.show();
}

// ==========================================================
// SALVAR EDIÇÃO
// ==========================================================

function salvarEdicao() {
  const novoNome = document.querySelector("#editarNome").value.trim();

  const novaTurma = document.querySelector("#editarTurma").value;

  if (novoNome === "") {
    Swal.fire({
      icon: "warning",

      title: "Digite o nome do aluno.",
    });

    return;
  }

  if (novaTurma === "") {
    Swal.fire({
      icon: "warning",

      title: "Selecione uma turma.",
    });

    return;
  }

  alunoEditando.nome = novoNome;

  alunoEditando.turma = novaTurma;

  salvarDados();

  atualizarSistema();

  bootstrap.Modal.getInstance(document.querySelector("#modalEditar")).hide();

  Swal.fire({
    icon: "success",

    title: "Aluno atualizado!",

    timer: 1500,

    showConfirmButton: false,
  });
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

      Swal.fire({
        icon: "success",

        title: "Aluno removido!",

        timer: 1500,

        showConfirmButton: false,
      });
    }
  });
}

// ==========================================================
// ABRIR CALENDÁRIO DO ALUNO
// ==========================================================

function abrirCalendario(id) {
  // Redireciona para a página do calendário, passando o id do aluno pela URL
  window.location.href = `calendario.html?id=${id}`;
}

// ==========================================================
// PESQUISAR ALUNO
// ==========================================================

function pesquisarAluno() {
  const texto = pesquisa.value.toLowerCase();

  const resultado = alunos.filter(
    (aluno) =>
      aluno.nome.toLowerCase().includes(texto) ||
      aluno.turma.toLowerCase().includes(texto),
  );

  atualizarTabela(resultado);
}

// ==========================================================
// FILTRAR POR TURMA
// ==========================================================

function filtrarPorTurma() {
  const turmaSelecionada = document.querySelector("#filtroTurma").value;

  if (turmaSelecionada === "TODAS") {
    atualizarTabela(alunos);

    return;
  }

  const resultado = alunos.filter((aluno) => aluno.turma === turmaSelecionada);

  atualizarTabela(resultado);
}

// ==========================================================
// EVENTOS
// ==========================================================

pesquisa.addEventListener("keyup", pesquisarAluno);
const filtroTurma = document.querySelector("#filtroTurma");

filtroTurma.addEventListener("change", filtrarPorTurma);

// ==========================================================
// INICIALIZAÇÃO DO SISTEMA
// ==========================================================

carregarTurmas();

carregarFiltroTurmas();

carregarDados();

atualizarSistema();

console.log(alunos);
