// ==========================================================
// RELATÓRIO EM PDF DO ALUNO (jsPDF + jsPDF-AutoTable)
// Depende de dados.js: presencas, obsDoAluno, faltasDoAluno
// ==========================================================

const REL = {
  navy: [6, 40, 61], blue: [0, 149, 218], ok: [47, 167, 122], risk: [180, 35, 56],
  warn: [224, 168, 0], warnTxt: [154, 103, 0], sky: [232, 244, 251], muted: [91, 115, 133], line: [220, 231, 238],
};
const REL_STATUS = { P: "Presente", F: "Falta", J: "Justificada" };
const REL_DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const REL_MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const relPad = (n) => String(n).padStart(2, "0");
const relBR = (iso) => iso.split("-").reverse().join("/");
const relData = (iso) => new Date(iso + "T12:00:00");

// ---------- Dados do período ----------
function relColetar(aluno, de, ate) {
  const dias = [];
  for (const dia in presencas) {
    if (dia < de || dia > ate) continue;
    const st = presencas[dia][aluno.id];
    if (st) dias.push({ data: dia, status: st });
  }
  dias.sort((a, b) => a.data.localeCompare(b.data));

  const obs = obsDoAluno(aluno.id);
  const obsLista = Object.keys(obs)
    .filter((d) => d >= de && d <= ate)
    .sort()
    .map((d) => ({ data: d, texto: obs[d], status: statusDoDia(aluno.id, d) }));

  const cont = { P: 0, F: 0, J: 0 };
  dias.forEach((d) => cont[d.status]++);
  return { dias, obsLista, cont };
}

// Agrupa por semana (períodos curtos) ou por mês (períodos longos)
function relAgrupar(dias, de, ate) {
  const ini = relData(de);
  const fim = relData(ate);
  const span = Math.round((fim - ini) / 86400000);
  const baldes = [];

  if (span > 62) {
    const c = new Date(ini.getFullYear(), ini.getMonth(), 1, 12);
    while (c <= fim) {
      baldes.push({ chave: `${c.getFullYear()}-${relPad(c.getMonth() + 1)}`, rotulo: `${REL_MESES[c.getMonth()]}/${String(c.getFullYear()).slice(2)}`, F: 0, J: 0 });
      c.setMonth(c.getMonth() + 1);
    }
    dias.forEach((d) => {
      const b = baldes.find((x) => x.chave === d.data.slice(0, 7));
      if (b && d.status !== "P") b[d.status]++;
    });
    return { baldes, unidade: "mês" };
  }

  for (let i = 0; i * 7 <= span; i++) {
    const s = new Date(ini);
    s.setDate(ini.getDate() + i * 7);
    baldes.push({ rotulo: `${relPad(s.getDate())}/${relPad(s.getMonth() + 1)}`, F: 0, J: 0 });
  }
  dias.forEach((d) => {
    const i = Math.floor(Math.round((relData(d.data) - ini) / 86400000) / 7);
    if (baldes[i] && d.status !== "P") baldes[i][d.status]++;
  });
  return { baldes, unidade: "semana" };
}

// ---------- Blocos de desenho ----------
function relNovaPagina(doc, y, precisa) {
  if (y + precisa > doc.internal.pageSize.getHeight() - 20) {
    doc.addPage();
    return 20;
  }
  return y;
}

function relCabecalho(doc, completo, logo) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...REL.navy);
  doc.rect(0, 0, W, 32, "F");
  let x = 16;
  if (logo) { doc.addImage(logo, "PNG", 16, 8, 16, 16); x = 36; }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(completo ? "Relatório completo de frequência" : "Relatório de frequência", x, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(185, 211, 227);
  doc.text("Gerenciador de Turmas", x, 22.5);
}

function relTitulo(doc, texto, y) {
  doc.setFillColor(...REL.blue);
  doc.rect(16, y - 4.6, 1.6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...REL.navy);
  doc.text(texto, 20, y);
  return y + 7;
}

function relResumo(doc, y, c, pct) {
  const W = doc.internal.pageSize.getWidth();
  const gap = 4, bw = (W - 32 - gap * 3) / 4, bh = 23;
  const itens = [["Presenças", c.P, REL.ok], ["Faltas", c.F, REL.risk], ["Justificadas", c.J, REL.warnTxt], ["Presença", pct, REL.blue]];
  itens.forEach(([rot, val, cor], i) => {
    const x = 16 + i * (bw + gap);
    doc.setFillColor(...REL.sky);
    doc.roundedRect(x, y, bw, bh, 2.5, 2.5, "F");
    doc.setFillColor(...cor);
    doc.rect(x, y + 4, 1.4, bh - 8, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...REL.muted);
    doc.text(rot, x + 5, y + 8);
    doc.setFont("helvetica", "bold"); doc.setFontSize(19); doc.setTextColor(...cor);
    doc.text(String(val), x + 5, y + 18);
  });
  return y + bh + 6;
}

function relDistribuicao(doc, y, c) {
  const W = doc.internal.pageSize.getWidth();
  const total = c.P + c.F + c.J;
  const w = W - 32;
  let x = 16;
  [["P", REL.ok], ["F", REL.risk], ["J", REL.warn]].forEach(([k, cor]) => {
    const seg = (w * c[k]) / total;
    if (seg > 0) { doc.setFillColor(...cor); doc.rect(x, y, seg, 5, "F"); x += seg; }
  });
  y += 10.5;
  x = 16;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  [["P", REL.ok], ["F", REL.risk], ["J", REL.warn]].forEach(([k, cor]) => {
    const txt = `${REL_STATUS[k]}: ${c[k]} (${Math.round((c[k] / total) * 100)}%)`;
    doc.setFillColor(...cor);
    doc.roundedRect(x, y - 2.6, 3, 3, 0.6, 0.6, "F");
    doc.setTextColor(...REL.muted);
    doc.text(txt, x + 5, y);
    x += 5 + doc.getTextWidth(txt) + 9;
  });
  return y + 9;
}

function relGrafico(doc, y, baldes) {
  const W = doc.internal.pageSize.getWidth();
  const h = 52;
  const maxV = Math.max(1, ...baldes.map((b) => Math.max(b.F, b.J)));
  const passo = maxV <= 5 ? 1 : Math.ceil(maxV / 5);
  const topo = Math.ceil(maxV / passo) * passo;
  const px = 16 + 9, pw = W - 32 - 9, py = y + 6, ph = h - 16;

  // legenda
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  [["Falta", REL.risk], ["Justificada", REL.warn]].reduce((x, [t, cor]) => {
    doc.setFillColor(...cor); doc.roundedRect(x, y - 0.5, 3, 3, 0.6, 0.6, "F");
    doc.setTextColor(...REL.muted); doc.text(t, x + 4.5, y + 2);
    return x + 4.5 + doc.getTextWidth(t) + 8;
  }, W - 16 - 38);

  // grade e eixo Y
  doc.setLineWidth(0.2);
  for (let v = 0; v <= topo; v += passo) {
    const gy = py + ph - (v / topo) * ph;
    doc.setDrawColor(...REL.line);
    doc.line(px, gy, px + pw, gy);
    doc.setFontSize(7.5); doc.setTextColor(...REL.muted);
    doc.text(String(v), px - 2, gy + 1, { align: "right" });
  }

  // barras
  const n = baldes.length;
  const slot = pw / n;
  const bw = Math.min(9, slot * 0.34);
  const pular = n > 14 ? 2 : 1;
  baldes.forEach((b, i) => {
    const cx = px + slot * (i + 0.5);
    [["F", cx - bw - 0.4, REL.risk], ["J", cx + 0.4, REL.warn]].forEach(([k, bx, cor]) => {
      const bh = (b[k] / topo) * ph;
      if (b[k] > 0) {
        doc.setFillColor(...cor);
        doc.rect(bx, py + ph - bh, bw, bh, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...REL.navy);
        doc.text(String(b[k]), bx + bw / 2, py + ph - bh - 1.2, { align: "center" });
      }
    });
    if (i % pular === 0) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...REL.muted);
      doc.text(b.rotulo, cx, py + ph + 5, { align: "center" });
    }
  });
  return y + h + 4;
}

function relTabela(doc, y, cabecalho, linhas, opcoes = {}) {
  doc.autoTable({
    startY: y,
    head: [cabecalho],
    body: linhas,
    theme: "grid",
    margin: { top: 20, left: 16, right: 16, bottom: 20 },
    styles: { font: "helvetica", fontSize: 9.5, cellPadding: 2.6, lineColor: REL.line, lineWidth: 0.2, textColor: REL.navy, overflow: "linebreak", valign: "top" },
    headStyles: { fillColor: REL.navy, textColor: 255, fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: [246, 250, 252] },
    columnStyles: opcoes.colunas || {},
    didParseCell: (d) => {
      if (d.section === "body" && d.column.index === opcoes.colStatus) {
        const cor = { Falta: REL.risk, Justificada: REL.warnTxt, Presente: REL.ok }[d.cell.raw];
        if (cor) { d.cell.styles.textColor = cor; d.cell.styles.fontStyle = "bold"; }
      }
    },
  });
  return doc.lastAutoTable.finalY + 8;
}

function relVazio(doc, y, texto) {
  doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(...REL.muted);
  doc.text(texto, 16, y);
  return y + 9;
}

function relRodape(doc, emitidoPor) {
  const n = doc.internal.getNumberOfPages();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const a = new Date();
  const emissao = `${relPad(a.getDate())}/${relPad(a.getMonth() + 1)}/${a.getFullYear()} ${relPad(a.getHours())}:${relPad(a.getMinutes())}`;
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(...REL.line); doc.setLineWidth(0.2);
    doc.line(16, H - 13, W - 16, H - 13);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...REL.muted);
    doc.text(`Emitido em ${emissao}${emitidoPor ? " por " + emitidoPor : ""}`, 16, H - 8);
    doc.text(`Página ${i} de ${n}`, W - 16, H - 8, { align: "right" });
  }
}

// ---------- Montagem do relatório ----------
function montarRelatorio({ aluno, de, ate, completo, logo, emitidoPor }) {
  const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const { dias, obsLista, cont } = relColetar(aluno, de, ate);
  const total = cont.P + cont.F + cont.J;
  const pct = total ? Math.round((cont.P / total) * 100) + "%" : "-";

  relCabecalho(doc, completo, logo);

  // Identificação do aluno
  let y = 46;
  doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.setTextColor(...REL.navy);
  doc.text(aluno.nome, 16, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...REL.muted);
  doc.text("Período analisado", W - 16, y - 5.5, { align: "right" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...REL.navy);
  doc.text(`${relBR(de)} a ${relBR(ate)}`, W - 16, y, { align: "right" });

  y += 5.5;
  doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  const tw = doc.getTextWidth(aluno.turma);
  doc.setFillColor(...REL.sky);
  doc.roundedRect(16, y - 4, tw + 7, 6.5, 2, 2, "F");
  doc.setTextColor(0, 115, 168);
  doc.text(aluno.turma, 19.5, y + 0.4);
  y += 13;

  // Resumo
  y = relTitulo(doc, "Resumo do período", y);
  y = relResumo(doc, y, cont, pct);

  const totalGeral = faltasDoAluno(aluno);
  if ((aluno.faltasAnteriores || 0) > 0) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...REL.muted);
    const nota = doc.splitTextToSize(
      `Total geral de faltas do aluno: ${totalGeral}, incluindo ${aluno.faltasAnteriores} falta(s) registrada(s) sem data, anteriores à chamada por dia. Esses registros não entram nos números acima.`,
      W - 32);
    doc.text(nota, 16, y);
    y += nota.length * 4 + 4;
  }

  if (total === 0) {
    y = relVazio(doc, y + 2, "Nenhum registro de chamada neste período.");
  } else {
    y = relNovaPagina(doc, y, 22);
    y = relDistribuicao(doc, y, cont);

    const { baldes, unidade } = relAgrupar(dias, de, ate);
    y = relNovaPagina(doc, y, 70);
    y = relTitulo(doc, `Faltas por ${unidade}`, y);
    y = relGrafico(doc, y, baldes);
  }

  // Datas com falta
  const faltas = dias.filter((d) => d.status !== "P");
  y = relNovaPagina(doc, y, 30);
  y = relTitulo(doc, "Datas com falta", y);
  if (faltas.length === 0) {
    y = relVazio(doc, y, "Nenhuma falta registrada no período.");
  } else {
    y = relTabela(doc, y, ["Data", "Dia da semana", "Situação"],
      faltas.map((d) => [relBR(d.data), REL_DIAS[relData(d.data).getDay()], REL_STATUS[d.status]]),
      { colStatus: 2, colunas: { 0: { cellWidth: 30 }, 1: { cellWidth: 60 } } });
  }

  // Observações (só no completo)
  if (completo) {
    y = relNovaPagina(doc, y, 30);
    y = relTitulo(doc, "Observações do período", y);
    if (obsLista.length === 0) {
      relVazio(doc, y, "Nenhuma observação registrada no período.");
    } else {
      relTabela(doc, y, ["Data", "Situação", "Observação"],
        obsLista.map((o) => [relBR(o.data), REL_STATUS[o.status] || "Sem registro", o.texto]),
        { colStatus: 1, colunas: { 0: { cellWidth: 26 }, 1: { cellWidth: 30 } } });
    }
  }

  relRodape(doc, emitidoPor);
  return doc;
}

// ---------- Download ----------
let relLogoCache;
async function relatorioLogo() {
  if (relLogoCache !== undefined) return relLogoCache;
  try {
    const blob = await (await fetch("img/logo.png")).blob();
    relLogoCache = await new Promise((ok, erro) => {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.onerror = erro;
      r.readAsDataURL(blob);
    });
  } catch (e) {
    relLogoCache = null; // sem logo, o relatório sai igual
  }
  return relLogoCache;
}

function relNomeArquivo(aluno, de, ate, completo) {
  const slug = aluno.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `relatorio-${completo ? "completo" : "simples"}-${slug}-${de}-a-${ate}.pdf`;
}

async function baixarRelatorio({ aluno, de, ate, completo }) {
  const logo = await relatorioLogo();
  const doc = montarRelatorio({ aluno, de, ate, completo, logo, emitidoPor: typeof usuarioEmail !== "undefined" ? usuarioEmail : "" });
  doc.save(relNomeArquivo(aluno, de, ate, completo));
}
