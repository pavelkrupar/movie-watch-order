/**
 * Rendering + interaction.
 * -----------------------------------------------------------------------
 * - order-switch buttons are generated from ORDERINGS (data.js)
 * - the timeline is a flex row of "era-blocks", each one a flex row of
 *   cards; cards alternate between row 0/1 based on the GLOBAL sequence
 *   (not per-era), so the zig-zag flows continuously across the whole axis
 * - an era item (era.itemIds) is either a movie id (MOVIES) or a season id
 *   (SEASONS). Adjacent seasons of the SAME show (nothing else between
 *   them in that ordering) get merged into one card with a shared poster
 *   by groupEraItems() - which is why the same show can merge differently
 *   in release vs. chronological order (see the comment on SEASONS in
 *   data.js)
 * - connectors between consecutive cards are drawn into an <svg> from the
 *   actual rendered poster positions (getBoundingClientRect), so they stay
 *   correct across window resizes or title-length changes; "watched" for
 *   a connector is read straight off the rendered card's .is-watched class
 * - orderings that define era.yearBands (chronological) get a small
 *   in-universe year strip drawn above the era labels, in the same
 *   "measure the real rendered cards" style as the connectors - see
 *   drawYearBands() and the yearBands comment on ORDERINGS in data.js
 * - watched state is saved to localStorage; a movie is one entry (its id).
 *   A season is NOT one entry - clicking a season row expands it into a
 *   per-episode checklist (episodeId()), and the season only counts as
 *   watched once every one of its episodes is checked (isSeasonFullyWatched)
 *   - see the block comment above buildSeriesCard(). A card turns green
 *   once every season listed on it is fully watched that way.
 * - a card can be taller than the normal two-row budget even at the
 *   biggest allowed poster size (an extremely long merged show). When that
 *   happens the card is pinned to the TOP of its row instead of the
 *   bottom, so the excess spills past the usual bottom line instead of
 *   getting clipped at the top - and .timeline-scroll gets a vertical
 *   scroll fallback (invisible in every normal case) so nothing is ever
 *   actually hidden.
 * -----------------------------------------------------------------------
 */

(() => {
  const STORAGE_KEY = "sw-watch-order:watched";
  // which ordering tab (ORDERINGS[].id) was last selected - kept separate
  // from STORAGE_KEY since it's a UI preference, not watched-progress data
  const ORDERING_STORAGE_KEY = "sw-watch-order:ordering";
  // which story line filter (STORY_LINES[].id, or "" for "All") was last
  // picked - same reasoning as ORDERING_STORAGE_KEY, its own key since
  // it's an independent UI preference from the ordering tab itself
  const STORY_LINE_STORAGE_KEY = "sw-watch-order:storyLine";
  // which franchise (FRANCHISES[].id, data.js) was last active - same
  // reasoning as the two keys above, its own independent UI preference
  const FRANCHISE_STORAGE_KEY = "sw-watch-order:franchise";
  // which EARTH_BUCKETS[].id set was last enabled in the "Multiverse"
  // checkbox filter - same reasoning again, stored as a JSON array (see
  // loadEnabledEarths/saveEnabledEarths)
  const MULTIVERSE_STORAGE_KEY = "sw-watch-order:multiverse";
  // whether the "Watchlist for Doomsday" toggle was last on - same
  // reasoning again, its own key since it's independent of both the
  // Multiverse selection above (which it forces/locks while active, but
  // doesn't own) and the ordering tab
  const DOOMSDAY_STORAGE_KEY = "sw-watch-order:doomsdayWatchlist";
  // whether the "Core MCU" toggle was last on - same reasoning again, and
  // its own independent key even though it's mutually exclusive with
  // DOOMSDAY_STORAGE_KEY above at runtime (see buildCoreMcuToggle()) -
  // "mutually exclusive right now" isn't the same thing as "one value",
  // each toggle still owns and persists its own on/off state.
  const CORE_MCU_STORAGE_KEY = "sw-watch-order:coreMcu";
  // shared checkmark glyph - the season bulk-check and every episode row
  // use this same small square checkbox look
  const CHECK_SVG =
    '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10.5L8 14.5L16 6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  // No more real poster art anywhere on the page - this started as a
  // 3-card experiment (gray box + big title) that the user then asked to
  // roll out everywhere, restyled to fit the app's own look instead of a
  // generic gray placeholder (see posterPlaceholderHtml()'s own comment
  // further down for the icon/color reasoning) and paired with the new
  // four-tier size hierarchy above. This is now the only rendering path -
  // no per-title `poster` image path anywhere in data.js, no flag to flip
  // back to a real `<img>` fallback.
  // meta block height (below the poster) - just the title for a movie, one
  // extra row per season for a show; values roughly match the actual
  // rendered CSS height (.card__meta, .season-row), see sizeTimelineToViewport
  const MOVIE_META_H = 68; // padding + title + year underneath it
  const SERIES_META_BASE_H = 57; // padding + title, no season rows yet
  const SEASON_ROW_H = 44; // always 2 lines (name+chevron, then meta or the expanded controls) - matches the actual rendered row height, see the max-height comment on .season-list in css
  const SEASON_ROW_GAP = 5;
  // a show with more seasons than this (Clone Wars' 7) doesn't grow the
  // card's HEIGHT any further - past this many, the season list switches
  // to extra columns instead of a taller list (see widenSeriesCard() and
  // .card--series-wide in css), so it never needs to scroll to be read
  const MAX_VISIBLE_SEASON_ROWS = 4;
  let metaH = MOVIE_META_H;
  // era header height - shorter when it's just a title (release order),
  // taller when a blurb fits underneath it too (chronological order)
  const ERA_LABEL_H_BASE = 48;
  const ERA_LABEL_H_DESC = 66;
  let eraLabelH = ERA_LABEL_H_BASE;
  // strip below the era label for the per-card "year band" row (date +
  // optional milestone/earth sub-label + reach-indicator line - see
  // "Timeline header stacking order" in CLAUDE.md) - only reserved when
  // the active ordering actually defines yearBands, zero otherwise. Not
  // just the content's own tight height (~28px measured) - deliberately a
  // bit taller than that so .year-band's own vertical centering leaves
  // real breathing room both above (between it and the era title) and
  // below (between its reach-indicator line and the card posters right
  // underneath) - packed edge-to-edge against the posters read as
  // cramped/glued-on rather than as its own distinct row.
  const YEAR_BAND_H = 40;
  let yearBandH = 0;
  // "stagger" ratio (how far the bottom row is offset) relative to card
  // height - controls how much the two zig-zag rows overlap
  const STAGGER_RATIO = 0.57;
  // poster aspect ratio - was ~2:3 (width:height) back when tiles showed
  // real poster art (see the "no more real posters" comment block further
  // down for why that changed) - kept as a named constant purely for
  // WIDTH math continuity (posterW is still derived from posterH the same
  // way it always was), even though the rendered tile itself is forced
  // square (aspect-ratio: 1/1 in css) regardless of this ratio now.
  const POSTER_RATIO = 2 / 3;
  const POSTER_H_MIN = 90;
  const POSTER_H_MAX = 250;
  // Four-tier size hierarchy (user-requested) - every tier is a straight
  // 15%-down step from the one above it, series stays the unscaled
  // baseline (posterH, solved below) exactly like before:
  //   badge (Avengers/Episode I-IX) -> movie -> series (=1) -> short (<20min)
  // Each factor is still only ever DERIVED from posterH at the very end,
  // never fed back into the solve itself - same safe pattern this file has
  // used since MOVIE_POSTER_SCALE was a single flat 1.15. SHORT_POSTER_SCALE
  // is the one absolute number (0.85, "15% down from series") - every tier
  // above series is then that same 0.85 step applied in reverse (divided,
  // not multiplied) as many times as it is steps above series, so the
  // whole chain stays internally consistent: MOVIE = SERIES / 0.85 ("15%
  // bigger than movies would be if series were the top"), BADGE = MOVIE /
  // 0.85. A scaled-UP tile only ever needs to fit within the same slack
  // sizeTimelineToViewport()'s hard-limit fallback already guarantees for
  // ANY tile size - see that function's own comment for the fallback
  // layers - so this doesn't need its own algebraic proof the way the old
  // single MOVIE_POSTER_SCALE once did.
  const SHORT_POSTER_SCALE = 0.85;
  const MOVIE_POSTER_SCALE = 1 / SHORT_POSTER_SCALE; // ≈ 1.1765
  const BADGE_POSTER_SCALE = MOVIE_POSTER_SCALE / SHORT_POSTER_SCALE; // ≈ 1.3841
  const SHORT_RUNTIME_THRESHOLD_MIN = 20;
  // Floor for fitTilePlaceholderTitles() below - past this, a title is more
  // unreadable shrunk further than it would be just quietly clipped by
  // .card__poster-placeholder's own overflow:hidden (the same "layered
  // fallback, never actually reached in practice" philosophy as
  // sizeTimelineToViewport()'s own hard clamp). No matching CSS constant to
  // stay in sync with - the function reads the tile's real rendered
  // font-size/padding live instead of duplicating those as JS numbers (see
  // its own comment for why, and Gotcha #6 for what duplicating them cost
  // elsewhere in this file).
  const TILE_TITLE_FONT_MIN_PX = 11;
  // How much taller than its own natural height fitTilePlaceholderTitles()
  // (below) is allowed to grow a poster tile to fit a long title BEFORE
  // shrinking its font at all - "the square isn't dogmatic" (user request).
  // Modest on purpose: this is a per-tile nudge for the rare long title,
  // not a re-derivation of sizeTimelineToViewport()'s own height budget, so
  // it leans on the same "rarely reached, .timeline-scroll's own
  // overflow-y: auto is the last-resort net" safety this file already
  // relies on elsewhere (e.g. the unclamped .card__title in style.css).
  const TILE_HEIGHT_GROWTH_MAX_RATIO = 0.25;
  // cards deliberately don't fill the entire available height - a bit of
  // breathing room around the axis reads as more compact, less "bloated"
  const FILL_RATIO = 0.86;

  // last poster/track height computed by sizeTimelineToViewport() - used
  // to decide, per card, whether it's taller than the normal budget even
  // at the current poster size (see buildSeriesCard)
  let lastPosterH = 0;
  let lastPosterW = 0;
  let lastTrackH = 0;
  // year-band entries from the last render() - kept around so a resize can
  // redraw them at their new positions without a full re-render
  let lastYearBandEntries = [];
  // whether that last render() was Chronological - drawYearBands() needs
  // this alongside lastYearBandEntries on a resize redraw, same reasoning:
  // it decides whether an otherEarth band's sub-label text renders (see
  // drawYearBands()'s own comment for why that part alone stays gated)
  let lastIsChronological = true;
  // offscreen canvas used purely to measure text width without touching
  // the DOM (see measureTextWidth/widenSeriesCard) - same technique in
  // spirit as the rest of the file's "measure the real thing" approach,
  // just for text instead of layout
  let measureCtx = null;
  // Hidden off-DOM clone used by minWidthForTwoLineTitle() below to
  // real-measure a series title's wrapped height at a candidate width -
  // declared up here, not next to that function, for the same reason as
  // measureCtx above (see Gotcha #1 in CLAUDE.md: anything render()/init()
  // can reach transitively must be declared before init() runs, not just
  // "near" the function that uses it).
  let titleMeasureEl = null;
  const SEASON_NAME_FONT = "600 12px Inter, system-ui, -apple-system, sans-serif";
  // .season-row__meta's own font (year · episode count · runtime, see
  // seasonMetaLineText()) - widenSeriesCard() measures this too, not just
  // the name, since either line can end up the widest thing in the row.
  const SEASON_META_FONT = "10.5px Inter, system-ui, -apple-system, sans-serif";
  // .card__title's own font - unlike the two above, the title is allowed
  // to WRAP across up to 2 lines (-webkit-line-clamp: 2, css) rather than
  // staying on one, so widenSeriesCard() below only ever budgets HALF this
  // measured width for it, not the whole thing - see the comment there.
  const SERIES_TITLE_FONT = "600 13px Inter, system-ui, -apple-system, sans-serif";
  /**
   * Only one season is ever expanded at a time, ACROSS THE WHOLE PAGE (not
   * just per card). Expanding one moves its actual row element out of the
   * card and into .timeline-track, growing it in place - see
   * expandSeasonRow() for why (its card clips at the edges, so escaping it
   * needs the row to no longer be a descendant of that card at all).
   * `rowEl` is that real DOM node, `placeholder` is the invisible spacer
   * left behind in the season-list so nothing reflows while it's away.
   */
  let expandedSeason = null; // { card, series, season, rowEl, placeholder, originalTop, originalHeight, originalLeft } | null

  const els = {
    header: document.querySelector(".site-header"),
    orderSwitch: document.querySelector(".order-switch"),
    orderingDescription: document.getElementById("orderingDescription"),
    franchiseSelectWrap: document.getElementById("franchiseSelectWrap"),
    franchiseSelectBtn: document.getElementById("franchiseSelectBtn"),
    franchiseSelectLabel: document.getElementById("franchiseSelectLabel"),
    franchiseMenu: document.getElementById("franchiseMenu"),
    storyLineSelectWrap: document.getElementById("storyLineSelectWrap"),
    storyLineSelectBtn: document.getElementById("storyLineSelectBtn"),
    storyLineSelectLabel: document.getElementById("storyLineSelectLabel"),
    storyLineMenu: document.getElementById("storyLineMenu"),
    multiverseSelectWrap: document.getElementById("multiverseSelectWrap"),
    multiverseSelectBtn: document.getElementById("multiverseSelectBtn"),
    multiverseSelectLabel: document.getElementById("multiverseSelectLabel"),
    multiverseMenu: document.getElementById("multiverseMenu"),
    coreMcuWrap: document.getElementById("coreMcuWrap"),
    coreMcuCheckbox: document.getElementById("coreMcuCheckbox"),
    doomsdayWatchlistWrap: document.getElementById("doomsdayWatchlistWrap"),
    doomsdayWatchlistCheckbox: document.getElementById("doomsdayWatchlistCheckbox"),
    scroll: document.getElementById("timelineScroll"),
    track: document.getElementById("timelineTrack"),
    progressFill: document.getElementById("progressFill"),
    progressCount: document.getElementById("progressCount"),
    progressTotal: document.getElementById("progressTotal"),
    progressRuntimeFill: document.getElementById("progressRuntimeFill"),
    progressRuntimeWatched: document.getElementById("progressRuntimeWatched"),
    progressRuntimeTotal: document.getElementById("progressRuntimeTotal"),
    hintLeft: document.querySelector(".scroll-hint--left"),
    hintRight: document.querySelector(".scroll-hint--right"),
  };

  // Which franchise is active decides which MOVIES/SERIES/SEASONS/
  // ORDERINGS/STORY_LINES the rest of this file sees - see the comment on
  // applyFranchiseData() below. Applied BEFORE state.orderingId/storyLineId
  // load below, since loadOrderingId()/loadStoryLineId() validate their
  // stored value against whichever ORDERINGS/STORY_LINES is bound at that
  // moment - loading the wrong franchise's dataset first would make a
  // perfectly valid stored id look stale and get silently discarded.
  const initialFranchiseId = loadFranchiseId();
  applyFranchiseData(initialFranchiseId);

  const state = {
    franchiseId: initialFranchiseId,
    orderingId: loadOrderingId(),
    // "" means Storylines mode is off (plain Chronological/Release Order,
    // per orderingId above) - the default
    storyLineId: loadStoryLineId(),
    // Set of EARTH_BUCKETS[].id currently shown - all of them by default
    // (no filtering). A franchise with no otherEarth content at all (Star
    // Wars) just never has anything to filter, regardless of this set's
    // contents - see filterItemIdsForMultiverse().
    enabledEarths: loadEnabledEarths(),
    // Whether the "Watchlist for Doomsday" toggle is on - a franchise with
    // no doomsdayWatchlist content at all (Star Wars) just never has
    // anything to filter, same reasoning as enabledEarths above - see
    // filterItemIdsForDoomsdayWatchlist(). While true, it also forces
    // enabledEarths back to "all" and locks the Multiverse control (each
    // checkbox's own `disabled` - see populateMultiverseMenu()/
    // updateMultiverseSelectUI()) - see buildDoomsdayWatchlistToggle()'s
    // own section comment for why.
    doomsdayWatchlist: loadDoomsdayWatchlist(),
    // Whether the "Core MCU" toggle is on - same "forces + locks
    // Multiverse while true" behavior as doomsdayWatchlist above, and
    // mutually exclusive with it (see buildCoreMcuToggle()'s own section
    // comment) - only one of the two can be true at a time, enforced in
    // each toggle's own `change` handler, not here.
    coreMcu: loadCoreMcu(),
    watched: loadWatched(),
  };

  init();

  function init() {
    buildFranchiseSelect();
    buildOrderSwitch();
    buildStoryLineSelect();
    buildMultiverseSelect();
    buildCoreMcuToggle();
    buildDoomsdayWatchlistToggle();
    render(); // render() figures out --era-label-h and card sizing from the active ordering

    window.addEventListener(
      "resize",
      debounce(() => {
        sizeTimelineToViewport();
        resizeWideSeriesCards();
        capSeasonListHeights();
        fitTilePlaceholderTitles();
        fixFirstEraLeadSpace();
        drawConnectors();
        drawYearBands(lastYearBandEntries, lastIsChronological);
        updateScrollHints();
        repositionExpandedRow(); // no-op if nothing's expanded
      }, 120)
    );

    els.scroll.addEventListener("scroll", updateScrollHints, { passive: true });

    // Escape is a second way to dismiss an expanded season, on top of the
    // backdrop click handled in expandSeasonRow()
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && expandedSeason) collapseExpandedSeason();
    });
  }

  /* ---------------------------------------------------------------- */
  /*  Arrows hinting at the scroll direction                            */
  /* ---------------------------------------------------------------- */
  function updateScrollHints() {
    if (!els.hintLeft || !els.hintRight) return;
    const { scrollLeft, scrollWidth, clientWidth } = els.scroll;
    const canScrollLeft = scrollLeft > 2;
    const canScrollRight = scrollLeft + clientWidth < scrollWidth - 2;
    els.hintLeft.classList.toggle("is-hidden", !canScrollLeft);
    els.hintRight.classList.toggle("is-hidden", !canScrollRight);
  }

  /* ---------------------------------------------------------------- */
  /*  Group adjacent seasons of the same show under one poster          */
  /* ---------------------------------------------------------------- */
  /**
   * Walks one era's itemIds and glues together adjacent seasons of the
   * SAME show (nothing else sits between them in this ordering) into one
   * "series" group. Returns an array of { type: "movie", id } / { type:
   * "series", seasons: [...] } in the order they should render.
   */
  function groupEraItems(itemIds) {
    const groups = [];
    let i = 0;
    while (i < itemIds.length) {
      const season = SEASONS[itemIds[i]];
      if (season) {
        const seasons = [season];
        let j = i + 1;
        while (j < itemIds.length && SEASONS[itemIds[j]] && SEASONS[itemIds[j]].seriesId === season.seriesId) {
          seasons.push(SEASONS[itemIds[j]]);
          j += 1;
        }
        groups.push({ type: "series", seasons });
        i = j;
      } else {
        groups.push({ type: "movie", id: itemIds[i] });
        i += 1;
      }
    }
    return groups;
  }

  // Maps every RAW item id in era.itemIds to the era.yearBands entry that
  // covers it - walked against era's own FULL, unfiltered itemIds/
  // yearBands, never against whatever a story line/Multiverse/Doomsday
  // filter left behind. A yearBands `span` is authored against "how many
  // CARDS in a row after merging" (Gotcha #12 in CLAUDE.md) for the FULL
  // sequence - that's the only sequence it's actually correct against, so
  // this walk has to happen there, not on the filtered one. Every raw id
  // inside a merged group (not just its leading one) gets mapped to the
  // same band, so a season that survives filtering while its
  // merge-partner doesn't (e.g. loki-s1 kept, loki-s2 filtered out) can
  // still find its own correct band via whichever id IS its own leading
  // id once re-grouped against the smaller, filtered itemIds.
  //   This used to be done as a live span-countdown walked in lockstep
  //   with
  // the CURRENTLY RENDERED (possibly filtered) cards - looked reasonable
  // but broke the instant any filter removed even one card, since the
  // countdown would then land on the wrong band for everything after the
  // gap (band N's own span no longer corresponded to N real surviving
  // cards) - the whole yearBands strip was disabled outright under any
  // active filter rather than actually get this wrong. Precomputing the
  // mapping against the full sequence up front, then just looking each
  // rendered card up by id, sidesteps the whole problem: filtering only
  // changes which cards are visible, never which band any given card
  // belongs to.
  function buildRawIdToBandMap(era) {
    const map = new Map();
    if (!era.yearBands) return map;
    let bandIdx = 0;
    let bandCardsLeft = 0;
    groupEraItems(era.itemIds).forEach((g) => {
      if (bandCardsLeft <= 0) {
        bandCardsLeft = era.yearBands[bandIdx].span;
        bandIdx += 1;
      }
      const band = era.yearBands[bandIdx - 1];
      const rawIds = g.type === "movie" ? [g.id] : g.seasons.map((s) => s.id);
      rawIds.forEach((id) => map.set(id, band));
      bandCardsLeft -= 1;
    });
    return map;
  }

  /**
   * Runs one era's itemIds through a story line's `replace` map (see
   * STORY_LINES in data.js) - an id absent from the map is dropped (not
   * part of this story line), a single mapped id passes through
   * (unchanged, or substituted for a curated slice), and a mapped ARRAY
   * expands into that many consecutive ids (one base-ordering item
   * standing in for several cards under this story line - Release Order's
   * whole "cw-s7" splitting into two curated Anakin arcs, say). Returns
   * `null` (not an empty array) when nothing from this era survives, so
   * render() can drop the era outright instead of showing an empty block.
   */
  function filterItemIdsForStoryLine(itemIds, storyLine) {
    const result = [];
    itemIds.forEach((id) => {
      const replacement = storyLine.replace[id];
      if (replacement === undefined) return;
      if (Array.isArray(replacement)) result.push(...replacement);
      else result.push(replacement);
    });
    return result.length ? result : null;
  }

  // Which EARTH_BUCKETS[].id (data.js) a movie/season belongs to - "616"
  // (no otherEarth field at all - the Sacred Timeline default) unless
  // otherEarth.label matches one of the NAMED buckets, in which case that;
  // anything else otherEarth-flagged (today: Your Friendly Neighborhood
  // Spider-Man's Earth-86445 and Marvel Zombies' Earth-89521 - real,
  // confirmed Earth numbers that just aren't broken out into their own
  // named bucket, see EARTH_BUCKETS' own comment in data.js) falls through
  // to the generic "others" bucket. Same "read the field directly" approach as
  // buildCard()'s own otherEarth handling, just not gated on
  // isChronological - which universe/category a title belongs to is a fact
  // about the title, true under Release Order too, and (as of a later
  // request) so is the card's own tint/badge now - see buildCard()'s own
  // comment for the one exception (the meta line's YEAR text) that still
  // is.
  function earthBucketId(otherEarth) {
    if (!otherEarth) return "616";
    if (otherEarth.label === "Earth-10005") return "10005";
    if (otherEarth.label === "Earth-828") return "828";
    if (otherEarth.label === "Earth-96283") return "96283";
    if (otherEarth.label === "Earth-120703") return "120703";
    if (otherEarth.label === "Earth-688") return "688";
    if (otherEarth.label === "Outside Time") return "outsidetime";
    return "others";
  }

  // The "Multiverse" checkbox filter's own itemIds pass - same shape as
  // filterItemIdsForStoryLine() above (drop what's unchecked, return null
  // instead of an empty array so render() can drop the whole era), but a
  // plain boolean keep/drop per id rather than a replace map. Cheap early
  // exit when nothing is actually filtered (every bucket enabled, the
  // common case) - no need to look up every single id's own otherEarth
  // field just to keep every single one of them.
  function filterItemIdsForMultiverse(itemIds) {
    if (state.enabledEarths.size >= EARTH_BUCKETS.length) return itemIds;
    const result = itemIds.filter((id) => {
      const item = MOVIES[id] || SEASONS[id];
      return item && state.enabledEarths.has(earthBucketId(item.otherEarth));
    });
    return result.length ? result : null;
  }

  // The "Watchlist for Doomsday" toggle's own itemIds pass - same shape
  // again (drop what's not on the list, null instead of empty so render()
  // drops the whole era). FRANCHISE_DATA[franchiseId].doomsdayWatchlist
  // (data.js) is a plain array of ids, not a Set - built into one here
  // rather than in data.js, since this is the only place that ever needs
  // O(1) lookups against it and the array itself reads more naturally as
  // a flat list of ids at the point where it's authored/sourced.
  function filterItemIdsForDoomsdayWatchlist(itemIds) {
    const list = FRANCHISE_DATA[state.franchiseId]?.doomsdayWatchlist;
    if (!list || !list.length) return itemIds;
    const set = new Set(list);
    const result = itemIds.filter((id) => set.has(id));
    return result.length ? result : null;
  }

  // The "Core MCU" toggle's own itemIds pass - unlike Doomsday's fixed
  // curated list above, membership here is DERIVED live from each title's
  // own otherEarth field, not listed. "Core MCU" turns out not to mean
  // literally "no otherEarth field" (= strict Sacred Timeline) - Loki and
  // What If...? both carry `otherEarth.label: "Outside Time"` (see that
  // bucket's own comment on EARTH_BUCKETS, data.js) but are still real,
  // central modern Marvel Studios productions, not a foreign continuity
  // the way every OTHER otherEarth label here is (a numbered alternate
  // Earth - Fox's X-Men, Sony's various Spider-Man universes, Fantastic
  // Four's Earth-828) - "Outside Time" was never a parallel reality to
  // begin with, just Marvel Studios' own TVA/multiverse framework with no
  // fixed date, so it counts as Core MCU same as Sacred Timeline itself
  // does. Every numbered-Earth otherEarth label still excludes, plus one
  // small hand-maintained exception list
  // (FRANCHISE_DATA[franchiseId].coreMcuExclude, data.js - see its own
  // comment for why Agent Carter is the one Sacred-Timeline title that
  // still needs excluding by hand despite having no otherEarth field at
  // all).
  function filterItemIdsForCoreMcu(itemIds) {
    const exclude = new Set(FRANCHISE_DATA[state.franchiseId]?.coreMcuExclude || []);
    const result = itemIds.filter((id) => {
      const item = MOVIES[id] || SEASONS[id];
      if (!item || exclude.has(id)) return false;
      if (!item.otherEarth) return true;
      return item.otherEarth.label === "Outside Time";
    });
    return result.length ? result : null;
  }

  /* ---------------------------------------------------------------- */
  /*  Card sizing based on window height                                */
  /* ---------------------------------------------------------------- */
  /**
   * The page must never scroll vertically - only the timeline scrolls
   * sideways. Cards are drawn in two staggered rows (zig-zag); each
   * era-block gets a fixed height (--track-h) and row-1 cards anchor to
   * its BOTTOM edge (align-self: flex-end, see .card--row-1) instead of
   * the top. That means a normal card looks exactly as before, but a tall
   * merged-series card can grow into the *other* row's vertical space
   * (row-0 grows down, row-1 grows up) without spilling past either edge
   * - full use of both rows' worth of height, nothing ever overflows.
   *
   * posterH is picked so the era-block height (--track-h, derived from the
   * NORMAL card height) exactly fills the available viewport space; if the
   * tallest card on the axis wouldn't fit inside that height even using
   * both rows' worth of room, posterH is solved for directly from "the
   * tallest card's height equals --track-h" instead - trading a little of
   * the usual breathing room for guaranteed no-overflow.
   *
   * Movie posters render MOVIE_POSTER_SCALE larger than series posters
   * (see its own comment) - purely DERIVED at the very end from the same
   * posterH this whole function solves for, never fed back into the solve
   * itself. That's safe, not just convenient: STAGGER_RATIO (0.57) is
   * already comfortably bigger than MOVIE_POSTER_SCALE - 1 (0.15), and
   * trackH is always (posterH + MOVIE_META_H) * (1 + STAGGER_RATIO), so
   * algebraically trackH minus a movie card's real height
   * (posterH*MOVIE_POSTER_SCALE + MOVIE_META_H) works out to
   * (STAGGER_RATIO - (MOVIE_POSTER_SCALE - 1)) * posterH +
   * STAGGER_RATIO * MOVIE_META_H - positive for any posterH >= 0 given
   * today's constants, i.e. a scaled-up movie card ALWAYS fits inside the
   * same track-h a normal card would, with room to spare. (If
   * MOVIE_POSTER_SCALE ever grows close to 1 + STAGGER_RATIO, re-derive
   * this before trusting it.)
   *
   * That second solve can itself still ask for more room than the
   * viewport actually has, though (a merged card with several seasons'
   * worth of rows can need more height than fits in two rows at ANY
   * poster size, breathing room or not) - if so, this stops trying to
   * accommodate it within the normal two-row budget and sizes everything
   * off the real, hard viewport limit instead (hardLimit below - no
   * FILL_RATIO breathing room applied to that one). That's what actually
   * guarantees .timeline-scroll never needs to scroll vertically in
   * normal use: growing --track-h to fit one unusually tall card used to
   * take priority over fitting the viewport at all, which could leave a
   * few pixels of real, scrollable overflow with nothing visibly wrong.
   *
   * If even the hard limit isn't enough (posterH would need to go below
   * POSTER_H_MIN just to make room), we stop trying to force a fit:
   * buildSeriesCard() detects that one card and pins it to the top of its
   * row instead of the bottom (see the .card--overflow class), letting it
   * spill past the usual bottom line rather than getting clipped at the
   * top - and .timeline-scroll's vertical scroll fallback (normally never
   * triggered) takes over so the extra length is still fully reachable.
   * That's the ONLY situation .timeline-scroll should ever actually be
   * scrollable in - an unnaturally short window where something
   * genuinely doesn't fit, not routine use on a normal laptop screen.
   */
  function sizeTimelineToViewport() {
    const root = document.documentElement;
    const scrollBottomPadding = 14; // must match .timeline-scroll's padding
    const safety = 4;

    const hardLimit = els.scroll.clientHeight - scrollBottomPadding - safety - eraLabelH - yearBandH;
    const available = hardLimit * FILL_RATIO;

    // track-h = (posterH + MOVIE_META_H) * (1 + STAGGER_RATIO); solve for
    // posterH so that track-h equals the full available budget
    let posterH = available / (1 + STAGGER_RATIO) - MOVIE_META_H;

    // does the tallest card on the axis actually fit within that track-h,
    // using the full height (both rows combined)?
    if (posterH + metaH > available) {
      // solve posterH + metaH = (posterH + MOVIE_META_H) * (1 + STAGGER_RATIO)
      posterH = (metaH - MOVIE_META_H * (1 + STAGGER_RATIO)) / STAGGER_RATIO;
    }

    // that solve above ignores the viewport entirely (it only cares about
    // fitting metaH into two rows) - clamp it back down to what's really
    // available if it overshot, see the block comment above
    if ((posterH + MOVIE_META_H) * (1 + STAGGER_RATIO) > hardLimit) {
      posterH = hardLimit / (1 + STAGGER_RATIO) - MOVIE_META_H;
    }

    posterH = Math.min(Math.max(posterH, POSTER_H_MIN), POSTER_H_MAX);

    const posterW = posterH * POSTER_RATIO;
    const moviePosterH = posterH * MOVIE_POSTER_SCALE;
    const moviePosterW = moviePosterH * POSTER_RATIO;
    const shortPosterH = posterH * SHORT_POSTER_SCALE;
    const shortPosterW = shortPosterH * POSTER_RATIO;
    const badgePosterH = posterH * BADGE_POSTER_SCALE;
    const badgePosterW = badgePosterH * POSTER_RATIO;
    const trackH = (posterH + MOVIE_META_H) * (1 + STAGGER_RATIO);

    root.style.setProperty("--poster-h", `${posterH}px`);
    root.style.setProperty("--card-w", `${posterW}px`);
    root.style.setProperty("--movie-poster-h", `${moviePosterH}px`);
    root.style.setProperty("--movie-card-w", `${moviePosterW}px`);
    root.style.setProperty("--short-poster-h", `${shortPosterH}px`);
    root.style.setProperty("--short-card-w", `${shortPosterW}px`);
    root.style.setProperty("--badge-poster-h", `${badgePosterH}px`);
    root.style.setProperty("--badge-card-w", `${badgePosterW}px`);
    root.style.setProperty("--track-h", `${trackH}px`);

    lastPosterH = posterH;
    lastPosterW = posterW;
    lastTrackH = trackH;
  }

  // Meta block height of a series card for a given number of merged
  // seasons - capped at MAX_VISIBLE_SEASON_ROWS, since .season-list itself
  // caps out and scrolls internally past that (see the css) instead of
  // pushing the card any taller. Every season still always gets listed -
  // this only caps how much it can grow the REST of the layout's sizing.
  function seriesMetaHeight(seasonCount) {
    const rows = Math.min(seasonCount, MAX_VISIBLE_SEASON_ROWS);
    return SERIES_META_BASE_H + rows * SEASON_ROW_H + Math.max(0, rows - 1) * SEASON_ROW_GAP;
  }

  /* ---------------------------------------------------------------- */
  /*  Franchise picker                                                   */
  /* ---------------------------------------------------------------- */
  // A native <select>'s OPEN dropdown list can't be restyled with CSS at
  // all - its appearance is entirely up to the OS/browser, so it would
  // always look out of place against this page's own dark, hand-styled
  // look. Built as a plain button + an absolutely-positioned listbox
  // instead, styled with the same surface/border/shadow language as the
  // rest of the page (see .card__frame). Options are generated from
  // FRANCHISES (data.js) the same way buildOrderSwitch below is built from
  // ORDERINGS - adding a third franchise later is just one more entry in
  // that array plus its own FRANCHISE_DATA entry, not new markup or new
  // switching logic. Picking a franchise here is exactly as exclusive with
  // the others as Chronological/Release Order/Storylines are with each
  // other - see switchFranchise() for what "swapping the active dataset"
  // (once just a comment here) actually means now that a second franchise
  // exists.
  function buildFranchiseSelect() {
    els.franchiseMenu.innerHTML = "";
    FRANCHISES.forEach((franchise) => {
      const opt = document.createElement("button");
      opt.type = "button";
      opt.className = "franchise-menu__option";
      opt.textContent = franchise.label;
      opt.dataset.franchiseId = franchise.id;
      opt.setAttribute("role", "option");
      opt.addEventListener("click", () => {
        closeFranchiseMenu();
        switchFranchise(franchise.id);
      });
      els.franchiseMenu.appendChild(opt);
    });
    updateFranchiseSelectUI();

    els.franchiseSelectBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (els.franchiseMenu.hasAttribute("hidden")) openFranchiseMenu();
      else closeFranchiseMenu();
    });

    // Clicking anywhere outside the widget, or pressing Escape, closes it -
    // same dismissal pattern a native <select>'s dropdown would have.
    document.addEventListener("click", (e) => {
      if (!els.franchiseSelectWrap.contains(e.target)) closeFranchiseMenu();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeFranchiseMenu();
    });
  }

  // The button's own label + the menu's aria-selected option - separate
  // from buildFranchiseSelect() (menu items themselves never change,
  // FRANCHISES is static) so switchFranchise() can refresh just this
  // without rebuilding the menu or re-wiring its listeners a second time.
  function updateFranchiseSelectUI() {
    const current = FRANCHISES.find((f) => f.id === state.franchiseId) || FRANCHISES[0];
    els.franchiseSelectLabel.textContent = current.label;
    [...els.franchiseMenu.children].forEach((opt) => {
      opt.setAttribute("aria-selected", String(opt.dataset.franchiseId === current.id));
    });
  }

  // Swaps which franchise's MOVIES/SERIES/SEASONS/ORDERINGS/STORY_LINES
  // the rest of this file sees (applyFranchiseData(), data.js) and resets
  // every piece of UI state that only makes sense relative to the OLD
  // franchise's data - state.orderingId back to the new franchise's own
  // first ordering, state.storyLineId back to "" (a story line id from one
  // franchise is meaningless for another, and a future franchise isn't
  // guaranteed to have any at all - see Marvel today). Does NOT touch
  // state.watched - movie/season ids don't collide between franchises (see
  // the id-prefixing note on MOVIES_MARVEL in data.js), so watched
  // progress in the franchise you're leaving is simply not visible again
  // until you switch back, not lost.
  function switchFranchise(franchiseId) {
    if (state.franchiseId === franchiseId) return;
    state.franchiseId = franchiseId;
    saveFranchiseId(franchiseId);
    applyFranchiseData(franchiseId);
    state.orderingId = ORDERINGS[0].id;
    saveOrderingId(state.orderingId);
    state.storyLineId = "";
    saveStoryLineId("");
    // Same reasoning as storyLineId above - which universes were
    // checked/unchecked belongs to the franchise you were just looking
    // at, not a preference that should carry over to a different one.
    state.enabledEarths = new Set(EARTH_BUCKETS.map((b) => b.id));
    saveEnabledEarths(state.enabledEarths);
    // Same reasoning again - a Doomsday watchlist is meaningless outside
    // the franchise that has one (Marvel today), so it doesn't carry over
    // to a different franchise either.
    state.doomsdayWatchlist = false;
    saveDoomsdayWatchlist(false);
    // Same reasoning again - "Core MCU" is meaningless for a franchise
    // with no otherEarth content to filter by at all.
    state.coreMcu = false;
    saveCoreMcu(false);
    updateFranchiseSelectUI();
    buildOrderSwitch(); // rebuilds the pills from the new ORDERINGS, and syncs their active state + the description text
    populateStoryLineMenu(); // rebuilds the dropdown's options from the new STORY_LINES (and hides it entirely if there are none)
    populateMultiverseMenu(); // rebuilds the checkboxes (and hides the whole control if the new franchise has no otherEarth content at all)
    populateCoreMcuToggle(); // hides the whole control if the new franchise has no otherEarth content at all
    populateDoomsdayWatchlistToggle(); // hides the whole control if the new franchise has no doomsdayWatchlist at all
    render();
  }

  function openFranchiseMenu() {
    els.franchiseMenu.removeAttribute("hidden");
    els.franchiseSelectBtn.setAttribute("aria-expanded", "true");
    updateHeaderMenuOpenState();
  }

  function closeFranchiseMenu() {
    els.franchiseMenu.setAttribute("hidden", "");
    els.franchiseSelectBtn.setAttribute("aria-expanded", "false");
    updateHeaderMenuOpenState();
  }

  // .site-header shares .timeline-section's z-index (1) ON PURPOSE - see
  // the CSS comment on .site-header--menu-open for why (the season-expand
  // backdrop needs to cover the header too). An open dropdown menu that
  // extends past the header's own bottom edge would normally get buried
  // under .timeline-section by that same tie, unclickable - .site-header
  // --menu-open bumps the header just high enough to escape that, but only
  // for as long as a menu is actually open (a season can't be expanded at
  // that same moment anyway - its backdrop would swallow the click needed
  // to open a header menu before it got there). Called from every
  // open/close pair below rather than baked into one, since any menu
  // being open is reason enough to apply it.
  function updateHeaderMenuOpenState() {
    const anyOpen =
      !els.franchiseMenu.hasAttribute("hidden") ||
      !els.storyLineMenu.hasAttribute("hidden") ||
      !els.multiverseMenu.hasAttribute("hidden");
    els.header.classList.toggle("site-header--menu-open", anyOpen);
  }

  /* ---------------------------------------------------------------- */
  /*  Ordering switch + story line select - three MUTUALLY EXCLUSIVE     */
  /*  top-level modes, not two independent controls                      */
  /* ---------------------------------------------------------------- */
  // Chronological / Release Order / Storylines behave like one three-tab
  // switch even though the third "tab" is a dropdown button, not a plain
  // pill (see buildStoryLineSelect below) - picking a story line there is
  // exactly as exclusive with Chronological/Release Order as those two are
  // with each other. state.storyLineId === "" means "no story line, plain
  // Chronological/Release Order" (state.orderingId decides which); a
  // non-empty storyLineId means Storylines mode is active regardless of
  // whatever state.orderingId happens to hold (see render() - it always
  // resolves to "chronological" in that case, a story line has no Release
  // Order variant). Both builders below call the SAME two update
  // functions after any change, so the three controls can never disagree
  // about which one is currently active.
  function buildOrderSwitch() {
    els.orderSwitch.innerHTML = "";
    ORDERINGS.forEach((ordering) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "order-switch__btn";
      btn.textContent = ordering.label;
      btn.dataset.orderingId = ordering.id;
      btn.setAttribute("role", "tab");
      btn.addEventListener("click", () => {
        const leavingStoryLine = state.storyLineId !== "";
        if (state.orderingId === ordering.id && !leavingStoryLine) return;
        state.orderingId = ordering.id;
        saveOrderingId(ordering.id);
        if (leavingStoryLine) {
          state.storyLineId = "";
          saveStoryLineId("");
        }
        updateOrderSwitchActiveState();
        updateStoryLineSelectUI();
        updateOrderingDescription();
        render();
      });
      els.orderSwitch.appendChild(btn);
    });
    updateOrderSwitchActiveState();
    updateOrderingDescription();
  }

  // Only the order-switch's own tab-selected state - separate from
  // updateOrderingDescription/updateStoryLineSelectUI so all three can be
  // called independently from either builder's click handler without
  // duplicating each other's DOM work.
  function updateOrderSwitchActiveState() {
    const storyLineActive = state.storyLineId !== "";
    [...els.orderSwitch.children].forEach((b) => {
      b.setAttribute("aria-selected", String(!storyLineActive && b.dataset.orderingId === state.orderingId));
    });
  }

  // Shows the active mode's own explainer blurb under the order-switch
  // pills (ORDERINGS[].description normally - see the comment atop
  // data.js - or the active story line's own STORY_LINES[].description
  // when Storylines mode is active), so switching tabs updates it the
  // same way switching eras updates each era's blurb (see the
  // era.description handling in render() below).
  function updateOrderingDescription() {
    const storyLine = STORY_LINES.find((sl) => sl.id === state.storyLineId) || null;
    const ordering = ORDERINGS.find((o) => o.id === state.orderingId);
    els.orderingDescription.textContent = storyLine ? storyLine.description : ordering.description;
  }

  /* ---------------------------------------------------------------- */
  /*  Story line select - the third, "Storylines" mode                   */
  /* ---------------------------------------------------------------- */
  // Same custom button+listbox pattern as buildFranchiseSelect above, same
  // reason (an open native <select> can't be skinned to match the rest of
  // the page). Sits right next to .order-switch, not styled like
  // .franchise-select - see the CSS comment on .story-line-select for why.
  // Menu options come straight from STORY_LINES (data.js), no "All" entry
  // here anymore - "show everything" is just picking Chronological or
  // Release Order, Storylines only ever holds actual story lines. Adding a
  // second one is purely a data.js change to whichever franchise it
  // belongs to, this function needs nothing new.
  //   The button/dismiss listeners below are wired ONCE here, at init -
  // only the menu's actual OPTIONS need rebuilding on a franchise switch
  // (STORY_LINES itself changes, these listeners don't), so that part is
  // split out into populateStoryLineMenu() instead of living here too.
  function buildStoryLineSelect() {
    populateStoryLineMenu();

    els.storyLineSelectBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (els.storyLineMenu.hasAttribute("hidden")) openStoryLineMenu();
      else closeStoryLineMenu();
    });

    // Same dismissal pattern as the franchise menu - click outside or
    // Escape closes it.
    document.addEventListener("click", (e) => {
      if (!els.storyLineSelectWrap.contains(e.target)) closeStoryLineMenu();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeStoryLineMenu();
    });
  }

  // Rebuilds the dropdown's OPTIONS from whichever STORY_LINES is
  // currently bound - called once from buildStoryLineSelect() above and
  // again from switchFranchise() whenever the active franchise (and so
  // STORY_LINES itself) changes. Hides the whole control when the active
  // franchise has none yet (Marvel today) - an empty, unopenable dropdown
  // would be worse than no control at all. Uses inline style, not the
  // `hidden` attribute, to sidestep Gotcha #3 in CLAUDE.md
  // (.story-line-select-wrap sets its own `display` on the class, which
  // would otherwise beat the `[hidden]` UA rule at equal specificity).
  function populateStoryLineMenu() {
    els.storyLineMenu.innerHTML = "";
    els.storyLineSelectWrap.style.display = STORY_LINES.length ? "" : "none";
    STORY_LINES.forEach((sl) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "story-line-menu__option";
      item.textContent = sl.label;
      item.dataset.storyLineId = sl.id;
      item.setAttribute("role", "option");
      item.addEventListener("click", () => {
        closeStoryLineMenu();
        if (state.storyLineId === sl.id) return;
        state.storyLineId = sl.id;
        saveStoryLineId(sl.id);
        // Storylines are chronological-only (see the comment atop this
        // section) - keep state.orderingId in sync so a reload or a
        // direct read of it elsewhere isn't left pointing at a stale
        // Release Order value.
        state.orderingId = "chronological";
        saveOrderingId("chronological");
        updateOrderSwitchActiveState();
        updateStoryLineSelectUI();
        updateOrderingDescription();
        render();
      });
      els.storyLineMenu.appendChild(item);
    });
    updateStoryLineSelectUI();
  }

  // The story-line-select button's own label/active-state and the menu's
  // aria-selected option - separate from buildStoryLineSelect so
  // buildOrderSwitch's click handler can reset this back to its idle
  // "Storylines" state without re-running the whole builder. Idle (no
  // story line picked) shows the field's own name, "Storylines", rather
  // than the old "All" - there's nothing left for a story line to be a
  // filtered-down version OF now that it's a mode of its own.
  function updateStoryLineSelectUI() {
    const active = STORY_LINES.find((sl) => sl.id === state.storyLineId) || null;
    els.storyLineSelectLabel.textContent = active ? active.label : "Storylines";
    els.storyLineSelectBtn.setAttribute("data-active", String(!!active));
    [...els.storyLineMenu.children].forEach((item) => {
      item.setAttribute("aria-selected", String(item.dataset.storyLineId === state.storyLineId));
    });
  }

  function openStoryLineMenu() {
    els.storyLineMenu.removeAttribute("hidden");
    els.storyLineSelectBtn.setAttribute("aria-expanded", "true");
    updateHeaderMenuOpenState();
  }

  function closeStoryLineMenu() {
    els.storyLineMenu.setAttribute("hidden", "");
    els.storyLineSelectBtn.setAttribute("aria-expanded", "false");
    updateHeaderMenuOpenState();
  }

  /* ---------------------------------------------------------------- */
  /*  Multiverse checkbox filter - a FILTER layered on top of whichever  */
  /*  ordering/story line is active, unlike Storylines above (its own    */
  /*  mutually-exclusive third mode) - picking Chronological, Release     */
  /*  Order or a story line doesn't touch it, and it doesn't touch which  */
  /*  of those is active either. Several checkboxes (EARTH_BUCKETS,       */
  /*  data.js) instead of one pick-one list, so this is real              */
  /*  <input type=checkbox> markup rather than the button-per-option      */
  /*  pattern buildStoryLineSelect uses - genuinely multi-select, not     */
  /*  another mutually-exclusive mode.                                   */
  /* ---------------------------------------------------------------- */
  // Wired ONCE here, at init - only the menu's actual checkboxes need
  // rebuilding on a franchise switch (whether the active franchise has
  // ANY otherEarth content at all can change), so that part is split out
  // into populateMultiverseMenu() instead of living here too, same split
  // as buildStoryLineSelect/populateStoryLineMenu above.
  function buildMultiverseSelect() {
    populateMultiverseMenu();

    els.multiverseSelectBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (els.multiverseMenu.hasAttribute("hidden")) openMultiverseMenu();
      else closeMultiverseMenu();
    });

    // Same dismissal pattern as the franchise/story-line menus - click
    // outside or Escape closes it. Deliberately does NOT close on a
    // checkbox click (see populateMultiverseMenu() below) - only these.
    document.addEventListener("click", (e) => {
      if (!els.multiverseSelectWrap.contains(e.target)) closeMultiverseMenu();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMultiverseMenu();
    });
  }

  // Rebuilds the dropdown's checkboxes from whichever MOVIES/SEASONS is
  // currently bound - called once from buildMultiverseSelect() above and
  // again from switchFranchise() whenever the active franchise (and so
  // whether it has any otherEarth content at all) changes. Hides the
  // whole control when the active franchise has none (Star Wars today) -
  // same reasoning, and same inline-`style.display` approach (not the
  // `hidden` attribute, to sidestep Gotcha #3 in CLAUDE.md), as
  // populateStoryLineMenu()'s own empty-STORY_LINES case above.
  function populateMultiverseMenu() {
    const hasOtherEarthContent =
      Object.values(MOVIES).some((m) => m.otherEarth) || Object.values(SEASONS).some((s) => s.otherEarth);
    els.multiverseSelectWrap.style.display = hasOtherEarthContent ? "" : "none";
    if (!hasOtherEarthContent) return;

    els.multiverseMenu.innerHTML = "";
    EARTH_BUCKETS.forEach((bucket) => {
      const option = document.createElement("label");
      option.className = "multiverse-menu__option";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.earthId = bucket.id;
      checkbox.checked = state.enabledEarths.has(bucket.id);
      // Locked (can't uncheck any box) while "Core MCU" or "Watchlist for
      // Doomsday" is on - see either toggle's own section further below
      // for why (mutually exclusive with each other, but each locks
      // Multiverse the same way on its own). Native `disabled` alone
      // already blocks all interaction (no click/change fires), so the
      // change handler below doesn't need its own redundant guard for
      // this.
      checkbox.disabled = state.doomsdayWatchlist || state.coreMcu;
      checkbox.addEventListener("change", () => {
        // Guard against unchecking the LAST enabled bucket - an axis with
        // literally nothing on it (every universe hidden) is a confusing
        // dead end, not a useful filtered view, so the last box left
        // checked simply can't be unchecked.
        if (!checkbox.checked && state.enabledEarths.size <= 1) {
          checkbox.checked = true;
          return;
        }
        if (checkbox.checked) state.enabledEarths.add(bucket.id);
        else state.enabledEarths.delete(bucket.id);
        saveEnabledEarths(state.enabledEarths);
        updateMultiverseSelectUI();
        render();
      });
      const text = document.createElement("span");
      text.textContent = bucket.label;
      option.append(checkbox, text);
      els.multiverseMenu.appendChild(option);
    });
    updateMultiverseSelectUI();
  }

  // The multiverse-select button's own label/active-state and each
  // checkbox's checked state - separate from populateMultiverseMenu() so
  // a checkbox's own change handler can refresh just this without
  // rebuilding the whole menu (and losing focus) on every click.
  function updateMultiverseSelectUI() {
    const total = EARTH_BUCKETS.length;
    const enabled = state.enabledEarths.size;
    els.multiverseSelectLabel.textContent = enabled === total ? "Multiverse" : `Multiverse (${enabled}/${total})`;
    els.multiverseSelectBtn.setAttribute("data-active", String(enabled !== total));
    [...els.multiverseMenu.querySelectorAll("input[data-earth-id]")].forEach((checkbox) => {
      checkbox.checked = state.enabledEarths.has(checkbox.dataset.earthId);
      checkbox.disabled = state.doomsdayWatchlist || state.coreMcu;
    });
  }

  function openMultiverseMenu() {
    els.multiverseMenu.removeAttribute("hidden");
    els.multiverseSelectBtn.setAttribute("aria-expanded", "true");
    updateHeaderMenuOpenState();
  }

  function closeMultiverseMenu() {
    els.multiverseMenu.setAttribute("hidden", "");
    els.multiverseSelectBtn.setAttribute("aria-expanded", "false");
    updateHeaderMenuOpenState();
  }

  /* ---------------------------------------------------------------- */
  /*  Core MCU - a single checkbox, same shape/behavior as Watchlist for */
  /*  Doomsday below (see that section's own header comment for the      */
  /*  shared reasoning: FILTER, not a mode; force+locks Multiverse to     */
  /*  "everything checked" while on) but a DERIVED filter rather than a   */
  /*  fixed curated list - filterItemIdsForCoreMcu() (above) keeps Sacred */
  /*  Timeline PLUS "Outside Time" titles (Loki, What If...? - real       */
  /*  Marvel Studios productions with no fixed date, not a foreign        */
  /*  continuity the way every other otherEarth label is - see that       */
  /*  function's own comment), minus                                     */
  /*  FRANCHISE_DATA[franchiseId].coreMcuExclude (data.js - Agent Carter, */
  /*  the one Sacred-Timeline title that's old Marvel Television/ABC      */
  /*  rather than "that modern Marvel Studios production" the checkbox    */
  /*  is named for - see that array's own comment).                      */
  /*  MUTUALLY EXCLUSIVE with Watchlist for Doomsday (requested            */
  /*  explicitly) - turning either ON turns the other OFF first, in that   */
  /*  toggle's own `change` handler; both still persist their own on/off   */
  /*  state independently (see CORE_MCU_STORAGE_KEY's own comment).        */
  /* ---------------------------------------------------------------- */
  function buildCoreMcuToggle() {
    populateCoreMcuToggle();

    els.coreMcuCheckbox.addEventListener("change", () => {
      state.coreMcu = els.coreMcuCheckbox.checked;
      saveCoreMcu(state.coreMcu);
      if (state.coreMcu) {
        // Mutually exclusive with Watchlist for Doomsday - turn it off
        // first if it was on, same as that toggle's own handler does for
        // this one below.
        if (state.doomsdayWatchlist) {
          state.doomsdayWatchlist = false;
          saveDoomsdayWatchlist(false);
          updateDoomsdayWatchlistUI();
        }
        // Force + lock Multiverse to "everything checked" - see this
        // section's own header comment for why. Same Set-then-save path
        // switchFranchise() already uses to reset it.
        state.enabledEarths = new Set(EARTH_BUCKETS.map((b) => b.id));
        saveEnabledEarths(state.enabledEarths);
      }
      updateMultiverseSelectUI();
      updateCoreMcuUI();
      render();
    });
  }

  // Rebuilds this control's visibility - called once from
  // buildCoreMcuToggle() above and again from switchFranchise() whenever
  // the active franchise changes. Unlike Doomsday's own populate function,
  // this doesn't check a list's own length (coreMcuExclude being empty is
  // meaningless on its own - membership is otherEarth-derived, not listed)
  // - it reuses the exact same "does this franchise have ANY otherEarth
  // content at all" check populateMultiverseMenu() already computes for
  // its own visibility, since a franchise with none has nothing for this
  // filter to meaningfully narrow down either (Star Wars today).
  function populateCoreMcuToggle() {
    const hasOtherEarthContent =
      Object.values(MOVIES).some((m) => m.otherEarth) || Object.values(SEASONS).some((s) => s.otherEarth);
    els.coreMcuWrap.style.display = hasOtherEarthContent ? "" : "none";
    updateCoreMcuUI();
  }

  function updateCoreMcuUI() {
    els.coreMcuCheckbox.checked = state.coreMcu;
    els.coreMcuWrap.setAttribute("data-active", String(state.coreMcu));
  }

  /* ---------------------------------------------------------------- */
  /*  Watchlist for Doomsday - a single checkbox, not a dropdown (unlike */
  /*  Storylines/Multiverse above) - it's one boolean, nothing to pick   */
  /*  from a list. Marvel's own officially-announced 15-title "watch     */
  /*  before Avengers: Doomsday" list (FRANCHISE_DATA[franchiseId]       */
  /*  .doomsdayWatchlist, data.js - see DOOMSDAY_WATCHLIST_MARVEL's own   */
  /*  comment for sourcing), applied as a FILTER on top of whichever      */
  /*  ordering/story line/Multiverse selection is active, same "compose,  */
  /*  don't replace" shape as Multiverse itself - see the comment on      */
  /*  render()'s own eraGroups mapping. The one thing it does that no     */
  /*  other filter here does: turning it ON also force-resets Multiverse  */
  /*  back to "everything checked" and LOCKS it there for as long as      */
  /*  Doomsday mode stays on (requested explicitly - the watchlist is     */
  /*  meant to be seen exactly as Marvel announced it, not further        */
  /*  narrowed by whichever universes happen to be checked already) - see  */
  /*  the checkbox's own `change` handler below, plus the `disabled`      */
  /*  lines in populateMultiverseMenu()/updateMultiverseSelectUI() above.  */
  /*  MUTUALLY EXCLUSIVE with Core MCU above, for the same reason and the  */
  /*  same way - see this handler's own first `if` below.                 */
  /* ---------------------------------------------------------------- */
  function buildDoomsdayWatchlistToggle() {
    populateDoomsdayWatchlistToggle();

    els.doomsdayWatchlistCheckbox.addEventListener("change", () => {
      state.doomsdayWatchlist = els.doomsdayWatchlistCheckbox.checked;
      saveDoomsdayWatchlist(state.doomsdayWatchlist);
      if (state.doomsdayWatchlist) {
        // Mutually exclusive with Core MCU - turn it off first if it was
        // on, same as that toggle's own handler does for this one.
        if (state.coreMcu) {
          state.coreMcu = false;
          saveCoreMcu(false);
          updateCoreMcuUI();
        }
        // Force + lock Multiverse to "everything checked" - see this
        // section's own header comment for why. Goes through the exact
        // same Set-then-save path switchFranchise() already uses to reset
        // it, so this stays the one place that owns "what does resetting
        // enabledEarths mean".
        state.enabledEarths = new Set(EARTH_BUCKETS.map((b) => b.id));
        saveEnabledEarths(state.enabledEarths);
      }
      updateMultiverseSelectUI();
      updateDoomsdayWatchlistUI();
      render();
    });
  }

  // Rebuilds this control's visibility - called once from
  // buildDoomsdayWatchlistToggle() above and again from switchFranchise()
  // whenever the active franchise (and so whether it has a
  // doomsdayWatchlist at all) changes. Same hide-when-empty approach as
  // populateStoryLineMenu()/populateMultiverseMenu() above - Star Wars has
  // no such list today.
  function populateDoomsdayWatchlistToggle() {
    const list = FRANCHISE_DATA[state.franchiseId]?.doomsdayWatchlist;
    els.doomsdayWatchlistWrap.style.display = list && list.length ? "" : "none";
    updateDoomsdayWatchlistUI();
  }

  function updateDoomsdayWatchlistUI() {
    els.doomsdayWatchlistCheckbox.checked = state.doomsdayWatchlist;
    els.doomsdayWatchlistWrap.setAttribute("data-active", String(state.doomsdayWatchlist));
  }

  /* ---------------------------------------------------------------- */
  /*  Timeline rendering                                                 */
  /* ---------------------------------------------------------------- */
  function render() {
    const storyLine = STORY_LINES.find((sl) => sl.id === state.storyLineId) || null;
    // Storylines is its own third mode (see the order-switch/story-line-
    // select comments below), not a filter layered on top of whichever of
    // Chronological/Release Order was last active - a personal story arc
    // has no release-date variant, so it always renders chronologically,
    // regardless of state.orderingId's stored value (kept in sync with
    // "chronological" whenever a story line is picked, but resolved
    // directly here too so a stale/edited value can't show Release Order
    // content under a story line).
    const ordering = ORDERINGS.find((o) => o.id === (storyLine ? "chronological" : state.orderingId));

    // A story line normally FILTERS the active ordering's own eras rather
    // than replacing them (see STORY_LINES in data.js) - each era's
    // itemIds runs through filterItemIdsForStoryLine() first, and an era
    // that ends up with nothing left (nothing in it belongs to this story
    // line) is dropped entirely rather than rendered empty. But a story
    // line can also define `chapters` for a given ordering id - its own
    // era breakdown to use INSTEAD of that ordering's generic eras, for
    // when the base eras' labels don't fit this story's own shape (see
    // the `chapters` comment on STORY_LINES). Chapter itemIds are already
    // the exact final ids to render, so they skip filterItemIdsForStoryLine
    // entirely - there is nothing to filter, only empty chapters to drop.
    const chapterEras = storyLine && storyLine.chapters && storyLine.chapters[ordering.id];
    // The "Multiverse" checkbox filter (see its own section below) runs
    // AFTER story-line filtering/chapters, on whatever itemIds that step
    // already produced - the two compose (though in practice they never
    // both do anything at once today: Storylines is Star Wars-only,
    // Multiverse is Marvel-only, since only Marvel has otherEarth content
    // to filter by at all). "Core MCU" and "Watchlist for Doomsday" (see
    // their own sections further below) run LAST, after both - both are
    // Marvel-only too, and mutually exclusive WITH EACH OTHER (each
    // toggle's own `change` handler turns the other off - see
    // buildCoreMcuToggle()/buildDoomsdayWatchlistToggle()), so at most one
    // of the two ever actually filters anything on a given render, even
    // though nothing here assumes that - both just run on whatever
    // itemIds survived so far, same as Multiverse does. Both also force
    // state.enabledEarths back to "all" and lock the Multiverse control
    // while active - a completely separate mechanism from THIS filtering
    // step, see either toggle's own section for why.
    const multiverseFiltering = state.enabledEarths.size < EARTH_BUCKETS.length;
    const doomsdayFiltering = state.doomsdayWatchlist && !!FRANCHISE_DATA[state.franchiseId]?.doomsdayWatchlist?.length;
    const coreMcuFiltering = state.coreMcu;
    const eraGroups = (chapterEras || ordering.eras)
      .map((era) => {
        let itemIds = chapterEras ? era.itemIds : storyLine ? filterItemIdsForStoryLine(era.itemIds, storyLine) : era.itemIds;
        if (itemIds && multiverseFiltering) itemIds = filterItemIdsForMultiverse(itemIds);
        if (itemIds && coreMcuFiltering) itemIds = filterItemIdsForCoreMcu(itemIds);
        if (itemIds && doomsdayFiltering) itemIds = filterItemIdsForDoomsdayWatchlist(itemIds);
        return itemIds && itemIds.length ? { era, groups: groupEraItems(itemIds) } : null;
      })
      .filter(Boolean);

    // eras with a blurb need a taller header - set this before rendering
    // and measuring, since it feeds into the card-size calculation too.
    // Checked against the FILTERED eraGroups, not ordering.eras directly -
    // a story line can drop the one era that had a description, and
    // reserving that taller header for nothing left to show it would just
    // waste space every other (description-less) era has to live with too.
    // Chapters (see above) get the same taller reservation even though
    // they carry no `description` text of their own - a single-word
    // chapter title (e.g. "Fall") still reads better with the same extra
    // breathing room above the cards a real blurb would have earned it,
    // rather than sitting low and cramped just because there's no second
    // line under it.
    const hasEraDescriptions = !!chapterEras || eraGroups.some(({ era }) => era.description);
    eraLabelH = hasEraDescriptions ? ERA_LABEL_H_DESC : ERA_LABEL_H_BASE;
    document.documentElement.style.setProperty("--era-label-h", `${eraLabelH}px`);

    // the in-universe year strip only exists for eras that define it
    // (Chronological's own, or a story line's own `chapters` - chapters
    // carry no yearBands data of their own at all, so era.yearBands is
    // simply undefined for one and this falls through correctly with no
    // special-casing needed). Used to also go off entirely under ANY
    // active filter (story line `replace`, Multiverse, Watchlist for
    // Doomsday) - band attribution is now looked up per-card against the
    // era's own FULL sequence (see buildRawIdToBandMap() above) rather
    // than walked in lockstep with whatever survived filtering, so a
    // filtered-down axis shows exactly the same dated strip it always did
    // instead of losing it - requested explicitly, filtering the CARDS
    // was never supposed to mean losing the AXIS too.
    const hasYearBands = eraGroups.some(({ era }) => era.yearBands);
    yearBandH = hasYearBands ? YEAR_BAND_H : 0;
    document.documentElement.style.setProperty("--year-band-h", `${yearBandH}px`);

    // a series card's meta block is now taller (one row per season); cards
    // size to their own content (not a fixed height), but poster sizing
    // has to be based on the TALLEST card in the active ordering so
    // nothing runs off the edge
    metaH = eraGroups.reduce((max, { groups }) => {
      groups.forEach((g) => {
        if (g.type === "series") max = Math.max(max, seriesMetaHeight(g.seasons.length));
      });
      return max;
    }, MOVIE_META_H);

    sizeTimelineToViewport();

    // wipes any previously-expanded season row AND its backdrop (both
    // live inside .timeline-track, see expandSeasonRow) - so an ordering
    // switch while a season is open can't leave either one stuck behind
    els.track.innerHTML = "";
    expandedSeason = null;

    // SVG layer for the connectors - inserted first, but stays visually
    // beneath the cards thanks to z-index
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "connector-layer");
    svg.setAttribute("height", `${getTrackContentHeight()}`);
    els.track.appendChild(svg);

    // plain-div layer for the year-band strip - sits in the reserved space
    // above the era labels (see --year-band-h); positioned in drawYearBands
    // once the cards have an actual rendered layout to measure
    const yearBandLayer = document.createElement("div");
    yearBandLayer.className = "year-band-layer";
    els.track.appendChild(yearBandLayer);

    const posterEls = [];
    let globalIndex = 0;
    let hasOverflowCard = false;
    // one entry per yearBands group, built alongside the cards so it can
    // hold direct references to the first/last card DOM element it spans -
    // see drawYearBands for how that becomes an actual positioned label
    const yearBandEntries = [];

    eraGroups.forEach(({ era, groups }) => {
      const block = document.createElement("section");
      block.className = "era-block";
      if (era.gapBefore) block.classList.add("era-block--gap-before");

      const label = document.createElement("div");
      label.className = "era-block__label";

      const title = document.createElement("h2");
      title.className = "era-block__title";
      title.textContent = era.label;
      label.appendChild(title);

      if (era.description) {
        const desc = document.createElement("p");
        desc.className = "era-block__desc";
        desc.textContent = era.description;
        label.appendChild(desc);
      }

      block.appendChild(label);

      // Precomputed once per era, against era's own FULL itemIds/
      // yearBands - see buildRawIdToBandMap()'s own comment for why this
      // has to be looked up rather than walked in lockstep with `groups`
      // (which may be a filtered subset of the era's real full sequence).
      const rawIdToBand = buildRawIdToBandMap(era);

      groups.forEach((g) => {
        const row = globalIndex % 2;
        const card = g.type === "movie" ? buildCard(MOVIES[g.id], row, ordering.id === "chronological") : buildSeriesCard(g.seasons, row, ordering.id === "chronological");
        // era.gapBefore (above) marks a whole ERA as separated from the
        // previous one by a big in-universe jump - too coarse for
        // ORDERINGS_MARVEL's Chronological, which (see its own comment in
        // data.js) is deliberately ONE flat era with no era boundaries to
        // hang that off of. era.cardGapBefore is the same idea one level
        // finer: an array of leading item ids, each one pulling ITS card
        // (not a whole era) further from its predecessor - see
        // .card--gap-before in css.
        const leadItemId = g.type === "movie" ? g.id : g.seasons[0].id;
        if (era.cardGapBefore && era.cardGapBefore.includes(leadItemId)) card.classList.add("card--gap-before");
        if (card.classList.contains("card--overflow")) hasOverflowCard = true;
        posterEls.push(card.querySelector(".card__poster-wrap"));
        block.appendChild(card);
        globalIndex += 1;

        // Looked up by this card's own leading id (already computed above
        // for cardGapBefore) rather than walked in step with a countdown -
        // see buildRawIdToBandMap()'s own comment. Consecutive rendered
        // cards that resolve to the exact SAME band object (reference
        // equality, not just matching label text - two distinct one-off
        // bands can share identical text, e.g. two separate "cca 2024"
        // entries, and must NOT merge) extend that one entry's lastCard;
        // a different band (or the very first card) starts a new one.
        // `band` can be undefined for a card whose id genuinely isn't in
        // era.yearBands at all - skip rather than push a label-less entry
        // (shouldn't happen given Gotcha #12's "spans must sum to the
        // era's full card count" invariant, but filtering could still
        // surface a data mistake here that the old code silently masked).
        const band = era.yearBands && rawIdToBand.get(leadItemId);
        if (band) {
          const last = yearBandEntries[yearBandEntries.length - 1];
          if (last && last.bandRef === band) {
            last.lastCard = card;
          } else {
            yearBandEntries.push({
              bandRef: band,
              label: band.label,
              milestone: band.milestone,
              otherEarth: band.otherEarth,
              otherEarthVariant: band.otherEarthVariant,
              noTimeline: band.noTimeline,
              firstCard: card,
              lastCard: card,
            });
          }
        }
      });

      els.track.appendChild(block);
    });

    // normally never true (extensively tuned to always fit); only kicks in
    // for a card so long even the max poster size can't make room for it
    // in two rows - see sizeTimelineToViewport()
    els.scroll.classList.toggle("has-overflow", hasOverflowCard);

    lastYearBandEntries = yearBandEntries;
    lastIsChronological = ordering.id === "chronological";

    requestAnimationFrame(() => {
      // sets each season-list's max-height from its ACTUALLY rendered row
      // height, not a hardcoded guess - see the function for why
      capSeasonListHeights();
      // shrinks any tile title that doesn't fit its own square at full size
      fitTilePlaceholderTitles();
      // may nudge the first era-block rightward - must happen before the
      // connectors/year-bands measure the real layout, since it shifts it
      fixFirstEraLeadSpace();
      svg.setAttribute("width", `${els.track.scrollWidth}`);
      drawConnectors();
      drawYearBands(yearBandEntries, lastIsChronological);
      updateScrollHints();
    });

    updateProgress();
  }

  function buildCard(movie, row, isChronological) {
    const isWatched = state.watched.has(movie.id);
    // "Glued onto" the axis from outside Earth-616/Sacred Timeline (see
    // the comment on movie.otherEarth in data.js) - same card in the same
    // sequence, but visually flagged: card--other-earth tints .card__frame/
    // .card__meta (see css/style.css) and the origin-earth badge names
    // which Earth it's actually set on. This part is NOT gated on
    // isChronological (unlike the year-swap below) - which Multiverse
    // bucket a title belongs to (see EARTH_BUCKETS/earthBucketId, data.js/
    // app.js) is a fact about the title either way, and the whole point of
    // the Multiverse filter working under both orderings is defeated if a
    // viewer can only actually SEE which Earth a card belongs to under
    // Chronological. The meta line's YEAR, though, only swaps to this
    // title's own in-universe year (wildly different from its neighbors on
    // purpose) under Chronological - Release Order's whole point is "what
    // came out, in what order", so it always shows the real release year
    // there regardless of otherEarth, same reasoning that keeps this title
    // in Release Order's itemIds at all (see the comment on
    // ORDERINGS_MARVEL in data.js).
    const otherEarth = movie.otherEarth;
    // Marvel One-Shots (and any future title like them) are 4-15 minute
    // bonus shorts, not real feature films - under SHORT_RUNTIME_THRESHOLD_MIN
    // (user-requested: 20 min) drops it to the smallest tier (see the
    // four-tier hierarchy comment above SHORT_POSTER_SCALE) - a short
    // shouldn't visually claim the same weight on the axis as a real movie.
    // isBadgeTier (Avengers/Episode I-IX - movie.badge is only ever set on
    // these) is checked FIRST and wins over isShort if a future title
    // somehow had both (none does today) - the tier hierarchy's own
    // largest step should never be silently downgraded by the smallest.
    const isBadgeTier = !!movie.badge;
    const isShort = !isBadgeTier && movie.runtimeMin < SHORT_RUNTIME_THRESHOLD_MIN;

    const card = document.createElement("article");
    card.className = `card card--movie card--row-${row}${isWatched ? " is-watched" : ""}${otherEarth ? " card--other-earth" : ""}${isShort ? " card--short" : ""}${isBadgeTier ? " card--badge-tier" : ""} card--tile`;
    card.dataset.movieId = movie.id;
    // Which SPECIFIC Earth, not just "some foreign Earth" - read by the
    // [data-other-earth-label="Earth-10005"] CSS override (--other-earth-
    // current, style.css) so a particular universe can get its own color,
    // and by drawConnectors() to tell "same foreign universe" (solid line)
    // apart from "crossing into a different one" (dashed). Also drives the
    // poster TILE's own color now (--tile-color, style.css) - a title from
    // a different Earth gets a visibly different tile color, not just a
    // different border tint, since there's no poster art left to tell two
    // Earths apart by artwork alone anymore.
    if (otherEarth) card.dataset.otherEarthLabel = otherEarth.label;

    const posterHtml = posterPlaceholderHtml(movie.title);
    // "(Animated)" suffix (user-requested) - the tile no longer shows real
    // artwork, so live-action vs. animated is no longer visible at a
    // glance the way a real poster's own art style used to make obvious;
    // movie.animated (data.js) flags the handful of titles where that
    // actually matters (e.g. clonewarsMovie) - text-transform: uppercase
    // (css) turns this into "(ANIMATED)" same as the rest of the badge.
    const badgeText = (movie.badge || (isShort ? "Short" : "Movie")) + (movie.animated ? " (Animated)" : "");
    // The tile carries no real artwork to badge OVER, so the badge sits
    // down in the caption area instead, right above the year/runtime line -
    // see .card__badge--meta's own comment in style.css.
    const badgeHtml = `<span class="card__badge${movie.badge ? " card__badge--episode" : ""} card__badge--meta">${escapeHtml(badgeText)}</span>`;

    card.innerHTML = `
      <div class="card__frame">
        <button type="button" class="card__poster-wrap" aria-pressed="${isWatched}">
          ${posterHtml}
          <span class="card__hover-overlay">
            <span class="card__hover-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M4 10.5L8 14.5L16 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </span>
        </button>
        <div class="card__meta">
          ${badgeHtml}
          <p class="card__year">${otherEarth && isChronological ? otherEarth.year : movie.year} · ${formatRuntime(movie.runtimeMin)}</p>
          ${otherEarth ? `<p class="card__origin-earth">${escapeHtml(otherEarthDisplayText(otherEarth.label, otherEarth.variant))}</p>` : ""}
        </div>
      </div>
    `;

    const btn = card.querySelector(".card__poster-wrap");
    btn.setAttribute("aria-label", `${escapeHtml(movie.title)} – ${isWatched ? "watched, click to unmark" : "mark as watched"}`);
    btn.addEventListener("click", () => toggleWatched(movie.id, card, btn));

    return card;
  }

  function toggleWatched(movieId, card, btn) {
    const nowWatched = !state.watched.has(movieId);

    if (nowWatched) {
      state.watched.add(movieId);
    } else {
      state.watched.delete(movieId);
    }
    saveWatched(state.watched);

    card.classList.toggle("is-watched", nowWatched);
    btn.setAttribute("aria-pressed", String(nowWatched));
    const movie = MOVIES[movieId];
    btn.setAttribute(
      "aria-label",
      `${movie.title} – ${nowWatched ? "watched, click to unmark" : "mark as watched"}`
    );

    updateProgress();
    drawConnectors();
  }

  /* ---------------------------------------------------------------- */
  /*  Series card - one card can carry several adjacent seasons         */
  /* ---------------------------------------------------------------- */
  /**
   * Collapsed, a season row is always exactly two lines (name+chevron,
   * then "year · N · runtime", see seasonMetaLineText()) - like a movie
   * card, nothing about it ever grows the CARD, so it can never force the
   * page to need vertical scrolling (the one thing that must never happen
   * - only the timeline itself scrolls, sideways).
   *   Clicking it expands that SAME row element in place into a single
   * wider strip - a "mark whole season" checkbox on the left, then a
   * horizontally-scrolling list of named episodes on the right (no
   * curated per-episode titles anywhere in the data, so they're
   * "Episode 1", "Episode 2", ...). It's really the one row growing, not a
   * second box appearing next to it - see expandSeasonRow().
   *   Because that would need to spill out past its own (clipped) card,
   * the row is temporarily MOVED out of the card while expanded - straight
   * into .timeline-track, as a position:absolute element sized and placed
   * from its own real on-screen position - leaving an invisible spacer
   * behind so the season-list/card doesn't reflow around the gap. Collapse
   * puts it right back where it came from.
   * A season only counts as watched (green row, and toward the header
   * progress bar) once every one of its episodes is checked - the bulk
   * checkbox is a shortcut that checks/unchecks all of them at once, not a
   * separate state of its own.
   *   A show with a lot of seasons (Clone Wars' 7) still might not fit
   * within a card's normal height budget even with this - past
   * MAX_VISIBLE_SEASON_ROWS, the season list adds another COLUMN instead
   * of scrolling (still capped at MAX_VISIBLE_SEASON_ROWS rows tall - see
   * seriesMetaHeight()), and the whole card widens to fit it - see
   * widenSeriesCard() and .card--series-wide in the css. The poster itself
   * stays at the normal single-column width, centered in the wider card.
   */
  function buildSeriesCard(seasons, row, isChronological) {
    const series = SERIES[seasons[0].seriesId];
    const isWatched = seasons.every((s) => isSeasonFullyWatched(s));
    // Same "glued onto" the axis treatment as buildCard()'s otherEarth
    // (see the comment on movie.otherEarth in data.js) - a whole SHOW set
    // outside Sacred Timeline (Your Friendly Neighborhood Spider-Man, no
    // confirmed Earth number - Marvel hasn't revealed one) rather than one
    // movie. A merged card's seasons always share one seriesId (same show),
    // so checking just the first one speaks for the whole card.
    //   Unlike buildCard(), this does NOT add a .card__origin-earth text
    // line or swap any season row's displayed year to otherEarth.year -
    // SERIES_META_BASE_H (the height budget seriesMetaHeight() solves the
    // poster size from) has zero slack for an extra line, on every plain
    // series card, not just this one (a movie card's meta area has spare
    // room for it; a series card's does not - see Gotcha #6/#7 for what an
    // under-budgeted card height costs here). The rust-tinted
    // .card--other-earth border/background (css) + the dashed connector
    // lines it triggers already carry the "this isn't Sacred Timeline"
    // signal without touching that budget at all. Not gated on
    // isChronological (same reasoning as buildCard()'s own otherEarth -
    // see its comment) - the tint applies under both orderings, and since
    // this function never swaps any displayed year in the first place,
    // there's nothing else here that needed splitting between the two.
    const otherEarth = seasons[0].otherEarth;

    // Is this card taller than the normal two-row budget even at the
    // current (possibly max-sized) poster? Only matters for row-1: a
    // row-0 card already anchors to the top by default and simply grows
    // down, which is exactly what we want here too. Expanding a season
    // never changes this - the row is pulled OUT of the card while
    // expanded rather than growing it - and seriesMetaHeight() itself caps
    // out past MAX_VISIBLE_SEASON_ROWS, so a many-season show can't blow
    // this budget out either (its .season-list just scrolls internally
    // instead, see the css).
    const naturalH = lastPosterH + seriesMetaHeight(seasons.length);
    const overflows = row === 1 && naturalH > lastTrackH + 1;

    const card = document.createElement("article");
    card.className = `card card--series card--row-${row}${overflows ? " card--overflow" : ""}${isWatched ? " is-watched" : ""}${otherEarth ? " card--other-earth" : ""} card--tile`;
    card.dataset.movieId = seasons.map((s) => s.id).join(",");
    // See the matching comment in buildCard() - which SPECIFIC Earth, not
    // just "some foreign Earth", also driving the tile's own color now.
    if (otherEarth) card.dataset.otherEarthLabel = otherEarth.label;

    const rowsHtml = seasons.map((s) => buildSeasonRowHtml(series, s)).join("");
    const posterHtml = posterPlaceholderHtml(series.title);
    // "(Animated)" suffix - see the matching comment in buildCard().
    // series.animated (data.js) flags the whole SHOW, not a per-season
    // thing - every season of an animated show is animated.
    const badgeText = `Series${series.animated ? " (Animated)" : ""}`;
    // See the matching comment in buildCard() - same move down into the
    // caption, right above the season list this time.
    const badgeHtml = `<span class="card__badge card__badge--series card__badge--meta">${escapeHtml(badgeText)}</span>`;

    card.innerHTML = `
      <div class="card__frame">
        <div class="card__poster-wrap">
          ${posterHtml}
        </div>
        <div class="card__meta">
          ${badgeHtml}
          <div class="season-list">${rowsHtml}</div>
        </div>
      </div>
    `;

    seasons.forEach((s) => wireCollapsedSeasonRow(card, series, s));
    widenSeriesCard(card, seasons);

    return card;
  }

  function measureTextWidth(text, font) {
    if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
    measureCtx.font = font;
    return measureCtx.measureText(text).width;
  }

  // .card__title wraps across up to 2 lines (-webkit-line-clamp: 2) rather
  // than staying on one like a season row - so unlike SEASON_NAME_FONT/
  // SEASON_META_FONT above, a single canvas measureText() width isn't the
  // right question for it. Real greedy word-wrap rarely splits a title
  // into two even halves (tried that first - half of "Your Friendly
  // Neighborhood Spider-Man"'s single-line width still clipped it to 3
  // lines, because "Your Friendly" wraps far shorter than "Neighborhood
  // Spider-Man" ever could), so this measures the REAL thing instead
  // (same philosophy as capSeasonListHeights() elsewhere): a hidden,
  // off-DOM clone of .card__title's own font/line-height, WITHOUT the
  // line-clamp so it wraps freely, binary-searched down to the narrowest
  // width where its real rendered height still fits within 2 lines.
  function minWidthForTwoLineTitle(text) {
    if (!titleMeasureEl) {
      titleMeasureEl = document.createElement("div");
      titleMeasureEl.style.position = "absolute";
      titleMeasureEl.style.visibility = "hidden";
      titleMeasureEl.style.left = "-9999px";
      titleMeasureEl.style.top = "-9999px";
      titleMeasureEl.style.whiteSpace = "normal";
      titleMeasureEl.style.font = SERIES_TITLE_FONT;
      titleMeasureEl.style.lineHeight = "1.35";
      document.body.appendChild(titleMeasureEl);
    }
    titleMeasureEl.textContent = text;
    const lineH = 13 * 1.35; // matches .card__title's font-size/line-height in css
    const singleLineW = Math.ceil(measureTextWidth(text, SERIES_TITLE_FONT));

    let lo = 20;
    let hi = singleLineW + 2; // guaranteed to fit on ONE line, so well within 2
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      titleMeasureEl.style.width = `${mid}px`;
      if (titleMeasureEl.offsetHeight <= lineH * 2 + 1) {
        hi = mid;
      } else {
        lo = mid;
      }
    }
    return hi;
  }

  /**
   * A merged card with more than MAX_VISIBLE_SEASON_ROWS seasons (Clone
   * Wars' 7) lays its season rows out in extra COLUMNS instead of growing
   * past that many rows tall - .season-list switches to a column-major
   * CSS grid (.card--series-wide, in css) and the card widens to fit it,
   * "at least double" width per column, per request.
   *   A season's name AND its meta line (year · episode count · runtime,
   * see seasonMetaLineText()) are only ever measured, never actually left
   * to truncate: a column (in a multi-column card, OR just the one column
   * of an ordinary single-season card - "S7: Siege of Mandalore" is as
   * long as some show's whole 4-column-wide names) is widened past the
   * normal single-column width whenever the longer of the two needs more
   * room than that, so neither line ever gets clipped.
   *   No-op (and reversible) for a card that needs neither more columns
   * nor more width, so this is safe to just call for every series card,
   * every time (including on resize, since both depend on the current
   * poster size - see resizeWideSeriesCards()).
   */
  function widenSeriesCard(card, seasons) {
    const series = SERIES[seasons[0].seriesId];
    const list = card.querySelector(".season-list");
    const columns = Math.ceil(seasons.length / MAX_VISIBLE_SEASON_ROWS);

    // The widest thing in a row isn't always the season NAME - a season
    // with a short name but a long "year · N · Xh Ym" meta line (see
    // seasonMetaLineText()) can need just as much room, sometimes more
    // (the meta line has no chevron eating into its space, but 3 numbers
    // can still out-measure a short name). Both lines share the same row
    // width, so whichever is wider is what actually has to fit.
    //   .card__title is different from both - it's allowed to wrap across
    // up to 2 lines instead of staying on one (see SERIES_TITLE_FONT's own
    // comment), so minWidthForTwoLineTitle() (real wrap measurement, not a
    // single-line width) is what has to fit instead. This is what actually
    // caught the gap in the first place: "Your Friendly Neighborhood
    // Spider-Man", this app's longest series title yet, was the first one
    // whose name alone (not any season row) needed more room than a
    // normal single-column card has, and got silently clipped by the
    // line-clamp before this existed.
    const widestContentW = Math.max(
      ...seasons.map((s) => measureTextWidth(seasonDisplayLabel(s), SEASON_NAME_FONT)),
      ...seasons.map((s) => measureTextWidth(seasonMetaLineText(s), SEASON_META_FONT)),
      minWidthForTwoLineTitle(series.title)
    );
    const ROW_CHROME = 32; // per column: row padding + top-row gap + chevron
    const CARD_CHROME = 26; // once, not per column: .card__frame's border + .card__meta's own side padding, see css
    const COLUMN_GAP = 10;

    // does the widest name actually fit at the card's normal, unwidened
    // width? lastPosterW IS that normal width (a real, already-working
    // value - ordinary cards render at it fine), so this only has to
    // reconstruct the overhead a name eats into vs. that same number -
    // both CARD_CHROME (paid once) and ROW_CHROME (paid per column, but
    // there's only the one column here) apply.
    const fitsAtNormalWidth = columns <= 1 && widestContentW + ROW_CHROME + CARD_CHROME <= lastPosterW;

    if (fitsAtNormalWidth) {
      card.classList.remove("card--series-wide");
      card.style.width = "";
      card.style.flexBasis = "";
      list.style.removeProperty("--season-columns");
      return;
    }

    // widest season name in THIS show sets the column width - never
    // narrower than a normal single-column card, though, even if every
    // name would fit in less (still "at least double" once 2+ columns)
    const columnW = Math.max(lastPosterW, widestContentW + ROW_CHROME);
    const totalW = columns * columnW + (columns - 1) * COLUMN_GAP + CARD_CHROME;

    card.classList.add("card--series-wide");
    card.style.width = `${totalW}px`;
    card.style.flexBasis = `${totalW}px`;
    list.style.setProperty("--season-columns", columns);
  }

  // Re-applies widenSeriesCard() to every already-built series card after
  // a resize - the poster size (and so lastPosterW, the column-width
  // floor) just changed, but resize doesn't rebuild the cards themselves.
  function resizeWideSeriesCards() {
    els.track.querySelectorAll(".card--series").forEach((card) => {
      const seasons = card.dataset.movieId.split(",").map((id) => SEASONS[id]);
      widenSeriesCard(card, seasons);
    });
  }

  /**
   * .season-list's CSS max-height (see css) is a best-guess safety net,
   * built from a constant (SEASON_ROW_H) that has to be kept in sync by
   * hand with whatever the row actually renders at - and it HAS drifted
   * out of sync before (a padding/line-height tweak silently made rows
   * taller), which is exactly the kind of thing that shows a scrollbar
   * even though MAX_VISIBLE_SEASON_ROWS rows are meant to always fit.
   *   This measures the row height for real, from an actual rendered row
   * (or its stand-in placeholder while it's expanded/flying), and sets an
   * inline max-height derived directly from that - so the cap can never
   * silently fall out of sync with reality again, regardless of any
   * future CSS change to the row's own padding/line-height/font-size.
   * Skipped for a wide (.card--series-wide) card - that one uses columns,
   * not a scrolling cap, see widenSeriesCard().
   */
  function capSeasonListHeights() {
    els.track.querySelectorAll(".card--series:not(.card--series-wide)").forEach((card) => {
      const list = card.querySelector(".season-list");
      const items = list.querySelectorAll(".season-row, .season-row-placeholder");
      if (!items.length) return;

      const rowH = items[0].getBoundingClientRect().height;
      if (!rowH) return; // not actually laid out yet (e.g. display:none ancestor)

      const rows = Math.min(items.length, MAX_VISIBLE_SEASON_ROWS);
      // +2px safety margin against any residual sub-pixel rounding, so
      // the very scrollbar this exists to avoid can never appear by
      // accident even a fraction of a pixel over
      const capH = Math.ceil(rowH * rows + SEASON_ROW_GAP * (rows - 1)) + 2;
      list.style.maxHeight = `${capH}px`;
    });
  }

  /**
   * A poster tile's title (see posterPlaceholderHtml())
   * sits inside a square at a single CSS font-size - fine for most titles,
   * but a long one in the smallest ("short") tier's small square (a Marvel
   * One-Shot's "...A Funny Thing Happened on the Way to Thor's Hammer",
   * say) can wrap past the square's own height and get silently cut off by
   * .card__poster-placeholder's overflow:hidden, with no visual sign
   * anything's missing.
   *   "The square isn't dogmatic" (user request) - a title that doesn't fit
   * gets the tile's own HEIGHT grown a bit FIRST (up to
   * TILE_HEIGHT_GROWTH_MAX_RATIO taller), at full font-size the whole time,
   * before touching the font at all - the title should read loud, and
   * shrinking it away is a worse look than a tile that's a little taller
   * than its neighbors. Only once even that grown height isn't enough does
   * the font actually shrink (at that same grown height), one step at a
   * time, down to TILE_TITLE_FONT_MIN_PX - past which
   * .card__poster-placeholder's overflow:hidden is the last-resort
   * fallback, same "layered, rarely reached" pattern as
   * sizeTimelineToViewport()'s own hard clamp (see also the unclamped
   * .card__title in style.css - the pre-tile title line already preferred
   * "grow the card a little" over losing words, same reasoning here).
   *   Reads the tile's real padding and the title's real default font-size
   * straight off getComputedStyle rather than duplicating either as a JS
   * constant kept in sync by hand - Gotcha #6 already burned this file once
   * on exactly that kind of drift (SEASON_ROW_H going stale after an
   * unrelated markup change). The height grown into is set as an inline
   * style on .card__poster-wrap itself (not the padded .card__poster-
   * placeholder measured for fit) - an explicit height there simply wins
   * over .card--tile's aspect-ratio: 1/1 (aspect-ratio only fills in a
   * dimension that's still auto; once height is pinned like this neither
   * dimension is, so the ratio has nothing left to do) - width is
   * untouched, so a normal tile just gets a bit taller, while a
   * .card--series-wide tile (already widened, see its own CSS comment)
   * grows taller from ITS OWN widened-but-still-square starting height,
   * not the narrow single-column one.
   *   Runs after every render() and on every resize (a tile's size, and so
   * how much room a title has, changes with the viewport) - see both call
   * sites.
   */
  function fitTilePlaceholderTitles() {
    els.track.querySelectorAll(".card__poster-placeholder-title").forEach((titleEl) => {
      const wrap = titleEl.parentElement; // .card__poster-placeholder
      const posterWrap = wrap.parentElement; // .card__poster-wrap - the element whose height fitTilePlaceholderTitles() grows, see the comment above
      // Clear any previous pass's shrink/growth before measuring - a tile
      // that's now bigger (e.g. wider after a resize, or its card widened)
      // may well fit at its natural size again.
      titleEl.style.fontSize = "";
      posterWrap.style.height = "";

      const naturalH = wrap.clientHeight;
      if (!naturalH) return; // not actually laid out yet (e.g. display:none ancestor)
      const wrapStyle = getComputedStyle(wrap);
      const paddingV = parseFloat(wrapStyle.paddingTop) + parseFloat(wrapStyle.paddingBottom);
      const titleFits = (availableH) => titleEl.scrollHeight <= availableH - paddingV;

      if (titleFits(naturalH)) return; // fits already, at full size - nothing to do

      // 1st resort: grow the TILE, title stays at full font the whole time.
      const grownH = naturalH * (1 + TILE_HEIGHT_GROWTH_MAX_RATIO);
      posterWrap.style.height = `${grownH}px`;
      if (titleFits(grownH)) return;

      // 2nd resort: even the grown tile isn't enough - shrink the font at
      // that same (already maximally grown) height, down to the floor.
      let fontSize = parseFloat(getComputedStyle(titleEl).fontSize);
      while (fontSize > TILE_TITLE_FONT_MIN_PX && !titleFits(grownH)) {
        fontSize -= 1;
        titleEl.style.fontSize = `${fontSize}px`;
      }
    });
  }

  function buildSeasonRowHtml(series, season) {
    const fullyWatched = isSeasonFullyWatched(season);
    return `<div class="season-row${fullyWatched ? " is-watched" : ""}" data-season-id="${season.id}">${collapsedSeasonRowInnerHtml(series, season)}</div>`;
  }

  // Just the two collapsed lines - reused both for the initial card build
  // and to restore a row's normal look when it collapses back. Both lines
  // live INSIDE the one <button> - the whole row is the click target, not
  // just the top line - so line2 (year · episode count) has to be
  // phrasing content (spans, not a div) to stay valid inside a <button>.
  function collapsedSeasonRowInnerHtml(series, season) {
    const fullyWatched = isSeasonFullyWatched(season);
    const displayLabel = seasonDisplayLabel(season);
    return `
      <button
        type="button"
        class="season-row__header"
        aria-expanded="false"
        aria-label="${escapeHtml(series.title)} – ${escapeHtml(displayLabel)} (${season.year})${fullyWatched ? ", watched" : ""}, show episodes"
      >
        <span class="season-row__top">
          <span class="season-row__name">${escapeHtml(displayLabel)}</span>
          <span class="season-row__chevron" aria-hidden="true">›</span>
        </span>
        <span class="season-row__line2">
          <span class="season-row__meta">${escapeHtml(seasonMetaLineText(season))}</span>
        </span>
      </button>
    `;
  }

  // "year · N · Xh Ym" (not "year · N episodes · Xh Ymin") - three numbers
  // share this one fixed-height line (SEASON_ROW_H) with no room to spare
  // at a narrow card width, so every part stays as short as it can while
  // staying readable - see the matching shortening in formatRuntime(). The
  // episode count drops even its "e" suffix and is just the bare number -
  // position (2nd of the three, right after the year) is what says what it
  // is, same logic a plain "12 ep." already relied on position+context for.
  // Pulled into its own function (not just inlined at the one call site
  // above) so widenSeriesCard() can measure this EXACT string too, not
  // just the season name - either line can end up the widest thing in the
  // row, and a card only widened for a long name would still clip a long
  // meta line right back to where this whole thing started.
  function seasonMetaLineText(season) {
    const runtimeMin = seasonTotalRuntimeMin(season);
    const runtimeSuffix = runtimeMin === null ? "" : ` · ${formatRuntime(runtimeMin)}`;
    return `${season.year} · ${season.episodes}${runtimeSuffix}`;
  }

  function buildEpisodePillsHtml(season) {
    let html = "";
    for (let n = 1; n <= season.episodes; n++) {
      const w = state.watched.has(episodeId(season, n));
      // data-ep stays the LOOP index (1..season.episodes) - realEpisodeNumber()
      // is what turns it into the real episode number, both for storage
      // (episodeId) and for the label below
      const realNum = realEpisodeNumber(season, n);
      // most shows only have a plain episode count in the data (no
      // curated titles) - those fall back to plain "Episode N" pills; a
      // season with episodeTitles (e.g. The Acolyte) gets "EN: Title" by
      // default, or "<episodePrefix>N: Title" for a show that officially
      // numbers episodes some other way (The Mandalorian's "Chapter N",
      // counting straight through across seasons rather than resetting -
      // episodeOffset carries that too, same field either way). A show
      // whose titles are themselves the only numbering it has (Obi-Wan
      // Kenobi's "Part I".."Part VI") sets episodeTitlesAreSelfNumbered
      // to skip the added "EN:" entirely - printing "E1: Part I" would be
      // redundant with the title already stating its own position.
      const prefix = season.episodePrefix || "E";
      const label = season.episodeTitles
        ? season.episodeTitlesAreSelfNumbered
          ? season.episodeTitles[n - 1]
          : `${prefix}${realNum}: ${season.episodeTitles[n - 1]}`
        : `Episode ${realNum}`;
      html += `<button type="button" class="episode-pill${w ? " is-watched" : ""}" data-ep="${n}" aria-pressed="${w}">${escapeHtml(label)}</button>`;
    }
    return html;
  }

  function wireCollapsedSeasonRow(card, series, season) {
    const rowEl = card.querySelector(`.season-row[data-season-id="${season.id}"]`);
    // Only reachable at all while nothing else is expanded - the backdrop
    // (see expandSeasonRow) sits above every normal card and swallows the
    // click otherwise, so switching straight from one expanded season to
    // a different one is deliberately a two-click affair: the first click
    // just dismisses, same as clicking anywhere else outside the open one.
    rowEl.querySelector(".season-row__header").addEventListener("click", () => {
      expandSeasonRow(card, series, season, rowEl);
    });
  }

  /**
   * Detaches rowEl from the season-list (leaving a same-sized invisible
   * placeholder in its spot) and re-inserts it directly into
   * .timeline-track as an absolutely positioned, single-line strip -
   * checkbox, then the episode list - sized and placed from where it was
   * actually sitting on screen, so it reads as that same row simply
   * growing outward instead of a new element appearing beside it.
   */
  function expandSeasonRow(card, series, season, rowEl) {
    collapseExpandedSeason();

    const trackRect = els.track.getBoundingClientRect();
    const rowRect = rowEl.getBoundingClientRect();
    const originalTop = rowRect.top - trackRect.top;
    const originalLeft = rowRect.left - trackRect.left;
    const originalHeight = rowRect.height;

    const placeholder = document.createElement("div");
    placeholder.className = "season-row-placeholder";
    placeholder.style.height = `${originalHeight}px`;
    rowEl.replaceWith(placeholder);

    const fullyWatched = isSeasonFullyWatched(season);
    rowEl.className = `season-row is-flying${fullyWatched ? " is-watched" : ""}`;
    rowEl.innerHTML = `
      <button type="button" class="season-row__bulk${fullyWatched ? " is-watched" : ""}" aria-pressed="${fullyWatched}" aria-label="Mark whole ${escapeHtml(seasonDisplayLabel(season))} watched">
        <span class="hover-check" aria-hidden="true">${CHECK_SVG}</span>
      </button>
      <div class="episode-strip">${buildEpisodePillsHtml(season)}</div>
    `;
    rowEl.style.position = "absolute";
    rowEl.style.top = `${originalTop}px`;
    rowEl.style.left = `${originalLeft}px`;
    els.track.appendChild(rowEl);

    rowEl.querySelector(".season-row__bulk").addEventListener("click", (e) => {
      e.stopPropagation();
      const nowWatched = !isSeasonFullyWatched(season);
      for (let n = 1; n <= season.episodes; n++) {
        const id = episodeId(season, n);
        if (nowWatched) state.watched.add(id);
        else state.watched.delete(id);
      }
      saveWatched(state.watched);
      refreshExpandedRowUI();
    });

    rowEl.querySelectorAll(".episode-pill").forEach((pill) => {
      pill.addEventListener("click", (e) => {
        e.stopPropagation();
        const n = Number(pill.dataset.ep);
        const id = episodeId(season, n);
        const nowWatched = !state.watched.has(id);
        if (nowWatched) state.watched.add(id);
        else state.watched.delete(id);
        saveWatched(state.watched);
        refreshExpandedRowUI();
      });
    });

    // Backdrop sits above every normal card but below the flying row
    // itself (z-index, see css) - it's what makes "nothing but the open
    // season is active" literally true: it visually and functionally
    // covers everything else (no hover states can reach through it
    // either, so nothing else shows its accent-colored hover border while
    // this is open), and a click anywhere on it just dismisses - it can
    // never ALSO reach through to whatever card/button is underneath, so
    // that first outside click never fires a second, unrelated action.
    //   Appended to .timeline-track - the SAME parent the flying row
    // itself just got moved into a few lines up - not document.body.
    // .timeline-section (an ancestor of track) has its own z-index:1, so
    // it's a stacking context of its own; a body-level backdrop would be
    // compared against that whole section as ONE unit from the outside,
    // burying the flying row's z-index:5 along with everything else in
    // there no matter how high it's set. Being an actual sibling of the
    // flying row inside that same context is what lets z-index rank them
    // against each other correctly instead.
    const backdrop = document.createElement("div");
    backdrop.className = "season-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.addEventListener("click", () => collapseExpandedSeason());
    els.track.appendChild(backdrop);

    expandedSeason = { card, series, season, rowEl, placeholder, backdrop, originalTop, originalHeight, originalLeft };
    repositionExpandedRow();
  }

  function collapseExpandedSeason() {
    if (!expandedSeason) return;
    const { card, series, season, rowEl, placeholder, backdrop } = expandedSeason;

    rowEl.removeAttribute("style");
    rowEl.className = `season-row${isSeasonFullyWatched(season) ? " is-watched" : ""}`;
    rowEl.innerHTML = collapsedSeasonRowInnerHtml(series, season);
    placeholder.replaceWith(rowEl);
    wireCollapsedSeasonRow(card, series, season);
    backdrop.remove();

    expandedSeason = null;
  }

  // Checkbox width isn't known until it's actually rendered (it's not a
  // fixed constant anywhere), so the row's final left edge - checkbox
  // width included - is only settled after that first paint. Also used to
  // re-place the row on resize, since the card it came from may have
  // moved/resized while it was away.
  function repositionExpandedRow() {
    if (!expandedSeason) return;
    const { rowEl, placeholder } = expandedSeason;
    const trackRect = els.track.getBoundingClientRect();
    const placeholderRect = placeholder.getBoundingClientRect();
    const checkboxW = rowEl.querySelector(".season-row__bulk").offsetWidth;

    const top = placeholderRect.top - trackRect.top + (placeholderRect.height - rowEl.offsetHeight) / 2;
    const left = placeholderRect.left - trackRect.left - checkboxW - 6;
    rowEl.style.top = `${top}px`;
    rowEl.style.left = `${left}px`;

    clampExpandedRowToViewport();
  }

  // The row's natural spot (right next to the season row it came from) can
  // push part of it - or, for a long series, the whole wrapped
  // episode-strip - past the edge of the visible area when that row
  // happens to sit near the top/bottom/left/right of it. Clamped against
  // .timeline-scroll's own rect, NOT window.innerWidth/innerHeight: the
  // header above and footer below sit outside .timeline-scroll, so its
  // rect is shorter than the window - a row clamped only to the window
  // could still poke past .timeline-scroll's real bottom edge, and since
  // the row is a child of .timeline-track (inside .timeline-scroll), that
  // alone grows .timeline-scroll's scrollable-overflow area and pops its
  // last-resort overflow-y:auto scrollbar into existence, exactly the
  // thing this is supposed to prevent (see the hard no-vertical-scroll
  // rule in CLAUDE.md) - even though the row was still technically inside
  // the browser window. So after the row is placed at its natural
  // position above, nudge it back inside .timeline-scroll's rect by
  // exactly however much it overflows - measured off its real rendered
  // getBoundingClientRect (forces layout, so the episode-strip's wrap
  // point/height is already settled) rather than guessed from the episode
  // count, since how many lines it wraps to isn't knowable in advance.
  function clampExpandedRowToViewport() {
    const { rowEl } = expandedSeason;
    const margin = 12; // odstup od okraje viditelné plochy
    const bounds = els.scroll.getBoundingClientRect();
    const rect = rowEl.getBoundingClientRect();

    let deltaX = 0;
    if (rect.right > bounds.right - margin) deltaX = bounds.right - margin - rect.right;
    if (rect.left + deltaX < bounds.left + margin) deltaX = bounds.left + margin - rect.left;

    let deltaY = 0;
    if (rect.bottom > bounds.bottom - margin) deltaY = bounds.bottom - margin - rect.bottom;
    if (rect.top + deltaY < bounds.top + margin) deltaY = bounds.top + margin - rect.top;

    if (deltaX) rowEl.style.left = `${parseFloat(rowEl.style.left) + deltaX}px`;
    if (deltaY) rowEl.style.top = `${parseFloat(rowEl.style.top) + deltaY}px`;
  }

  // Re-renders the currently-expanded row's watched-derived bits (bulk
  // check + episode pills) plus the whole card's - after a bulk or
  // per-episode toggle.
  function refreshExpandedRowUI() {
    if (!expandedSeason) return;
    const { card, season } = expandedSeason;
    const rowEl = expandedSeason.rowEl;
    const fullyWatched = isSeasonFullyWatched(season);
    rowEl.classList.toggle("is-watched", fullyWatched);

    const bulkBtn = rowEl.querySelector(".season-row__bulk");
    bulkBtn.classList.toggle("is-watched", fullyWatched);
    bulkBtn.setAttribute("aria-pressed", String(fullyWatched));

    rowEl.querySelectorAll(".episode-pill").forEach((pill) => {
      const w = state.watched.has(episodeId(season, Number(pill.dataset.ep)));
      pill.classList.toggle("is-watched", w);
      pill.setAttribute("aria-pressed", String(w));
    });

    // the card itself turns green once every season listed on it is fully
    // watched - card.dataset.movieId is the comma-joined season id list
    // set in buildSeriesCard()
    const allSeasonsWatched = card.dataset.movieId
      .split(",")
      .every((id) => isSeasonFullyWatched(SEASONS[id]));
    card.classList.toggle("is-watched", allSeasonsWatched);

    updateProgress();
    drawConnectors();
  }

  /* ---------------------------------------------------------------- */
  /*  Connectors between posters (SVG)                                   */
  /* ---------------------------------------------------------------- */
  function drawConnectors() {
    const svg = els.track.querySelector(".connector-layer");
    if (!svg) return;

    svg.innerHTML = "";
    svg.setAttribute("width", `${els.track.scrollWidth}`);
    svg.setAttribute("height", `${getTrackContentHeight()}`);

    const posterWraps = [...els.track.querySelectorAll(".card__poster-wrap")];
    const trackRect = els.track.getBoundingClientRect();

    const centers = posterWraps.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        x: r.left - trackRect.left + r.width / 2,
        y: r.top - trackRect.top - eraLabelH - yearBandH + r.height / 2,
        // "watched" is read straight off the rendered card, works the
        // same way for a movie or a (possibly merged) series
        watched: el.closest(".card").classList.contains("is-watched"),
        // see the comment on movie.otherEarth in data.js - both segments
        // touching a card "glued onto" the axis from outside Sacred
        // Timeline render distinctly too (connector-line--other-earth,
        // css/style.css), so the whole vertical thread through it reads
        // as foreign, not just the card in isolation. The actual LABEL
        // (not just a yes/no flag) is what lets the loop below tell "both
        // ends are the same foreign universe" (e.g. two consecutive
        // Earth-10005 films - solid line, real continuity within that
        // story) apart from "crossing a seam" (Sacred Timeline <-> a
        // foreign Earth, or two DIFFERENT foreign Earths - dashed).
        otherEarthLabel: el.closest(".card").dataset.otherEarthLabel || null,
      };
    });

    for (let i = 0; i < centers.length - 1; i++) {
      const a = centers[i];
      const b = centers[i + 1];
      const done = a.watched && b.watched;
      const otherEarth = !!(a.otherEarthLabel || b.otherEarthLabel);
      // Same label on both ends = genuinely the same universe, not just
      // "both happen to be foreign" - see the comment above. Only this
      // true/false distinction reaches the connector - which SPECIFIC
      // Earth is involved doesn't, and neither does otherEarth-ness
      // itself carry any color anymore (unlike the card/year-band): every
      // connector on the page, foreign or not, renders the exact same
      // default --line stroke - see the CSS comment on
      // .connector-line--other-earth-seam. This flag only ever decides
      // solid vs. dashed now.
      const sameForeignUniverse = !!a.otherEarthLabel && a.otherEarthLabel === b.otherEarthLabel;

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", a.x);
      line.setAttribute("y1", a.y);
      line.setAttribute("x2", b.x);
      line.setAttribute("y2", b.y);
      line.setAttribute(
        "class",
        `connector-line${done ? " connector-line--done" : ""}${otherEarth ? " connector-line--other-earth" : ""}${otherEarth && !sameForeignUniverse ? " connector-line--other-earth-seam" : ""}`
      );
      svg.appendChild(line);
    }
  }

  function getTrackContentHeight() {
    const val = getComputedStyle(document.documentElement).getPropertyValue("--track-h");
    return parseFloat(val) || 520;
  }

  /* ---------------------------------------------------------------- */
  /*  Room for the first era's description to breathe                   */
  /* ---------------------------------------------------------------- */
  /**
   * era-block__label (title bar + description) is intentionally allowed
   * to overflow past its own (sometimes single-card-narrow) era-block,
   * both via --era-title-min-w (see css, keeps the title's flanking lines
   * a decent length even for a one-card era) and the description's own
   * unclamped single-line width. That's harmless everywhere EXCEPT the
   * very first era: if the label is wider than that era-block, the
   * centered overflow bleeds off the LEFT edge of the scrollable track,
   * past scrollLeft 0 - unreachable, permanently clipped, unlike an
   * overflow to the right (which just extends how far you can scroll).
   * Measuring the actual rendered gap and nudging the first era-block
   * over by exactly that much (instead of guessing a fixed pixel value)
   * keeps this correct across any viewport size, poster size or wording.
   */
  function fixFirstEraLeadSpace() {
    const firstBlock = els.track.querySelector(".era-block");
    const firstLabel = els.track.querySelector(".era-block__label");
    if (!firstBlock || !firstLabel) return;

    firstBlock.style.marginLeft = ""; // reset before re-measuring

    // The deficit is a getBoundingClientRect() (viewport-relative)
    // measurement, and this runs again on every resize - not just once
    // right after a fresh render, when scrollLeft is always still 0. If
    // the user had since scrolled the timeline away from the start, the
    // label sits way off to the left of the viewport at measurement time
    // (a very negative .left), which used to read as a huge bogus
    // "deficit" and get baked in as real margin - permanently inflating
    // how far left the whole track could then be scrolled, well past the
    // actual first card, even after scrolling back to the start. Snap to
    // the start for the measurement, then put the scroll position back
    // exactly where the user had it.
    const savedScrollLeft = els.scroll.scrollLeft;
    els.scroll.scrollLeft = 0;

    const deficit = els.scroll.getBoundingClientRect().left - firstLabel.getBoundingClientRect().left;
    if (deficit > 0) {
      firstBlock.style.marginLeft = `${Math.ceil(deficit) + 6}px`;
    }

    els.scroll.scrollLeft = savedScrollLeft;
  }

  /* ---------------------------------------------------------------- */
  /*  Year band strip - in-universe years, above the era labels          */
  /* ---------------------------------------------------------------- */
  /**
   * One label per entry, stretched to span from the left edge of its
   * firstCard to the right edge of its lastCard (both actual rendered
   * elements, see render()) - same "read the real layout" approach as
   * drawConnectors, so it stays correct across resizes and card-size
   * changes without having to duplicate the track's flex/gap math here.
   */
  function drawYearBands(entries, isChronological) {
    const layer = els.track.querySelector(".year-band-layer");
    if (!layer) return;

    layer.innerHTML = "";
    if (!entries.length) return;

    const trackRect = els.track.getBoundingClientRect();

    entries.forEach((entry) => {
      const r1 = entry.firstCard.getBoundingClientRect();
      const r2 = entry.lastCard.getBoundingClientRect();
      const left = r1.left - trackRect.left;
      const width = r2.right - trackRect.left - left;

      // otherEarth (see the comment on movie.otherEarth in data.js) marks
      // a band belonging to a title "glued onto" the axis from outside
      // Sacred Timeline - same gray-instead-of-accent treatment as
      // .year-band--milestone gets for a notable in-universe event, just
      // for a different reason. Under Release Order this still applies -
      // ORDERINGS_MARVEL's own Release Order yearBands carry otherEarth
      // data too (split per otherEarth-identity run, same as Chronological
      // - see that array's own comment in data.js) - but the EARTH-NAME
      // sub-label below does NOT: under Release Order the label above it
      // is already a real release year, not a date "from the film" the
      // way Chronological's otherEarth.year is, so naming the Earth right
      // under it would misleadingly suggest the date itself is somehow
      // otherEarth-specific too. The COLOR still needs to carry that
      // signal on its own here, which is exactly what it does.
      //   entry.noTimeline (Loki season 1's own "OUTSIDE TIME" band, data.js
      // - the one otherEarth entry with no date of any kind, not even an
      // approximate one) suppresses BOTH the sub-label AND the reach-
      // indicator span below - showing "OUTSIDE TIME" a second time on the
      // sub-label line would just repeat the main label's own text (the
      // sub-label normally names a DIFFERENT thing, the Earth, distinct
      // from the date above it - here they're the same string), and the
      // reach-indicator's whole job is pointing at "these specific cards on
      // the timeline", which reads as a contradiction next to a label
      // whose entire point is that there ISN'T a timeline to point along
      // here. Every other otherEarth band keeps both.
      const showEarthLabel = entry.otherEarth && isChronological && !entry.noTimeline;
      const chip = document.createElement("div");
      chip.className = `year-band${entry.milestone ? " year-band--milestone" : ""}${entry.otherEarth ? " year-band--other-earth" : ""}`;
      chip.style.left = `${left}px`;
      chip.style.width = `${width}px`;
      // Same [data-other-earth-label] hook as the card itself (see the
      // comment in buildCard()) - lets a specific universe's own color
      // (e.g. Earth-10005's steel blue) cascade down to this chip's
      // .year-band__label/__earth/__span children too, via
      // --other-earth-current (style.css). Set from entry.otherEarth alone
      // (not showEarthLabel) - the color applies under both orderings even
      // when the sub-label text that would normally announce it doesn't.
      if (entry.otherEarth) chip.dataset.otherEarthLabel = entry.otherEarth;
      // .year-band__span (the small reach-indicator line under the date)
      // always renders, one card or several (left/width above already
      // cover exactly the card(s) this band spans, span:1 included) - see
      // its own comment in css for why this is the LESS prominent of the
      // axis's two lines, not the main structural one. entry.noTimeline is
      // the ONE deliberate exception to "always renders" - see the comment
      // above showEarthLabel.
      chip.innerHTML = `
        <span class="year-band__label">${escapeHtml(entry.label)}</span>
        ${entry.milestone ? `<span class="year-band__milestone">⚔ ${escapeHtml(entry.milestone)}</span>` : ""}
        ${showEarthLabel ? `<span class="year-band__earth">${escapeHtml(otherEarthDisplayText(entry.otherEarth, entry.otherEarthVariant))}</span>` : ""}
        ${entry.noTimeline ? "" : `<span class="year-band__span" aria-hidden="true"></span>`}
      `;
      layer.appendChild(chip);
    });
  }

  /* ---------------------------------------------------------------- */
  /*  Progress                                                           */
  /* ---------------------------------------------------------------- */
  function updateProgress() {
    // Totals are recomputed every call, not cached - they depend on
    // whichever franchise's MOVIES/SEASONS is currently bound
    // (switchFranchise() reassigns those, see applyFranchiseData()), so a
    // franchise switch needs them to change right along with the counts.
    const total = getTotalUnits();
    const count = getWatchedUnitsCount();
    els.progressTotal.textContent = total;
    els.progressCount.textContent = count;
    els.progressFill.style.width = `${total ? (count / total) * 100 : 0}%`;

    const runtimeTotal = getTotalRuntimeMin();
    const runtimeWatched = getWatchedRuntimeMin();
    els.progressRuntimeTotal.textContent = formatRuntime(runtimeTotal);
    els.progressRuntimeWatched.textContent = formatRuntime(runtimeWatched);
    els.progressRuntimeFill.style.width = `${runtimeTotal ? (runtimeWatched / runtimeTotal) * 100 : 0}%`;
  }

  // Count of all "checkable" units: every movie is 1, every REAL season of
  // every show is 1 (regardless of whether it's currently shown merged
  // with others or on its own, and regardless of its episode count). A
  // season "slice" (`sliceOf` set, see episodeId()) is skipped here - it's
  // not a season of its own, just part of one that's shown split off
  // elsewhere, and that one still only counts once.
  function getTotalUnits() {
    const realSeasons = Object.values(SEASONS).filter((s) => !s.sliceOf).length;
    return Object.keys(MOVIES).length + realSeasons;
  }

  // state.watched holds movie ids AND per-episode ids, so its raw .size
  // isn't the unit count above - a season only contributes once its
  // episodes are all present.
  function getWatchedUnitsCount() {
    let count = 0;
    Object.keys(MOVIES).forEach((id) => {
      if (state.watched.has(id)) count += 1;
    });
    Object.values(SEASONS)
      .filter((s) => !s.sliceOf)
      .forEach((season) => {
        if (isSeasonFullyWatched(season)) count += 1;
      });
    return count;
  }

  // Runtime counterpart to getTotalUnits() above - every movie's
  // runtimeMin plus every REAL season's own total, via
  // seasonTotalRuntimeMin() called on the season itself (not a slice of
  // it - same "real, unsliced seasons only" scope as getTotalUnits()).
  // Every real season has either episodeRuntimes or a totalRuntimeMin
  // fallback today (see CLAUDE.md's runtime-data note), so this never
  // silently drops a show - seasonTotalRuntimeMin() returning null is
  // just defensive, same as the `|| 0` on a card's own runtime line.
  function getTotalRuntimeMin() {
    const moviesTotal = Object.values(MOVIES).reduce((sum, m) => sum + m.runtimeMin, 0);
    const seasonsTotal = Object.values(SEASONS)
      .filter((s) => !s.sliceOf)
      .reduce((sum, s) => sum + (seasonTotalRuntimeMin(s) || 0), 0);
    return moviesTotal + seasonsTotal;
  }

  // Runtime counterpart to getWatchedUnitsCount() above, but with partial
  // credit: unlike the unit count (a season only counts once EVERY
  // episode is checked), a partially-watched season contributes the
  // actual minutes of just its watched episodes wherever real per-episode
  // runtimes exist - the same "only the actually-included episodes"
  // principle seasonTotalRuntimeMin() already applies to a partially-
  // curated CARD, just driven by watched-state instead of a slice's
  // episodeNumbers. A season with only a season-level totalRuntimeMin (no
  // per-episode breakdown, e.g. an unaired show) has no minutes to
  // attribute to individual episodes, so it only contributes once
  // isSeasonFullyWatched() - all-or-nothing, same as its own card display.
  function getWatchedRuntimeMin() {
    let total = 0;
    Object.values(MOVIES).forEach((m) => {
      if (state.watched.has(m.id)) total += m.runtimeMin;
    });
    Object.values(SEASONS)
      .filter((s) => !s.sliceOf)
      .forEach((season) => {
        if (season.episodeRuntimes) {
          for (let n = 1; n <= season.episodes; n++) {
            if (state.watched.has(episodeId(season, n))) total += season.episodeRuntimes[n - 1];
          }
        } else if (season.totalRuntimeMin != null && isSeasonFullyWatched(season)) {
          total += season.totalRuntimeMin;
        }
      });
    return total;
  }

  /* ---------------------------------------------------------------- */
  /*  Per-episode watched state                                          */
  /* ---------------------------------------------------------------- */
  // A season's episodes aren't individually named/dated anywhere in the
  // data (SEASONS only has a total count) - "Episode N" placeholders are
  // generated straight from that count, see buildEpisodePillsHtml().
  //
  // A SEASON "SLICE" - e.g. Clone Wars S7's finale arc (E9-E12), split off
  // in the chronological order to sit after Revenge of the Sith instead of
  // with the rest of that season (see data.js) - is a second SEASONS entry
  // covering only part of a real season's episodes (`sliceOf` names the
  // real one, `episodeOffset` says how far into it this slice starts). It
  // renders as its own card, but every read/write of its episodes'
  // watched-state goes straight to the REAL season's own keys (via `n +
  // episodeOffset`, here) - so ticking "Episode 9" from that split-off card
  // is the exact same action as ticking it from the season's whole entry
  // wherever else that's shown (Release Order, say), always in sync, and
  // it doesn't need to (and must not) count as a second unit toward the
  // total - see getTotalUnits()/getWatchedUnitsCount().
  //   A slice's real episodes don't have to be one contiguous run either -
  // `episodeNumbers` (an explicit array of real episode numbers, in order)
  // covers a hand-picked, possibly non-contiguous subset instead (the
  // Story Arcs "Anakin Skywalker Saga" era's curated Clone Wars seasons in
  // data.js: only the episodes that are actually about Anakin, out of a
  // whole season's worth). Takes priority over episodeOffset when present.
  function realEpisodeNumber(season, n) {
    if (season.episodeNumbers) return season.episodeNumbers[n - 1];
    return (season.episodeOffset || 0) + n;
  }

  function episodeId(season, n) {
    const realSeasonId = season.sliceOf || season.id;
    return `${realSeasonId}:${realEpisodeNumber(season, n)}`;
  }

  // Total runtime of a season CARD, in minutes - a whole season sums every
  // one of its own episodeRuntimes (data.js), but a slice (partial pick -
  // sliceOf set, whether a contiguous episodeOffset range or a hand-picked
  // episodeNumbers list) only sums the SPECIFIC real episodes it actually
  // covers, via the same realEpisodeNumber() resolution episodeId() uses -
  // never the real season's full runtime. That's what makes a curated
  // Story Arcs season (say, 3 of Ahsoka's 8 episodes) correctly show as
  // ~2h instead of the whole season's ~6h, with nothing hand-maintained
  // per slice to go stale: episodeRuntimes only ever lives on the ONE real
  // season entry, every slice of it derives from that same array.
  //   realEpisodeNumber() is only the right index when sliceOf is actually
  //   set (a genuine slice, whose offset/episodeNumbers point INTO another
  //   season's array). The Mandalorian's md-s2/md-s3 also carry an
  //   episodeOffset with no sliceOf - there, it's purely a running "Chapter
  //   N" DISPLAY offset (see episodeId()/buildEpisodePillsHtml), and each
  //   season's own episodeRuntimes is still indexed locally (1..8), not by
  //   the inflated chapter count - applying realEpisodeNumber() there would
  //   read past the end of the array. So: real index is n itself whenever
  //   there's no sliceOf, and only defers to realEpisodeNumber() when there
  //   is one.
  //   Returns null (not 0) when the real season has neither episodeRuntimes
  // nor a totalRuntimeMin fallback (see below) at all yet - the caller
  // skips showing a runtime entirely rather than claim "0min".
  //   A show that hasn't aired yet (Maul - Shadow Lord) can't have real
  // per-episode runtimes verified anywhere - totalRuntimeMin on the real
  // season is a season-level total instead (a number the user gave
  // directly), used ONLY when this card shows the season WHOLE (not a
  // slice, and not fewer episodes than the real season has): there's no
  // real per-episode split behind it to sum a partial pick from, so a
  // slice of such a season - should one ever exist - stays unshown rather
  // than guess at a fake breakdown.
  function seasonTotalRuntimeMin(season) {
    const real = SEASONS[season.sliceOf || season.id];
    if (!real) return null;
    if (real.episodeRuntimes) {
      let total = 0;
      for (let n = 1; n <= season.episodes; n++) {
        const index = season.sliceOf ? realEpisodeNumber(season, n) - 1 : n - 1;
        total += real.episodeRuntimes[index];
      }
      return total;
    }
    if (real.totalRuntimeMin != null && !season.sliceOf && season.episodes === real.episodes) {
      return real.totalRuntimeMin;
    }
    return null;
  }

  // A season "slice" only covers part of its real season's episodes (see
  // the sliceOf/episodeOffset comments in data.js) - showing the same bare
  // "Season 1" on both pieces of a split would make them indistinguishable
  // in the timeline, so a CONTIGUOUS slice's displayed name gets its
  // covered episode range appended, e.g. "S7: The Final Season (e01-e08)"
  // / "S7: The Final Season (e09-e12)". Derived from episodeOffset/episodes
  // rather than typed into season.label by hand, so it can never drift
  // from the episodes the slice actually covers.
  //   A non-contiguous, hand-picked slice (episodeNumbers set - see
  // realEpisodeNumber()) skips this entirely and shows the plain label -
  // there's no single "range" that could describe a scattered pick of
  // episodes, and the meta line right below the name already states how
  // many are actually in it (see seasonMetaLineText()), so nothing is
  // lost by leaving it off.
  //   Every place that shows a season's name to the user (including
  // widenSeriesCard's width measurement - a slice's longer name must count
  // there too) goes through this instead of reading season.label directly.
  function seasonDisplayLabel(season) {
    if (!season.sliceOf || season.episodeNumbers) return season.label;
    const pad = (n) => String(n).padStart(2, "0");
    const first = (season.episodeOffset || 0) + 1;
    const last = (season.episodeOffset || 0) + season.episodes;
    // a single-episode slice (e.g. one Story Arcs "arc" that's really just
    // one episode - Clone Wars S2's "Lightsaber Lost") would read as the
    // redundant "e11-e11" with the two-sided range format below
    const range = first === last ? `e${pad(first)}` : `e${pad(first)}-e${pad(last)}`;
    return `${season.label} (${range})`;
  }

  function isSeasonFullyWatched(season) {
    for (let n = 1; n <= season.episodes; n++) {
      if (!state.watched.has(episodeId(season, n))) return false;
    }
    return true;
  }

  /* ---------------------------------------------------------------- */
  /*  Persistence + utilities                                            */
  /* ---------------------------------------------------------------- */
  function loadWatched() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      const ids = Array.isArray(raw) ? raw : [];
      const set = new Set();
      // migrate the old format, where a whole season was one entry (its
      // bare season id) - expand it into "every episode watched" so
      // existing progress isn't lost when this ships
      ids.forEach((id) => {
        const season = SEASONS[id];
        if (season) {
          for (let n = 1; n <= season.episodes; n++) set.add(episodeId(season, n));
        } else {
          set.add(id);
        }
      });
      return set;
    } catch {
      return new Set();
    }
  }

  function saveWatched(set) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
    } catch {
      /* localStorage unavailable (private mode etc.) - fail silently */
    }
  }

  // Remembers which franchise was last active, so an F5 reload reopens on
  // it instead of always snapping back to Star Wars. Falls back to
  // FRANCHISES[0].id both when nothing is stored yet AND when the stored
  // value no longer matches a real franchise - same "never trust stored
  // input without checking it" reasoning as loadOrderingId() below. Called
  // BEFORE ORDERINGS/STORY_LINES ever get validated against anything (see
  // the top-level state setup) - FRANCHISES itself never changes shape, so
  // this one has nothing else it needs to be validated against first.
  function loadFranchiseId() {
    try {
      const stored = localStorage.getItem(FRANCHISE_STORAGE_KEY);
      if (FRANCHISES.some((f) => f.id === stored)) return stored;
    } catch {
      /* localStorage unavailable (private mode etc.) - fail silently */
    }
    return FRANCHISES[0].id;
  }

  function saveFranchiseId(id) {
    try {
      localStorage.setItem(FRANCHISE_STORAGE_KEY, id);
    } catch {
      /* localStorage unavailable (private mode etc.) - fail silently */
    }
  }

  // The actual "swap the active dataset" step switchFranchise() (above)
  // delegates to - reassigns the plain MOVIES/SERIES/SEASONS/ORDERINGS/
  // STORY_LINES bindings themselves (declared `let`, not `const`, in
  // data.js for exactly this reason) to whichever franchise's own dataset
  // FRANCHISE_DATA (data.js) has for it. Every function in this file reads
  // those as bare identifiers rather than taking a dataset argument, so
  // reassigning them here is enough to make the ENTIRE rest of the app -
  // rendering, watched-state counting, runtime totals, persistence
  // validation - transparently follow whichever franchise is active,
  // with no per-function changes needed anywhere else.
  //   Also stamps `data-franchise` on <html> - the one place this
  // function reaches outside app.js's own data, since the page's accent
  // color is per-franchise too (Star Wars gold vs. Marvel red - see the
  // `:root[data-franchise="marvel"]` override in style.css) and CSS has
  // no other way to know which franchise is active. Every rule that reads
  // --accent/--accent-dim/--accent-glow/--accent-ink picks this up for
  // free; nothing else in this file needs to know the color scheme
  // changed at all.
  function applyFranchiseData(franchiseId) {
    const data = FRANCHISE_DATA[franchiseId] || FRANCHISE_DATA[FRANCHISES[0].id];
    MOVIES = data.movies;
    SERIES = data.series;
    SEASONS = data.seasons;
    ORDERINGS = data.orderings;
    STORY_LINES = data.storyLines || [];
    document.documentElement.dataset.franchise = franchiseId;
  }

  // Remembers which ordering tab was last picked, so an F5 reload reopens
  // on it instead of always snapping back to ORDERINGS[0]. Falls back to
  // ORDERINGS[0].id both when nothing is stored yet AND when the stored
  // value no longer matches a real ordering (e.g. an old id left over from
  // before ORDERINGS was reordered/renamed) - never trust stored input as
  // a valid id without checking it against the current data.
  function loadOrderingId() {
    try {
      const stored = localStorage.getItem(ORDERING_STORAGE_KEY);
      if (ORDERINGS.some((o) => o.id === stored)) return stored;
    } catch {
      /* localStorage unavailable (private mode etc.) - fail silently */
    }
    return ORDERINGS[0].id;
  }

  function saveOrderingId(id) {
    try {
      localStorage.setItem(ORDERING_STORAGE_KEY, id);
    } catch {
      /* localStorage unavailable (private mode etc.) - fail silently */
    }
  }

  // Same reasoning as loadOrderingId() - falls back to "" (All, no story
  // line filter) both when nothing's stored yet AND when the stored id no
  // longer matches a real STORY_LINES entry.
  function loadStoryLineId() {
    try {
      const stored = localStorage.getItem(STORY_LINE_STORAGE_KEY);
      if (stored === "" || STORY_LINES.some((sl) => sl.id === stored)) return stored;
    } catch {
      /* localStorage unavailable (private mode etc.) - fail silently */
    }
    return "";
  }

  function saveStoryLineId(id) {
    try {
      localStorage.setItem(STORY_LINE_STORAGE_KEY, id);
    } catch {
      /* localStorage unavailable (private mode etc.) - fail silently */
    }
  }

  // Same "validate against current data, don't trust stored input" rule
  // as loadOrderingId/loadStoryLineId above, applied to a whole SET
  // instead of one id: unknown bucket ids (an old EARTH_BUCKETS entry
  // since removed/renamed) are silently dropped rather than kept around
  // as dead state, and an empty result (nothing stored yet, or every
  // stored id turned out stale) falls back to "all enabled" - the
  // default, no-filtering state - never to an accidentally-empty set that
  // would hide the entire axis.
  function loadEnabledEarths() {
    try {
      const raw = JSON.parse(localStorage.getItem(MULTIVERSE_STORAGE_KEY) || "[]");
      const ids = Array.isArray(raw) ? raw : [];
      const validIds = ids.filter((id) => EARTH_BUCKETS.some((b) => b.id === id));
      if (validIds.length) return new Set(validIds);
    } catch {
      /* localStorage unavailable (private mode etc.) - fail silently */
    }
    return new Set(EARTH_BUCKETS.map((b) => b.id));
  }

  function saveEnabledEarths(set) {
    try {
      localStorage.setItem(MULTIVERSE_STORAGE_KEY, JSON.stringify([...set]));
    } catch {
      /* localStorage unavailable (private mode etc.) - fail silently */
    }
  }

  function loadDoomsdayWatchlist() {
    try {
      return localStorage.getItem(DOOMSDAY_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  }

  function saveDoomsdayWatchlist(value) {
    try {
      localStorage.setItem(DOOMSDAY_STORAGE_KEY, String(value));
    } catch {
      /* localStorage unavailable (private mode etc.) - fail silently */
    }
  }

  function loadCoreMcu() {
    try {
      return localStorage.getItem(CORE_MCU_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  }

  function saveCoreMcu(value) {
    try {
      localStorage.setItem(CORE_MCU_STORAGE_KEY, String(value));
    } catch {
      /* localStorage unavailable (private mode etc.) - fail silently */
    }
  }

  function debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // TEMPORARY EXPERIMENT - see POSTER_TEST_IDS' own comment above. Shared
  // by buildCard()/buildSeriesCard() so the watermark markup only lives in
  // one place. The SVG paths are the same filmstrip shape as favicon.svg,
  // just re-expressed with `currentColor`/`var(--bg-elevated)` instead of
  // hardcoded hex so it inherits --accent-dim (see .card__poster-placeholder-
  // icon in style.css) and stays correct across a franchise switch, rather
  // than a second static asset that would need its own recoloring.
  function posterPlaceholderHtml(title) {
    // The icon's "holes" fill with --tile-bg (the placeholder's own
    // background, style.css), not a flat --bg-elevated - the background is
    // a per-Earth COLOR TINT now (see --tile-color's own comment in
    // style.css), so a hardcoded neutral fill would visibly mismatch the
    // actual background behind it and break the punched-out look.
    return `
      <span class="card__poster-placeholder">
        <svg class="card__poster-placeholder-icon" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="6" y="4" width="20" height="24" rx="3" fill="currentColor" />
          <rect x="8" y="7" width="3" height="3" rx="0.8" fill="var(--tile-bg)" />
          <rect x="8" y="14.5" width="3" height="3" rx="0.8" fill="var(--tile-bg)" />
          <rect x="8" y="22" width="3" height="3" rx="0.8" fill="var(--tile-bg)" />
          <rect x="21" y="7" width="3" height="3" rx="0.8" fill="var(--tile-bg)" />
          <rect x="21" y="14.5" width="3" height="3" rx="0.8" fill="var(--tile-bg)" />
          <rect x="21" y="22" width="3" height="3" rx="0.8" fill="var(--tile-bg)" />
          <rect x="13" y="9" width="6" height="14" rx="1.4" fill="var(--tile-bg)" />
        </svg>
        <span class="card__poster-placeholder-title">${tileTitleHtml(title)}</span>
      </span>
    `;
  }

  // A title with a colon ("Star Wars: The Phantom Menace") reads much
  // better broken right after it than wherever plain greedy word-wrap
  // would otherwise happen to land (user request) - matches how a real
  // poster's own title/subtitle split usually reads, rather than an
  // arbitrary mid-phrase break. Only the FIRST colon - no title in either
  // dataset has a second one today, and a second colon staying on the same
  // wrapped line as whatever follows it is a reasonable fallback if one
  // ever shows up. escapeHtml() runs on each half separately (not the
  // whole string before inserting <br>) so a literal "<"/"&" in a title
  // can't get reinterpreted as markup once the manual break is spliced in.
  function tileTitleHtml(title) {
    const colonIdx = title.indexOf(":");
    if (colonIdx === -1) return escapeHtml(title);
    const before = title.slice(0, colonIdx + 1); // keep the colon itself on the first line
    const after = title.slice(colonIdx + 1).trim();
    return `${escapeHtml(before)}<br>${escapeHtml(after)}`;
  }

  // "Earth-10005" + "Original" -> "Earth-10005 (Original)" - DISPLAY text
  // only (card__origin-earth in buildCard()/buildSeriesCard(),
  // .year-band__earth in drawYearBands()). The variant deliberately never
  // touches otherEarth.label/entry.otherEarth themselves - those still
  // have to read identical across every card sharing one universe (the
  // X-Men trilogy's "Original" flags which TIMELINE-BRANCH within
  // Earth-10005 this is, not a different universe from First Class/
  // Deadpool & Wolverine), since drawConnectors()'s "same universe" check
  // and the [data-other-earth-label] CSS color override (style.css) both
  // match on that label verbatim - see the comment on movie.otherEarth in
  // data.js.
  function otherEarthDisplayText(label, variant) {
    return variant ? `${label} (${variant})` : label;
  }

  // "142" -> "2h 22m" - runtimeMin (MOVIES)/episodeRuntimes (SEASONS) are
  // stored as raw minute counts, not pre-formatted, same "store raw,
  // format at render time" approach as everything else here (year,
  // episode counts, ...). Kept as short as "Xh Ym" rather than "Xh Ymin" -
  // on a season row this shares one fixed-height line (SEASON_ROW_H) with
  // the year and episode count, with no room to spare - see the matching
  // bare-number (no "ep.") shortening in seasonMetaLineText().
  function formatRuntime(totalMinutes) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    // movies are always well over an hour, but a curated season slice (see
    // seasonTotalRuntimeMin) can total under 60min - "0h 20m" would read
    // strangely, so the hour part only appears once there's at least one
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
})();
