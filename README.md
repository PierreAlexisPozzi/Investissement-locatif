# Investissement locatif — aide à la décision

Application web locale qui simule un investissement locatif sous plusieurs dispositifs fiscaux français (location nue, Jeanbrun, LLI, Jeanbrun + LLI en SCI, LMNP, Denormandie), les compare à un placement financier de référence, recommande le plus adapté au foyer et contre-expertise la simulation d'un vendeur.

> Outil d'aide à la décision personnelle : il ne remplace ni un notaire ni un expert-comptable. Paramètres fiscaux arrêtés au 06/10/2026.

## Avancement

| Étape | Contenu | État |
|---|---|---|
| 1 | Squelette, paramètres fiscaux sourcés, `HYPOTHESES.md`, intégration continue | livrée |
| 2 | Moteur : impôt, loyer plafond, emprunt, revenus fonciers, plus-value | livrée |
| 3 | Moteur : Jeanbrun, LLI/SCI, LMNP, Denormandie, placement de référence | livrée |
| 4 | Orchestration des scénarios, indicateurs, sensibilités | à venir |
| 5 | Recommandation et contre-expertise | à venir |
| 6 | Interface (écrans 1 à 9), exports, persistance | à venir |
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

## Organisation du code

```
src/
  params/          paramètres sourcés et leur validation : seul endroit où figurent taux, plafonds et dates
    fiscal-2026.json         règles fiscales, chacune avec sa source officielle
    hypotheses-defaut.json   hypothèses de marché par défaut (§5.5)
  engine/          moteur de calcul : fonctions pures sans effet de bord (étapes 2 à 5)
  ui/              interface React, sans aucun calcul fiscal (étape 6)
tests/
  engine/          tests du moteur : valeurs du cahier des charges et exemples officiels
  params/          validation et cohérence des paramètres
  garde-fous/      aucune valeur fiscale en dur, HYPOTHESES.md à jour
scripts/           outils de mise à jour annuelle des paramètres
docs/              cas de test officiels relevés lors de la vérification
```

Choix techniques : Vite 8, React 19, TypeScript 6.0 en mode strict, Vitest 5, ESLint 10 avec l'analyse typée de typescript-eslint. TypeScript est figé sur la version 6.0 : la version 7 n'expose plus l'API utilisée par typescript-eslint et par le garde-fou des valeurs en dur. Recharts sera ajouté avec l'interface (étape 6).

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
| `deficits.ts`, `arrondis.ts`, `commun.ts`, `dates.ts`, `format.ts` | Stocks de déficits par millésime, arrondis, éligibilité motivée, quotes-parts, dates ISO, mise en forme des motifs |

L'orchestration des scénarios, les indicateurs, la recommandation et la contre-expertise arrivent aux étapes 4 et 5.

## Paramètres fiscaux

Chaque valeur de `src/params/fiscal-2026.json` porte `valeur`, `unite`, `source`, `url_officielle`, `date_verification`, `statut` et `commentaire`. Le statut vaut :

- `verifie` : lu sur une source officielle à la date indiquée ;
- `texte_non_consulte` : règle rapportée de la loi mais non lue directement ;
- `a_confirmer` : à valider par un notaire, un expert-comptable ou par rescrit, y compris les hypothèses de modélisation que les textes ne fixent pas.

Un paramètre peut aussi porter un champ `arbitrage` (date, choix retenu, option écartée) : c'est une hypothèse choisie par l'utilisateur lorsqu'une règle admettait plusieurs lectures ou contredisait le cahier des charges. Les arbitrages sont listés dans `HYPOTHESES.md` (section 4) et seront signalés dans l'interface.

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

Le dépôt ne contient aucune donnée personnelle : ni revenus, ni dossier de simulation, ni export. Les dossiers vivront dans le navigateur (`localStorage`) et dans des exports JSON locaux (étape 6). Le `.gitignore` exclut `dossiers/`, `exports/`, `*.dossier.json`, `docs/plaquettes/` (documents du vendeur) et `.env*`.

## Limites

- Paramètres arrêtés au 06/10/2026 et vérifiés sur des sources officielles (liste dans `HYPOTHESES.md`, section 1). La loi de finances pour 2027 et le projet de loi visant la relance et la décentralisation du logement, en cours d'examen, ne sont pas pris en compte.
- Légifrance n'a pas pu être lu automatiquement. Le texte de la loi de finances pour 2026 a été lu dans sa version définitivement adoptée, publiée par l'Assemblée nationale, et ses articles 47 (Jeanbrun) et 98 (LLI) n'ont pas été censurés. Les règles marquées `texte_non_consulte` restent à relire sur Légifrance.
- Le cumul Jeanbrun + LLI n'est mentionné par aucune source officielle consultée, ni pour l'autoriser ni pour l'interdire.
- Hors périmètre ou simplifiés : SCI à l'IS (variante indicative), loueur en meublé professionnel, IFI, CEHR et CDHR, démembrement de propriété, intérêts intercalaires détaillés (différé simple), CSG déductible (option désactivée par défaut), Jeanbrun dans l'ancien, déficit foncier majoré pour travaux de rénovation énergétique, outre-mer, demi-parts particulières et frais réels, option du PFU pour le barème, sortie du LLI par cession des parts de la SCI. Détail dans `HYPOTHESES.md`, section 6.
- Les points `a_confirmer` doivent être validés par un notaire ou un expert-comptable avant toute signature.

## Conventions

- Une branche et une pull request par étape ; relecture avant fusion.
- Commits courts, en français, un sujet par commit.
- `HYPOTHESES.md` et ce README sont mis à jour dans la même pull request que le code concerné.
- L'intégration continue (GitHub Actions) lance `npm ci`, le contrôle de types, le lint, les tests et la construction à chaque pull request.
