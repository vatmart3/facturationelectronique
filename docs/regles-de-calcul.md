# Règles de calcul

Source unique : `packages/moteur`. L'écran, le PDF et le XML Factur-X utilisent les mêmes fonctions, donc les mêmes totaux au centime près.

## Unités

| Donnée | Unité | Exemple |
|---|---|---|
| Montant | centimes, entier | 450,00 € → `45000` |
| Quantité | millièmes, entier | 1,5 h → `1500` |
| Taux de TVA | points de base, entier | 5,5 % → `550` |

Aucun flottant pour l'argent. Les produits intermédiaires passent par `BigInt`.

## Arrondi

Au centime le plus proche, **les demis s'éloignent de zéro** (12 499,5 → 12 500 ; −12 499,5 → −12 500). Cette symétrie garantit qu'un avoir total vaut exactement l'opposé de la facture.

## Ordre de calcul

1. **Ligne** : brut = arrondi(quantité × prix unitaire HT). La remise de ligne (pourcentage arrondi ou montant) donne le net.
2. **Ventilation** : regroupement des lignes par catégorie EN 16931 (S, Z, E, AE, K, G, O) et par taux.
3. **Remise globale** : calculée sur les lignes hors débours (catégorie O), puis répartie au prorata des bases par la méthode du plus fort reste. La somme des parts égale toujours la remise.
4. **Acomptes déduits** (facture de solde) : la base HT de chaque acompte est retirée de la base de son taux.
5. **TVA** : arrondi(base × taux), **une fois par taux**, jamais ligne par ligne (EN 16931 BR-CO-17).
6. **Totaux** : HT = Σ bases ; TVA = Σ TVA ; TTC = HT + TVA ; net à payer = TTC.

## Catégories de TVA

| Code | Cas | TVA | Motif imprimé |
|---|---|---|---|
| S | Taux normal, intermédiaire, réduit, particulier, DOM | base × taux | — |
| Z | Taux zéro | 0 | — |
| E | Exonération (dont franchise en base, art. 293 B du CGI) | 0 | obligatoire |
| AE | Autoliquidation (services UE, sous-traitance BTP) | 0 | obligatoire |
| K | Livraison intracommunautaire (art. 262 ter I du CGI) | 0 | obligatoire |
| G | Export hors UE (art. 262 I du CGI) | 0 | obligatoire |
| O | Hors champ (débours) | 0 | obligatoire |

Hors catégorie S, le taux est forcé à 0, même si un taux a été saisi.

## Acomptes

- **En pourcentage** : chaque base du devis × pourcentage, arrondi.
- **En montant TTC** : répartition du TTC au prorata des taux, puis conversion en base HT. La TVA étant arrondie sur la base, certains montants TTC sont inatteignables : à 20 %, un montant sur six au centime près (par exemple 0,03 €). Le moteur retient alors le plus proche, **à un centime près au plus**.

## Avoirs

Lignes de la facture d'origine avec des quantités négatives. Un avoir partiel proratise les remises en montant sur la quantité créditée.

## Devises

Une facture en devise peut être convertie en euros (TVA en euros, BT-111) avec un taux de change décimal, sans flottant.
