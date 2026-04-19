(() => {
  "use strict";

  const state = {
    rituals: [],
    categories: [],
    kinds: [],
    filters: { q: "", category: "", kind: "" },
    theme: localStorage.getItem("grimoire-theme") || "dark",
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // ---- theme ----
  document.body.dataset.theme = state.theme;
  $("#theme-toggle").addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    document.body.dataset.theme = state.theme;
    localStorage.setItem("grimoire-theme", state.theme);
  });

  // ---- load ----
  fetch("rituals.json", { cache: "no-cache" })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      state.rituals = data.rituals || [];
      state.categories = data.categories || [];
      state.kinds = uniq(state.rituals.map((r) => r.kind)).sort();
      renderStats(data);
      renderFilters();
      wireSearch();
      render();
    })
    .catch((err) => {
      const cards = $("#cards");
      cards.innerHTML = `<p class="empty">Failed to load rituals.json: ${escapeHtml(err.message)}</p>`;
    });

  function uniq(xs) {
    return [...new Set(xs)];
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  function renderStats(data) {
    $("#stat-total").textContent = data.total ?? state.rituals.length;
    $("#stat-cats").textContent = (data.categories || []).length;
    $("#stat-kinds").textContent = state.kinds.length;
  }

  function renderFilters() {
    const kindEl = $("#filter-kind");
    const catEl = $("#filter-cat");
    kindEl.innerHTML = "";
    catEl.innerHTML = "";

    const countBy = (key) => {
      const m = new Map();
      for (const r of state.rituals) m.set(r[key], (m.get(r[key]) || 0) + 1);
      return m;
    };
    const kindCounts = countBy("kind");
    const catCounts = countBy("category");

    kindEl.appendChild(makeChip("kind", "", "all kinds", state.rituals.length));
    for (const k of state.kinds) {
      kindEl.appendChild(makeChip("kind", k, k, kindCounts.get(k) || 0));
    }
    catEl.appendChild(makeChip("category", "", "all categories", state.rituals.length));
    for (const c of state.categories) {
      catEl.appendChild(makeChip("category", c, c, catCounts.get(c) || 0));
    }
  }

  function makeChip(key, value, label, count) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.dataset.key = key;
    btn.dataset.value = value;
    btn.innerHTML = `${escapeHtml(label)} <span class="count">${count}</span>`;
    if (state.filters[key] === value) btn.classList.add("active");
    btn.addEventListener("click", () => {
      state.filters[key] = state.filters[key] === value ? "" : value;
      // clear "all" siblings, mark active
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
    const { q, category, kind } = state.filters;
    return state.rituals.filter((r) => {
      if (category && r.category !== category) return false;
      if (kind && r.kind !== kind) return false;
      if (!q) return true;
      const hay = `${r.id} ${r.name} ${r.description} ${r.category} ${r.kind}`.toLowerCase();
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
    for (const r of list) {
      const node = tmpl.content.firstElementChild.cloneNode(true);
      $(".card-title", node).textContent = r.id;
      const badge = $(".badge-kind", node);
      badge.textContent = r.kind;
      badge.dataset.kind = r.kind;
      $(".card-desc", node).textContent = r.description || r.name || "";
      $(".card-schedule", node).textContent = r.schedule ? `${r.schedule} (${r.timezone})` : "—";
      $(".card-cat", node).textContent = r.category;
      $(".card-cmd", node).textContent = r.install_cmd;
      const link = $(".card-link", node);
      link.href = r.github_url;
      link.textContent = "View source →";

      const copyBtn = $(".copy-btn", node);
      copyBtn.addEventListener("click", () => copyToClipboard(r.install_cmd, copyBtn));
      frag.appendChild(node);
    }
    cards.appendChild(frag);
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
