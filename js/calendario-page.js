// ==========================================================
// CALENDÁRIO DO ALUNO: status do dia + observações
// ==========================================================

const $ = (s) => document.querySelector(s);
const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const TAGS = { P: "Presente", F: "Falta", J: "Justif." };

carregarDados();

const alunoId = new URLSearchParams(location.search).get("id");
const aluno = alunos.find((a) => a.id === alunoId);
let ref = new Date();
ref.setDate(1);

// ---------- Observações (mesma estrutura de antes) ----------
const lerObs = () => JSON.parse(localStorage.getItem("observacoes") || "{}");

function salvarObs(data, texto) {
  const todas = lerObs();
  if (!todas[alunoId]) todas[alunoId] = {};
  if (texto.trim() === "") delete todas[alunoId][data];
  else todas[alunoId][data] = texto.trim();
  localStorage.setItem("observacoes", JSON.stringify(todas));
}

// ---------- Tela ----------
function renderizar() {
  const ano = ref.getFullYear();
  const mes = ref.getMonth();
  const obs = lerObs()[alunoId] || {};
  const hoje = dataISO();
  const primeiro = new Date(ano, mes, 1).getDay();
  const total = new Date(ano, mes + 1, 0).getDate();

  $("#mesAno").innerText = `${meses[mes]} de ${ano}`;

  let html = "<div></div>".repeat(primeiro);
  for (let d = 1; d <= total; d++) {
    const ds = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const st = statusDoDia(alunoId, ds);
    const fds = [0, 6].includes((primeiro + d - 1) % 7) ? "fds" : "";
    html += `<button class="cal-dia ${st} ${fds} ${ds === hoje ? "hoje" : ""}" onclick="abrirDia('${ds}')">
      <span>${d}</span><span class="tag">${TAGS[st] || ""}</span>
      ${obs[ds] ? '<i class="bi bi-chat-left-text-fill obs"></i>' : ""}
    </button>`;
  }
  $("#calGrid").innerHTML = html;

  $("#kFaltas").innerText = faltasDoAluno(aluno);
  $("#kJust").innerText = justificadasDoAluno(aluno);
  $("#kObs").innerText = Object.keys(obs).length;
  $("#kFaltas").parentElement.classList.toggle("has", faltasDoAluno(aluno) > 0);
}

function mudarMes(n) {
  ref.setMonth(ref.getMonth() + n);
  renderizar();
}

function abrirDia(ds) {
  const [y, m, d] = ds.split("-").map(Number);
  let st = statusDoDia(alunoId, ds);
  const obsAtual = (lerObs()[alunoId] || {})[ds] || "";
  const b = (s, ic, t) => `<button type="button" class="${s} ${st === s ? "on" : ""}" data-st="${s}"><i class="bi bi-${ic}"></i> ${t}</button>`;

  Swal.fire({
    title: `${String(d).padStart(2, "0")} de ${meses[m - 1]} de ${y}`,
    html: `
      <div class="seg mb-3" id="segDia">${b("P", "check-lg", "Presente")}${b("F", "x-lg", "Falta")}${b("J", "file-earmark-check", "Justificada")}</div>
      <textarea id="obsDia" class="form-control" rows="4" placeholder="Observação sobre o aluno neste dia...">${esc(obsAtual)}</textarea>`,
    showCancelButton: true,
    confirmButtonText: "Salvar",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#0095da",
    didOpen: () => {
      $("#segDia").addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        st = st === btn.dataset.st ? "" : btn.dataset.st;
        $("#segDia").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x.dataset.st === st));
      });
    },
    preConfirm: () => document.getElementById("obsDia").value,
  }).then((r) => {
    if (!r.isConfirmed) return;
    marcarStatus(alunoId, ds, st);
    salvarObs(ds, r.value || "");
    renderizar();
  });
}

if (!aluno) {
  $("#nomeAluno").innerText = "Aluno não encontrado";
  $("#calGrid").innerHTML = '<p class="text-muted">Volte ao painel e abra o calendário de um aluno.</p>';
} else {
  $("#avatarAluno").innerText = iniciais(aluno.nome);
  $("#nomeAluno").innerText = aluno.nome;
  $("#turmaAluno").innerText = aluno.turma;
  renderizar();
}
