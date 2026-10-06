// ==========================================================
// STORAGE
// ==========================================================

function carregarDados() {
  const dados = localStorage.getItem("alunos");

  if (dados) {
    alunos = JSON.parse(dados);
  } else {
    alunos = [];
  }
}

function salvarDados() {
  localStorage.setItem("alunos", JSON.stringify(alunos));
}
