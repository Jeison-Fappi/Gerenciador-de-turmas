// ==========================================================
// CALENDÁRIO DE OBSERVAÇÕES
// ==========================================================

// ==========================================================
// ELEMENTOS DA PÁGINA
// ==========================================================

const nomeAlunoElemento = document.querySelector("#nomeAlunoCalendario");

const turmaAlunoElemento = document.querySelector("#turmaAlunoCalendario");

const mesAnoElemento = document.querySelector("#mesAnoAtual");

const gridElemento = document.querySelector("#calendarioGrid");

// ==========================================================
// PEGA O ID DO ALUNO PELA URL
// ==========================================================

const parametros = new URLSearchParams(window.location.search);

const alunoId = parametros.get("id");

// ==========================================================
// NOMES DOS MESES
// ==========================================================

const nomesMeses = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

// ==========================================================
// MÊS/ANO ATUALMENTE EXIBIDO NO CALENDÁRIO
// ==========================================================

let dataAtual = new Date();
dataAtual.setDate(1); // sempre trabalha com o dia 1 do mês exibido

// ==========================================================
// ALUNO ATUAL
// ==========================================================

let aluno = null;

// ==========================================================
// CARREGAR ALUNO
// ==========================================================

function carregarAluno() {
  const dados = localStorage.getItem("alunos");

  const alunos = dados ? JSON.parse(dados) : [];

  aluno = alunos.find((a) => a.id === alunoId);

  if (!aluno) {
    Swal.fire({
      icon: "error",
      title: "Aluno não encontrado",
    });

    return false;
  }

  nomeAlunoElemento.innerText = aluno.nome;

  turmaAlunoElemento.innerText = aluno.turma;

  return true;
}

// ==========================================================
// OBSERVAÇÕES (localStorage)
// Estrutura: { "1": { "2026-07-15": "texto da observação" } }
// ==========================================================

function carregarObservacoes() {
  const dados = localStorage.getItem("observacoes");

  return dados ? JSON.parse(dados) : {};
}

function salvarObservacoes(observacoes) {
  localStorage.setItem("observacoes", JSON.stringify(observacoes));
}

function getObservacao(dataStr) {
  const observacoes = carregarObservacoes();

  if (!observacoes[alunoId]) {
    return "";
  }

  return observacoes[alunoId][dataStr] || "";
}

function salvarObservacao(dataStr, texto) {
  const observacoes = carregarObservacoes();

  if (!observacoes[alunoId]) {
    observacoes[alunoId] = {};
  }

  if (texto.trim() === "") {
    // Se o texto estiver vazio, remove a observação daquele dia
    delete observacoes[alunoId][dataStr];
  } else {
    observacoes[alunoId][dataStr] = texto.trim();
  }

  salvarObservacoes(observacoes);
}

// ==========================================================
// FORMATA UMA DATA PARA "YYYY-MM-DD"
// ==========================================================

function formatarData(ano, mes, dia) {
  const mesFormatado = String(mes + 1).padStart(2, "0");
  const diaFormatado = String(dia).padStart(2, "0");

  return `${ano}-${mesFormatado}-${diaFormatado}`;
}

// ==========================================================
// RENDERIZA O CALENDÁRIO DO MÊS ATUAL
// ==========================================================

function renderizarCalendario() {
  const ano = dataAtual.getFullYear();
  const mes = dataAtual.getMonth();

  mesAnoElemento.innerText = `${nomesMeses[mes]} de ${ano}`;

  gridElemento.innerHTML = "";

  // Dia da semana em que o mês começa (0 = domingo)
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();

  // Quantidade de dias no mês
  const totalDias = new Date(ano, mes + 1, 0).getDate();

  // Data de hoje, para destacar
  const hoje = new Date();
  const ehMesAtual = hoje.getFullYear() === ano && hoje.getMonth() === mes;

  // Espaços vazios antes do dia 1
  for (let i = 0; i < primeiroDiaSemana; i++) {
    const vazio = document.createElement("div");
    vazio.classList.add("dia-vazio");
    gridElemento.appendChild(vazio);
  }

  // Dias do mês
  for (let dia = 1; dia <= totalDias; dia++) {
    const dataStr = formatarData(ano, mes, dia);
    const observacao = getObservacao(dataStr);

    const celula = document.createElement("div");
    celula.classList.add("dia-celula");
    celula.innerText = dia;
    celula.title = observacao
      ? "Ver / editar observação"
      : "Adicionar observação";

    if (observacao) {
      celula.classList.add("dia-com-observacao");
    }

    if (ehMesAtual && dia === hoje.getDate()) {
      celula.classList.add("dia-hoje");
    }

    celula.addEventListener("click", () =>
      abrirObservacao(dataStr, dia, mes, ano),
    );

    gridElemento.appendChild(celula);
  }
}

// ==========================================================
// ABRE A JANELA PARA ADICIONAR/EDITAR/EXCLUIR OBSERVAÇÃO
// ==========================================================

function abrirObservacao(dataStr, dia, mes, ano) {
  const observacaoAtual = getObservacao(dataStr);
  const dataFormatada = `${String(dia).padStart(2, "0")} de ${nomesMeses[mes]} de ${ano}`;

  Swal.fire({
    title: dataFormatada,
    input: "textarea",
    inputLabel: "Observação da aula",
    inputValue: observacaoAtual,
    inputPlaceholder: "Ex: Aluno faltou sem justificativa...",
    showCancelButton: true,
    showDenyButton: observacaoAtual !== "",
    confirmButtonText: "Salvar",
    denyButtonText: "Excluir",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#0d6efd",
    denyButtonColor: "#dc3545",
  }).then((resultado) => {
    if (resultado.isConfirmed) {
      salvarObservacao(dataStr, resultado.value || "");

      renderizarCalendario();

      Swal.fire({
        icon: "success",
        title: "Observação salva!",
        timer: 1200,
        showConfirmButton: false,
      });
    } else if (resultado.isDenied) {
      salvarObservacao(dataStr, "");

      renderizarCalendario();

      Swal.fire({
        icon: "success",
        title: "Observação removida!",
        timer: 1200,
        showConfirmButton: false,
      });
    }
  });
}

// ==========================================================
// MUDA O MÊS EXIBIDO (-1 = anterior, 1 = próximo)
// ==========================================================

function mudarMes(direcao) {
  dataAtual.setMonth(dataAtual.getMonth() + direcao);

  renderizarCalendario();
}

// ==========================================================
// INICIALIZAÇÃO
// ==========================================================

document.addEventListener("DOMContentLoaded", () => {
  if (carregarAluno()) {
    renderizarCalendario();
  }
});
