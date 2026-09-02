# CLAUDE.md

Guidance for future work on this project. It's a **Star Wars watch-order
timeline**: a single static page, no build step, no dependencies, no
framework. Everything is hand-rolled vanilla JS/CSS on purpose - keep it
that way unless the user asks otherwise.

## Files

- `index.html` - the whole page skeleton (header, timeline section, footer).
- `js/data.js` - all content: per-franchise `MOVIES_*`/`SERIES_*`/
  `SEASONS_*`/`ORDERINGS_*`(/`STORY_LINES_*`) datasets, `FRANCHISE_DATA`
  (maps a franchise id to its dataset), and the "active" `MOVIES`/
  `SERIES`/`SEASONS`/`ORDERINGS`/`STORY_LINES` bindings the rest of the
  app actually reads - see "Two franchises, one active dataset" below.
  ~1800 lines - by far the biggest single source of growth here; most
  future work on this project is adding/editing entries in this file, not
  touching app.js.
- `js/app.js` - all rendering + interaction, one IIFE (~1700 lines).
- `css/style.css` - all styling (~1400 lines), no preprocessor.
- `favicon.svg` - hand-drawn filmstrip icon, generic (not Star-Wars-themed
  on purpose - a second franchise (Marvel) has since joined `FRANCHISES`,
  confirming why), colored from the same tokens as the rest of the page
  (`--bg-elevated`/`--accent`). Linked from `index.html`'s `<head>`.
No `package.json`, no test framework, no linter. Don't introduce one
unless asked.

As of 2026-09, this project has no `.git` yet - it's about to go up on
GitHub for the first time, so don't assume version history exists. Once
it's initialized, treat git as the only real safety net: commit when the
user asks, and use it to recover from a bad accidental overwrite
(`git show HEAD:<path>` to pull back a clean copy without touching the
working tree, then write that back - a stray `Write` call has already
destroyed a file mid-session once, see Gotcha #9; without git that
would have been unrecoverable). Always check with `git status` first
rather than assuming either way - a session's own context may be stale,
and this note itself will go stale the moment the repo is actually
created.

## Running it locally

```bash
python3 -m http.server 8791   # from the project root
```

Then drive it with Playwright (`python3 -c "from playwright.sync_api import
sync_playwright..."` - the `playwright` Python package is already
installed locally; no npm/node in this environment). This project has no
automated test suite - **every change in this codebase's history has been
verified by actually launching a headless browser and checking real
rendered state** (`getBoundingClientRect`, `scrollHeight` vs
`clientHeight`, console/page errors, screenshots). Do this before
considering any layout or interaction change finished - the bugs listed
below were all found exactly this way, several of them invisible from
reading the code alone.

## The one hard rule: the page never scrolls vertically

Only the timeline itself scrolls, and only sideways. This is the single
most load-bearing invariant in the whole app and most of `app.js`'s
complexity exists to guarantee it:

- `sizeTimelineToViewport()` solves poster size from the viewport height
  every render + resize, with a layered fallback (comfortable size → exact
  fit for the tallest card → hard viewport clamp) - see the long comment
  above it before touching this function, and see "Gotchas" below for why
  the middle step alone isn't enough.
- `.timeline-scroll`'s `overflow-y: auto` is a **last-resort fallback**,
  not a real feature - it should only ever engage when the window is
  unnaturally short. If you find yourself relying on it to hide overflow
  in normal use, that's a bug in the sizing math, not something to accept.
- A season row expanding/collapsing must NEVER change a card's height -
  that's why `expandSeasonRow()` detaches the row into a floating overlay
  instead of growing it in place (see below).

## Core architectural patterns

**Timeline header stacking order** - universal across both franchises and
both base orderings (Chronological AND Release Order), not something
either one opts into separately. Top to bottom, above every era-block's
cards:
1. The era title bar (`.era-block__label`/`.era-block__title`) - the
   MAIN axis line: bold, accent-colored, glowing, its `::before`/`::after`
   gradient lines spanning the era-block's full width. May or may not
   carry an actual era NAME (`era.label` - empty renders as one
   continuous divider line with no visible text, see Release Order's and
   Marvel Chronological's own comments for why) - a possible future case
   this stays flexible for for is an axis that's fully INTERRUPTED partway
   (no line at all for a stretch), not needed anywhere yet. The
   `::before`/`::after` gradients fade from transparent to `--accent-dim`
   over a FIXED 140px, not a plain 0%/100% stretch across the whole
   `flex: 1` length - a 0%/100% fade on a long era (Release Order's single
   9000px+ flat era, say) reads as solid only right around the title text,
   with most of the line's actual on-screen length nearly invisible the
   whole time you're scrolled away from that one spot. Fixed-distance
   fade keeps it reading as one strong, continuous line wherever you've
   scrolled to, fading only right at the true outer edge of the era.
2. The era's own optional description (`.era-block__desc`) directly below
   the title, same block.
3. Below THAT, not above it (this was flipped from an earlier layout -
   see below) - the dating itself (`.year-band__label`): the in-universe
   year under Chronological, or the real release year under Release
   Order, per that ordering's own `yearBands`.
4. An optional one-line explanation directly under the date -
   `.year-band__milestone` (the single point the axis calls out by name,
   e.g. "⚔ Battle of Yavin") or `.year-band__earth` (which Earth an
   `otherEarth` title is actually set on, e.g. "EARTH-828") - never both
   on the same band.
5. `.year-band__span` - a thin reach-indicator line under the date/
   explanation, stretched exactly as wide as the card(s) this dating
   covers (one card or several, sharing one date - see the `yearBands`
   comment on `ORDERINGS` in data.js for the `span` mechanism itself).
   ALWAYS rendered, one card or several - a single-card band gets it too,
   for visual consistency, not just when it's needed to disambiguate a
   multi-card span.
Layer 1-2 (`--era-label-h`) and layers 3-5 (`--year-band-h`) are each a
single CSS custom property in height, set from `render()` in app.js; both
are absolutely positioned within `.timeline-track`'s reserved top padding
(`padding-top: calc(var(--era-label-h) + var(--year-band-h))`) - the era
title sits at the very top of that reserved space (`.era-block__label`'s
`top` offset is the FULL combined height, negative, relative to its own
`.era-block`), the year-band strip right below it
(`.year-band-layer { top: var(--era-label-h); }`), both immediately above
the actual cards. `drawConnectors()`'s own y-offset math
(`- eraLabelH - yearBandH`) only cares about the COMBINED height, not
which of the two sits on top, so swapping them needed no changes there.
  Layer 5's line is deliberately the LESS visually prominent of the two
lines on the axis - thin (1px), no glow, and only ever as wide as the
card(s) it covers rather than the era's full width - layer 1's title bar
is the loud, structural "this is the axis" statement; layer 5 is a quiet,
precise "this date belongs to exactly these cards" pointer. It's colored
to MATCH its own date, though, not a flat neutral gray - `--accent-dim`
by default (same as `.year-band__label`'s own default color), `--accent`
on a milestone band, `--other-earth` on an otherEarth band - so the line
and the text it sits under always read as one visual unit, just at very
different volumes. (This was flipped from an earlier layout where the
dating sat ABOVE the era title, with the now-`.year-band__span` line -
back then only shown for a multi-card band, `year-band--wide` - reading
as the most prominent horizontal rule on the page purely by being
full-track-width and accent-colored; the swap fixed both the ordering and
that mismatched prominence in one pass.)
  `YEAR_BAND_H` (app.js, 40px) is deliberately taller than layers 3-5's
own tight content height (~28px measured) - `.year-band`'s vertical
centering turns that slack into real breathing room both above (between
it and the era title) and, more importantly, below (between the
reach-indicator line and the card posters right underneath it) - packed
edge-to-edge against the posters read as glued-on rather than as the
timeline's own distinct row. Widening this budget (rather than, say,
adding a margin only at the bottom) nudges the WHOLE era-title+year-band
header up slightly within the fixed viewport height
(`sizeTimelineToViewport()`'s solve treats `eraLabelH + yearBandH` as a
fixed budget subtracted from available height) - an acceptable trade
(slightly smaller posters) for a header that no longer looks stuck to the
cards below it.

**Two franchises, one active dataset.** Star Wars and Marvel are each a
complete, independent `MOVIES_*`/`SERIES_*`/`SEASONS_*`/`ORDERINGS_*`
(/`STORY_LINES_*`) dataset in data.js (`_STARWARS`/`_MARVEL` suffixes).
Every function in app.js - rendering, watched-state counting, runtime
totals, persistence validation, all of it - reads the bare, UNSUFFIXED
`MOVIES`/`SERIES`/`SEASONS`/`ORDERINGS`/`STORY_LINES` identifiers, never
the suffixed ones directly. Those five are declared `let` (not `const`) at
the very bottom of data.js, initialized to Star Wars' own data.
`switchFranchise()` (app.js) is the ONLY place that ever reassigns them
(via `applyFranchiseData()`, which looks the new franchise up in
`FRANCHISE_DATA`) - picking a franchise in the header just swaps which
dataset those five names point at and re-renders; no other function
anywhere needs to know franchise-switching exists. This is why adding a
THIRD franchise later is "one more dataset + one more `FRANCHISE_DATA`/
`FRANCHISES` entry" and nothing else - see the doc comment atop data.js.
  Both datasets share the same `state.watched` Set (a movie/season id is
the only thing distinguishing one franchise's progress from another's) -
this only works because ids are chosen to never collide across
franchises (Marvel's `"cap1"` vs Star Wars' `"ep1"`, say). Switching
franchise also resets `state.orderingId` back to the new franchise's own
first ordering and `state.storyLineId` back to `""` (a story line id, or
even the very existence of any, is meaningless across franchises - Marvel
has none yet, `FRANCHISE_DATA.marvel.storyLines` is `[]`, and
`populateStoryLineMenu()` hides the whole Storylines control whenever the
active franchise's array is empty rather than showing an empty,
unopenable dropdown). Per-franchise state does NOT persist independently
across a switch (going Star Wars -> Marvel -> back to Star Wars does not
restore whatever ordering Star Wars was last on) - a deliberate first-pass
simplification, not a technical ceiling.
  Marvel's own dataset is centered on Earth-616/Sacred Timeline, plus a
handful of titles nominally outside it that get folded onto the same axis
via `otherEarth` (see that mechanism's own comment below) - either an
MCU/Marvel Studios production not officially 616-canon (Fantastic Four,
Deadpool & Wolverine, Your Friendly Neighborhood Spider-Man) or, for the
Fox X-Men films (the original trilogy + First Class), a pre-Disney-
acquisition franchise with NO Marvel Studios/MCU branding at all, included
here only because Deadpool & Wolverine's own on-screen mythology
explicitly ties it to one specific parallel Earth (Earth-10005) rather
than leaving it an unplaced "some other continuity" - or, for Sony's own
pre-Disney Spider-Man productions (three separate, unrelated Spider-Man
continuities - Raimi's original trilogy on Earth-96283, Garfield's own
reboot duology on Earth-120703, and the Spider-Man-adjacent Sony's
Spider-Man Universe on Earth-688, none of them tied to each other or to
Earth-10005 by any on-screen mythology the way Deadpool & Wolverine ties
to the Fox X-Men films), because Marvel's own official timeline reference
(see `ORDERINGS_MARVEL`'s own sourcing note below) assigns each of them
its own numbered Earth despite none ever crossing over into 616 on
screen - a real designation was there to use, so, unlike a genuinely
unplaced continuity, there was no "some other continuity" ambiguity left
to defer. `What If...?`, all three seasons, ARE included, despite being a
genuine anthology with no single date to place on a linear axis at all
(every episode a different multiverse branch) - resolved via the "Outside
Time" Multiverse bucket (see that bucket's own comment on
`EARTH_BUCKETS` and the otherEarth comment further below), same mechanism
as Loki's own two seasons - not per-episode dating, which this app has no
mechanism for anyway (see "Season slices" below - even Star Wars' own
curated slices split by CONTENT, never by "which branch of reality").
`Marvel Zombies` IS also included now, but via a DIFFERENT mechanism than
What If...? despite spinning directly out of one of its own episodes
("What If... Zombies?!") - it's one continuous story set on ONE specific
reality (Earth-89521 per Marvel Database), not an anthology jumping across
many, so it gets a real (if approximate, "cca 2025") otherEarth placement
like Fantastic Four or Deadpool & Wolverine rather than "Outside Time" -
see its own bullet further below. Not the separate animated `X-Men '97`
continuity (a different, unrelated X-Men continuity from the live-action
Fox films above), never discussed for inclusion. It intentionally carries
LESS
verified detail than Star Wars' does today: movie years/runtimes are real
and sourced, but TV seasons carry only year + episode count, no
`episodeRuntimes`/`episodeTitles`/`totalRuntimeMin` at all yet (a
full-catalog verification pass across ~15 shows was out of scope for
introducing the franchise itself - `seasonTotalRuntimeMin()`/
`seasonMetaLineText()` already degrade gracefully when a season has no
runtime data, so this reads as "not yet filled in", not broken).
  `ORDERINGS_MARVEL`'s chronological dates follow "The Marvel Cinematic
Universe: An Official Timeline" (Marvel Studios/DK, October 2023) - real
season/quarter labels (e.g. `"Spring 2024"`), not estimated, for anything
that book covers. Two deliberate departures from the book itself, both
noted in its own comment in data.js: (1) a season the book spreads across
several non-contiguous windows in the same year (most notably She-Hulk:
Attorney at Law, split across four separate points from Fall 2024 to Fall
2025) still shows as ONE whole card here, placed at whichever single
window covers the most of it - this app has no per-EPISODE chronological
slicing (Star Wars' own slices split by content, e.g. Anakin's curated
episodes, never by air-date); (2) everything from Ironheart onward
released or was announced after the book's cutoff, so it isn't in the
book at all - that tail is this app's own best-effort placement, flagged
`"cca"` throughout rather than presented as sourced.
  Unlike Star Wars, `ORDERINGS_MARVEL`'s Chronological has no named eras
at all - a first attempt at some (Origins, Infinity Saga, Multiverse Saga,
...) read as more clutter than signal and was dropped again, deliberately
left for a possible later pass rather than kept half-considered. It's ONE
flat era (`label: ""`), the exact same empty-label-divider trick Release
Order already uses for its own single flat era (see its own comment) -
the yearBands strip and the era-label's reserved height/divider line stay
exactly as they were, only the era TITLE text is gone. A yearBands entry
always draws a small reach-indicator line under its label/sub-label,
stretched across the band's own full width - one card or several, span:1
included (`.year-band__span` in style.css) - without it, a band covering
several cards (e.g. `"Spring 2010"` over Iron Man 2 + The Incredible Hulk
+ Thor) would have its text just float above roughly the middle card,
easy to misread as belonging to that one card alone instead of the whole
run it actually covers - and a single-card band gets the same treatment
for visual consistency, not because it's ambiguous. See "Timeline header
stacking order" below for where this line sits relative to the era title.
  Having no named eras also means no era boundary to hang Star Wars' own
`gapBefore` (era-level - see the comment above `ORDERINGS_STARWARS`) off
of for a big in-universe time jump. `era.cardGapBefore` (an array of
leading item ids, `.card--gap-before` in style.css) is the same idea one
card at a time instead of one era at a time - `render()` (app.js) adds the
class to whichever card's leading item id (a movie's own id, or a merged
series group's first season's id) appears in the list, pulling it further
from its predecessor via `--card-gap-extra` (110px, on top of
`.era-block`'s own 66px inner gap - deliberately smaller than
`--era-gap-extra`'s 160px, since there's no title bar/year-band split
reinforcing the jump the way a real era boundary gets, just the spacing
itself). Threshold: any jump over 10 years between one card's yearBands
year and the next gets this, checked against every consecutive pair on
the FINAL, fully chronologically-interleaved sequence (see the otherEarth
comment below for why every foreign-Earth title sorts by its own true
year rather than sitting apart from Sacred Timeline as a block) - but
ONLY within a single continuous story/timeline: `cap1`
(eyeswakanda-s1's ancient/legendary span into 1943) is the only one that
qualifies. Every other >10-year jump on the axis turns out to land at an
otherEarth universe-crossing instead once measured against its REAL
post-interleave neighbor (e.g. `logan`'s 2029 sits at the very end,
after `spiderman4`'s cca 2028, with nothing after it to gap against) -
deliberately NOT applied there even when the raw gap is large, since
crossing into/out of a different Earth entirely isn't "time passing in
the same story", and `drawConnectors()`'s own dashed connector line at
exactly that seam (see below) already flags the discontinuity, more
precisely and without implying "same timeline, just a long gap".
  The whole page's accent color (`--accent`/`--accent-dim`/`--accent-glow`/
`--accent-ink` - pills, era titles, badges, year-bands, ~25 rules total)
is per-FRANCHISE, not global: Star Wars keeps the original gold, Marvel
gets a red (`:root[data-franchise="marvel"]` override in style.css).
`applyFranchiseData()` (app.js) stamps `data-franchise` on `<html>` every
time the active franchise changes (including the very first render, not
just a manual switch) - every rule that already read the CSS variables
picks the new color up for free, nothing else needed to know a franchise
even exists. `--other-earth`(-dim/-glow) are deliberately NOT part of that
per-franchise override - a title outside Sacred Timeline that falls into
the generic "Others" bucket (see below) stays the same purple no matter
which franchise/accent color is active, since that color means "foreign
to this whole axis", a fact that doesn't change with the page's theme.
(Originally violet - retuned to rust-orange once Marvel's own `--accent`
became red, since a red/violet pairing read as too close together, then
retuned AGAIN, all the way back to a purple, once every NAMED multiverse
below got its own dedicated color and rust-orange's job shrank down to
just "Others" - see the full-repaint bullet further below for why one
shared "foreign" color for almost everything stopped being enough.)
  Purple ("Others" own color) is the DEFAULT foreign-Earth color, not the
only one - a SPECIFIC universe can get its own instead, so two different
foreign Earths don't visually blur into "one generic foreign color" ON THE
CARD/YEAR-BAND (the connector LINE is deliberately the one exception -
see below). Every otherEarth-colored card/year-band rule reads
`--other-earth-current`(-dim/-glow), never `--other-earth` directly -
those three "current" tokens default to `--other-earth` at `:root`, but
`[data-other-earth-label="..."]` (style.css) overrides them per specific
Earth instead - see the full-repaint bullet further below for the
complete, current roster (six distinct colors as of that request, not
just one) - and that attribute is set in JS (`buildCard()`/
`buildSeriesCard()`/`drawYearBands()`) directly from `otherEarth.label` -
so a card/year-band's own children pick up the right color for free via
normal CSS custom-property inheritance, no per-element class needed.
Adding one more distinct foreign-Earth color later (for the card/
year-band) is "one more `--other-earth-<id>` token trio + one more
`[data-other-earth-label="..."]` override block", nothing else - every
rule that already reads `--other-earth-current` picks it up
automatically.
  The connector LINE (`drawConnectors()`) does NOT follow this
per-universe coloring at all, on purpose - it renders the exact same
default `--line` stroke as every other connector on the page (Star Wars
included), regardless of which Earth(s) either endpoint belongs to. This
went through two revisions: first tried coloring each otherEarth segment
per-universe (reverted - a line's own two endpoint CARDS can already
carry a different color each if they're different Earths, so coloring the
line itself too read as more visual noise than signal), then settled on
ONE universal rust-orange (`--other-earth-dim`) for every otherEarth
segment regardless of which specific Earth was on either end - that
second design is ALSO gone now, on request: even a single non-default
connector color read as inconsistent with the rest of the page's "one
line color" rule, so `.connector-line--other-earth` (css/style.css)
carries no color override of its own anymore, full stop. The class is
still added and still read (`drawConnectors()`, app.js) for the solid-vs-
dashed decision - that's the ONLY thing that still varies on a connector,
see its own bullet below - it just no longer drives any stroke color.
  **A title from outside Sacred Timeline "glued onto" the axis** -
`movie.otherEarth` (data.js) - or `season.otherEarth` for a whole SHOW
instead of one movie, see `buildSeriesCard()`/`yourfriendlyspiderman`
below - flags a title that's canonically set on a different Earth.
Several titles/clusters use this so far, each a different shape of the
same problem:
- **The Fantastic Four: First Steps** (Earth-828) - the original template
  for the mechanism, though its own Chronological POSITION has since moved
  twice and no longer follows the template it set. Canonically set in
  1964, only entering Sacred Timeline later via a multiversal crossover.
  Its card sits in the normal Chronological sequence - same era, same
  connector line, same click-to-watch, genuinely "glued on" - rather than
  being excluded. First pass: positioned near its 2025 release date,
  sandwiched among unrelated 2025/2026 titles, which read as arbitrary
  rather than as "this happened in 1964". Second pass (fixing that):
  interleaved by its OWN in-universe year instead, between X-Men: First
  Class's 1962 and X-Men: Days of Future Past's 1973 - matching every
  other otherEarth title's own "sort by true year" rule. Third and current
  pass, by explicit user request citing the official timeline reference
  this file otherwise follows: moved AGAIN, this time to sit between
  `thunderbolts` and `wonderman-s1` (cca 2026) - the point the official
  reference actually places this title at, tracking when the Fantastic
  Four family arrives INTO Sacred Timeline (fleeing Galactus at the end of
  their own film) rather than their Earth-828 origin story's own 1964
  setting. This makes it a deliberate EXCEPTION to the "sort by true year"
  rule every other otherEarth title on this axis still follows (see
  `MOVIES_MARVEL`'s own `fantasticfour1` comment in data.js) - same
  category of override as the xmendofp rewrite cluster below, not a bug
  for a future resort pass to "fix" back to 1964. Its yearBands label
  reflects this explicitly: "back to 1964", not a plain "1964" the way a
  true-year interleave would read - flagging that this ONE card, unlike
  every neighbor around it, jumps backward in time rather than continuing
  the axis's forward march (`otherEarth.year` on the card itself, and so
  its own meta line, is still the honest "1964" - only the band's LABEL
  text changed, same "position vs. label can diverge" pattern xmendofp's
  own "2023 + rewrite 1973" label already established).
- **Deadpool & Wolverine** (Earth-10005 - the TVA's own on-screen
  designation for the "dead" Fox X-Men-movies universe the film spends
  most of its runtime in, even though its frame story is 616) - unlike
  Fantastic Four, has no distinct in-universe year of its own; Earth-10005's
  detour simply happens "now", the same 2024 as its real-world neighbors,
  so its card sits right where a normal 2024 card would (today: between
  Spider-Man: Far From Home's Summer 2024 and Eternals' Fall 2024) - no
  different year to place it by, same principle as Fantastic Four just
  with no distinct date to show. It still gets its own one-off
  otherEarth-colored yearBands entry rather than sharing a neighbor's
  plain band - the top-of-axis signal matters even with no distinct date
  to show there (first got this wrong twice: an earlier pass left it
  merged into a shared band with no tint at the top at all; a later pass
  gave it its own band but left the band's YEAR stale at "cca 2026" - two
  releases behind schedule - after its card's own position had already
  moved, since the band's label isn't auto-derived from `otherEarth.year`
  and has to be updated by hand alongside it).
- **Your Friendly Neighborhood Spider-Man** (Earth-86445 - originally no
  Earth number had been revealed at all, carrying a deliberately honest
  "Alt. Earth" placeholder rather than an invented `Earth-XXXXX`; a later
  request supplied the real, now-confirmed number, replacing that
  placeholder everywhere it appeared - the card/season object, both
  orderings' own `yearBands` entries, and every comment referencing the
  old placeholder text) - a whole SEASON, not a movie, and the first test
  of the mechanism on a series card (`season.otherEarth` +
  `buildSeriesCard()`'s own `isChronological` param, mirroring
  `buildCard()`'s). Same reasoning as Deadpool: no confirmed in-universe
  date, so it sits at its own real 2025 release slot with its own one-off
  yearBands entry (matching label text to its real-world neighbor's, just
  flagged `otherEarth`), not an invented date. Despite now having a real
  Earth number, it's still filed under the generic "Others" Multiverse
  bucket rather than a named one of its own (user request) - same
  "confirmed number, not broken out" shape as Marvel Zombies' Earth-89521
  below, see the Multiverse filter section's own comment on `others` for
  why a real number alone doesn't automatically earn a bucket/color.
  Marvel Zombies (2025 series) IS added now too - see its own bullet
  further below (after Sony's Spider-Man film series) for why it's a
  DIFFERENT kind of otherEarth title from What If...? even though it
  spins directly out of one of that show's own episodes.
- **The Fox X-Men film series** (Earth-10005 - the same universe Deadpool &
  Wolverine visits, just much earlier glimpses of it, and its own separate
  steel-blue card/year-band color, see above) - the biggest shape of the
  problem: THIRTEEN related titles (`xmenfirstclass`, `xmendofp`,
  `xmenapocalypse`, `darkphoenix`, `xmen1`/`xmen2`/`xmen3`,
  `xmenwolverine`, `deadpool1`, `deadpool2`, `newmutants`, `logan`), not
  one, spanning 1962 to 2029. Each has its own year - some real and
  independently sourced (`xmenfirstclass` 1962, `xmendofp` 1973 - the
  film's own primary/lasting timeline, its 2023 bookend gets overwritten
  by the plot itself, `xmenapocalypse` 1983, `darkphoenix` 1992, `logan`
  2029, an on-screen dashboard date), others "cca" and approximated FROM
  their real release year since no specific in-universe date was ever
  confirmed (the original trilogy, `xmenwolverine`, `deadpool1`/
  `deadpool2`, `newmutants`). Every one of these thirteen cards is sorted
  into the axis by its own true year, INTERLEAVED with Sacred Timeline
  (and, at the time this was written, with Fantastic Four's own Earth-828 -
  its own card has SINCE moved to a deliberately non-interleaved position,
  see its own bullet above - plus Deadpool & Wolverine's own later
  Earth-10005 glimpse, still interleaved) wherever that year actually
  falls - never grouped together as a separate block, no matter how much
  internal continuity that breaks up. (This took three attempts to get
  right - see below.)
    The results are genuinely scattered: `xmenfirstclass`(1962),
  `xmendofp`(1973), `xmenapocalypse`(1983), `darkphoenix`(1992),
  `captainmarvel1`(1995, back
  in Sacred Timeline), `xmen1`/`xmen2`/`xmen3`(cca 2000/2003/2006) sit as
  one run (nothing else in the dataset maps to an in-universe year in that
  range); then Sacred Timeline resumes at `ironman1`(2008) and runs for a
  while before `xmenwolverine`(cca 2013) slots in between `avengers1`(2012)
  and `thor2`(2013); `deadpool1`(cca 2016) between `blackwidow` and
  `blackpanther1`; `deadpool2`(cca 2018) between `avengers3` and
  `newmutants`(cca 2020, right after it); `deadpool3`/Deadpool & Wolverine
  itself(2024) between `spiderman2` and `eternals`; and finally
  `logan`(2029) - later than everything else in the ENTIRE Marvel
  Chronological axis, `spiderman4`'s own cca 2028 included - lands as the
  very LAST card, full stop, not anywhere near the rest of Earth-10005.
    Got this wrong three times before landing here, each time by
  eyeballing one insertion at a time instead of checking the whole
  sequence: (1) first pass kept the entire Earth-10005/828 run as one
  contiguous "island" between Agent Carter and Iron Man - wrong, since
  `xmenwolverine` onward's own years run 2013-2029, well past that
  island's neighbors, so gluing them there anyway read as visibly out of
  order; (2) fixing that but still keeping a partial grouping left
  Fantastic Four sitting AFTER the whole X-Men run instead of interleaved
  into its own 1964 slot (between 1962 and 1973); (3) fixing THAT still
  left Captain Marvel's 1995 sitting after the trilogy's cca 2000s. What
  actually caught all of this reliably was writing a small script to walk
  the FINAL rendered sequence (or even just the itemIds/yearBands arrays
  directly) and assert every card's year is `>=` the one before it unless
  the connector between them is a `seam` - eyeballing one card's placement
  in isolation kept missing how it interacted with everything already
  around it.
    `drawConnectors()` renders a SOLID line between two adjacent cards
  that happen to share the exact same `otherEarth.label` after the full
  sort (e.g. `xmen1`-`xmen2`-`xmen3`, still adjacent since nothing else
  landed between them) instead of the usual dashed treatment, so real
  continuity WITHIN a foreign universe reads differently from a SEAM
  crossing into/out of one (`connector-line--other-earth-seam`, added
  only when the two ends' labels differ, including Sacred Timeline vs.
  foreign, or foreign vs. a DIFFERENT foreign Earth - a `null` label
  counts as different from any real one) - but even a SOLID line stays
  the exact same default connector color as everything else on the page,
  not that universe's own blue and not even a universal otherEarth color
  of its own anymore (see the color comment above for why the connector
  is the one exception to per-universe coloring, and carries no otherEarth
  coloring of any kind today).
    The original trilogy's own `otherEarth.variant: "Original"` (no other
  Earth-10005 title has one) is a separate field from `otherEarth.label`
  on purpose, DISPLAY only - appended after the Earth name wherever it's
  shown ("EARTH-10005 (ORIGINAL)", via `otherEarthDisplayText()` in
  app.js, used by both `card__origin-earth` and `.year-band__earth`), not
  in the movie's own title, and never touching `otherEarth.label` itself
  (which has to stay identical across every Earth-10005 title for the
  same-universe/color matching above to keep working, even though they're
  scattered across the axis rather than adjacent). `xmendofp` (in this
  dataset) partially rewrites the trilogy's own ending via time travel, so
  the qualifier flags that this specific timeline-branch isn't the
  only/final word on how the story ends, without this app having to model
  the rewrite itself as a separate branch - a property of that ENDING, not
  of Earth-10005 as a whole (everything else is unaffected either way),
  which is why it lives on the trilogy's own entries, not the shared Earth
  label.
- **X-Men Origins: Wolverine** (`xmenoriginswolverine`) - a later addition
  to the same "Original" pre-reboot branch as xmen1/xmen2/xmen3 (a prequel
  to the trilogy, not a separate thing), `variant: "Original"` same as
  them. Its own year (1979) is real and sourced, not "cca" - the climax is
  explicitly dated on-screen to March 28, 1979, tying its fictional Weapon
  X facility to the real Three Mile Island accident on that exact date.
  xmenwolverine (The Wolverine, 2013) got the same `variant: "Original"`
  added in the same pass, for the same reason - it's set "now" (contemporary
  to its own release) in the SAME untouched branch, not the "Rewrite" one
  below, and had been missing the flag since before that branch even had a
  name to distinguish it from.
- **The xmendofp "rewrite" cluster** - a DELIBERATE, one-off exception to
  the "always fully interleave, never group as an island" principle this
  entire section otherwise establishes and enforces (the X-Men trilogy
  bullet above spends three paragraphs on getting exactly that principle
  right). Requested explicitly by the user: xmendofp (X-Men: Days of
  Future Past) sits on the Chronological axis at **2023** - not its own
  1973 mission year, which an earlier pass had used, reasoning that 1973
  was "the one date that actually sticks" once the story's own ending
  overwrites the 2023 future it opens on. The user wanted the opposite
  framing: 2023 is the moment Sacred Timeline's own history up to that
  point gets REWRITTEN, so that's this card's position, with the 1973
  mission folded into its yearBands label instead of its position
  (`"2023 + rewrite 1973"` - the label text, not `otherEarth.year`, which
  stays the plain `"2023"` so the card's own meta line has room for it
  next to the runtime, same budget reasoning as every other otherEarth
  card). Immediately following xmendofp - not sorted to their own
  1983/1992/2016/cca-2016/cca-2018 slots the way every other otherEarth
  title on this axis is - sit the five movies that take place in the
  timeline it rewrites, in this order: xmenapocalypse, darkphoenix,
  deadpool1, **newmutants**, deadpool2. Each is flagged `variant: "Rewrite"`
  (replacing what would otherwise be no variant at all - distinct from the
  untouched "Original" branch above) and each carries its own one-off
  yearBands label ("rewrite 1983", "rewrite 1992", "rewrite 2016",
  "LATE 2010s (REWRITE)", "rewrite 2018" - the word baked directly into the
  axis text, not just the card's small variant badge, so the cluster reads
  as one unit even scrolling past quickly). newmutants was folded in after
  the other four, moved out of its own standalone cca-2020 slot on the
  strength of its own director's on-record quote that the film was
  "rewritten to be set during modern day rather [than] in the 1980s" - the
  film's OWN premise is literally a timeline rewrite, an even more direct
  fit for this cluster than the other four's - and its label is "LATE
  2010s", not a specific year, since (like deadpool1/deadpool2's own
  "cca" years) no exact one is confirmed. Read top to bottom the five
  bands go 2023 -> 1983 -> 1992 -> 2016 -> late-2010s -> 2018 - backward,
  then forward again - which the monotonic-sequence-with-seam-exceptions
  verification script (see the X-Men trilogy bullet's own methodology
  paragraph) flags as a violation unless it's told to treat this cluster as
  one fixed unit; that's expected and correct here, not a bug to chase
  down the way the same script's earlier real findings on the X-Men
  trilogy were. All five still connect with a SOLID connector line
  (`drawConnectors()` only compares `otherEarth.label`, not `variant`, and
  every card in this cluster shares the plain "Earth-10005" label) with
  dashed seams on both outer edges (wandavision-s1 before, madameweb
  after) - reading as one foreign-universe island on the axis, which is
  exactly the intended effect. A future full-resort pass touching anything
  near this cluster needs to move it as one fixed block, not re-sort its
  five cards back into strict year order.
- **Loki, both seasons** (`loki-s1`/`loki-s2`, `otherEarth.label: "Outside
  Time"` on both) - the one otherEarth entry in this whole file that ISN'T
  a numbered alternate Earth at all (see `EARTH_BUCKETS`' own comment in
  data.js for the "not every otherEarth title needs to BE a parallel
  reality" distinction this draws). Positioned narratively, same as
  everything else on this list - right after `avengers4` (the Tesseract
  theft season 1 spins out of) and before `wandavision-s1` - but with NO
  year of any kind, not even a "cca" one: the show's own premise (the TVA
  prunes branched timelines from outside the flow of time itself) has no
  date to give it, and the official chronological reference this file
  otherwise follows explicitly agrees, declining to place Loki on the
  timeline at all. An earlier pass had given season 1 a placeholder
  "cca 2023" band anyway, which read as a real (if approximate) date the
  same way every other "cca" band here does - exactly the impression the
  show's own premise contradicts - fixed by replacing it with a literal
  `"OUTSIDE TIME"` label. Both seasons sit consecutively in Chronological's
  itemIds (same seriesId "loki"), so `groupEraItems()` merges them into
  ONE card - the "OUTSIDE TIME" yearBands entry's own `span` stays 1
  either way, since span counts CARDS, not raw itemIds (Gotcha #11).
  `noTimeline: true` on that one entry (`drawYearBands()`, app.js) strips
  it down further than any other otherEarth band gets: no
  `.year-band__earth` sub-label (every other otherEarth band's sub-label
  names something DIFFERENT from its own main label - the Earth, vs. the
  date above it - but here they'd be the identical string, "OUTSIDE TIME"
  repeated twice) and no `.year-band__span` reach-indicator line either
  (that line's whole job is pointing at "these specific cards on the
  timeline", which reads as a contradiction next to a label whose entire
  point is that there's no timeline to point along) - just the bare label
  plus its own otherEarth color. Each season still needs its OWN
  `otherEarth` field, not just season 1's - `filterItemIdsForMultiverse()`
  reads every raw id's own otherEarth before cards ever merge, so without
  it on season 2 too, unchecking "Outside Time" would hide season 1 but
  leave season 2 behind, wrongly bucketed as Sacred Timeline. Gets its own
  `EARTH_BUCKETS` entry (`"outsidetime"`) for the same reason - a viewer
  filtering by universe needs to be able to isolate/hide it same as any
  numbered Earth, even though "which Earth" isn't really the right
  question for it. Under Release Order both seasons are unaffected by any
  of this - the two DON'T merge there (real release dates a year and a
  half apart), each stays at its own real release slot, tinted the same
  color, labeled with the real year like every other otherEarth title
  under that ordering (see the comment on Release Order's own `yearBands`
  for why the two orderings diverge here).
- **What If...?, all three seasons** (`whatif-s1`/`s2`/`s3`,
  `otherEarth.label: "Outside Time"` on each, the same bucket as Loki
  above, not a new one) - the anthology this file's own earlier comment
  had left deliberately unresolved ("no single date to place on a linear
  axis at all, every episode a different multiverse branch") turned out to
  have the exact same shape as Loki's own placement problem, so it reuses
  the identical mechanism rather than inventing a new one. Unlike Loki's
  own two seasons, these three are NOT clustered together - each was
  requested at its own separate narrative anchor point, so each sits at
  its own separate spot on the axis rather than merging into one card (no
  shared seriesId+consecutive run for `groupEraItems()` to catch): season 1
  right after `shangchi`, season 2 right after `thor4` (Thor: Love and
  Thunder), season 3 right after `agatha-s1` (Agatha All Along) - each
  insertion splitting whichever shared band it landed inside the same way
  every other mid-band otherEarth insertion in this file does. All three
  get the identical literal `"OUTSIDE TIME"` label + `noTimeline: true`
  treatment (no sub-label, no reach-indicator line - see Loki's own bullet
  for why both are suppressed) - the anchor point differs per season, the
  visual treatment doesn't. This does NOT retroactively mean every
  anthology's placement problem gets solved this same way - "no single
  date" was necessary but not sufficient here: each What If...? SEASON
  could still sit at its own ONE position on the axis (an anthology, but a
  given season/show isn't tied to multiple different points in continuity
  the way its individual episodes are), which is what actually let the
  Loki mechanism apply unchanged, repeatedly. Marvel Zombies (see its own
  bullet further below) turned out to have an even simpler shape than
  either - a real Earth number, not "no date at all" - so it didn't need
  this mechanism after all despite spinning out of a What If...? episode;
  a future pass still needs to work out what "Outside Time" (or something
  else) would even mean for a genuine multi-branch anthology with no
  singular reality of its own the way both What If...? and Marvel Zombies
  turned out to have. Under Release Order all three What If...? seasons
  stay at their
  own real release slots instead (August 2021, December 2023, December
  2024 respectively), each splitting a shared real-year band the same way,
  same as every otherEarth title there.
- **Sony's three pre-Disney Spider-Man film series** - eleven more movies,
  three SEPARATE foreign Earths, none sharing continuity with each other
  or with Earth-10005/828 above: Sam Raimi's original trilogy
  (`spidermanraimi1`/`2`/`3`, Earth-96283, 2002-2007), Marc Webb's reboot
  duology (`amazingspiderman1`/`2`, Earth-120703, 2012-2014), and Sony's
  Spider-Man Universe (`venom1`/`2`/`3`, `morbius`, `madameweb`, `kraven`,
  Earth-688, 2018-2024 - Spider-Man-adjacent characters built around his
  absence, since Sony didn't hold the character's own film rights free and
  clear for most of this run). None of these eleven has a confirmed
  in-universe date distinct from its own release year (same situation as
  the X-Men original trilogy/`xmenwolverine`/Deadpool above), so every one
  is `"cca <release year>"`, sorted into the SAME full chronological
  interleave as everything else purely by that year - not clustered by
  franchise, not clustered by Earth, matching the exact "full interleave,
  never an island" principle the X-Men run above already established (and
  got wrong three times before landing on the script-based full-resort
  fix - reused unchanged for this addition, see the Python-resort mention
  in this file's own session methodology). The results land exactly where
  a bare year sort predicts: `spidermanraimi1`(2002) between `xmen1`(cca
  2000) and `xmen2`(cca 2003), `amazingspiderman1`(cca 2012) right after
  `avengers1`(2012), `venom1`(cca 2018) between `avengers3`(2018) and
  `newmutants`(cca 2020), and so on - eleven more individually-placed
  cards, not three more islands.
    None of these three Earths gets its own `--other-earth-<id>` color
  token or its own `EARTH_BUCKETS` entry the way Earth-10005/828 did -
  they fall into the pre-existing `others` bucket/rust-orange color
  instead (see the Multiverse filter section below), a deliberate
  "not every foreign Earth needs to be visually distinguished from every
  other one" call: Earth-10005/828 earned their own treatment by being
  the first two and by Earth-10005 alone spanning thirteen titles across
  the whole axis, but a THIRD/FOURTH/FIFTH color would dilute rather than
  clarify - `others` already existed as exactly this catch-all (Your
  Friendly Neighborhood Spider-Man was already using it),
  so these three needed nothing new, just three more `otherEarth.label`
  strings for the existing fallback logic to catch. Each one still shows
  its own correct, distinct label text on its own card/year-band
  (`otherEarth.label` is never actually shared across the three, only
  their BUCKET/color is) - "not visually distinguished from each other"
  only means they share one checkbox and one color, not that a card ever
  claims to be a different Earth than it actually is.
- **Marvel Zombies** (`marvelzombies-s1`, Earth-89521 per Marvel Database -
  NOT Earth-2149, the unrelated classic COMICS "Marvel Zombies" reality
  this show's title nods to but doesn't depict) - a direct continuation of
  the What If...? season 1 episode "What If... Zombies?!" (itself one of
  the three "Outside Time" seasons above), picking up "five years" after
  that episode's own ending, but NOT placed via the "Outside Time"
  mechanism despite spinning out of it - unlike What If...? (a genuine
  anthology, a different reality every episode, no single one to point at)
  or Loki (an ongoing plot with no date, not tied to any one reality
  either), Marvel Zombies is one continuous story confined to ONE specific
  reality, so it gets the same kind of real-Earth-number placement as
  Fantastic Four or Deadpool & Wolverine instead - `"cca 2025"` (no exact
  in-universe year confirmed beyond "five years after" an already-undated
  episode, so approximated from release like every other undated
  otherEarth title). Positioned narratively right after `whatif-s1` (the
  episode it continues from) on the Chronological axis, splitting
  `whatif-s1`'s own "OUTSIDE TIME" band away from the "Spring 2024" band
  that follows it - own one-off `"cca 2025"` label, normal otherEarth
  treatment (sub-label, reach-indicator line both render, unlike
  `whatif-s1`'s neighboring `noTimeline` band). Filed under the generic
  `others` Multiverse bucket for now, same as Your Friendly Neighborhood
  Spider-Man's Earth-86445 and Sony's three film series above - requested
  explicitly ("zatím" - "for now"), not given its own named bucket/color
  yet despite being a real numbered Earth; `earthBucketId()`'s existing
  fallback catches it with zero code changes either way, so promoting it
  to a named bucket later (if ever) is the same "one more entry, one more
  `[data-other-earth-label]` override" pattern every other named bucket
  already follows. Under Release Order it sits at its own real September
  2025 release slot instead (between `eyeswakanda-s1` and `wonderman-s1`),
  same as every otherEarth title there.
- **Full otherEarth color repaint (user-requested)** - everything written
  above this bullet about colors describes the state as of when each
  cluster was ADDED; several of those claims (Spider-Man's three Earths
  "not getting their own color token", Earth-10005/828 being the only two
  with one) are now historical, not current - superseded by this one
  request, which gave every NAMED bucket in `EARTH_BUCKETS` (data.js) its
  own dedicated `--other-earth-<id>`(-dim/-glow) trio + matching
  `[data-other-earth-label="..."]` override (style.css, near `:root`),
  specifically so the "Multiverse" checkbox filter's own named rows are
  each identifiable by color, not just by their checkbox label text. The
  roster, chosen to keep every family visually distinct from every other
  one AND from `--accent`/`--done` (green is reserved, full stop, for
  "watched" and must never appear anywhere in this palette):
  - Earth-828 (Fantastic Four) - cobalt blue, chosen because it's the
    team's own classic comic/costume color, not an arbitrary palette pick
    the way every other entry here is - the one case where "which color"
    had a real external answer instead of just needing to be distinct from
    its siblings. Reuses the exact hex Earth-10005 used to have (see next
    bullet) - freed up by X-Men's own move off of blue.
  - Earth-10005 (Fox X-Men) - was steel blue (the very first foreign-Earth
    color this app ever had, back when it was the only one) - retuned to a
    golden yellow once Fantastic Four's own blue needed the hex more (see
    above). No brand-color reasoning here, just "needs to be its own
    distinct hue" once blue moved to F4.
  - Earth-688 (Sony's Spider-Man Universe)/Earth-96283 (Raimi/Maguire)/
    Earth-120703 (Webb/Garfield) - three shades of ONE shared warm orange
    family (deliberately, per request - "podobný odstín, ale jemně odliš"
    for the two actor-led continuities specifically), not three unrelated
    colors: 688 (the most-populated of the three) is the base/most
    saturated orange, 96283 is a lighter, warmer variant, 120703 a darker,
    more red-leaning one - close enough to read as "the same Spider-Man
    family" at a glance, distinct enough that no two of them are
    mistakable for each other or for Earth-10005's own yellow.
  - "Others" (the shared bucket for everything with no dedicated entry of
    its own - today: Your Friendly Neighborhood Spider-Man's Earth-86445,
    Marvel Zombies' Earth-89521) - retuned from rust-orange to a purple,
    freeing the whole yellow/orange/red range for X-Men/Spider-Man/Sacred
    Timeline above without a fourth, unrelated bucket muddying it. This is
    also `--other-earth` itself, the DEFAULT every other family's dim/glow
    pair still hangs off of positionally in style.css even though its own
    hue no longer has anything to do with any of them.
  "Outside Time" (Loki, What If...?) keeps its own pre-existing white,
  untouched by this pass - it was never part of the "everything shares one
  rust-orange" problem this request was actually solving, being already
  visually distinct on its own terms (see its own comment in style.css for
  why white specifically). Sacred Timeline itself isn't an `otherEarth`
  bucket at all - it's just `--accent` (Marvel's own red), already
  distinct from all six colors above by construction.
Everywhere a movie card gets this treatment, three DIFFERENT parts of the
axis render it visibly foreign, not just the card in isolation - a series
card gets two of the three (see why below):
- `buildCard()` (app.js): `.card--other-earth` tints `.card__frame`/
  `.card__meta` that Earth's own color (`--other-earth-current`(-dim) -
  purple by default, one of five other dedicated colors per specific
  named Earth, see the full-repaint bullet above; each family used nowhere
  else on the page, on purpose), and adds the
  `.card__origin-earth` badge naming which Earth it's actually from. This
  much renders under BOTH orderings, not just Chronological - `const
  otherEarth = movie.otherEarth;` is unconditional, no `isChronological`
  gate at all (a later request explicitly asked for the Multiverse
  filter's own categorization to be visible under Release Order too, not
  just functional there - see the Multiverse filter section below). Only
  the meta line's YEAR TEXT stays gated: `otherEarth.year` (the in-universe
  year, wildly different from its neighbors on purpose) replaces the
  real-world release year ONLY under Chronological
  (`otherEarth && isChronological ? otherEarth.year : movie.year`) -
  Release Order's whole point is "what came out, in what order", so it
  always shows the real release year regardless of which Earth a title
  belongs to. `buildSeriesCard()` applies the same unconditional
  `.card--other-earth` tint (checking only the merged card's FIRST
  season - a merged group always shares one seriesId/show, so one flag
  speaks for the whole card) but deliberately does NOT add the equivalent
  `.card__origin-earth` text line, and never swaps any season row's
  displayed year to `otherEarth.year` either (so there was nothing to gate
  on `isChronological` there in the first place, unlike `buildCard()`) -
  `SERIES_META_BASE_H` (the height budget `seriesMetaHeight()` solves the
  poster size from) has zero slack for an extra line on ANY series card,
  not just this one, and no otherEarth series added so far actually needs
  a different year from its seasons' real ones anyway (see Deadpool/YFNSM
  above). The tint alone already carries the signal.
- The title's OWN `yearBands` entry (ORDERINGS_MARVEL, data.js) - when it
  has a distinct year to show (Fantastic Four, every Earth-10005 title,
  Your Friendly Neighborhood Spider-Man) - breaks away from its
  neighbors' shared band instead of joining it, carrying an `otherEarth`
  string of its own, which `drawYearBands()` renders in that Earth's own
  color (`--other-earth-current`, not gray, not accent-colored) - both the
  YEAR text and the "EARTH-828"/"EARTH-10005"/"ALT. EARTH" sub-label read
  as one visual unit (the `.year-band--milestone` sub-label mechanism,
  repurposed) - so the axis itself visibly interrupts its normal flow
  right at this card. A title with NO distinct year (Deadpool & Wolverine)
  still gets its own one-off band this same way - it just doesn't move to
  a different point in the sequence to get it, see its own bullet above
  for why. (Splitting a shared band like this needs the same care as any
  other
  yearBands edit - see Gotcha #11 - the span either side of the new
  one-off band shrinks to match, total must still equal the era's real
  card count.)
- `drawConnectors()`: BOTH line segments touching this card (from the
  card before it, and to the card after it) get the `connector-line
  --other-earth` class (still added even though it carries no color
  override of its own - see the color comment above), detected straight
  off each endpoint's rendered `data-other-earth-label` (set by
  `buildCard()`/`buildSeriesCard()` from `otherEarth.label`), same "read
  the real DOM" style the rest of this function already uses for
  `--done`. The ONLY thing that actually renders differently is solid vs.
  dashed - the color stays the exact same default `--line` stroke as
  every connector on the page, otherEarth or not (deliberately NOT that
  Earth's own color the way the card/year-band are, and no longer even a
  universal otherEarth color of its own - see the color comment above for
  the full history of that call). DASHED only
  when the two ends are genuinely different realities
  (`connector-line--other-earth-seam` - one end Sacred Timeline and the
  other foreign, or two DIFFERENT foreign Earths); SOLID when both ends
  share the exact same `otherEarth.label` (e.g. two Earth-10005 titles
  that landed next to each other after the full chronological sort above)
  - real continuity within one foreign story doesn't need to read as a
  seam. Works identically for a series card, since it's the same CSS
  class and data attribute either way.
Of the three, only the yearBands entry is Chronological-only - Release
Order's own `yearBands` (`ORDERINGS_MARVEL`, data.js) are plain
`{label, span}` real-release-year bands with no `otherEarth` field
anywhere in that ordering's array at all, so there's no axis-strip
equivalent to break out there (recoloring/relabeling the strip itself per
Earth under Release Order was never asked for - only the CARDS needed to
carry the categorization, see below). The card tint/badge and the
connector treatment both apply under EITHER ordering - `buildCard()`/
`buildSeriesCard()` still take an `isChronological` flag from `render()`
(checking `ordering.id`), but it now gates ONLY the meta line's year-text
swap (`otherEarth.year` vs. the real release year, see `buildCard()`'s own
comment above), not `otherEarth` itself or anything downstream of it - so
`drawConnectors()`, which reads the real rendered `data-other-earth-label`
DOM attribute rather than checking `isChronological` on its own, picks up
the correct dashed/solid treatment automatically under Release Order too,
no separate change needed there. (This was flipped from an earlier
design, where `const otherEarth = isChronological ? movie.otherEarth :
null` gated the tint/badge themselves too, so a card's Earth was
completely invisible outside Chronological even though the Multiverse
filter already worked - functionally - under Release Order from the start;
a user request asked for the visible categorization to match the
already-working filter under both orderings.)

**Marvel One-Shots and the classic Netflix "Defenders Saga" shows - real
Earth-616 content positioned by user request, not by strict date.**
Twelve titles added in one pass, none of them `otherEarth` (all genuinely
Sacred Timeline):
- Five short bonus films (`oneshotagentcarter`/`oneshotfunnything`/
  `oneshotconsultant`/`oneshotitem47`/`oneshotallhailtheking` in
  `MOVIES_MARVEL`) - Marvel's own official "One-Shot" shorts (4-15 min
  each), originally home-video Blu-ray bonus features rather than
  theatrical releases. Modeled as ordinary `type: "film"` movie cards
  despite the runtime - no special handling needed anywhere else in the
  app for a short film. `year` on each is its real HOME-VIDEO release
  year (the only real-world date any of them has), verified via
  Wikipedia/IMDb per this file's own "never invent from memory-only
  confidence" rule (already applied elsewhere to episode data, extended
  here to a short film's own runtime/date).
    None has a book-sourced in-universe date - the DK official timeline
  this file otherwise follows for `ORDERINGS_MARVEL`'s Chronological era
  doesn't cover the One-Shots at all - so each was positioned on that axis
  by explicit user request, relative to one specific neighboring movie
  (Agent Carter right after `cap1`; Funny Thing Happened.../The Consultant
  both right before `thor1`, in that order; Item 47 right after
  `avengers1`; All Hail the King right after `ironman3`), with a "cca"
  yearBands label approximating that neighbor's own date rather than a
  confirmed one - e.g. the ironman2/hulk/thor1 "Spring 2010" band (see the
  yearBands comment on `ORDERINGS_MARVEL`) splits into `span:2` (ironman2,
  hulk) + two one-off "cca Spring 2010" bands (the two One-Shots) +
  `span:1` (thor1) rather than staying one wide band, same per-card
  splitting discipline as any other yearBands edit (Gotcha #11).
    Under Release Order these same five sort by their REAL home-video
  date instead, independent of their Chronological position - notably
  `oneshotconsultant` (Thor's own Sept 13, 2011 Blu-ray) sorts BEFORE
  `oneshotfunnything` (Captain America's Oct 25, 2011 Blu-ray) there, the
  reverse of their Chronological order, since the two orderings are
  answering different questions ("what happened when" vs. "what came out
  when") and nothing requires them to agree on relative order for a pair
  this close together.
    id `oneshotagentcarter`, not `agentcarter` - that id already belongs
  to the ABC "Marvel's Agent Carter" SERIES (`SERIES_MARVEL`), a
  completely different entry; keeping the two distinct avoids an id
  collision between a `MOVIES_MARVEL` and a `SERIES_MARVEL` entry.
- Six more shows (`daredevil`/`jessicajones`/`lukecage`/`ironfist`/
  `defenders`/`iamgroot` in `SERIES_MARVEL`, seasons in `SEASONS_MARVEL`) -
  the original 2015-2018 Netflix "Defenders Saga" corner (Daredevil
  seasons 1-2, Jessica Jones season 1, Luke Cage season 1, Iron Fist
  season 1, The Defenders miniseries) plus I Am Groot (2 seasons, stop-
  motion shorts). All real Earth-616 canon - Daredevil: Born Again's own
  direct-continuation status (already reflected in `daredevilba` above)
  confirms the Netflix corner is canon too - so none of these six carries
  `otherEarth`. Only plain episode counts (13/13/13/13/8, and 5/5 for I Am
  Groot), no curated `episodeTitles`/`episodeRuntimes` - this file's
  default uncurated treatment, same as most other Marvel shows here (see
  the per-episode data rule below).
    id `daredevil`, not `daredevilba` - that id already belongs to the
  2025 revival "Daredevil: Born Again" above; keeping the two distinct
  avoids a collision between this original series and its own direct
  sequel show. Daredevil season 1 and Jessica Jones season 1 sit right
  after `gotg2` on the Chronological axis (user request, "cca 2014-2015"/
  "cca 2015" - no confirmed in-universe date, approximated from each
  show's own real air year and its requested position); Daredevil season
  2, Luke Cage, Iron Fist and The Defenders sit right after `antman1`
  ("cca 2016"/"cca 2017"). I Am Groot's two seasons sit right after
  `gotg2` too and MERGE into one card there (same seriesId, consecutive -
  `groupEraItems()`), unlike under Release Order, where their real release
  years (2022/2023) are too far apart to be adjacent, so they stay two
  separate cards at their own separate real slots (Aug 2022, between
  `thor4` and `shehulk-s1`; Sept 2023, between `secretinvasion-s1` and
  `loki-s2`) - same "merge only where the two orderings' own itemIds
  happen to place them consecutively" behavior every other multi-season
  show in this file already has (loki-s1/loki-s2, daredevilba-s1/-s2).
    This whole cluster is a deliberate, user-directed positioning
  exception to the "always fully interleave by real/in-universe year"
  discipline documented at length above `ORDERINGS_MARVEL` for the
  otherEarth titles - these six shows are NOT otherEarth (they're Sacred
  Timeline), so there's no seam/dashed-connector signal marking the
  override the way there is for a foreign-Earth cluster; it's simply
  accepted as the user's own placement, same category of deliberate
  exception as the xmendofp "rewrite" cluster (see its own comment) even
  though the underlying reason differs (there: showing a rewritten branch
  as one clustered unit; here: grouping four thematically-linked Netflix
  shows together at one point on the axis rather than scattering them
  across their own individual real years).
    All twelve titles were verified end-to-end after adding: the
  structural id-reference + yearBands span-sum checks (Gotcha #11) for
  both `ORDERINGS_MARVEL` eras, and a full Playwright pass (card counts,
  zero vertical scroll overflow across several viewport sizes, zero
  console/page errors, every rendered card's horizontal center falling
  inside exactly one `.year-band` element) for both Chronological and
  Release Order - the same pipeline every yearBands edit in this file
  needs, re-run here because inserting into an EXISTING span-3+ band (the
  "Spring 2010" split, the "2011"/"2012"/"2013" Release Order clusters
  absorbing new members) is exactly the kind of edit Gotcha #11 warns
  about getting silently wrong.

**"Measure the real thing" over computing it by hand.** Connectors
(`drawConnectors`), year-bands (`drawYearBands`), the first-era lead space
(`fixFirstEraLeadSpace`), season-list height caps (`capSeasonListHeights`),
and wide-card sizing (`widenSeriesCard`) all read real `getBoundingClientRect`
/ measured text widths off the actual rendered DOM rather than
precomputing from constants. Constants (`SEASON_ROW_H`, `MOVIE_META_H`,
etc.) exist only as *budgets* fed into `sizeTimelineToViewport`'s poster-size
solve, where real measurement isn't available yet (nothing's laid out).
When a constant and reality drift apart, prefer switching the dependent
code to real measurement over just re-tuning the number (see Gotchas -
this has already happened once with `SEASON_ROW_H`).
  `widenSeriesCard()`'s own text measurement used to only cover season
ROW content (name, "year · N · runtime") via a single-line canvas
`measureTextWidth()` - safe because that text is `white-space: nowrap` in
css (one line, ellipsis if too long, see the comment on
`.season-row__name`). The series TITLE above the season list is different
- it wraps across up to 2 lines (`-webkit-line-clamp: 2`) - so a
single-line width measurement is the wrong question for it, and a naive
"just budget half the single-line width" shortcut (tried first) still
under-measured it for "Your Friendly Neighborhood Spider-Man" (this app's
longest series title yet - real greedy word-wrap doesn't split into even
halves: "Your Friendly" wraps far shorter than "Neighborhood
Spider-Man"). `minWidthForTwoLineTitle()` fixes this the same
"measure the real thing" way as everything else in this section: a
hidden, off-DOM clone of `.card__title`'s own font/line-height (no
line-clamp, so it wraps freely) binary-searched down to the narrowest
width where its real rendered height still fits 2 lines. Any future card
content that's allowed to wrap (rather than staying on one line) needs
this same real-measurement treatment, not a single-line width shortcut.

**Two base orderings + Storylines as a third, MUTUALLY EXCLUSIVE mode** -
not a filter layered on top of the other two. `ORDERINGS` (data.js) has
exactly Chronological and Release Order - two independent `itemIds`
sequences over the same `MOVIES`/`SEASONS`; a season can merge with
adjacent seasons of the same show in one ordering and not the other,
purely based on what else sits between them in that specific sequence -
see `groupEraItems()`. `STORY_LINES` (data.js) backs the third pill next
to the order-switch tabs - a dropdown button styled to sit as the third
segment of the same switch (see `buildStoryLineSelect()`), not a
standalone control. Picking a story line (today: "Anakin Skywalker") is
exactly as exclusive with Chronological/Release Order as those two are
with each other: `updateOrderSwitchActiveState()`/`updateStoryLineSelectUI()`
keep all three in sync so only one is ever shown active, and `render()`
always resolves the ordering to `"chronological"` while a story line is
picked - regardless of `state.orderingId`'s stored value - since a
personal story arc has no Release Order variant. Clicking Chronological or
Release Order directly clears `state.storyLineId` back to `""` (exits
Storylines mode); clicking a story line in the dropdown sets
`state.orderingId` to `"chronological"` too, purely to keep persisted
state internally consistent (render() doesn't actually depend on it once
a story line is active).

A story line says what belongs in it one of two ways:
- `chapters.chronological` - its OWN era breakdown, for when Chronological's
  generic eras ("Fall of the Jedi", "Reign of the Empire" ...) don't fit
  this story's own shape - Anakin's arc reads as "Child -> Jedi -> Fall ->
  Sith -> Redemption -> Legacy", not galaxy-scale era names. `render()`
  checks `storyLine.chapters[ordering.id]` first (ordering is always
  `"chronological"` here) and, if present, uses THAT array as the eras
  instead of Chronological's own - a chapter's `itemIds` are already the
  exact final ids to show (slice ids included, e.g. `"cw-s1-anakin"`), so
  there's nothing left to filter, only empty chapters to drop (same
  `.filter(Boolean)` as the plain-filter path below). No `description` on
  a chapter, unlike a real era - `hasEraDescriptions` (render()) treats
  ANY active `chapters` array as needing the same taller header reservation
  a real description would, purely for the breathing room, even with no
  blurb text to show.
- `replace` - the fallback for a simpler future story line that's happy
  reusing Chronological's own eras, just thinned out. `render()` runs each
  era's `itemIds` through `filterItemIdsForStoryLine()` against the story
  line's `replace` map, and drops any era left with nothing in it - only
  reached when that story line has no `chapters.chronological` (chapters
  always win when both would apply). This is why a story line needs no
  hand-typed second sequence the way an earlier version of this feature
  did: Chronological's own era structure does the reordering for free,
  just thinned out.

`yearBands` keep showing under a story line either way - a `chapters`
story line defines its own per-chapter `yearBands` array right alongside
its `itemIds` (see e.g. "Anakin Skywalker"'s own `chapters.chronological`
entries, each with a `label`/`itemIds`/`yearBands` of its own), while a
plain `replace`-filtered story line reuses Chronological's own `yearBands`
via the same real-DOM-lookup mechanism the Multiverse/Doomsday filters use
(see `buildRawIdToBandMap()`'s own comment in app.js) - an earlier version
of this app disabled the strip entirely for the `replace` case, reasoning
its `span` counts were tied to the FULL unfiltered era card count and not
worth re-deriving per filter; that reasoning stopped applying once band
attribution moved from span-countdown to per-card lookup (see the
Multiverse section below for the fuller history of that change). Adding a
second story line later is one more `STORY_LINES` entry - `chapters` (with
its own `yearBands` per chapter) only if its own arc genuinely doesn't fit
Chronological's generic eras and dates, `replace` alone (reusing
Chronological's own bands automatically) is enough if it does - no
`app.js` changes needed either way.

**Multiverse checkbox filter (Marvel only) - a FILTER, not a fourth
mutually-exclusive mode.** Unlike Storylines above, picking Chronological/
Release Order/a story line doesn't touch this, and toggling a checkbox
here doesn't touch which of those is active either - they compose.
`EARTH_BUCKETS` (data.js, id/label pairs - today: `616`/`10005`/`828`/
`96283`/`120703`/`688`/`outsidetime`/`others`, see that array's own comment
for how it grew from four to eight - `outsidetime` (Loki, both seasons -
see its own bullet above) is the one entry that isn't a numbered Earth at
all)
backs one real `<input type="checkbox">` row per
bucket in a dropdown menu next to the order-switch
(`buildMultiverseSelect()`/`populateMultiverseMenu()` in app.js - genuine
multi-select, so real checkboxes rather than the button-per-option pattern
`populateStoryLineMenu()` uses for its single-select list). `earthBucketId()`
sorts a movie/season into one of these purely from its own `otherEarth`
field (`616` = none at all, every other NAMED bucket = `otherEarth.label`
matching that bucket's own Earth, `others` = any `otherEarth.label` that
doesn't match a named bucket - today: Your Friendly Neighborhood
Spider-Man's Earth-86445 and Marvel Zombies' Earth-89521, both real
confirmed Earth numbers that just aren't given a bucket of their own) -
true regardless of
ordering, and as of a later request so is the CARD's own visible
categorization (tint + `.card__origin-earth` badge, see the three-bullet
list above) - not just the filter's own hide/show behavior, which had
already worked under both orderings from the start since it operates on
`itemIds` before any card ever renders. (An earlier design left the
tint/badge themselves gated to Chronological only, so a user could filter
by Earth under Release Order but never actually SEE which Earth a visible
card belonged to there - fixed by dropping the `isChronological` gate on
`buildCard()`/`buildSeriesCard()`'s own `otherEarth` lookup, keeping it
only on the card's year-TEXT swap, which does still need to stay
Chronological-only - see `buildCard()`'s own comment.)
  `state.enabledEarths` (a `Set` of bucket ids, all of them by default -
persisted via `MULTIVERSE_STORAGE_KEY`, same pattern as `orderingId`/
`storyLineId`) drives `filterItemIdsForMultiverse()` - a `render()`-time
pass over each era's `itemIds` (after story-line filtering/chapters, so
the two compose, even though in practice they never both do anything at
once today: Storylines is Star Wars-only, Multiverse is Marvel-only,
since only Marvel has `otherEarth` content to filter by at all), dropping
any id whose bucket isn't checked and the whole era if nothing survives -
same shape as `filterItemIdsForStoryLine()`. Unchecking the LAST enabled
box is rejected in the checkbox's own `change` handler (immediately
re-checks itself) - an axis with every universe hidden is a confusing
dead end, not a useful filtered view.
  `yearBands` keep showing here too, same as under Storylines' own
`replace` filter above - unchecking a box does NOT turn the strip off.
This used to be the one thing every filter in this app (Storylines'
`replace`, this, and later Watchlist for Doomsday) all did the same way:
disable the whole strip outright, reasoning that a band's `span` count was
authored against the FULL unfiltered era card count, and re-deriving it
per filter combination wasn't worth it for a strip whose entire value is
precision. That held right up until a user explicitly pushed back on it -
filtering the CARDS was never supposed to mean losing the AXIS too - so
`render()` now builds a `rawIdToBand` lookup (`buildRawIdToBandMap()`,
app.js) against each era's own FULL, unfiltered `itemIds`/`yearBands`
ONCE, independent of any filter, and every rendered (possibly filtered)
card just looks up its own band by id afterward - filtering only changes
which cards are visible, never which band a surviving one belongs to, so
the strip now survives ANY combination of Storylines/Multiverse/Doomsday
filtering without needing per-filter special-casing at all. Consecutive
surviving cards that resolve to the exact same band (object identity, not
just matching text - two distinct one-off bands can share identical
label text and must NOT merge) still merge into one visual entry, same as
the unfiltered case always did. Connectors/`cardGapBefore` never needed
any of this special-casing in the first place - they're either driven by
real rendered `getBoundingClientRect()` (connectors) or check membership
in a small fixed id list that's all Sacred-Timeline content anyway
(`cardGapBefore`), so a filtered-out card simply isn't there to connect to
or gap against, no different from it never having existed in the dataset
at all.
  The whole control hides itself (`populateMultiverseMenu()`, same
inline-`style.display` trick as `populateStoryLineMenu()`'s own
empty-`STORY_LINES` case, for the same Gotcha #3 reason) when the active
franchise has no `otherEarth` content anywhere in its `MOVIES`/`SEASONS`
at all - Star Wars today. `switchFranchise()` resets `state.enabledEarths`
back to "every bucket checked" on every switch, same reasoning as resetting
`storyLineId` - which universes were checked/unchecked belongs to the
franchise you were just looking at, not a preference that should carry
over to a different one.

**Core MCU and Watchlist for Doomsday (Marvel only) - two single
checkboxes sharing one `.header-toggle` CSS class, sitting right after
Multiverse in the header, Core MCU first then Doomsday.** Both are
FILTERS with the identical shape and behavior (force-reset
`state.enabledEarths` to "every bucket checked" and lock every Multiverse
checkbox while active, same "no independent per-mode memory" simplicity
on toggling back off - see either one's own `change` handler in app.js) -
the only things that differ between them are WHAT they filter down to and
that they're MUTUALLY EXCLUSIVE with each other (turning either one ON
turns the other OFF first, in that toggle's own handler - requested
explicitly; each still persists its own on/off state independently
under its own storage key, "mutually exclusive right now" isn't "one
shared value").
  **Core MCU** (`state.coreMcu`, `CORE_MCU_STORAGE_KEY`) is a DERIVED
filter, not a curated list - `filterItemIdsForCoreMcu()` (app.js) keeps
any title with no `otherEarth` field at all (genuine Earth-616/Sacred
Timeline) PLUS any title whose `otherEarth.label` is specifically
`"Outside Time"` (Loki, What If...? - requested explicitly: "not Sacred
Timeline, but still Core MCU in Marvel Studios' own production"), minus
`FRANCHISE_DATA[franchiseId].coreMcuExclude` (data.js) - today just Agent
Carter (`agentcarter-s1`/`-s2`), real Sacred-Timeline continuity but
produced by the OLD "Marvel Television" division under ABC Studios, years
before that merged into Marvel Studios in 2019, so it doesn't count as
"that modern Marvel Studios production" the checkbox is named for even
though it's the same fictional universe. "Outside Time" earns the same
inclusion Sacred Timeline gets because it was never really a foreign
CONTINUITY to begin with (unlike every other otherEarth label - Fox's
X-Men, Sony's various Spider-Man universes, Fantastic Four's Earth-828,
all numbered alternate Earths) - it's Marvel Studios' own TVA/multiverse
framework, just with no fixed date to place it at (see that bucket's own
comment on `EARTH_BUCKETS`, data.js). Everything else Sacred-Timeline -
including period pieces like Captain America: The First Avenger (1943) or
the ancient-history anthology Eyes of Wakanda - IS a real modern Marvel
Studios production regardless of when its own story is SET, so none of
them need excluding; only the one production-company exception does.
Being derived rather than curated means any FUTURE Sacred-Timeline (or
"Outside Time") addition is automatically included without this file
needing an update, unlike Doomsday's own fixed list below. Visibility
(`populateCoreMcuToggle()`) reuses the exact same "does this franchise
have ANY otherEarth content at all" check `populateMultiverseMenu()`
already computes for its own visibility (Star Wars has none, so both
controls hide there) - `coreMcuExclude` being `[]` for a franchise isn't
itself what hides the control, unlike Doomsday's own empty-array check,
since membership here is otherEarth-derived, not listed at all.
  **Watchlist for Doomsday** (`state.doomsdayWatchlist`,
`DOOMSDAY_STORAGE_KEY`) filters down to Marvel Studios/Disney+'s own
officially-announced 15-title "watch before Avengers: Doomsday" list
(`DOOMSDAY_WATCHLIST_MARVEL`, data.js - that array's own comment carries
the sourcing) - two pre-MCU Fox X-Men films, four Infinity Saga entries,
one Disney+ series (`loki-s1` only, not both seasons - every source dates
the entry "(2021)", season 1's own release year), and eight Multiverse
Saga titles. `FRANCHISE_DATA[franchiseId].doomsdayWatchlist` is a plain
array of ids, not a Set or a new `EARTH_BUCKETS`-style bucket -
`earthBucketId()`/Multiverse categorization don't know this list exists
at all. `[]` for Star Wars (no such real-world campaign exists for it)
drives the same hide-the-whole-control pattern Storylines'/Multiverse's
own empty-array cases already use (`populateDoomsdayWatchlistToggle()`) -
unlike Core MCU above, this one genuinely does check the list's own
length, since membership here has nothing to derive from otherEarth data.
  Both compose with everything else the same way Multiverse itself does
(see `filterItemIdsForCoreMcu()`/`filterItemIdsForDoomsdayWatchlist()`,
`render()`'s own `eraGroups` mapping - both run LAST, after story-line
filtering and Multiverse, Core MCU before Doomsday matching their own
left-to-right header order, though at most one of the two ever actually
filters anything on a given render since they're mutually exclusive).
Locking Multiverse works identically for both: `.disabled = true` set in
both `populateMultiverseMenu()` and `updateMultiverseSelectUI()`, checked
against `state.doomsdayWatchlist || state.coreMcu` so the lock survives a
menu rebuild OR a plain UI refresh regardless of which one is active -
requested explicitly so a fixed, named filter is always seen exactly as
announced, never further narrowed by whichever universes happened to be
checked already. Native `disabled` alone blocks all interaction with
those checkboxes (no `click`/`change` fires), so neither toggle's own
`change` handler needs a redundant runtime guard for this.
  `yearBands` keep showing under EITHER filter, same as under Storylines'
own `replace` filter and Multiverse above - Core MCU cutting the axis
roughly in half, or Doomsday cutting it down to 15 titles, are both much
more aggressive filters than Multiverse usually applies, but the strip's
own `buildRawIdToBandMap()` lookup (see the Multiverse section above for
the full history of that mechanism) doesn't care how MUCH got filtered
out, only that each surviving card can still find its own real band.
Visually, `.header-toggle[data-active="true"]` gets the FULL accent
treatment (border + text + glow) rather than the thinner outline-only
`.multiverse-select[data-active]` gets for a partial filter - neither is a
small tweak to the current view, each swaps the whole axis down to a
fixed subset and locks another control, so both earn a louder "this is
ON" signal than a few unchecked universes do.

**Release Order is one flat era, not "trilogies + everything else".**
It used to split into four eras (Original/Prequel/Sequel Trilogy, plus a
grab-bag era for every show/anthology film) - that forced the trilogies to
sit apart from whatever else actually released around the same time, even
though this mode's entire point is "what came out, in what order". Its
`eras` array today has exactly one entry, with every movie and season -
trilogies included - in one `itemIds` list sorted purely by real-world
release year (hand-maintained; recompute by hand if items are ever added,
same as its `yearBands` below). That single era's `label` is
deliberately `""` - `era-block__label` centers itself on its own
era-block's midpoint, so a real label on an era spanning the ENTIRE
9000px+ track would render centered in the horizontal middle of the whole
timeline, invisible without scrolling there first. An empty title still
renders its `::before`/`::after` gradient lines (see `style.css`), which
meet edge-to-edge into one continuous accent rule at the very top of the
axis, above the year-band strip (see "Timeline header stacking order"
above) - the divider this ordering needs without a redundant title
fighting the "Release Order" pill for the same job. Its `yearBands` carry
real release years (or a `"2008–2014"`-style range) instead of
Chronological's in-universe BBY/ABY strings - same `span`-per-rendered-card
mechanism (see the comment on `ORDERINGS` in data.js), so a run of
same-show seasons that merges into one card (e.g. Clone Wars S1-S6) gets
ONE band entry spanning the real years that card covers, while separate
cards that happen to share one release year (Kenobi/Andor S1/Tales of the
Jedi, all 2022) share one band with `span: 3`.

**Season "slices"** (`sliceOf` on a SEASONS entry) let part of a real
season appear as its own card somewhere else on the timeline, while other
views keep the season whole. Two ways to say *which* part:
- `episodeOffset` - a contiguous run starting `episodeOffset` episodes in
  (Clone Wars S7's last 4 episodes after Revenge of the Sith, Tales of the
  Jedi's E5-E6 after The Bad Batch, Resistance S1's E20-21 after The Last
  Jedi). `seasonDisplayLabel()` auto-appends the covered range, e.g.
  `"S7: The Final Season (e09-e12)"`.
- `episodeNumbers` - an explicit, ordered array of real episode numbers
  for a *non-contiguous*, hand-picked subset (the "Anakin Skywalker" story
  line's curated Clone Wars/Tales of the Jedi/Rebels/Ahsoka seasons - only
  the episodes that are actually about Anakin, out of a whole season's
  worth). Takes priority over `episodeOffset` when both could apply.
  `seasonDisplayLabel()` skips the range suffix here - there's no single
  contiguous range to describe, so the label stays plain (the meta line's
  own episode count already says how many made the cut).
- A `STORY_LINES` `replace` map entry can point to an ARRAY of ids too -
  one item in Chronological's own itemIds expanding into several slice
  cards back to back for a story line that reuses Chronological's generic
  eras via `replace` instead of defining its own `chapters` (see the
  "Storylines" comment above) - not exercised by Anakin today, which
  defines `chapters.chronological` directly instead and so lists its
  slices (`cw-s1-anakin`, `cw-s7-anakin`/`cw-s7-siege`, ...) straight in
  each chapter's `itemIds`, no `replace` map involved.

`realEpisodeNumber(season, n)` is the ONE place that resolves a slice's
loop position back to a real episode number, for both mechanisms -
`episodeId()` (storage key), `buildEpisodePillsHtml()` (pill numbering)
and `seasonTotalRuntimeMin()` (runtime summing, see below) all go through
it rather than re-deriving it. Ticking an episode from a slice or from the
whole-season card is the exact same action, always in sync.
`getTotalUnits()`/`getWatchedUnitsCount()` explicitly skip `sliceOf`
entries so a split season still only counts once. When asked to split a
show this way, follow this pattern rather than inventing a new one - and
see Gotcha #8 before touching `episodeOffset` on a season that ISN'T a
slice (The Mandalorian's running "Chapter N" numbering also uses this same
field name for something unrelated).

**Per-episode watched-state + curated titles.** `SEASONS` entries only
ever hold a plain episode *count* unless the user has explicitly supplied
real titles - `episodeTitles` (array) + optional `episodePrefix` (defaults
to `"E"`) turn on real per-episode pills. **Never invent episode or season
titles from memory-only confidence.** Only add curated titles when the
user gives them directly, or after verifying them with a web search for a
specific, named, reasonably-small show they've asked for by name - a full
catalog sweep is 400+ episodes across ~15 shows, too much to responsibly
guess. Don't proactively fill this in for shows the user hasn't asked
about. The same rule applies to `episodeRuntimes` (per-episode minutes,
used by `seasonTotalRuntimeMin()`) - every show that has one today was
looked up via TMDB's season pages (Wikipedia's own episode tables don't
carry runtimes), not guessed. A show that hadn't aired yet at the time it
was added obviously couldn't have this verified - `totalRuntimeMin` (a
plain season-level total) is the fallback for that case (Maul - Shadow
Lord got one before it aired; still true today since nobody's gone back
to replace it with real per-episode numbers), usable only when a card
shows the season whole, never for a hypothetical future slice of it.

**Two watched-progress bars, unit-count and runtime.** The header's
top-right corner shows both `getTotalUnits()`/`getWatchedUnitsCount()`
(movies + real, unsliced seasons, a season only counting once EVERY
episode is checked - unchanged, long-standing) and their runtime
counterparts, `getTotalRuntimeMin()`/`getWatchedRuntimeMin()` (app.js).
The runtime pair works differently on purpose: a partially-watched season
contributes the actual minutes of just its watched episodes (via
`episodeRuntimes`), not all-or-nothing like the unit count - the same
"only the actually-included episodes" principle `seasonTotalRuntimeMin()`
already applies to a partially-curated CARD, just driven by watched-state
instead of a slice's `episodeNumbers`. A season with only a season-level
`totalRuntimeMin` (no per-episode breakdown) has no minutes to attribute
to one episode at a time, so it stays all-or-nothing for the same reason
its card display already is. Adding a second progress row like this cost
real header height, which `sizeTimelineToViewport()` eats directly out of
- see the budget comment on `.progress-group` in style.css before adding
a third one or growing this one further.

**No real poster art anywhere on the page - VELKÁ ZMĚNA (user-requested),
permanent, not behind a flag.** Started as a 3-card experiment ("what
would this look like without real posters"), then explicitly asked to
roll out everywhere with a redesigned look, and later made permanent: every
`poster` image path (and the whole per-franchise image-fetching workflow
that used to be documented here) has since been removed from `data.js`
entirely, `buildCard()`/`buildSeriesCard()` (app.js) render the tile
unconditionally with no `<img>` fallback branch left in the code, and
`img/`/`data/timeline.csv` no longer exist in the project at all. Reviving
real poster art would mean re-adding `poster` fields to `data.js`, re-
fetching the images, and re-adding an `<img>` branch to both builder
functions and to `.card__poster-wrap` in style.css - a real (if
mechanical) piece of work, not a one-line flag flip like it used to be.
The four-tier sizing below and the tile-color system are independent of
that either way - they were never coupled to whether the poster itself was
a real image or a placeholder tile, so reviving real art would only affect
what's INSIDE `.card__poster-wrap`, not any of the surrounding layout
math.
  **Four-tier size hierarchy** (user-requested, replacing the old
two-tier movie/series split) - tile size AND title-text size both scale
with a title's own "importance", biggest to smallest:
  1. **Badge tier** - Avengers films (Marvel) and Episode I-IX (Star
     Wars), i.e. anything with `movie.badge` set (`data.js`) -
     `.card--badge-tier` (`buildCard()`'s own `isBadgeTier` check).
  2. **Movie tier** - every other `type: "film"` entry.
  3. **Series tier** - every `SEASONS`/`SERIES` card. This one is the
     UNSCALED baseline (`posterH`, solved by `sizeTimelineToViewport()`
     exactly like before) - every other tier is *derived* from it, same
     "never fed back into the solve" safety pattern the old
     `MOVIE_POSTER_SCALE` already used.
  4. **Short tier** - a movie with `runtimeMin` under
     `SHORT_RUNTIME_THRESHOLD_MIN` (20 min; today the five Marvel
     One-Shots) - `.card--short`. Checked only when NOT badge-tier
     (`isBadgeTier` wins if a future title somehow had both).

  Each step down is a flat 15% smaller than the step above -
  `SHORT_POSTER_SCALE` (`0.85`) is the one literal number, every tier
  above series is that same `0.85` step applied in reverse (`MOVIE_POSTER
  _SCALE = 1 / 0.85`, `BADGE_POSTER_SCALE = MOVIE_POSTER_SCALE / 0.85`) so
  the whole chain stays internally consistent regardless of which tier
  you reason from. `sizeTimelineToViewport()` sets `--badge-card-w`/
  `--movie-card-w`/`--short-card-w` (all still `posterH`-derived, series
  itself just reads the bare `--card-w`) - a scaled-UP tile (badge/movie)
  only needs to fit inside the same hard-limit fallback that already
  guarantees no overflow for ANY poster size (see that function's own
  fallback-layers comment), so this doesn't need its own algebraic proof
  the old single `MOVIE_POSTER_SCALE` once did.
    The tile itself is forced **square** (`aspect-ratio: 1/1` on
  `.card__poster-wrap`, gated on `.card--tile`, unconditionally present on
  every card now) instead of the old ~2:3 real-poster ratio -
  `min-height: 0 !important` clears the old portrait-height
  budget so the square can actually be smaller than it (always safe, a
  smaller box only ever needs LESS room). WIDTH still comes from the same
  `POSTER_RATIO`-based formula as before (kept as a named constant purely
  for that width math, despite no longer describing the tile's own
  rendered proportions) - only the rendered HEIGHT changed, derived from
  that width instead of a real image's natural size.
    The badge/short/movie width rules on `.card--movie`/
  `.card--badge-tier`/`.card--short` are unaffected by any of this -
  aspect-ratio only overrides the poster-wrap's HEIGHT, so the existing
  width cascade (`.card--movie.card--badge-tier`/`.card--movie.card
  --short`, both higher specificity than `.card--movie` alone) still
  drives how wide each tier's square actually is.
  **Tile color follows the card's own "Earth", not just the active
  franchise** (user-requested, "aby se viditelně odlišily tituly, které
  spolu nesdílejí stejný Earth") - `--tile-color` (style.css `:root`)
  defaults to `--accent` (the current franchise's own color), and
  `.card--other-earth` overrides it to `--other-earth-current` - the EXACT
  same variable the card's border/meta tint already read (see
  `--other-earth-current`'s own comment) - so a Fox X-Men title (steel
  blue) and a plain Sacred Timeline title (red/gold) get visibly different
  TILE colors automatically, with zero JS changes: the existing
  `data-other-earth-label`/`.card--other-earth` mechanism from the
  otherEarth system already did all the work. `color-mix()` derives a
  darker background tint and a lighter icon tint from that one
  `--tile-color` (`--tile-bg`/`--tile-icon-color`, plus `--tile-bg-strong`
  /`--tile-icon-color-strong` for the badge tier's own louder treatment) -
  no per-franchise/per-Earth "dark red"/"light red" tokens needed, the
  same formula works for any `--tile-color`.
    **Gotcha hit building this**: a custom property's `var()` references
  do NOT lazily re-resolve down the tree the way a REGULAR property does -
  `--tile-bg: color-mix(in srgb, var(--tile-color) 20%, var(--bg-elevated))`
  declared once at `:root` keeps substituting `var(--tile-color)` using
  `:root`'s OWN value (`--accent`) even on a descendant where
  `--tile-color` was locally overridden, because `--tile-bg` itself is
  never RE-DECLARED at that descendant - only `--tile-color` was. Caught
  by comparing `getComputedStyle` on two cards from different Earths and
  finding IDENTICAL `--tile-bg`/rendered `background-color` despite
  correctly-different `--tile-color`. Fixed by re-declaring all four
  derived tokens (not just `--tile-color`) inside `.card--other-earth`
  too, with the identical `color-mix()` formula - any FUTURE place that
  needs its own `--tile-color` override needs this same full
  re-declaration, not just the one variable.
  **`(Animated)` badge suffix** (user-requested - "teď už to nepůjde
  poznat čistě z náhledu" now that there's no real poster art to tell
  live-action from animation at a glance) - `movie.animated`/
  `series.animated` (`data.js`, boolean, absent = false) appends
  `" (Animated)"` to the badge text (`"Movie (Animated)"`/`"Series
  (Animated)"`, uppercased by the existing `text-transform` same as every
  other badge). Flagged so far: Star Wars' `clonewarsMovie` (the 2008
  film) plus nine animated shows (`clonewars`, `rebels`, `badbatch`,
  `talesEmpire`, `maul`, `resistance`, `talesJedi`, `talesUnderworld`,
  `youngJedi`); Marvel's `whatif`, `marvelzombies`, `eyeswakanda`,
  `iamgroot`. Every other title in both datasets is live action and
  carries no flag at all, same "absent means false" convention as
  `otherEarth`/`badge`. A show's flag lives on the SERIES entry, not
  per-season - animated-ness is a property of the whole show.
  **Title text lives INSIDE the tile now, not duplicated below it**
  (user-requested, once the tile carried the title itself: "už nebude
  nutné mít nadpis i pod plakátem") - `.card__meta`'s own
  `<p class="card__title">` line is gone entirely (no ternary branch left
  that ever renders it); only the year/runtime (movie) or season list
  (series) remains below the tile. `posterPlaceholderHtml()` (app.js,
  shared by both `buildCard()`/
  `buildSeriesCard()`) renders the title plus a large, dim, oversized echo
  of `favicon.svg`'s own filmstrip icon behind it (same `--bg-elevated`
  base + accent-band + punched-out-hole color relationship the favicon
  itself uses, just re-expressed with `currentColor`/`var(--tile-bg)`
  instead of hardcoded hex so it inherits the per-Earth tile color above) -
  first pass here was a flat, unrelated gray box that read as a generic
  "broken image" rather than as part of this app; reusing the site's own
  icon language fixed that.

## Gotchas already hit (don't reintroduce)

1. **TDZ crash from `let`/`const` placed near where they're used, not at
   the top.** `render()` runs synchronously during `init()`, which itself
   runs during the module's first top-to-bottom pass - so any `let`/`const`
   that render() (or anything it calls) touches must be declared *before*
   `init()` is called in source order, not just "near the function that
   uses it". This has thrown a `ReferenceError` on page load three times now
   (`expandedSeason`, `SEASON_NAME_FONT`/`measureCtx`, `titleMeasureEl`) -
   all three fixed the same way: moving the declaration up to the block of
   top-level state near the top of the IIFE. New module-level state goes
   there, always - even a single `let` for a lazily-created helper element
   (`titleMeasureEl`, `minWidthForTwoLineTitle()`) isn't safe to declare
   "right next to" the function that uses it, if that function can run
   during the first render.

2. **Flexbox `min-height: auto` + `overflow: hidden` = silent squashing.**
   A flex item with `overflow` other than `visible` loses its automatic
   content-based minimum size and can be crushed to fit instead of the
   container actually overflowing/scrolling like it's supposed to. Hit this
   with `.season-row` inside the scrollable `.season-list` - fixed with
   `flex-shrink: 0`. Watch for this any time a flex/grid child both scrolls
   its own overflow *and* needs to never shrink below its content.

3. **`display: X` on a class always beats the `[hidden]` UA rule of the
   same specificity** - so `.some-class { display: flex; }` makes an
   element visible even with the `hidden` attribute set, because they tie
   on specificity and the later/more-specific-in-practice one wins. Always
   scope such rules as `.some-class:not([hidden]) { display: flex; }`. Hit
   this twice (episode panel, then the same mistake again with the season
   flyout).

4. **Stacking contexts trap descendants' z-index.** `.timeline-section` has
   `position: relative; z-index: 1`, so anything compared against it *from
   outside* is compared as that whole subtree at z-index 1 - no descendant
   z-index, however high, escapes that. The season-expand backdrop was
   originally appended to `document.body` at `z-index: 4` intending to sit
   below the flying row's `z-index: 5` but above everything else; instead
   it sat above the ENTIRE timeline section (including the flying row),
   silently eating every click meant for the checkbox/episode pills. Fixed
   by appending the backdrop as an actual sibling of the flying row inside
   `.timeline-track`, in the same stacking context. When adding any
   overlay, check what stacking context its intended target actually lives
   in before picking a parent to append it to - z-index numbers alone
   don't tell you the answer.

5. **`getBoundingClientRect()` is viewport-relative, not scroll-position-
   invariant.** `fixFirstEraLeadSpace()` measures the gap between the
   track's first label and the scroll container's edge to decide how much
   lead margin to add - fine right after a fresh render (`scrollLeft` is
   always 0 then), but it also re-runs on every resize, where the user may
   have scrolled away from the start. The label then reads as thousands of
   pixels off to the left, producing a huge bogus "deficit" that got baked
   in as permanent margin - inflating how far the whole track could be
   scrolled well past the real content forever after. Fixed by snapping
   `scrollLeft` to 0 for the measurement and restoring it right after.
   Same caution applies to any other viewport-relative measurement that
   might run while the user has scrolled.

6. **A hardcoded layout constant drifting from the real rendered value is
   a recurring failure mode here**, not a one-off: `SEASON_ROW_H` (used to
   both budget the poster-size solve AND cap `.season-list`'s max-height)
   went stale after an unrelated markup change made rows taller, and the
   *guessed* cap silently produced a scrollbar (Rebels, exactly 4 seasons)
   even though real content fit. The fix that actually held wasn't
   re-tuning the constant again - it was `capSeasonListHeights()` measuring
   an actual rendered row's height live and deriving the cap from that,
   plus a small explicit safety-margin px. Prefer this pattern (measure
   live, add a small explicit buffer) over a bare constant for anything
   pixel-sensitive enough that drift would visibly break it.

7. **`sizeTimelineToViewport`'s "make the tallest card fit in two rows"
   fallback branch didn't check the result against the actual viewport at
   all** - it only solved for "does the card fit in two rows", which could
   still exceed what the window has room for once `metaH` got tall enough
   (a capped 4-row series card, ~248px). That silently grew `--track-h`
   past the real available height on ordinary laptop screens (reproduced
   at 1366×728), producing a few pixels of always-present, easily-missed
   vertical scroll. Fixed with an explicit final clamp against a true
   (no-breathing-room) viewport limit, falling through to the
   already-existing `.card--overflow` per-card fallback instead of growing
   the whole page. If you touch this function, re-verify with the "diff:
   scrollHeight - clientHeight, exact, no tolerance" check across several
   realistic window sizes, not just one.

8. **`episodeOffset` means two unrelated things depending on whether
   `sliceOf` is also set, and conflating them produces `NaN`.** On a
   genuine slice (`sliceOf` present - Clone Wars S7's early/finale split,
   say), it's an index INTO the real season's arrays, resolved through
   `realEpisodeNumber()`. But The Mandalorian's `md-s2`/`md-s3` also carry
   an `episodeOffset` with NO `sliceOf` - there it's purely a running
   "Chapter N" DISPLAY offset (so S2 starts at "Chapter 9"), and each
   season's own `episodeRuntimes` is still indexed locally (1..8), not by
   the inflated chapter count. `seasonTotalRuntimeMin()` first shipped
   applying `realEpisodeNumber()` unconditionally and read straight past
   the end of `md-s2`'s 8-item array, producing a silent `NaN` string
   nothing crashed on. Fixed by only using `realEpisodeNumber()` for the
   real-array index when `sliceOf` is actually set, and the plain loop
   position `n` otherwise. Any new per-episode array indexed by a season
   needs this same care.

9. **A stray `Write` call overwrote the entirety of `data.js` with
   placeholder text mid-session** - reaching for `Write` out of habit
   while meaning to inspect something, not `Edit`. Recovered losslessly
   only because the project was a git repo with a recent commit at the
   time (`git show HEAD:js/data.js` piped back in) - if it hadn't been,
   that would have destroyed ~1000 lines of hand-curated data with no
   undo. (That repo is gone now - see the note near the top of this file;
   `.git` needs to exist again before this recovery trick works a second
   time.) `Write` fully replaces a file; reach for `Edit` for anything that
   isn't a deliberate full-file rewrite, especially on `data.js`, where a
   single session's worth of curation can't be reconstructed from memory
   alone.

10. **Gotcha #4's stacking-context trap struck again, on a new element
    pair.** `.site-header` and `.timeline-section` both sit at `z-index: 1`
    *on purpose* (so `.timeline-section`'s season-expand backdrop, itself
    scoped inside that same z-index:1 bucket, can dim the header too - see
    its own CSS comment). But that same tie means anything inside the
    header that visually extends past its own bottom edge - an open
    `.story-line-menu` or `.franchise-menu` - loses to `.timeline-section`
    on DOM order and becomes unclickable, no matter how high its OWN
    z-index is set (`.story-line-menu` was position:absolute at
    `z-index: 3`, still buried). The fix is NOT a permanent z-index bump on
    `.site-header` - tried that first, and it silently broke the backdrop
    dimming the header at all. Instead, `.site-header--menu-open` bumps the
    header's z-index only for as long as a menu is actually open
    (`updateHeaderMenuOpenState()`, called from both menus' open/close
    pairs) - safe because a season can't be expanded at that same instant
    anyway, its backdrop would swallow the click needed to open a header
    menu before it got there. Any future header dropdown needs to call
    into this same helper, not just set its own z-index and assume it's
    enough.

11. **A `yearBands` span authored per raw itemId instead of per rendered
    CARD silently mislabels everything after the first merge, with no
    error.** Added Agent Carter (2 seasons) to `ORDERINGS_MARVEL`'s
    "origins" era as two itemIds with one yearBands entry each ("1946",
    "1947") - forgetting that the two seasons merge into ONE card
    (`groupEraItems()`, same seriesId, consecutive). The band-walking loop
    in `render()` advances one step per rendered CARD, not per itemId, so
    that single merged card only consumed the FIRST band entry - every
    band after it then landed one position early on the wrong card
    (Captain Marvel silently showed "1947" instead of "Summer 1995", and
    so on down the whole era), and the era's actual LAST band never got
    consumed at all (nothing left to render it against), so it simply
    never appeared - no console error, no visual crash, just quietly
    wrong/missing labels. Caught only by counting rendered `.year-band`
    elements against the hand-summed expected total and coming up short,
    then cross-checking each card's on-screen position against its
    band's `getBoundingClientRect()`. Fixed by collapsing the two
    per-season entries into one ("1946–1947", `span: 1`) matching the one
    actual card - same fix applied to the Daredevil: Born Again S1/S2
    merge in the "present-day" era, which had the identical bug. The
    `ORDERINGS` comment in data.js already states the rule ("span says how
    many cards-in-a-row... spans must add up to that era's total card
    count post-merge") - the mistake was not re-deriving the actual
    post-merge card count while editing, not ignorance of the rule. Any
    future yearBands edit that touches items sharing a `seriesId` with
    their neighbor needs this checked explicitly, not assumed from the
    raw itemIds list.

12. **A custom property's `var()` references resolve at their DECLARATION
    site, not lazily per element down the tree, the way a real CSS
    property does.** Building the poster-tile color system (see its own
    comment above `--tile-color`), `--tile-bg: color-mix(in srgb,
    var(--tile-color) 20%, var(--bg-elevated))` was declared once at
    `:root`, with `.card--other-earth` overriding only `--tile-color`
    itself (not `--tile-bg`) - reasoning that `--tile-bg` would
    automatically pick up the new `--tile-color` wherever it's later read,
    the same way `--other-earth-current` already worked. It didn't: two
    cards from different Earths, with correctly DIFFERENT `--tile-color`
    (confirmed via `getComputedStyle`), still rendered IDENTICAL
    `--tile-bg` and identical actual `background-color` - because
    `--tile-bg` itself was never re-declared on `.card--other-earth`, so
    its `var(--tile-color)` substitution kept using whatever
    `--tile-color` resolved to AT `:root`, where `--tile-bg` was actually
    written. Fixed by re-declaring all four derived tokens (`--tile-bg`/
    `--tile-icon-color`/`--tile-bg-strong`/`--tile-icon-color-strong`),
    with the identical `color-mix()` formula, inside `.card--other-earth`
    too - not just the one variable it actually needed to change. Any
    future "derive token B from token A, then override A somewhere deeper"
    design needs this same re-declaration at every override point, not a
    single upstream definition - chained/dependent custom properties don't
    re-resolve for free the way inheriting a directly-used property does.

## Style conventions

- Comments explain **why**, not what - and are written for the *next*
  session/agent picking this codebase up cold, referencing the specific
  function/class that has more context. Match this density; don't strip
  comments down to be "cleaner" or pad trivial ones in.
- Comment language follows the existing per-file split: **CSS comments are
  in Czech**, **JS comments are in English**. Match whichever file you're
  editing - don't unify them.
- No abbreviated/cryptic naming - `expandedSeason`, `widenSeriesCard`,
  `capSeasonListHeights` etc. read as full sentences on purpose.
- When a value must stay in sync between JS and CSS (row heights, gaps,
  the `MAX_VISIBLE_SEASON_ROWS` row cap, etc.), say so explicitly in a
  comment on both sides pointing at each other, since nothing enforces it
  automatically - see Gotcha #6 for what happens when that's neglected.
