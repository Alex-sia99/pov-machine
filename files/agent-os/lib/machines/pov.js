/**
 * MACHINE POV — « Your Life as Every Rank in … » : documentaires dramatisés à la 2ᵉ personne,
 * 10 niveaux d'une hiérarchie, un protagoniste qui vieillit, une pyramide de rangs à chaque niveau.
 *
 * Recette dérivée de la chaîne POVrank (24 vidéos scrappées + décorticage image par image de 2 vidéos) :
 * voir docs/RECETTE-NICHE-POV.md. Chiffres qui pilotent la machine : ~150 mots/min, 10 niveaux de
 * ~2 min 20, CTA unique après le niveau 3, ~1 image / 5,5 s, pyramide 4/3/2/1 (Level 10 = silhouette).
 *
 * Squelette cloné de stickman.js (skill machine-factory) : machine à états reprenable, génération
 * parallèle, régé non destructive, montage FFmpeg + Remotion (pyramide en MP4, bouton CTA en PNG).
 *
 * Étapes : script (outline + niveaux en parallèle) → voix (par niveau) + Whisper + découpage
 *          → prompts d'images → référence + cartes + images → montage → packaging.
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { DATA_DIR, ensureDir, readJSON, writeJSON } = require("../store");
const claude = require("../claude");
const vault = require("../vault");
const fal = require("../fal");
const ff = require("../ffmpeg");
const google = require("../google");
const tasks = require("../tasks");
const spend = require("../spend");
const bank = require("../bank");
const scrap = require("../scrap");

const MACHINE_ID = "pov";
const MACHINE_NAME = "POV";
const ROOT = path.join(__dirname, "..", "..", "..");
const OUT_ROOT = path.join(__dirname, "..", "..", "output", "machines");
const ASSETS_DIR = path.join(OUT_ROOT, "pov-assets");
const REMOTION_DIR = path.join(ROOT, "remotion");
const RUNS_DIR = path.join(DATA_DIR, "machines", "runs", MACHINE_ID); // sous-dossier : listRuns ne voit que nos runs
ensureDir(OUT_ROOT);
ensureDir(ASSETS_DIR);
ensureDir(RUNS_DIR);

// ---------------------------------------------------------------- constantes de niche

// Mesures de la niche (24 vidéos POVrank) — ne pas modifier sans re-mesurer.
const WPM = 150;            // 140-171 mots/min observés
const SHOT_TARGET = 5.5;    // médiane 6 s, p25 4 s (détection de plans sur la vidéo n°1)
const SHOT_MIN = 2.5;
const SHOT_MAX = 9.0;
const BURST_MIN = 1.5;
const PYR_SEC = 3.0;        // pyramide + zoom au début de chaque niveau, pris sur la narration
const CTA_AFTER_LEVEL = 3;  // le CTA arrive TOUJOURS juste après le niveau 3 (24/24 vidéos)

const PRICES = { image: 0.02, voicePer1kChars: 0.015, whisperPerSec: 0.0008 };
const MAX_TRIES = 3;
const MAX_REWRITES = 3; // réécritures automatiques d'un prompt refusé/en échec avant abandon
const IMG_CONCURRENCY = 5;
const LEVEL_CONCURRENCY = 5;
const TTS_MAX_CHARS = 1900; // l'API Inworld refuse au-delà de 2000

const W = 1920, H = 1080, FPS = 30;

// Voix Inworld TTS (FAL) — les noms SONT les voix.
const VOICES = {
  English: ["Malcolm", "Graham", "Theodore", "Edward", "Simon", "Elliot", "James", "Oliver", "Rupert", "Sebastian", "Craig", "Mark", "Nate", "Ethan", "Blake", "Carter", "Serena", "Claire", "Victoria", "Miranda", "Evelyn", "Celeste", "Olivia", "Julia", "Sarah", "Elizabeth"],
  "Français": ["Alain", "Mathieu", "Étienne", "Hélène"],
  "Español": ["Diego", "Miguel", "Rafael", "Lupita"],
  Deutsch: ["Josef", "Johanna"],
  Italiano: ["Gianni", "Orietta"],
  "Português": ["Heitor", "Maitê"],
  Nederlands: ["Erik", "Lennart", "Katrien", "Lore"],
  Polski: ["Szymon", "Wojciech"],
  "Русский": ["Dmitry", "Nikolai", "Svetlana", "Elena"],
  "日本語": ["Satoshi", "Asuka"],
  "한국어": ["Hyunwoo", "Seojun", "Minji", "Yoona"],
  "中文": ["Yichen", "Jing", "Xiaoyin", "Xinyi"],
};
const VOICE_SUFFIX = {
  English: "(en)", "Français": "(fr)", "Español": "(es)", Deutsch: "(de)", Italiano: "(it)",
  "Português": "(pt)", Nederlands: "(nl)", Polski: "(pl)", "Русский": "(ru)", "日本語": "(ja)",
  "한국어": "(ko)", "中文": "(zh)",
};
const WHISPER_LANG = {
  English: "en", "Français": "fr", "Español": "es", Deutsch: "de", Italiano: "it", "Português": "pt",
  Nederlands: "nl", Polski: "pl", "Русский": "ru", "日本語": "ja", "한국어": "ko", "中文": "zh",
};
const LEVEL_WORD = {
  English: "Level", "Français": "Niveau", "Español": "Nivel", Deutsch: "Stufe", Italiano: "Livello", "Português": "Nível",
  Nederlands: "Niveau", Polski: "Poziom", "Русский": "Уровень", "日本語": "レベル", "한국어": "레벨", "中文": "第",
};
// Le CTA de la niche, mot pour mot (dit par le présentateur, pas par la voix du récit).
const CTA_TEXT = {
  English: "Before we go further, if you've made it this far, comment what you want next. Hit that like button right now and subscribe so you don't miss what's coming next. We upload every single day.",
  "Français": "Avant d'aller plus loin, si tu es arrivé jusqu'ici, dis-moi en commentaire ce que tu veux voir ensuite. Mets un pouce bleu tout de suite et abonne-toi pour ne pas rater la suite. On publie tous les jours.",
  "Español": "Antes de seguir, si has llegado hasta aquí, comenta qué quieres ver después. Dale a me gusta ahora mismo y suscríbete para no perderte lo que viene. Subimos vídeos todos los días.",
  Deutsch: "Bevor wir weitermachen: Wenn du bis hierher gekommen bist, schreib in die Kommentare, was du als Nächstes sehen willst. Drück jetzt auf Like und abonniere, damit du nichts verpasst. Wir laden jeden Tag hoch.",
  Italiano: "Prima di andare avanti, se sei arrivato fin qui, scrivi nei commenti cosa vuoi vedere dopo. Metti mi piace adesso e iscriviti per non perderti il seguito. Pubblichiamo ogni giorno.",
  "Português": "Antes de continuarmos, se chegou até aqui, comente o que quer ver a seguir. Deixe o seu like agora e inscreva-se para não perder o que vem aí. Publicamos todos os dias.",
};
const CTA_LABEL = {
  English: { label: "SUBSCRIBE", done: "SUBSCRIBED" },
  "Français": { label: "S'ABONNER", done: "ABONNÉ" },
  "Español": { label: "SUSCRIBIRSE", done: "SUSCRITO" },
  Deutsch: { label: "ABONNIEREN", done: "ABONNIERT" },
  Italiano: { label: "ISCRIVITI", done: "ISCRITTO" },
  "Português": { label: "INSCREVA-SE", done: "INSCRITO" },
};

/** Style martelé sur TOUTES les images de scène : relevé image par image sur les vidéos de la niche. */
const IMG_STYLE = `Clean 2D digital cartoon illustration in a light webtoon / anime-influenced style, drawn in exactly the same art style as the reference image. Crisp bold dark outlines of even thickness, flat colour fills with soft simple cel shading, no gradients heavier than a single shadow tone. Muted, desaturated, earthy palette (khaki, beige, slate blue-grey, brown, soft olive), never neon, never oversaturated. Realistic human proportions (NOT chibi, NOT stick figures), expressive but restrained faces, detailed yet readable backgrounds with clean perspective. Cinematic 16:9 framing, eye-level or slightly low angle, the subject clearly readable at a glance.`;

const IMG_NEG = `Absolutely no captions, no subtitles, no labels, no watermark, no logo, no UI, no frame border, no speech bubbles. No photorealism, no 3D render, no painterly brushwork, no sketch lines, no stick figures, no chibi proportions in scene shots.`;

/** Le présentateur du CTA (même personnage sur toute la chaîne). */
const HOST_PROMPT = `Clean 2D digital cartoon illustration, light webtoon style, bold dark outlines, flat colours with soft cel shading. A friendly young man in his late twenties with short brown hair and a plain dark charcoal t-shirt and jeans, standing in a medium shot, smiling warmly and raising one hand in a casual wave toward the viewer. Plain warm orange gradient background with soft glowing particles, no objects, no furniture. Centered, lots of empty space on his right side. Absolutely no text, no letters, no logos, no watermark.`;

// ---------------------------------------------------------------- Claude

function genModel() {
  return config().settings.promptModel || "";
}
async function genJson(prompt, { ms = 6 * 60 * 1000, tries = 3, label = "" } = {}) {
  let last;
  for (let a = 1; a <= tries; a++) {
    try {
      const out = await claude.ask(prompt, { timeoutMs: ms, model: genModel() || undefined });
      const j = claude.parseJson(out);
      if (j) return j;
      last = new Error("réponse illisible (JSON absent)");
    } catch (e) {
      last = e;
    }
    if (a < tries) await new Promise((r) => setTimeout(r, 3000 * a));
  }
  throw new Error(`${label || "Génération"} : ${last.message}`);
}

// ---------------------------------------------------------------- config

function defaultNicheId() {
  const n = bank.niches().find((x) => /^pov\b/i.test(x.name));
  return n ? n.id : null;
}
const DEFAULT_SETTINGS = {
  imageModel: "grok2", subtitles: true, promptModel: "", chainLanguage: "English", publishPrivacy: "private",
  levels: 10, shotSeconds: SHOT_TARGET, channelName: "POV Rank", host: null, hostUrl: null,
};
function config() {
  const c = readJSON(`machines/${MACHINE_ID}.json`, null);
  if (c) {
    c.settings = Object.assign({}, DEFAULT_SETTINGS, c.settings || {});
    if (!c.nicheId) c.nicheId = defaultNicheId();
    return c;
  }
  const fresh = { id: MACHINE_ID, name: MACHINE_NAME, nicheId: defaultNicheId(), settings: { ...DEFAULT_SETTINGS } };
  writeJSON(`machines/${MACHINE_ID}.json`, fresh);
  return fresh;
}
function saveConfig(c) {
  writeJSON(`machines/${MACHINE_ID}.json`, c);
}
function patchConfig(patch) {
  const c = config();
  if (patch.settings) Object.assign(c.settings, patch.settings);
  for (const k of ["nicheId", "name"]) if (patch[k] !== undefined) c[k] = patch[k];
  saveConfig(c);
  return c;
}

// ---------------------------------------------------------------- runs

function runPath(id) {
  return path.join(RUNS_DIR, id + ".json");
}
function listRuns() {
  try {
    return fs
      .readdirSync(RUNS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        try {
          const r = JSON.parse(fs.readFileSync(path.join(RUNS_DIR, f), "utf8"));
          return {
            id: r.id, title: r.title || r.params?.subject || "Sans titre", status: r.status,
            createdAt: r.createdAt, mode: r.mode, cost: r.cost, params: r.params,
            shots: (r.scenes || []).filter((s) => s.kind === "scene").length, levels: (r.levels || []).length,
            durationSec: r.voDuration || null, finalRel: r.finalRel || null, published: r.published || null,
          };
        } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  } catch { return []; }
}
function getRun(id) {
  const r = readJSON(path.relative(DATA_DIR, runPath(id)).replace(/\\/g, "/"), null);
  if (!r) throw new Error("Run introuvable");
  return r;
}
function saveRun(r) {
  r.updatedAt = new Date().toISOString();
  fs.writeFileSync(runPath(r.id), JSON.stringify(r, null, 1));
}
function log(r, msg) {
  r.logs = r.logs || [];
  r.logs.push({ t: new Date().toISOString(), msg: String(msg) });
  if (r.logs.length > 400) r.logs = r.logs.slice(-400);
  saveRun(r);
}
function totalCost(run) {
  const c = run.cost || {};
  return (c.voice || 0) + (c.images || 0) + (c.cards || 0) + (c.ref || 0);
}

// ---------------------------------------------------------------- recette de niche

/** Le noyau dur : survit à toutes les régénérations. */
function coreRules(run) {
  const p = run.params;
  const words = Math.round(p.durationMin * WPM);
  return [
    "NICHE : documentaire DRAMATISÉ à la DEUXIÈME PERSONNE (« tu »/« you ») — « Your Life as Every Rank in … ».",
    `SUJET : ${p.subject}.`,
    `LANGUE DE LA VOIX OFF : ${p.language}. Tous les prompts d'images restent en ANGLAIS.`,
    `DURÉE VISÉE : ${p.durationMin} minutes, soit ~${words} mots au total (débit mesuré : ${WPM} mots/min), répartis sur ${p.levels} niveaux.`,
    "LE PRINCIPE : le spectateur EST le protagoniste. Il entre tout en bas de la hiérarchie, jeune, et la monte niveau par niveau ;",
    "chaque niveau est un chapitre de SA vie à un âge précis. Il vieillit. Les personnages et les décisions des niveaux précédents reviennent plus haut.",
    "TON : calme, clinique, factuel, sans jugement, sans humour, sans exclamation, sans emphase. Phrases courtes (8-14 mots).",
    "Le vrai personnage est LE SYSTÈME : on survit en comprenant « ce que le système exige vraiment ».",
    "DENSITÉ FACTUELLE : 2 à 3 données précises par 100 mots (dates, sommes, effectifs, distances, calibres, horaires, noms de lieux réels). Faits RÉELS et vérifiables, jamais inventés.",
    "PERSONNAGES SECONDAIRES NOMMÉS (nom + âge + origine) à chaque niveau, qui reviennent ensuite.",
    "Chaque niveau se clôt par UN mot d'évaluation qui résume ce que le système a retenu de toi (« observant », « reliable », « measured »…).",
    "AUCUN appel à s'abonner dans le récit : le CTA est un bloc séparé, inséré par la machine.",
    "INTERDIT : « dans cette vidéo », « aujourd'hui nous allons », toute intro ou conclusion de présentateur. Le récit commence à la 1ʳᵉ seconde.",
  ].join("\n");
}

/** La structure canonique, relevée sur les 24 vidéos les plus récentes de la niche. */
function storyRecipe(run) {
  const p = run.params;
  const lvl = LEVEL_WORD[p.language] || "Level";
  return [
    "STRUCTURE OBLIGATOIRE :",
    `1. HOOK = la toute première phrase du niveau 1, sans intro : « ${lvl} 1, <nom natif du rang>. You are <âge>. You don't choose this. » puis un détail concret IMMÉDIAT (une lettre sur la table, un homme qui te pointe du doigt, un bus avant l'aube).`,
    `2. CHAQUE NIVEAU OUVRE PAR LA MÊME FORMULE : « ${lvl} N, <rang dans la langue d'origine>. You are <âge>. » — le rang est nommé dans sa langue d'origine puis expliqué (insigne, ce qu'il signifie).`,
    "3. CONTENU D'UN NIVEAU : l'insigne/le symbole du rang → le quotidien chiffré (réveil, nourriture, solde, équipement, logement) → UNE scène humaine avec un personnage secondaire nommé → un dilemme moral résolu par la prudence → le mot d'évaluation.",
    "4. FIL ROUGE : les choix et les personnes des niveaux précédents reviennent (souvenir, conséquence tardive). Le protagoniste vieillit à chaque niveau (de ~15 ans à ~55 ans).",
    "5. DERNIER NIVEAU = SOMMET ET CHUTE : convocation, mise à l'écart, effacement discret, ou solitude du sommet. Épilogue désabusé.",
    "6. DERNIÈRE PHRASE : courte, sèche, mémorable (« You were never climbing. You were being moved into position. »).",
    "7. RÉPÉTITIONS INTERDITES entre niveaux : pas deux fois la même scène (pas deux sessions d'autocritique, pas deux inspections d'armes) — chaque niveau a un BEAT UNIQUE fixé par l'outline.",
  ].join("\n");
}

// ---------------------------------------------------------------- étape 1 : script (outline + niveaux en parallèle)

function wordsPerLevel(run) {
  return Math.round((run.params.durationMin * WPM) / run.params.levels);
}

async function writeOutline(run) {
  const c = config();
  const p = run.params;
  const inspiration = c.nicheId ? (() => { try { return bank.inspiration(c.nicheId, { maxTitles: 20, maxVisions: 1 }); } catch { return ""; } })() : "";
  const j = await genJson(
    [
      "Tu prépares l'OUTLINE (le storyboard narratif) d'une vidéo « Your Life as Every Rank in … ».",
      "Tu n'écris PAS encore le script : tu fixes le squelette que des rédacteurs parallèles vont étoffer niveau par niveau.",
      "",
      coreRules(run),
      "",
      storyRecipe(run),
      "",
      inspiration ? "CONTEXTE CONCURRENTIEL (à égaler, pas à copier) :\n" + inspiration : "",
      "",
      `NOMBRE DE NIVEAUX : EXACTEMENT ${p.levels}, du plus bas au plus haut de la hiérarchie « ${p.subject} ».`,
      "",
      "CONTRAINTES DE SORTIE :",
      `- \`title\` : titre YouTube en ${c.settings.chainLanguage}, formule de la niche : « Your Life as Every Rank in <organisation> » (ou « Every Rank in … »). 40-80 caractères.`,
      "- `protagonist` : {`name` (prénom plausible pour l'univers), `appearance` (EN, 40-60 mots : visage, cheveux, carrure, teint — ce qui NE CHANGE PAS avec l'âge), `ageStart`}.",
      "- `ranks` : tableau de EXACTEMENT " + p.levels + " objets, dans l'ordre croissant :",
      "  {`n`, `native` (nom du rang dans la langue d'origine, ex. « ibyong », « halcón »), `name` (traduction courte), `age` (âge du protagoniste à ce niveau, croissant),",
      "   `insignia` (EN, l'insigne/le symbole visible), `look` (EN, 25-40 mots : tenue, insignes, signes de l'âge À CE NIVEAU — sert aux images),",
      "   `beat` (FR, 2-3 phrases : l'événement UNIQUE de ce niveau, le dilemme, sa résolution), `secondary` : [{`name`, `desc` (FR, âge + origine + rôle)}] (1-2 personnages),",
      "   `callback` (FR, quel élément d'un niveau précédent revient ici — vide pour le niveau 1), `evalWord` (le mot d'évaluation qui clôt le niveau, dans la langue de la voix)}.",
      "- `ending` : FR, 2-3 phrases : la chute/le sommet du dernier niveau + la dernière phrase EXACTE dans la langue de la voix.",
      "- Les beats doivent être TOUS différents (lieux, situations, enjeux). Les âges sont strictement croissants.",
      "",
      'RÉPONDS UNIQUEMENT EN JSON : {"title":"","protagonist":{"name":"","appearance":"","ageStart":17},"ranks":[{"n":1,"native":"","name":"","age":17,"insignia":"","look":"","beat":"","secondary":[{"name":"","desc":""}],"callback":"","evalWord":""}],"ending":""}',
    ].filter(Boolean).join("\n"),
    { ms: 10 * 60 * 1000, label: "Outline" }
  );
  if (!Array.isArray(j.ranks) || j.ranks.length < 3) throw new Error("Outline : rangs manquants");
  j.ranks = j.ranks.slice(0, p.levels).map((r, i) => ({ ...r, n: i + 1 }));
  if (j.ranks.length !== p.levels) throw new Error(`Outline : ${j.ranks.length} rangs au lieu de ${p.levels}`);
  if (!j.protagonist || !j.protagonist.appearance) throw new Error("Outline : protagoniste manquant");
  run.outline = j;
  run.title = j.title || p.subject;
  run.levels = j.ranks.map((r) => ({ n: r.n, text: null }));
  log(run, `Outline : « ${run.title} » — ${j.ranks.length} niveaux (${j.ranks.map((r) => r.native || r.name).join(" → ")})`);
  saveRun(run);
}

async function writeLevel(run, n) {
  const p = run.params;
  const o = run.outline;
  const rank = o.ranks[n - 1];
  const words = wordsPerLevel(run);
  const lvl = LEVEL_WORD[p.language] || "Level";
  const isLast = n === o.ranks.length;
  const j = await genJson(
    [
      `Tu écris le NIVEAU ${n} sur ${o.ranks.length} d'une vidéo « ${run.title} ». Un seul niveau, d'un seul tenant, prêt pour la synthèse vocale.`,
      "",
      coreRules(run),
      "",
      storyRecipe(run),
      "",
      `PROTAGONISTE : ${o.protagonist.name} — ${o.protagonist.appearance}`,
      "",
      "OUTLINE COMPLET (pour la cohérence : ce qui précède et ce qui suit — tu n'écris QUE ton niveau) :",
      o.ranks.map((r) => `  ${r.n}. ${r.native} (${r.name}), ${r.age} ans — ${r.beat} [personnages : ${(r.secondary || []).map((s) => s.name + " (" + s.desc + ")").join(", ")}]${r.callback ? " [rappel : " + r.callback + "]" : ""} → mot final : « ${r.evalWord} »`).join("\n"),
      `FIN PRÉVUE : ${o.ending}`,
      "",
      `TON NIVEAU : ${n}. Rang « ${rank.native} » (${rank.name}), ${rank.age} ans. Insigne : ${rank.insignia}.`,
      `BEAT À ÉTOFFER : ${rank.beat}`,
      rank.callback ? `RAPPEL OBLIGATOIRE D'UN NIVEAU PRÉCÉDENT : ${rank.callback}` : "",
      isLast ? "C'EST LE DERNIER NIVEAU : sommet puis chute/épilogue, et la dernière phrase exacte prévue dans l'outline." : "",
      "",
      "CONTRAINTES DE SORTIE :",
      `- \`text\` : ${words} mots ± 8 %, en ${p.language}, qui COMMENCE EXACTEMENT par « ${lvl} ${n}, ${rank.native}. » puis l'âge, et se termine par la scène du mot d'évaluation « ${rank.evalWord} »${isLast ? " puis l'épilogue" : ""}.`,
      "  Uniquement le texte lu : pas de titre, pas de didascalie, pas de balise, pas de puces.",
      "- `summary` : FR, 1 phrase, ce qui s'est passé (pour les rédacteurs des niveaux suivants).",
      "",
      'RÉPONDS UNIQUEMENT EN JSON : {"text":"","summary":""}',
    ].filter(Boolean).join("\n"),
    { ms: 8 * 60 * 1000, label: `Niveau ${n}` }
  );
  const text = String(j.text || "").replace(/\s+/g, " ").trim();
  if (text.split(/\s+/).length < words * 0.45) throw new Error(`Niveau ${n} : texte trop court`);
  return { text, summary: String(j.summary || "") };
}

async function stepScript(run) {
  if (!run.outline) await writeOutline(run);
  const todo = run.levels.filter((l) => !l.text);
  if (todo.length) {
    let done = run.levels.length - todo.length;
    await pool(todo, async (l) => {
      const r = await writeLevel(run, l.n);
      l.text = r.text;
      l.summary = r.summary;
      done++;
      saveRun(run);
      await tasks.updateTask(run.taskId, { step: `Script : niveau ${done}/${run.levels.length}`, progress: 6 + Math.round((10 * done) / run.levels.length) }).catch(() => {});
    }, LEVEL_CONCURRENCY);
  }
  const missing = run.levels.filter((l) => !l.text);
  if (missing.length) throw new Error(`${missing.length} niveau(x) sans texte (${missing.map((l) => l.n).join(", ")}) — relance l'étape.`);
  run.ctaText = CTA_TEXT[run.params.language] || CTA_TEXT.English;
  run.script = run.levels.map((l) => l.text).join(" ");
  const n = run.script.split(/\s+/).length;
  log(run, `Script écrit : ${run.levels.length} niveaux, ${n} mots (~${(n / WPM).toFixed(1)} min estimées)`);
  saveRun(run);
}

// ---------------------------------------------------------------- étape 2 : voix par niveau + Whisper + découpage

function chunkText(text, max = TTS_MAX_CHARS) {
  const sentences = text.match(/[^.!?]+[.!?]+["»)]?\s*/g) || [text];
  const out = [];
  let cur = "";
  for (const s of sentences) {
    if (cur.length + s.length > max && cur) { out.push(cur.trim()); cur = ""; }
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function runFfmpeg(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { cwd, windowsHide: true });
    let err = "";
    child.stdout.on("data", () => {}); // pipe non lu = process figé (piège connu)
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", (e) => reject(new Error("FFmpeg introuvable : " + e.message)));
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error("FFmpeg : " + err.slice(-500)))));
  });
}

async function uploadPublic(name, absFile, mime) {
  const up = await google.driveUpload(name, mime, fs.readFileSync(absFile));
  await google.ensurePublic(up.id).catch(() => {});
  return `https://drive.google.com/uc?export=download&id=${up.id}`;
}

/** Synthèse d'un bloc de texte en un fichier mp3 (par morceaux ≤ 2000 caractères). */
async function synth(run, text, outFile, voice) {
  if (fs.existsSync(outFile) && fs.statSync(outFile).size > 1000) return;
  const dir = path.dirname(outFile);
  const parts = chunkText(text);
  const files = [];
  for (let i = 0; i < parts.length; i++) {
    const r = await fal.run("fal-ai/inworld-tts", { text: parts[i], voice, sample_rate_hertz: 48000 }, { cancelled: () => cancelledRuns.has(run.id) });
    const url = r.audio?.url;
    if (!url) throw new Error("Inworld TTS : aucun audio renvoyé");
    const f = outFile.replace(/\.mp3$/, `-p${i}.mp3`);
    await fal.download(url, f);
    files.push(f);
  }
  // Ré-encodage mp3 SYSTÉMATIQUE, même pour un seul morceau : Inworld renvoie du WAV PCM 48 kHz sous une extension
  // .mp3 ; copié tel quel, il casse le concat suivant (le demuxer prend le format du 1er fichier → voix tronquée de
  // plus de la moitié, diagnostiqué sur la machine Wealth le 22/09/2026). Aucun trim, aucun filtre : juste le codec.
  {
    const list = outFile.replace(/\.mp3$/, "-concat.txt");
    fs.writeFileSync(list, files.map((f) => `file '${path.basename(f)}'`).join("\n"));
    await runFfmpeg(["-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.basename(list), "-c:a", "libmp3lame", "-b:a", "192k", "-ar", "48000", "-ac", "1", "-y", path.basename(outFile)], dir);
    try { fs.unlinkSync(list); } catch {}
  }
  files.forEach((f) => { try { fs.unlinkSync(f); } catch {} });
  const cost = +((text.length / 1000) * PRICES.voicePer1kChars).toFixed(4);
  run.cost.voice = (run.cost.voice || 0) + cost;
  spend.record("FAL.ai", MACHINE_NAME, cost, "USD", `Inworld TTS (${text.length} car.)`);
  saveRun(run);
}

/** Découpe un segment de narration en plans : on coupe sur le SENS, jamais sur l'horloge. */
function buildShots(words, segStart, segEnd) {
  if (!words.length) return [];
  const boundary = words.map((w) => {
    if (/[.!?]["»)]?$/.test(w.w)) return "phrase";
    if (/[,;:]$/.test(w.w)) return "virgule";
    return null;
  });
  const commas = words.filter((_, i) => boundary[i] === "virgule").map((w) => w.end);
  const inBurst = (t) => commas.filter((c) => Math.abs(c - t) <= 4).length >= 3;
  const target = Number(config().settings.shotSeconds) || SHOT_TARGET;

  const raw = [];
  let start = 0;
  for (let i = 0; i < words.length; i++) {
    const dur = words[i].end - words[start].t;
    const b = boundary[i];
    const last = i === words.length - 1;
    let cut = false;
    if (last) cut = true;
    else if (b === "phrase" && dur >= target * 0.6) cut = true;
    else if (b === "phrase" && dur >= BURST_MIN && inBurst(words[i].end)) cut = true;
    else if (b === "virgule" && dur >= target) cut = true;
    else if (dur >= SHOT_MAX) cut = true;
    if (!cut) continue;
    raw.push({ start: words[start].t, end: words[i].end, say: words.slice(start, i + 1).map((w) => w.w).join(" ") });
    start = i + 1;
  }
  const merged = [];
  for (const s of raw) {
    const prev = merged[merged.length - 1];
    const d = s.end - s.start;
    if (prev && d < SHOT_MIN && prev.end - prev.start + d <= SHOT_MAX) {
      prev.end = s.end;
      prev.say += " " + s.say;
    } else merged.push({ ...s });
  }
  // Plans STRICTEMENT JOINTIFS sur le segment : les respirations sont couvertes par une image.
  merged[0].start = segStart;
  for (let k = 0; k < merged.length - 1; k++) merged[k].end = merged[k + 1].start;
  merged[merged.length - 1].end = segEnd;
  return merged.map((s) => ({ start: +s.start.toFixed(2), end: +s.end.toFixed(2), dur: +(s.end - s.start).toFixed(2), say: s.say }));
}

async function stepVoice(run) {
  const dir = path.join(OUT_ROOT, run.id);
  ensureDir(dir);
  const p = run.params;
  const voice = `${p.voice} ${VOICE_SUFFIX[p.language] || "(en)"}`;

  // --- synthèse PAR NIVEAU (bornes exactes de chaque niveau) + le bloc CTA
  const total = run.levels.length + 1;
  let k = 0;
  for (const l of run.levels) {
    const f = path.join(dir, `vo-L${l.n}.mp3`);
    await synth(run, l.text, f, voice);
    l.file = f;
    l.duration = await ff.probeDuration(f, { label: `voix niveau ${l.n}` });
    k++;
    await tasks.updateTask(run.taskId, { step: `Voix off : niveau ${k}/${total - 1}`, progress: 16 + Math.round((8 * k) / total) }).catch(() => {});
    saveRun(run);
  }
  const ctaFile = path.join(dir, "vo-cta.mp3");
  await synth(run, run.ctaText, ctaFile, voice);
  run.ctaDuration = await ff.probeDuration(ctaFile, { label: "voix CTA" });

  // --- assemblage dans l'ordre : niveaux 1..3, CTA, niveaux 4..N — et calcul des offsets
  const order = [];
  const ctaAfter = Math.min(CTA_AFTER_LEVEL, run.levels.length - 1);
  for (const l of run.levels) {
    order.push({ kind: "level", n: l.n, file: `vo-L${l.n}.mp3`, duration: l.duration });
    if (l.n === ctaAfter) order.push({ kind: "cta", file: "vo-cta.mp3", duration: run.ctaDuration });
  }
  const voFile = path.join(dir, "vo.mp3");
  fs.writeFileSync(path.join(dir, "vo-concat.txt"), order.map((o) => `file '${o.file}'`).join("\n"));
  await runFfmpeg(["-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", "vo-concat.txt", "-c:a", "libmp3lame", "-b:a", "192k", "-y", "vo.mp3"], dir);
  run.voDuration = await ff.probeDuration(voFile, { label: "voix off" });
  run.voRel = `agent-os/output/machines/${run.id}/vo.mp3`;
  // Offsets réels : on re-sonde le fichier assemblé pour répartir l'écart éventuel du muxer
  let t = 0;
  const sum = order.reduce((a, o) => a + o.duration, 0);
  const scale = sum > 0 ? run.voDuration / sum : 1;
  run.segments = order.map((o) => {
    const seg = { ...o, start: +t.toFixed(3) };
    t += o.duration * scale;
    seg.end = +t.toFixed(3);
    return seg;
  });
  run.segments[run.segments.length - 1].end = +run.voDuration.toFixed(3);
  for (const l of run.levels) {
    const s = run.segments.find((x) => x.kind === "level" && x.n === l.n);
    l.start = s.start; l.end = s.end;
  }
  log(run, `Voix off : ${run.voDuration.toFixed(1)} s (${(run.voDuration / 60).toFixed(2)} min), CTA ${run.ctaDuration.toFixed(1)} s après le niveau ${ctaAfter}`);
  saveRun(run);

  // --- transcript mot-à-mot (Whisper) sur l'ensemble : c'est lui qui cale les images sur le sens
  if (!run.words || !run.words.length) {
    const low = path.join(dir, "vo-low.mp3");
    await runFfmpeg(["-hide_banner", "-loglevel", "error", "-i", "vo.mp3", "-ac", "1", "-b:a", "64k", "-y", "vo-low.mp3"], dir);
    const url = await uploadPublic(`${run.id}-vo.mp3`, low, "audio/mpeg");
    const res = await fal.run(
      "fal-ai/whisper",
      { audio_url: url, task: "transcribe", language: WHISPER_LANG[p.language] || "en", chunk_level: "word" },
      { timeoutMs: 15 * 60 * 1000, cancelled: () => cancelledRuns.has(run.id) }
    );
    const chunks = Array.isArray(res?.chunks) ? res.chunks : [];
    run.words = chunks
      .map((c) => ({ t: Number(c.timestamp?.[0] ?? c.start ?? 0), end: Number(c.timestamp?.[1] ?? c.end ?? 0), w: String(c.text || "").trim() }))
      .filter((c) => c.w && isFinite(c.t) && isFinite(c.end));
    if (run.words.length < 50) throw new Error("Whisper : transcript inexploitable");
    const wCost = +(run.voDuration * PRICES.whisperPerSec).toFixed(4);
    run.cost.voice = (run.cost.voice || 0) + wCost;
    spend.record("FAL.ai", MACHINE_NAME, wCost, "USD", `Whisper (${Math.round(run.voDuration)} s)`);
    try { fs.unlinkSync(low); } catch {}
    saveRun(run);
  }

  // --- plan de visuels : par segment. Niveau = pyramide (PYR_SEC) puis plans ; CTA = un seul plan « hôte ».
  const scenes = [];
  let i = 1;
  for (const seg of run.segments) {
    if (seg.kind === "cta") {
      scenes.push({ i: i++, kind: "cta", level: null, start: seg.start, end: seg.end, dur: +(seg.end - seg.start).toFixed(2), say: run.ctaText, scene: null, image: null });
      continue;
    }
    const pyrEnd = Math.min(seg.start + PYR_SEC, seg.end - 1);
    scenes.push({ i: i++, kind: "pyramid", level: seg.n, start: seg.start, end: +pyrEnd.toFixed(2), dur: +(pyrEnd - seg.start).toFixed(2), say: "", scene: null, image: null });
    const words = run.words.filter((w) => w.t >= pyrEnd - 0.3 && w.end <= seg.end + 0.3);
    const shots = words.length ? buildShots(words, pyrEnd, seg.end) : [{ start: pyrEnd, end: seg.end, dur: +(seg.end - pyrEnd).toFixed(2), say: "" }];
    for (const s of shots) scenes.push({ i: i++, kind: "scene", level: seg.n, ...s, scene: null, image: null });
  }
  run.scenes = scenes;
  const d = scenes.filter((s) => s.kind === "scene").map((s) => s.dur).sort((a, b) => a - b);
  run.shotStats = { count: d.length, perMin: +(d.length / (run.voDuration / 60)).toFixed(1), median: d[Math.floor(d.length / 2)], min: d[0], max: d[d.length - 1] };
  log(run, `Découpage : ${d.length} images de scène + ${run.levels.length} pyramides + 1 CTA — médiane ${run.shotStats.median} s, ${run.shotStats.perMin} plans/min (niche : ~6 s / 10 plans/min)`);
  saveRun(run);
}

// ---------------------------------------------------------------- étape 3 : prompts d'images

const BATCH = 12;

async function stepPrompts(run) {
  const todo = run.scenes.filter((s) => s.kind === "scene" && !s.scene);
  if (!todo.length) return;
  const o = run.outline;
  const lots = [];
  // Lots par niveau (le contexte du niveau est le même pour tout le lot), de tailles ÉQUILIBRÉES :
  // 13 plans → 7 + 6, jamais 12 + 1 (un appel Claude pour un seul prompt).
  for (const l of run.levels) {
    const mine = todo.filter((s) => s.level === l.n);
    if (!mine.length) continue;
    const parts = Math.ceil(mine.length / BATCH);
    const size = Math.ceil(mine.length / parts);
    for (let i = 0; i < mine.length; i += size) lots.push({ level: l.n, shots: mine.slice(i, i + size) });
  }
  let done = 0;
  const worker = async (lot) => {
    const rank = o.ranks[lot.level - 1];
    const j = await genJson(
      [
        "Tu écris les DESCRIPTIONS D'IMAGES d'un documentaire dramatisé « Your Life as Every Rank in … ».",
        "Chaque description sera transformée en illustration 2D par un modèle image-to-image ancré sur la référence du protagoniste.",
        "",
        `SUJET : ${run.title}`,
        `PROTAGONISTE : ${o.protagonist.name}. NE DÉCRIS JAMAIS son visage, ses cheveux ni sa carrure (la référence s'en charge) : appelle-le « THE PROTAGONIST ».`,
        `À CE NIVEAU (${lot.level}/${o.ranks.length}, rang « ${rank.native} », ${rank.age} ans) il porte : ${rank.look}. Insigne : ${rank.insignia}.`,
        `PERSONNAGES SECONDAIRES DU NIVEAU : ${(rank.secondary || []).map((s) => s.name + " — " + s.desc).join(" ; ") || "aucun"}.`,
        "",
        "RÉPARTITION À RESPECTER (relevée sur la niche) : ~55 % plan moyen du protagoniste en situation, ~20 % plan large (décor, foule, rangs, véhicule),",
        "~15 % gros plan OBJET ou DOCUMENT (bol, carnet, lettre, arme, carte, formulaire, insigne), ~10 % gros plan VISAGE (émotion contenue, la sienne ou celle d'un secondaire).",
        "",
        "RÈGLES ABSOLUES :",
        "1. `scene` en ANGLAIS, 45-90 mots, concrète et dessinable : décor précis et daté, position/pose/action/regard de chaque personnage, lumière, cadrage.",
        `2. Le protagoniste a ${rank.age} ans : marque l'âge (visage juvénile / traits marqués / cheveux gris) et SA TENUE DU NIVEAU dans chaque plan où il apparaît.`,
        "3. `hasProtagonist` : true s'il est à l'écran. Un plan objet/décor sans lui commence par « NO PEOPLE IN THIS SHOT. ».",
        "4. Plans consécutifs VISUELLEMENT DIFFÉRENTS : alterne échelle, décor, angle. Jamais deux fois la même composition de suite.",
        "5. Aucun texte lisible à inventer sauf s'il est dans le récit (un formulaire, un panneau) — alors décris-le sans en écrire le contenu.",
        "",
        "PLANS À DÉCRIRE (le texte est ce qui est dit PENDANT le plan) :",
        lot.shots.map((s) => `${s.i}. [${s.dur}s] ${s.say}`).join("\n"),
        "",
        `RÉPONDS UNIQUEMENT EN JSON : {"shots":[{"i":${lot.shots[0].i},"type":"medium","hasProtagonist":true,"scene":""}]} — type ∈ medium | wide | object | face`,
      ].join("\n"),
      { ms: 8 * 60 * 1000, label: `Prompts d'images (niveau ${lot.level}, plans ${lot.shots[0].i}-${lot.shots[lot.shots.length - 1].i})` }
    );
    for (const sh of j.shots || []) {
      const s = run.scenes.find((x) => x.i === Number(sh.i));
      if (!s || !sh.scene) continue;
      s.scene = String(sh.scene);
      s.type = sh.type || "medium";
      s.hasProtagonist = sh.hasProtagonist !== false;
    }
    done += lot.shots.length;
    await tasks.updateTask(run.taskId, { step: `Prompts d'images : ${Math.min(done, todo.length)}/${todo.length}`, progress: 30 + Math.round((12 * done) / todo.length) }).catch(() => {});
    saveRun(run);
  };
  await pool(lots, worker, 4);
  const missing = run.scenes.filter((s) => s.kind === "scene" && !s.scene);
  if (missing.length) throw new Error(`${missing.length} plan(s) sans description (plans ${missing.slice(0, 6).map((s) => s.i).join(", ")}) — relance l'étape.`);
  log(run, `Prompts d'images écrits pour ${todo.length} plans`);
  saveRun(run);
}

// ---------------------------------------------------------------- étape 4 : référence + cartes + images (Kie)

function kieKey() {
  const k = vault.get("kie");
  if (!k) throw new Error("Clé Kie absente du coffre");
  return k;
}
const KIE_MODEL = { grok2: "grok-imagine-image-2-0/image-edit", nano: "nano-banana-2-lite", seedream: "seedream/5-lite-image-to-image", gpt: "gpt-image-2-image-to-image" };
const KIE_T2I = { grok2: "grok-imagine-image-2-0/text-to-image", nano: "nano-banana-2-lite", seedream: "seedream/5-lite-text-to-image", gpt: "gpt-image-2-text-to-image" };
const KIE_IMGFIELD = { grok2: "image_urls", nano: "image_urls", seedream: "image_urls", gpt: "input_urls" };

async function kieCreate(model, input) {
  const r = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST",
    headers: { Authorization: `Bearer ${kieKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input }),
  }).then((x) => x.json());
  if (!r.data?.taskId) throw new Error(`Kie : ${r.msg || JSON.stringify(r).slice(0, 160)}`);
  return r.data.taskId;
}
async function kiePoll(taskId, runId, timeoutMs = 10 * 60 * 1000) {
  const t0 = Date.now();
  while (true) {
    await new Promise((r) => setTimeout(r, 8000));
    if (runId && cancelledRuns.has(runId)) throw new Error("Annulée par l'utilisateur");
    if (Date.now() - t0 > timeoutMs) throw new Error("Kie : délai dépassé");
    const r = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, { headers: { Authorization: `Bearer ${kieKey()}` } }).then((x) => x.json());
    if (r.data?.state === "success") return JSON.parse(r.data.resultJson).resultUrls[0];
    if (r.data?.state === "fail") throw new Error(`Kie : ${r.data?.failMsg || "génération échouée"}`);
  }
}
async function download(url, file) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Téléchargement image ${resp.status}`);
  fs.writeFileSync(file, Buffer.from(await resp.arrayBuffer()));
}
function imgTool() {
  const t = config().settings.imageModel || "grok2";
  return { model: KIE_MODEL[t] || KIE_MODEL.grok2, t2i: KIE_T2I[t] || KIE_T2I.grok2, field: KIE_IMGFIELD[t] || "image_urls" };
}

/** Référence du protagoniste (t2i) : plan moyen neutre, c'est l'ancre i2i de TOUTES les images. */
async function ensureRef(run) {
  if (run.ref && run.ref.url && fs.existsSync(run.ref.file)) return;
  const dir = path.join(OUT_ROOT, run.id);
  ensureDir(dir);
  const o = run.outline;
  const r1 = o.ranks[0];
  const prompt = `${IMG_STYLE.replace(", drawn in exactly the same art style as the reference image", "")}\n\nCHARACTER REFERENCE SHEET — medium shot, front view, neutral background in a single flat muted colour, soft even lighting. ${o.protagonist.appearance}. Age ${r1.age}, wearing: ${r1.look}. Calm, restrained expression, looking slightly off camera. The face, hair and build must be clearly readable: this image is the identity anchor for a whole video.\n\n${IMG_NEG}`;
  const file = path.join(dir, "ref.png");
  const url = await kiePoll(await kieCreate(imgTool().t2i, { prompt, aspect_ratio: "16:9" }), run.id);
  await download(url, file);
  run.cost.ref = (run.cost.ref || 0) + PRICES.image;
  spend.record("Kie.ai", MACHINE_NAME, PRICES.image, "USD", "Référence protagoniste");
  const pub = await uploadPublic(`${run.id}-ref.png`, file, "image/png");
  run.ref = { rel: `agent-os/output/machines/${run.id}/ref.png`, file, url: pub, ts: Date.now() };
  log(run, "Référence du protagoniste générée");
  saveRun(run);
}

/** Les cartes de la pyramide : portrait chibi du protagoniste à chaque niveau (le dernier = silhouette, dessinée par Remotion). */
function cardPrompt(run, n) {
  const o = run.outline;
  const rank = o.ranks[n - 1];
  return `Cute chibi-style portrait card in a clean 2D cartoon style with bold dark outlines and flat muted colours, drawn from the SAME character as the reference image (same face shape, same hair, same skin tone — recognisably him, just chibi proportions: big head, small body). Bust framing, centered, facing the viewer with a calm or slightly worried expression fitting his rank. Age ${rank.age}${rank.age >= 45 ? ", visibly older, grey hair, lined face" : rank.age >= 30 ? ", adult features" : ", youthful features"}. Wearing: ${rank.look}. Insignia clearly visible: ${rank.insignia}. Simple flat background in ONE colour that matches the mood of the rank (earthy tones), a faint hint of the setting allowed. Absolutely no text, no letters, no numbers, no frame, no border.`;
}
async function generateCard(run, n) {
  const dir = path.join(OUT_ROOT, run.id, "cards");
  ensureDir(dir);
  const file = path.join(dir, `card-${n}.png`);
  const { model, field } = imgTool();
  const input = { prompt: cardPrompt(run, n), aspect_ratio: "16:9" };
  input[field] = [run.ref.url];
  const url = await kiePoll(await kieCreate(model, input), run.id);
  await download(url, file);
  run.cards = run.cards || [];
  const entry = { n, rel: `agent-os/output/machines/${run.id}/cards/card-${n}.png`, file, ts: Date.now() };
  const idx = run.cards.findIndex((c) => c.n === n);
  if (idx >= 0) run.cards[idx] = entry; else run.cards.push(entry);
  run.cost.cards = (run.cost.cards || 0) + PRICES.image;
  spend.record("Kie.ai", MACHINE_NAME, PRICES.image, "USD", `Carte pyramide niveau ${n}`);
  saveRun(run);
}

/** Le prompt d'un plan : style + identité ancrée + tenue du niveau + scène + garde-fous. */
function buildImagePrompt(run, scene) {
  const o = run.outline;
  const rank = o.ranks[(scene.level || 1) - 1];
  const ident = scene.hasProtagonist !== false
    ? `THE PROTAGONIST is the exact same person as in the reference image: same face, same hair, same build — do not reinvent him. In this shot he is ${rank.age} years old${rank.age >= 45 ? " (visibly aged: grey hair, lined face)" : rank.age >= 30 ? " (adult features)" : " (youthful features)"} and wears: ${rank.look}.`
    : `The reference image is attached ONLY as a style guide (line weight, palette, shading). The protagonist does NOT appear in this shot.`;
  return `${IMG_STYLE}\n\n${ident}\n\nSCENE TO DRAW: ${scene.scene}\n\n${IMG_NEG}`;
}

async function generateImage(run, scene) {
  const dir = path.join(OUT_ROOT, run.id, "img");
  ensureDir(dir);
  const file = path.join(dir, String(scene.i).padStart(3, "0") + ".png");
  const { model, field } = imgTool();
  const input = { prompt: buildImagePrompt(run, scene), aspect_ratio: "16:9" };
  input[field] = [run.ref.url];
  const url = await kiePoll(await kieCreate(model, input), run.id);
  await download(url, file);
  scene.image = { rel: `agent-os/output/machines/${run.id}/img/${String(scene.i).padStart(3, "0")}.png`, file, ts: Date.now() };
  delete scene.error;
  run.cost.images = (run.cost.images || 0) + PRICES.image;
  spend.record("Kie.ai", MACHINE_NAME, PRICES.image, "USD", `Image plan ${scene.i}`);
  saveRun(run);
}

/** Le présentateur du CTA : asset de la machine, généré une fois, partagé par tous les runs. */
async function ensureHost({ force = false } = {}) {
  const c = config();
  const file = path.join(ASSETS_DIR, "host.png");
  if (!force && c.settings.host && fs.existsSync(file)) return { rel: c.settings.host, file };
  const url = await kiePoll(await kieCreate(imgTool().t2i, { prompt: HOST_PROMPT, aspect_ratio: "16:9" }), null);
  await download(url, file);
  spend.record("Kie.ai", MACHINE_NAME, PRICES.image, "USD", "Présentateur CTA");
  c.settings.host = "agent-os/output/machines/pov-assets/host.png";
  c.settings.hostTs = Date.now();
  saveConfig(c);
  return { rel: c.settings.host, file };
}

// ---------------------------------------------------------------- étape 5 : montage

function srtTime(sec) {
  const ms = Math.max(0, Math.round(sec * 1000));
  const p2 = (n, k = 2) => String(n).padStart(k, "0");
  return `${p2(Math.floor(ms / 3600000))}:${p2(Math.floor((ms % 3600000) / 60000))}:${p2(Math.floor((ms % 60000) / 1000))},${p2(ms % 1000, 3)}`;
}

function buildSrt(run, dir) {
  const MAXW = 7, MAXD = 3.0;
  const lines = [];
  let cur = [];
  const w = run.words;
  for (let i = 0; i < w.length; i++) {
    cur.push(w[i]);
    const dur = w[i].end - cur[0].t;
    const endsSentence = /[.!?]["»)]?$/.test(w[i].w);
    const endsClause = /[,;:]$/.test(w[i].w);
    if (i === w.length - 1 || endsSentence || cur.length >= MAXW || dur >= MAXD || (endsClause && cur.length >= 4)) {
      lines.push({ start: cur[0].t, end: w[i].end, text: cur.map((x) => x.w).join(" ").replace(/\s+([,.!?;:])/g, "$1") });
      cur = [];
    }
  }
  for (let i = 0; i < lines.length - 1; i++) if (lines[i + 1].start - lines[i].end < 0.25) lines[i].end = lines[i + 1].start - 0.02;
  const srt = lines.map((l, i) => `${i + 1}\n${srtTime(l.start)} --> ${srtTime(l.end)}\n${l.text}\n`).join("\n");
  fs.writeFileSync(path.join(dir, "subs.srt"), srt, "utf8");
  return lines.length;
}

function spawnRemotion(args, onLine) {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["remotion", ...args], { cwd: REMOTION_DIR, shell: true, windowsHide: true });
    let err = "";
    child.stdout.on("data", (d) => { if (onLine) onLine(d.toString()); }); // OBLIGATOIRE : un pipe non lu fige le rendu
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-300) || "code " + code))));
  });
}

/** Clip pyramide d'un niveau (MP4 direct : que des images fixes, aucun gel Remotion). */
async function renderPyramid(run, level, seconds, outFile) {
  const rel = `pov-${run.id}`;
  const pubDir = path.join(REMOTION_DIR, "public", rel);
  ensureDir(pubDir);
  const cards = run.levels.map((l) => {
    if (l.n === run.levels.length) return ""; // sommet = silhouette (mystère jusqu'à la fin)
    const c = (run.cards || []).find((x) => x.n === l.n);
    if (!c || !fs.existsSync(c.file)) return "";
    const name = `card-${l.n}.png`;
    fs.copyFileSync(c.file, path.join(pubDir, name));
    return name;
  });
  const lvl = LEVEL_WORD[run.params.language] || "Level";
  const propsFile = path.join(REMOTION_DIR, `${rel}-L${level}.json`);
  fs.writeFileSync(propsFile, JSON.stringify({ dir: rel, cards, level, label: `${lvl} ${level}`, seconds: +seconds.toFixed(2) }));
  // Sortie RELATIVE dans remotion/ puis déplacement : un chemin absolu avec espaces/apostrophe
  // (« Agentic OS d'Alex ») passé en argument via shell:true est mutilé — Remotion « réussit » ailleurs.
  const tmpName = `${rel}-L${level}.mp4`;
  const tmpFile = path.join(REMOTION_DIR, tmpName);
  await spawnRemotion(["render", "PovPyramid", tmpName, `--props=${path.basename(propsFile)}`]);
  if (!fs.existsSync(tmpFile) || fs.statSync(tmpFile).size < 1000) throw new Error(`pyramide niveau ${level} : Remotion n'a produit aucun fichier`);
  // NORMALISATION OBLIGATOIRE : le MP4 Remotion a une piste audio muette et un timebase 1/90000,
  // les clips image n'ont pas d'audio et sont en 1/15360 → le démuxeur concat dérivait (21 s de
  // clips → 94 s, ou une vidéo finale tronquée de 10 %). On ré-encode aux paramètres des clips image.
  await runFfmpeg([
    "-hide_banner", "-loglevel", "error", "-y", "-i", tmpFile, "-an", "-vf", `fps=${FPS},format=yuv420p`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", String(FPS), "-video_track_timescale", "15360", outFile,
  ]);
  try { fs.unlinkSync(tmpFile); } catch {}
  try { fs.unlinkSync(propsFile); } catch {}
}

/** Bouton d'abonnement animé : Remotion rend une SÉQUENCE PNG (l'encodage vidéo écrase l'alpha). */
async function renderCtaSeq(run, labels) {
  const rel = `povcta-${run.id}`;
  fs.writeFileSync(path.join(REMOTION_DIR, rel + ".json"), JSON.stringify({ label: labels.label, labelDone: labels.done, channel: run.params.channelName || config().settings.channelName || "POV Rank" }));
  await spawnRemotion(["render", "StickmanCta", rel, "--sequence", "--image-format=png", `--props=${rel}.json`]);
  const folder = path.join(REMOTION_DIR, rel);
  if (!fs.existsSync(path.join(folder, "element-000.png"))) throw new Error("séquence CTA absente");
  return folder;
}

async function renderMontage(run) {
  const dir = path.join(OUT_ROOT, run.id);
  const clips = path.join(dir, "clips");
  ensureDir(clips);
  const c = config();
  const name = (s) => String(s.i).padStart(3, "0") + ".mp4";

  // 1) clips par plan : images (zoompan léger alterné), pyramides (Remotion), CTA (présentateur)
  const host = await ensureHost().catch((e) => { log(run, "⚠ Présentateur indisponible (" + e.message.slice(0, 80) + ") — CTA sans hôte"); return null; });
  let k = 0;
  for (const s of run.scenes) {
    const out = path.join(clips, name(s));
    if (fs.existsSync(out) && fs.statSync(out).size > 5000) { k++; continue; }
    const frames = Math.max(2, Math.round(s.dur * FPS));
    if (s.kind === "pyramid") {
      await renderPyramid(run, s.level, s.dur, out);
    } else {
      let img = s.kind === "cta" ? (host && host.file) : (s.image && s.image.file);
      if (!img) {
        // repli : image du plan précédent (jamais d'écran noir)
        const prev = run.scenes.slice(0, run.scenes.indexOf(s)).reverse().find((x) => x.image && x.image.file);
        img = prev ? prev.image.file : null;
      }
      if (!img) throw new Error(`Plan ${s.i} : aucune image disponible`);
      const amp = Math.min(0.07, 0.012 * s.dur);
      const z = s.i % 2 ? `1+${amp.toFixed(4)}*on/${frames}` : `${(1 + amp).toFixed(4)}-${amp.toFixed(4)}*on/${frames}`;
      await runFfmpeg([
        "-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-i", img,
        "-vf",
          `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},` +
          `zoompan=z='${z}':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},format=yuv420p`,
        "-frames:v", String(frames), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", String(FPS), out,
      ]);
    }
    k++;
    if (k % 10 === 0) await tasks.updateTask(run.taskId, { step: `Montage : clips ${k}/${run.scenes.length}`, progress: 78 + Math.round((8 * k) / run.scenes.length), status: "running" }).catch(() => {});
  }
  log(run, `${run.scenes.length} clips rendus (dont ${run.levels.length} pyramides)`);

  // 2) concaténation (ré-encodage ; tous les clips ont été normalisés aux mêmes paramètres)
  fs.writeFileSync(path.join(dir, "clips.txt"), run.scenes.map((s) => `file 'clips/${name(s)}'`).join("\n"));
  await runFfmpeg(["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", "clips.txt", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-r", String(FPS), "-pix_fmt", "yuv420p", "video-mute.mp4"], dir);
  // GARDE : la piste vidéo doit couvrir la voix (sinon -shortest tronque la fin en silence).
  const muteDur = await ff.probeDuration(path.join(dir, "video-mute.mp4"), { label: "vidéo muette" });
  if (Math.abs(muteDur - run.voDuration) > 2) throw new Error(`Montage : vidéo de ${muteDur.toFixed(1)} s pour une voix de ${run.voDuration.toFixed(1)} s — dérive du concat, montage refusé`);

  // 3) bouton d'abonnement pendant le CTA (best-effort)
  const ctaShot = run.scenes.find((s) => s.kind === "cta");
  let ctaSeq = null;
  const ctaAt = ctaShot ? +(ctaShot.start + Math.min(4, ctaShot.dur * 0.3)).toFixed(2) : null;
  if (ctaShot) {
    try { ctaSeq = await renderCtaSeq(run, CTA_LABEL[run.params.language] || CTA_LABEL.English); }
    catch (e) { log(run, "Bouton CTA indisponible (" + String(e.message).slice(0, 90) + ") — montage sans bouton"); }
  }

  // 4) sous-titres + incrustation + voix, en une passe
  const subsOn = run.params.subtitles !== false;
  if (subsOn) log(run, `Sous-titres : ${buildSrt(run, dir)} lignes`);
  const inputs = ["-i", "video-mute.mp4", "-i", "vo.mp3"];
  let filter = "";
  let curLabel = "[0:v]";
  if (subsOn) {
    // Police arrondie grasse blanche à contour noir (code de la niche), cwd = dossier du run (échappement Windows)
    filter += `[0:v]subtitles=subs.srt:force_style='FontName=Comic Sans MS,FontSize=15,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,Alignment=2,MarginV=26'[sub]`;
    curLabel = "[sub]";
  }
  if (ctaSeq) {
    inputs.push("-framerate", String(FPS), "-start_number", "0", "-i", path.join(ctaSeq, "element-%03d.png"));
    filter += `${filter ? ";" : ""}[2:v]format=rgba,setpts=PTS+${ctaAt}/TB[c0];${curLabel}[c0]overlay=0:0:eof_action=pass:enable='between(t,${ctaAt},${ctaAt + 5})'[vout]`;
    curLabel = "[vout]";
  }
  await runFfmpeg([
    "-hide_banner", "-loglevel", "error", "-y", ...inputs,
    ...(filter ? ["-filter_complex", filter] : []),
    "-map", curLabel === "[0:v]" ? "0:v" : curLabel, "-map", "1:a",
    "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", "final.mp4",
  ], dir);

  try {
    if (ctaSeq) fs.rmSync(ctaSeq, { recursive: true, force: true });
    fs.unlinkSync(path.join(REMOTION_DIR, `povcta-${run.id}.json`));
    fs.rmSync(path.join(REMOTION_DIR, "public", `pov-${run.id}`), { recursive: true, force: true });
    fs.rmSync(clips, { recursive: true, force: true });
    fs.unlinkSync(path.join(dir, "video-mute.mp4"));
  } catch {}
  return path.join(dir, "final.mp4");
}

// ---------------------------------------------------------------- étape 6 : packaging

function capTags(tags, max = 500) {
  const out = [];
  let len = 0;
  for (const t of tags) {
    const s = String(t).trim();
    if (!s) continue;
    const add = s.length + (s.includes(" ") ? 2 : 0) + (out.length ? 1 : 0);
    if (len + add > max) break;
    out.push(s);
    len += add;
  }
  return out;
}

/** Miniatures concurrentes les plus vues (fichiers locaux du scraping) : références de STYLE pour la nôtre. */
function topCompetitorThumbFiles(n = 2) {
  try {
    const c = config();
    if (!c.nicheId) return [];
    const s = bank.summary(c.nicheId);
    const out = [];
    for (const v of s.topVideos) {
      for (const ch of s.channels) {
        for (const rel of scrap.channelThumbs(ch.channelId)) {
          if (rel.endsWith(`-${v.videoId}.jpg`)) out.push(path.join(ROOT, rel));
        }
      }
      if (out.length >= n) break;
    }
    return out.slice(0, n);
  } catch { return []; }
}

async function generatePackaging(run) {
  const c = config();
  const o = run.outline;
  const inspiration = c.nicheId ? (() => { try { return bank.inspiration(c.nicheId, { maxTitles: 15, maxVisions: 0 }); } catch { return ""; } })() : "";
  const j = await genJson(
    [
      "Tu prépares la PUBLICATION YouTube d'un documentaire dramatisé « Your Life as Every Rank in … ».",
      `LANGUE DE LA CHAÎNE (titre, description, tags) : ${c.settings.chainLanguage}.`,
      "",
      `TITRE DE TRAVAIL : ${run.title}`,
      `SUJET : ${run.params.subject}`,
      `RANGS : ${o.ranks.map((r) => `${r.n}. ${r.native} (${r.name})`).join(", ")}`,
      "SCRIPT (début) :", run.script.slice(0, 2500),
      "",
      inspiration ? "CE QUI PERFORME DANS LA NICHE :\n" + inspiration : "",
      "",
      "CONTRAINTES :",
      "- `title` : formule de la niche « Your Life as Every Rank in <organisation> » (variante « Every Rank in … » acceptée). 40-80 caractères, pas d'émoji.",
      "- `description` : §1 (3-4 phrases) « From <rang le plus bas> … to <rang le plus haut>, every position within <organisation> came with different levels of influence, responsibility, and danger. In this video, we explore the hierarchy and inner structure of … ».",
      "  §2 : une question au spectateur (« Which rank do you think would have been the most dangerous? »). §3 : « Watch now to discover your life as every rank in … ». §4 : « Like, comment, and subscribe for more ». Puis une ligne vide et :",
      "  « ⚠️ LEGAL NOTICE & TRANSPARENCY (DISCLAIMER) — Entertainment Purposes: This video is created solely for entertainment. Some events or details may be dramatized, exaggerated, or simplified to enhance storytelling. AI Disclosure: Voiceovers and visuals were assisted by Artificial Intelligence to bring the story to life. »",
      "- `tags` : 16-22 mots-clés : POV, POV story, POV animation, Entertaining education, <organisation> ranks, <organisation> explained, life as a …, military ranks (si pertinent), du plus précis au plus large.",
      "- `thumbPrompt` : en ANGLAIS, la MINIATURE au code EXACT de la chaîne : style « rage comic / Odd Dude » — two characters with big round white heads, simple black-line meme faces, thick black outlines, small bodies ;",
      "  LEFT = the rank-1 version (terrified, sweating, crying, cheap clothes or basic gear of the lowest rank) ; RIGHT = the rank-10 version (smug grin, powerful, decorated — the top rank's uniform/crown/gold/suit).",
      "  Background = the world of the subject, detailed and SATURATED, warm dramatic lighting. Describe each character's outfit precisely for THIS organisation. Finish with: « Absolutely no text, no letters, no words, no numbers anywhere in the image. »",
      "",
      'RÉPONDS UNIQUEMENT EN JSON : {"title":"","description":"","tags":[],"thumbPrompt":""}',
    ].filter(Boolean).join("\n"),
    { ms: 8 * 60 * 1000, label: "Packaging" }
  );
  run.pack = {
    title: String(j.title || run.title).slice(0, 100),
    description: String(j.description || ""),
    tags: capTags(j.tags || []),
    thumbPrompt: String(j.thumbPrompt || ""),
  };
  saveRun(run);
  await generateThumbnail(run, j.thumbPrompt);
  log(run, `Packaging prêt : « ${run.pack.title} »`);
  saveRun(run);
}

async function generateThumbnail(run, thumbPrompt) {
  const dir = path.join(OUT_ROOT, run.id);
  const file = path.join(dir, "thumbnail.png");
  const { model, field } = imgTool();
  // Miniatures concurrentes top-vues en RÉFÉRENCES DE STYLE (i2i) : le t2i descriptif seul dérive vers du générique.
  const refs = [];
  for (const f of topCompetitorThumbFiles(2)) {
    try { refs.push(await uploadPublic(`${run.id}-thumbref-${refs.length}.jpg`, f, "image/jpeg")); } catch {}
  }
  const prompt = (refs.length
    ? `STYLE REFERENCES ATTACHED: ${refs.length} thumbnail(s) from the same channel family. Reproduce their exact visual identity — indistinguishable from the same artist: the round white meme heads with simple black-line faces, the thick outlines, the saturated detailed background, the left/right contrast. Draw a NEW scene for this subject, do not copy their content.\n\n`
    : "") + thumbPrompt;
  const input = { prompt, aspect_ratio: "16:9" };
  if (refs.length) input[field] = refs;
  const url = await kiePoll(await kieCreate(refs.length ? model : imgTool().t2i, input), run.id);
  await download(url, file);
  run.cost.images = (run.cost.images || 0) + PRICES.image;
  spend.record("Kie.ai", MACHINE_NAME, PRICES.image, "USD", "Miniature");
  await runFfmpeg(["-hide_banner", "-loglevel", "error", "-y", "-i", file, "-vf", "scale=1280:720", path.join(dir, "thumbnail-1280.png")]);
  fs.renameSync(path.join(dir, "thumbnail-1280.png"), file);
  run.pack.thumbRel = `agent-os/output/machines/${run.id}/thumbnail.png`;
  run.pack.thumbTs = Date.now();
  saveRun(run);
}

async function regenThumbnail(runId, instructions) {
  const run = getRun(runId);
  const j = await genJson(
    [
      "Réécris le PROMPT de miniature YouTube d'une vidéo « Your Life as Every Rank in … ».",
      `Vidéo : ${run.pack?.title || run.title} — sujet : ${run.params.subject}.`,
      `Prompt actuel : ${run.pack?.thumbPrompt || ""}`,
      instructions ? `PRIORITÉ ABSOLUE — consigne de l'utilisateur : ${instructions}` : "",
      "Code EXACT de la chaîne : style rage comic / Odd Dude (grosses têtes rondes blanches, visages meme en traits noirs, contours épais),",
      "GAUCHE = version rang 1 (apeuré, en sueur, pauvre), DROITE = version rang 10 (sourire suffisant, décoré, puissant), décor du sujet détaillé et saturé.",
      "Termine par l'interdiction de tout texte dans l'image.",
      'RÉPONDS UNIQUEMENT EN JSON : {"thumbPrompt":""}',
    ].filter(Boolean).join("\n"),
    { ms: 5 * 60 * 1000, label: "Miniature" }
  );
  run.pack.thumbPrompt = String(j.thumbPrompt || run.pack.thumbPrompt);
  saveRun(run);
  await generateThumbnail(run, run.pack.thumbPrompt);
  return getRun(runId);
}

async function regenTexts(runId, instructions, field) {
  const run = getRun(runId);
  const c = config();
  const want = field === "all" ? ["title", "description", "tags"] : [field];
  const j = await genJson(
    [
      `Réécris ${want.join(", ")} pour une vidéo YouTube « Your Life as Every Rank in … ».`,
      `Langue : ${c.settings.chainLanguage}.`,
      `Titre actuel : ${run.pack?.title}`,
      `Sujet : ${run.params.subject}`,
      instructions ? `Consigne : ${instructions}` : "",
      "Formule de titre : « Your Life as Every Rank in <organisation> », 40-80 caractères. Description : codes de la chaîne (paragraphe hiérarchie, question, « Watch now… », disclaimer IA).",
      `RÉPONDS UNIQUEMENT EN JSON avec seulement ces clés : ${want.map((f) => `"${f}"`).join(", ")}`,
    ].filter(Boolean).join("\n"),
    { ms: 5 * 60 * 1000, label: "Textes" }
  );
  if (j.title) run.pack.title = String(j.title).slice(0, 100);
  if (j.description) run.pack.description = String(j.description);
  if (j.tags) run.pack.tags = capTags(j.tags);
  saveRun(run);
  return getRun(runId);
}

// ---------------------------------------------------------------- stock + publication

function stock() {
  return readJSON(`machines/${MACHINE_ID}-stock.json`, []);
}
function patchStock(entryId, patch = {}) {
  const s = stock();
  const e = s.find((x) => x.id === entryId);
  if (!e) throw new Error("Entrée de stock introuvable");
  for (const k of ["archived", "posted"]) if (patch[k] !== undefined) e[k] = !!patch[k];
  writeJSON(`machines/${MACHINE_ID}-stock.json`, s);
  return e;
}
function addToStock(run) {
  const s = stock();
  if (s.some((x) => x.id === run.id)) return;
  s.unshift({
    id: run.id, runId: run.id,
    title: run.pack?.title || run.title,
    description: run.pack?.description || "",
    tags: run.pack?.tags || [],
    finalRel: run.finalRel,
    thumbRel: run.pack?.thumbRel || null,
    durationSec: run.voDuration,
    shots: (run.scenes || []).filter((x) => x.kind === "scene").length,
    cost: run.cost,
    createdAt: new Date().toISOString(),
    posted: false,
    archived: false,
  });
  writeJSON(`machines/${MACHINE_ID}-stock.json`, s);
}

async function publishRun(runId, { channelId, title, description, tags, privacyStatus } = {}) {
  const run = getRun(runId);
  if (!run.finalRel) throw new Error("Pas de vidéo à publier");
  const chan = channelId || run.params.publishChannelId;
  if (!chan) throw new Error("Choisis une chaîne");
  const file = path.join(ROOT, run.finalRel);
  const priv = privacyStatus || run.params.publishPrivacy || config().settings.publishPrivacy || "private";
  const vid = await google.youtubeUpload(chan, file, {
    title: (title || run.pack?.title || run.title).slice(0, 100),
    description: description || run.pack?.description || "",
    tags: (tags && tags.length ? tags : run.pack?.tags || []).slice(0, 60),
    privacyStatus: priv,
    categoryId: "27",
  });
  if (run.pack?.thumbRel) {
    try { await google.youtubeSetThumbnail(chan, vid.id, path.join(ROOT, run.pack.thumbRel)); }
    catch (e) { log(run, "⚠ " + e.message + " — la vidéo est en ligne, pose la miniature à la main."); }
  }
  run.published = { videoId: vid.id, url: `https://youtu.be/${vid.id}`, at: new Date().toISOString(), privacyStatus: priv };
  saveRun(run);
  try { patchStock(run.id, { posted: true }); } catch {}
  return run.published;
}

// ---------------------------------------------------------------- concurrence

async function pool(items, worker, concurrency = 6) {
  const q = items.slice();
  let err = null;
  const run1 = async () => {
    while (q.length) {
      const it = q.shift();
      try { await worker(it); } catch (e) { err = err || e; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run1));
  if (err) throw err;
}

const cancelledRuns = new Set();

/** Refus DÉTERMINISTE du générateur (modération) : réessayer le même prompt ne sert à rien, il faut le réécrire. */
function isPolicyError(msg) {
  return /flagged|content polic|violat|sensitive|moderat|nsfw|safety|inappropriate|prohibit|unsafe|harmful|censor/i.test(String(msg || ""));
}

/**
 * Adapte le prompt d'un plan qui n'est pas passé : refus de modération → version implicite (même moment, sans violence
 * montrée) ; échecs répétés sans motif → version simplifiée. Historique conservé dans scene.promptHistory.
 * Renvoie true si le prompt a changé (→ nouvel essai justifié), false sinon (réécritures épuisées ou Claude indisponible).
 */
async function adaptScenePrompt(run, scene, reason) {
  const n = scene.rewrites || 0;
  const policy = isPolicyError(reason);
  if (n >= MAX_REWRITES) {
    log(run, `Plan ${scene.i} : ${MAX_REWRITES} réécritures déjà tentées, on garde le prompt actuel (${String(reason).slice(0, 80)})`);
    return false;
  }
  const rank = run.outline.ranks[(scene.level || 1) - 1];
  const refused = (scene.promptHistory || []).slice(-2).map((h) => h.scene);
  try {
    const j = await genJson(
      [
        `Tu réécris la DESCRIPTION D'IMAGE d'un plan de documentaire dramatisé « Your Life as Every Rank in … » parce que le générateur d'images ${policy ? "l'a REFUSÉE (filtre de modération)" : "a échoué plusieurs fois dessus"}.`,
        `Motif renvoyé par le générateur : ${String(reason).slice(0, 200)}`,
        `Ce qui est dit pendant le plan : « ${scene.say} »`,
        `Niveau ${scene.level} — le protagoniste a ${rank.age} ans et porte : ${rank.look}.`,
        `Description actuelle (à remplacer) : ${scene.scene}`,
        ...(refused.length ? [`Descriptions DÉJÀ refusées avant celle-ci (ne pas y revenir) : ${refused.map((s) => "« " + s + " »").join(" / ")}`] : []),
        "",
        ...(policy
          ? [
              "OBJECTIF : garder le SENS du moment (même lieu, mêmes personnages, même tension) mais rendre l'image acceptable par un filtre de modération STRICT :",
              "- aucune violence en train d'être infligée (pas de coup porté, pas de fouet/bâton/switch levé ou en mouvement, pas d'arme pointée sur quelqu'un), aucune blessure visible, aucun sang, aucune nudité, aucune contrainte physique sur un mineur ;",
              "- bannis les mots que les filtres bloquent : whip, whipping, flogging, lash, beating, strokes, bruised, blood, wound, torture, naked, corpse, kill, execution, abuse, punishment associé à child/boy ;",
              "- passe par la SUGGESTION : l'instant d'avant ou d'après, un plan de réaction (visages, témoins silencieux), un objet symbolique posé, un plan large où les figures sont petites et statiques, une posture de garde-à-vous, une main posée sur une épaule ;",
              `- l'âge se marque uniquement par « youthful features » / « adult features », jamais par child/boy/kid. Réécriture ${n + 1}/${MAX_REWRITES} : chaque version doit être NETTEMENT plus prudente que la précédente.`,
            ]
          : [
              "OBJECTIF : garder le sens du moment mais SIMPLIFIER pour que le générateur y arrive : 2 personnages maximum, une seule action claire, un décor plus simple, pas de mots rares ou ambigus, rien d'impossible à dessiner, aucun texte.",
            ]),
        "",
        "Description en ANGLAIS, 45-90 mots, concrète et dessinable. Ne décris jamais le visage/les cheveux du protagoniste (la référence s'en charge) : appelle-le THE PROTAGONIST. Un plan sans lui commence par « NO PEOPLE IN THIS SHOT. ». Aucun texte lisible dans l'image.",
        'RÉPONDS UNIQUEMENT EN JSON : {"scene":"","hasProtagonist":true,"type":"medium"} — type ∈ medium | wide | object | face',
      ].join("\n"),
      { ms: 4 * 60 * 1000, tries: 2, label: `Adaptation du prompt du plan ${scene.i}` }
    );
    const text = String(j.scene || "").trim();
    if (text.length < 20 || text === scene.scene) throw new Error("réécriture vide ou identique");
    scene.promptHistory = (scene.promptHistory || []).concat([{ scene: scene.scene, error: String(reason).slice(0, 200), ts: Date.now() }]);
    scene.scene = text;
    if (j.hasProtagonist !== undefined) scene.hasProtagonist = j.hasProtagonist !== false;
    if (["medium", "wide", "object", "face"].includes(j.type)) scene.type = j.type;
    scene.rewrites = n + 1;
    saveRun(run);
    log(run, `Plan ${scene.i} : prompt ${policy ? "refusé par Kie (politique de contenu)" : "en échec répété"} → réécrit ${policy ? "en version implicite, sans violence montrée" : "en version simplifiée"} (${n + 1}/${MAX_REWRITES}), nouvel essai`);
    return true;
  } catch (e) {
    log(run, `Plan ${scene.i} : réécriture du prompt impossible (${e.message.slice(0, 80)}) — essai avec le prompt actuel`);
    return false;
  }
}

async function genWithRetry(run, scene, kind) {
  scene.rendering = true;
  saveRun(run);
  try {
    // Plan déjà en échec (deuxième vague, reprise ⚡) : on ADAPTE son prompt avant de réessayer, au lieu de rejouer le même.
    if (kind === "image" && scene.lastError) {
      const why = scene.lastError;
      delete scene.lastError;
      await adaptScenePrompt(run, scene, why);
    }
    let fails = 0;
    while (true) {
      if (cancelledRuns.has(run.id)) throw new Error("Annulée par l'utilisateur");
      try {
        if (kind === "image") await generateImage(run, scene);
        else if (kind === "card") await generateCard(run, scene.n);
        return;
      } catch (e) {
        scene.error = e.message;
        saveRun(run);
        if (kind === "image" && isPolicyError(e.message)) {
          // Refus déterministe : rejouer le même prompt échouerait pareil → on le réécrit et on repart tout de suite.
          if (await adaptScenePrompt(run, scene, e.message)) continue;
          return;
        }
        if (++fails >= MAX_TRIES) return;
        await new Promise((r) => setTimeout(r, 4000 * fails));
      }
    }
  } finally {
    delete scene.rendering;
    saveRun(run);
  }
}

async function stepImages(run) {
  await ensureRef(run);

  // Cartes de la pyramide (tous les niveaux sauf le dernier = silhouette)
  const cardTodo = run.levels.filter((l) => l.n !== run.levels.length && !(run.cards || []).some((c) => c.n === l.n && fs.existsSync(c.file)));
  if (cardTodo.length) {
    await tasks.updateTask(run.taskId, { step: `Cartes de la pyramide : ${cardTodo.length} à générer…`, progress: 44, status: "running" }).catch(() => {});
    await pool(cardTodo, (l) => genWithRetry(run, l, "card"), IMG_CONCURRENCY);
    const miss = run.levels.filter((l) => l.n !== run.levels.length && !(run.cards || []).some((c) => c.n === l.n));
    if (miss.length) log(run, `⚠ ${miss.length} carte(s) manquante(s) (niveaux ${miss.map((l) => l.n).join(", ")}) — la pyramide affichera une silhouette à leur place.`);
  }

  const shots = run.scenes.filter((s) => s.kind === "scene");
  const total = shots.length;
  const tick = () => {
    const done = shots.filter((s) => s.image).length;
    const live = shots.filter((s) => s.rendering).length;
    tasks.updateTask(run.taskId, { step: `Images : ${done}/${total} · ${live} en cours…`, progress: 46 + Math.round((30 * done) / total), status: "running" }).catch(() => {});
  };
  const pend = shots.filter((s) => !s.image);
  if (pend.length) {
    tick();
    log(run, `Génération des images : ${pend.length} plan(s), ${IMG_CONCURRENCY} en parallèle…`);
    await pool(pend, (s) => genWithRetry(run, s, "image").then(tick), IMG_CONCURRENCY);
  }
  let missing = shots.filter((s) => !s.image);
  if (missing.length) {
    log(run, `⚠ ${missing.length} image(s) manquante(s) — pause de 20 s puis deuxième vague (prompts en échec adaptés avant l'essai)…`);
    await new Promise((r) => setTimeout(r, 20000));
    if (cancelledRuns.has(run.id)) throw new Error("Annulée par l'utilisateur");
    missing.forEach((s) => { if (s.error) s.lastError = s.error; });
    await pool(missing, (s) => genWithRetry(run, s, "image").then(tick), IMG_CONCURRENCY);
    missing = shots.filter((s) => !s.image);
  }
  if (missing.length) {
    const why = (missing.find((s) => s.error) || {}).error || "cause inconnue";
    const msg = `${missing.length}/${total} image(s) manquante(s) (plans ${missing.slice(0, 8).map((s) => s.i).join(", ")}) — ${why}`;
    if (run.mode === "auto") throw new Error(`${msg}. Étape non franchie.`);
    log(run, `⚠ ${msg} — régénère-les (↻) avant de valider.`);
  }
}

// ---------------------------------------------------------------- machine à états

const activeAdvance = new Set();

function scriptComplete(run) {
  return !!run.outline && !!run.levels?.length && run.levels.every((l) => l.text) && !!run.script;
}
function promptsComplete(run) {
  return !!run.scenes?.length && run.scenes.filter((s) => s.kind === "scene").every((s) => s.scene);
}
function deriveStatus(run) {
  if (!scriptComplete(run)) return "script_running";
  if (!run.scenes?.length || !run.words?.length) return "voice_running";
  if (!promptsComplete(run)) return "prompts_running";
  if (!run.ref || run.scenes.some((s) => s.kind === "scene" && !s.image)) return "images_running";
  if (!run.finalRel) return "montage_running";
  if (!run.pack) return "packaging_running";
  return "done";
}
function cancelRun(id) {
  const run = getRun(id);
  cancelledRuns.add(id);
  if (run.status !== "done" && run.status !== "failed" && !run.cancelledFrom) run.cancelledFrom = run.status;
  tasks.updateTask(run.taskId, { step: "Annulée par l'utilisateur", status: "failed" }).catch(() => {});
  if (!activeAdvance.has(id)) {
    run.status = "failed";
    run.error = "Annulée par l'utilisateur";
    log(run, "Run annulé");
  } else log(run, "Annulation demandée — abandon des requêtes en cours…");
  saveRun(run);
  return getRun(id);
}
function resumeRun(id, forcedStatus) {
  if (activeAdvance.has(id)) throw new Error("Le run tourne déjà — la décharge ⚡ n'est utile que s'il est à l'arrêt.");
  const run = getRun(id);
  cancelledRuns.delete(id);
  run.status = forcedStatus || run.cancelledFrom || (run.status === "failed" ? deriveStatus(run) : run.status);
  run.error = null;
  delete run.cancelledFrom;
  (run.scenes || []).forEach((s) => {
    if (s.kind === "scene" && s.error && !s.image) s.lastError = s.error; // → prompt adapté avant le nouvel essai
    delete s.rendering; delete s.pending; delete s.error;
  });
  (run.levels || []).forEach((l) => { delete l.rendering; delete l.error; });
  saveRun(run);
  log(run, `Reprise à l'étape « ${run.status.replace("_running", " (en cours)").replace("_ready", " (validé)")} »`);
  advance(run.id);
  return getRun(id);
}

const STEPS = [
  ["script", "Écriture du script : outline puis niveaux en parallèle (Claude)…", 6, stepScript],
  ["voice", "Voix off par niveau + Whisper + découpage…", 16, stepVoice],
  ["prompts", "Écriture des prompts d'images…", 30, stepPrompts],
  ["images", "Référence, cartes de la pyramide et images…", 42, stepImages],
];

async function advance(runId) {
  cancelledRuns.delete(runId);
  activeAdvance.add(runId);
  const run = getRun(runId);
  const auto = run.mode === "auto";
  const t = (patch) => tasks.updateTask(run.taskId, Object.assign({ status: "running" }, patch)).catch(() => {});
  try {
    await ff.ensureTools(); // préflight : ne jamais dépenser si les outils locaux manquent
    while (true) {
      if (cancelledRuns.has(runId)) throw new Error("Annulée par l'utilisateur");
      const cur = run.status;
      const step = STEPS.find(([name]) => cur === name + "_running");
      if (step) {
        await t({ step: step[1], progress: step[2] });
        await step[3](run);
        const idx = STEPS.indexOf(step);
        const next = idx + 1 < STEPS.length ? STEPS[idx + 1][0] + "_running" : "montage_running";
        run.status = auto ? next : step[0] + "_ready";
      } else if (cur === "montage_running") {
        await t({ step: "Montage final (clips, pyramides Remotion, sous-titres, CTA)…", progress: 78 });
        const out = await renderMontage(run);
        run.finalRel = `agent-os/output/machines/${run.id}/final.mp4`;
        run.status = "packaging_running";
        log(run, "Montage terminé : " + out);
      } else if (cur === "packaging_running") {
        await t({ step: "Packaging : titre, description, tags, miniature…", progress: 92 });
        if (!run.pack || !run.pack.thumbRel) await generatePackaging(run); // un re-montage ne repaie pas le packaging
        addToStock(run);
        run.status = "done";
        log(run, "Vidéo ajoutée au stock");
        if (run.params.publishChannelId) {
          await t({ step: "Publication YouTube…", progress: 97 });
          try {
            const pub = await publishRun(run.id);
            log(run, `Publiée : ${pub.url} (${pub.privacyStatus})`);
          } catch (e) {
            log(run, "⚠ Publication échouée : " + e.message);
          }
        }
      } else break; // *_ready ou done : on rend la main
      saveRun(run);
      if (run.status === "done") {
        await tasks.updateTask(run.taskId, { step: `Terminée — ${run.levels.length} niveaux, ${(run.voDuration / 60).toFixed(1)} min`, progress: 100, status: "done" }).catch(() => {});
        break;
      }
      if (run.status.endsWith("_ready")) {
        await tasks.updateTask(run.taskId, { step: `En attente de validation (${run.status.replace("_ready", "")})`, status: "running" }).catch(() => {});
        break;
      }
    }
  } catch (e) {
    run.status = "failed";
    run.error = e.message;
    log(run, "❌ " + e.message);
    saveRun(run);
    await tasks.updateTask(run.taskId, { step: e.message.slice(0, 200), status: "failed" }).catch(() => {});
  } finally {
    activeAdvance.delete(runId);
  }
  return getRun(runId);
}

function createRun(params = {}) {
  const c = config();
  const id = "p" + Date.now().toString(36);
  const durationMin = Math.max(3, Math.min(35, Number(params.durationMin) || 25));
  const levels = Math.max(4, Math.min(12, Number(params.levels) || c.settings.levels || 10));
  const language = params.language || "English";
  const subject = String(params.subject || "").trim();
  if (!subject) throw new Error("Donne un sujet (l'organisation ou la hiérarchie à gravir)");
  if (params.publishChannelId === undefined && !params.allowNoPublish && c.settings.autoPublish) throw new Error("Publication auto activée : choisis une chaîne");
  const run = {
    id,
    machineId: MACHINE_ID,
    title: subject,
    status: "script_running",
    mode: params.mode === "auto" ? "auto" : "semi",
    createdAt: new Date().toISOString(),
    params: {
      subject,
      durationMin,
      levels,
      language,
      voice: params.voice || (VOICES[language] || VOICES.English)[0],
      subtitles: params.subtitles !== false,
      publishChannelId: params.publishChannelId || null,
      publishPrivacy: params.publishPrivacy || c.settings.publishPrivacy || "private",
      channelName: params.channelName || c.settings.channelName || "POV Rank",
    },
    cost: { voice: 0, images: 0, cards: 0, ref: 0 },
    levels: [],
    scenes: [],
    cards: [],
    logs: [],
  };
  run.estimate = estimate(run.params);
  const task = tasks.createTask({
    title: `POV — ${subject.slice(0, 60)}`,
    desc: `${durationMin} min · ${levels} niveaux · ~${run.estimate.shots} images · ~${run.estimate.total.toFixed(2)} $`,
    machine: MACHINE_NAME,
    machineId: MACHINE_ID,
    runId: id,
    kind: "video",
    step: "Démarrage…",
    progress: 2,
    status: "running",
  });
  run.taskId = task.id;
  saveRun(run);
  advance(id);
  return run;
}

/** Devis affiché avant de lancer (le prix seul, en gros, à côté de Générer). */
function estimate(p) {
  const durationMin = Number(p.durationMin) || 25;
  const levels = Number(p.levels) || 10;
  const shotSec = Number(config().settings.shotSeconds) || SHOT_TARGET;
  const words = Math.round(durationMin * WPM);
  const chars = Math.round(words * 5.7) + 220;
  const shots = Math.round((durationMin * 60 - levels * PYR_SEC) / shotSec);
  const images = (shots + (levels - 1) + 1 + 1) * PRICES.image; // + cartes + référence + miniature
  const voice = (chars / 1000) * PRICES.voicePer1kChars + durationMin * 60 * PRICES.whisperPerSec;
  return { words, shots, levels, images: +images.toFixed(2), voice: +voice.toFixed(3), total: +(images + voice).toFixed(2) };
}

function validate(runId) {
  const run = getRun(runId);
  if (!run.status.endsWith("_ready")) throw new Error("Rien à valider à cette étape.");
  const stuck = (run.scenes || []).filter((s) => s.pending || s.rendering);
  if (stuck.length) throw new Error(`${stuck.length} plan(s) en cours de régénération — attends la fin.`);
  if (run.status === "images_ready") {
    const miss = run.scenes.filter((s) => s.kind === "scene" && !s.image);
    if (miss.length) throw new Error(`${miss.length} image(s) manquante(s) — régénère-les avant de valider.`);
  }
  if (run.status === "script_ready") {
    // Le script a pu être édité à la main : on le reconstitue depuis les niveaux.
    run.script = run.levels.map((l) => l.text).join(" ");
  }
  const order = ["script", "voice", "prompts", "images"];
  const cur = run.status.replace("_ready", "");
  const idx = order.indexOf(cur);
  run.status = idx + 1 < order.length ? order[idx + 1] + "_running" : "montage_running";
  saveRun(run);
  advance(runId);
  return getRun(runId);
}

/** Édition manuelle du texte d'un niveau (à l'étape script_ready). */
function patchLevel(runId, n, text) {
  const run = getRun(runId);
  if (run.status !== "script_ready") throw new Error("Le script ne s'édite qu'à l'étape « Script » validable.");
  const l = (run.levels || []).find((x) => x.n === Number(n));
  if (!l) throw new Error("Niveau introuvable");
  l.text = String(text || "").replace(/\s+/g, " ").trim();
  run.script = run.levels.map((x) => x.text).join(" ");
  saveRun(run);
  return getRun(runId);
}

// ---------------------------------------------------------------- régénération d'un plan / d'une carte

const liveRuns = new Map();
function getLiveRun(id) {
  const e = liveRuns.get(id);
  if (e) { e.n++; return e.run; }
  const run = getRun(id);
  liveRuns.set(id, { run, n: 1 });
  return run;
}
function releaseLiveRun(id) {
  const e = liveRuns.get(id);
  if (!e) return;
  if (--e.n <= 0) liveRuns.delete(id);
}

async function regenScene(runId, sceneI, instructions) {
  const run = getLiveRun(runId);
  try {
    const scene = run.scenes.find((s) => s.i === Number(sceneI));
    if (!scene) throw new Error("Plan introuvable");
    if (scene.kind !== "scene") throw new Error("Seules les images de scène se régénèrent ici");
    if (scene.pending) throw new Error("Ce plan est déjà en cours de régénération");
    scene.pending = true;
    saveRun(run);
    try {
      if (instructions) {
        const rank = run.outline.ranks[(scene.level || 1) - 1];
        const j = await genJson(
          [
            "Réécris la DESCRIPTION D'IMAGE d'un plan de documentaire dramatisé « Your Life as Every Rank in … ».",
            `Ce qui est dit pendant le plan : « ${scene.say} »`,
            `Niveau ${scene.level} — le protagoniste a ${rank.age} ans et porte : ${rank.look}.`,
            `Description actuelle : ${scene.scene}`,
            `PRIORITÉ ABSOLUE — consigne de l'utilisateur : ${instructions}`,
            "Description en ANGLAIS, 45-90 mots. Ne décris jamais le visage/les cheveux du protagoniste (la référence s'en charge) : appelle-le THE PROTAGONIST. Aucun texte dans l'image.",
            'RÉPONDS UNIQUEMENT EN JSON : {"scene":"","hasProtagonist":true}',
          ].join("\n"),
          { ms: 4 * 60 * 1000, label: "Réécriture du plan" }
        );
        if (j.scene) scene.scene = String(j.scene);
        if (j.hasProtagonist !== undefined) scene.hasProtagonist = j.hasProtagonist !== false;
      }
      const old = scene.image;
      scene.image = null;
      try {
        try {
          await generateImage(run, scene);
        } catch (e) {
          // Refus de modération : on réécrit le prompt (version implicite) et on retente une fois, comme en auto.
          if (!isPolicyError(e.message) || !(await adaptScenePrompt(run, scene, e.message))) throw e;
          await generateImage(run, scene);
        }
      } catch (e) {
        scene.image = old; // non destructif : on ne perd l'ancienne image qu'en cas de succès
        throw e;
      }
    } finally {
      delete scene.pending;
      saveRun(run);
    }
    return getRun(runId);
  } finally {
    releaseLiveRun(runId);
  }
}

async function regenCard(runId, n) {
  const run = getLiveRun(runId);
  try {
    if (!run.ref) throw new Error("Référence absente");
    const old = (run.cards || []).find((c) => c.n === Number(n));
    try { await generateCard(run, Number(n)); }
    catch (e) { if (old) { const i = run.cards.findIndex((c) => c.n === Number(n)); if (i >= 0) run.cards[i] = old; } throw e; }
    return getRun(runId);
  } finally {
    releaseLiveRun(runId);
  }
}

async function regenRef(runId) {
  const run = getLiveRun(runId);
  try {
    run.ref = null;
    await ensureRef(run);
    return getRun(runId);
  } finally {
    releaseLiveRun(runId);
  }
}

// ---------------------------------------------------------------- idées

function producedThemes() {
  const out = listRuns().map((r) => r.params?.subject || r.title);
  for (const s of stock()) out.push(s.title);
  return [...new Set(out.filter(Boolean))].slice(0, 60);
}

function ideaRules() {
  return [
    "CE QUI FAIT DÉCOLLER UN SUJET DANS CETTE NICHE (mesuré sur 24 vidéos concurrentes, 2 k → 327 k vues) :",
    "- une HIÉRARCHIE FERMÉE, secrète ou redoutée, avec des rangs NOMMÉS (armées, forces spéciales, cartels, mafias, yakuza, triades, légions, clans, prisons, ordres religieux, guildes, multinationales, écoles d'élite, gangs, sectes, cours royales…)",
    "- le spectateur peut s'imaginer y entrer en bas et y monter : la promesse est l'ASCENSION, pas le thème",
    "- il existe de la documentation réelle (grades, soldes, rituels, règlements, chiffres) pour nourrir 2-3 faits par 100 mots",
    "- les sujets sans hiérarchie à gravir (biographie, richesse, événement) performent NETTEMENT moins",
    "- ouvrir aussi à des univers NON militaires et non historiques : entreprises, sport pro, cuisine étoilée, cinéma, science, jeux vidéo, aviation civile, marine marchande, police, hôpitaux, mode…",
  ].join("\n");
}

async function suggestTheme() {
  const c = config();
  const inspiration = c.nicheId ? (() => { try { return bank.inspiration(c.nicheId, { maxTitles: 25, maxVisions: 0 }); } catch { return ""; } })() : "";
  const done = producedThemes();
  return genJson(
    [
      "Propose UN sujet de vidéo « Your Life as Every Rank in … » pour cette chaîne.",
      "",
      ideaRules(),
      "",
      inspiration ? "CE QUE FONT LES CONCURRENTS :\n" + inspiration : "",
      "",
      done.length ? "DÉJÀ PRODUIT — n'en propose NI un doublon NI une variante proche :\n" + done.map((t) => "- " + t).join("\n") : "",
      "",
      'RÉPONDS UNIQUEMENT EN JSON : {"subject":"l\'organisation/hiérarchie, en anglais, telle qu\'on la mettrait dans le titre","title":"le titre YouTube en anglais","why":"1 phrase en français : pourquoi ça va marcher"}',
    ].filter(Boolean).join("\n"),
    { ms: 5 * 60 * 1000, label: "Idée" }
  );
}

async function suggestThemes(count) {
  const c = config();
  const k = Math.min(Math.max(Number(count) || 1, 1), 8);
  const inspiration = c.nicheId ? (() => { try { return bank.inspiration(c.nicheId, { maxTitles: 15, maxVisions: 0 }); } catch { return ""; } })() : "";
  const done = producedThemes();
  const j = await genJson(
    [
      `Propose EXACTEMENT ${k} sujets de vidéos « Your Life as Every Rank in … ».`,
      `RÈGLE CAPITALE : les ${k} sujets doivent être RADICALEMENT différents ENTRE EUX (pas deux armées, pas deux cartels) — varie les époques, les continents et les types d'organisation.`,
      ideaRules(),
      done.length ? `IDÉES DÉJÀ PRODUITES — interdiction de les reprendre OU d'en proposer une PROCHE :\n- ${done.slice(0, 40).join("\n- ")}` : "",
      inspiration,
      `RÉPONDS UNIQUEMENT EN JSON : {"ideas":[{"text":"l'organisation en anglais (= le sujet)","pitch":"1 phrase en français"}]} — exactement ${k} entrées.`,
    ].filter(Boolean).join("\n"),
    { ms: 5 * 60 * 1000, label: "Idées" }
  );
  return (j.ideas || []).slice(0, k);
}

/** Commande sans wizard (restock, calendrier) : clone les params du dernier run, thème imposé ou suggéré, mode auto. */
async function orderRun({ publishChannelId, publishPrivacy, publish, overrides, theme } = {}) {
  const last = listRuns()[0];
  const c = config();
  const base = {
    durationMin: 25, levels: c.settings.levels || 10, language: c.settings.chainLanguage || "English",
    subtitles: true, ...((last && last.params) || {}), ...(overrides || {}),
  };
  const subject = theme || (await suggestTheme()).subject;
  return createRun({
    ...base,
    subject,
    mode: "auto",
    publishChannelId: publish ? publishChannelId : null,
    publishPrivacy: publishPrivacy || "private",
    allowNoPublish: !publish,
  });
}

// ---------------------------------------------------------------- maintenance

function sweepRuns() {
  let n = 0;
  for (const r of listRuns()) {
    if (!r.status?.endsWith("_running")) continue;
    try {
      const run = getRun(r.id);
      run.status = "failed";
      run.error = "Interrompue par un redémarrage du serveur";
      (run.scenes || []).forEach((s) => { delete s.rendering; delete s.pending; });
      (run.levels || []).forEach((l) => { delete l.rendering; });
      saveRun(run);
      n++;
    } catch {}
  }
  return n;
}
/** Runs marqués en cours mais sans advance() en mémoire — le cron Telegram propose de les reprendre. */
function strandedRuns() {
  return listRuns().filter((r) => r.status?.endsWith("_running") && !activeAdvance.has(r.id));
}

module.exports = {
  MACHINE_ID, MACHINE_NAME, VOICES, WPM, PRICES, PYR_SEC,
  config, patchConfig, ensureHost,
  listRuns, getRun, createRun, validate, cancelRun, resumeRun, advance, estimate, patchLevel,
  regenScene, regenCard, regenRef, suggestTheme, suggestThemes, producedThemes, orderRun,
  regenThumbnail, regenTexts,
  stock, patchStock, publishRun,
  sweepRuns, strandedRuns, totalCost,
};
