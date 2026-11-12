-- Execute depois de criar o segredo email_queue_token no Supabase Vault.
-- Substitua a URL pelo endereço do projeto que receberá a Edge Function.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('disparar-alertas-frequencia')
where exists (select 1 from cron.job where jobname = 'disparar-alertas-frequencia');

select cron.schedule(
  'disparar-alertas-frequencia',
  '* * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
        || '/functions/v1/disparar-alertas-frequencia',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'email_queue_token')
      ),
      body := '{}'::jsonb
    );
  $$
);
