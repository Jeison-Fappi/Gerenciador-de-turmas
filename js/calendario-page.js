// ==========================================================
// CALENDÁRIO DO ALUNO: status do dia + observações
// ==========================================================

const $ = (s) => document.querySelector(s);
const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const TAGS = { P: "Presente", F: "Falta", J: "Justif." };

const alunoId = new URLSearchParams(location.search).get("id");
let aluno = null;
let ref = new Date();
ref.setDate(1);

function renderizar() {
  const ano = ref.getFullYear();
  const mes = ref.getMonth();
  const obs = obsDoAluno(alunoId);
  const hoje = dataISO();
  const primeiro = new Date(ano, mes, 1).getDay();
  const total = new Date(ano, mes + 1, 0).getDate();

  $("#mesAno").innerText = `${meses[mes]} de ${ano}`;

  let html = "<div></div>".repeat(primeiro);
  for (let d = 1; d <= total; d++) {
    const ds = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const st = statusDoDia(alunoId, ds);
    const fds = [0, 6].includes((primeiro + d - 1) % 7) ? "fds" : "";
    const aula = aulaDaTurma(aluno.turma, ds);
    html += `<button class="cal-dia ${st} ${fds} ${ds === hoje ? "hoje" : ""} ${aula ? "" : "sem-aula"}" ${aula ? "" : "disabled title=\"Sem aula prevista. Ajuste a data na tela de Chamada.\""} onclick="abrirDia('${ds}')">
      <span>${d}</span><span class="tag">${TAGS[st] || ""}</span>
      ${obs[ds] ? '<i class="bi bi-chat-left-text-fill obs"></i>' : ""}
    </button>`;
  }
  $("#calGrid").innerHTML = html;

  const f = faltasDoAluno(aluno);
  $("#kFaltas").innerText = f;
  $("#kJust").innerText = justificadasDoAluno(aluno);
  $("#kObs").innerText = Object.keys(obs).length;
  $("#kFaltas").parentElement.classList.toggle("has", f > 0);
}

function mudarMes(n) {
  ref.setMonth(ref.getMonth() + n);
  renderizar();
}

function abrirDia(ds) {
  if (!aulaDaTurma(aluno.turma, ds)) return;
  const [y, m, d] = ds.split("-").map(Number);
  let st = statusDoDia(alunoId, ds);
  const obsAtual = obsDoAluno(alunoId)[ds] || "";
  const b = (s, ic, t) => `<button type="button" class="${s} ${st === s ? "on" : ""}" data-st="${s}"><i class="bi bi-${ic}"></i> ${t}</button>`;

  Swal.fire({
    title: `${String(d).padStart(2, "0")} de ${meses[m - 1]} de ${y}`,
    html: `
      <div class="seg mb-3" id="segDia">${b("P", "check-lg", "Presente")}${b("F", "x-lg", "Falta")}${b("J", "file-earmark-check", "Justificada")}</div>
      <textarea id="obsDia" class="form-control" rows="4" maxlength="2000" placeholder="Observação sobre o aluno neste dia...">${esc(obsAtual)}</textarea>`,
    showCancelButton: true,
    confirmButtonText: "Salvar",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#0094d6",
    didOpen: () => {
      $("#segDia").addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        st = st === btn.dataset.st ? "" : btn.dataset.st;
        $("#segDia").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x.dataset.st === st));
      });
    },
    preConfirm: () => document.getElementById("obsDia").value,
  }).then(async (r) => {
    if (!r.isConfirmed) return;
    try {
      await marcarStatus(alunoId, ds, st);
      await salvarObs(alunoId, ds, r.value || "");
    } catch (e) {
      falhaSalvar(e);
    }
    renderizar();
  });
}

// ---------- Relatório em PDF ----------
function periodoDoMes(ano, mes) {
  return [dataISO(new Date(ano, mes, 1)), dataISO(new Date(ano, mes + 1, 0))];
}

function periodoTodo() {
  const datas = [];
  for (const dia in presencas) if (presencas[dia][alunoId]) datas.push(dia);
  Object.keys(obsDoAluno(alunoId)).forEach((d) => datas.push(d));
  datas.sort();
  return [datas[0] || dataISO(), dataISO()];
}

function abrirRelatorio() {
  let tipo = "simples";
  const [deIni, ateIni] = periodoDoMes(ref.getFullYear(), ref.getMonth());
  const DESC = {
    simples: "Resumo, gráfico de faltas e as datas com falta.",
    completo: "Tudo do relatório simples, mais as observações escritas em cada dia.",
  };

  Swal.fire({
    title: "Baixar relatório",
    width: 470,
    html: `
      <div class="text-start">
        <label class="form-label">Tipo de relatório</label>
        <div class="seg neutral w-100 mb-2" id="segTipo">
          <button type="button" class="on flex-fill justify-content-center" data-t="simples"><i class="bi bi-file-earmark-bar-graph"></i> Simples</button>
          <button type="button" class="flex-fill justify-content-center" data-t="completo"><i class="bi bi-file-earmark-text"></i> Completo</button>
        </div>
        <p id="descTipo" class="text-muted mb-3" style="font-size:13px">${DESC.simples}</p>

        <label class="form-label">Período</label>
        <div class="d-flex gap-2 mb-2">
          <input type="date" id="relDe" class="form-control" value="${deIni}" />
          <input type="date" id="relAte" class="form-control" value="${ateIni}" />
        </div>
        <div class="rel-presets">
          <button type="button" class="pill" data-p="exibido">Mês exibido</button>
          <button type="button" class="pill" data-p="atual">Este mês</button>
          <button type="button" class="pill" data-p="30">Últimos 30 dias</button>
          <button type="button" class="pill" data-p="tudo">Todo o período</button>
        </div>
      </div>`,
    showCancelButton: true,
    confirmButtonText: "Baixar PDF",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#0094d6",
    didOpen: () => {
      $("#segTipo").addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        tipo = b.dataset.t;
        $("#segTipo").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
        $("#descTipo").innerText = DESC[tipo];
      });
      document.querySelector(".rel-presets").addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        const hoje = new Date();
        let p;
        if (b.dataset.p === "exibido") p = periodoDoMes(ref.getFullYear(), ref.getMonth());
        else if (b.dataset.p === "atual") p = periodoDoMes(hoje.getFullYear(), hoje.getMonth());
        else if (b.dataset.p === "30") { const i = new Date(); i.setDate(i.getDate() - 29); p = [dataISO(i), dataISO()]; }
        else p = periodoTodo();
        $("#relDe").value = p[0];
        $("#relAte").value = p[1];
      });
    },
    preConfirm: () => {
      const de = $("#relDe").value;
      const ate = $("#relAte").value;
      if (!de || !ate) return Swal.showValidationMessage("Escolha a data inicial e a final.");
      if (de > ate) return Swal.showValidationMessage("A data inicial precisa ser anterior à final.");
      return { de, ate, completo: tipo === "completo" };
    },
  }).then(async (r) => {
    if (!r.isConfirmed) return;
    try {
      await baixarRelatorio({ aluno, ...r.value });
    } catch (e) {
      console.error(e);
      Swal.fire({ icon: "error", title: "Não foi possível gerar o PDF", text: "Verifique a conexão e tente de novo." });
    }
  });
}

(async () => {
  if (!(await exigirLogin())) return;
  await carregarDados();
  aluno = alunos.find((a) => a.id === alunoId);

  if (!aluno) {
    $("#nomeAluno").innerText = "Aluno não encontrado";
    $("#calGrid").innerHTML = '<p class="text-muted">Volte ao painel e abra o calendário de um aluno.</p>';
    return;
  }
  $("#avatarAluno").innerText = iniciais(aluno.nome);
  $("#nomeAluno").innerText = aluno.nome;
  $("#turmaAluno").innerText = aluno.turma;
  renderizar();
})();
