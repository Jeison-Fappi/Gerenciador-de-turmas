// PÁGINA DE GRÁFICOS

let dados = [];
const COR = { regular: "#008542", atencao: "#f18b21", risco: "#c90969", marca: "#0094d6", apagado: "#c9dbe6" };
const graficos = {};
let turmasSelecionadas = null;
let turmasRelatorioSelecionadas = new Set();

const turmaSelecionada = (nome) => turmasSelecionadas === null || turmasSelecionadas.has(nome);

const situacao = (f) => (f >= FALTAS_RISCO ? "risco" : f >= FALTAS_ALERTA ? "atencao" : "regular");

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
    .map((t) => {
      const ativa = t === "TODAS" ? turmasSelecionadas === null : turmaSelecionada(t);
      const rotulo = t === "TODAS" ? "Todas as turmas" : esc(t);
      return `<button type="button" class="pill ${ativa ? "on" : ""}" data-turma="${esc(t)}" aria-pressed="${ativa}">${rotulo}</button>`;
    })
    .join("");
  box.querySelectorAll(".pill").forEach((b) =>
    b.addEventListener("click", () => {
      const turma = b.dataset.turma;
      if (turma === "TODAS") {
        turmasSelecionadas = null;
      } else {
        if (turmasSelecionadas === null) turmasSelecionadas = new Set(turmas);
        if (turmasSelecionadas.has(turma)) {
          if (turmasSelecionadas.size === 1) return;
          turmasSelecionadas.delete(turma);
        } else {
          turmasSelecionadas.add(turma);
        }
        if (turmasSelecionadas.size === turmas.length) turmasSelecionadas = null;
      }
      desenharChips();
      renderizar();
    }),
  );
}

function renderizar() {
  const lista = dados.filter((a) => turmaSelecionada(a.turma));
  const total = lista.reduce((s, a) => s + a.faltas, 0);

  document.getElementById("kAlunos").innerText = lista.length;
  document.getElementById("kFaltas").innerText = total;
  document.getElementById("kMedia").innerText = (lista.length ? total / lista.length : 0).toFixed(1);
  const risco = lista.filter((a) => a.faltas >= FALTAS_RISCO).length;
  document.getElementById("kRisco").innerText = risco;
  document.getElementById("kRisco").parentElement.classList.toggle("has", risco > 0);

  //Faltas por turma
  const porTurma = {};
  const nomesSelecionados = turmasSelecionadas === null
    ? [...new Set([...turmas, ...dados.map((a) => a.turma)])]
    : turmas.filter((t) => turmasSelecionadas.has(t));
  nomesSelecionados.forEach((t) => (porTurma[t] = 0));
  lista.forEach((a) => (porTurma[a.turma] = (porTurma[a.turma] || 0) + a.faltas));
  const nomes = Object.keys(porTurma);

  desenhar("graficoTurmas", {
    type: "bar",
    data: {
      labels: nomes,
      datasets: [{
        data: nomes.map((n) => porTurma[n]),
        backgroundColor: nomes.map(() => COR.marca),
        borderRadius: 8,
        maxBarThickness: 56,
      }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } },
    },
  });

  //Situação dos alunos
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

  //Faltas por aluno
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

function configurarRelatorioTurma() {
  const lista = document.getElementById("turmaRelatorio");
  const resumo = document.getElementById("resumoTurmasRelatorio");
  const hoje = new Date();
  const inicioAno = `${hoje.getFullYear()}-01-01`;
  const ate = dataISO(hoje);
  document.getElementById("relatorioDe").value = inicioAno;
  document.getElementById("relatorioAte").value = ate;
  lista.replaceChildren();
  const opcaoTodas = document.createElement("label");
  opcaoTodas.className = "opcao-turma-relatorio";
  const checkboxTodas = document.createElement("input");
  checkboxTodas.type = "checkbox";
  checkboxTodas.disabled = cadastroTurmas.length === 0;
  checkboxTodas.addEventListener("change", () => {
    turmasRelatorioSelecionadas = checkboxTodas.checked
      ? new Set(cadastroTurmas.map((registro) => registro.nome))
      : new Set();
    lista.querySelectorAll("input[data-turma]").forEach((checkbox) => {
      checkbox.checked = turmasRelatorioSelecionadas.has(checkbox.dataset.turma);
    });
    atualizarResumo();
  });
  const nomeTodas = document.createElement("span");
  nomeTodas.textContent = "Todas as turmas";
  opcaoTodas.append(checkboxTodas, nomeTodas);
  lista.append(opcaoTodas);
  const separador = document.createElement("div");
  separador.className = "separador-turmas-relatorio";
  lista.append(separador);

  cadastroTurmas.forEach((registro) => {
    const label = document.createElement("label");
    label.className = "opcao-turma-relatorio";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = registro.nome;
    checkbox.dataset.turma = registro.nome;
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) turmasRelatorioSelecionadas.add(registro.nome);
      else turmasRelatorioSelecionadas.delete(registro.nome);
      atualizarResumo();
    });
    const nome = document.createElement("span");
    nome.textContent = registro.arquivada ? `${registro.nome} (arquivada)` : registro.nome;
    label.append(checkbox, nome);
    lista.append(label);
  });
  const botao = document.getElementById("baixarRelatorioTurma");
  botao.disabled = true;
  atualizarResumo();

  function atualizarResumo() {
    const selecionadas = [...turmasRelatorioSelecionadas];
    checkboxTodas.checked = cadastroTurmas.length > 0 && selecionadas.length === cadastroTurmas.length;
    resumo.textContent = selecionadas.length === 0
      ? "Escolher turmas"
      : selecionadas.length === cadastroTurmas.length
        ? `Todas as turmas (${selecionadas.length})`
        : selecionadas.length === 1
          ? selecionadas[0]
          : `${selecionadas.length} turmas selecionadas`;
    botao.disabled = selecionadas.length === 0;
  }

  botao.addEventListener("click", async () => {
    const turmasSelecionadasParaRelatorio = [...turmasRelatorioSelecionadas];
    const de = document.getElementById("relatorioDe").value;
    const ateRelatorio = document.getElementById("relatorioAte").value;
    const formato = document.getElementById("formatoRelatorioTurma").value;
    if (!turmasSelecionadasParaRelatorio.length || !de || !ateRelatorio || de > ateRelatorio) {
      alert("Selecione pelo menos uma turma e informe um período válido.");
      return;
    }
    botao.disabled = true;
    try {
      await exportarRelatorioTurma({ turmas: turmasSelecionadasParaRelatorio, de, ate: ateRelatorio, formato });
    } catch (error) {
      console.error(error);
      alert("Não foi possível gerar o relatório. Recarregue a página e tente novamente.");
    } finally {
      botao.disabled = false;
    }
  });
}

// ---------- Início ----------
(async () => {
if (!(await exigirLogin())) return;
await carregarDados();
dados = alunosAtivos().map((a) => ({ ...a, faltas: faltasDoAluno(a) }));
if (typeof Chart === "undefined") {
  mostrarAviso("Não foi possível carregar a biblioteca de gráficos. Verifique a conexão com a internet e recarregue a página.");
} else if (dados.length === 0) {
  mostrarAviso('Ainda não há alunos cadastrados. <a href="index.html">Cadastre alunos no painel</a> para ver os gráficos.');
} else {
  Chart.defaults.font.family = "Arial, sans-serif";
  Chart.defaults.color = "#5b7385";
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.scale.grid.color = "#e7eef3";
  desenharChips();
  renderizar();
}
configurarRelatorioTurma();
})();
