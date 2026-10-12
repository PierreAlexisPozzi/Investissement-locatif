# Investissement locatif — aide à la décision

Application web, utilisable sur téléphone comme sur ordinateur, qui simule un investissement locatif sous plusieurs dispositifs fiscaux français (location nue, Jeanbrun, LLI, Jeanbrun + LLI en SCI, LMNP, Denormandie), les compare à un placement financier de référence, recommande le plus adapté au foyer et contre-expertise la simulation d'un vendeur.

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
| 7 | Jeu d'essai préchargé, README final | livrée |
| Suite | Affichage sur téléphone, application installable et hors connexion, mise en ligne | en relecture |

## Utiliser l'application en ligne (téléphone et ordinateur)

L'application est un site statique : une fois construite (`dist/`), n'importe quel hébergeur de fichiers statiques la sert, sans serveur applicatif ni base de données. Les calculs et les dossiers restent dans le navigateur de chaque appareil.

### Mise en ligne, une fois (Cloudflare Pages, offre gratuite)

1. Créer un compte sur https://dash.cloudflare.com.
2. **Workers & Pages** > **Create application** > **Pages** > **Connect to Git** (Cloudflare oriente aussi vers « Workers » : choisir Pages). Autoriser l'application GitHub de Cloudflare sur ce seul dépôt (*Only select repositories*) : le dépôt reste privé.
3. Réglages de construction : branche de production `main`, préréglage **React (Vite)** ou aucun, commande `npm run build`, dossier de sortie `dist`. La version de Node est lue dans `.nvmrc` ; aucune variable d'environnement, aucun secret.
4. **Save and Deploy** : le site est publié sous `https://<nom-du-projet>.pages.dev`.

Ensuite, chaque fusion dans `main` republie le site. Chaque branche poussée reçoit sa propre adresse d'aperçu : une pull request peut être essayée sur le téléphone avant sa fusion. Une adresse d'aperçu a ses propres données : saisir ses dossiers sur l'adresse de production seulement.

Offre gratuite : 500 constructions par mois et 20 000 fichiers par site, très au-delà des besoins (une construction par fusion, une vingtaine de fichiers).

Autres hébergeurs possibles, avec les mêmes réglages (commande `npm run build`, dossier `dist`) : Netlify ou Vercel, gratuits avec un dépôt privé. GitHub Pages demande l'abonnement GitHub Pro pour un dépôt privé, et le site publié reste public. Les chemins relatifs de la construction permettent l'hébergement à la racine d'un domaine comme dans un sous-dossier.

### Qui peut ouvrir l'adresse

Le site publié ne contient que le code, les paramètres fiscaux (publics) et le jeu d'essai fictif ; aucune saisie ne lui est envoyée. Quiconque connaît l'adresse peut toutefois utiliser l'outil. Pour la réserver à soi, Cloudflare Access (offre Zero Trust) demande un code reçu par e-mail avant d'ouvrir le site : la procédure pour l'adresse `*.pages.dev`, et pas seulement les aperçus, est décrite dans les [problèmes connus de Cloudflare Pages](https://developers.cloudflare.com/pages/platform/known-issues/) (section *Enable Access on your `*.pages.dev` domain*). Le code est redemandé à l'expiration de la session.

### Installer l'application sur l'écran d'accueil

- **iPhone ou iPad** : ouvrir l'adresse dans Safari > bouton Partager > **Sur l'écran d'accueil**.
- **Android** : ouvrir l'adresse dans Chrome > menu ⋮ > **Installer l'application** (ou **Ajouter à l'écran d'accueil**).
- **Ordinateur** : dans Chrome ou Edge, icône d'installation à droite de la barre d'adresse ; ou simplement un favori.

L'application s'ouvre alors en plein écran, comme une application, et fonctionne sans connexion : tous ses fichiers sont gardés en cache à la première ouverture. En ligne, la dernière version publiée s'affiche ; si le réseau ne répond pas sous 3 secondes, la version en cache s'ouvre. Une fois installée, elle demande au navigateur de ne pas effacer ses données quand l'espace manque.

Sur iPhone, l'installation sur l'écran d'accueil compte aussi pour les données : dans Safari, un site non visité pendant sept jours d'utilisation de Safari voit ses données effacées, dossiers compris ; une application de l'écran d'accueil a son propre décompte, fondé sur ses jours d'utilisation, et WebKit n'y prévoit pas d'effacement.

### Passer d'un appareil à l'autre

Chaque appareil, et chaque navigateur, garde ses propres dossiers : il n'y a pas de synchronisation. Pour reprendre un dossier ailleurs : « Exporter (JSON) » sur le premier appareil, transmettre le fichier `*.dossier.json` par un canal privé (AirDrop, Quick Share, son propre stockage en ligne), puis « Importer (JSON) » sur le second. Le fichier contient les revenus du foyer : ne pas le déposer dans le dépôt (le `.gitignore` l'exclut) ni le partager.

## Installation locale (développement)

Prérequis : Node.js 22.12 ou plus récent (voir `.nvmrc`) et npm.

```bash
npm ci             # installe les dépendances figées
npm run dev        # lance l'application (http://localhost:5173)
npm test           # tests unitaires et garde-fous
npm run typecheck  # contrôle de types (TypeScript strict)
npm run lint       # ESLint, aucun avertissement toléré
npm run build      # contrôle de types puis construction dans dist/
```

Aucun backend, aucun compte, aucun appel réseau à l'exécution en dehors du chargement de l'application elle-même. Le service worker n'est actif que dans la version construite (`npm run build` puis `npm run preview` pour l'essayer en local).

## Utilisation

Ouvrir l'adresse du site (ou lancer `npm run dev` puis ouvrir http://localhost:5173). Au premier lancement, l'application s'ouvre sur le jeu d'essai fictif (voir plus bas) ; « Nouveau » crée un dossier vierge. Tant qu'il manque une saisie, les écrans de résultats disent laquelle et où la faire.

| Écran | Contenu |
|---|---|
| 1. Mon foyer | Statut du couple, revenu imposable (aide au calcul depuis les salaires), parts (aide selon les enfants à charge), revenus fonciers et déficits existants, niches déjà utilisées, crédits en cours, changement de revenu prévu, capacité d'épargne, apport ; revenu imposé, impôt actuel (revenus fonciers des autres biens compris), tranche marginale, niches disponibles et taux d'endettement en direct |
| 2. Le bien et le financement | Bien, prix, calendrier, travaux, loyers de marché, charges, prêt, frais d'exploitation ; surface prise en compte, coefficient de surface, loyers plafonds, prix TTC et pastille d'éligibilité de chaque dispositif, avec ses motifs, en direct |
| 3. Hypothèses | Trois scénarios de prix (pessimiste, central, optimiste), loyers et charges, inflation, barème, revenus, placement de référence ; bouton « Hypothèses prudentes » |
| 4. Comparaison | Scénarios × indicateurs à l'horizon choisi ; chaque indicateur se déplie jusqu'à sa formule et au tableau annuel ; scénarios inéligibles grisés avec leurs motifs ; flux cumulé après impôt, capital net par horizon, décomposition de l'avantage fiscal ; export CSV ou XLSX |
| 5. Recommandation | Curseurs d'objectifs, classement recalculé en direct (valeur, note et points de chaque critère) ; recommandation rédigée (phrase, trois raisons chiffrées, risques, seuils de bascule) et alertes ; barèmes qualitatifs modifiables |
| 6. Détail d'un scénario | Tableau annuel complet, formule de chaque colonne en infobulle, détail des charges, revente et plus-value, sensibilités (tornado, tableau croisé, prix de revente d'équilibre, pénalité de sortie, option écartée des frais d'acquisition en LMNP) ; export CSV ou XLSX (tableau, revente, formules) |
| 7. Contre-expertise du vendeur | Saisie de la simulation remise par le vendeur ; écarts de plus de 5 %, hypothèses optimistes relevées, rejeu avec les hypothèses prudentes |
| 8. Paramètres fiscaux | Lecture filtrable de `fiscal-2026.json` : statut, date de lecture de la source, lien officiel, commentaire, arbitrage ; modification contrôlée, propre au dossier ouvert, retour à la valeur du fichier, export du fichier modifié |
| 9. Questions à poser | Questions au vendeur, au notaire, à l'expert-comptable et à la banque, selon le scénario, les alertes, les valeurs à confirmer et la contre-expertise ; imprimables |

L'horizon de revente est commun aux écrans Comparaison, Recommandation et Détail : c'est l'horizon envisagé des objectifs, enregistré avec le dossier. Les calculs longs (recommandation complète avec ses seuils de bascule, environ 0,3 s ; sensibilités) partent après une courte pause dans la saisie ; le résultat précédent reste affiché, atténué, pendant le calcul.

Sur un écran étroit, les écrans tiennent sur une ligne qui défile horizontalement, les tableaux larges défilent dans leur cadre et une formule s'affiche en bas de l'écran, avec un bouton « Fermer ».

Au clavier, le premier arrêt est le lien « Aller au contenu » ; les écrans sont des liens (Tab puis Entrée) ; formules et détails se déplient avec Entrée ou Espace ; au changement d'écran, le focus passe au contenu.

### Jeu d'essai

Le cas type du cahier des charges (§14) est préchargé au premier lancement, quand le navigateur n'a encore aucun dossier :

- **Bien** : T2 de 45 m² en zone A, acheté 250 000 € HT en VEFA (signature le 15/11/2026, livraison le 30/06/2028, location à partir du 01/09/2028), financé par un prêt de 250 000 € sur 25 ans.
- **Foyer** : couple marié, 90 000 € de revenu imposable, 2 parts.
- **Hypothèses** : valeurs par défaut, scénario de prix central.
- **Simulation du vendeur** : volontairement optimiste, pour l'écran Contre-expertise.

Toutes ses valeurs sont fictives. « Charger le jeu d'essai » l'ajoute à tout moment comme nouveau dossier.

Il est versionné dans `src/jeu-essai/cas-type.json`, au format d'un export de dossier : « Importer (JSON) » le lit aussi. C'est le cas type des tests de non-régression. Avec les paramètres arrêtés au 06/10/2026 :

- impôt actuel de 13 208 € (§13) ;
- classement Jeanbrun + LLI, Jeanbrun, location nue, LMNP ;
- recommandation de ne pas investir, le placement de référence l'emportant à 16 ans.

Le modifier change ces tests : le faire en connaissance de cause.

### Dossiers, exports et impression

- **Enregistrement automatique** dans le navigateur (`localStorage`, clés `investissement-locatif/dossiers` et `investissement-locatif/dossier-courant`, le dernier dossier ouvert) : plusieurs dossiers nommés, que l'on crée, copie, renomme ou supprime. Un contenu illisible n'est jamais écrasé : il est copié sous une clé datée et signalé. Avec deux onglets ouverts, un enregistrement fait dans l'un est rechargé dans l'autre, qui garde son dossier ouvert.
- **Export et import JSON** : « Exporter (JSON) » produit un fichier `*.dossier.json` (dossier, objectifs, simulation du vendeur et paramètres modifiés) ; « Importer (JSON) » le relit en contrôlant chaque champ et refuse un fichier invalide en citant les champs en cause. Ces fichiers sont exclus du dépôt par le `.gitignore`.
- **Tableaux** : CSV au format français (point-virgule, virgule décimale, UTF-8 avec BOM, lisible directement par Excel) et classeur XLSX (montants et taux formatés, formules dans une feuille dédiée), produits dans le navigateur.
- **Synthèse imprimable** : « Imprimer la synthèse » ouvre l'impression du navigateur (enregistrement en PDF possible) avec le foyer, le bien, la recommandation, le classement, les indicateurs clés et les valeurs à confirmer du scénario recommandé. L'écran Questions à poser s'imprime aussi.
- **Paramètres modifiés** : chaque dossier a sa propre version des paramètres. Une modification ne vaut que pour le dossier ouvert, est enregistrée avec lui (export JSON compris) et signalée dans le menu et dans la synthèse ; un nouveau dossier part du fichier versionné, une copie reprend les modifications de l'original. Une modification est refusée si la valeur n'a pas la forme de l'original ou si les paramètres ne passent plus la validation (domaine compris : un taux s'écrit entre 0 et 1, le barème reste ordonné) ; un jeu de modifications enregistré devenu invalide est ignoré en bloc, avec son motif. « Exporter fiscal-2026.json » produit le fichier complet modifié, à reporter dans le dépôt avec une source et une date de vérification à jour (indentation de deux espaces : le différentiel montre aussi la mise en forme).

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
  jeu-essai/       cas type fictif préchargé (§14), au format d'un export de dossier
public/            manifeste et icônes de l'application installable, copiés tels quels dans dist/
pwa/               service worker : modèle et plugin de construction qui y inscrit les fichiers de la version
tests/
  engine/          tests du moteur : valeurs du cahier des charges, exemples officiels, cas complets
    fixtures/      cas type (relu dans src/jeu-essai), ses variantes et une simulation de vendeur prudente
  jeu-essai/       conformité du cas type préchargé au cahier des charges
  export/          CSV et XLSX (archive relue, XML contrôlé)
  ui/              saisie, état, stockage local, application complète dans jsdom
  params/          validation, cohérence et modifications locales des paramètres
  garde-fous/      aucune valeur fiscale en dur, HYPOTHESES.md à jour
  pwa/             service worker généré, manifeste et icônes
scripts/           outils de mise à jour annuelle des paramètres
docs/              cas de test officiels relevés lors de la vérification
```

Choix techniques : Vite 8, React 19, TypeScript 6.0 en mode strict, Vitest 5, ESLint 10 avec l'analyse typée de typescript-eslint. TypeScript est figé sur la version 6.0 : la version 7 n'expose plus l'API utilisée par typescript-eslint et par le garde-fou des valeurs en dur. Graphiques Recharts, chargés à la demande avec l'écran Comparaison ; classeurs XLSX écrits avec fflate (compression ZIP), chargé au premier export ; tests d'interface avec Testing Library et jsdom. Service worker écrit à la main (une cinquantaine de lignes, sans dépendance) : le plugin `pwa/plugin-service-worker.ts` y inscrit à la construction la liste des fichiers et une version tirée de leur contenu, si bien que chaque publication installe une nouvelle version complète et supprime l'ancienne.

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
4. Lancer `npm run params:liens`, `npm test` et `npm run params:rapport`, puis mettre à jour `HYPOTHESES.md` (les tests signalent tout écart). Un changement du classement ou de la recommandation du jeu d'essai (`tests/engine/recommandation.test.ts`) doit s'expliquer par les nouvelles valeurs avant d'être reporté dans le test ; si les dates du jeu d'essai sont passées, les décaler d'un an dans `src/jeu-essai/cas-type.json`.
5. Ouvrir une pull request dédiée.

## Données personnelles

Le dépôt ne contient aucune donnée personnelle : ni revenus, ni dossier de simulation, ni export. Le jeu d'essai versionné (`src/jeu-essai/cas-type.json`) est fictif ; son nom évite l'extension `.dossier.json`, exclue du dépôt. Les dossiers vivent dans le navigateur (`localStorage`) et dans des exports JSON locaux ; rien ne quitte l'appareil, y compris quand l'application est utilisée en ligne : le site hébergé ne fait que servir le code, aucune saisie ne lui est envoyée. Le `.gitignore` exclut `dossiers/`, `exports/`, `*.dossier.json`, `docs/plaquettes/` (documents du vendeur) et `.env*` : ranger les exports CSV et XLSX dans `exports/` s'ils doivent rester dans le dossier du projet.

## Limites

- Paramètres arrêtés au 06/10/2026 et vérifiés sur des sources officielles (liste dans `HYPOTHESES.md`, section 1). La loi de finances pour 2027 et le projet de loi visant la relance et la décentralisation du logement, en cours d'examen, ne sont pas pris en compte.
- Légifrance n'a pas pu être lu automatiquement. Le texte de la loi de finances pour 2026 a été lu dans sa version définitivement adoptée, publiée par l'Assemblée nationale, et ses articles 47 (Jeanbrun) et 98 (LLI) n'ont pas été censurés. Les règles marquées `texte_non_consulte` restent à relire sur Légifrance.
- Le cumul Jeanbrun + LLI n'est mentionné par aucune source officielle consultée, ni pour l'autoriser ni pour l'interdire.
- Hors périmètre ou simplifiés : SCI à l'IS (variante indicative), loueur en meublé professionnel, IFI, CEHR et CDHR, démembrement de propriété, intérêts intercalaires détaillés (différé simple), CSG déductible (option désactivée par défaut), Jeanbrun dans l'ancien, déficit foncier majoré pour travaux de rénovation énergétique, outre-mer, demi-parts particulières et frais réels, option du PFU pour le barème, sortie du LLI par cession des parts de la SCI. Détail dans `HYPOTHESES.md`, section 6.
- Les points `a_confirmer` doivent être validés par un notaire ou un expert-comptable avant toute signature.
- Les dossiers, avec leurs paramètres modifiés, restent dans le navigateur où ils ont été saisis, sans synchronisation entre appareils : exporter le dossier en JSON pour le conserver ou changer d'appareil. Vider les données du site efface les dossiers non exportés ; sur iPhone, Safari les efface aussi après sept jours d'utilisation sans visite du site, sauf pour l'application installée sur l'écran d'accueil.

## Conventions

- Une branche et une pull request par étape ; relecture avant fusion.
- Commits courts, en français, un sujet par commit.
- `HYPOTHESES.md` et ce README sont mis à jour dans la même pull request que le code concerné.
- L'intégration continue (GitHub Actions) lance `npm ci`, le contrôle de types, le lint, les tests et la construction à chaque pull request.
