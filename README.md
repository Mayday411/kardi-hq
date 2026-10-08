# Kardinal Offishall · homepage

A one-page hub for everything Kardi does, modelled on what Trevor Noah's site gets right: one thesis line, one "Latest" sticker, one dated feed across every hat, one persistent call to action.

Static HTML, CSS and vanilla JavaScript. No framework, no build step. Everything a non-developer would change lives in `data/`.

## Run it locally

The page fetches JSON, so it needs to be served over http rather than opened as a file.

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173.

## Deploy

Source: https://github.com/Mayday411/kardi-hq. Live at https://kardi-hq.vercel.app (Vercel project `kardi-hq`, static, no framework). To ship changes:

```bash
vercel deploy --prod
```

The unique per-deployment URLs are behind Vercel's team login; share the production alias above. `vercel.json` turns on clean URLs and sets cache headers; `.vercelignore` keeps the README and editor config out of the upload.

## What lives where

| File | What it holds | Who edits it |
| --- | --- | --- |
| `data/links.json` | Header call to action, Latest sticker, streaming links, socials, booking email, speaking and Cameo links | Kardi or whoever runs his Linktree |
| `data/moments.json` | The Wha Gwaan feed. One entry per thing that happened, newest first, tagged with a hat | Same |
| `data/releases.json` | The 25 Years timeline and the Now Playing tracklist | Same |
| `data/shows.json` | Dates. Future dates show as Tickets, past ones as Recap | Same, or swap in a Bandsintown feed |
| `index.html` | Page structure and the written copy for On The Screen, In The Building, Give Back | Developer |
| `css/site.css` | The visual system | Developer |
| `js/site.js` | Rendering, filters, embers, menu, the hero peel and sticker parallax | Developer |

### Adding a moment

```json
{
  "date": "2026-12-14",
  "display": "Dec 2026",
  "hat": "community",
  "title": "KARDI Christmas Party 2026",
  "body": "One or two sentences.",
  "url": "https://...",
  "link_label": "Tickets"
}
```

`hat` is one of `artist`, `ar`, `tv`, `live`, `community`. `display` is optional and overrides the formatted date when only the month is known. `status` is optional and adds a second tag (for example "Announced").

### Changing the header action

Edit `cta` in `data/links.json`. "Listen · Firestarter Vol. 2" now; "Get Tickets" when a run goes on sale; "Watch Tonight" on a Canada's Got Talent air date.

## The hero pile

The portrait is a sticker. Scroll peels it off the page (the white paper back folds over the front); hover lifts a corner. The mechanic is two copies of the cutout in a rotated square: the front is clipped from one side, the back is mirrored, clipped from the other side and filtered white. `--p` (0 to 1) drives both; `--angle` on `#hero-peel` sets the fold direction. The props around him are links into the site, each rotated with `--r` and drifting on scroll by `--depth`.

Assets: `assets/kardi-cutout.png` (portrait with the background removed), `assets/match.png` (the match cut from the Vol. 2 artwork). The buzzer, mic and flag are inline SVG.

## The Wha Gwaan board

Moments render as pinned cards by default, with a List toggle beside the hat filters (the choice is remembered per browser). The card's form follows its hat: releases are cream labels with a record behind them, shows are ticket stubs, TV is a dark on-air card, A&R gets a stamped card, community moments are taped sticky notes. Each card's tilt and offset come from a hash of its title, so the board is scattered but stable. Filtering reshuffles the cards with a FLIP animation; reduced-motion users get an instant swap.

## 25 Years of Fire

On screens 860px and wider the catalogue is pinned: the section is made tall by script, the stage sticks to the viewport, and vertical scroll drives the track sideways. Each record sits in front of its year set in giant type. A match along the bottom burns down as you go, with the year ticks lighting up behind the ember. Below 860px the track is a native swipe with scroll snapping and the same fuse. Records read from `data/releases.json`; the current record (`"hot": true`) shows the real sleeve, a future one (`"future": true`) shows a blank disc.

## Match spine and stacked sheets

A matchstick runs down the right edge of every page view and burns as you scroll; the ember marks where you are, and it breathes once you reach the footer. On wide screens each section is a tick on the stick: hover shows the name, click jumps there. Phones get a thin stick with no ticks.

Sections are stacked sheets rather than blocks divided by rules. Script gives every section after the hero (and the footer) a `.sheet` layer in its paper tone, tilted a fraction of a degree with a shadow cast up onto the sheet above, plus one or two pieces of tape. Tilts, pivots and tape positions rotate through four presets in `js/site.js`; very tall sections (the pinned timeline, the footer) stay flat. Alternating sections carry the `paper` class for the slightly lighter stock.

## Partners

Kardi's brand work has its own lane. A Monster Energy can sits on the hero pile next to a dashed "Your logo here" sticker; a partner ticker runs under the hero (items in `data/links.json` under `ticker`, the last one flagged `open`); and In The Building ends with "In Good Company": a brief / play / result card for Monster and an open-slot card listing what a deal can include, with the booking email. The can is typographic in Monster's green on purpose: the claw logo is their trademark, so swap in official artwork only once Kardi and Monster have cleared it. The Monster result line is a placeholder until campaign numbers exist.

## Logo

Kardi's official script logo lives at `assets/logo-white.png` (used in the footer) and `assets/logo-black.png` (for light backgrounds, unused on the site). The hummingbird from the logo is cut out as `assets/bird.png`; it is the header mark and makes the favicon and touch icon.

## Before it goes live

- The hero cutout was made from a 603px phone-screenshot crop. Re-run the background removal on the original photo for a sharper sticker (`assets/kardi-cutout.png`, roughly 4:5, transparent PNG).
- The Now Playing artwork is the real animated Vol. 2 cover (`assets/firestarter-vol2.mp4`, 1080px, 7 s loop, muted) with a poster frame at `assets/firestarter-vol2.jpg`, also used as the share image.
- Confirm the Instagram handle in `data/links.json` (@kardinalo vs @kardinaloffishall).
- Wire the Join the Colleagues form to Beehiiv. Right now it stores nothing and says so.
- Set `og:url` once the domain is chosen. The share image is the Vol. 2 poster frame; swap for a 1200×630 crop if the square looks wrong on a given platform.
- Pick the domain. `kardinaloffishall.ca` and `mrkardinal.ca` appeared unregistered on 7 Oct 2026. Both `.com` versions are currently hijacked.
- Remove the "not yet affiliated" line in the footer once Kardi signs off.

## Sources for the content

Exclaim! interview and release notes, SHIFTER review, Billboard Canada, Wikipedia, setlist.fm, Speakers Canada, and Kardi's own Linktree. Checked 7 October 2026.
