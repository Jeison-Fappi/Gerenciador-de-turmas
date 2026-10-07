// ==========================================================
// DADOS COMPARTILHADOS (Supabase)
// Carrega tudo para a memória uma vez; leituras são imediatas
// e as gravações vão para o banco.
// ==========================================================

const configurado = !SUPABASE_URL.includes("COLE_AQUI");
const sb = configurado ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let usuarioEmail = "";
let alunos = [];
let presencas = {}; // { "2026-10-06": { idAluno: "P" | "F" | "J" } }
let observacoes = {}; // { idAluno: { "2026-10-06": "texto" } }

// ---------- Login ----------
async function exigirLogin() {
  if (!configurado) {
    document.body.innerHTML =
      '<p style="padding:40px;font-family:sans-serif">Configure o arquivo <b>js/config.js</b> com a URL e a chave do Supabase.</p>';
    return false;
  }
  const { data } = await sb.auth.getSession();
  if (!data.session) {
    location.href = "login.html";
    return false;
  }
  usuarioEmail = data.session.user.email;
  const el = document.getElementById("userEmail");
  if (el) el.innerText = data.session.user.email;
  return true;
}

async function sair() {
  await sb.auth.signOut();
  location.href = "login.html";
}

function falhaSalvar(e) {
  console.error(e);
  alert("Não foi possível salvar. Verifique a conexão, recarregue a página e tente de novo.");
}

// ---------- Leitura ----------
async function buscarTudo(tabela, ordem) {
  let todas = [];
  let de = 0;
  while (true) {
    let q = sb.from(tabela).select("*");
    ordem.forEach((c) => (q = q.order(c)));
    const { data, error } = await q.range(de, de + 999); // o Supabase devolve no máximo 1000 por vez
    if (error) throw error;
    todas = todas.concat(data);
    if (data.length < 1000) break;
    de += 1000;
  }
  return todas;
}

const doBanco = (r) => ({ id: r.id, nome: r.nome, turma: r.turma, faltasAnteriores: r.faltas_anteriores });
const porNome = (a, b) => a.nome.localeCompare(b.nome, "pt-BR");

async function carregarDados() {
  const [a, p, o] = await Promise.all([
    buscarTudo("alunos", ["nome"]),
    buscarTudo("presencas", ["data", "aluno_id"]),
    buscarTudo("observacoes", ["data", "aluno_id"]),
  ]);

  alunos = a.map(doBanco);
  presencas = {};
  p.forEach((r) => ((presencas[r.data] ||= {})[r.aluno_id] = r.status));
  observacoes = {};
  o.forEach((r) => ((observacoes[r.aluno_id] ||= {})[r.data] = r.texto));
}

// ---------- Alunos ----------
async function criarAluno(nome, turma, faltasAnteriores = 0) {
  const { data, error } = await sb
    .from("alunos")
    .insert({ nome, turma, faltas_anteriores: faltasAnteriores })
    .select()
    .single();
  if (error) throw error;
  const novo = doBanco(data);
  alunos.push(novo);
  alunos.sort(porNome);
  return novo;
}

async function atualizarAluno(a) {
  const { error } = await sb
    .from("alunos")
    .update({ nome: a.nome, turma: a.turma, faltas_anteriores: a.faltasAnteriores })
    .eq("id", a.id);
  if (error) throw error;
  alunos.sort(porNome);
}

async function removerAluno(id) {
  const { error } = await sb.from("alunos").delete().eq("id", id); // presenças e observações saem junto (cascade)
  if (error) throw error;
  alunos = alunos.filter((a) => a.id !== id);
  for (const dia in presencas) {
    delete presencas[dia][id];
    if (Object.keys(presencas[dia]).length === 0) delete presencas[dia];
  }
  delete observacoes[id];
}

// ---------- Presenças ----------
function statusDoDia(alunoId, data) {
  return (presencas[data] || {})[alunoId] || "";
}

function aplicarNoCache(alunoId, data, status) {
  if (!presencas[data]) presencas[data] = {};
  if (status === "") delete presencas[data][alunoId];
  else presencas[data][alunoId] = status;
  if (Object.keys(presencas[data]).length === 0) delete presencas[data];
}

// Atualiza a memória na hora (a tela responde rápido) e grava no banco em seguida
async function marcarStatus(alunoId, data, status) {
  aplicarNoCache(alunoId, data, status);
  const q = sb.from("presencas");
  const { error } =
    status === ""
      ? await q.delete().eq("aluno_id", alunoId).eq("data", data)
      : await q.upsert({ aluno_id: alunoId, data, status });
  if (error) throw error;
}

async function marcarVarios(ids, data, status) {
  ids.forEach((id) => aplicarNoCache(id, data, status));
  if (!ids.length) return;
  const { error } = await sb.from("presencas").upsert(ids.map((id) => ({ aluno_id: id, data, status })));
  if (error) throw error;
}

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

// ---------- Observações ----------
const obsDoAluno = (alunoId) => observacoes[alunoId] || {};

async function salvarObs(alunoId, data, texto) {
  texto = texto.trim();
  if (!observacoes[alunoId]) observacoes[alunoId] = {};
  if (texto === "") {
    delete observacoes[alunoId][data];
    const { error } = await sb.from("observacoes").delete().eq("aluno_id", alunoId).eq("data", data);
    if (error) throw error;
  } else {
    observacoes[alunoId][data] = texto;
    const { error } = await sb.from("observacoes").upsert({ aluno_id: alunoId, data, texto });
    if (error) throw error;
  }
}

// ---------- Importar o que estava salvo no navegador ----------
async function emLotes(tabela, linhas) {
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await sb.from(tabela).upsert(linhas.slice(i, i + 500));
    if (error) throw error;
  }
}

async function importarDoNavegador() {
  const antigos = JSON.parse(localStorage.getItem("alunos") || "[]");
  const pres = JSON.parse(localStorage.getItem("presencas") || "{}");
  const obs = JSON.parse(localStorage.getItem("observacoes") || "{}");

  const mapa = {}; // id antigo -> id no banco
  let novos = 0;

  for (const a of antigos) {
    const igual = alunos.find((x) => x.nome.toLowerCase() === a.nome.toLowerCase());
    if (igual) { mapa[a.id] = igual.id; continue; }
    const criado = await criarAluno(a.nome, a.turma, a.faltasAnteriores ?? a.faltas ?? 0);
    mapa[a.id] = criado.id;
    novos++;
  }

  const linhasP = [];
  for (const dia in pres)
    for (const id in pres[dia]) if (mapa[id]) linhasP.push({ aluno_id: mapa[id], data: dia, status: pres[dia][id] });

  const linhasO = [];
  for (const id in obs)
    for (const dia in obs[id]) if (mapa[id]) linhasO.push({ aluno_id: mapa[id], data: dia, texto: obs[id][dia] });

  await emLotes("presencas", linhasP);
  await emLotes("observacoes", linhasO);
  return { alunos: novos, presencas: linhasP.length, observacoes: linhasO.length };
}

// ---------- Utilitários ----------
function dataISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const esc = (t) =>
  String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const iniciais = (nome) => {
  const p = nome.trim().split(/\s+/);
  return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
};
