import { createClient } from "npm:@supabase/supabase-js@2";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char] || char));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function category(total: number, streak: number) {
  if (total >= 13) return "limite";
  if (total >= 10 && streak >= 10) return "sequencia";
  if (total >= 10) return "apoio";
  if (total >= 7) return "alerta";
  return "acompanhamento";
}

function scheduledClass(date: string, agenda: string[], exceptions: Map<string, boolean>) {
  if (exceptions.has(date)) return exceptions.get(date) === true;
  const weekday = new Date(date + "T12:00:00Z").getUTCDay() || 7;
  return agenda.some((slot) => Number(slot.split(":")[0]) === weekday);
}

function consecutiveAbsences(date: string, statuses: Map<string, string>, agenda: string[], exceptions: Map<string, boolean>) {
  const current = new Date(date + "T12:00:00Z");
  let count = 0;
  let checked = 0;
  while (count < 13 && checked < 3650) {
    const key = current.toISOString().slice(0, 10);
    if (scheduledClass(key, agenda, exceptions)) {
      if (statuses.get(key) !== "F") break;
      count += 1;
    }
    current.setUTCDate(current.getUTCDate() - 1);
    checked += 1;
  }
  return count;
}

function messageFor(kind: string, student: string, className: string, total: number, streak: number, date: string) {
  const first = student.split(/\s+/)[0];
  const subjects: Record<string, string> = {
    acompanhamento: "Acompanhamento de frequência — " + total + " faltas",
    alerta: "Atenção à sua frequência — " + total + " faltas",
    sequencia: "Ação necessária: faltas consecutivas e continuidade da bolsa",
    apoio: "Vamos conversar sobre sua frequência?",
    limite: "Urgente: limite de faltas atingido",
  };
  const paragraphs: Record<string, string[]> = {
    acompanhamento: [
      "Percebemos que você atingiu " + total + " faltas nas aulas da turma " + className + " e gostaríamos de saber se está tudo bem.",
      "A participação nas aulas é importante para acompanhar as atividades e o andamento do projeto. Manter a frequência também é necessário para a continuidade da bolsa e a permanência no programa.",
      "Se estiver enfrentando alguma dificuldade para participar, conte com a gente. Estamos à disposição para conversar e buscar uma solução juntos.",
    ],
    alerta: [
      "Constam " + total + " faltas nas aulas da turma " + className + ". Gostaríamos de saber se está tudo bem.",
      "A participação nas aulas é muito importante para acompanhar as atividades e o andamento do projeto. Também é necessário manter o percentual mínimo de frequência para garantir a continuidade da bolsa e a permanência no programa.",
      "Pedimos que entre em contato conosco para conversarmos sobre sua participação e buscarmos possíveis encaminhamentos.",
    ],
    sequencia: [
      "Identificamos " + streak + " faltas consecutivas em aulas programadas da turma " + className + ". Essa sequência exige atenção imediata.",
      "A frequência é um dos critérios para a continuidade da bolsa e a permanência no programa. Pedimos que entre em contato com a equipe pedagógica com urgência para conversar sobre sua situação e os próximos passos.",
    ],
    apoio: [
      "Constam " + total + " faltas na turma " + className + ". Como elas não foram consecutivas, gostaríamos de entender se há alguma dificuldade afetando sua participação.",
      "A presença nas aulas é importante para acompanhar o projeto e manter a frequência exigida para a continuidade da bolsa. Estamos à disposição para conversar e buscar alternativas de apoio.",
    ],
    limite: [
      "Constam " + total + " faltas registradas na turma " + className + ". Você atingiu o limite de faltas definido para o programa.",
      "Entre em contato com a equipe pedagógica com urgência para conversarmos sobre sua situação e os próximos passos.",
    ],
  };
  const paragraphsHtml = paragraphs[kind].map((paragraph) => "<p>" + escapeHtml(paragraph) + "</p>").join("");
  const html = "<div style=\"font-family:Arial,sans-serif;color:#172938;line-height:1.6;max-width:640px\"><p>Olá, " +
    escapeHtml(first) + ".</p>" + paragraphsHtml + "<p>Atenciosamente,<br><strong>Equipe Pedagógica</strong><br>" +
    "Residência Full Stack 5.0</p><p style=\"color:#526572;font-size:13px\">Registro considerado: " +
    escapeHtml(date.split("-").reverse().join("/")) + ".</p></div>";
  const text = "Olá, " + first + ".\n\n" + paragraphs[kind].join("\n\n") +
    "\n\nAtenciosamente,\nEquipe Pedagógica\nResidência Full Stack 5.0\n\nRegistro considerado: " +
    date.split("-").reverse().join("/") + ".";
  return { subject: subjects[kind], html, text };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido" }, 405);
  const cronSecret = Deno.env.get("QUEUE_CRON_SECRET");
  if (!cronSecret || request.headers.get("x-cron-secret") !== cronSecret) return json({ error: "Não autorizado" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
  const serviceKey = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const sender = Deno.env.get("RESEND_FROM");
  const replyTo = Deno.env.get("EMAIL_REPLY_TO");
  if (!supabaseUrl || !serviceKey || !resendKey || !sender) return json({ error: "Configuração de envio incompleta" }, 500);

  const client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: config, error: configError } = await client.from("email_automacao_config").select("modo").eq("id", 1).single();
  if (configError) return json({ error: "Não foi possível ler a configuração" }, 500);
  if (config.modo === "desativado") return json({ processados: 0, modo: config.modo });

  const { data: queue, error: queueError } = await client.rpc("reivindicar_emails_frequencia", { p_limite: 25 });
  if (queueError) return json({ error: "Não foi possível obter os e-mails pendentes" }, 500);
  const mentors = (Deno.env.get("EMAIL_MENTORES_BCC") || "").split(/[;,]/).map((email) => email.trim()).filter(Boolean);
  const residenceCopy = (Deno.env.get("EMAIL_RESIDENCIA_BCC") || "").trim();
  const bcc = [...new Set([...mentors, residenceCopy].filter(Boolean))];
  let processed = 0;

  for (const item of queue || []) {
    try {
      if (item.modo !== config.modo || !item.aluno_id) {
        await client.rpc("finalizar_email_frequencia", { p_id: item.id, p_status: "cancelado", p_erro: "Aluno ou modo de envio indisponível." });
        continue;
      }

      const [{ data: student }, { data: emailRecord }, { data: attendance }, { data: classRecord }, { data: exceptions }] = await Promise.all([
        client.from("alunos").select("id,nome,turma,faltas_anteriores,arquivado").eq("id", item.aluno_id).maybeSingle(),
        client.from("alunos_emails").select("email,eh_teste").eq("aluno_id", item.aluno_id).maybeSingle(),
        client.from("presencas").select("data,status").eq("aluno_id", item.aluno_id).lte("data", item.data_falta),
        client.from("turmas").select("agenda,arquivada").eq("nome", item.turma).maybeSingle(),
        client.from("excecoes_aula").select("data,ativa").eq("turma", item.turma).lte("data", item.data_falta),
      ]);

      if (!student || student.arquivado || !emailRecord || !classRecord || classRecord.arquivada || student.turma !== item.turma) {
        await client.rpc("finalizar_email_frequencia", { p_id: item.id, p_status: "cancelado", p_erro: "Cadastro indisponível no momento do envio." });
        continue;
      }
      if ((config.modo === "teste" && !emailRecord.eh_teste) || (config.modo === "producao" && emailRecord.eh_teste)) {
        await client.rpc("finalizar_email_frequencia", { p_id: item.id, p_status: "cancelado", p_erro: "Destinatário incompatível com o modo de envio ativo." });
        continue;
      }

      const attendanceMap = new Map((attendance || []).map((entry) => [entry.data, entry.status]));
      const exceptionMap = new Map((exceptions || []).map((entry) => [entry.data, entry.ativa]));
      const agenda = classRecord.agenda || [];
      if (attendanceMap.get(item.data_falta) !== "F" || !scheduledClass(item.data_falta, agenda, exceptionMap)) {
        await client.rpc("finalizar_email_frequencia", { p_id: item.id, p_status: "cancelado", p_erro: "A falta foi justificada, removida ou não contabilizada." });
        continue;
      }

      const total = Number(student.faltas_anteriores || 0) + (attendance || []).filter((entry) =>
        entry.status === "F" && scheduledClass(entry.data, agenda, exceptionMap)
      ).length;
      const streak = consecutiveAbsences(item.data_falta, attendanceMap, agenda, exceptionMap);
      if (total < 5) {
        await client.rpc("finalizar_email_frequencia", { p_id: item.id, p_status: "cancelado", p_erro: "Total abaixo do limite de acompanhamento." });
        continue;
      }

      const kind = category(total, streak);
      await client.from("fila_emails_frequencia").update({
        nome_aluno: student.nome,
        turma: student.turma,
        total_faltas: total,
        faltas_consecutivas: streak,
        categoria: kind,
      }).eq("id", item.id).eq("status", "enviando");

      const content = messageFor(kind, student.nome, student.turma, total, streak, item.data_falta);
      const payload: Record<string, unknown> = {
        from: sender,
        to: [emailRecord.email],
        subject: content.subject,
        html: content.html,
        text: content.text,
      };
      if (bcc.length) payload.bcc = bcc;
      if (replyTo) payload.reply_to = replyTo;

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + resendKey, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        await client.rpc("finalizar_email_frequencia", {
          p_id: item.id, p_status: "falha", p_erro: String(result.message || "Resend retornou " + response.status),
        });
      } else {
        await client.rpc("finalizar_email_frequencia", {
          p_id: item.id, p_status: "enviado", p_resend_id: result.id || null,
        });
      }
      processed += 1;
    } catch (error) {
      await client.rpc("finalizar_email_frequencia", {
        p_id: item.id, p_status: "falha", p_erro: error instanceof Error ? error.message : "Falha ao enviar e-mail.",
      });
    }
  }

  return json({ processados: processed, modo: config.modo });
});
