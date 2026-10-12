-- Numéro de départ des factures (reprise d'une numérotation existante à l'onboarding).
alter table public.organizations
  add column invoice_start_number integer not null default 1 check (invoice_start_number between 1 and 99999999);

grant update (invoice_start_number) on table public.organizations to authenticated;
