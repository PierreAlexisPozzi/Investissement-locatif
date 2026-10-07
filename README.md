# Investissement locatif — aide à la décision

Application web locale qui simule un investissement locatif sous plusieurs dispositifs fiscaux français (location nue, Jeanbrun, LLI, Jeanbrun + LLI en SCI, LMNP, Denormandie), les compare à un placement financier de référence, recommande le plus adapté au foyer et contre-expertise la simulation d'un vendeur.

> Outil d'aide à la décision personnelle : il ne remplace ni un notaire ni un expert-comptable. Paramètres fiscaux arrêtés au 06/10/2026.

## Avancement

| Étape | Contenu | État |
|---|---|---|
| 1 | Squelette, paramètres fiscaux sourcés, `HYPOTHESES.md`, intégration continue | livrée |
| 2 | Moteur : impôt, loyer plafond, emprunt, revenus fonciers, plus-value | livrée |
| 3 | Moteur : Jeanbrun, LLI/SCI, LMNP, Denormandie, placement de référence | livrée |
| 4 | Orchestration des scénarios, indicateurs, sensibilités | livrée |
| 5 | Recommandation et contre-expertise | livrée |
| 6 | Interface (écrans 1 à 9), exports, persistance | livrée |
| 7 | Jeu d'essai préchargé, README final | à venir |

## Installation

Prérequis : Node.js 22.12 ou plus récent (voir `.nvmrc`) et npm.

```bash
npm ci             # installe les dépendances figées
npm run dev        # lance l'application (http://localhost:5173)
npm test           # tests unitaires et garde-fous
npm run typecheck  # contrôle de types (TypeScript strict)
npm run lint       # ESLint, aucun avertissement toléré
npm run build      # contrôle de types puis construction dans dist/
```

Aucun backend, aucun compte, aucun appel réseau à l'exécution.

## Utilisation

Lancer `npm run dev` puis ouvrir http://localhost:5173. L'application s'ouvre sur un dossier vierge ; tant qu'il manque une saisie, les écrans de résultats disent laquelle et où la faire.

| Écran | Contenu |
|---|---|
| 1. Mon foyer | Statut du couple, revenu imposable (aide au calcul depuis les salaires), parts (aide selon les enfants à charge), revenus fonciers et déficits existants, niches déjà utilisées, crédits en cours, changement de revenu prévu, capacité d'épargne, apport ; impôt actuel, tranche marginale, niches disponibles et taux d'endettement en direct |
| 2. Le bien et le financement | Bien, prix, calendrier, travaux, loyers de marché, charges, prêt, frais d'exploitation ; surface prise en compte, coefficient de surface, loyers plafonds, prix TTC et pastille d'éligibilité de chaque dispositif, avec ses motifs, en direct |
| 3. Hypothèses | Trois scénarios de prix (pessimiste, central, optimiste), loyers et charges, inflation, barème, revenus, placement de référence ; bouton « Hypothèses prudentes » |
| 4. Comparaison | Scénarios × indicateurs à l'horizon choisi ; chaque indicateur se déplie jusqu'à sa formule et au tableau annuel ; scénarios inéligibles grisés avec leurs motifs ; flux cumulé après impôt, capital net par horizon, décomposition de l'avantage fiscal ; export CSV ou XLSX |
| 5. Recommandation | Curseurs d'objectifs, classement recalculé en direct ; recommandation rédigée (phrase, trois raisons chiffrées, risques, seuils de bascule) et alertes ; barèmes qualitatifs modifiables |
| 6. Détail d'un scénario | Tableau annuel complet, formule de chaque colonne en infobulle, détail des charges, revente et plus-value, sensibilités (tornado, tableau croisé, prix de revente d'équilibre, pénalité de sortie, option écartée des frais d'acquisition en LMNP) ; export CSV ou XLSX (tableau, revente, formules) |
| 7. Contre-expertise du vendeur | Saisie de la simulation remise par le vendeur ; écarts de plus de 5 %, hypothèses optimistes relevées, rejeu avec les hypothèses prudentes |
| 8. Paramètres fiscaux | Lecture filtrable de `fiscal-2026.json` : statut, date de lecture de la source, lien officiel, commentaire, arbitrage ; modification contrôlée, retour à la valeur du fichier, export du fichier modifié |
| 9. Questions à poser | Questions au vendeur, au notaire, à l'expert-comptable et à la banque, selon le scénario, les alertes, les valeurs à confirmer et la contre-expertise ; imprimables |

L'horizon de revente est commun aux écrans Comparaison, Recommandation et Détail : c'est l'horizon envisagé des objectifs, enregistré avec le dossier. Les calculs longs (recommandation complète avec ses seuils de bascule, environ 0,3 s ; sensibilités) partent après une courte pause dans la saisie ; le résultat précédent reste affiché, atténué, pendant le calcul.

Au clavier, le premier arrêt est le lien « Aller au contenu » ; les écrans sont des liens (Tab puis Entrée) ; formules et détails se déplient avec Entrée ou Espace ; au changement d'écran, le focus passe au contenu.

### Dossiers, exports et impression

- **Enregistrement automatique** dans le navigateur (`localStorage`, clés `investissement-locatif/dossiers` et `investissement-locatif/parametres`) : plusieurs dossiers nommés, que l'on crée, copie, renomme ou supprime. Un contenu illisible n'est jamais écrasé : il est copié sous une clé datée et signalé.
- **Export et import JSON** : « Exporter (JSON) » produit un fichier `*.dossier.json` (dossier, objectifs et simulation du vendeur) ; « Importer (JSON) » le relit en contrôlant chaque champ et refuse un fichier invalide en citant les champs en cause. Ces fichiers sont exclus du dépôt par le `.gitignore`.
- **Tableaux** : CSV au format français (point-virgule, virgule décimale, UTF-8 avec BOM, lisible directement par Excel) et classeur XLSX (montants et taux formatés, formules dans une feuille dédiée), produits dans le navigateur.
- **Synthèse imprimable** : « Imprimer la synthèse » ouvre l'impression du navigateur (enregistrement en PDF possible) avec le foyer, le bien, la recommandation, le classement, les indicateurs clés et les valeurs à confirmer du scénario recommandé. L'écran Questions à poser s'imprime aussi.
- **Paramètres modifiés** : ils s'appliquent à tous les dossiers du navigateur et sont signalés dans le menu. Une modification est refusée si la valeur n'a pas la forme de l'original ou si les paramètres ne passent plus la validation ; un jeu de modifications enregistré devenu invalide est ignoré en bloc, avec son motif. « Exporter fiscal-2026.json » produit le fichier complet modifié, à reporter dans le dépôt avec une source et une date de vérification à jour (indentation de deux espaces : le différentiel montre aussi la mise en forme).

## Organisation du code

```
src/
  params/          paramètres sourcés et leur validation : seul endroit où figurent taux, plafonds et dates
    fiscal-2026.json         règles fiscales, chacune avec sa source officielle
    hypotheses-defaut.json   hypothèses de marché, objectifs et barèmes de la recommandation par défaut (§5.5, §5.6, §10)
    surcharges.ts            modifications locales des paramètres (écran 8), contrôlées avant application
  engine/          moteur de calcul : fonctions pures sans effet de bord (étapes 2 à 6)
  export/          exports CSV et XLSX des tableaux du moteur, sans recalcul
  ui/              interface React (écrans, composants, état, stockage local), sans aucun calcul fiscal
tests/
  engine/          tests du moteur : valeurs du cahier des charges, exemples officiels, cas complets
    fixtures/      jeu d'essai fictif (T2 de 45 m² en zone A), ses variantes et des simulations de vendeur fictives
  export/          CSV et XLSX (archive relue, XML contrôlé)
  ui/              saisie, état, stockage local, application complète dans jsdom
  params/          validation, cohérence et modifications locales des paramètres
  garde-fous/      aucune valeur fiscale en dur, HYPOTHESES.md à jour
scripts/           outils de mise à jour annuelle des paramètres
docs/              cas de test officiels relevés lors de la vérification
```

Choix techniques : Vite 8, React 19, TypeScript 6.0 en mode strict, Vitest 5, ESLint 10 avec l'analyse typée de typescript-eslint. TypeScript est figé sur la version 6.0 : la version 7 n'expose plus l'API utilisée par typescript-eslint et par le garde-fou des valeurs en dur. Graphiques Recharts, chargés à la demande avec l'écran Comparaison ; classeurs XLSX écrits avec fflate (compression ZIP), chargé au premier export ; tests d'interface avec Testing Library et jsdom.

## Moteur de calcul

Le moteur (`src/engine/`) est fait de fonctions pures : chacune reçoit les paramètres fiscaux en argument, ce qui permet de recalculer avec des paramètres modifiés ou indexés, et retourne un objet détaillé (chaque étape intermédiaire) pour que tout indicateur puisse être déplié jusqu'à sa formule.

| Module | Rôle |
|---|---|
| `impot-revenu.ts` | Barème, quotient familial plafonné, décote, réductions sous plafond des niches ou hors plafond, système du quotient, seuil de recouvrement, revenu global et déficits globaux, impôt différentiel avec et sans l'opération, indexation du barème |
| `loyer-plafond.ts` | Surface prise en compte, coefficient de surface, plafond de loyer, loyer retenu et manque à gagner, plafonds de ressources |
| `emprunt.ts` | Tableau d'amortissement au centime, assurance, différé, annuités par année civile, indemnités de remboursement anticipé, taux d'endettement |
| `revenus-fonciers.ts` | Régime réel et ventilation du déficit, frais de gestion forfaitaires, micro-foncier, prélèvements sociaux, maintien de la location |
| `plus-value.ts` | Prix d'acquisition corrigé, abattements, impôt et prélèvements sociaux, surtaxe par cédant, surcoût de la réintégration des amortissements |
| `jeanbrun.ts` | Éligibilité, base amortissable, annuité plafonnée par foyer, prorata de la première année, limite cumulée, rupture de l'engagement et réintégration au quotient |
| `lli.ts` | Éligibilité (zones et périmètres assimilés), TVA à taux réduit, complément de TVA selon l'année de sortie, créance de taxe foncière, cumul avec le Jeanbrun |
| `sci.ts` | Frais de la SCI, répartition entre associés, variante indicative à l'IS (impôt, amortissement, plus-value, distribution) |
| `lmnp.ts` | Micro-BIC, régime réel, amortissement par composants limité au résultat et différé, déficits sur 10 ans, statut, réintégration à la revente |
| `denormandie.ts` | Éligibilité, base plafonnée, réduction étalée et prorogations, imputation sous le plafond des niches, part perdue |
| `placement-reference.ts` | Mêmes décaissements placés au rendement paramétré, fiscalité de sortie du PEA, de l'assurance-vie ou du compte-titres |
| `dossier.ts`, `calendrier.ts` | Données saisies (foyers, bien, financement, exploitation, hypothèses) et calendrier de l'opération par année civile |
| `scenario.ts` | Éligibilité et simulation année par année des scénarios S0 à S5 (dont S3 bis à l'IS) : loyers, charges, emprunt, impôt différentiel complet de chaque foyer, prélèvements sociaux, créance, flux, revente, choix du régime, placement équivalent |
| `indicateurs.ts`, `actualisation.ts` | Effort d'épargne, économie d'impôt et reprise, rendements, TRI, VAN, capital net, écarts au S0 et au placement, blocage, pénalité de sortie, endettement, prix de revente d'équilibre, tornado et tableau croisé, option écartée des frais d'acquisition en LMNP |
| `recommandation.ts` | Filtres d'éligibilité et de faisabilité, score sur 100 pondéré par les objectifs, classement, « ne pas investir » quand le placement domine, texte généré par règles (phrase, trois raisons chiffrées, risques, seuils de bascule sur le prix de revente, les revenus et l'horizon), alertes du §10.5 |
| `contre-expertise.ts` | Recalcul de la simulation du vendeur avec ses hypothèses, écarts de plus de 5 % avec ses résultats, hypothèses optimistes relevées, rejeu avec les hypothèses prudentes |
| `apercus.ts`, `series.ts` | Aperçus pendant la saisie (situation fiscale sans l'opération, loyers plafonds, éligibilité), données des graphiques de la comparaison |
| `presentation.ts` | Libellé, format et formule de chaque colonne du tableau annuel, de chaque poste de la revente et de chaque indicateur |
| `questions.ts` | Questions à poser par interlocuteur, chacune avec son motif |
| `dossier-json.ts` | Fichier `*.dossier.json` : export et relecture contrôlée, champ par champ |
| `deficits.ts`, `arrondis.ts`, `commun.ts`, `dates.ts`, `format.ts` | Stocks de déficits par millésime, arrondis, éligibilité motivée, quotes-parts, dates ISO, mise en forme des motifs |

## Paramètres fiscaux

Chaque valeur de `src/params/fiscal-2026.json` porte `valeur`, `unite`, `source`, `url_officielle`, `date_verification`, `statut` et `commentaire`. Le statut vaut :

- `verifie` : lu sur une source officielle à la date indiquée ;
- `texte_non_consulte` : règle rapportée de la loi mais non lue directement ;
- `a_confirmer` : à valider par un notaire, un expert-comptable ou par rescrit, y compris les hypothèses de modélisation que les textes ne fixent pas.

Un paramètre peut aussi porter un champ `arbitrage` (date, choix retenu, option écartée) : c'est une hypothèse choisie par l'utilisateur lorsqu'une règle admettait plusieurs lectures ou contredisait le cahier des charges. Les arbitrages sont listés dans `HYPOTHESES.md` (section 4) et signalés dans l'interface, avec leur paramètre (écran Paramètres fiscaux).

Seuls les domaines de l'État listés dans `src/params/sources-officielles.ts` sont admis comme sources. La liste des points non vérifiés, les écarts relevés avec le cahier des charges et les simplifications figurent dans [`HYPOTHESES.md`](HYPOTHESES.md).

Contrôles automatiques :

1. **À la compilation** : la structure du JSON doit correspondre exactement au typage (`src/params/types.ts`).
2. **Au chargement** : champs obligatoires, statut connu, URL sur un domaine officiel, dates valides et antérieures à la date d'arrêt, valeurs énumérées.
3. **Cohérence** (`tests/params/coherence.test.ts`) : barèmes ordonnés, totaux égaux à la somme des composantes, abattements atteignant 100 %, continuité de la surtaxe, exemples officiels reproduits.
4. **Aucune valeur en dur** (`tests/garde-fous/aucune-valeur-en-dur.test.ts`) : le code est analysé avec le compilateur TypeScript. Dans `src/engine/`, seuls les nombres 0, 1, 2, 12 et 100 sont admis. Ailleurs dans `src/`, tout taux, montant ou date identique à un paramètre fiscal est refusé, y compris dans les textes affichés (« 17,2 % », « 10 700 € »). Pour une valeur d'affichage non fiscale qui coïnciderait avec un paramètre (opacité d'un graphique par exemple), poser le commentaire `garde-fou-ignorer` sur la ligne : il reste visible en revue.
5. **HYPOTHESES.md à jour** : la liste des paramètres non vérifiés et le décompte par statut doivent correspondre au fichier.

Outils :

- `npm run params:rapport` : décompte par statut et tableau Markdown des paramètres non vérifiés ;
- `npm run params:liens` : vérifie que chaque URL officielle répond (accès réseau requis ; Légifrance, info.gouv.fr et economie.gouv.fr bloquent souvent les accès automatisés : les ouvrir dans un navigateur).

## Mise à jour annuelle des paramètres

1. Créer `src/params/fiscal-AAAA.json` à partir du fichier de l'année précédente et adapter l'import de `src/params/index.ts`.
2. Pour chaque paramètre, ouvrir `url_officielle`, relire la règle et mettre à jour `valeur`, `source` (version du BOFiP, date de la fiche), `date_verification`, `statut` et `commentaire`. Valeurs révisées chaque année : barème de l'impôt, plafond du quotient familial, décote, abattement de 10 %, plafonds de loyer et de ressources (BOI-BAREME-000017), seuils des régimes micro, taux de prélèvements sociaux, dates de fin des dispositifs. Contrôler aussi la loi de finances de l'année et les textes en discussion (section 7 de `HYPOTHESES.md`).
3. Mettre à jour la section `meta` (date d'arrêt, textes pris en compte).
4. Lancer `npm run params:liens`, `npm test` et `npm run params:rapport`, puis mettre à jour `HYPOTHESES.md` (les tests signalent tout écart).
5. Ouvrir une pull request dédiée.

## Données personnelles

Le dépôt ne contient aucune donnée personnelle : ni revenus, ni dossier de simulation, ni export. Les dossiers vivent dans le navigateur (`localStorage`) et dans des exports JSON locaux ; rien ne quitte l'ordinateur. Le `.gitignore` exclut `dossiers/`, `exports/`, `*.dossier.json`, `docs/plaquettes/` (documents du vendeur) et `.env*` : ranger les exports CSV et XLSX dans `exports/` s'ils doivent rester dans le dossier du projet.

## Limites

- Paramètres arrêtés au 06/10/2026 et vérifiés sur des sources officielles (liste dans `HYPOTHESES.md`, section 1). La loi de finances pour 2027 et le projet de loi visant la relance et la décentralisation du logement, en cours d'examen, ne sont pas pris en compte.
- Légifrance n'a pas pu être lu automatiquement. Le texte de la loi de finances pour 2026 a été lu dans sa version définitivement adoptée, publiée par l'Assemblée nationale, et ses articles 47 (Jeanbrun) et 98 (LLI) n'ont pas été censurés. Les règles marquées `texte_non_consulte` restent à relire sur Légifrance.
- Le cumul Jeanbrun + LLI n'est mentionné par aucune source officielle consultée, ni pour l'autoriser ni pour l'interdire.
- Hors périmètre ou simplifiés : SCI à l'IS (variante indicative), loueur en meublé professionnel, IFI, CEHR et CDHR, démembrement de propriété, intérêts intercalaires détaillés (différé simple), CSG déductible (option désactivée par défaut), Jeanbrun dans l'ancien, déficit foncier majoré pour travaux de rénovation énergétique, outre-mer, demi-parts particulières et frais réels, option du PFU pour le barème, sortie du LLI par cession des parts de la SCI. Détail dans `HYPOTHESES.md`, section 6.
- Les points `a_confirmer` doivent être validés par un notaire ou un expert-comptable avant toute signature.
- Les dossiers et les paramètres modifiés restent dans le navigateur où ils ont été saisis : exporter le dossier en JSON pour le conserver ou changer d'ordinateur. Vider les données du site efface les dossiers non exportés.

## Conventions

- Une branche et une pull request par étape ; relecture avant fusion.
- Commits courts, en français, un sujet par commit.
- `HYPOTHESES.md` et ce README sont mis à jour dans la même pull request que le code concerné.
- L'intégration continue (GitHub Actions) lance `npm ci`, le contrôle de types, le lint, les tests et la construction à chaque pull request.
