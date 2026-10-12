# Pastille

Logiciel de facturation électronique pour indépendants, TPE et PME françaises, prêt pour la réforme 2026-2027.

## Structure

```
apps/web/          Application Next.js 16 (App Router, TypeScript strict, Tailwind v4)
packages/moteur    Calcul des documents : lignes, remises, TVA multi-taux, acomptes, avoirs, arrondis
packages/facturx   Modèle EN 16931, générateurs CII et UBL, contrôles, PDF/A-3 Factur-X, lecture XML
supabase/          Migrations SQL, configuration CLI, tests RLS
outils/            Validation officielle Factur-X (XSD et Schematron EN 16931 / BR-FR)
docs/              Propositions, bilans de phase, maquettes
```

## Démarrer en local

Prérequis : Node 22, pnpm 10.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # puis renseigner les clés Supabase
pnpm dev                                        # http://localhost:3000
```

Sans clés Supabase, l'application démarre quand même : `/connexion` affiche un message de configuration, et `/systeme` (design system) et `/systeme/coque` (aperçu de la coque avec des données fictives) restent consultables.

## Configurer Supabase

1. **Créer le projet dans l'Union européenne** : région *West EU (Paris)* ou *Central EU (Frankfurt)*. C'est une obligation RGPD pour des données fiscales, et la région ne peut plus changer ensuite.
2. **Appliquer les migrations** :
   ```bash
   npx supabase@2.118.0 link --project-ref <ref-du-projet>
   pnpm db:push
   ```
3. **Clés** : *Project Settings > API*. Copier l'URL et la clé *publishable* (ou l'ancienne clé *anon*) dans `apps/web/.env.local`.
4. **URLs d'authentification** (*Authentication > URL Configuration*) :
   - Site URL : `http://localhost:3000` en local, l'URL de production ensuite.
   - Redirect URLs : `<site>/auth/callback` et `<site>/auth/confirm`.
5. **Google** (facultatif) : *Authentication > Providers > Google*, avec un client OAuth Google dont l'URI de redirection est `https://<ref>.supabase.co/auth/v1/callback`.
6. **Emails** : les liens envoyés par défaut passent par `/auth/callback`. Pour des liens qui fonctionnent aussi quand l'email est ouvert dans un autre navigateur, remplacer dans *Authentication > Email Templates* le lien par :
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` (type `recovery` pour le modèle « Reset password », `signup` pour « Confirm signup »).
7. **Types TypeScript** : après chaque migration, `pnpm db:types` génère `types.generated.ts` ; reporter les changements dans `apps/web/src/lib/supabase/types.ts`.

## Déployer sur Vercel

1. *Add New > Project*, importer ce dépôt GitHub, **Root Directory : `apps/web`** (framework Next.js détecté, pnpm via `packageManager`).
2. **Variables d'environnement** (*Settings > Environment Variables*), d'après `apps/web/.env.example` :
   - obligatoires : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` (URL de production) ;
   - tâches quotidiennes (`vercel.json`, 6 h UTC) : `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` ;
   - abonnements : `STRIPE_*` ; emails : `RESEND_API_KEY`, `EMAIL_EXPEDITEUR` ; plateforme agréée : `PA_*` ;
   - pages légales : `EDITEUR_*`.
3. Dans Supabase (*Authentication > URL Configuration*), mettre l'URL Vercel en Site URL et ajouter `<site>/auth/callback` et `<site>/auth/confirm` aux Redirect URLs.
4. **Stripe** : créer trois prix mensuels (Solo 9 €, Pro 19 €, Studio 49 € HT), un webhook vers `<site>/api/stripe` (événements `customer.subscription.created`, `.updated`, `.deleted`, `checkout.session.completed`) et activer le portail client.
5. **Administrateur de la plateforme** (back-office `/admin`) : après s'être inscrit, exécuter dans l'éditeur SQL Supabase
   `insert into public.platform_admins (user_id) select id from auth.users where email = 'vous@exemple.fr';`

## Vérifications

| Commande | Contenu |
|---|---|
| `pnpm lint` | ESLint (règles Next.js et TypeScript) |
| `pnpm typecheck` | TypeScript strict |
| `pnpm test` | Tests unitaires Vitest (identifiants, montants, rôles, navigation…) |
| `pnpm test:db` | Migrations et RLS sur un vrai Postgres (voir ci-dessous) |
| `pnpm build && pnpm test:e2e` | Parcours Playwright bureau et mobile, audit d'accessibilité axe (WCAG 2.1 AA) |

`pnpm test:db` crée une base jetable sur le Postgres pointé par `DATABASE_URL` (par défaut `postgres://postgres:postgres@localhost:54329/postgres`), y applique une imitation minimale de Supabase (`supabase/tests/stub-supabase.sql` : rôles `anon` / `authenticated`, `auth.users`, `auth.uid()`), puis toutes les migrations, et vérifie l'isolation entre organisations. Pour un Postgres local :

```bash
docker run -d --name pastille-pg -e POSTGRES_PASSWORD=postgres -p 54329:5432 postgres:16
pnpm test:db
```

### Parcours connecté sur un Supabase local

`supabase/local/demarrer.sh` monte un Supabase minimal sans Docker : le vrai service d'authentification (`supabase/auth`) et PostgREST, sur un Postgres local, derrière un petit routeur sur le port 54321. Il applique toutes les migrations et affiche les clés `ANON` et `SERVICE`.

```bash
AUTH_BIN=/chemin/auth POSTGREST_BIN=/chemin/postgrest ./supabase/local/demarrer.sh
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<ANON> pnpm dev
E2E_CONNECTE=1 PORT=3000 pnpm --filter @pastille/web exec playwright test e2e/connecte.spec.ts
```

La CI (`.github/workflows/ci.yml`) exécute toutes ces vérifications à chaque pull request, y compris ce parcours connecté.

## Conventions

- **Montants** : toujours en centimes entiers (`bigint` en base, `number` entier en TypeScript). Aucun flottant pour l'argent.
- **Langue** : URL, composants et vocabulaire métier en français ; tables et colonnes Postgres en anglais.
- **Sécurité** : chaque table a RLS activé et des privilèges accordés colonne par colonne. L'interface masque ce qu'un rôle ne peut pas faire, mais c'est la base qui l'interdit. Toute nouvelle table doit avoir `organization_id`, ses politiques et ses tests de non-fuite dans `supabase/tests`.
- **Couleurs** : uniquement via les tokens de `apps/web/src/styles/tokens.css`. La palette Tailwind par défaut est désactivée.
- **Polices** : auto-hébergées (`@fontsource`), aucun appel à Google Fonts.
