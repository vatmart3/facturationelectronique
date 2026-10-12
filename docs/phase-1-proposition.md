# PASTILLE · Phase 1 — proposition v2 (CRM sobre)

Maquette interactive : `docs/nuancier-pastille.html` (barre latérale par catégories, clients, fiche client, factures, tableau de bord, tokens).

La v2 remplace la direction « objet rond » de la v1 à la demande du client : rendu CRM classe, épuré et professionnel.

## Navigation par catégories

| Catégorie | Vues |
|---|---|
| Pilotage | Tableau de bord |
| Ventes | Factures, Devis, Avoirs, Récurrences |
| Relation client | Clients (segmentés par catégorie fiscale), Relances |
| Catalogue | Articles et prestations |
| Trésorerie | Paiements |
| Facturation électronique | Factures reçues, E-reporting, Réforme 2027 |
| Comptabilité | Exports comptables |
| Compte | Réglages, Aide |

Catégories de clients : Entreprise France, Particulier, Administration, Entreprise UE, Hors UE. La catégorie pilote TVA par défaut, canal (PA, Chorus Pro, e-reporting) et mentions.

## Design system

- Neutres : `--fond #F4F4F1`, `--surface #FFFFFF`, `--trait #E6E5E0`, `--encre #16171B`, `--encre-2 #585A61` (variantes sombres définies).
- Accent unique : `--accent #1F3A5F` (bleu encre). `--marque #FF5A36` réservé au logo.
- Statuts : puce teintée + point + libellé (brouillon, envoyée, en retard, payée, avoir, annulée).
- Typo : Schibsted Grotesk (titres), Onest (texte), IBM Plex Mono (montants, chiffres tabulaires).
- Rayons 6 / 8 / 12 / 16 px, une ombre légère, structure portée par les bordures. Focus : anneau accent 2 px.

## Arborescence

```
pastille/
├── apps/web/
│   ├── src/app/
│   │   ├── (vitrine)/  (auth)/  bienvenue/
│   │   └── (app)/[org]/
│   │       ├── tableau-de-bord/      Pilotage
│   │       ├── ventes/               factures, devis, avoirs, recurrences
│   │       ├── clients/[id]/         Relation client
│   │       ├── relances/
│   │       ├── catalogue/
│   │       ├── tresorerie/paiements/
│   │       ├── e-facturation/        recues, e-reporting, reforme
│   │       ├── comptabilite/exports/
│   │       └── reglages/
│   ├── src/components/  ui/  coque/  modeles-facture/
│   ├── src/lib/  supabase/  org/  format/
│   └── src/styles/  tokens.css  globals.css
├── packages/  moteur/  conformite/  einvoice/  pa/
├── services/atelier/      PDF + Factur-X (conteneur UE)
├── supabase/  migrations/  seed.sql  tests/
└── docs/
```

## Conservé de la v1

Barre Ctrl K, contrôle de conformité, aperçu facture identique au PDF, contrastes AA et focus visible, PDF/Factur-X dans un conteneur UE, routes et métier en français / tables en anglais.
