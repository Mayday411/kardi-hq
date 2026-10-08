/* Kardinal Offishall · homepage behaviour
   Reads data/*.json and renders: CTA, hero sticker, Now Playing, the Wha Gwaan feed,
   the 25 Years timeline, On The Road and the footer. No framework, no build step. */

(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const HATS = { artist: "Artist", ar: "A&R", tv: "TV", live: "Live", community: "Community" };
  const LANES = {
    all:       { hats: null, note: "Everything, every hat, newest first." },
    dayones:   { hats: null, note: "Since Eye & I in '97. You get the whole story, nothing filtered." },
    dangerous: { hats: ["artist", "live"], note: "You came for the records. Here are the records and the shows." },
    cgt:       { hats: ["tv", "community"], note: "You know him from the judges' desk. Here is the TV side and the city side." },
    industry:  { hats: ["ar", "artist"], note: "The executive and the artist he still is. Booking and press are further down." }
  };
  const PAGE = 7;

  const state = { lane: "all", hat: "all", shown: PAGE, moments: [] };

  const fmtDate = (iso, display) => {
    if (display) return display;
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("en-CA", { day: "2-digit", month: "short", year: "numeric" }).replace(/\./g, "");
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ext = (url) => url ? `href="${esc(url)}" target="_blank" rel="noopener"` : "";

  async function load(name) {
    const res = await fetch(`data/${name}.json`, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Could not load ${name}.json`);
    return res.json();
  }

  /* ---------- header ---------- */
  function header() {
    const hdr = $(".site-header");
    const onScroll = () => hdr.classList.toggle("scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const btn = $("#menu-btn");
    const nav = $("#mobile-nav");
    btn.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(open));
    });
    $$("a", nav).forEach((a) => a.addEventListener("click", () => { nav.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); }));
  }

  /* ---------- hero embers ---------- */
  function embers() {
    const canvas = $("#embers");
    if (!canvas || reduceMotion) return;
    const ctx = canvas.getContext("2d");
    let w, h, dpr, parts = [];
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(90, (w * h) / 16000));
      parts = Array.from({ length: n }, () => spawn(true));
    };
    const spawn = (anywhere) => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : h + 10,
      r: 0.6 + Math.random() * 1.8,
      vy: 0.15 + Math.random() * 0.45,
      vx: (Math.random() - 0.5) * 0.25,
      a: 0.15 + Math.random() * 0.45,
      hue: Math.random() < 0.7 ? "255,90,31" : "242,179,61",
      t: Math.random() * Math.PI * 2
    });
    let last = 0;
    const tick = (now) => {
      if (document.hidden) { requestAnimationFrame(tick); return; }
      const dt = Math.min(40, now - last) / 16; last = now;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        p.t += 0.02 * dt;
        p.y -= p.vy * dt;
        p.x += (p.vx + Math.sin(p.t) * 0.12) * dt;
        const fade = Math.min(1, p.y / (h * 0.5));
        ctx.beginPath();
        ctx.fillStyle = `rgba(${p.hue},${(p.a * fade).toFixed(3)})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        if (p.y < -10 || p.x < -10 || p.x > w + 10) parts[i] = spawn(false);
      }
      requestAnimationFrame(tick);
    };
    resize();
    window.addEventListener("resize", resize);
    requestAnimationFrame(tick);
  }

  /* ---------- the pile: peel + stickers ---------- */
  function pile() {
    const hero = $(".hero");
    const peel = $("#hero-peel");
    if (!hero || !peel) return;
    const stickers = $$(".stk, .bubble", hero);
    const MAX = 0.72;          // how far scroll can peel the portrait (1 = fully off)
    const HOVER = 0.2;         // how far a hover lifts the corner
    let scrollP = 0, hoverTarget = 0, hoverP = 0, shown = -1, raf = 0, lastKick = 0;

    const lerp = (a, b, t) => a + (b - a) * t;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

    const stage = $(".pile-stage", hero) || hero;
    function measure() {
      // Peel starts when the pile reaches the top of the viewport, so on phones (where the pile sits
      // below the headline) it is still whole when you first see it.
      const r = stage.getBoundingClientRect();
      const start = 110;
      const travel = Math.max(1, r.height * 0.85);
      const gone = Math.max(0, start - r.top);
      scrollP = clamp(gone / travel, 0, 1) * MAX;
      return gone;
    }

    function frame() {
      const y = measure();
      hoverP = lerp(hoverP, hoverTarget, 0.12);
      const p = clamp(Math.max(scrollP, hoverP), 0, 1);
      if (Math.abs(p - shown) > 0.0005) {
        peel.style.setProperty("--p", p.toFixed(4));
        shown = p;
      }
      // Stickers drift at different depths while the hero scrolls out.
      stickers.forEach((s) => {
        const depth = parseFloat(s.style.getPropertyValue("--depth")) || 0.6;
        s.style.setProperty("--py", `${(-y * 0.12 * depth).toFixed(1)}px`);
      });
      // Keep animating briefly after the last scroll, and while a hover is still easing.
      const busy = (performance.now() - lastKick < 180) || Math.abs(hoverP - hoverTarget) > 0.001;
      raf = busy ? requestAnimationFrame(frame) : 0;
    }
    const kick = () => { lastKick = performance.now(); if (!raf) raf = requestAnimationFrame(frame); };

    if (reduceMotion) { peel.style.setProperty("--p", "0"); return; }

    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick);
    peel.addEventListener("pointerenter", () => { hoverTarget = HOVER; peel.classList.add("is-hover"); kick(); });
    peel.addEventListener("pointerleave", () => { hoverTarget = 0; peel.classList.remove("is-hover"); kick(); });
    kick();

    // The bubble cycles through his lines.
    const lines = ["Wha gwaan?", "Everyday, sometimes…", "T-Dot, forever", "Still a kid in the booth", "Heavy is the head"];
    const bubble = $("#bubble"), text = $("#bubble-text");
    if (bubble && text) {
      let i = 0;
      setInterval(() => {
        if (document.hidden) return;
        i = (i + 1) % lines.length;
        bubble.classList.remove("swap"); void bubble.offsetWidth;
        text.textContent = lines[i]; bubble.classList.add("swap");
      }, 3600);
    }
  }

  /* ---------- links / CTA ---------- */
  function links(data) {
    $$(".js-cta").forEach((a) => { a.href = data.cta.url; });
    $("#cta-long").textContent = data.cta.label;
    $("#cta-short").textContent = data.cta.short;
    const st = $("#sticker");
    st.textContent = data.latest.sticker;
    st.href = data.latest.url;

    $("#stream").innerHTML = data.streaming.map((s, i) =>
      `<a class="btn ${i === 0 ? "primary" : ""}" ${ext(s.url)}>${esc(s.name)}</a>`).join("");

    // Partner ticker: rendered twice so the loop is seamless.
    const tick = $("#ticker");
    if (tick && data.ticker) {
      const items = data.ticker.map((t) => {
        const isExt = /^https?:/.test(t.url);
        return `<a class="${t.open ? "open" : ""}" href="${esc(t.url)}"${isExt ? ' target="_blank" rel="noopener"' : ""}><span class="lab">${esc(t.label)}</span><span class="name">${esc(t.name)}</span></a>`;
      }).join("");
      tick.innerHTML = items + items;
    }

    $("#foot-social").innerHTML = data.social.map((s) =>
      `<li><a ${ext(s.url)}>${esc(s.name)}</a><span class="handle">${esc(s.handle)}</span></li>`).join("");

    $("#booking-email").textContent = data.business.booking_email;
    $("#speaking-link").href = data.business.speaking.url;
    $("#cameo-link").href = data.business.cameo.url;

    const copy = $("#copy-email");
    copy.addEventListener("click", async () => {
      const text = data.business.booking_email;
      try { await navigator.clipboard.writeText(text); copy.textContent = "Copied"; }
      catch (e) {
        const r = document.createRange(); r.selectNodeContents($("#booking-email"));
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        copy.textContent = "Selected, press copy";
      }
      setTimeout(() => { copy.textContent = "Copy"; }, 1800);
    });
  }

  /* ---------- in his own name ---------- */
  function goods(data) {
    const el = $("#goods-grid");
    if (!el) return;
    const frames = `<span class="frames-art" aria-hidden="true"><svg viewBox="0 0 160 60"><g fill="none" stroke="#C8E230" stroke-width="5" stroke-linejoin="round"><path d="M6 14h58l6 10v20a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6V22z"/><path d="M96 14h58l-6 8v22a6 6 0 0 1-6 6H98a6 6 0 0 1-6-6V22z"/><path d="M70 26c5-4 15-4 20 0"/></g><path d="M14 22h48v20a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4z M100 22h44v20a4 4 0 0 1-4 4h-36a4 4 0 0 1-4-4z" fill="#1a1a1a" opacity=".85"/></svg></span>`;
    el.innerHTML = data.goods.map((g) => `
      <article class="good good-${esc(g.id)}" style="--accent:${esc(g.accent)}">
        ${g.id === "4ever16" ? `<span class="code" aria-hidden="true">416</span>` : frames}
        <div>
          <div class="good-kind">${esc(g.kind)}</div>
          <div class="good-name">${g.id === "4ever16" ? `4ever<span class="num">16</span>` : esc(g.name)}</div>
        </div>
        <div><p class="good-tag">${esc(g.tagline)}</p><p style="margin-top:10px">${esc(g.body)}</p></div>
        <div class="good-cta">
          ${g.url ? `<a class="btn primary" ${ext(g.url)}>${esc(g.cta)}</a>` : `<span class="soon">${esc(g.cta)} · link coming</span>`}
        </div>
      </article>`).join("");
  }

  /* ---------- on the screen: youtube + podcast ---------- */
  function screen(yt, links) {
    const grid = $("#yt-videos");
    if (grid && yt && yt.videos) {
      $("#yt-subs").textContent = `${yt.subscribers} subscribers`;
      $("#yt-handle").textContent = yt.handle;
      $$(".js-yt").forEach((a) => { a.href = yt.url; });
      // Skip near-duplicate uploads (clean edits) so three different videos show.
      const seen = new Set(), picks = [];
      yt.videos.forEach((v) => { const k = v.title.replace(/\[.*?\]|\(.*?\)|clean/gi, "").replace(/\s+/g, " ").trim().toLowerCase(); if (!seen.has(k) && picks.length < 3) { seen.add(k); picks.push(v); } });
      grid.innerHTML = picks.map((v) => `
        <a class="yt-video" ${ext(v.url)}>
          <img src="${esc(v.thumb)}" alt="" width="480" height="360" loading="lazy">
          <span class="yt-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></span>
          <span class="yt-title">${esc(v.title)}</span>
          <time class="yt-date" datetime="${esc(v.published)}">${esc(fmtDate(v.published))}</time>
        </a>`).join("");
    }
    const pod = links && links.podcast;
    if (pod) {
      $("#pod-name").textContent = pod.name;
      $("#pod-status").textContent = pod.status;
      $("#pod-body").textContent = pod.body;
    }
  }

  /* ---------- the reel ---------- */
  function reel(data) {
    const player = $("#player"), v = $("#reel-video"), btn = $("#reel-play");
    if (!player || !v) return;
    if (data.reel) {
      $("#reel-len").textContent = data.reel.length;
      const dl = $("#reel-download"); if (dl) dl.href = data.reel.mp4;
    }
    const start = () => { v.controls = true; player.classList.add("playing"); v.play().catch(() => {}); };
    btn.addEventListener("click", start);
    v.addEventListener("play", () => player.classList.add("playing"));
    v.addEventListener("ended", () => { player.classList.remove("playing"); v.controls = false; v.currentTime = 0; });
  }

  /* ---------- now playing + timeline ---------- */
  function releases(data) {
    const np = data.now_playing;
    $("#np-title").textContent = np.title;
    $("#np-facts").innerHTML = [np.released, np.label, np.length].map((f) => `<span>${esc(f)}</span>`).join("");
    $("#tracks").innerHTML = np.tracks.map((t) =>
      `<li><span class="n">${String(t.n).padStart(2, "0")}</span><span>${esc(t.title)}${t.feat ? ` <span class="feat">feat. ${esc(t.feat)}</span>` : ""}</span></li>`).join("");

    years(data.releases);
  }

  /* ---------- 25 Years: scroll drives the track sideways, the match burns down ---------- */
  function years(releases) {
    const section = $("#years"), stage = $(".years-stage", section), track = $("#years-track");
    const burnt = $("#fuse-burnt"), ember = $("#ember"), ticks = $("#fuse-ticks");
    if (!section || !track) return;
    const labels = ["#D9441A", "#F2B33D", "#B9801E", "#2E6B8A", "#7A3E9D", "#FF5A1F", "#8C7D70"];

    track.innerHTML = releases.map((r, i) => {
      const cls = ["year-slide", r.hot ? "hot" : "", r.future ? "future" : ""].join(" ").trim();
      const disc = r.cover
        ? `<span class="disc sleeve" style="--label:${labels[i % labels.length]}"><img src="${esc(r.cover)}" alt="${esc(r.title)} album cover" width="700" height="700" loading="lazy"></span>`
        : r.future ? `<span class="disc blank"></span>` : `<span class="disc" style="--label:${labels[i % labels.length]}"></span>`;
      const inner = `<span class="year-big" aria-hidden="true">${esc(r.year)}</span>${disc}
        <span class="year-meta"><span class="yr">${esc(r.year)}</span><b>${esc(r.title)}</b><span class="note">${esc(r.note)}</span><span class="go">${r.hot ? "Listen now" : "Listen"}</span></span>`;
      return r.url ? `<a class="${cls}" ${ext(r.url)}>${inner}</a>` : `<div class="${cls}">${inner}</div>`;
    }).join("");
    ticks.innerHTML = releases.map((r, i) => `<span style="left:${(i / (releases.length - 1)) * 100}%">${esc(r.year)}</span>`).join("");
    const tickEls = $$("span", ticks);

    const pinned = () => window.matchMedia("(min-width: 860px)").matches;
    let raf = 0, last = -1;

    function size() {
      if (pinned()) {
        // Enough vertical room that each record gets a comfortable stretch of scroll.
        const travel = Math.max(0, track.scrollWidth - stage.clientWidth);
        section.style.height = `${stage.offsetHeight + travel * 1.15}px`;
        track.style.transform = "";
      } else {
        section.style.height = "";
        track.style.transform = "";
      }
      paint(true);
    }

    function progress() {
      if (pinned()) {
        const r = section.getBoundingClientRect();
        const total = section.offsetHeight - stage.offsetHeight;
        return total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
      }
      const total = track.scrollWidth - track.clientWidth;
      return total > 0 ? track.scrollLeft / total : 0;
    }

    function paint(force) {
      raf = 0;
      const p = progress();
      if (!force && Math.abs(p - last) < 0.0005) return;
      last = p;
      if (pinned()) {
        const travel = Math.max(0, track.scrollWidth - stage.clientWidth);
        track.style.transform = `translate3d(${(-p * travel).toFixed(1)}px, 0, 0)`;
      }
      const pct = (p * 100).toFixed(2);
      burnt.style.width = `${pct}%`;
      ember.style.left = `${pct}%`;
      const active = Math.round(p * (releases.length - 1));
      tickEls.forEach((t, i) => t.classList.toggle("on", i <= active));
    }

    const kick = () => { if (!raf) raf = requestAnimationFrame(() => paint(false)); };
    window.addEventListener("scroll", kick, { passive: true });
    track.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", size);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(size);
    size();
  }

  /* ---------- feed: pinboard + list ---------- */
  function feed(data) {
    state.moments = data.moments.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    const el = $("#feed");
    const BOARD_PAGE = 9;
    state.shown = BOARD_PAGE;

    // View preference is a per-viewer convenience; storage may be unavailable.
    try { state.view = localStorage.getItem("kardi-feed-view") === "list" ? "list" : "board"; } catch (e) { state.view = "board"; }

    // Every moment gets a stable tilt and offset from its title, so the board looks scattered but never jumps.
    const tilt = (m) => {
      const h = [...m.title].reduce((a, c) => ((a * 31) + c.charCodeAt(0)) >>> 0, 7);
      return { r: (h % 11) - 5, ty: ((h >> 4) % 15) - 7 };
    };
    const key = (m) => `${m.date}|${m.title}`;

    $$(".chip.lane").forEach((c) => c.addEventListener("click", () => {
      state.lane = c.dataset.lane; state.hat = "all"; state.shown = pageSize();
      $$(".chip.lane").forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
      $$(".chip.hat").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.hat === "all")));
      render(true);
    }));
    $$(".chip.hat").forEach((c) => c.addEventListener("click", () => {
      state.hat = c.dataset.hat; state.shown = pageSize();
      $$(".chip.hat").forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
      render(true);
    }));
    $$(".view-btn").forEach((b) => b.addEventListener("click", () => {
      state.view = b.dataset.view;
      try { localStorage.setItem("kardi-feed-view", state.view); } catch (e) {}
      syncView(); render(false);
    }));
    $("#more").addEventListener("click", () => { state.shown += pageSize(); render(true); });

    function pageSize() { return state.view === "board" ? BOARD_PAGE : PAGE; }
    function syncView() {
      $$(".view-btn").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.view === state.view)));
      el.classList.toggle("board", state.view === "board");
      el.classList.toggle("list", state.view === "list");
    }
    function visible() {
      const lane = LANES[state.lane];
      return state.moments.filter((m) =>
        (!lane.hats || lane.hats.includes(m.hat)) && (state.hat === "all" || m.hat === state.hat));
    }

    const cardHTML = (m) => {
      const t = tilt(m);
      return `
        <article class="card card-${esc(m.hat)}${m.cover ? " has-cover" : ""}" data-key="${esc(key(m))}" data-r="${t.r}" data-ty="${t.ty}" style="--r:${t.r}deg;--ty:${t.ty}px">
          <div class="card-body">
            <span class="pin" aria-hidden="true"></span>
            ${m.cover ? `<span class="card-cover"><img src="${esc(m.cover)}" alt="${esc(m.title)} artwork" width="480" height="480" loading="lazy"></span>` : ""}
            <div class="card-head"><span>${HATS[m.hat] || esc(m.hat)}</span><time datetime="${esc(m.date)}">${esc(fmtDate(m.date, m.display))}</time></div>
            <h3>${esc(m.title)}</h3>
            <p>${esc(m.body)}</p>
            ${m.url ? `<a class="card-link" ${ext(m.url)}>${esc(m.link_label || "More")}</a>` : ""}
            ${m.status ? `<span class="status">${esc(m.status)}</span>` : ""}
          </div>
        </article>`;
    };
    const rowHTML = (m) => `
        <article class="moment${m.cover ? " has-cover" : ""}" data-key="${esc(key(m))}">
          <time class="d" datetime="${esc(m.date)}">${esc(fmtDate(m.date, m.display))}</time>
          <div>
            ${m.cover ? `<img class="row-cover" src="${esc(m.cover)}" alt="" width="480" height="480" loading="lazy">` : ""}
            <h3>${esc(m.title)}</h3>
            <p>${esc(m.body)}</p>
            ${m.url ? `<a class="more" ${ext(m.url)}>${esc(m.link_label || "More")}</a>` : ""}
          </div>
          <div class="hat-wrap">
            <span class="hat">${HATS[m.hat] || esc(m.hat)}</span>
            ${m.status ? `<span class="hat status">${esc(m.status)}</span>` : ""}
          </div>
        </article>`;

    function render(animate) {
      $("#lane-note").textContent = LANES[state.lane].note;
      const all = visible();
      const list = all.slice(0, state.shown);
      const board = state.view === "board";

      // FLIP: remember where every card was before the DOM changes.
      const before = new Map();
      if (animate && board && !reduceMotion) $$(".card", el).forEach((c) => before.set(c.dataset.key, c.getBoundingClientRect()));

      el.innerHTML = list.length
        ? list.map(board ? cardHTML : rowHTML).join("")
        : `<p class="empty">Nothing here yet. Try another hat.</p>`;

      if (animate && board && !reduceMotion) {
        const ease = "cubic-bezier(.2,.8,.2,1)";
        $$(".card", el).forEach((c, i) => {
          const rest = `rotate(${c.dataset.r}deg) translateY(${c.dataset.ty}px)`;
          const old = before.get(c.dataset.key);
          if (old) {
            const now = c.getBoundingClientRect();
            const dx = old.left - now.left, dy = old.top - now.top;
            if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
              c.animate([{ transform: `translate(${dx}px, ${dy}px) ${rest}` }, { transform: rest }], { duration: 520, easing: ease });
            }
          } else {
            c.animate(
              [{ opacity: 0, transform: `${rest} scale(0.8)` }, { opacity: 1, transform: `${rest} scale(1)` }],
              { duration: 420, delay: Math.min(i, 8) * 40, easing: ease, fill: "backwards" }
            );
          }
        });
      }

      $("#more").hidden = all.length <= state.shown;
      $("#feed-count").textContent = `${all.length} ${all.length === 1 ? "moment" : "moments"}`;
    }

    syncView();
    render(false);
  }

  /* ---------- shows ---------- */
  function shows(data) {
    const today = new Date().toISOString().slice(0, 10);
    const sorted = data.shows.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    const up = sorted.filter((s) => s.date >= today).reverse();
    const past = sorted.filter((s) => s.date < today);
    const row = (s, state) => `
      <div class="show">
        <time class="d" datetime="${esc(s.date)}">${esc(fmtDate(s.date, s.display))}</time>
        <div><div class="t">${esc(s.title)}</div><div class="v">${esc(s.venue)} · ${esc(s.type)}</div></div>
        ${s.url ? `<a class="btn ${state === "Tickets" ? "primary" : ""}" ${ext(s.url)}>${state}</a>` : `<span class="state">${state}</span>`}
      </div>`;
    $("#shows-up").innerHTML = up.length
      ? up.map((s) => row(s, "Tickets")).join("")
      : `<p class="empty">No dates announced right now. Join the Colleagues below and you will hear first.</p>`;
    $("#shows-past").innerHTML = past.map((s) => row(s, "Recap")).join("");
    $("#shows-past-wrap").hidden = !past.length;
  }

  /* ---------- join ---------- */
  function join() {
    const form = $("#join-form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = $("#join-email");
      if (!email.checkValidity()) { email.reportValidity(); return; }
      $("#join-msg").hidden = false;
      $("#join-msg").textContent = "The list opens with the official launch. Nothing was stored.";
      form.reset();
    });
  }

  /* ---------- reveal ---------- */
  function reveal() {
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    const els = $$(".reveal");
    els.forEach((el) => el.classList.add("pre"));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.remove("pre"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    els.forEach((el) => io.observe(el));
  }

  /* ---------- album artwork ---------- */
  function cover() {
    const v = $("#cover-video");
    if (!v) return;
    if (reduceMotion) { v.removeAttribute("autoplay"); v.pause(); return; }
    // Only loop while visible, to save battery on long scrolls.
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) v.play().catch(() => {}); else v.pause(); });
      }, { threshold: 0.1 });
      io.observe(v);
    }
  }

  /* ---------- stacked sheets ---------- */
  function sheets() {
    const targets = $$("main > section:not(.hero), footer.site-footer");
    const tilts = ["-0.7deg", "0.6deg", "-0.45deg", "0.8deg"];
    const pivots = ["30%", "70%", "45%", "60%"];
    const tapes = [["l", "r"], ["m"], ["l"], ["r", "m"]];
    targets.forEach((s, i) => {
      s.classList.add("has-sheet");
      const tall = s.offsetHeight > 1600 || s.classList.contains("years") || s.classList.contains("site-footer");
      const sheet = document.createElement("div");
      sheet.className = "sheet" + (tall ? " flat" : "");
      sheet.setAttribute("aria-hidden", "true");
      sheet.style.setProperty("--tilt", tilts[i % tilts.length]);
      sheet.style.setProperty("--pivot", pivots[i % pivots.length]);
      s.prepend(sheet);
      tapes[i % tapes.length].forEach((pos) => {
        const t = document.createElement("span");
        t.className = `tape ${pos}`;
        t.setAttribute("aria-hidden", "true");
        s.prepend(t);
      });
    });
  }

  /* ---------- match spine ---------- */
  function spine() {
    const stops = [
      ["#on-the-mic", "On The Mic"], ["#wha-gwaan", "Wha Gwaan"], ["#years", "25 Years"], ["#goods", "In His Own Name"],
      ["#on-the-screen", "On The Screen"], ["#the-reel", "The Reel"], ["#in-the-building", "In The Building"], ["#partners", "Partners"],
      ["#on-the-road", "On The Road"], ["#give-back", "Give Back"], ["#join", "Join"]
    ].map(([sel, label]) => ({ el: $(sel), label })).filter((s) => s.el);

    const nav = document.createElement("nav");
    nav.className = "spine";
    nav.setAttribute("aria-label", "Page progress");
    nav.innerHTML = `
      <div class="spine-head" aria-hidden="true"></div>
      <div class="spine-stick" aria-hidden="true"><div class="spine-burnt"></div><div class="spine-ember"></div></div>
      <ul class="spine-ticks">${stops.map((s) => `<li><a href="#${s.el.id}" aria-label="${esc(s.label)}"><span>${esc(s.label)}</span></a></li>`).join("")}</ul>`;
    document.body.appendChild(nav);
    const burnt = $(".spine-burnt", nav), ember = $(".spine-ember", nav), ticks = $$(".spine-ticks li", nav);

    let raf = 0, max = 1;
    const docH = () => document.documentElement.scrollHeight;
    function place() {
      max = Math.max(1, docH() - window.innerHeight);
      stops.forEach((s, i) => {
        const y = s.el.getBoundingClientRect().top + window.scrollY - 80;
        ticks[i].style.top = `${Math.min(100, Math.max(0, (y / max) * 100))}%`;
      });
      paint();
    }
    function paint() {
      raf = 0;
      const p = Math.min(1, Math.max(0, window.scrollY / max));
      const pct = (p * 100).toFixed(2);
      burnt.style.height = `${pct}%`;
      ember.style.top = `${pct}%`;
      nav.classList.toggle("lit", p > 0.985);
      const line = window.innerHeight * 0.45;
      let now = -1;
      stops.forEach((s, i) => { if (s.el.getBoundingClientRect().top <= line) now = i; });
      ticks.forEach((t, i) => { t.classList.toggle("on", i <= now); t.classList.toggle("now", i === now); });
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(paint); };
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", place);
    if ("ResizeObserver" in window) new ResizeObserver(place).observe(document.body);
    place();
  }

  /* ---------- boot ---------- */
  header();
  sheets();
  embers();
  pile();
  cover();
  spine();
  join();
  $("#year").textContent = new Date().getFullYear();

  Promise.all([load("links"), load("releases"), load("moments"), load("shows"), load("goods"), load("youtube").catch(() => null)])
    .then(([l, r, m, s, g, y]) => { links(l); reel(l); releases(r); feed(m); shows(s); goods(g); screen(y, l); reveal(); })
    .catch((err) => {
      console.error(err);
      $("#feed").innerHTML = `<p class="empty">The feed could not load. If you opened this file directly, serve it over http (see README).</p>`;
    });
})();
