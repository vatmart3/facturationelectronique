# Phase 1 · Fondations — bilan

## Ce qui fonctionne

**Projet**
- Monorepo pnpm, Next.js 16.3 (App Router), React 19.3, TypeScript strict (`noUncheckedIndexedAccess`), Tailwind v4.
- Versions toutes épinglées, publiées depuis au moins deux semaines.
- En-têtes de sécurité (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`).
- Polices auto-hébergées (Schibsted Grotesk, Onest, IBM Plex Mono) : aucune requête vers Google.

**Design system** (`apps/web/src/components/ui`, référence vivante sur `/systeme`)
- Tokens clair et sombre dans `styles/tokens.css`. La palette, les rayons et les ombres par défaut de Tailwind sont effacés au profit de ces tokens.
- Composants : `Bouton`, `BoutonLien`, `Champ`, `Selection`, `Case`, `Statut`, `Categorie`, `Etiquette`, `Avatar`, `Panneau`, `ListeCles`, `EnTeteVue`, `Segments`, `Tableau`, `Indicateurs`, `EtatVide`, `Message`, `Kbd`, `Icone` (jeu d'icônes dessiné pour Pastille).

**Coque CRM** (`components/coque`)
- Barre latérale par catégories : Pilotage, Ventes, Relation client, Catalogue, Trésorerie, Facturation électronique, Comptabilité, puis Réglages et Aide.
- Fil d'Ariane, sélecteur d'entreprise, palette Ctrl/⌘ K (navigation et changement d'entreprise, recherche sans accents), menu mobile, lien d'évitement « Aller au contenu ».
- Navigation définie à un seul endroit : `lib/navigation.ts`.

**Authentification** (Supabase SSR)
- Email + mot de passe, lien magique, Google, mot de passe oublié et réinitialisation, déconnexion.
- Routes `/auth/callback` (PKCE) et `/auth/confirm` (token_hash).
- `proxy.ts` (ex-middleware) rafraîchit la session et protège toutes les pages privées.
- Le paramètre `suite` n'accepte que des chemins internes : pas de redirection ouverte.

**Organisations**
- Création via `create_organization()`, qui rend le créateur propriétaire et génère un slug unique. Les segments d'URL de l'app sont réservés.
- Réglages de l'entreprise : identité légale, adresse, régime de TVA, option sur les débits, IBAN/BIC. Contrôles :
  - clés SIREN, SIRET (dont l'exception La Poste), TVA intracommunautaire, IBAN (ISO 13616) et BIC ;
  - cohérence SIREN / SIRET / TVA ;
  - capital converti en centimes sans flottant.
- Membres : liste, changement de rôle, retrait avec confirmation, départ volontaire.
- Tableau de bord de mise en route (checklist, compte à rebours avant l'émission obligatoire).
- Les autres catégories affichent la phase où elles seront construites.

**Base de données** (`supabase/migrations/20261012120000_fondations.sql`)
- Tables `profiles`, `organizations`, `memberships`, enums `member_role` et `vat_regime`.
- RLS sur toutes les tables, privilèges colonne par colonne, rien pour `anon`.
- Fonctions d'autorisation `private.*` en `security definer`, ce qui évite la récursion RLS.
- Un trigger garantit qu'une organisation garde toujours au moins un propriétaire.
- Les organisations ne peuvent pas être supprimées, pour respecter la conservation fiscale.

## Tests

| Suite | Résultat |
|---|---|
| Vitest (`pnpm test`) | 47 tests : identifiants, montants, formats, avatars, slugs, rôles, navigation, palette, auth, réforme |
| RLS (`pnpm test:db`) | 24 tests sur Postgres 16 : isolation entre organisations, anon, profils, rôles, dernier propriétaire, colonnes protégées, slugs réservés |
| Playwright (`pnpm test:e2e`) | 14 tests, bureau + mobile : pages publiques, redirections, palette Ctrl K, absence de défilement horizontal, audit axe WCAG 2.1 AA en clair et en sombre |

Pour vérifier que les tests RLS détectent réellement une fuite, j'ai remplacé une politique par `using (true)` : trois tests échouent.

## Ce qui reste (phases suivantes ou décisions)

- **Invitations par email** : le bouton est présent mais désactivé. Elles demandent l'envoi d'emails (Resend) et un flux d'acceptation, prévus avec les offres équipe (phase 10). D'ici là, un membre s'ajoute par SQL.
- **Parcours connecté testé de bout en bout** : il faut un projet Supabase. Les tests e2e couvrent aujourd'hui les pages publiques et la coque de démonstration, la RLS est couverte par les tests SQL.
- **Types Supabase** : écrits à la main pour l'instant ; `pnpm db:types` les régénérera une fois le projet relié.
- **Bascule clair / sombre manuelle** : le thème suit le système ; les tokens `data-theme` sont prêts pour un réglage utilisateur (phase 11).
- **Tampon « ÉMISE / PAYÉE »** : sa forme reste à trancher (supprimé ou discret sur l'aperçu facture), décision attendue avant la phase 5.

## Comment tester

1. `pnpm install`, puis `pnpm dev`.
2. Sans configuration : ouvrir `/systeme` et `/systeme/coque`, appuyer sur Ctrl K.
3. Avec un projet Supabase (voir README) :
   1. créer un compte sur `/inscription` ;
   2. créer une entreprise sur `/bienvenue` ;
   3. compléter `/<entreprise>/reglages` en essayant un SIREN faux ;
   4. ouvrir une deuxième entreprise depuis le sélecteur et vérifier qu'aucune donnée de la première n'y apparaît.
