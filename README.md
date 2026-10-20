# Gerenciador de Turmas

Sistema web para controle de presença por aluno e por dia, com calendário de observações,
gráficos e relatórios em PDF. Front-end estático (HTML, CSS e JavaScript) + Supabase
(banco PostgreSQL e login).

## Funcionalidades
- Login por e-mail e senha (somente usuários convidados)
- Cadastro, edição e arquivamento de turmas com agenda semanal por dia e turno
- Chamada habilitada apenas nos dias previstos, com ativação ou suspensão por data
- Chamada por dia e turma (presente, falta, justificada)
- Calendário do aluno com observações por dia
- Gráficos de faltas por turma e por aluno
- Relatório em PDF por aluno (simples ou completo), com período à escolha
- Relatório completo em PDF por turma, com resumo por aluno, registros de frequência e observações
- Importação de alunos por arquivos CSV ou Excel, vinculados à turma selecionada

## Estrutura
| Pasta / arquivo | Função |
|---|---|
| `index.html`, `chamada.html`, `graficos.html`, `calendario.html`, `login.html` | Telas |
| `js/config.js` | URL e chave **publishable** do Supabase |
| `js/dados.js` | Acesso ao banco (tudo passa por aqui) |
| `js/relatorio.js` | Geração dos PDFs |
| `supabase/schema.sql` | Tabelas e regras de segurança básicas |
| `supabase/seguranca.sql` | Lista de equipe e limites de tamanho |
| `supabase/turmas.sql` | Migração das turmas existentes para o cadastro dinâmico |
| `supabase/agenda_turmas.sql` | Agenda semanal, arquivamento e exceções por data |
| `_headers` | Cabeçalhos de segurança (Netlify) |

## Instalação
1. Crie um projeto no Supabase (região **South America - São Paulo**).
2. No **SQL Editor**, rode `supabase/schema.sql`.
3. Em **Authentication**, desative o cadastro livre e a opção de login anônimo.
4. Crie os usuários do time em **Authentication > Users** (e-mail e senha, com confirmação automática).
5. Rode `supabase/seguranca.sql` (ele coloca esses usuários na lista da equipe).
6. Rode `supabase/turmas.sql` para criar a tabela de turmas e importar as turmas já usadas pelos alunos.
   Em um projeto novo, esse passo também cadastra as turmas iniciais.
7. Para atualizar o projeto de teste que já recebeu os scripts anteriores, rode `supabase/agenda_turmas.sql`.
8. Em **Project Settings > API Keys**, copie a **Project URL** e a chave **publishable**
   para `js/config.js`. **Nunca** use a chave `secret` / `service_role` no código.
9. Abra com Live Server ou publique em um host estático (Netlify).

## Importar alunos
Na tela Painel, selecione **Importar alunos**, escolha a turma e carregue um arquivo `.csv`, `.xlsx` ou `.xls`.
A primeira linha deve conter uma coluna chamada `Nome`; cada linha seguinte representa um aluno. Nomes já cadastrados
e linhas inválidas são ignorados. A importação não altera as chamadas ou observações existentes.

## Relatório da turma
Na tela **Gráficos**, selecione a turma e o período para baixar o PDF. O documento inclui totais da turma,
frequência individual, todos os registros de chamada e observações no intervalo.

## Adicionar ou remover pessoas
Veja os comandos no final de `supabase/seguranca.sql`.
Quem não estiver na tabela `equipe` não enxerga nenhum dado, mesmo com uma conta válida.

## Segurança: o que NÃO fazer
- Não commitar chaves `secret` / `service_role`, senhas ou arquivos exportados (PDF, CSV, backups).
- Não reativar o cadastro livre no Supabase.
- Não registrar nas observações dados sensíveis (saúde, diagnósticos, religião etc.).
- Não deixar a sessão aberta em computador compartilhado: use **Sair**.

## Fluxo de trabalho
- Desenvolvimento na branch `dev`; publicação somente a partir da `main`, via Pull Request.
- No Netlify, a *production branch* deve ser `main`.
- Ative verificação em duas etapas no GitHub, Netlify e Supabase.

## Dados pessoais (LGPD)
O sistema guarda nomes, frequência e observações sobre pessoas. A empresa deve definir quem pode
acessar, por quanto tempo os dados são mantidos e como atender pedidos de exclusão.
