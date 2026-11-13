// Section order and visibility, applied to index.html at build time.
//
// Compass holds a hand-ordered "sections" collection: one entry per section
// of the page ({id, label, hidden}). The build rewrites the page so the
// sections appear in that order and hidden ones are left out, along with
// their links in the header, mobile and footer menus (the menus keep their own order). Doing it here rather
// than in the browser means no jump on load, and the HTML that ships is the
// HTML people and search engines see.
//
// Rules: the hero (#top) is always first and the join band (#join) always
// last. A section Compass doesn't mention keeps its place after the listed
// ones, in source order, and is shown. Unknown ids are ignored.

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
  for (const seg of movable) if (!seg.id || !seen.has(seg.id)) wanted.push(seg);
  const shown = wanted.filter((seg) => !seg.id || !hidden.has(seg.id));
  const first = byId.get(LOCKED_FIRST);
  const last = byId.get(LOCKED_LAST);
  const newMain = [first, ...shown, last].filter(Boolean).map((s) => s.text).join("") + tail;

  let out = html.slice(0, start) + newMain + html.slice(mainClose);
  out = dropLinks(out, /<nav class="nav"[^>]*>[\s\S]*?<\/nav>/, hidden);
  out = dropLinks(out, /<nav class="mobile-nav[^"]*"[^>]*>[\s\S]*?<\/nav>/, hidden);
  out = dropLinks(out, /<footer\b[\s\S]*?<\/footer>/, hidden);
  const order = shown.map((s) => s.id ?? "(unnamed)").join(", ");
  return { html: out, report: `order: ${order}${hidden.size ? ` | hidden: ${[...hidden].join(", ")}` : ""}` };
}

// Inside one block, drop the lines that are plain in-page links to hidden
// sections. The menus keep their own order: that is an editorial choice
// (Store sits last as the call to action), not a mirror of the page.
function dropLinks(html, blockRe, hidden) {
  const m = html.match(blockRe);
  if (!m || !hidden.size) return html;
  const linkRe = /^\s*(?:<li>)?<a href="#([\w-]+)">[^<]*<\/a>(?:<\/li>)?\s*$/;
  const kept = m[0].split("\n").filter((line) => { const k = line.match(linkRe); return !(k && hidden.has(k[1])); });
  return html.replace(m[0], () => kept.join("\n"));
}
