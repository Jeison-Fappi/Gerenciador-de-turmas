// CHAMADA POR DIA E TURMA


const $ = (s) => document.querySelector(s);

let dia = dataISO();
let turma = "";

const selTurma = $("#turmaChamada");
selTurma.addEventListener("change", () => { turma = selTurma.value; render(); });

$("#alternarAula").addEventListener("click", async () => {
  if (!turma) return;
  try {
    await salvarExcecaoAula(turma, dia, !aulaDaTurma(turma, dia));
    render();
  } catch (error) {
    falhaSalvar(error);
  }
});

$("#restaurarAgenda").addEventListener("click", async () => {
  if (!turma) return;
  try {
    await restaurarAgendaAula(turma, dia);
    render();
  } catch (error) {
    falhaSalvar(error);
  }
});

$("#dataChamada").addEventListener("change", (e) => {
  if (e.target.value) { dia = e.target.value; render(); }
});

function mover(n) {
  const d = new Date(dia + "T12:00:00");
  d.setDate(d.getDate() + n);
  dia = dataISO(d);
  render();
}

function irHoje() { dia = dataISO(); render(); }

const botao = (st, icone, texto, atual) =>
  `<button class="${st} ${atual === st ? "on" : ""}" data-st="${st}"><i class="bi bi-${icone}"></i> ${texto}</button>`;

function render() {
  const data = new Date(dia + "T12:00:00");
  $("#dataChamada").value = dia;
  $("#diaLabel").innerText = data.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  $("#avisoFds").classList.toggle("d-none", ![0, 6].includes(data.getDay()));

  const lista = alunos.filter((a) => a.turma === turma).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const temAula = aulaDaTurma(turma, dia);
  const excecao = excecaoAula(turma, dia);
  $("#estadoAula").textContent = excecao
    ? excecao.ativa ? "Aula ativada nesta data" : "Aula desativada nesta data"
    : temAula ? "Aula prevista na agenda" : "Sem aula prevista na agenda";
  $("#alternarAula").textContent = temAula ? "Desativar aula neste dia" : "Ativar aula neste dia";
  $("#alternarAula").disabled = !turma;
  $("#restaurarAgenda").classList.toggle("d-none", !excecao);
  const c = { P: 0, F: 0, J: 0, "": 0 };
  if (temAula) lista.forEach((a) => c[statusDoDia(a.id, dia)]++);

  $("#cP").innerText = c.P;
  $("#cF").innerText = c.F;
  $("#cJ").innerText = c.J;
  $("#cS").innerText = c[""];
  $("#cF").parentElement.classList.toggle("has", c.F > 0);
  $("#cJ").parentElement.classList.toggle("has", c.J > 0);
  $("#btnRestante").disabled = !temAula || c[""] === 0;

  if (!temAula) {
    $("#listaChamada").innerHTML = `<div class="vazio">Não há aula programada para esta data. Ative o dia para registrar a presença.</div>`;
    return;
  }
  if (lista.length === 0) {
    $("#listaChamada").innerHTML = `<div class="vazio">Nenhum aluno nesta turma.</div>`;
    return;
  }

  $("#listaChamada").innerHTML = lista.map((a) => {
    const st = statusDoDia(a.id, dia);
    return `
      <div class="linha">
        <div class="who">
          <span class="avatar">${esc(iniciais(a.nome))}</span>
          <div>${esc(a.nome)}<small>${faltasDoAluno(a)} falta(s) no total</small></div>
        </div>
        <div class="seg" data-id="${a.id}">
          ${botao("P", "check-lg", "Presente", st)}
          ${botao("F", "x-lg", "Falta", st)}
          ${botao("J", "file-earmark-check", "Justificada", st)}
        </div>
      </div>`;
  }).join("");
}

$("#listaChamada").addEventListener("click", (e) => {
  const b = e.target.closest(".seg button");
  if (!b) return;
  if (!aulaDaTurma(turma, dia)) return;
  const id = b.parentElement.dataset.id;
  const novo = b.dataset.st;
  marcarStatus(id, dia, statusDoDia(id, dia) === novo ? "" : novo).catch(falhaSalvar);
  render();
});

function marcarRestante() {
  if (!aulaDaTurma(turma, dia)) return;
  const ids = alunos.filter((a) => a.turma === turma && !statusDoDia(a.id, dia)).map((a) => a.id);
  marcarVarios(ids, dia, "P").catch(falhaSalvar);
  render();
}

(async () => {
  if (!(await exigirLogin())) return;
  await carregarDados();
  if (turmas.length) {
    selTurma.replaceChildren();
    turmas.forEach((nome) => {
      const option = document.createElement("option");
      option.value = nome;
      option.textContent = nome;
      selTurma.append(option);
    });
    turma = turmas[0];
    selTurma.value = turma;
  } else {
    selTurma.innerHTML = '<option value="">Nenhuma turma cadastrada</option>';
  }
  render();
})();
