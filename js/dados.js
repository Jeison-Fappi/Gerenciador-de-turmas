// ==========================================================
// DADOS COMPARTILHADOS (alunos, presenças e utilitários)
// presencas = { "2026-10-06": { "<idAluno>": "P" | "F" | "J" } }
// ==========================================================

let alunos = [];
let presencas = {};

function carregarDados() {
  alunos = JSON.parse(localStorage.getItem("alunos") || "[]");
  presencas = JSON.parse(localStorage.getItem("presencas") || "{}");

  // Migração: o contador antigo vira "faltas sem data"
  let mudou = false;
  alunos.forEach((a) => {
    if (a.faltasAnteriores === undefined) {
      a.faltasAnteriores = a.faltas || 0;
      delete a.faltas;
      mudou = true;
    }
  });
  if (mudou) salvarDados();
}

function salvarDados() {
  localStorage.setItem("alunos", JSON.stringify(alunos));
}

function salvarPresencas() {
  localStorage.setItem("presencas", JSON.stringify(presencas));
}

function statusDoDia(alunoId, data) {
  return (presencas[data] || {})[alunoId] || "";
}

function marcarStatus(alunoId, data, status) {
  if (!presencas[data]) presencas[data] = {};
  if (status === "") delete presencas[data][alunoId];
  else presencas[data][alunoId] = status;
  if (Object.keys(presencas[data]).length === 0) delete presencas[data];
  salvarPresencas();
}

function removerPresencasDoAluno(alunoId) {
  for (const dia in presencas) delete presencas[dia][alunoId];
  for (const dia in presencas) if (Object.keys(presencas[dia]).length === 0) delete presencas[dia];
  salvarPresencas();
}

// Faltas = antigas (sem data) + dias marcados como Falta. Justificada não conta.
function faltasDoAluno(aluno) {
  let n = aluno.faltasAnteriores || 0;
  for (const dia in presencas) if (presencas[dia][aluno.id] === "F") n++;
  return n;
}

function justificadasDoAluno(aluno) {
  let n = 0;
  for (const dia in presencas) if (presencas[dia][aluno.id] === "J") n++;
  return n;
}

function dataISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const esc = (t) =>
  String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const iniciais = (nome) => {
  const p = nome.trim().split(/\s+/);
  return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
};
