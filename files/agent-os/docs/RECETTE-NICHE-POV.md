# Recette de niche — POV (« Your Life as Every Rank in … »)

Source : chaîne **POVrank** (`UC3EpqIjfEUiZi1GvWKCWyuA`, 42,8 k abonnés, 111 vidéos), les **24 dernières vidéos** scrappées dans le Scrap-o-matic (Apify : métadonnées + transcript + vision Gemini, 24/24), sous-titres horodatés yt-dlp des 24, et **décorticage image par image** de 2 vidéos (327 k et 238 k vues : Corée du Nord, Cartel mexicain) + planches-contact des 24 miniatures. Fichiers de travail : `agent-os/output/pov-lab/` (vidéos, frames, zooms, transcripts `.txt`). Niche « POV » dans la banque (`nmt4sghsx`).

## 1. Le format en une phrase

Un **documentaire dramatisé à la 2ᵉ personne** : « tu » entres au bas d'une hiérarchie à 13-18 ans et tu la montes **niveau par niveau jusqu'au sommet** (10 niveaux), chaque niveau = un chapitre de ta vie à un âge précis, jusqu'à une chute ou une conclusion désabusée. Narration calme et clinique, dessin 2D propre, une image toutes les ~5 s, sous-titres incrustés, pyramide de rangs affichée à chaque changement de niveau.

## 2. Chiffres qui pilotent la machine (mesurés sur les 24 vidéos)

| Mesure | Valeur |
|---|---|
| Durée | 23:39 → 27:26, **médiane ~25 min** |
| Mots | 3 540 → 4 250, **~3 800 mots** |
| Débit | 140-171, **~150 mots/min** (plus lent que Stickman : 165) |
| Niveaux | **10**, systématiquement (« Level one … Level 10 »), même pour le thème non-militaire (richesse : *struggling poor → trillionaire*) |
| Durée d'un niveau | **~2 min 20** (≈ 350-400 mots), le 10ᵉ un peu plus long (épilogue) |
| CTA | **un seul**, toujours **juste après le niveau 3** (6:20 → 8:40), ~14 s, présentateur à l'écran |
| Rythme visuel | **1 image / ~5 s** (≈ 12 images/min, ~300 images/vidéo), plans fixes avec léger zoom, jamais d'animation |
| Densité factuelle | 1,5-3 chiffres / 100 mots (dates, sommes, effectifs, calibres, distances) ; 6,6 pour le thème richesse |
| Adresse directe | « you » 4-6 fois / 100 mots |
| Vues (24 dernières) | 2,6 k → 327 k ; top : Corée du Nord 327 k, Cartel mexicain 238 k, Empire romain 190 k, Mafia 165 k, A-10 160 k |

## 3. Structure narrative (invariante)

1. **Hook = la 1ʳᵉ phrase du niveau 1, sans intro** : `Level one, <nom du rang>. You are 17 years old. You don't choose this.` — puis un détail concret immédiat (une lettre sur la table de la cuisine, un homme en guayabera qui te pointe du doigt). Jamais « dans cette vidéo nous allons… ».
2. **Chaque niveau ouvre par la même formule** : `Level N, <rang natif>. You are <âge>.` — le rang est nommé **dans la langue d'origine** (*ibyong, sangbyong, halcón, junkosei, tiro*) puis expliqué.
3. **Contenu d'un niveau** : l'insigne/le symbole du rang → le quotidien (réveil, nourriture, solde, arme, logement, chiffres exacts) → **une scène humaine avec un personnage secondaire nommé** (O Gwang 22 ans de Hamhung, Pak Chun 18 ans, Lieutenant Nam Gi-ho…) → un **dilemme moral** résolu par la prudence → **un mot d'évaluation** qui clôt le niveau (« observant », « reliable », « measured », « satisfactory »).
4. **Fil rouge** : les personnages secondaires et les décisions des niveaux précédents **reviennent** aux niveaux supérieurs (la mémoire du protagoniste). Le protagoniste **vieillit** (17 → 56 ans, cheveux gris au niveau 10).
5. **Niveau 10 = sommet ET chute** : convocation, mise à l'écart, effacement discret, ou bien solitude du sommet. Épilogue philosophique.
6. **Dernière phrase courte, sèche, mémorable** : « *You were never climbing. You were being moved into position.* » / « *Removal is not punishment. It is maintenance.* » / « *You blow out the lamp. You sleep.* »
7. **Ton** : jamais de jugement, jamais d'humour, jamais d'exclamation. Phrases courtes. Le système est le vrai personnage ; le protagoniste survit en comprenant « ce que le système exige vraiment ».
8. **CTA (après le niveau 3)** : « *Before we go further, if you've made it this far, comment what you want next. Hit that like button right now and subscribe so you don't miss what's coming next. We upload every single day.* » — dit par le présentateur, pas par la voix du récit.

## 4. Système visuel (relevé image par image)

### 4.1 La pyramide de rangs (la signature de la chaîne)
- Fond **blanc**. **10 cartes-portraits** disposées **4 / 3 / 2 / 1** (Level 1-4 en bas, 5-7, 8-9, **Level 10 au sommet**). Cartes à **bord noir épais**, label « Level N » blanc contour noir en bas de chaque carte.
- Chaque carte = portrait **chibi** du protagoniste **au rang correspondant** (tenue/insigne/âge du niveau) sur un fond coloré simple. Les 9 premières sont visibles dès le début (donc générées **avant** le montage).
- **Level 10 = silhouette noire aux yeux rouges**, mystère conservé **jusqu'à la fin** (même quand on l'atteint, la carte reste la silhouette).
- Apparition **au début de chaque niveau** pendant que la voix dit « Level N, <rang> » : pyramide entière ~1 s → **zoom** sur la carte du niveau (~1,5 s, gros « Level N » sous le portrait) → coupe sur la 1ʳᵉ scène. ~3 s au total, **pris sur la narration** (pas de temps mort).

### 4.2 Le style des images de scène
- **Dessin 2D propre façon webtoon/anime léger** : contours noirs nets et épais, aplats avec ombrage doux, palette **désaturée et terreuse** (kaki, beige, gris-bleu, brun), décors détaillés mais lisibles, proportions réalistes (pas de chibi dans les scènes, pas de stickman).
- **Même protagoniste** d'une image à l'autre (visage, coupe de cheveux), qui **vieillit** et **change d'uniforme/insignes** à chaque niveau. Personnages secondaires distincts et récurrents.
- Plans variés : plan moyen du protagoniste (dominant), plan large décor/foule (bus, dortoir, rangs de soldats), **gros plan objet** (bol, carnet, carte, fusil, lettre), **documents/organigrammes** avec texte dans la langue locale, visages en gros plan pour l'émotion.
- **Aucun texte incrusté par la machine** dans les images (le texte vu à l'écran est dessiné : panneaux, formulaires) — sauf le libellé des cartes.
- Sous-titres **incrustés** : police arrondie grasse blanche (type Comic/Fredoka) contour noir, 1 ligne ≤ 7 mots, centrés bas.
- Bande-son : musique de suspense discrète (Gemini) — optionnelle pour nous.

### 4.3 Le présentateur (CTA)
Jeune homme brun en t-shirt sombre, **fond orange uni avec particules**, salue de la main puis **pointe un bouton rouge « Subscribe » + un pouce bleu** qui apparaissent à sa droite. ~14 s. Même présentateur sur toute la chaîne.

### 4.4 Les miniatures (style DIFFÉRENT des vidéos)
- Style **« Odd Dude » / trollface** : têtes rondes blanches à visage meme, contours noirs épais, décors **saturés et détaillés** (pyramides, cité néon, tranchée, palais).
- **Code fixe : 2 personnages.** À **gauche le rang 1** (apeuré, en sueur, larmes, habits pauvres, arme basique) ; à **droite le rang 10** (sourire suffisant/sournois, médailles, couronne/casque, or, costume, lingots). Le contraste bas/haut EST la promesse de la vidéo.
- **Zéro texte** sur la miniature (le titre fait le travail).
- Titres : `Your Life as Every Rank in <organisation>` (dominant), variantes `Every Rank in the Roman Empire`, `Your Life as a GIGN Operator`, `What It Was Like to be a WWI Trench Raider`, `Your Life as Genghis Khan`.
- Description : un paragraphe « From low-level recruits … to powerful leadership, every position … came with different levels of influence, responsibility, and danger », une question au spectateur, « Watch now to discover your life as every rank in … », puis un disclaimer (divertissement, **AI disclosure**).
- Tags : POV, POV story, Entertaining education, POV animation, military ranks, life as a soldier, <organisation> explained…

## 5. Ce qui fait monter les vues (lecture des 24)

- Les **organisations fermées, secrètes ou redoutées** : armée nord-coréenne (327 k), cartels (238 k / 13 k pour Escobar = moins récent), Rome, Mafia, pilotes A-10 (160 k), Yakuza, Samouraïs (70 k), Égypte (67 k).
- Les sujets **non-organisation** performent moins (richesse 2,6 k, Genghis Khan 43 k, WWI 29 k) : la **hiérarchie à gravir** est le moteur, pas le thème.
- La promesse fonctionne sur tout système à grades : c'est ce que la machine doit exploiter pour **orienter vers d'autres univers** (entreprise, école, sport, prison, religion, gaming, fiction…) — toujours avec 10 rangs nommés, un protagoniste qui vieillit, une chute.

## 6. Traduction en machine (`pov`)

| Élément | Implémentation |
|---|---|
| Input | sujet (organisation/hiérarchie), langue de la voix, voix Inworld, durée cible (défaut 25 min), nombre de niveaux (défaut 10), publication |
| Script | 1 appel **outline** (titre, 10 rangs : nom natif + âge + insigne + beat unique + personnages secondaires + mot d'évaluation + fin) → **10 niveaux écrits en parallèle** (lots de 1 niveau, concurrence 5), CTA inséré après le niveau 3 |
| Voix | Inworld TTS (FAL) **par niveau** (bornes de niveaux exactes par ffprobe) → concat → Whisper mot-à-mot sur l'ensemble |
| Découpage | frontières de sens (méthode Stickman), **cible 5 s/plan**, 1ʳᵉ tranche de chaque niveau (~3 s) réservée à la pyramide |
| Protagoniste | fiche EN + **référence t2i** générée au début (portrait plan moyen), puis i2i pour TOUTES les images (« the exact same person as the reference ») + description d'âge/tenue **par niveau** |
| Cartes | 9 portraits chibi i2i (1 par niveau, tenue du niveau) + silhouette Level 10 (asset machine) → compo Remotion **`PovPyramid`** (pyramide + zoom) rendue en MP4 par niveau |
| Images | Kie `nano-banana-2-lite` i2i 16:9, style martelé (§4.2), pool 5, 3 essais |
| Montage | FFmpeg : clips zoompan 1920×1080 + clips pyramide + concat → sous-titres gravés (police arrondie) → CTA présentateur (image hôte + bouton `StickmanCta`) → mux voix |
| Packaging | titre formule, description code concurrent + disclaimer IA, tags, **miniature Odd Dude 2 persos (gauche rang 1 / droite rang 10), zéro texte**, miniatures concurrentes top-vues en références de style |
