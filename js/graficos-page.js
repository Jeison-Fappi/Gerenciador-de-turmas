// ==========================================================
// PÁGINA DE GRÁFICOS - lê os alunos do localStorage
// ==========================================================

carregarDados();
const dados = alunos.map((a) => ({ ...a, faltas: faltasDoAluno(a) }));
const COR = { regular: "#2fa77a", atencao: "#e0a800", risco: "#b42338", marca: "#0095da", apagado: "#c9dbe6" };
const graficos = {};
let turmaAtual = "TODAS";

const situacao = (f) => (f >= 5 ? "risco" : f >= 3 ? "atencao" : "regular");

function mostrarAviso(msg) {
  document.getElementById("conteudo").classList.add("d-none");
  const aviso = document.getElementById("aviso");
  aviso.classList.remove("d-none");
  aviso.innerHTML = msg;
}

function desenhar(id, config) {
  if (graficos[id]) graficos[id].destroy();
  graficos[id] = new Chart(document.getElementById(id), config);
}

function desenharChips() {
  const box = document.getElementById("chips");
  box.innerHTML = ["TODAS", ...turmas]
    .map((t) => `<button class="pill ${t === turmaAtual ? "on" : ""}" data-turma="${t}">${t === "TODAS" ? "Todas as turmas" : t}</button>`)
    .join("");
  box.querySelectorAll(".pill").forEach((b) =>
    b.addEventListener("click", () => {
      turmaAtual = b.dataset.turma;
      desenharChips();
      renderizar();
    }),
  );
}

function renderizar() {
  const lista = dados.filter((a) => turmaAtual === "TODAS" || a.turma === turmaAtual);
  const total = lista.reduce((s, a) => s + a.faltas, 0);

  document.getElementById("kAlunos").innerText = lista.length;
  document.getElementById("kFaltas").innerText = total;
  document.getElementById("kMedia").innerText = (lista.length ? total / lista.length : 0).toFixed(1);
  const risco = lista.filter((a) => a.faltas >= 5).length;
  document.getElementById("kRisco").innerText = risco;
  document.getElementById("kRisco").parentElement.classList.toggle("has", risco > 0);

  // 1) Faltas por turma
  const porTurma = {};
  turmas.forEach((t) => (porTurma[t] = 0));
  dados.forEach((a) => (porTurma[a.turma] = (porTurma[a.turma] || 0) + a.faltas));
  const nomes = Object.keys(porTurma);

  desenhar("graficoTurmas", {
    type: "bar",
    data: {
      labels: nomes,
      datasets: [{
        data: nomes.map((n) => porTurma[n]),
        backgroundColor: nomes.map((n) => (turmaAtual === "TODAS" || n === turmaAtual ? COR.marca : COR.apagado)),
        borderRadius: 8,
        maxBarThickness: 56,
      }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } },
    },
  });

  // 2) Situação dos alunos
  const c = { regular: 0, atencao: 0, risco: 0 };
  lista.forEach((a) => c[situacao(a.faltas)]++);

  desenhar("graficoSituacao", {
    type: "doughnut",
    data: {
      labels: ["Regular", "Em atenção", "Em risco"],
      datasets: [{ data: [c.regular, c.atencao, c.risco], backgroundColor: [COR.regular, COR.atencao, COR.risco], borderWidth: 3, borderColor: "#fff" }],
    },
    options: { cutout: "62%", plugins: { legend: { position: "bottom", labels: { usePointStyle: true, padding: 16 } } } },
  });

  // 3) Faltas por aluno
  const ordenados = [...lista].sort((a, b) => b.faltas - a.faltas);
  document.getElementById("boxAlunos").style.height = Math.max(240, ordenados.length * 40 + 50) + "px";

  desenhar("graficoAlunos", {
    type: "bar",
    data: {
      labels: ordenados.map((a) => `${a.nome} (${a.turma})`),
      datasets: [{
        data: ordenados.map((a) => a.faltas),
        backgroundColor: ordenados.map((a) => COR[situacao(a.faltas)]),
        borderRadius: 6,
        maxBarThickness: 26,
      }],
    },
    options: {
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { grid: { display: false } } },
    },
  });
}

// ---------- Início ----------
if (typeof Chart === "undefined") {
  mostrarAviso("Não foi possível carregar a biblioteca de gráficos. Verifique a conexão com a internet e recarregue a página.");
} else if (dados.length === 0) {
  mostrarAviso('Ainda não há alunos cadastrados. <a href="index.html">Cadastre alunos no painel</a> para ver os gráficos.');
} else {
  Chart.defaults.font.family = "'Manrope', sans-serif";
  Chart.defaults.color = "#5b7385";
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.scale.grid.color = "#e7eef3";
  desenharChips();
  renderizar();
}
