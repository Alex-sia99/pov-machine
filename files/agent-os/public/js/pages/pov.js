/**
 * MACHINE POV — onglets : Générer / Runs / Stock / Paramètres.
 * Wizard identique aux autres machines (rail wiz-head / wiz-rail / wiz-scroll).
 *
 * Particularité : pas de troupe de personnages. Le protagoniste est créé PAR RUN (référence
 * générée à l'étape Images) ; le présentateur du CTA est un asset de la machine (Paramètres).
 * Étapes : Script (outline + niveaux) → Voix (par niveau) → Prompts → Images (réf + cartes + plans) → Montage → Fini.
 */
AgentOS.register("pov", {
  title: "POV",
  async render(el, params) {
    const { api, esc, ago } = AgentOS;
    let cfg = await api("/api/machines/pov");
    const TABS = ["gen", "runs", "stock", "settings"];
    let tab = TABS.includes(localStorage.getItem("pov-tab")) ? localStorage.getItem("pov-tab") : "gen";
    let wizTimer = null;
    this.onLeave = () => clearTimeout(wizTimer);

    const LANGS = Object.keys(cfg.voices || { English: [] });
    const media = (rel, ts) => `/media/${encodeURIComponent(rel)}${ts ? `?v=${ts}` : ""}`;

    function shell() {
      el.innerHTML = `
        <div class="card">
          <h2><a href="#/machines" class="back-btn" style="margin-right:10px" title="Retour aux Machines">←</a>🔺 POV
            <span class="h-actions">
              <span class="mini-seg" id="pov-tabs">
                <button data-t="gen" class="${tab === "gen" ? "active" : ""}">⚙ Générer</button>
                <button data-t="runs" class="${tab === "runs" ? "active" : ""}">🎞 Runs</button>
                <button data-t="stock" class="${tab === "stock" ? "active" : ""}">📦 Stock</button>
                <button data-t="settings" class="${tab === "settings" ? "active" : ""}">🛠 Paramètres</button>
              </span>
            </span>
          </h2>
          <div id="pov-body"></div>
        </div>`;
      el.querySelectorAll("#pov-tabs button").forEach((b) =>
        b.addEventListener("click", () => {
          tab = b.dataset.t;
          try { localStorage.setItem("pov-tab", tab); } catch {}
          shell();
        })
      );
      ({ gen: renderGen, runs: renderRuns, stock: renderStock, settings: renderSettings })[tab]();
    }

    // ═══════════════════════════ Onglet Générer ═══════════════════════════
    async function renderGen() {
      const body = el.querySelector("#pov-body");
      let chans = [];
      try { chans = await api("/api/channels"); } catch {}
      const lang = cfg.voices[cfg.settings.chainLanguage] ? cfg.settings.chainLanguage : "English";
      const defLevels = Number(cfg.settings.levels) || 10;

      body.innerHTML = `
        <label class="field"><span>Organisation / hiérarchie à gravir <span class="muted">(« Your Life as Every Rank in … »)</span></span>
          <span class="row" style="gap:6px">
            <input id="g-subject" class="grow" placeholder="ex : the French Foreign Legion · a Michelin-starred kitchen · a Formula 1 team">
            <button class="btn btn-sm" id="g-idea" title="Proposer un sujet d'après la banque de niche">💡</button>
          </span></label>
        <div class="grid grid-4 mb" style="align-items:end">
          <label class="field" style="margin:0"><span>Langue de la voix</span>
            <select id="g-lang">${LANGS.map((l) => `<option${l === lang ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
          <label class="field" style="margin:0"><span>Voix Inworld</span>
            <select id="g-voice"></select></label>
          <label class="field" style="margin:0"><span>Durée : <b id="g-dlbl">25</b> min <span class="muted">(~<b id="g-wlbl">3750</b> mots)</span></span>
            <input type="range" id="g-dur" min="3" max="35" value="25" style="width:100%"></label>
          <label class="field" style="margin:0"><span>Niveaux : <b id="g-llbl">${defLevels}</b> <span class="muted">(niche : 10)</span></span>
            <input type="range" id="g-levels" min="4" max="12" value="${defLevels}" style="width:100%"></label>
        </div>
        <div class="fbar mb" style="padding:10px 12px;flex-wrap:wrap;gap:12px">
          <span class="fbar-item"><span>Sous-titres</span>
            <span class="mini-seg" id="g-sub"><button data-v="0">Non</button><button data-v="1" class="active">Oui</button></span></span>
          <span class="fbar-item"><span>Mode</span>
            <span class="mini-seg" id="g-mode"><button class="active" data-v="semi">Semi-manuel</button><button data-v="auto">100 % auto</button></span></span>
        </div>
        <div class="fbar mb" style="padding:10px 12px">
          <span class="fbar-item"><span>Publication automatique directe</span>
            <span class="mini-seg" id="g-pub"><button class="active" data-v="0">Non</button><button data-v="1">Oui</button></span></span>
          <span class="fbar-item" id="g-pubchan-wrap" style="display:none"><span>Chaîne</span>
            <select id="g-pubchan" style="min-width:170px"><option value="">— choisis la chaîne —</option></select> <select id="g-pubpriv" style="width:150px" title="Mode de publication automatique"><option value="private" selected>🔒 Privée</option><option value="unlisted">🔗 Non répertoriée</option><option value="public">🌍 Publique</option></select></span>
          <span id="g-cost" style="margin-left:auto;font-weight:800;font-size:17px;color:#4ade80;background:rgba(74,222,128,.09);border:1px solid rgba(74,222,128,.35);border-radius:10px;padding:9px 16px;white-space:nowrap"></span>
          <button class="btn btn-accent" id="g-go" style="font-size:14px;padding:10px 22px">⚙ Générer</button>
        </div>
        <div class="small muted" style="text-align:right">Script (outline + niveaux) → Voix → Prompts → Référence + cartes + images → Montage (pyramides · sous-titres · CTA) → Packaging</div>`;

      const $ = (s) => body.querySelector(s);
      const seg = (id, cb) => body.querySelectorAll(`#${id} button`).forEach((b) =>
        b.addEventListener("click", () => { body.querySelectorAll(`#${id} button`).forEach((x) => x.classList.toggle("active", x === b)); cb && cb(b.dataset.v); }));
      const activeVal = (id) => body.querySelector(`#${id} button.active`).dataset.v;

      const fillVoices = () => {
        const vs = cfg.voices[$("#g-lang").value] || cfg.voices.English;
        $("#g-voice").innerHTML = vs.map((v) => `<option>${esc(v)}</option>`).join("");
      };
      fillVoices();
      $("#g-lang").addEventListener("change", fillVoices);
      seg("g-sub");
      seg("g-mode");

      // Juste le prix, gros — le détail vit dans l'infobulle
      const costLine = async () => {
        const d = Number($("#g-dur").value) || 25;
        const lv = Number($("#g-levels").value) || 10;
        $("#g-dlbl").textContent = d;
        $("#g-llbl").textContent = lv;
        $("#g-wlbl").textContent = Math.round(d * 150);
        try {
          const e = await api("/api/machines/pov/estimate", { method: "POST", body: { durationMin: d, levels: lv } });
          const c = $("#g-cost");
          c.textContent = `≈ ${e.total.toFixed(2)} $`;
          c.title = `~${e.shots} images de scène + ${e.levels - 1} cartes + référence + miniature (${e.images.toFixed(2)}$) · voix off + Whisper ${e.voice.toFixed(2)}$`;
        } catch {}
      };
      $("#g-dur").addEventListener("input", costLine);
      $("#g-levels").addEventListener("input", costLine);
      costLine();

      const pubChan = $("#g-pubchan");
      const goBtn = $("#g-go");
      const pubOn = () => activeVal("g-pub") === "1";
      // Chaîne obligatoire quand la publication automatique est activée.
      const gateGo = () => (goBtn.disabled = pubOn() && !pubChan.value);
      const setSeg = (id, v) => body.querySelectorAll(`#${id} button`).forEach((x) => x.classList.toggle("active", x.dataset.v === v));
      const syncModes = () => {
        $("#g-pubchan-wrap").style.display = pubOn() ? "" : "none";
        gateGo();
      };
      pubChan.innerHTML = `<option value="">— choisis la chaîne —</option>` + chans.filter((c) => !c.error).map((c) => `<option value="${esc(c.channelId)}">${esc(c.title)}</option>`).join("");
      pubChan.addEventListener("change", gateGo);
      body.querySelectorAll("#g-pub button").forEach((b) =>
        b.addEventListener("click", () => {
          setSeg("g-pub", b.dataset.v);
          syncModes();
        })
      );
      syncModes();

      $("#g-idea").addEventListener("click", async () => {
        const input = $("#g-subject"), btn = $("#g-idea");
        input.classList.add("ai-thinking"); input.disabled = true; input.value = ""; input.placeholder = "💡 Je fouille la niche…";
        btn.disabled = true; btn.textContent = "⏳";
        try {
          const j = await api("/api/machines/pov/idea", { method: "POST" });
          input.value = j.subject || j.title || "";
          if (j.why) AgentOS.toast("💡 " + j.why, "ok");
        } catch (e) { AgentOS.toast(e.message, "err"); }
        input.classList.remove("ai-thinking"); input.disabled = false;
        input.placeholder = "ex : the French Foreign Legion · a Michelin-starred kitchen · a Formula 1 team";
        btn.disabled = false; btn.textContent = "💡";
      });

      goBtn.addEventListener("click", async () => {
        const subject = $("#g-subject").value.trim();
        if (!subject) return AgentOS.toast("Donne une organisation, ou clique 💡", "err");
        goBtn.disabled = true; goBtn.textContent = "⏳ Lancement…";
        try {
          const run = await api("/api/machines/pov/runs", { method: "POST", body: {
            subject,
            durationMin: Number($("#g-dur").value),
            levels: Number($("#g-levels").value),
            language: $("#g-lang").value,
            voice: $("#g-voice").value,
            subtitles: activeVal("g-sub") === "1",
            mode: activeVal("g-mode"),
            publishChannelId: pubOn() ? pubChan.value : null,
            publishPrivacy: $("#g-pubpriv").value,
            allowNoPublish: !pubOn(),
          }});
          AgentOS.toast("🚀 Run lancé", "ok");
          openWizard(run.id);
        } catch (e) { AgentOS.toast(e.message, "err"); }
        goBtn.disabled = false; goBtn.textContent = "⚙ Générer";
        gateGo();
      });
    }

    // ═══════════════════════════ Wizard ═══════════════════════════
    const STEPS = [
      { key: "script", icon: "📝", label: "Script" },
      { key: "voice", icon: "🎙", label: "Voix" },
      { key: "prompts", icon: "✍", label: "Prompts" },
      { key: "images", icon: "🖼", label: "Images" },
      { key: "montage", icon: "🎬", label: "Montage" },
    ];
    const FINI = STEPS.length;

    function stepIndex(status) {
      const i = STEPS.findIndex((s) => status.startsWith(s.key));
      return i < 0 ? FINI : i;
    }
    const sceneShots = (run) => (run.scenes || []).filter((s) => s.kind === "scene");
    function stepDone(run, i) {
      const sc = sceneShots(run);
      if (i === 0) return !!run.script;
      if (i === 1) return !!(sc.length && run.words?.length);
      if (i === 2) return !!(sc.length && sc.every((s) => s.scene));
      if (i === 3) return !!(run.ref && sc.length && sc.every((s) => s.image));
      return !!run.finalRel;
    }
    function globalPct(run) {
      const sc = sceneShots(run);
      const n = sc.length || 1;
      const done = sc.filter((s) => s.image).length;
      const map = { script_running: 6, script_ready: 14, voice_running: 18, voice_ready: 28, prompts_running: 30, prompts_ready: 40, images_ready: 76, montage_running: 80, packaging_running: 94, done: 100 };
      if (run.status === "images_running") return 44 + Math.round((30 * done) / n);
      if (run.status === "script_running") return 4 + Math.round((10 * (run.levels || []).filter((l) => l.text).length) / Math.max(1, (run.levels || []).length || run.params.levels));
      return map[run.status] ?? 8;
    }
    function countHTML(run) {
      const sc = sceneShots(run);
      const live = (run.scenes || []).filter((s) => s.pending || s.rendering).length;
      if (run.status.startsWith("script")) return `📝 ${(run.levels || []).filter((l) => l.text).length}/${(run.levels || []).length || run.params.levels} niveaux`;
      if (!sc.length) return "";
      if (run.status.startsWith("images")) {
        const done = sc.filter((s) => s.image).length;
        const fail = sc.filter((s) => !s.image && s.error).length;
        const cards = (run.cards || []).length;
        return `🖼 ${done}/${sc.length} images · 🔺 ${cards}/${(run.levels || []).length - 1} cartes${live ? ` · ${live} en cours` : ""}${fail ? ` · <span style="color:var(--err)">${fail} échec</span>` : ""}`;
      }
      if (run.status.startsWith("prompts")) return `✍ ${sc.filter((s) => s.scene).length}/${sc.length} prompts`;
      if (run.status.startsWith("voice") || run.status.startsWith("montage")) return `🎞 ${sc.length} visuel(s) · ${(run.levels || []).length} pyramides`;
      return "";
    }

    function openWizard(runId) {
      const overlay = document.createElement("div");
      overlay.className = "picker-overlay";
      overlay.innerHTML = `<div class="scrap-modal lg" id="wiz"><span class="spin"></span></div>`;
      document.body.appendChild(overlay);
      const tick = async () => {
        let run;
        try { run = await api("/api/machines/pov/runs/" + runId); }
        catch (e) { overlay.querySelector("#wiz").innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
        const box = overlay.querySelector("#wiz");
        const sc = run.scenes || [];
        const nb = (f) => sc.filter((s) => s[f]).length;
        const shellKey = [run.status, box.dataset.view || "", sc.length, run.error ? 1 : 0, nb("scene"), nb("image"),
          sc.filter((s) => s.pending || s.rendering).length, (run.levels || []).filter((l) => l.text).length, (run.cards || []).length,
          run.ref ? run.ref.ts : 0, run.finalRel ? 1 : 0, run.pack ? run.pack.thumbTs || 1 : 0,
          run.published ? 1 : 0].join("|");
        if (box.dataset.shellKey !== shellKey || !box.querySelector(".wiz-scroll")) {
          box.dataset.shellKey = shellKey;
          renderWizard(box, run, overlay);
        }
        if (!["done", "failed"].includes(run.status) && document.body.contains(overlay)) {
          clearTimeout(wizTimer);
          wizTimer = setTimeout(tick, 4000);
        }
      };
      tick();
    }

    function renderWizard(box, run, overlay) {
      const idx = stepIndex(run.status);
      const running = run.status.endsWith("_running");
      const viewIdx = box.dataset.view !== undefined && box.dataset.view !== "" ? Number(box.dataset.view) : Math.min(idx, FINI);
      const prevScroll = box.querySelector(".wiz-scroll")?.scrollTop || 0;
      const gpct = globalPct(run);
      const validateLabel = {
        script_ready: "✓ Valider le script → Voix",
        voice_ready: "✓ Valider le découpage → Prompts",
        prompts_ready: "✓ Valider les prompts → Images",
        images_ready: "✓ Valider les images → Montage",
      }[run.status];
      const runMsg = {
        script_running: "Claude écrit l'outline puis les niveaux (5 en parallèle)…",
        voice_running: "Inworld synthétise chaque niveau, Whisper transcrit, la machine découpe…",
        prompts_running: "Écriture des descriptions d'images…",
        images_running: "Référence du protagoniste, cartes de la pyramide, puis images (5 en parallèle)…",
        montage_running: "Montage final (clips + pyramides Remotion + sous-titres + CTA)…",
        packaging_running: "Claude prépare titre, description, tags et miniature…",
      }[run.status] || "";
      const cost = run.cost ? (run.cost.images || 0) + (run.cost.voice || 0) + (run.cost.cards || 0) + (run.cost.ref || 0) : 0;

      box.classList.add("wiz-modal");
      box.innerHTML = `
        <div class="wiz-head">
          <div class="wiz-gbar" title="Progression : ${gpct}%"><div style="width:${gpct}%"></div></div>
          <div class="row between" style="margin:10px 0 4px">
            <h2 style="margin:0;font-size:15px">🔺 ${esc(run.pack?.title || run.title)}
              <span class="small muted mono" style="margin-left:8px">${run.id} · ${run.mode} · ${esc(run.params.language)} · ${run.params.levels} niveaux · ${cost.toFixed(2)}$ · ${gpct}%</span></h2>
            <span class="row" style="gap:6px">
              ${run.status !== "done" ? `<button class="btn btn-sm" data-zap-run title="⚡ Décharge : relance le run là où il s'est arrêté">⚡</button>` : ""}
              ${!["done", "failed"].includes(run.status) ? `<button class="btn btn-sm" data-cancel-run title="Annuler ce run">🛑 Annuler</button>` : ""}
              <button class="btn btn-sm btn-ghost" data-close>✕</button>
            </span>
          </div>
          <div class="wiz-rail">
            ${STEPS.map((s, i) => `
              <div class="wiz-step ${stepDone(run, i) ? "done" : i === idx ? "active" : ""}" data-view="${i}" style="cursor:pointer" title="${s.label}">
                <div class="wiz-dot" ${i === viewIdx ? 'style="outline:2px solid var(--accent);outline-offset:3px"' : ""}${!stepDone(run, i) && i < idx ? ' data-gap="1"' : ""}>${stepDone(run, i) ? "✓" : i < idx ? "⚠" : s.icon}</div><span>${s.label}</span>
              </div>
              ${i < STEPS.length - 1 ? `<div class="wiz-link ${stepDone(run, i) ? "done" : i === idx && running ? "active" : ""}"></div>` : ""}`).join("")}
            <div class="wiz-link ${run.status === "done" ? "done" : run.status === "packaging_running" ? "active" : ""}"></div>
            <div class="wiz-step ${run.status === "done" ? "done" : ""}" data-view="${FINI}" style="cursor:pointer" title="Titre, description, tags, miniature, publication">
              <div class="wiz-dot" ${viewIdx === FINI ? 'style="outline:2px solid var(--accent);outline-offset:3px"' : ""}>🏁</div><span>Fini</span>
            </div>
          </div>
          ${run.error ? `<div class="empty small" style="color:var(--err);margin:0"><b>Échec</b>${esc(run.error)} <button class="btn btn-sm" data-retry>↻ Reprendre où on s'est arrêté</button></div>` : ""}
          ${running ? `<div class="small muted"><span class="spin" style="width:12px;height:12px"></span> ${esc(runMsg)}</div>` : ""}
          <div class="small" style="font-weight:600;color:var(--accent)">${countHTML(run)}</div>
        </div>
        <div class="wiz-scroll">${viewHTML(run, viewIdx)}</div>
        ${validateLabel ? `<div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn btn-accent" data-validate>${validateLabel}</button></div>` : ""}`;

      box.querySelector("[data-close]").addEventListener("click", () => { clearTimeout(wizTimer); overlay.remove(); });
      box.querySelectorAll(".wiz-step[data-view]").forEach((s) => s.addEventListener("click", () => {
        box.dataset.view = s.dataset.view;
        renderWizard(box, run, overlay);
      }));
      const on = (sel, fn) => { const b = box.querySelector(sel); if (b) b.addEventListener("click", () => fn(b)); };
      const reopen = () => { clearTimeout(wizTimer); overlay.remove(); openWizard(run.id); };
      on("[data-validate]", async (b) => {
        b.disabled = true; b.textContent = "⏳";
        try { await api(`/api/machines/pov/runs/${run.id}/validate`, { method: "POST" }); reopen(); }
        catch (e) { AgentOS.toast(e.message, "err"); b.disabled = false; }
      });
      on("[data-cancel-run]", async (b) => {
        b.disabled = true;
        try { await api(`/api/machines/pov/runs/${run.id}/cancel`, { method: "POST" }); AgentOS.toast("Run annulé 🛑", "ok"); reopen(); }
        catch (e) { AgentOS.toast(e.message, "err"); b.disabled = false; }
      });
      const zap = async (b) => {
        b.disabled = true;
        try { await api(`/api/machines/pov/runs/${run.id}/resume`, { method: "POST", body: {} }); AgentOS.toast("⚡ Décharge envoyée — le run repart", "ok"); reopen(); }
        catch (e) { AgentOS.toast(e.message, "err"); b.disabled = false; }
      };
      on("[data-zap-run]", zap);
      on("[data-retry]", zap);

      wireView(box, run, viewIdx, reopen);
      const sc = box.querySelector(".wiz-scroll");
      if (sc) sc.scrollTop = prevScroll;
    }

    // ── Contenu d'une étape ──
    function viewHTML(run, viewIdx) {
      const key = STEPS[viewIdx]?.key || "fini";
      const o = run.outline;

      if (key === "script") {
        if (!o) return `<div class="empty small"><span class="spin"></span> Claude écrit l'outline…</div>`;
        const editable = run.status === "script_ready";
        const n = (run.script || run.levels.map((l) => l.text || "").join(" ")).split(/\s+/).filter(Boolean).length;
        return `<div class="small muted mb">${n} mots · ~${(n / 150).toFixed(1)} min estimées · protagoniste : <b>${esc(o.protagonist?.name || "")}</b>${editable ? " · le texte de chaque niveau est éditable" : ""}</div>
          ${o.ranks.map((r) => {
            const l = (run.levels || []).find((x) => x.n === r.n) || {};
            return `<div class="scrap-row" style="flex-direction:column;align-items:stretch;gap:6px;padding:10px 12px">
              <div class="row between" style="align-items:center">
                <b class="small">Level ${r.n} — ${esc(r.native || "")} <span class="muted">(${esc(r.name || "")}, ${r.age} ans)</span></b>
                <span class="small muted mono">${l.text ? l.text.split(/\s+/).length + " mots" : "⏳"}${r.evalWord ? ` · « ${esc(r.evalWord)} »` : ""}</span>
              </div>
              <div class="small muted">${esc(r.beat || "")}</div>
              ${l.text
                ? editable
                  ? `<textarea data-level="${r.n}" rows="6" style="width:100%;font-size:12px;line-height:1.55">${esc(l.text)}</textarea>`
                  : `<div class="small" style="white-space:pre-wrap;line-height:1.6">${esc(l.text)}</div>`
                : `<div class="small muted"><span class="spin" style="width:10px;height:10px"></span> en écriture…</div>`}
            </div>`;
          }).join("")}`;
      }

      if (key === "voice") {
        if (!run.voRel) return `<div class="empty small"><span class="spin"></span> Synthèse de la voix off, niveau par niveau…</div>`;
        const st = run.shotStats;
        return `<audio controls src="${media(run.voRel)}" style="width:100%;margin-bottom:10px"></audio>
          ${st ? `<div class="row mb" style="gap:18px;flex-wrap:wrap">
            <span class="small"><b>${st.count}</b> images de scène</span>
            <span class="small"><b>${(run.levels || []).length}</b> pyramides (${run.levels?.[0] ? "3 s chacune" : ""})</span>
            <span class="small">médiane <b>${st.median} s</b> <span class="muted">(niche : ~6 s)</span></span>
            <span class="small"><b>${st.perMin}</b> plans/min <span class="muted">(niche : ~10)</span></span>
            <span class="small">CTA <b>${run.ctaDuration ? run.ctaDuration.toFixed(1) + " s" : "—"}</b> après le niveau 3</span>
          </div>` : ""}
          ${(run.scenes || []).map((s) => `<div class="scrap-row" style="gap:10px${s.kind !== "scene" ? ";background:rgba(255,255,255,.03)" : ""}">
            <span class="small mono" style="flex:none;width:96px">${s.start}s +${s.dur}s</span>
            <span class="badge" style="flex:none;width:78px;text-align:center">${s.kind === "pyramid" ? "🔺 L" + s.level : s.kind === "cta" ? "📣 CTA" : "L" + s.level}</span>
            <span class="small grow" style="min-width:0">${esc(s.say || (s.kind === "pyramid" ? "Pyramide + zoom sur le niveau " + s.level : ""))}</span>
          </div>`).join("")}`;
      }

      if (key === "prompts") {
        const sc = sceneShots(run);
        if (!sc.some((s) => s.scene)) return `<div class="empty small"><span class="spin"></span> Écriture des descriptions d'images…</div>`;
        return sc.map((s) => `
          <div class="scrap-row" style="gap:10px;align-items:flex-start">
            <span class="small mono" style="flex:none;width:30px">${s.i}</span>
            <span class="badge" style="flex:none;width:64px;text-align:center">${esc(s.type || "medium")}</span>
            <span class="small muted mono" style="flex:none;width:28px">L${s.level}</span>
            <span class="small grow" style="min-width:0">${esc(s.scene || "…")}</span>
          </div>`).join("");
      }

      if (key === "images") {
        const cards = run.cards || [];
        const lastN = (run.levels || []).length;
        return `
          <div class="row mb" style="gap:14px;align-items:flex-start;flex-wrap:wrap">
            <div style="flex:none;width:220px">
              <div class="small muted" style="margin-bottom:4px">Référence du protagoniste</div>
              ${run.ref ? `<img src="${media(run.ref.rel, run.ref.ts)}" style="width:220px;border-radius:8px;border:1px solid var(--border-soft)">` : `<div class="empty small" style="height:118px;margin:0;display:flex;align-items:center;justify-content:center">${run.status === "images_running" ? '<span class="spin"></span>' : "—"}</div>`}
              ${run.ref && !run.status.endsWith("_running") ? `<button class="mini-btn" data-regen-ref style="margin-top:4px" title="Régénérer la référence (les images suivantes en dériveront)">↻ Référence</button>` : ""}
            </div>
            <div class="grow" style="min-width:0">
              <div class="small muted" style="margin-bottom:4px">Cartes de la pyramide (le sommet reste une silhouette)</div>
              <div class="row" style="gap:6px;flex-wrap:wrap">
                ${(run.levels || []).map((l) => {
                  const c = cards.find((x) => x.n === l.n);
                  if (l.n === lastN) return `<div style="width:104px;height:58px;border-radius:6px;background:#15171b;display:flex;align-items:center;justify-content:center;color:#ff2a2a;font-size:18px;border:2px solid #111" title="Level ${l.n} : silhouette">👁</div>`;
                  return `<div style="position:relative;width:104px">
                    ${c ? `<img src="${media(c.rel, c.ts)}" style="width:104px;height:58px;object-fit:cover;border-radius:6px;border:2px solid #111">` : `<div class="empty small" style="width:104px;height:58px;margin:0;display:flex;align-items:center;justify-content:center;box-sizing:border-box">${l.rendering ? '<span class="spin"></span>' : "⏳"}</div>`}
                    <span class="small mono" style="position:absolute;left:4px;bottom:2px;color:#fff;text-shadow:0 0 3px #000">L${l.n}</span>
                    ${c && !run.status.endsWith("_running") ? `<button class="mini-btn" data-regen-card="${l.n}" style="position:absolute;right:2px;top:2px;padding:0 4px" title="Régénérer la carte">↻</button>` : ""}
                  </div>`;
                }).join("")}
              </div>
            </div>
          </div>
          <div class="row" style="gap:8px;flex-wrap:wrap">${sceneShots(run).map((s) => `
          <div class="scrap-row" style="flex-direction:column;align-items:stretch;gap:4px;padding:6px;width:200px;${s.error && !s.image ? "border-color:var(--err)" : ""}">
            ${s.image
              ? `<img src="${media(s.image.rel, s.image.ts)}" style="width:100%;height:106px;object-fit:cover;border-radius:6px">`
              : `<div class="empty small" style="height:106px;margin:0;display:flex;align-items:center;justify-content:center">${s.pending || s.rendering ? '<span class="spin"></span>' : s.error ? "❌" : "⏳"}</div>`}
            <span class="row between" style="align-items:center">
              <span class="small mono">${s.i} · L${s.level} · ${s.dur}s</span>
              <button class="mini-btn" data-regen-shot="${s.i}" title="Régénérer ce plan" ${s.pending ? "disabled" : ""}>↻</button>
            </span>
          </div>`).join("")}</div>`;
      }

      if (key === "montage") {
        if (!run.finalRel) return run.status === "montage_running"
          ? `<div class="empty small"><span class="spin"></span> Montage en cours (clips + pyramides + sous-titres + CTA)…</div>`
          : `<div class="empty small">Le montage n'est pas encore rendu.</div>`;
        return `<video src="${media(run.finalRel)}" controls style="width:100%;max-height:430px;border-radius:12px;background:#000"></video>
          <div class="row between mt"><span class="small muted">${sceneShots(run).length} images · ${(run.levels || []).length} niveaux · ${(run.voDuration / 60).toFixed(1)} min</span>
            <a class="btn btn-sm btn-accent" href="${media(run.finalRel)}" download>⬇ Télécharger</a></div>`;
      }

      // ── Fini ──
      const pk = run.pack;
      if (!pk) return run.status === "packaging_running"
        ? `<div class="empty small"><span class="spin"></span> Claude prépare titre, description, tags et miniature…</div>`
        : `<div class="empty small">La vidéo n'est pas encore montée.</div>`;
      return `
        ${run.published?.url
          ? `<div class="empty small" style="margin:0 0 10px;color:#4ade80;border-color:rgba(74,222,128,.4)"><b>📤 Publiée (${esc(run.published.privacyStatus)})</b><a href="${esc(run.published.url)}" target="_blank">▶ Voir sur YouTube</a></div>`
          : `<div class="small muted" style="margin-bottom:8px">📦 La vidéo attend dans le <b>Stock</b> — publie-la ci-dessous quand tu veux.</div>`}
        <div class="row" style="gap:16px;align-items:flex-start">
          <div style="flex:none;width:290px">
            ${pk.thumbRel ? `<img src="${media(pk.thumbRel, pk.thumbTs)}" style="width:290px;border-radius:10px;border:1px solid var(--border-soft)">` : `<div class="empty small">Pas de miniature</div>`}
            <div class="small muted" style="text-align:center;margin-top:4px">Miniature (code chaîne : rang 1 à gauche, rang 10 à droite, zéro texte)</div>
            <div class="row" style="gap:5px;margin-top:6px">
              <input type="text" id="pk-thumb-instr" placeholder="Observation (optionnel)…" style="flex:1;font-size:11px">
              <button class="mini-btn" data-regen-thumb title="Régénérer la miniature">🎨</button>
            </div>
            ${run.finalRel ? `<a class="btn btn-sm btn-ghost" style="width:100%;margin-top:8px;text-align:center" href="${media(run.finalRel)}" download>⬇ Télécharger la vidéo</a>` : ""}
          </div>
          <div class="grow" style="min-width:0">
            <input type="text" id="pk-text-instr" placeholder="Observation pour régénérer un texte (optionnel)…" style="width:100%;font-size:11px;margin-bottom:8px">
            <label class="field"><span class="row between">Titre <span class="row" style="gap:5px"><span class="small muted mono">${(pk.title || "").length}/100</span><button class="mini-btn" data-copy="pk-title">📋</button><button class="mini-btn" data-regen-text="title">↻💡</button></span></span><input type="text" id="pk-title" value="${esc(pk.title || "")}"></label>
            <label class="field"><span class="row between">Description <span class="row" style="gap:5px"><button class="mini-btn" data-copy="pk-desc">📋</button><button class="mini-btn" data-regen-text="description">↻💡</button></span></span><textarea id="pk-desc" rows="6">${esc(pk.description || "")}</textarea></label>
            <label class="field"><span class="row between">Tags <span class="row" style="gap:5px"><span class="small muted mono">${(pk.tags || []).join(", ").length}/500</span><button class="mini-btn" data-copy="pk-tags">📋</button><button class="mini-btn" data-regen-text="tags">↻💡</button></span></span><textarea id="pk-tags" rows="2">${esc((pk.tags || []).join(", "))}</textarea></label>
            <div class="row" style="gap:8px">
              <select id="pk-chan" style="flex:1"><option value="">— chaîne YouTube —</option></select>
              <select id="pk-priv" style="width:170px" title="Mode de publication">
                <option value="private" selected>🔒 Privée</option>
                <option value="unlisted">🔗 Non répertoriée</option>
                <option value="public">🌍 Publique</option>
              </select>
              <button class="btn btn-sm btn-accent" data-publish disabled>📤 Publier</button>
            </div>
          </div>
        </div>`;
    }

    // ── Interactions d'une étape ──
    function wireView(box, run, viewIdx, reopen) {
      // Édition des niveaux (script_ready) : sauvegarde au blur
      box.querySelectorAll("textarea[data-level]").forEach((ta) => ta.addEventListener("change", async () => {
        try { await api(`/api/machines/pov/runs/${run.id}/level`, { method: "POST", body: { n: Number(ta.dataset.level), text: ta.value } }); AgentOS.toast(`Niveau ${ta.dataset.level} enregistré`, "ok"); }
        catch (e) { AgentOS.toast(e.message, "err"); }
      }));

      box.querySelectorAll("[data-regen-shot]").forEach((b) => b.addEventListener("click", async () => {
        const ins = prompt("Consigne pour ce plan (laisse vide pour le redessiner à l'identique) :", "");
        if (ins === null) return;
        b.disabled = true; b.textContent = "⏳";
        try { await api(`/api/machines/pov/runs/${run.id}/regen`, { method: "POST", body: { scene: b.dataset.regenShot, instructions: ins } }); reopen(); }
        catch (e) { AgentOS.toast(e.message, "err"); b.disabled = false; b.textContent = "↻"; }
      }));
      box.querySelectorAll("[data-regen-card]").forEach((b) => b.addEventListener("click", async () => {
        b.disabled = true; b.textContent = "⏳";
        try { await api(`/api/machines/pov/runs/${run.id}/card`, { method: "POST", body: { n: Number(b.dataset.regenCard) } }); reopen(); }
        catch (e) { AgentOS.toast(e.message, "err"); b.disabled = false; b.textContent = "↻"; }
      }));
      const rr = box.querySelector("[data-regen-ref]");
      if (rr) rr.addEventListener("click", async () => {
        if (!confirm("Régénérer la référence du protagoniste ? Les images déjà faites ne changent pas (régénère-les ensuite si besoin).")) return;
        rr.disabled = true; rr.textContent = "⏳";
        try { await api(`/api/machines/pov/runs/${run.id}/ref`, { method: "POST", body: {} }); reopen(); }
        catch (e) { AgentOS.toast(e.message, "err"); rr.disabled = false; rr.textContent = "↻ Référence"; }
      });

      box.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", (e) => {
        e.preventDefault();
        const src = box.querySelector("#" + b.dataset.copy);
        if (src) { navigator.clipboard.writeText(src.value); AgentOS.toast("Copié 📋", "ok"); }
      }));

      box.querySelectorAll("[data-regen-text]").forEach((b) => b.addEventListener("click", async () => {
        const instructions = box.querySelector("#pk-text-instr")?.value || "";
        b.disabled = true; b.textContent = "⏳";
        try { await api(`/api/machines/pov/runs/${run.id}/texts`, { method: "POST", body: { instructions, field: b.dataset.regenText } }); AgentOS.toast("Régénéré 🔄", "ok"); box.dataset.view = String(FINI); reopen(); }
        catch (e) { AgentOS.toast(e.message, "err"); b.disabled = false; b.textContent = "↻💡"; }
      }));

      const rt = box.querySelector("[data-regen-thumb]");
      if (rt) rt.addEventListener("click", async () => {
        const instructions = box.querySelector("#pk-thumb-instr")?.value || "";
        rt.disabled = true; rt.textContent = "⏳";
        try { await api(`/api/machines/pov/runs/${run.id}/thumbnail`, { method: "POST", body: { instructions } }); AgentOS.toast("Miniature régénérée 🎨", "ok"); box.dataset.view = String(FINI); reopen(); }
        catch (e) { AgentOS.toast(e.message, "err"); rt.disabled = false; rt.textContent = "🎨"; }
      });

      const pub = box.querySelector("[data-publish]");
      if (pub) {
        const sel = box.querySelector("#pk-chan");
        api("/api/channels").then((chs) => {
          sel.innerHTML = `<option value="">— chaîne YouTube —</option>` + chs.filter((c) => !c.error).map((c) => `<option value="${esc(c.channelId)}">${esc(c.title)}</option>`).join("");
        }).catch(() => {});
        sel.addEventListener("change", () => (pub.disabled = !sel.value));
        pub.addEventListener("click", async () => {
          pub.disabled = true; pub.textContent = "⏳ Envoi…";
          try {
            const r = await api(`/api/machines/pov/runs/${run.id}/publish`, { method: "POST", body: {
              channelId: sel.value,
              privacyStatus: box.querySelector("#pk-priv").value,
              title: box.querySelector("#pk-title").value,
              description: box.querySelector("#pk-desc").value,
              tags: box.querySelector("#pk-tags").value.split(",").map((x) => x.trim()).filter(Boolean),
            }});
            AgentOS.toast("📤 Publiée : " + r.url, "ok");
            reopen();
          } catch (e) { AgentOS.toast(e.message, "err"); pub.disabled = false; pub.textContent = "📤 Publier"; }
        });
      }
    }

    // ═══════════════════════════ Onglet Runs ═══════════════════════════
    async function renderRuns() {
      const body = el.querySelector("#pov-body");
      const runs = await api("/api/machines/pov/runs");
      const BADGE = { done: ["✓ terminé", "ok"], failed: ["✗ échec", "err"] };
      body.innerHTML = runs.length
        ? runs.map((r) => {
            const [lb, bd] = BADGE[r.status] || ["⏳ en cours", "warn"];
            const cost = r.cost ? (r.cost.images || 0) + (r.cost.voice || 0) + (r.cost.cards || 0) + (r.cost.ref || 0) : 0;
            return `<div class="scrap-row ${r.status === "done" ? "done" : r.status === "failed" ? "failed" : ""}" style="cursor:pointer" data-run="${r.id}">
              <b class="small grow" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.title)}</b>
              <span class="small muted">${r.levels || r.params?.levels || 10} niveaux · ${r.shots || 0} images${r.durationSec ? " · " + (r.durationSec / 60).toFixed(1) + " min" : ""} · ${r.mode}</span>
              <span class="small mono row-stat">${cost ? cost.toFixed(2) + "$" : ""}</span>
              <span class="small muted">${ago(r.createdAt)}</span>
              <span class="badge ${bd}">${lb}</span>
              ${r.status !== "done" ? `<button class="mini-btn" data-zap="${r.id}" title="⚡ Décharge : relance le run">⚡</button>` : ""}
              ${!["done", "failed"].includes(r.status) ? `<button class="mini-btn" data-cancel="${r.id}" title="Annuler">🛑</button>` : ""}
            </div>`;
          }).join("")
        : `<div class="empty">Aucun run — lance ta première vidéo dans ⚙ Générer.</div>`;
      body.querySelectorAll("[data-run]").forEach((b) => b.addEventListener("click", () => openWizard(b.dataset.run)));
      body.querySelectorAll("[data-zap]").forEach((b) => b.addEventListener("click", async (e) => {
        e.stopPropagation(); b.disabled = true; b.textContent = "⏳";
        try { await api(`/api/machines/pov/runs/${b.dataset.zap}/resume`, { method: "POST", body: {} }); AgentOS.toast("⚡ Décharge envoyée", "ok"); openWizard(b.dataset.zap); }
        catch (err) { AgentOS.toast(err.message, "err"); }
        renderRuns();
      }));
      body.querySelectorAll("[data-cancel]").forEach((b) => b.addEventListener("click", async (e) => {
        e.stopPropagation(); b.disabled = true;
        try { await api(`/api/machines/pov/runs/${b.dataset.cancel}/cancel`, { method: "POST" }); AgentOS.toast("Run annulé 🛑", "ok"); } catch (err) { AgentOS.toast(err.message, "err"); }
        renderRuns();
      }));
    }

    // ═══════════════════════════ Onglet Stock ═══════════════════════════
    async function renderStock() {
      const body = el.querySelector("#pov-body");
      let stock = [];
      try { stock = await api("/api/machines/pov/stock"); } catch {}
      const live = stock.filter((v) => !v.archived);
      body.innerHTML = live.length
        ? live.map((v) => `
            <div class="scrap-row ${v.posted ? "done" : ""}" style="cursor:pointer;border-left:3px solid ${v.posted ? "var(--ok,#4ade80)" : "var(--accent)"}" data-run="${esc(v.id)}">
              ${v.thumbRel ? `<img src="${media(v.thumbRel)}" style="width:74px;height:42px;object-fit:cover;border-radius:6px;flex:none">` : `<span style="width:74px;text-align:center">🔺</span>`}
              <b class="small grow" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(v.title)}</b>
              <span class="small muted">${v.shots} images · ${(v.durationSec / 60).toFixed(1)} min</span>
              <span class="small muted">${AgentOS.dateFr(v.createdAt)}</span>
              <span class="badge ${v.posted ? "ok" : "warn"}">${v.posted ? "📤 postée" : "en stock"}</span>
            </div>`).join("")
        : `<div class="empty">Stock vide.</div>`;
      body.querySelectorAll("[data-run]").forEach((b) => b.addEventListener("click", () => openWizard(b.dataset.run)));
    }

    // ═══════════════════════════ Onglet Paramètres ═══════════════════════════
    async function renderSettings() {
      const body = el.querySelector("#pov-body");
      let niches = [];
      try { niches = await api("/api/bank/niches"); } catch {}
      const s = cfg.settings;
      const MODELS = { grok2: "Grok Imagine Image 2.0 — 0,02 $", nano: "Nano Banana 2 Lite — 0,02 $", seedream: "Seedream 5 Lite — 0,014 $", gpt: "GPT Image 2 — 0,06 $" };
      body.innerHTML = `
        <div class="grid grid-3" style="align-items:end">
          <label class="field"><span>🖼 Modèle d'images</span>
            <select id="s-model">${Object.entries(MODELS).map(([k, l]) => `<option value="${k}"${s.imageModel === k ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
          <label class="field"><span>🔺 Niveaux par défaut : <b id="s-lvllbl">${s.levels}</b> <span class="muted">(niche : 10)</span></span>
            <input type="range" id="s-levels" min="4" max="12" step="1" value="${s.levels}"></label>
          <label class="field"><span>🎞 Durée cible d'un plan : <b id="s-shotlbl">${s.shotSeconds}</b> s <span class="muted">(niche : ~6 s)</span></span>
            <input type="range" id="s-shot" min="3" max="9" step="0.5" value="${s.shotSeconds}"></label>
        </div>
        <div class="grid grid-3" style="align-items:end">
          <label class="field"><span>🌍 Langue de la chaîne <span class="muted">(titre, description, tags)</span></span>
            <select id="s-chain">${LANGS.map((l) => `<option${s.chainLanguage === l ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
          <label class="field"><span>🔒 Confidentialité à la publication</span>
            <select id="s-priv">${[["private", "🔒 Privée"], ["unlisted", "🔗 Non répertoriée"], ["public", "🌍 Publique"]].map(([v, l]) => `<option value="${v}"${s.publishPrivacy === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
          <label class="field"><span>🏦 Banque de niche liée</span>
            <select id="s-niche"><option value="">— aucune —</option>${niches.map((n) => `<option value="${n.id}"${cfg.nicheId === n.id ? " selected" : ""}>${esc(n.name)}</option>`).join("")}</select></label>
        </div>
        <div class="grid grid-3" style="align-items:end">
          <label class="field"><span>📣 Nom de chaîne sur le bouton CTA</span>
            <input id="s-chan" value="${esc(s.channelName || "POV Rank")}"></label>
          <div class="field"><span>🧑 Présentateur du CTA <span class="muted">(asset partagé, 0,02 $)</span></span>
            <span class="row" style="gap:8px;align-items:center">
              ${s.host ? `<img src="${media(s.host, s.hostTs)}" style="width:96px;height:54px;object-fit:cover;border-radius:6px;border:1px solid var(--border-soft)">` : `<span class="small muted">généré au 1er montage</span>`}
              <button class="btn btn-sm" id="s-host">${s.host ? "↻ Régénérer" : "Générer maintenant"}</button>
            </span>
          </div>
        </div>
        <div class="small muted mb">Le CTA (après le niveau 3) et la pyramide (à chaque niveau) sont fixés par la recette de la niche — voir docs/RECETTE-NICHE-POV.md.</div>
        <button class="btn btn-accent" id="s-save">Enregistrer</button>`;
      const $ = (x) => body.querySelector(x);
      $("#s-levels").addEventListener("input", (e) => ($("#s-lvllbl").textContent = e.target.value));
      $("#s-shot").addEventListener("input", (e) => ($("#s-shotlbl").textContent = e.target.value));
      $("#s-host").addEventListener("click", async (e) => {
        e.target.disabled = true; e.target.textContent = "⏳ Dessin…";
        try { cfg = await api("/api/machines/pov/host", { method: "POST", body: { force: true } }); AgentOS.toast("Présentateur prêt", "ok"); renderSettings(); }
        catch (err) { AgentOS.toast(err.message, "err"); e.target.disabled = false; e.target.textContent = "Générer"; }
      });
      $("#s-save").addEventListener("click", async () => {
        try {
          cfg = await api("/api/machines/pov", { method: "PATCH", body: {
            nicheId: $("#s-niche").value || null,
            settings: {
              imageModel: $("#s-model").value,
              levels: Number($("#s-levels").value),
              shotSeconds: Number($("#s-shot").value),
              chainLanguage: $("#s-chain").value,
              publishPrivacy: $("#s-priv").value,
              channelName: $("#s-chan").value.trim() || "POV Rank",
            },
          }});
          AgentOS.toast("Paramètres enregistrés", "ok");
        } catch (e) { AgentOS.toast(e.message, "err"); }
      });
    }

    shell();
    // Ouverture directe d'un run (?run=<id>) : fenêtre embarquée de l'appel Jarvis
    if (params && params.get("run")) openWizard(params.get("run"));
  },
});
