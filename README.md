# Gerenciador de Turmas

Sistema web para controle de presença por aluno e por dia, com calendário de observações,
gráficos e relatórios em PDF. Front-end estático (HTML, CSS e JavaScript) + Supabase
(banco PostgreSQL e login).

## Funcionalidades
- Login por e-mail e senha (somente usuários convidados)
- Cadastro de alunos e turmas
- Chamada por dia e turma (presente, falta, justificada)
- Calendário do aluno com observações por dia
- Gráficos de faltas por turma e por aluno
- Relatório em PDF por aluno (simples ou completo), com período à escolha

## Estrutura
| Pasta / arquivo | Função |
|---|---|
| `index.html`, `chamada.html`, `graficos.html`, `calendario.html`, `login.html` | Telas |
| `js/config.js` | URL e chave **publishable** do Supabase |
| `js/dados.js` | Acesso ao banco (tudo passa por aqui) |
| `js/relatorio.js` | Geração dos PDFs |
| `supabase/schema.sql` | Tabelas e regras de segurança básicas |
| `supabase/seguranca.sql` | Lista de equipe e limites de tamanho |
| `_headers` | Cabeçalhos de segurança (Netlify) |

## Instalação
1. Crie um projeto no Supabase (região **South America - São Paulo**).
2. No **SQL Editor**, rode `supabase/schema.sql`.
3. Em **Authentication**, desative o cadastro livre e a opção de login anônimo.
4. Crie os usuários do time em **Authentication > Users** (e-mail e senha, com confirmação automática).
5. Rode `supabase/seguranca.sql` (ele coloca esses usuários na lista da equipe).
6. Em **Project Settings > API Keys**, copie a **Project URL** e a chave **publishable**
   para `js/config.js`. **Nunca** use a chave `secret` / `service_role` no código.
7. Abra com Live Server (testes locais) ou publique em um host estático (Netlify).

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
