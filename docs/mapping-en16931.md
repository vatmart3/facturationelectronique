# Correspondance PASTILLE → EN 16931

Comment une facture PASTILLE devient un fichier électronique conforme : CII D16B (la syntaxe de Factur-X) ou UBL 2.1, profil **EN16931**, avec les règles françaises **BR-FR** (flux 2 de la réforme).

Chaîne de production :

```
documents + lignes + instantanés (base)
  → DocumentImprimable          apps/web/src/lib/imprimable.ts
  → Facture (modèle EN 16931)   apps/web/src/lib/en16931.ts
  → contrôles                    packages/facturx/src/controles.ts
  → XML CII / UBL                packages/facturx/src/cii.ts, ubl.ts
  → PDF/A-3 + factur-x.xml       apps/web/src/lib/pdf.ts, packages/facturx/src/pdfa.ts
```

Un document émis est toujours reconstruit depuis ses **instantanés figés** (`seller_snapshot`, `client_snapshot`) : modifier la fiche client ou l'entreprise après coup ne change ni le PDF ni le XML.

## En-tête

| Terme | Libellé | Source PASTILLE | Remarques |
|---|---|---|---|
| BT-1 | Numéro de facture | `documents.number` | Attribué à l'émission, série sans trou |
| BT-2 | Date d'émission | `issue_date` | |
| BT-3 | Type | `type` | facture → 380, acompte → 386, avoir → 381 |
| BT-5 | Devise | `currency` | |
| BT-9 | Échéance | `due_date` | Calculée depuis les conditions de paiement |
| BT-10 | Référence acheteur | client `service_code` | Code service Chorus Pro |
| BT-13 | Bon de commande | `purchase_order` | |
| BT-20 | Conditions de paiement | conditions + échéance | « 30 jours, au plus tard le … » |
| BT-22 | Notes | objet, mentions, note au client | Codes sujet : PMD pénalités, PMT indemnité de 40 €, AAB escompte |
| BT-23 | Cadre de facturation | catégorie de l'opération | B/S/M + 1 (dépôt) ou 4 (définitive après acompte) |
| BT-24 | Profil | constant | `urn:cen.eu:en16931:2017` |
| BG-3 | Facture précédente | document d'origine d'un avoir | BT-25 numéro, BT-26 date |
| BT-72 | Date de livraison | `service_date` | |
| BG-14 | Période | `service_period_start`, `service_period_end` | |
| BT-80 | Pays de livraison | pays de livraison du client | Seulement pour les livraisons intracommunautaires (K) |

## Vendeur (BG-4) et acheteur (BG-7)

| Terme | Libellé | Source |
|---|---|---|
| BT-27 / BT-44 | Raison sociale | `name` |
| BT-29 / BT-46 | Identifiant (SIRET) | `siret`, schéma 0009 |
| BT-30 / BT-47 | Identifiant légal (SIREN) | `siren`, schéma 0002 |
| BT-31 / BT-48 | N° de TVA | `vat_number` |
| BT-32 | Identifiant fiscal du vendeur | SIREN, schéma FC, si le vendeur n'a pas de n° de TVA (franchise) |
| BT-33 | Informations juridiques | forme, capital, immatriculation |
| BG-5 / BG-8 | Adresse | lignes, code postal, ville, pays |
| BT-34 | Adresse électronique du vendeur | SIREN, schéma 0225 (annuaire) |
| BT-49 | Adresse électronique de l'acheteur | `einvoice_address` de la fiche client (email → EM, « 0009:… » → schéma explicite, sinon 0225), à défaut le SIREN |

## Paiement (BG-16)

| Terme | Libellé | Source |
|---|---|---|
| BT-81 | Moyen de paiement | 58 (virement SEPA) si l'IBAN est d'un pays SEPA, sinon 30 |
| BT-83 | Référence de paiement | numéro de facture |
| BT-84 | IBAN | `iban` de l'entreprise |
| BT-86 | BIC | `bic` |

Le PDF porte en plus un QR code de virement SEPA (EPC069-12) pour les factures en euros.

## Lignes (BG-25)

| Terme | Libellé | Source | Remarques |
|---|---|---|---|
| BT-126 | Identifiant | rang de la ligne | |
| BT-129 | Quantité | `quantity_milli` / 1000 | |
| BT-130 | Unité | `unit` | heure → HUR, jour → DAY, forfait → LS, pièce → H87, autres → C62 (recommandation UN/ECE 20) |
| BT-131 | Montant net | `line_net_cents` | Quantité × prix − remise de ligne, calculé par le moteur |
| BG-27 | Remise de ligne | montant de la remise | Une remise en % est convertie en montant |
| BT-146 | Prix unitaire net | `unit_price_cents` | |
| BT-151 / BT-152 | Catégorie, taux | `vat_category`, `vat_rate` | Aucun taux n'est écrit en catégorie O |
| BT-153 / BT-154 | Nom, description | `designation`, `description` | |

## Remises et acomptes au niveau du document (BG-20)

La remise globale est répartie par le moteur sur les taux (méthode du plus fort reste, hors débours) : une remise BG-20 est émise **par catégorie et taux** (BT-95, BT-96), ce qui garantit l'égalité des bases BT-116.

Une facture de solde déduit les acomptes déjà facturés : chaque acompte est une remise BG-20 par taux, motif « Acomptes déduits (F-…) ». Le cadre BT-23 vaut alors B4, S4 ou M4.

## Récapitulatif de TVA (BG-23) et totaux (BG-22)

| Terme | Libellé | Source |
|---|---|---|
| BT-116 | Base | `document_vat_summary.base_cents` |
| BT-117 | TVA | `vat_cents`, arrondie par taux (jamais par ligne) |
| BT-118 / BT-119 | Catégorie, taux | |
| BT-120 / BT-121 | Motif et code d'exonération | mention de la ligne ; VATEX-EU-AE, -IC, -G, -O |
| BT-106 | Total des lignes | `total_lines_ht` |
| BT-107 | Total des remises | remise globale + acomptes déduits |
| BT-109 / BT-110 / BT-112 | HT, TVA, TTC | |
| BT-115 | Net à payer | `amount_due` |

## Avoirs

La norme veut des montants **positifs** dans un avoir (type 381) : c'est le type qui porte le sens. PASTILLE stocke les avoirs en négatif (pour que les sommes et les exports soient justes) ; la conversion inverse tous les signes. La facture d'origine est citée en BG-3 et dans une mention.

## Ce qui n'est pas représentable

- **Débours mêlés à des lignes soumises à TVA** : interdit par BR-O-11. Le PDF est produit sans XML et le contrôle le signale ; facturez les débours sur un document séparé.
- **Devis** : hors du champ de la norme (pas de XML).

## Validation

Les tests (`packages/facturx/src/xml.test.ts`, `apps/web/src/lib/en16931.test.ts`) valident chaque cas — multi-taux avec remises, autoliquidation UE, avoir, facture de solde — contre :

- les schémas XSD officiels Factur-X 1.0.7 EN16931 et UBL 2.1 (xmllint) ;
- le Schematron EN 16931 (CII et UBL) ;
- le Schematron français BR-FR flux 2 (CII et UBL).

Les validateurs se téléchargent avec `outils/validateurs-facturx.sh` ; la CI les installe et définit `VALIDATEURS_FACTURX`. Sans eux, ces tests sont ignorés en local. Le PDF produit est en outre relu par la bibliothèque de référence `factur-x` (extraction du XML, détection du profil EN16931).
