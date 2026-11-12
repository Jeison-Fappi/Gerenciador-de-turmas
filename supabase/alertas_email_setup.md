# Configuração dos alertas de frequência

O recurso começa desativado e não cria envios para faltas antigas. O modo de teste aceita somente alunos marcados como teste na página **E-mails**.

## 1. Instalar o banco

No Supabase do projeto de teste, abra **SQL Editor**, crie uma consulta e execute `alertas_email.sql`. A migração protege `alunos_emails` para que somente pessoas cadastradas em `public.equipe` possam consultar e editar endereços.

## 2. Preparar o remetente no Resend

Crie ou acesse a conta Resend da Residência, adicione o domínio de envio e conclua a verificação DNS pedida pelo Resend. Gere uma API Key para o projeto. Use um endereço desse domínio como remetente, por exemplo `Residência <frequencia@seudominio.org.br>`.

Não coloque a API Key no código do site, no GitHub ou em mensagens. Os e-mails dos mentores podem ser uma lista separada por vírgula. O endereço da Residência também pode receber cópia oculta. Defina o endereço de resposta da Residência em `EMAIL_REPLY_TO`.

## 3. Implantar a função

Instale e autentique o Supabase CLI, abra o terminal na raiz do repositório e associe o projeto de teste:

```powershell
supabase login
supabase link --project-ref SEU_PROJECT_REF_DE_TESTE
supabase functions deploy disparar-alertas-frequencia --no-verify-jwt
```

Cadastre os segredos sem editar arquivos versionados:

```powershell
supabase secrets set RESEND_API_KEY=CHAVE_DO_RESEND
supabase secrets set 'RESEND_FROM=Residência <frequencia@seudominio.org.br>'
supabase secrets set EMAIL_REPLY_TO=contato@seudominio.org.br
supabase secrets set EMAIL_MENTORES_BCC=mentor1@seudominio.org.br,mentor2@seudominio.org.br
supabase secrets set EMAIL_RESIDENCIA_BCC=contato@seudominio.org.br
supabase secrets set QUEUE_CRON_SECRET=GERE_UM_SEGREDO_LONGO_E_ALEATORIO
```

O mesmo valor aleatório de `QUEUE_CRON_SECRET` será guardado no Vault do Supabase na próxima etapa. Não reutilize uma senha pessoal.

## 4. Agendar o processamento

No Supabase, abra **Integrations / Vault** e crie dois segredos:

- `project_url`: URL do projeto Supabase de teste, como `https://seu-ref.supabase.co`.
- `email_queue_token`: o mesmo valor definido para `QUEUE_CRON_SECRET`.

Depois execute `alertas_email_cron.sql` no SQL Editor. O agendador chama a Edge Function a cada minuto; ela só envia mensagens cuja hora de envio já chegou. Os destinatários são enviados em cópia oculta.

## 5. Testar sem alcançar alunos reais

1. Na página **E-mails**, registre seu próprio endereço em um aluno sintético e marque **Aluno de teste**. Não marque alunos reais.
2. Para facilitar o teste da regra de 5 faltas, deixe esse cadastro com quatro faltas anteriores e registre uma falta em uma aula contabilizada. O registro novo deve ser feito depois de ativar o modo de teste.
3. Quando estiver pronto para iniciar o teste, execute no SQL Editor:

   ```sql
   update public.email_automacao_config
   set modo = 'teste', data_inicio = (now() at time zone 'America/Sao_Paulo')::date, atualizado_em = now()
   where id = 1;
   ```

4. Acesse **E-mails** e confira se a mensagem entrou na fila com envio previsto para o dia seguinte às 19h, horário de Brasília. Cancele pela própria tela se precisar interromper.
5. Para parar o teste, execute:

   ```sql
   update public.email_automacao_config
   set modo = 'desativado', atualizado_em = now()
   where id = 1;
   ```

Ao desativar ou trocar de modo, os itens ainda pendentes são cancelados. Itens enviados não podem ser desfeitos. Não habilite produção até revisar os templates, destinatários, domínio verificado e resultado do teste.

## Regras aplicadas

- O primeiro aviso acontece ao atingir 5 faltas contabilizadas; um novo aviso é criado a cada nova falta a partir daí.
- 5–6 faltas: acompanhamento; 7–9: alerta; 10 ou mais consecutivas: aviso sério; 10 ou mais não consecutivas: convite para conversar; 13 ou mais: aviso urgente.
- Sexta-feira só conta quando a aula foi explicitamente habilitada na chamada. O e-mail dessa falta fica previsto para sábado às 19h.
- Justificar ou remover a falta cancela o item se ainda estiver pendente.
- O banco não faz varredura nem enfileiramento retroativo.
