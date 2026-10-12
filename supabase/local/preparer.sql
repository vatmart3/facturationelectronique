-- Base locale « façon Supabase » pour tester l'application de bout en bout
-- avec le vrai service d'authentification (supabase/auth) et PostgREST.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit password 'authenticator'; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin login createrole password 'auth'; end if;
end
$$;
grant anon, authenticated, service_role to authenticator;
create schema if not exists auth authorization supabase_auth_admin;
grant usage on schema auth to anon, authenticated, service_role;
do $$ begin execute format('grant create on database %I to supabase_auth_admin', current_database()); end $$;
alter role supabase_auth_admin set search_path = auth;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
