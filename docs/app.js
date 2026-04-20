(() => {
  "use strict";

  const state = {
    rituals: [],
    categories: [],
    kinds: [],
    trusts: [],
    permissions: [],
    scan: null,
    filters: { q: "", category: "", kind: "", trust: "", permissions: "" },
    theme: localStorage.getItem("grimoire-theme") || "dark",
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  document.body.dataset.theme = state.theme;
  $("#theme-toggle").addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    document.body.dataset.theme = state.theme;
    localStorage.setItem("grimoire-theme", state.theme);
  });

  Promise.all([
    fetch("rituals.json", { cache: "no-cache" }).then((r) => r.json()),
    fetch("scan.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ])
    .then(([rituals, scan]) => {
      state.rituals = rituals.rituals || [];
      state.categories = rituals.categories || [];
      state.kinds = uniq(state.rituals.map((r) => r.kind)).sort();
      state.trusts = uniq(state.rituals.map((r) => r.trust || "core")).sort();
      state.permissions = uniq(state.rituals.flatMap((r) => r.permissions || [])).sort();
      state.scan = scan;
      renderStats(rituals, scan);
      renderFilters();
      wireSearch();
      render();
    })
    .catch((err) => {
      $("#cards").innerHTML = `<p class="empty">Failed to load data: ${escapeHtml(err.message)}</p>`;
    });

  function uniq(xs) { return [...new Set(xs)]; }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function renderStats(data, scan) {
    $("#stat-total").textContent = data.total ?? state.rituals.length;
    $("#stat-cats").textContent = (data.categories || []).length;
    $("#stat-kinds").textContent = state.kinds.length;
    if (scan) {
      const pct = Math.round((scan.pass / scan.total) * 100);
      $("#stat-scan").textContent = `${pct}%`;
      $("#stat-scan-label").textContent = scan.fail ? `${scan.pass}/${scan.total} pass · ${scan.fail} fail` : `${scan.pass}/${scan.total} pass`;
      if (scan.fail > 0) $("#stat-scan").style.color = "var(--rose)";
      else if (scan.warn > 0) $("#stat-scan").style.color = "var(--amber)";
    } else {
      $("#stat-scan").textContent = "—";
    }
  }

  function renderFilters() {
    const mount = (id, key, values, counter, labelMap = null) => {
      const el = $(id);
      el.innerHTML = "";
      el.appendChild(makeChip(key, "", `all ${labelText(key)}`, state.rituals.length));
      for (const v of values) {
        const label = labelMap ? labelMap(v) : v;
        el.appendChild(makeChip(key, v, label, counter(v)));
      }
    };

    const countBy = (key) => (v) => state.rituals.filter((r) => r[key] === v).length;
    const countByPerm = (v) => state.rituals.filter((r) => (r.permissions || []).includes(v)).length;

    mount("#filter-kind", "kind", state.kinds, countBy("kind"));
    mount("#filter-trust", "trust", state.trusts, countBy("trust"));
    mount("#filter-perm", "permissions", state.permissions, countByPerm);
    mount("#filter-cat", "category", state.categories, countBy("category"));
  }

  function labelText(key) {
    return { kind: "kinds", trust: "trust", permissions: "permissions", category: "categories" }[key] || key;
  }

  function makeChip(key, value, label, count) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.dataset.key = key;
    btn.dataset.value = value;
    if (key === "trust" && value) btn.dataset.trust = value;
    if (key === "permissions" && value) btn.dataset.perm = value;
    btn.innerHTML = `${escapeHtml(label)} <span class="count">${count}</span>`;
    if (state.filters[key] === value) btn.classList.add("active");
    btn.addEventListener("click", () => {
      state.filters[key] = state.filters[key] === value ? "" : value;
      $$(`.chip[data-key="${key}"]`).forEach((c) => c.classList.remove("active"));
      $$(`.chip[data-key="${key}"][data-value="${state.filters[key]}"]`).forEach((c) => c.classList.add("active"));
      render();
    });
    return btn;
  }

  function wireSearch() {
    const input = $("#q");
    const debounced = debounce((v) => {
      state.filters.q = v.trim().toLowerCase();
      render();
    }, 80);
    input.addEventListener("input", (e) => debounced(e.target.value));
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function filtered() {
    const { q, category, kind, trust, permissions } = state.filters;
    return state.rituals.filter((r) => {
      if (category && r.category !== category) return false;
      if (kind && r.kind !== kind) return false;
      if (trust && r.trust !== trust) return false;
      if (permissions && !(r.permissions || []).includes(permissions)) return false;
      if (!q) return true;
      const hay = `${r.id} ${r.name} ${r.description} ${r.category} ${r.kind} ${(r.permissions || []).join(" ")} ${(r.required_env || []).join(" ")}`.toLowerCase();
      return q.split(/\s+/).every((term) => hay.includes(term));
    });
  }

  function render() {
    const tmpl = $("#card-tmpl");
    const cards = $("#cards");
    const list = filtered();

    $("#result-count").textContent = `${list.length} ritual${list.length === 1 ? "" : "s"}`;
    $("#empty").hidden = list.length !== 0;

    cards.innerHTML = "";
    const frag = document.createDocumentFragment();
    for (const r of list) frag.appendChild(renderCard(tmpl, r));
    cards.appendChild(frag);
  }

  function renderCard(tmpl, r) {
    const node = tmpl.content.firstElementChild.cloneNode(true);
    $(".card-title", node).textContent = r.id;

    const kindBadge = $(".badge-kind", node);
    kindBadge.textContent = r.kind;
    kindBadge.dataset.kind = r.kind;

    const trustBadge = $(".badge-trust", node);
    trustBadge.textContent = r.trust || "core";
    trustBadge.dataset.trust = r.trust || "core";

    const authorLink = $(".badge-author", node);
    const author = r.author || "kdairatchi";
    authorLink.textContent = `@${author}`;
    authorLink.href = `https://github.com/${author}`;

    const scanBadge = $(".badge-scan", node);
    scanBadge.textContent = r.scan_status || "—";
    scanBadge.dataset.status = r.scan_status || "UNKNOWN";

    $(".card-desc", node).textContent = r.description || r.name || "";
    $(".card-schedule", node).textContent = r.schedule ? `${r.schedule} (${r.timezone})` : "—";
    $(".card-cat", node).textContent = r.category;

    const perms = r.permissions || [];
    if (perms.length) {
      const permEl = $(".card-perms", node);
      permEl.hidden = false;
      const ul = $(".perm-list", permEl);
      for (const p of perms) {
        const li = document.createElement("li");
        li.className = "perm-pill";
        li.dataset.perm = p;
        li.textContent = p;
        ul.appendChild(li);
      }
    }

    const envs = r.required_env || [];
    if (envs.length) {
      const envEl = $(".card-env", node);
      envEl.hidden = false;
      const ul = $(".env-list", envEl);
      for (const e of envs) {
        const li = document.createElement("li");
        li.className = "env-pill";
        li.textContent = e;
        ul.appendChild(li);
      }
    }

    const warnings = r.warnings || [];
    if (warnings.length) {
      const warnEl = $(".card-warnings", node);
      warnEl.hidden = false;
      const ul = $(".warning-list", warnEl);
      for (const w of warnings) {
        const li = document.createElement("li");
        li.textContent = w;
        ul.appendChild(li);
      }
    }

    $(".card-cmd", node).textContent = r.install_cmd;
    const link = $(".card-link", node);
    link.href = r.github_url;

    const copyBtn = $(".copy-btn", node);
    copyBtn.addEventListener("click", () => copyToClipboard(r.install_cmd, copyBtn));
    return node;
  }

  function copyToClipboard(text, btn) {
    const done = () => {
      btn.textContent = "copied";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = "copy";
        btn.classList.remove("copied");
      }, 1400);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallback(text, done));
    } else {
      fallback(text, done);
    }
  }

  function fallback(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch {}
    document.body.removeChild(ta);
    done();
  }
})();
