    // ===== MACHINE POV =====
    if (p === "/api/machines/pov/stock" && req.method === "GET") return json(res, 200, pov.stock());
    if (p === "/api/machines/pov" && req.method === "GET") return json(res, 200, { ...pov.config(), voices: pov.VOICES });
    if (p === "/api/machines/pov" && req.method === "PATCH") {
      const b = await readBody(req);
      return json(res, 200, { ...pov.patchConfig(b), voices: pov.VOICES });
    }
    if (p === "/api/machines/pov/estimate" && req.method === "POST") {
      const b = await readBody(req).catch(() => ({}));
      return json(res, 200, pov.estimate(b));
    }
    if (p === "/api/machines/pov/host" && req.method === "POST") {
      const b = await readBody(req).catch(() => ({}));
      try { await pov.ensureHost({ force: !!b.force }); return json(res, 200, { ...pov.config(), voices: pov.VOICES }); } catch (e) { return json(res, 500, { error: e.message }); }
    }
    if (p === "/api/machines/pov/idea" && req.method === "POST") {
      try { return json(res, 200, await pov.suggestTheme()); } catch (e) { return json(res, 500, { error: e.message }); }
    }
    if (p === "/api/machines/pov/runs" && req.method === "GET") return json(res, 200, pov.listRuns());
    if (p === "/api/machines/pov/runs" && req.method === "POST") {
      const b = await readBody(req);
      try { return json(res, 200, pov.createRun(b)); } catch (e) { return json(res, 400, { error: e.message }); }
    }
    m = /^\/api\/machines\/pov\/runs\/([\w-]+)\/publish$/.exec(p);
    if (m && req.method === "POST") {
      const b = await readBody(req);
      try { return json(res, 200, await pov.publishRun(m[1], b)); } catch (e) { return json(res, 500, { error: e.message }); }
    }
    m = /^\/api\/machines\/pov\/runs\/([\w-]+)\/thumbnail$/.exec(p);
    if (m && req.method === "POST") {
      const b = await readBody(req).catch(() => ({}));
      try { return json(res, 200, await pov.regenThumbnail(m[1], b.instructions || "")); } catch (e) { return json(res, 500, { error: e.message }); }
    }
    m = /^\/api\/machines\/pov\/runs\/([\w-]+)\/texts$/.exec(p);
    if (m && req.method === "POST") {
      const b = await readBody(req).catch(() => ({}));
      try { return json(res, 200, await pov.regenTexts(m[1], b.instructions || "", b.field || "")); } catch (e) { return json(res, 500, { error: e.message }); }
    }
    m = /^\/api\/machines\/pov\/runs\/([\w-]+)\/validate$/.exec(p);
    if (m && req.method === "POST") {
      try { return json(res, 200, pov.validate(m[1])); } catch (e) { return json(res, 400, { error: e.message }); }
    }
    m = /^\/api\/machines\/pov\/runs\/([\w-]+)\/level$/.exec(p);
    if (m && req.method === "POST") {
      const b = await readBody(req);
      try { return json(res, 200, pov.patchLevel(m[1], b.n, b.text)); } catch (e) { return json(res, 400, { error: e.message }); }
    }
    m = /^\/api\/machines\/pov\/runs\/([\w-]+)\/cancel$/.exec(p);
    if (m && req.method === "POST") {
      try { return json(res, 200, pov.cancelRun(m[1])); } catch (e) { return json(res, 400, { error: e.message }); }
    }
    m = /^\/api\/machines\/pov\/runs\/([\w-]+)\/resume$/.exec(p);
    if (m && req.method === "POST") {
      const b = await readBody(req).catch(() => ({}));
      try { const run = pov.resumeRun(m[1], b.status); return json(res, 200, { ok: true, status: run.status }); } catch (e) { return json(res, 400, { error: e.message }); }
    }
    // Garde-fou : aucune régé pendant qu'un advance() tourne (écriture perdue)
    m = /^\/api\/machines\/pov\/runs\/([\w-]+)\/(regen|card|ref)$/.exec(p);
    if (m && req.method === "POST") {
      const b = await readBody(req).catch(() => ({}));
      try {
        if (pov.getRun(m[1]).status.endsWith("_running")) return json(res, 400, { error: "Le run est en cours — attends la fin de l'étape avant de régénérer." });
        if (m[2] === "regen") return json(res, 200, await pov.regenScene(m[1], b.scene, b.instructions));
        if (m[2] === "card") return json(res, 200, await pov.regenCard(m[1], b.n));
        return json(res, 200, await pov.regenRef(m[1]));
      } catch (e) { return json(res, 400, { error: e.message }); }
    }
    m = /^\/api\/machines\/pov\/runs\/([\w-]+)$/.exec(p);
    if (m && req.method === "GET") {
      try { return json(res, 200, pov.getRun(m[1])); } catch (e) { return json(res, 404, { error: e.message }); }
    }
    // ===== FIN MACHINE POV =====
