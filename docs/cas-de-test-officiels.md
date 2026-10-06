# Cas de test officiels relevés

Exemples chiffrés publiés par l'administration, relevés le 06/10/2026 lors de la vérification des paramètres. Ils complètent les valeurs de référence du §13 du cahier des charges. Ceux de l'impôt, de la décote, du déficit foncier, du plafond de loyer, de la plus-value et de la surtaxe sont couverts depuis l'étape 2 par `tests/engine/` ; ceux de la créance de taxe foncière et de l'amortissement des biens loués le seront à l'étape 3.

## Impôt sur le revenu (service-public F1419, vérifiée le 15/04/2026)

| Foyer | Revenu net imposable | Impôt attendu |
|---|---|---|
| Célibataire, 1 part | 30 000 € | 2 103,99 € |
| Couple marié, 2 parts | 60 000 € | 4 207,98 € |
| Couple marié, 2 parts | 90 000 € | 13 207,98 € |
| Couple + 1 enfant, 2,5 parts | 60 000 € | 3 410 € (plafonnement du quotient non atteint) |
| Couple + 1 enfant, 2,5 parts | 90 000 € | 11 400,98 € (plafonnement atteint : 13 207,98 − 1 807) |
| Couple + 2 enfants, 3 parts | 60 000 € | 2 772 € |
| Couple + 2 enfants, 3 parts | 90 000 € | 9 593,98 € (plafonnement atteint : 13 207,98 − 2 × 1 807) |

Avant décote et sans réduction d'impôt.

## Décote (brochure pratique IR 2026, p. 371)

Couple marié, impôt avant décote 2 140 € : décote = 1 483 − 45,25 % × 2 140 = 515 € (arrondi) ; impôt après décote 1 625 €.

## Déficit foncier (service-public F1991)

Recettes 5 000 €, charges hors intérêts 12 000 €, intérêts 6 000 € : déficit de 13 000 €, dont 10 700 € imputés sur le revenu global et 2 300 € reportables sur les revenus fonciers (1 000 € d'intérêts non couverts + 1 300 € au-delà du plafond).

## Plafond de loyer (BOI-IR-RICI-360-20-30, §130, barème 2013)

Le plafond au m² est arrondi au centime après coefficient, puis multiplié par la surface.

| Zone | Surface | Plafond au m² | Coefficient retenu | Plafond au m² ajusté | Loyer plafond |
|---|---|---|---|---|---|
| A bis | 80 m² | 16,52 € | 0,94 | 15,53 € | 1 242,40 € |
| A bis | 40 m² | 16,52 € | 1,18 | 19,49 € | 779,60 € |
| A | 70 m² | 12,27 € | 0,97 | 11,90 € | 833,00 € |
| A | 35 m² | 12,27 € | 1,20 (1,24 plafonné) | 14,72 € | 515,20 € |
| B1 | 50 m² | 9,88 € | 1,08 | 10,67 € | 533,50 € |
| B1 | 25 m² | 9,88 € | 1,20 (1,46 plafonné) | 11,86 € | 296,50 € |
| B2 | 40 m² | 8,59 € | 1,18 | 10,14 € | 405,60 € |
| B2 | 20 m² | 8,59 € | 1,20 (1,65 plafonné) | 10,31 € | 206,20 € |

Avec le barème 2026 : zone A, 45 m² → 14,64 × 1,12 = 16,3968 → 16,40 €/m² → 738,00 €.

## Plus-value immobilière (service-public F10864)

- Détention de 10 ans, plus-value de 10 000 € : abattement IR 30 % (base 7 000 €), abattement PS 8,25 % (base 9 175 €).
- Détention de 25 ans : exonération d'IR, abattement PS 55 % (26,4 + 1,6 + 27).
- Détention de 30 ans : exonération totale.
- Plus-value imposable de 20 000 € : 3 800 € d'IR + 3 440 € de prélèvements sociaux = 7 240 €.

## Créance de taxe foncière LLI (BOI-IS-RICI-40-10-20, §50)

Logement achevé au 01/01/2023, deux années d'exonération de taxe foncière : créance pendant 18 ans au lieu de 20.

## Amortissement des biens loués (BOI-BIC-AMT-20-40-10-20, §90)

Exemple officiel (véhicule) : dotation 3 600 €, dont 540 € écartés par la limite propre aux véhicules de tourisme ; loyers 2 500 €, autres charges 1 000 € ; amortissement déductible 1 500 €, reportable 1 560 €. Pour un logement, non soumis à la limite des véhicules : déductible 1 500 €, reportable 2 100 € (test du cahier des charges, à libeller « adapté de l'exemple officiel »).
