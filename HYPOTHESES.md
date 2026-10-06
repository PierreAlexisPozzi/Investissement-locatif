# Hypothèses, points à confirmer et simplifications

Arrêté au **06/10/2026**. Ce document accompagne :

- `src/params/fiscal-2026.json` : les règles fiscales, chacune avec sa source, son URL officielle, sa date de vérification et son statut ;
- `src/params/hypotheses-defaut.json` : les hypothèses de marché et de modélisation par défaut, qui ne sont pas des règles fiscales.

Il est mis à jour dans la même pull request que le code concerné. Un test (`tests/garde-fous/hypotheses-a-jour.test.ts`) vérifie que la section 2 liste exactement les paramètres dont le statut n'est pas `verifie`.

## 1. Sources consultées le 06/10/2026

Seuls les sites de l'État admis par le cahier des charges font foi. Chaque page a été téléchargée et lue ; la date entre parenthèses est celle de la page elle-même.

| Source | Version lue | Sujets |
|---|---|---|
| service-public F1419, F2705, F1989 | vérifiées le 15/04/2026 | Barème, quotient familial, abattement de 10 % |
| Brochure pratique IR 2026 (calcul de l'impôt, aide-mémoire) | PDF du 18/03/2026 | Décote, arrondis, seuil de recouvrement, montants 2025 |
| service-public F31179 | vérifiée le 01/01/2026 | Plafonnement global des niches |
| impots.gouv.fr, prélèvements sociaux sur les loyers | modifiée le 17/07/2026 | 17,2 % / 18,6 %, CSG déductible |
| service-public F2329 | vérifiée le 30/06/2026 | Prélèvements sociaux sur les placements |
| BOI-BAREME-000017 | 10/03/2026 | Plafonds de loyer et de ressources 2026 |
| BOI-IR-RICI-360-20-30 | 10/03/2026 | Coefficient de surface et arrondis |
| BOI-IR-RICI-230-20-20 | 10/05/2019 | Surface prise en compte (annexes) |
| service-public F39735 | vérifiée le 21/07/2026 | Jeanbrun |
| Texte adopté T.A. n° 227 (Assemblée nationale), art. 47 et 98 | 02/02/2026 | Jeanbrun, LLI (texte de la loi n° 2026-103) |
| Sénat, dossier du PLF 2026 et table de concordance | mise à jour du 10/08/2026 | Numérotation finale des articles |
| BOI-RFPI-BASE-30-20 | 16/09/2025 | Déficit foncier |
| service-public F1991 | vérifiée le 15/04/2026 | Revenus fonciers, micro-foncier |
| BOI-TVA-IMM-30 et ACTU-2026-00054 | 08/07/2026 | LLI : TVA à 10 %, complément de TVA |
| BOI-IS-RICI-40-10, -10, -20, -30 | 12/06/2024 | Créance de taxe foncière |
| service-public F32744 | vérifiée le 15/04/2026 | Location meublée |
| BOI-BIC-AMT-20-40-10-20 | 12/09/2012 | Limitation de l'amortissement des biens loués |
| service-public F35011 | vérifiée le 11/03/2026 | Denormandie |
| BOI-IR-RICI-365-30, BOI-IR-RICI-360-30-10, BOI-IR-RICI-360-60 | 28/03/2024, 22/08/2024 | Denormandie : base, imputation, prorogation |
| service-public F10864 | vérifiée le 15/04/2026 | Plus-value immobilière |
| BOI-RFPI-TPVIE-20 | 18/07/2023 | Surtaxe sur les plus-values élevées |
| service-public F21618, F2385, F22414 | 15/04 et 22/05/2026 | PFU, PEA, assurance-vie |
| entreprendre.service-public F23575 | vérifiée le 17/02/2026 | Impôt sur les sociétés |
| service-public F1669, F16123 | 16/09/2026, 05/04/2024 | Remboursement anticipé, taux d'endettement |

**Non consultables automatiquement** : legifrance.gouv.fr, info.gouv.fr et economie.gouv.fr opposent un défi anti-robot (Cloudflare), qui n'a pas été contourné. Le texte de la loi de finances a été lu dans sa version définitivement adoptée sur le site de l'Assemblée nationale ; la décision n° 2026-901 DC du Conseil constitutionnel (consultée pour contrôle) ne censure ni l'article 47 ni l'article 98.

## 2. Paramètres dont le statut n'est pas `verifie`

Décompte : 96 paramètres, dont 88 vérifiés, 7 à confirmer et 1 dont le texte n'a pas été consulté. Liste régénérable avec `npm run params:rapport`.

<!-- debut:parametres-non-verifies -->
| Paramètre | Statut | Valeur retenue | Ce qui reste à établir | À qui le demander |
|---|---|---|---|---|
| `jeanbrun.prorata_premiere_annee` | a_confirmer | prorata mensuel | Calcul de la première annuité : le texte fixe seulement le point de départ (1er jour du mois d'achèvement ou d'acquisition). | Expert-comptable ou rescrit |
| `jeanbrun.plafond_proratise_premiere_annee` | a_confirmer | oui (prudent) | Le plafond annuel de 8 000 € est-il proratisé la première année ? Sans effet sous 285 714 € de prix. | Expert-comptable ou rescrit |
| `jeanbrun.concubins_plafond_par_foyer` | a_confirmer | quote-part par foyer | Application du plafond « par foyer fiscal » à deux concubins coacquéreurs. | Notaire ou expert-comptable |
| `lmnp.modelisation` | a_confirmer | terrain 15 %, bâti 30 ans, mobilier 7 ans, frais en charge l'année 1 | Paramètres comptables non fixés par les textes. | Expert-comptable |
| `lli.tva_taux_normal` | texte_non_consulte | 20 % | Article 278 du CGI non lu (Légifrance inaccessible) ; le BOFiP parle du « taux normal » sans chiffre. | Lecture de Légifrance |
| `lli.tf_deductible_si_creance` | a_confirmer | non déductible (prudent) | La non-déductibilité de la taxe foncière ouvrant droit à créance vise le « bénéfice imposable » des personnes morales : effet sur les revenus fonciers des associés d'une SCI à l'IR non tranché. | Expert-comptable ou rescrit |
| `cumul_jeanbrun_lli.statut_cumul` | a_confirmer | non exclu par les textes lus | Aucune source ne traite le cumul ; l'article 31 n'exclut que l'article 199 undecies C. Absence d'exclusion ne vaut pas autorisation. | Notaire ou rescrit (écrit) |
| `plus_value_immobiliere.forfait_travaux_bien_neuf_amorti` | a_confirmer | non appliqué (prudent) | Forfait travaux de 15 % sur un bien neuf amorti (Jeanbrun, LMNP). | Notaire |
<!-- fin:parametres-non-verifies -->

## 3. Écarts relevés avec le cahier des charges

Les sources lues le 06/10/2026 contredisent ou précisent le cahier des charges sur les points suivants. Les paramètres suivent les sources ; les arbitrages attendus figurent dans la description de la pull request.

1. **Loyer plafond, test du §13 (zone A, 45 m²)** : le BOFiP arrondit le plafond au m² au centime après coefficient (BOI-IR-RICI-360-20-30, §130) : 14,64 × 1,12 = 16,3968 → 16,40 €/m², soit **738,00 €/mois**, et non 737,86 € (calcul sans arrondi intermédiaire). Paramètre `loyers_plafonds.arrondi_plafond_m2`.
2. **Exemple officiel d'amortissement des biens loués (§13)** : l'exemple du BOI-BIC-AMT-20-40-10-20, §90, donne 1 500 € déductibles et **1 560 € reportables**, car il retranche d'abord 540 € au titre de la limite propre aux véhicules de tourisme. Les 2 100 € attendus par le cahier des charges sont justes pour un logement, qui n'est pas soumis à cette limite : le test sera libellé « adapté de l'exemple officiel ».
3. **Surtaxe sur les plus-values élevées en SCI (§6.9, §8.6)** : pour une SCI à l'IR, le seuil de 50 000 € s'apprécie au niveau de la société, sur la quote-part des seuls associés à l'IR non exonérés (BOI-RFPI-TPVIE-20, §60 et exemple 3), et non associé par associé. La règle de la quote-part vaut pour les époux, partenaires de PACS et concubins détenant directement le bien.
4. **Éligibilité géographique du LLI (§7)** : hors zones A bis, A et B1, le taux réduit reste ouvert dans certains périmètres, notamment les communes sous convention ORT ou contrat de PPA (BOI-TVA-IMM-30, §70). « Zone B2 » n'est donc pas à lui seul un motif d'inéligibilité.
5. **Ventilation du déficit foncier (§8.2)** : l'assurance emprunteur et les frais d'emprunt (dossier, garantie) suivent le régime des intérêts (BOI-RFPI-BASE-30-20, §110). Ils entrent dans la part imputée en priorité sur les loyers et jamais sur le revenu global.
6. **Point de départ des délais LLI (§6.5, §8.3)** : les 10, 15 et 20 ans courent à compter de la livraison (achèvement en VEFA), pas de la signature (BOI-TVA-IMM-30, §220).
7. **Denormandie (§6.8)** : pour un logement acheté en vue de travaux, la réduction s'impute pour la première fois l'année d'achèvement des travaux (BOI-IR-RICI-365-30, §150). Elle s'impute sur l'impôt progressif après décote, jamais sur l'impôt de plus-value (BOI-IR-RICI-360-30-10, §300).
8. **Majoration des plafonds Jeanbrun (§6.4)** : la condition des 50 % porte sur les revenus **bruts** des logements amortis (texte de l'article 31, I-1°, i).
9. **Statuts relevés** grâce au texte adopté et au BOFiP (cahier des charges : `texte_non_consulte`, désormais `verifie`) : point de départ de l'amortissement Jeanbrun, limite cumulée de 80 %, conservation des parts d'une société non soumise à l'IS, système du quotient et exceptions en cas de rupture, non-cumul avec l'article 199 undecies C, surface des annexes plafonnée à 8 m², étalement par tiers du complément de prorogation Denormandie.
10. **Statut abaissé** : taux normal de TVA de 20 % (`verifie` → `texte_non_consulte`), voir section 2.

## 4. Hypothèses par défaut (`hypotheses-defaut.json`)

Valeurs du §5.5 reprises telles quelles, sauf mention « choix de l'outil » (valeur absente du cahier des charges, à valider).

| Hypothèse | Défaut | Origine |
|---|---|---|
| Revalorisation des loyers | 1,5 %/an | §5.5 |
| Revalorisation des charges | 2 %/an | §5.5 |
| Vacance locative | 0,5 mois/an | §5.5 |
| Entretien | 5 % des loyers | §5.5 |
| Frais de cession | 5 % du prix de vente | §5.5 |
| Décote du neuf (pessimiste / central / optimiste) | 25 % / 15 % / 5 % du prix TTC à 20 % | §5.5 |
| Revalorisation annuelle du prix | 1 % dans les trois scénarios | §5.5 (un seul taux fourni) |
| Placement de référence | 4 %/an net de frais, avant fiscalité | §5.5 |
| Enveloppe du placement | PEA | Choix de l'outil : la fiscalité la plus favorable au placement rend la comparaison la plus exigeante pour l'immobilier |
| Inflation | 1,5 %/an | Choix de l'outil, aligné sur la revalorisation des loyers |
| Indexation du barème de l'IR | égale à l'inflation | §6.1 |
| Évolution des revenus du foyer | égale à l'inflation | Choix de l'outil : la tranche marginale reste stable sauf changement déclaré |
| Années d'exonération de taxe foncière | 0 | §6.5, §8.3 |
| Indemnités de remboursement anticipé | appliquées au plafond légal | Choix prudent de l'outil |
| Horizons de calcul | 9, 12, 16, 20, 25 ans | §5.6 |

Les hypothèses de modélisation LMNP (part du terrain, durées d'amortissement) sont dans `fiscal-2026.json` avec le statut `a_confirmer`, comme le prévoit le §6.7.

## 5. Simplifications et hors périmètre

- **Impôt sur le revenu** : nombre de parts saisi par l'utilisateur ; demi-parts particulières (parent isolé, invalidité, ancien combattant) et frais réels non modélisés ; plafond de niches majoré à 18 000 € (outre-mer, Sofica) non modélisé ; outre-mer hors périmètre.
- **CEHR, CDHR, IFI, démembrement de propriété** : hors périmètre. Le Jeanbrun exclut de toute façon les droits démembrés.
- **CSG déductible** : option du moteur, désactivée par défaut.
- **Déficit foncier majoré à 21 400 €** (travaux de rénovation énergétique payés jusqu'au 31/12/2027) : non modélisé, aucun scénario ne comporte de tels travaux déductibles.
- **Jeanbrun dans l'ancien** (art. 31, I-1°, j : taux de 3 % à 4 %, travaux d'au moins 30 %) : non modélisé, aucun scénario ne le prévoit.
- **Plafonds de loyer social et très social** : fixés par commune (Loc'Avantages, arrêté du 06/01/2026), saisis par l'utilisateur. Une réduction locale des plafonds intermédiaires par le préfet de région reste à vérifier pour la commune.
- **SCI à l'IS (S3 bis)** : variante indicative (IS 15 % puis 25 %, amortissement comptable, plus-value professionnelle simplifiée, distribution au PFU).
- **Sortie du LLI par cession des parts de la SCI** à un repreneur qui poursuit la location (pas de complément de TVA, BOI-TVA-IMM-30, §235) : non modélisée, marché étroit ; signalée dans les questions à poser.
- **Intérêts intercalaires de VEFA** : traités par un différé simple ; le détail des appels de fonds n'est pas modélisé.
- **Prélèvement forfaitaire unique** : l'option pour le barème n'est pas modélisée.
- **LMNP** : CFE saisie par l'utilisateur (montant fixé par la commune) ; résidences gérées et meublés de tourisme hors périmètre.
- **Arrondis** : calcul sans arrondi intermédiaire, arrondi à l'euro en fin de calcul de l'impôt (sauf plafond de loyer au m², arrondi au centime comme le prévoit le BOFiP).

## 6. Veille législative

- **Projet de loi de finances pour 2027** : en discussion, non pris en compte.
- **Projet de loi visant la relance et la décentralisation du logement** : adopté par le Sénat le 08/07/2026, transmis à l'Assemblée nationale. Il prévoit de « renforcer le statut du bailleur privé » ; la fiche F39735 annonce un assouplissement des conditions du Jeanbrun. À relire avant toute signature.
