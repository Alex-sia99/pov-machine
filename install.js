#!/usr/bin/env node
/**
 * Installe la machine « POV » (« Your Life as Every Rank in … ») dans un Agent OS existant.
 *
 *   node install.js [chemin/vers/le/projet]      # défaut : le dossier parent de ce dépôt
 *   node install.js ../mon-os --dry              # simulation : dit ce qu'il ferait, n'écrit rien
 *
 * Le script copie les fichiers de la machine puis pose lui-même les points de branchement dans
 * `agent-os/server.js`, `agent-os/public/index.html`, `agent-os/public/js/core.js`,
 * `agent-os/public/js/pages/machines.js` et `remotion/src/Root.tsx`.
 *
 * IDEMPOTENT : relancé, il ne duplique rien (chaque insertion est détectée avant d'être faite).
 * Une sauvegarde `.bak-pov` est écrite à côté de chaque fichier modifié, la première fois seulement.
 * Si une ancre est introuvable (Agent OS très différent), le script ne devine pas : il affiche
 * l'instruction manuelle correspondante (voir INSTALL-LLM.md) et continue.
 */
const fs = require("fs");
const path = require("path");

const HERE = __dirname;
const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");
const target = path.resolve(argv.find((a) => !a.startsWith("--")) || path.join(HERE, ".."));

const C = { g: "\x1b[32m", y: "\x1b[33m", r: "\x1b[31m", d: "\x1b[2m", b: "\x1b[1m", x: "\x1b[0m" };
const ok = (m) => console.log(`${C.g}✓${C.x} ${m}`);
const skip = (m) => console.log(`${C.d}·${C.x} ${m}`);
const warn = (m) => console.log(`${C.y}⚠${C.x} ${m}`);
const die = (m) => { console.error(`${C.r}✗${C.x} ${m}`); process.exit(1); };
const manual = [];

// ---------------------------------------------------------------- vérifications
console.log(`\n${C.b}Machine POV → ${target}${C.x}${DRY ? `  ${C.y}(simulation)${C.x}` : ""}\n`);
const must = ["agent-os/server.js", "agent-os/public/index.html", "agent-os/public/js/core.js", "agent-os/public/js/pages/machines.js", "remotion/src/Root.tsx"];
for (const rel of must) if (!fs.existsSync(path.join(target, rel))) die(`« ${rel} » introuvable : ${target} n'a pas l'air d'être une racine d'Agent OS (le dossier qui contient agent-os/ et remotion/).`);
// Modules du socle utilisés par la machine (ils ne sont PAS fournis par ce dépôt).
const SOCLE = ["store", "claude", "vault", "fal", "ffmpeg", "google", "tasks", "spend", "bank", "scrap"];
const socleManquant = SOCLE.filter((m) => !fs.existsSync(path.join(target, "agent-os/lib", m + ".js")));
if (socleManquant.length) {
  warn(`socle incomplet : ${socleManquant.map((m) => "lib/" + m + ".js").join(", ")}`);
  warn("la machine ne démarrera pas sans ces modules — ce sont ceux d'un Agent OS standard, ce dépôt ne les duplique pas");
}

function read(rel) { return fs.readFileSync(path.join(target, rel), "utf8"); }
// Les fichiers d'un Agent OS Windows sont souvent en CRLF : tout texte inséré prend la fin de ligne du fichier cible.
const eolOf = (s) => (s.includes("\r\n") ? "\r\n" : "\n");
const withEol = (text, s) => text.replace(/\r?\n/g, eolOf(s));
function write(rel, content) {
  if (DRY) return;
  const abs = path.join(target, rel);
  const bak = abs + ".bak-pov";
  if (!fs.existsSync(bak)) fs.copyFileSync(abs, bak);
  fs.writeFileSync(abs, content, "utf8");
}

// ---------------------------------------------------------------- 1) fichiers
function copyTree(dir, { onlyIfMissing = false } = {}, rel = "") {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const r = rel ? `${rel}/${name}` : name;
    if (fs.statSync(abs).isDirectory()) { copyTree(abs, { onlyIfMissing }, r); continue; }
    const dest = path.join(target, r);
    const exists = fs.existsSync(dest);
    if (exists && onlyIfMissing) { skip(`${r} (déjà présent dans ton Agent OS, conservé)`); continue; }
    if (exists && fs.readFileSync(dest).equals(fs.readFileSync(abs))) { skip(`${r} (identique)`); continue; }
    if (!DRY) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      if (exists && !fs.existsSync(dest + ".bak-pov")) fs.copyFileSync(dest, dest + ".bak-pov");
      fs.copyFileSync(abs, dest);
    }
    ok(`${r}${exists ? " (remplacé, ancienne version en .bak-pov)" : ""}`);
  }
}
console.log(`${C.b}Fichiers${C.x}`);
copyTree(path.join(HERE, "files"));
copyTree(path.join(HERE, "if-missing"), { onlyIfMissing: true });

// ---------------------------------------------------------------- 2) server.js
console.log(`\n${C.b}agent-os/server.js${C.x}`);
{
  let s = read("agent-os/server.js");
  const before = s;

  // require : après le dernier require d'une machine, sinon après tasks
  if (s.includes('require("./lib/machines/pov")')) skip("require pov (déjà présent)");
  else {
    const all = [...s.matchAll(/const \w+ = require\("\.\/lib\/machines\/[\w-]+"\);[^\r\n]*\r?\n/g)];
    const anchor = all.length ? all[all.length - 1][0] : (s.match(/const tasks = require\("\.\/lib\/tasks"\);[^\r\n]*\r?\n/) || [null])[0];
    if (anchor) { s = s.replace(anchor, anchor + 'const pov = require("./lib/machines/pov");' + eolOf(s)); ok("require pov"); }
    else { warn("require : ancre introuvable"); manual.push('ajouter `const pov = require("./lib/machines/pov");` en haut de server.js'); }
  }

  // table des machines
  if (/const MACHINES = \{[^}]*\bpov\b/.test(s)) skip("MACHINES (déjà présent)");
  else if (/const MACHINES = \{([^}]*)\}/.test(s)) {
    s = s.replace(/const MACHINES = \{([^}]*)\}/, (m, inner) => `const MACHINES = {${inner.trimEnd().replace(/,\s*$/, "")}, pov }`);
    ok("MACHINES += pov");
  } else { warn("MACHINES : introuvable"); manual.push("ajouter `pov` à la table MACHINES de server.js"); }

  // carte du hub (/api/machines)
  if (/card\(pov\)/.test(s)) skip("GET /api/machines (déjà présent)");
  else if (/return json\(res, 200, \[(card\([^\]]*)\]\);/.test(s)) {
    s = s.replace(/return json\(res, 200, \[(card\([^\]]*)\]\);/, (m, inner) => `return json(res, 200, [${inner}, card(pov)]);`);
    ok("GET /api/machines += card(pov)");
  } else { warn("GET /api/machines : introuvable"); manual.push("ajouter `card(pov)` à la liste de GET /api/machines"); }

  // routes génériques (stock / order-info / ideas) : on étend toutes les alternatives de machines qui commencent par timetravel|
  let rx = 0;
  s = s.replace(/\(timetravel\|[a-z|]+\)/g, (m) => { if (/\|pov[|)]/.test(m)) return m; rx++; return m.slice(0, -1) + "|pov)"; });
  if (rx) ok(`routes génériques (stock / restock / idées) : ${rx} liste(s) de machines étendue(s)`);
  else skip("routes génériques (déjà étendues ou absentes)");

  // bloc de routes de la machine
  if (s.includes("// ===== MACHINE POV =====")) skip("bloc de routes (déjà présent)");
  else {
    const snippet = withEol(fs.readFileSync(path.join(HERE, "server-routes.snippet.js"), "utf8").replace(/\s*$/, "\n"), s);
    const anchors = ["    // ===== MACHINE DATA RANKING =====", "    // ===== MACHINE WEALTH =====", "    // ===== MACHINE Musique =====", "    // ===== MACHINES ====="];
    const anchor = anchors.find((a) => s.includes(a));
    if (anchor) { s = s.replace(anchor, snippet + anchor); ok("bloc de routes POV"); }
    else { warn("bloc de routes : aucune ancre trouvée"); manual.push("coller server-routes.snippet.js dans le routeur de server.js (à côté des routes des autres machines)"); }
  }

  // boot : sweepRuns + cron de sauvetage
  if (s.includes("pov.sweepRuns()")) skip("sweepRuns au boot (déjà présent)");
  else if (/const stale = ([^;]*);/.test(s)) { s = s.replace(/const stale = ([^;]*);/, (m, inner) => `const stale = ${inner} + (pov.sweepRuns() || 0);`); ok("sweepRuns au boot"); }
  else skip("sweepRuns : pas de ligne `const stale = …` (facultatif)");
  if (s.includes("pov.strandedRuns()")) skip("strandedRuns (déjà présent)");
  else if (/strandedRuns\(\)\]/.test(s)) {
    const all = [...s.matchAll(/strandedRuns\(\)\]/g)];
    const last = all[all.length - 1];
    s = s.slice(0, last.index) + "strandedRuns(), ...pov.strandedRuns()]" + s.slice(last.index + last[0].length);
    ok("strandedRuns (cron de sauvetage)");
  } else skip("strandedRuns : pas de cron de sauvetage (facultatif)");

  // manifeste des agents
  if (s.includes('{ id: "pov", name: "POV"')) skip("manifeste agents (déjà présent)");
  else if (/machines: \[\r?\n(\s*\{ id: "[\w-]+", name: "[^"]+", api: "[^"]+" \},\r?\n)+/.test(s)) {
    s = s.replace(/(machines: \[\r?\n(?:\s*\{ id: "[\w-]+", name: "[^"]+", api: "[^"]+" \},\r?\n)+)/, `$1          { id: "pov", name: "POV", api: "/api/machines/pov" },${eolOf(s)}`);
    ok("manifeste agents");
  }

  if (s !== before) write("agent-os/server.js", s);
}

// ---------------------------------------------------------------- 3) frontend
console.log(`\n${C.b}Frontend${C.x}`);
{
  let s = read("agent-os/public/index.html");
  if (s.includes("js/pages/pov.js")) skip("index.html (déjà présent)");
  else if (/(\s*<script src="js\/pages\/machines\.js"><\/script>)/.test(s)) {
    s = s.replace(/(\s*<script src="js\/pages\/machines\.js"><\/script>)/, `${eolOf(s)}  <script src="js/pages/pov.js"></script>$1`);
    write("agent-os/public/index.html", s);
    ok("index.html : <script> de la page");
  } else { warn("index.html : ancre introuvable"); manual.push('ajouter <script src="js/pages/pov.js"></script> dans agent-os/public/index.html'); }
}
{
  let s = read("agent-os/public/js/core.js");
  if (/\[[^\]]*"pov"[^\]]*\]\.includes\(name\)/.test(s)) skip("core.js (déjà présent)");
  else if (/\[([^\]]*"timetravel"[^\]]*)\]\.includes\(name\)/.test(s)) {
    s = s.replace(/\[([^\]]*"timetravel"[^\]]*)\]\.includes\(name\)/, (m, inner) => `[${inner}, "pov"].includes(name)`);
    write("agent-os/public/js/core.js", s);
    ok("core.js : surlignage de la nav « Machines »");
  } else { warn("core.js : ancre introuvable"); manual.push('ajouter "pov" au tableau de core.js qui renvoie le surlignage vers « machines »'); }
}
{
  let s = read("agent-os/public/js/pages/machines.js");
  if (s.includes('href="#/pov"')) skip("machines.js (déjà présent)");
  else {
    const card = `        <a class="bank-folder" href="#/pov" style="text-decoration:none;color:inherit">
          <div style="font-size:34px">🔺</div>
          <b>POV</b>
          <div class="small muted" style="margin-top:4px">« Your Life as Every Rank in… » — Claude (outline + 10 niveaux) → Inworld TTS + Whisper → images 2D i2i ancrées sur un protagoniste qui vieillit → pyramide Remotion → FFmpeg (sous-titres · CTA)</div>
        </a>
`;
    const placeholder = /(\s*<div class="bank-folder" style="opacity:\.55;cursor:default">)/;
    const lastCard = /(\r?\n\s*<\/a>\r?\n)(?![\s\S]*<a class="bank-folder")/;
    if (placeholder.test(s)) s = s.replace(placeholder, eolOf(s) + withEol(card, s) + "$1");
    else if (lastCard.test(s)) s = s.replace(lastCard, "$1" + withEol(card, s));
    if (s.includes('href="#/pov"')) {
      if (/const TAB_KEYS = \{([^}]*)\}/.test(s) && !s.includes('"#/pov"')) s = s.replace(/const TAB_KEYS = \{([^}]*)\}/, (m, inner) => `const TAB_KEYS = {${inner.trimEnd().replace(/,\s*$/, "")}, "#/pov": "pov-tab" }`);
      write("agent-os/public/js/pages/machines.js", s);
      ok("machines.js : carte du hub");
    } else { warn("machines.js : ancre introuvable"); manual.push("ajouter une carte POV (href #/pov) au hub des machines"); }
  }
}

// ---------------------------------------------------------------- 4) Remotion
console.log(`\n${C.b}remotion/src/Root.tsx${C.x}`);
{
  let s = read("remotion/src/Root.tsx");
  const before = s;
  const addImport = (line) => {
    const lastImport = s.lastIndexOf("\nimport ");
    const eol = s.indexOf("\n", lastImport + 1);
    s = s.slice(0, eol + 1) + withEol(line, s) + s.slice(eol + 1);
  };
  if (!s.includes('from "./PovPyramid"')) { addImport(`import { PovPyramid, povPyramidSchema, FPS as POV_FPS } from "./PovPyramid";\n`); ok("import PovPyramid"); }
  else skip("import PovPyramid (déjà présent)");
  if (!s.includes('from "./StickmanCta"')) { addImport(`import { StickmanCta, stickmanCtaSchema, FPS as SK_FPS } from "./StickmanCta";\n`); ok("import StickmanCta"); }
  else skip("import StickmanCta (déjà présent)");

  const comps = [];
  if (!s.includes('id="StickmanCta"')) comps.push(`      <Composition
        id="StickmanCta"
        component={StickmanCta}
        durationInFrames={SK_FPS * 5}
        fps={SK_FPS}
        width={1920}
        height={1080}
        schema={stickmanCtaSchema}
        defaultProps={{ label: "SUBSCRIBE", labelDone: "SUBSCRIBED", channel: "POV Rank" }}
      />
`);
  else skip("composition StickmanCta (déjà présente)");
  if (!s.includes('id="PovPyramid"')) comps.push(`      <Composition
        id="PovPyramid"
        component={PovPyramid}
        durationInFrames={POV_FPS * 3}
        fps={POV_FPS}
        width={1920}
        height={1080}
        schema={povPyramidSchema}
        defaultProps={{ dir: "pov-demo", cards: ["", "", "", "", "", "", "", "", "", ""], level: 3, label: "Level 3", seconds: 3 }}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.max(1, Math.round(props.seconds * POV_FPS)),
        })}
      />
`);
  else skip("composition PovPyramid (déjà présente)");
  if (comps.length) {
    const anchor = s.indexOf("      <Composition");
    if (anchor > 0) { s = s.slice(0, anchor) + withEol(comps.join(""), s) + s.slice(anchor); ok(`composition(s) ajoutée(s) : ${comps.length}`); }
    else { warn("Root.tsx : aucune <Composition> trouvée"); manual.push("déclarer les compositions PovPyramid et StickmanCta dans remotion/src/Root.tsx (voir INSTALL-LLM.md)"); }
  }

  if (s !== before) write("remotion/src/Root.tsx", s);
}

// ---------------------------------------------------------------- récapitulatif
console.log(`\n${C.b}Terminé.${C.x}${DRY ? ` ${C.y}Rien n'a été écrit (--dry).${C.x}` : ""}`);
if (manual.length) {
  console.log(`\n${C.y}À faire à la main (ancres non trouvées) — voir INSTALL-LLM.md, section « Installation manuelle » :${C.x}`);
  manual.forEach((m, i) => console.log(`  ${i + 1}. ${m}`));
}
console.log(`\n${C.b}Avant le premier run${C.x}
  1. Coffre d'Agent OS (Paramètres → Coffre) : ${C.b}kie${C.x} (images) et ${C.b}fal${C.x} (voix Inworld + Whisper) ; Google Drive connecté
     (la référence du protagoniste et la voix sont lues par Kie et FAL via une URL publique) ; une chaîne YouTube si tu veux publier.
  2. Vérifier Remotion : ${C.b}cd remotion && npx remotion compositions${C.x} (PovPyramid et StickmanCta doivent apparaître).
  3. Redémarrer Agent OS, ouvrir ${C.b}Machines → 🔺 POV${C.x} : une organisation à gravir (ou 💡), la durée → ⚙ Générer.
  4. Facultatif mais recommandé : une niche « POV » dans la Banque de niches (chaîne POVrank scrappée) pour les idées et les
     miniatures de référence — sinon la machine tourne en mode générique.

Recette de la niche : ${C.b}agent-os/docs/RECETTE-NICHE-POV.md${C.x}
`);
