# Guide d'installation — pour l'assistant IA qui installe la machine

> Tu es un assistant de code (Claude Code, Codex, Cursor…) et l'utilisateur t'a demandé d'installer la machine **POV** (« Your Life as Every Rank in … ») dans son Agent OS. Suis ces étapes dans l'ordre, vérifie chaque résultat, et rends compte à l'utilisateur en français, simplement. Ne saute aucune vérification.

## Règles

- **Ne touche à aucun secret.** Les clés API vivent dans le coffre chiffré d'Agent OS (`agent-os/data/`, gitignoré). Ne les lis pas, ne les écris jamais dans un fichier, ne les affiche pas. Si une clé manque, dis à l'utilisateur laquelle ajouter dans Paramètres → Coffre.
- **Ne remplace pas le socle.** Les modules `agent-os/lib/*.js` existants (store, claude, vault, fal, ffmpeg, google, tasks, spend, bank, scrap…) appartiennent à l'OS de l'utilisateur. Ce dépôt ne fournit que les fichiers de la machine ; `if-missing/` (le bouton d'abonnement `StickmanCta.tsx`) n'est copié que s'il est absent.
- **Ne redémarre jamais Agent OS pendant qu'un run tourne** (une autre machine peut être en train de générer : ça tue la génération en mémoire). Demande avant de redémarrer.
- **Ne commit rien** chez l'utilisateur sans qu'il le demande.

## 1. Repérer l'Agent OS

La racine est le dossier qui contient **`agent-os/`** et **`remotion/`**. Vérifie :

```bash
ls <racine>/agent-os/server.js <racine>/agent-os/public/index.html <racine>/agent-os/public/js/core.js \
   <racine>/agent-os/public/js/pages/machines.js <racine>/remotion/src/Root.tsx
```

Les 5 fichiers doivent exister. Sinon, demande à l'utilisateur où est son Agent OS.

Prérequis à vérifier : `node -v` (≥ 18), `ffmpeg -version` et `ffprobe -version` (dans le PATH), `ls <racine>/remotion/node_modules/remotion` (Remotion installé ; sinon `cd remotion && npm install`).

## 2. Récupérer le dépôt et simuler

```bash
git clone https://github.com/Alex-sia99/pov-machine
cd pov-machine
node install.js <racine> --dry
```

La simulation liste ce qui serait copié et branché, sans rien écrire. Lis la sortie : `✓` = sera fait, `·` = déjà présent, `⚠` = ancre introuvable (à faire à la main, section 5).

## 3. Installer

```bash
node install.js <racine>
```

Relance-le une seconde fois : il doit n'afficher **aucune** ligne `✓` (installation idempotente). Chaque fichier modifié a une sauvegarde `<fichier>.bak-pov`.

## 4. Vérifier

```bash
cd <racine>/agent-os
node --check server.js && node --check public/js/core.js && node --check public/js/pages/machines.js \
  && node --check public/js/pages/pov.js && node --check lib/machines/pov.js && echo SYNTAXE OK
node -e "const p=require('./lib/machines/pov'); console.log('module OK', typeof p.createRun, JSON.stringify(p.estimate({durationMin:25,levels:10})))"
cd ../remotion && npx remotion compositions      # PovPyramid et StickmanCta doivent apparaître
```

L'estimation doit rendre `{"words":3750,"shots":267,"levels":10,"images":5.56,"voice":1.524,"total":7.08}` (avec les réglages par défaut).

Puis, **après accord de l'utilisateur**, redémarre Agent OS (`cd agent-os && npm start`) et teste (remplace le port par celui de son OS, affiché au démarrage, souvent 4200 ou 4100) :

```bash
curl -s localhost:<port>/api/machines/pov | head -c 300             # la config + les voix
curl -s -X POST -H "Content-Type: application/json" -d '{"durationMin":25,"levels":10}' localhost:<port>/api/machines/pov/estimate
curl -s localhost:<port>/api/machines | grep -o '"pov"'              # la machine est listée
```

Dans le navigateur : **Machines → 🔺 POV** s'ouvre sur l'onglet ⚙ Générer.

## 5. Installation manuelle (seulement pour les lignes `⚠`)

Fais uniquement les points signalés par l'installateur. Adapte au style du fichier.

**server.js — require** (en haut, avec les autres machines) :
```js
const pov = require("./lib/machines/pov");
```

**server.js — table des machines** : ajouter `pov` à l'objet `const MACHINES = { … }`.

**server.js — hub** : dans la route `GET /api/machines`, ajouter `card(pov)` à la liste renvoyée.

**server.js — routes génériques** : dans les regex du type `/^\/api\/machines\/(timetravel|linguistique|…)\/stock$/` (stock, publish, order-info, ideas), ajouter `|pov` dans la liste.

**server.js — routes de la machine** : coller tout le contenu de `server-routes.snippet.js` dans le routeur, à côté des blocs des autres machines (même niveau d'indentation, là où `p`, `req`, `res`, `m`, `url`, `json()` et `readBody()` existent).

**server.js — boot (facultatif)** : si une ligne `const stale = a.sweepRuns() + …;` existe, y ajouter `+ (pov.sweepRuns() || 0)` ; si un tableau `[...x.strandedRuns(), …]` existe (cron de sauvetage Telegram), y ajouter `...pov.strandedRuns()`.

**server.js — manifeste des agents (facultatif)** : si une liste `machines: [ { id: …, name: …, api: … }, … ]` existe, y ajouter `{ id: "pov", name: "POV", api: "/api/machines/pov" }`.

**public/index.html** : avant la ligne `<script src="js/pages/machines.js"></script>` :
```html
<script src="js/pages/pov.js"></script>
```

**public/js/core.js** : dans le tableau `["timetravel", …].includes(name) ? "machines" : name`, ajouter `"pov"`.

**public/js/pages/machines.js** : ajouter une carte dans la grille du hub (et `"#/pov": "pov-tab"` dans `TAB_KEYS` si cet objet existe) :
```html
<a class="bank-folder" href="#/pov" style="text-decoration:none;color:inherit">
  <div style="font-size:34px">🔺</div>
  <b>POV</b>
  <div class="small muted" style="margin-top:4px">« Your Life as Every Rank in… » — Claude (outline + 10 niveaux) → Inworld TTS + Whisper → images 2D i2i → pyramide Remotion → FFmpeg (sous-titres · CTA)</div>
</a>
```

**remotion/src/Root.tsx** : ajouter les imports puis les deux compositions dans le fragment `<>…</>` (si `StickmanCta` existe déjà — machine Stickman installée — ne l'ajoute pas deux fois) :
```tsx
import { PovPyramid, povPyramidSchema, FPS as POV_FPS } from "./PovPyramid";
import { StickmanCta, stickmanCtaSchema, FPS as SK_FPS } from "./StickmanCta";

// dans le fragment :
<Composition id="StickmanCta" component={StickmanCta} durationInFrames={SK_FPS * 5} fps={SK_FPS} width={1920} height={1080}
  schema={stickmanCtaSchema} defaultProps={{ label: "SUBSCRIBE", labelDone: "SUBSCRIBED", channel: "POV Rank" }} />
<Composition id="PovPyramid" component={PovPyramid} durationInFrames={POV_FPS * 3} fps={POV_FPS} width={1920} height={1080}
  schema={povPyramidSchema}
  defaultProps={{ dir: "pov-demo", cards: ["", "", "", "", "", "", "", "", "", ""], level: 3, label: "Level 3", seconds: 3 }}
  calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, Math.round(props.seconds * POV_FPS)) })} />
```
Une composition cassée casse tout le bundle Remotion (et donc le rendu des autres machines) : revérifie `npx remotion compositions` après toute modification de `Root.tsx`.

## 6. Clés et connexions à demander à l'utilisateur

| Clé du coffre | Service | Sert à | Obligatoire |
|---|---|---|---|
| `kie` | Kie.ai | référence du protagoniste, cartes de la pyramide, images de scène, miniature (Grok Imagine 2 par défaut ; Nano Banana 2 Lite, Seedream 5 Lite ou GPT Image 2 au choix) | oui |
| `fal` | FAL.ai | voix off Inworld TTS (par niveau), transcription Whisper mot à mot | oui |
| OAuth Google Drive | Google | **obligatoire** : la référence du protagoniste et la voix sont envoyées sur Drive en lecture publique pour être lues par Kie (i2i) et FAL (Whisper) | oui |
| chaîne YouTube connectée | YouTube | bouton 📤 Publier / publication automatique | non |
| Claude Code connecté | Claude CLI | outline, niveaux, prompts d'images, packaging (le moteur de texte de la machine) | oui |

Le texte est écrit par le Claude CLI déjà connecté à l'Agent OS : aucune clé supplémentaire. La machine **n'envoie rien vers un serveur distant** : la vidéo finale reste sur le disque (`agent-os/output/machines/<runId>/final.mp4`) et peut être publiée sur YouTube depuis l'onglet Fini ou le Stock.

Facultatif mais recommandé : une niche « POV » dans la Banque de niches (chaîne POVrank scrappée par le Scrap-o-matic). La machine la retrouve par son nom (ou dans 🛠 Paramètres → Banque de niche liée) et s'en sert pour le bouton 💡 (idées), le code des titres/descriptions et les miniatures concurrentes comme références de style. Sans elle, tout fonctionne en mode générique.

## 7. Premier essai conseillé

Proposer à l'utilisateur un run court en **Semi-manuel** pour valider la chaîne complète (~0,90 $, 15-20 min) : sujet « the French Foreign Legion », **durée 3 min**, **4 niveaux**. Chaque étape (script, voix, images) s'arrête pour relecture avant de continuer ; les niveaux et chaque image sont éditables / régénérables individuellement.

Au premier montage, la machine génère le présentateur du CTA (asset partagé, 0,02 $) ; il se régénère depuis 🛠 Paramètres.

La vidéo sort dans `agent-os/output/machines/<runId>/final.mp4` et apparaît dans l'onglet 📦 Stock avec sa miniature, son titre, sa description et ses tags.

## Dépannage

| Symptôme | Cause | Remède |
|---|---|---|
| `Clé Kie absente du coffre` / `Clé FAL absente` | Clé manquante | Ajouter `kie` / `fal` dans Paramètres → Coffre. |
| Erreur d'upload Drive / `Google Drive non connecté` | La référence et la voix doivent être lisibles par une URL publique | Connecter Google Drive dans Paramètres → Connexions. |
| Une image reste « refusée » puis est remplacée | Kie a refusé le prompt (modération) | Normal : la machine réécrit le prompt en version implicite (jusqu'à 3 fois) et repart aussitôt. Si l'image manque encore, bouton ↻ sur le plan. |
| `Remotion n'a produit aucun fichier` / pyramide absente | Composition absente ou bundle cassé | `cd remotion && npx remotion compositions` ; corriger `Root.tsx`. |
| Sous-titres sans la bonne police | Police « Comic Sans MS » absente (Linux/macOS) | Remplacer `FontName=` dans `lib/machines/pov.js` par une police arrondie installée. |
| La page POV reste blanche | Script non chargé | Vérifier la ligne `js/pages/pov.js` dans `index.html`, vider le cache (Ctrl+F5). |
| Run figé à `*_running` après un redémarrage | Génération interrompue | Au boot, `sweepRuns` le remet en `*_ready` ; sinon bouton ⚡ Reprendre dans le run. |
| La voix a une durée différente de la cible | Débit de la voix choisie | La niche est calée à ~150 mots/min ; changer de voix Inworld ou ajuster la durée. |

## Désinstaller

Restaurer les sauvegardes : pour chaque `<fichier>.bak-pov`, remettre le `.bak` à la place du fichier ; supprimer `agent-os/lib/machines/pov.js`, `agent-os/lib/machines/pov.export.json`, `agent-os/public/js/pages/pov.js`, `agent-os/docs/RECETTE-NICHE-POV.md`, `remotion/src/PovPyramid.tsx` (et `remotion/src/StickmanCta.tsx` seulement s'il a été copié par cet installateur, c'est-à-dire si la machine Stickman n'est pas installée). Les runs sont dans `agent-os/data/machines/runs/pov/`, les vidéos dans `agent-os/output/machines/p*/`, le présentateur dans `agent-os/output/machines/pov-assets/`.
