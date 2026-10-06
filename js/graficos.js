// Página de gráficos: lê os alunos direto do localStorage
const todosAlunos = JSON.parse(localStorage.getItem("alunos") || "[]");
const COR = { regular: "#198754", atencao: "#e0a800", risco: "#d6334a", marca: "#0095d9" };
const graficos = {};

const situacao = (f) => (f >= 5 ? "risco" : f >= 3 ? "atencao" : "regular");

function desenhar(id, config) {
  if (graficos[id]) graficos[id].destroy();
  graficos[id] = new Chart(document.getElementById(id), config);
}

function renderizar() {
  const turma = document.getElementById("filtroTurma").value;
  const lista = todosAlunos.filter((a) => turma === "TODAS" || a.turma === turma);

  // KPIs
  const total = lista.reduce((s, a) => s + a.faltas, 0);
  document.getElementById("kAlunos").innerText = lista.length;
  document.getElementById("kFaltas").innerText = total;
  document.getElementById("kMedia").innerText = (lista.length ? total / lista.length : 0).toFixed(1);
  document.getElementById("kRisco").innerText = lista.filter((a) => a.faltas >= 5).length;

  // 1) Faltas por turma (sempre todas, a turma escolhida fica em destaque)
  const porTurma = {};
  todosAlunos.forEach((a) => (porTurma[a.turma] = (porTurma[a.turma] || 0) + a.faltas));
  const nomes = Object.keys(porTurma);
  desenhar("graficoTurmas", {
    type: "bar",
    data: {
      labels: nomes,
      datasets: [{
        data: nomes.map((n) => porTurma[n]),
        backgroundColor: nomes.map((n) => (turma === "TODAS" || n === turma ? COR.marca : "#c5d6e0")),
        borderRadius: 6,
      }],
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } },
  });

  // 2) Situação
  const c = { regular: 0, atencao: 0, risco: 0 };
  lista.forEach((a) => c[situacao(a.faltas)]++);
  desenhar("graficoSituacao", {
    type: "doughnut",
    data: { labels: ["Regular", "Em atenção", "Em risco"], datasets: [{ data: [c.regular, c.atencao, c.risco], backgroundColor: [COR.regular, COR.atencao, COR.risco], borderWidth: 0 }] },
    options: { cutout: "65%", plugins: { legend: { position: "bottom" } } },
  });

  // 3) Faltas por aluno (todos da seleção)
  const ordenados = [...lista].sort((a, b) => b.faltas - a.faltas);
  document.getElementById("boxAlunos").style.height = Math.max(240, ordenados.length * 38 + 40) + "px";
  desenhar("graficoAlunos", {
    type: "bar",
    data: {
      labels: ordenados.map((a) => `${a.nome} (${a.turma})`),
      datasets: [{ data: ordenados.map((a) => a.faltas), backgroundColor: ordenados.map((a) => COR[situacao(a.faltas)]), borderRadius: 6 }],
    },
    options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { grid: { display: false } } } },
  });
}

Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
Chart.defaults.maintainAspectRatio = false;

const select = document.getElementById("filtroTurma");
turmas.forEach((t) => (select.innerHTML += `<option value="${t}">${t}</option>`));
select.addEventListener("change", renderizar);
renderizar();
