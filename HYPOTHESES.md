# Hypothèses, points à confirmer et simplifications

Arrêté au **06/10/2026**. Ce document accompagne :

- `src/params/fiscal-2026.json` : les règles fiscales, chacune avec sa source, son URL officielle, sa date de vérification et son statut ;
- `src/params/hypotheses-defaut.json` : les hypothèses de marché et de modélisation par défaut, qui ne sont pas des règles fiscales.

Il est mis à jour dans la même pull request que le code concerné. Un test (`tests/garde-fous/hypotheses-a-jour.test.ts`) vérifie que la section 2 liste exactement les paramètres dont le statut n'est pas `verifie`, et la section 4 exactement les paramètres qui portent un arbitrage.

## 1. Sources consultées le 06/10/2026

Seuls les sites de l'État admis par le cahier des charges font foi. Chaque page a été téléchargée et lue ; la date entre parenthèses est celle de la page elle-même.

| Source | Version lue | Sujets |
|---|---|---|
| service-public F1419, F2705, F1989 | vérifiées le 15/04/2026 | Barème, quotient familial, abattement de 10 % |
| Brochure pratique IR 2026 (calcul de l'impôt, aide-mémoire) | PDF du 18/03/2026 | Décote, arrondis, seuil de recouvrement, système du quotient, montants 2025 |
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
| BOI-RFPI-BASE-20-10 | 06/07/2016 | Frais d'administration et de gestion, forfait par local |
| service-public F1991 | vérifiée le 15/04/2026 | Revenus fonciers, micro-foncier |
| BOI-TVA-IMM-30 et ACTU-2026-00054 | 08/07/2026 | LLI : TVA à 10 %, complément de TVA |
| BOI-IS-RICI-40-10, -10, -20, -30 | 12/06/2024 | Créance de taxe foncière |
| service-public F32744 | vérifiée le 15/04/2026 | Location meublée |
| BOI-BIC-AMT-20-40-10-20 | 12/09/2012 | Limitation de l'amortissement des biens loués |
| BOI-BIC-CHG-20-20-10 | 09/01/2019 | Option pour les frais d'acquisition : charge ou coût de l'immobilisation |
| BOI-BIC-DECLA-10-10-20 | 19/08/2026 | Micro-BIC : exclusion des indivisions |
| impots.gouv.fr, FAQ « Régime des locations meublées » | version 03/2026 | Location meublée en indivision |
| service-public F35011 | vérifiée le 11/03/2026 | Denormandie, durées d'engagement |
| BOI-IR-RICI-365-30, BOI-IR-RICI-360-30-10, BOI-IR-RICI-360-60 | 28/03/2024, 22/08/2024 | Denormandie : base, imputation, prorogation |
| service-public F10864 | vérifiée le 15/04/2026 | Plus-value immobilière |
| BOI-RFPI-TPVIE-20 | 18/07/2023 | Surtaxe sur les plus-values élevées |
| BOI-RFPI-PVI-20-10-20-20 | 20/12/2013 | Frais et travaux majorant le prix d'acquisition |
| BOI-RFPI-PVI-20-20 | 18/07/2023 | Délai de détention, point de départ en VEFA |
| BOI-IR-RICI-360-40 | 10/05/2019 | Remise en cause des réductions Pinel et Denormandie |
| service-public F21618, F2385, F22414 | 15/04 et 22/05/2026 | PFU, PEA, assurance-vie |
| entreprendre.service-public F23575 | vérifiée le 17/02/2026 | Impôt sur les sociétés |
| service-public F1669, F16123 | 16/09/2026, 05/04/2024 | Remboursement anticipé, taux d'endettement |

**Non consultables automatiquement** : legifrance.gouv.fr, info.gouv.fr et economie.gouv.fr opposent un défi anti-robot (Cloudflare), qui n'a pas été contourné. Le texte de la loi de finances a été lu dans sa version définitivement adoptée sur le site de l'Assemblée nationale ; la décision n° 2026-901 DC du Conseil constitutionnel (consultée pour contrôle) ne censure ni l'article 47 ni l'article 98.

## 2. Paramètres dont le statut n'est pas `verifie`

Décompte : 106 paramètres, dont 93 vérifiés, 12 à confirmer et 1 dont le texte n'a pas été consulté. Liste régénérable avec `npm run params:rapport`.

<!-- debut:parametres-non-verifies -->
| Paramètre | Statut | Valeur retenue | Ce qui reste à établir | À qui le demander |
|---|---|---|---|---|
| `jeanbrun.prorata_premiere_annee` | a_confirmer | prorata mensuel | Calcul de la première annuité : le texte fixe seulement le point de départ (1er jour du mois d'achèvement ou d'acquisition). | Expert-comptable ou rescrit |
| `jeanbrun.plafond_proratise_premiere_annee` | a_confirmer | oui (prudent, arbitré) | Le plafond annuel de 8 000 € est-il proratisé les années partielles (première année, année de cession) ? Sans effet sous 285 714 € de prix. | Expert-comptable ou rescrit |
| `jeanbrun.concubins_plafond_par_foyer` | a_confirmer | quote-part par foyer | Application du plafond « par foyer fiscal » à deux concubins coacquéreurs. | Notaire ou expert-comptable |
| `lmnp.modelisation` | a_confirmer | terrain 15 %, bâti 30 ans, mobilier 7 ans, frais en charge l'année 1 | Paramètres comptables non fixés par les textes. | Expert-comptable |
| `lmnp.perimetre_reintegration_pv` | a_confirmer | immeuble seul (arbitré) | Réintégration des amortissements du mobilier dans la plus-value. | Notaire |
| `lli.tva_taux_normal` | texte_non_consulte | 20 % | Article 278 du CGI non lu (Légifrance inaccessible) ; le BOFiP parle du « taux normal » sans chiffre. | Lecture de Légifrance |
| `lli.tf_deductible_si_creance` | a_confirmer | non déductible (prudent) | La non-déductibilité de la taxe foncière ouvrant droit à créance vise le « bénéfice imposable » des personnes morales : effet sur les revenus fonciers des associés d'une SCI à l'IR non tranché. | Expert-comptable ou rescrit |
| `cumul_jeanbrun_lli.statut_cumul` | a_confirmer | non exclu par les textes lus | Aucune source ne traite le cumul ; l'article 31 n'exclut que l'article 199 undecies C. Absence d'exclusion ne vaut pas autorisation. | Notaire ou rescrit (écrit) |
| `plus_value_immobiliere.forfait_travaux_bien_neuf_amorti` | a_confirmer | non appliqué (prudent) | Forfait travaux de 15 % sur un bien neuf amorti (Jeanbrun, LMNP). | Notaire |
| `plus_value_immobiliere.frais_acquisition_deduits_en_charge` | a_confirmer | forfait ou frais réels conservés (arbitré) | Prise en compte dans la plus-value de frais d'acquisition déjà passés en charge en LMNP. | Notaire |
| `plus_value_immobiliere.travaux_denormandie_retenus` | a_confirmer | exclus, sauf reprise de la réduction (prudent) | La tolérance du BOFiP pour les travaux compris dans la base d'une réduction (Scellier, Censi-Bouvard) vaut-elle pour le Denormandie ? | Notaire |
| `sci_ir.frais_constitution_deductibles` | a_confirmer | non déduits (arbitré, prudent) | Déduction des frais de constitution d'une SCI des revenus fonciers. | Expert-comptable |
| `sci_ir.frais_bancaires_couverts_par_forfait` | a_confirmer | oui | Frais bancaires de la SCI couverts par le forfait de frais de gestion. | Expert-comptable |
<!-- fin:parametres-non-verifies -->

## 3. Écarts relevés avec le cahier des charges

Les sources lues le 06/10/2026 contredisent ou précisent le cahier des charges sur les points suivants. Les paramètres suivent les sources ; les points 1, 3, 4, 5 et 12 ont été arbitrés le 06/10/2026 (section 4).

1. **Loyer plafond, test du §13 (zone A, 45 m²)** : le BOFiP arrondit le plafond au m² au centime après coefficient (BOI-IR-RICI-360-20-30, §130) : 14,64 × 1,12 = 16,3968 → 16,40 €/m², soit **738,00 €/mois**, et non 737,86 € (calcul sans arrondi intermédiaire). Paramètre `loyers_plafonds.arrondi_plafond_m2`. *Arbitré : méthode du BOFiP.*
2. **Exemple officiel d'amortissement des biens loués (§13)** : l'exemple du BOI-BIC-AMT-20-40-10-20, §90, donne 1 500 € déductibles et **1 560 € reportables**, car il retranche d'abord 540 € au titre de la limite propre aux véhicules de tourisme. Les 2 100 € attendus par le cahier des charges sont justes pour un logement, qui n'est pas soumis à cette limite : le test est libellé « adapté de l'exemple officiel » (`tests/engine/lmnp.test.ts`).
3. **Surtaxe sur les plus-values élevées en SCI (§6.9, §8.6)** : pour une SCI à l'IR, le seuil de 50 000 € s'apprécie au niveau de la société, sur la quote-part des seuls associés à l'IR non exonérés (BOI-RFPI-TPVIE-20, §60 et exemple 3), et non associé par associé. La règle de la quote-part vaut pour les époux, partenaires de PACS et concubins détenant directement le bien. *Arbitré : règle du BOFiP.*
4. **Éligibilité géographique du LLI (§7)** : hors zones A bis, A et B1, le taux réduit reste ouvert dans certains périmètres, notamment les communes sous convention ORT ou contrat de PPA (BOI-TVA-IMM-30, §70). « Zone B2 » n'est donc pas à lui seul un motif d'inéligibilité. *Arbitré : règle du BOFiP, périmètre déclaré par l'utilisateur.*
5. **Ventilation du déficit foncier (§8.2)** : l'assurance emprunteur et les frais d'emprunt (dossier, garantie) suivent le régime des intérêts (BOI-RFPI-BASE-30-20, §110). Ils entrent dans la part imputée en priorité sur les loyers et jamais sur le revenu global. *Arbitré : règle du BOFiP.*
6. **Point de départ des délais LLI (§6.5, §8.3)** : les 10, 15 et 20 ans courent à compter de la livraison (achèvement en VEFA), pas de la signature (BOI-TVA-IMM-30, §220).
7. **Denormandie (§6.8)** : pour un logement acheté en vue de travaux, la réduction s'impute pour la première fois l'année d'achèvement des travaux (BOI-IR-RICI-365-30, §150). Elle s'impute sur l'impôt progressif après décote, jamais sur l'impôt de plus-value (BOI-IR-RICI-360-30-10, §300).
8. **Majoration des plafonds Jeanbrun (§6.4)** : la condition des 50 % porte sur les revenus **bruts** des logements amortis (texte de l'article 31, I-1°, i).
9. **Statuts relevés** grâce au texte adopté et au BOFiP (cahier des charges : `texte_non_consulte`, désormais `verifie`) : point de départ de l'amortissement Jeanbrun, limite cumulée de 80 %, conservation des parts d'une société non soumise à l'IS, système du quotient et exceptions en cas de rupture, non-cumul avec l'article 199 undecies C, surface des annexes plafonnée à 8 m², étalement par tiers du complément de prorogation Denormandie.
10. **Statut abaissé** : taux normal de TVA de 20 % (`verifie` → `texte_non_consulte`), voir section 2.
11. **Frais de gestion des revenus fonciers (§8.2)** : le forfait de 20 € par local (BOI-RFPI-BASE-20-10, §210 à 240), absent du cahier des charges, s'ajoute aux charges déductibles. Il couvre les frais de gestion qui ne se déduisent pas pour leur montant réel ; seuls les honoraires versés à des tiers (gérance, comptabilité) se déduisent en plus.
12. **Réintégration des amortissements LMNP (§6.7, §8.6)** : l'outil réintègre dans la plus-value les seuls amortissements de l'immeuble effectivement déduits ; ceux du mobilier, bien meuble hors du champ de la plus-value immobilière, ne le sont pas. Le cahier des charges parle des « amortissements déduits » sans distinction : lecture à confirmer. *Arbitré : immeuble seul.*
13. **Détention d'un logement acquis en VEFA (§8.6)** : pour la plus-value, elle court à compter de la conclusion du contrat, pas de la livraison (BOI-RFPI-PVI-20-20, §40), par périodes de douze mois jusqu'à la cession (§20).
14. **Sortie anticipée du Denormandie (§9)** : la cession pendant l'engagement majore l'impôt de l'année du montant total des réductions obtenues (BOI-IR-RICI-360-40, §50, applicable au Denormandie selon BOI-IR-RICI-365-30, §230). Le cahier des charges ne la chiffrait pas.
15. **Location meublée en indivision (§8.4)** : les indivisions, soumises au régime fiscal des sociétés de personnes, sont exclues du micro-BIC sauf exception (BOI-BIC-DECLA-10-10-20, §80 ; FAQ « Régime des locations meublées » de la DGFiP). Un logement meublé détenu par des concubins relève donc du régime réel, alors que le cahier des charges compare micro-BIC et réel sans réserve. Paramètre `lmnp.micro_bic_exclu_indivision`. Un foyer unique (personne seule, couple marié ou pacsé) est traité comme un exploitant unique ; pour un couple pacsé propriétaire en indivision, la dérogation du §80, qui vise les époux, reste à confirmer.
16. **Travaux Denormandie et plus-value (§8.6)** : les dépenses incluses dans la base d'une réduction d'impôt sont exclues de la majoration pour travaux, sauf si la réduction est reprise, en cas de rupture de l'engagement notamment (BOI-RFPI-PVI-20-10-20-20, §240). Une tolérance les admet si elles précèdent la première location, pour les dispositifs ouverts à la fois au neuf et à l'ancien avec travaux (§265), mais le BOFiP, de 2013, ne cite pas le Pinel ni le Denormandie. L'outil exclut ces travaux (prudent) et les retient en cas de reprise. Paramètre `plus_value_immobiliere.travaux_denormandie_retenus`.

## 4. Arbitrages retenus : hypothèses choisies

Choix faits lorsqu'une règle s'écartait du cahier des charges ou admettait plusieurs lectures. Chacun est porté par le champ `arbitrage` du paramètre concerné et sera signalé dans l'interface. À revoir si un professionnel ou une source nouvelle contredit le choix.

<!-- debut:arbitrages -->
| Paramètre | Date | Choix retenu | Option écartée | Effet |
|---|---|---|---|---|
| `loyers_plafonds.arrondi_plafond_m2` | 06/10/2026 | Plafond au m² arrondi au centime après coefficient (BOFiP) | Calcul sans arrondi intermédiaire du §13 | Zone A, 45 m² : 738,00 € au lieu de 737,86 € |
| `deficit_foncier.frais_emprunt_assimiles_interets` | 06/10/2026 | Assurance emprunteur et frais de dossier et de garantie traités comme des intérêts (BOFiP) | Seuls les intérêts imputés en priorité (lecture littérale du §8.2) | Déficit imputable sur le revenu global plus faible, donc moins d'économie d'impôt immédiate |
| `plus_value_immobiliere.surtaxe_appreciation_seuil` | 06/10/2026 | Seuil de 50 000 € apprécié au niveau de la SCI à l'IR (BOFiP) | Seuil apprécié associé par associé (§6.9 et §8.6) | Surtaxe plus souvent due en SCI |
| `jeanbrun.plafond_proratise_premiere_annee` | 06/10/2026 | Plafond annuel proratisé la première année, comme l'annuité (prudent) ; même règle l'année de la cession, si elle est partielle | Plafond plein dès la première année (lecture littérale) | Au-delà de 285 714 € de prix en intermédiaire, première et dernière déductions plus faibles de quelques centaines d'euros |
| `lmnp.modelisation` | 06/10/2026 | Frais d'acquisition passés en charge l'année 1 ; l'autre option calculée en sensibilité | Frais incorporés au prix de revient et amortis hors terrain | Déficit reportable 10 ans seulement, qui peut se périmer si l'amortissement absorbe le résultat ; pas de réintégration dans la plus-value |
| `lli.perimetres_assimiles` | 06/10/2026 | LLI éligible hors zones A bis, A et B1 si la commune est déclarée dans un périmètre assimilé (ORT, PPA…) (BOFiP) | Zone B2 ou C toujours inéligible (§7) | LLI possible en zone B2 ou C sous convention ORT ou contrat de PPA ; aucun effet en zone tendue |
| `lmnp.perimetre_reintegration_pv` | 06/10/2026 | Seuls les amortissements de l'immeuble effectivement déduits sont réintégrés dans la plus-value | Réintégrer aussi ceux du mobilier | Impôt de plus-value plus faible |
| `plus_value_immobiliere.frais_acquisition_deduits_en_charge` | 06/10/2026 | Forfait de 7,5 % ou frais réels conservés dans la plus-value, même passés en charge en LMNP | Aucun frais retenu (prudent) | Impôt de plus-value plus faible ; point à signaler au notaire |
| `sci_ir.frais_constitution_deductibles` | 06/10/2026 | Frais de constitution de la SCI non déduits des revenus fonciers (prudent) | Déduction l'année du paiement | Déficit de la première année plus faible |
<!-- fin:arbitrages -->

## 5. Hypothèses par défaut (`hypotheses-defaut.json`)

Valeurs du §5.5 reprises telles quelles, sauf mention « choix de l'outil » (valeur absente du cahier des charges). Les choix de l'outil ont été validés le 06/10/2026.

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
| Sensibilités (tornado) | prix de revente et loyer ±10 %, vacance de 0 à 2 mois, taux d'emprunt ±1 point, revenus ±20 % | Choix de l'outil (§9 n'en fixe pas l'amplitude) |
| Tableau croisé | décote du neuf de 5 % à 25 %, revalorisation de 0 % à 2 %/an | Choix de l'outil |

Les hypothèses de modélisation LMNP (part du terrain, durées d'amortissement) sont dans `fiscal-2026.json` avec le statut `a_confirmer`, comme le prévoit le §6.7.

## 6. Simplifications et hors périmètre

- **Impôt sur le revenu** : nombre de parts saisi par l'utilisateur ; demi-parts particulières (parent isolé, invalidité, ancien combattant) et frais réels non modélisés ; plafond de niches majoré à 18 000 € (outre-mer, Sofica) non modélisé ; outre-mer hors périmètre. Le taux marginal affiché est celui de la tranche du dernier euro imposé (quotient de base si le quotient familial est plafonné) : il sert aux alertes, jamais au calcul de l'impôt, toujours recalculé en entier avec et sans l'opération.
- **Seuil de mise en recouvrement** (61 €) : comparé à l'impôt avant arrondi, ce qui reproduit le seuil de la brochure IR 2026 pour une personne seule (tableau 7 : 17 596 €).
- **Indexation future du barème** : bornes, plafond du quotient familial, décote et bornes de la déduction de 10 % revalorisés du coefficient d'inflation et arrondis à l'euro ; taux, seuil de recouvrement et plafond des niches inchangés.
- **Revenu global** : le déficit foncier imputable de l'année s'impute avant les déficits globaux antérieurs ; les charges déductibles (CSG déductible) ne créent jamais de déficit.
- **CEHR, CDHR, IFI, démembrement de propriété** : hors périmètre. Le Jeanbrun exclut de toute façon les droits démembrés.
- **CSG déductible** : option du moteur, désactivée par défaut.
- **Déficit foncier majoré à 21 400 €** (travaux de rénovation énergétique payés jusqu'au 31/12/2027) : non modélisé, aucun scénario ne comporte de tels travaux déductibles.
- **Jeanbrun dans l'ancien** (art. 31, I-1°, j : taux de 3 % à 4 %, travaux d'au moins 30 %) : non modélisé, aucun scénario ne le prévoit.
- **Plafonds de loyer social et très social** : fixés par commune (Loc'Avantages, arrêté du 06/01/2026), saisis par l'utilisateur. Une réduction locale des plafonds intermédiaires par le préfet de région reste à vérifier pour la commune.
- **Jeanbrun** : un seul logement Jeanbrun par foyer, dont le plafond annuel est celui de son niveau de loyer ; dernière année amortie fournie par l'orchestration (étape 4). En cas de rupture, le supplément d'impôt suit le système du quotient (coefficient égal au nombre d'années civiles d'amortissement déduit), la décote s'appliquant à l'impôt total (brochure pratique IR 2026, p. 370).
- **LLI** : mixité sociale et périmètre assimilé déclarés par l'utilisateur ; complément de TVA intégral, sans dégressivité, y compris quand les conditions cessent sans cession entre la 16e et la 20e année ; créance de taxe foncière encaissée l'année de la taxe (remboursement immédiat), y compris pour la variante à l'IS.
- **SCI à l'IR** : frais de comptabilité déduits pour leur montant réel ; frais bancaires couverts par le forfait de frais de gestion (`sci_ir.frais_bancaires_couverts_par_forfait`, lecture de l'outil) ; frais de constitution non déduits des revenus fonciers (`sci_ir.frais_constitution_deductibles`, arbitrage du 06/10/2026, `TODO(fiscal)`).
- **SCI à l'IS (S3 bis)** : variante indicative. IS à 15 % puis 25 % ; bâti amorti selon les hypothèses de modélisation du LMNP, sans limitation de l'amortissement au loyer ; frais d'acquisition traités selon l'option retenue pour le LMNP ; déficits reportables sans limite de durée ni plafond ; plus-value égale au prix net diminué de la valeur nette comptable ; bénéfices distribués au PFU.
- **Sortie du LLI par cession des parts de la SCI** à un repreneur qui poursuit la location (pas de complément de TVA, BOI-TVA-IMM-30, §235) : non modélisée, marché étroit ; signalée dans les questions à poser.
- **Intérêts intercalaires de VEFA** : traités par un différé partiel (intérêts et assurance seuls) calculé sur tout le capital dès la signature, ce qui est prudent ; le détail des appels de fonds n'est pas modélisé.
- **Emprunt** : taux mensuel égal au taux annuel divisé par 12 (taux proportionnel, usage bancaire) ; échéances arrondies au centime, la dernière soldant le capital ; assurance constante calculée sur le capital initial ; frais de dossier et de garantie payés à la mise en place. Sur ces conventions, la mensualité du §13 (1 238,19 €) et les intérêts de la première année (8 399,96 €) sont retrouvés.
- **Autres revenus fonciers du foyer au réel** : ajoutés aux recettes, sans charges financières propres ; la limite de 10 700 € d'un associé de SCI s'applique à sa quote-part, que l'appelant fournit.
- **Plus-value** : frais d'acquisition et travaux retenus au plus favorable entre montant réel et forfait ; travaux déduits des revenus fonciers exclus, ceux d'une location nue au micro-foncier retenus (ils n'ont pas été déduits) ; travaux Denormandie exclus sauf reprise de la réduction (section 3, point 16) ; moins-value non imputable ; années de détention révolues comptées de la signature, contrat de VEFA compris (section 3, point 13).
- **Prélèvement forfaitaire unique** : l'option pour le barème n'est pas modélisée.
- **LMNP** : CFE saisie par l'utilisateur (montant fixé par la commune) ; résidences gérées, meublés de tourisme et loueur professionnel (signalé, non modélisé) hors périmètre. Un composant bâti unique et le mobilier ; prorata mensuel la première année et solde l'année suivant la dernière annuité ; amortissement déduit réparti entre composants au prorata des montants disponibles ; déficits antérieurs imputés après l'amortissement de l'année (§8.4, ordre non précisé par le BOFiP) ; micro-BIC apprécié sur les recettes de chaque année, sans la tolérance d'une année isolée de dépassement (prudent). Le choix du meilleur régime et l'année de bascule relèvent de l'orchestration (étape 4).
- **Frais d'acquisition passés en charge en LMNP et plus-value** : le BOFiP lu (BOI-RFPI-PVI-20-10-20-20, §240) exclut de la plus-value les travaux déjà déduits mais ne dit rien des frais d'acquisition déduits. Frais réels ou forfait de 7,5 % conservés (arbitrage du 06/10/2026), à confirmer par un notaire.
- **Denormandie** : coût total de l'opération, pour la condition de 25 % de travaux, égal au prix, aux frais et aux travaux ; plafond de 5 500 €/m² appliqué à la surface habitable ; 12 ans modélisés par l'engagement initial et ses prorogations, au même rythme (2 %/an puis 1 %/an) ; détention en SCI à l'IR non exclue mais non utilisée par les scénarios.
- **Placement de référence** : versement initial au début de la première année, versements de l'année répartis en fin de mois et capitalisation mensuelle au taux équivalent ; un flux négatif est un retrait, sans imposition immédiate ni clôture du PEA ; impôt et prélèvements sociaux calculés au rachat total, à l'horizon, sur le gain cumulé ; versements au-delà du plafond du PEA (par titulaire) placés sur un compte-titres ; assurance-vie : abattement appliqué avant le partage entre taux de 7,5 % et 12,8 %. Conventions validées le 06/10/2026.
- **Arrondis** : calcul sans arrondi intermédiaire, arrondi à l'euro en fin de calcul de l'impôt (sauf plafond de loyer au m², arrondi au centime comme le prévoit le BOFiP).
- **Calendrier de l'opération** (étape 4) : événements ramenés au premier jour de leur mois ; revente le jour anniversaire du début de la location, après le nombre d'années de location de l'horizon ; détention, pour la plus-value, comptée de la signature du contrat (VEFA comprise). Chaque année civile est partielle si la détention ou la location n'y couvre pas douze mois ; l'année de la revente figure au calendrier même quand la revente a lieu un 1er janvier (zéro mois détenu), car l'impôt de la cession et les reprises d'avantages s'y rattachent.
- **Financement à la signature** : prix, frais de notaire, frais de dossier et de garantie, mobilier (LMNP) et frais de constitution (SCI) payés à la signature ; fonds propres = coût total − montant emprunté ; appels de fonds de la VEFA non modélisés (différé sur tout le capital, déjà prudent).
- **Loyers et charges** : loyers de marché et plafonds saisis aux valeurs de l'année d'acquisition, revalorisés chaque année civile ; vacance appliquée au prorata des mois loués ; logement neuf, taxe foncière due à partir de l'année suivant l'achèvement, au prorata des mois détenus (répartition usuelle entre vendeur et acquéreur), nulle pendant les années d'exonération, copropriété et assurance à partir de la livraison ; logement ancien, taxe foncière, copropriété et assurance dès l'achat, pendant les travaux compris ; forfait de frais de gestion compté aussi comme dépense (il représente des frais réels).
- **Impôt des foyers** : revenus indexés sur l'inflation à partir de l'année d'acquisition, barème indexé à partir de l'année des revenus des paramètres (2025) ; autres revenus fonciers constants ; sans l'opération, régime actuel des autres revenus fonciers ; avec l'opération, revenus fonciers réunis au réel (ou au micro-foncier pour la variante S0). Concubins et associés de SCI : chaque foyer déclare sa quote-part, avec sa propre limite de 10 700 € et son propre plafond Jeanbrun. Couple marié en nom propre : quotes-parts de 50 % chacun pour la surtaxe sur les plus-values élevées.
- **Choix du régime** : location nue classique (S0) au réel ou au micro-foncier, LMNP (S4) au réel, au micro-BIC ou au réel puis au micro-BIC à partir de l'année de bascule ; le régime retenu est celui de la meilleure valeur actuelle nette au rendement du placement. Micro-foncier exclu si les autres revenus fonciers du foyer sont déjà au réel ; micro-BIC exclu pour un logement indivis entre plusieurs foyers (`lmnp.micro_bic_exclu_indivision`) ; seuils et abattement minimum appréciés foyer par foyer, sur sa quote-part, et chaque année.
- **LMNP pendant la construction** : charges antérieures au début de la location (intérêts intercalaires, assurance, frais d'emprunt, frais d'acquisition passés en charge) reportées sur le premier exercice d'activité.
- **Sortie anticipée** : Jeanbrun, amortissements déduits réintégrés au quotient l'année de la cession et prélèvements sociaux sur leur montant ; ils ne minorent alors plus le prix d'acquisition dans la plus-value (lecture de l'outil, pour éviter une double imposition). Denormandie, impôt de l'année de cession majoré des réductions obtenues, sans réduction cette année-là. LLI, complément de TVA payé à la revente. Remise en cause des déficits imputés sur le revenu global faute de location jusqu'au 31/12 de la 3e année suivante : alerte, non chiffrée.
- **Revente** : neuf, prix TTC à 20 % diminué de la décote du neuf, revalorisé sur la durée exacte de détention ; ancien, prix et travaux revalorisés sans décote ; indemnités de remboursement anticipé au plafond légal ; plus-value des particuliers, sauf SCI à l'IS.
- **SCI à l'IS** : pas de distribution annuelle ; à la revente, dividendes égaux aux résultats nets cumulés s'ils sont positifs, au PFU ; l'IS supplémentaire dû à cause de la plus-value est présenté avec la sortie, comme l'impôt de plus-value des particuliers, l'IS courant restant dans le flux de l'année ; créance de taxe foncière non imposable.
- **Indicateurs** (§9) : TRI et VAN sur des flux datés (signature, milieu de la période détenue chaque année, revente) ; VAN au rendement du placement de référence ; effort d'épargne des « années 1 à 3 » calculé sur les 36 premiers mois de détention, construction comprise ; rendements calculés sur la première année de location complète ; taux d'endettement rapporté au revenu imposable, sans les loyers (prudent) ; prix de revente d'équilibre recherché par dichotomie ; dans le prix d'équilibre, le tornado et le tableau croisé, le régime retenu dans le cas central est conservé pour que seule la variable étudiée change ; pénalité de sortie anticipée calculée pour une revente un an avant la fin des engagements.

## 7. Veille législative

- **Projet de loi de finances pour 2027** : en discussion, non pris en compte.
- **Projet de loi visant la relance et la décentralisation du logement** : adopté par le Sénat le 08/07/2026, transmis à l'Assemblée nationale. Il prévoit de « renforcer le statut du bailleur privé » ; la fiche F39735 annonce un assouplissement des conditions du Jeanbrun. À relire avant toute signature.
