// ── GitHub API: mappen bekijken en code ophalen ──
"use strict";

const GitHubKit = (() => {
  const API = "https://api.github.com";

  function headers(cfg) {
    const h = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
    if (cfg.token) h.Authorization = "Bearer " + cfg.token.trim();
    return h;
  }

  function base(cfg) {
    return `${API}/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents`;
  }

  async function request(cfg, path) {
    if (!cfg.owner || !cfg.repo) throw new Error("Vul eerst eigenaar + repo in.");
    const ref = cfg.branch ? `?ref=${encodeURIComponent(cfg.branch)}` : "";
    const url = `${base(cfg)}/${path.split("/").map(encodeURIComponent).join("/")}${ref}`;
    const res = await fetch(url, { headers: headers(cfg) });
    if (res.status === 404) throw new Error(`Map/bestand niet gevonden: ${path || "(root)"}`);
    if (res.status === 401 || res.status === 403) {
      throw new Error("GitHub weigert toegang (401/403). Controleer je token bij privé-repos.");
    }
    if (!res.ok) throw new Error(`GitHub-fout ${res.status}: ${await res.text().catch(() => "")}`);
    return res.json();
  }

  /** List bestanden/map-inhoud. Geeft array van {name, path, type, size, download_url} */
  async function list(cfg, path) {
    const data = await request(cfg, path || "");
    const arr = Array.isArray(data) ? data : [data];
    return arr.map((f) => ({
      name: f.name,
      path: f.path,
      type: f.type, // "file" | "dir"
      size: f.size || 0,
      download_url: f.download_url,
      sha: f.sha
    })).sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
  }

  /** Haal één bestand op (tekst). */
  async function fetchFile(cfg, item) {
    if (item.size > 512 * 1024) {
      throw new Error(`${item.name} is te groot (${fmtBytes(item.size)}, max 512 KB).`);
    }
    if (item.download_url) {
      const res = await fetch(item.download_url, { headers: item.privateish ? headers(cfg) : {} });
      if (!res.ok) throw new Error(`Kon ${item.name} niet ophalen (${res.status}).`);
      return await res.text();
    }
    // terugval: contents-API (base64)
    const data = await request(cfg, item.path);
    if (data.content) {
      const bin = atob(data.content.replace(/\n/g, ""));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder().decode(bytes);
    }
    throw new Error(`Kan ${item.name} niet lezen.`);
  }

  /**
   * Recursief verzamel bestanden onder `path` (max `maxFiles`).
   * Geeft [{path, content}] terug (paden relatief aan `rootPath`).
   */
  async function fetchTree(cfg, rootPath, opts) {
    opts = opts || {};
    const maxFiles = opts.maxFiles || 120;
    const out = [];
    const queue = [rootPath || ""];
    while (queue.length) {
      const dir = queue.shift();
      const entries = await list(cfg, dir);
      for (const e of entries) {
        if (out.length >= maxFiles) return out;
        if (e.type === "dir") {
          if (!e.name.startsWith(".")) queue.push(e.path);
        } else if (!e.name.startsWith(".")) {
          try {
            const content = await fetchFile(cfg, e);
            const rel = rootPath && e.path.startsWith(rootPath + "/")
              ? e.path.slice(rootPath.length + 1)
              : e.name;
            out.push({ path: rel, content, size: e.size });
          } catch (err) {
            console.warn("Overslaan:", e.path, err);
          }
        }
      }
    }
    return out;
  }

  /** JSON-aanroep met methode + body (voor schrijfacties). */
  async function apiCall(cfg, method, path, body) {
    if (!cfg.owner || !cfg.repo) throw new Error("Vul eerst eigenaar + repo in.");
    const h = headers(cfg);
    h["Content-Type"] = "application/json";
    const url = `${API}/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}${path}`;
    const res = await fetch(url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data && data.message) || `HTTP ${res.status}`;
      if (res.status === 401 || res.status === 403) throw new Error(`GitHub token geweigerd (${res.status}): ${msg}`);
      if (res.status === 404) throw new Error(`Niet gevonden (404): ${msg} — bestaat branch "${cfg.branch || "main"}" en de repo?`);
      throw new Error(`GitHub-fout ${res.status}: ${msg}`);
    }
    return data;
  }

  /**
   * Push een set bestanden in ÉÉN commit naar cfg.branch.
   * files: [{ path, data: string | Uint8Array }] — binair via de blobs-API.
   * Vereist een token met schrijfrechten (scope "repo" / contents: write).
   */
  async function pushFiles(cfg, files, message) {
    if (!cfg.token || !String(cfg.token).trim()) {
      throw new Error("Pushen heeft een GitHub-token nodig: github.com → Settings → Developer settings → Personal access tokens.");
    }
    const branch = cfg.branch || "main";
    const refGet = await apiCall(cfg, "GET", `/git/ref/heads/${branch}`);
    const headSha = refGet.object.sha;
    const head = await apiCall(cfg, "GET", `/git/commits/${headSha}`);
    const entries = [];
    for (const f of files) {
      const p = String(f.path).replace(/^\/+/, "");
      if (typeof f.data === "string") {
        entries.push({ path: p, mode: "100644", type: "blob", content: f.data });
      } else {
        const blob = await apiCall(cfg, "POST", "/git/blobs", { content: bytesToBase64(f.data), encoding: "base64" });
        entries.push({ path: p, mode: "100644", type: "blob", sha: blob.sha });
      }
    }
    const tree = await apiCall(cfg, "POST", "/git/trees", { base_tree: head.tree.sha, tree: entries });
    const commit = await apiCall(cfg, "POST", "/git/commits", {
      message: message || "Push vanuit BlockyMod Studio",
      tree: tree.sha,
      parents: [headSha]
    });
    await apiCall(cfg, "PATCH", `/git/refs/heads/${branch}`, { sha: commit.sha });
    return { sha: commit.sha, branch, count: files.length };
  }

  return { list, fetchFile, fetchTree, pushFiles };
})();
