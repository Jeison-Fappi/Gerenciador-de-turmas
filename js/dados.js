// DADOS COMPARTILHADOS (Supabase)


const configurado = !SUPABASE_URL.includes("COLE_AQUI");
const sb = configurado ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let usuarioEmail = "";
let alunos = [];
let turmas = [];
let cadastroTurmas = [];
let excecoesAula = [];
let presencas = {}; 
let observacoes = {}; 

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
  const [a, p, o, t, e] = await Promise.all([
    buscarTudo("alunos", ["nome"]),
    buscarTudo("presencas", ["data", "aluno_id"]),
    buscarTudo("observacoes", ["data", "aluno_id"]),
    buscarTudo("turmas", ["nome"]),
    buscarTudo("excecoes_aula", ["data", "turma"]),
  ]);

  alunos = a.map(doBanco);
  cadastroTurmas = t;
  turmas = t.filter((r) => !r.arquivada).map((r) => r.nome);
  excecoesAula = e;
  presencas = {};
  p.forEach((r) => ((presencas[r.data] ||= {})[r.aluno_id] = r.status));
  observacoes = {};
  o.forEach((r) => ((observacoes[r.aluno_id] ||= {})[r.data] = r.texto));
}

// ---------- Turmas e agenda ----------
function ordenarCadastroTurmas() {
  cadastroTurmas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  turmas = cadastroTurmas.filter((r) => !r.arquivada).map((r) => r.nome);
}

async function salvarTurma(nome, agenda, nomeAnterior = null) {
  const query = nomeAnterior
    ? sb.from("turmas").update({ nome, agenda }).eq("nome", nomeAnterior)
    : sb.from("turmas").insert({ nome, agenda });
  const { data, error } = await query.select().single();
  if (error) throw error;
  if (nomeAnterior) alunos.forEach((a) => { if (a.turma === nomeAnterior) a.turma = nome; });
  const index = cadastroTurmas.findIndex((r) => r.nome === nomeAnterior);
  if (index >= 0) cadastroTurmas[index] = data;
  else cadastroTurmas.push(data);
  ordenarCadastroTurmas();
  return data;
}

async function arquivarTurma(nome, arquivada) {
  const { data, error } = await sb.from("turmas").update({ arquivada }).eq("nome", nome).select().single();
  if (error) throw error;
  const index = cadastroTurmas.findIndex((r) => r.nome === nome);
  if (index >= 0) cadastroTurmas[index] = data;
  ordenarCadastroTurmas();
}

function excecaoAula(turma, data) {
  return excecoesAula.find((r) => r.turma === turma && r.data === data) || null;
}

function aulaDaTurma(turmaNome, data) {
  const registro = cadastroTurmas.find((r) => r.nome === turmaNome);
  if (!registro || registro.arquivada) return false;
  const excecao = excecaoAula(turmaNome, data);
  if (excecao) return excecao.ativa;
  const diaSemana = new Date(`${data}T12:00:00`).getDay();
  return (registro.agenda || []).some((horario) => Number(horario.split(":")[0]) === diaSemana);
}

async function salvarExcecaoAula(turma, data, ativa) {
  const { error } = await sb.from("excecoes_aula").upsert({ turma, data, ativa }, { onConflict: "turma,data" });
  if (error) throw error;
  const atual = excecaoAula(turma, data);
  if (atual) atual.ativa = ativa;
  else excecoesAula.push({ turma, data, ativa });
}

async function restaurarAgendaAula(turma, data) {
  const { error } = await sb.from("excecoes_aula").delete().eq("turma", turma).eq("data", data);
  if (error) throw error;
  excecoesAula = excecoesAula.filter((r) => r.turma !== turma || r.data !== data);
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

async function criarAlunosEmLote(nomes, turma) {
  const criados = [];
  for (let i = 0; i < nomes.length; i += 250) {
    const { data, error } = await sb.from("alunos")
      .insert(nomes.slice(i, i + 250).map((nome) => ({ nome, turma })))
      .select();
    if (error) throw error;
    criados.push(...data.map(doBanco));
  }
  alunos.push(...criados);
  alunos.sort(porNome);
  return criados.length;
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
  const { error } = await sb.from("alunos").delete().eq("id", id); 
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

// Atualiza a memória na hora e grava no banco em seguida
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
