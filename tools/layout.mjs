// Section order and visibility, applied to index.html at build time.
//
// Compass holds a hand-ordered "sections" collection: one entry per section
// of the page ({id, label, hidden}). The build rewrites the page so the
// sections appear in that order and hidden ones are left out, along with
// their links. The top menu, the phone menu and the footer's Site list are all rebuilt to follow the page. Doing it here rather
// than in the browser means no jump on load, and the HTML that ships is the
// HTML people and search engines see.
//
// Rules: the hero (#top) is always first and the join band (#join) always
// last. A section Compass doesn't list (unpublished or deleted there) is left
// off the page, the same as one with Hide ticked. Unknown ids are ignored.

const LOCKED_FIRST = "top";
const LOCKED_LAST = "join";

export function applyLayout(html, sections) {
  const list = (Array.isArray(sections) ? sections : []).filter((s) => s && typeof s.id === "string");
  const mainOpen = html.match(/<main\b[^>]*>/);
  const mainClose = html.lastIndexOf("</main>");
  if (!mainOpen || mainClose < 0) return { html, report: "no <main> found, layout skipped" };
  const start = mainOpen.index + mainOpen[0].length;
  const main = html.slice(start, mainClose);

  // Top-level <section> blocks. Each segment carries the comment and
  // whitespace before it, so the banner comments travel with their section.
  const segs = [];
  let depth = 0;
  let prevEnd = 0;
  let cur = null;
  for (const m of main.matchAll(/<section\b[^>]*>|<\/section>/g)) {
    if (m[0].startsWith("</")) {
      depth--;
      if (depth === 0 && cur) {
        const end = m.index + m[0].length;
        segs.push({ id: cur.id, text: main.slice(prevEnd, end) });
        prevEnd = end;
        cur = null;
      }
    } else {
      if (depth === 0) cur = { id: (m[0].match(/\bid="([^"]+)"/) || [])[1] ?? null };
      depth++;
    }
  }
  if (depth !== 0 || !segs.length) return { html, report: "could not parse sections, layout skipped" };
  const tail = main.slice(prevEnd);

  const byId = new Map(segs.filter((s) => s.id).map((s) => [s.id, s]));
  const movable = segs.filter((s) => s.id !== LOCKED_FIRST && s.id !== LOCKED_LAST);
  const hidden = new Set(
    list.filter((s) => s.hidden === true && s.id !== LOCKED_FIRST && s.id !== LOCKED_LAST).map((s) => s.id)
  );
  const wanted = [];
  const seen = new Set();
  for (const s of list) {
    const seg = byId.get(s.id);
    if (seg && movable.includes(seg) && !seen.has(s.id)) {
      wanted.push(seg);
      seen.add(s.id);
    }
  }
  // A section Compass does not list is unpublished there, so it comes off the
  // page. Only when Compass sends no list at all (never set up, or unreachable
  // with no saved copy) does everything show, in source order.
  for (const seg of movable) {
    if (!seg.id) wanted.push(seg);
    else if (!seen.has(seg.id)) { if (list.length) hidden.add(seg.id); else wanted.push(seg); }
  }
  const shown = wanted.filter((seg) => !seg.id || !hidden.has(seg.id));
  const first = byId.get(LOCKED_FIRST);
  const last = byId.get(LOCKED_LAST);
  const newMain = [first, ...shown, last].filter(Boolean).map((s) => s.text).join("") + tail;

  let out = html.slice(0, start) + newMain + html.slice(mainClose);
  const onPage = [first, ...shown, last].filter(Boolean).map((x) => x.id);
  out = navMenu(out, /(<nav class="nav"[^>]*>\n)([\s\S]*?)(\n\s*<\/nav>)/, onPage);
  out = navMenu(out, /(<nav class="mobile-nav[^"]*"[^>]*>\n)([\s\S]*?)(\n\s*<\/nav>)/, onPage);
  out = footSite(out, onPage);
  const order = shown.map((s) => s.id ?? "(unnamed)").join(", ");
  return { html: out, report: `order: ${order}${hidden.size ? ` | hidden: ${[...hidden].join(", ")}` : ""}` };
}

// The top menu (and the phone menu) is a table of contents, so it follows the
// page: the main stops that are on the page, in page order, with Booking after
// The Reel. It is shorter than the footer list on purpose, so it fits one line
// on a laptop; Monster and Awards are reachable from the footer.
const NAV_NAMES = {
  "on-the-mic": "On The Mic", "the-reel": "The Reel", store: "Store", years: "30 Years",
  "wha-gwaan": "Wha Gwaan", "on-the-screen": "On The Screen", "in-the-building": "In The Building",
  "on-the-road": "On The Road", "give-back": "Give Back",
};
function navMenu(html, re, ids) {
  const m = html.match(re);
  if (!m) return html;
  const indent = (m[2].match(/^\s*/) || ["      "])[0];
  const items = [];
  for (const id of ids) {
    if (!NAV_NAMES[id]) continue;
    items.push(`${indent}<a href="#${id}">${NAV_NAMES[id]}</a>`);
    if (id === "the-reel") items.push(`${indent}<a href="#book">Booking</a>`);
  }
  return html.replace(m[0], () => m[1] + items.join("\n") + m[3]);
}

// The footer's Site list is the sitemap, so it mirrors the page: one link per
// section that is on the page, in page order, plus Booking (which opens inside
// The Reel). Names are the short ones a visitor would look for.
const FOOT_NAMES = {
  "on-the-mic": "On The Mic", "the-reel": "The Reel", store: "The 4EVR16 Store", partners: "Monster",
  years: "30 Years of Fire", "wha-gwaan": "Wha Gwaan", goods: "Things He Makes", "on-the-screen": "On The Screen",
  "in-the-building": "In The Building", "on-the-road": "On The Road", awards: "Awards", "give-back": "Give Back",
};
function footSite(html, ids) {
  const m = html.match(/(<ul id="foot-site">\n)([\s\S]*?)(\n\s*<\/ul>)/);
  if (!m) return html;
  const indent = (m[2].match(/^\s*/) || ["            "])[0];
  const items = [];
  for (const id of ids) {
    if (!FOOT_NAMES[id]) continue;
    items.push(`${indent}<li><a href="#${id}">${FOOT_NAMES[id]}</a></li>`);
    if (id === "the-reel") items.push(`${indent}<li><a href="#book">Booking</a></li>`);
  }
  return html.replace(m[0], () => m[1] + items.join("\n") + m[3]);
}

