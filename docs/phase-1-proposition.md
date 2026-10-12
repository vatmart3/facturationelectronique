# PASTILLE · Phase 1 — proposition à valider

Planche visuelle et interactive : `docs/nuancier-pastille.html` (tokens, typographie, matière, composants).

## Arborescence

```
pastille/
├── apps/web/                      Next.js App Router · TypeScript strict
│   ├── src/app/
│   │   ├── (vitrine)/             landing, tarifs, réforme 2027, SEO, légal        · ph. 10
│   │   ├── (auth)/                connexion, inscription, lien magique, Google     · ph. 1
│   │   ├── bienvenue/             onboarding 8 étapes                              · ph. 3
│   │   ├── (app)/[org]/           coque : sélecteur d'entreprise, galet, ⌘K        · ph. 1
│   │   │   ├── page.tsx           accueil (pile + anneau en ph. 8)
│   │   │   ├── factures/ devis/ avoirs/                                            · ph. 4–5
│   │   │   ├── clients/ catalogue/                                                 · ph. 3
│   │   │   ├── recues/ e-reporting/ reforme/                                       · ph. 9
│   │   │   ├── exports/                                                            · ph. 8
│   │   │   └── reglages/          entreprise, membres, rôles                       · ph. 1
│   │   ├── impression/[id]/       rendu A4 nu = source unique aperçu + PDF         · ph. 6
│   │   ├── signer/[jeton]/        signature publique de devis                      · ph. 8
│   │   ├── admin/                 back-office                                      · ph. 10
│   │   └── api/                   webhooks Stripe et PA, cron relances
│   ├── src/components/
│   │   ├── ui/                    Pilule, ChampPilule, Carte, Pastille, Avatar, Galet, BarreCommande · ph. 1
│   │   ├── signatures/            Pile, Tampon, AnneauTresorerie (R3F), PapierVivant
│   │   └── modeles/               Galet, Papeterie, Classique                      · ph. 6
│   ├── src/lib/                   supabase/, org/, format/ (centimes → fr-FR, SIREN, IBAN)
│   ├── src/styles/                tokens.css, globals.css (Tailwind v4 @theme), print.css
│   └── e2e/                       Playwright
├── packages/
│   ├── moteur/                    calcul TVA, remises, acomptes, avoirs, arrondis  · ph. 2
│   ├── conformite/                mentions obligatoires + contrôle                 · ph. 4
│   ├── einvoice/                  mapping EN 16931 → CII / UBL                     · ph. 7
│   └── pa/                        PlateformeAgreeeAdapter + mock                   · ph. 9
├── services/atelier/              FastAPI : Playwright → PDF, factur-x → PDF/A-3   · ph. 6–7
├── supabase/                      migrations/, seed.sql, tests/ (pgTAP, RLS)       · ph. 1
├── docs/
└── .github/workflows/ci.yml
```

## Décisions proposées

1. **Texte encre sur tomate** : blanc sur `#FF5A36` = 3,1:1 (échec AA), encre = 5,5:1.
2. **Anneau de focus encre** (double anneau papier + encre) : tomate sur papier = 2,8:1, sous le seuil 3:1.
3. **PDF et Factur-X dans un conteneur « atelier » hébergé en UE**, hors fonctions Vercel. Le XML reste généré en TypeScript (mêmes totaux qu'à l'écran).
4. **Nommage** : URL et vocabulaire métier en français, tables Postgres en anglais (section 13).
5. **Statut = couleur + glyphe** pour l'impression N&B et le daltonisme.
6. **Tokens `--st-*` séparés** pour les remplissages de pastilles (prune et brique gardent un texte clair > 5:1 en sombre).
7. **Tailwind v4** : `@theme` avec `--color-*: initial` pour effacer la palette par défaut.
