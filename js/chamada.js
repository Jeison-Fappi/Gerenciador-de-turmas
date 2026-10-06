// ==========================================================
// CHAMADA POR DIA E TURMA
// ==========================================================

const $ = (s) => document.querySelector(s);

let dia = dataISO();
let turma = turmas[0];

const selTurma = $("#turmaChamada");
turmas.forEach((t) => (selTurma.innerHTML += `<option value="${esc(t)}">${esc(t)}</option>`));
selTurma.addEventListener("change", () => { turma = selTurma.value; render(); });

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
  const c = { P: 0, F: 0, J: 0, "": 0 };
  lista.forEach((a) => c[statusDoDia(a.id, dia)]++);

  $("#cP").innerText = c.P;
  $("#cF").innerText = c.F;
  $("#cJ").innerText = c.J;
  $("#cS").innerText = c[""];
  $("#cF").parentElement.classList.toggle("has", c.F > 0);
  $("#cJ").parentElement.classList.toggle("has", c.J > 0);
  $("#btnRestante").disabled = c[""] === 0;

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
  const id = b.parentElement.dataset.id;
  const novo = b.dataset.st;
  marcarStatus(id, dia, statusDoDia(id, dia) === novo ? "" : novo).catch(falhaSalvar);
  render();
});

function marcarRestante() {
  const ids = alunos.filter((a) => a.turma === turma && !statusDoDia(a.id, dia)).map((a) => a.id);
  marcarVarios(ids, dia, "P").catch(falhaSalvar);
  render();
}

(async () => {
  if (!(await exigirLogin())) return;
  await carregarDados();
  render();
})();
