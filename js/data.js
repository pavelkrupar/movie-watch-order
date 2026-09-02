/**
 * Data layer.
 * -----------------------------------------------------------------------
 * Two franchises today, Star Wars and Marvel - each one a fully separate
 * MOVIES/SERIES/SEASONS/ORDERINGS(/STORY_LINES) dataset, suffixed
 * _STARWARS / _MARVEL below. app.js never reads those suffixed names
 * directly - it reads the bare, unsuffixed MOVIES/SERIES/SEASONS/
 * ORDERINGS/STORY_LINES identifiers everywhere (rendering, watched-state
 * counting, runtime totals, persistence validation, all of it), declared
 * `let` at the very end of this file and pointed at Star Wars's own data
 * by default. Picking a franchise in the header (switchFranchise() in
 * app.js) just reassigns those five bindings to the other franchise's
 * dataset (FRANCHISE_DATA, also at the end of this file) and re-renders -
 * every function elsewhere in app.js is automatically "about" whichever
 * franchise is active without needing to know that franchise switching
 * exists at all. A third franchise later is "one more dataset + one more
 * FRANCHISE_DATA/FRANCHISES entry", not new plumbing.
 *
 * MOVIES  – dictionary of movies (key = id). One "watched" toggle per movie.
 *
 * SERIES  – dictionary of shows (key = show id). Just basic metadata
 *           (title, poster).
 *
 * SEASONS – dictionary of every INDIVIDUAL season of every show (key =
 *           season id). This is the smallest unit the user checks off and
 *           the one that gets placed on the timeline - there are no
 *           pre-bundled "batches" of seasons here. Whether several seasons
 *           end up sharing one poster is decided at render time (see
 *           groupEraItems in app.js): if two or more seasons of the SAME
 *           show sit next to each other in a given ORDERINGS sequence with
 *           nothing else between them, they share a card. Because release
 *           order and chronological order sequence things differently, the
 *           same show can merge in one mode and split into separate cards
 *           in the other (e.g. The Mandalorian S1+S2 - by release date
 *           Clone Wars S7 sits between them so they stay separate; in
 *           chronological order nothing sits between them, so they merge).
 *
 * ORDERINGS – definition of each ordering mode. Each mode has its own
 *             breakdown into "eras" and its own sequence of items within
 *             an era (itemIds - a movie id from MOVIES, or a season id
 *             from SEASONS). Each ordering's own top-level `description`
 *             is the explainer paragraph shown under the order-switch
 *             pills for whichever ordering is currently active (see
 *             updateOrderingDescription in app.js).
 *
 * FRANCHISES – the franchise picker shown top-right of the header (see
 *              buildFranchiseSelect in app.js) - just id/label pairs, kept
 *              separate from FRANCHISE_DATA (the actual datasets) since it
 *              doesn't depend on either dataset being fully defined yet.
 *
 * EARTH_BUCKETS – the "Multiverse" checkbox filter's own buckets (see
 *                 its own comment right below) - id/label pairs, same
 *                 spirit as FRANCHISES above.
 * -----------------------------------------------------------------------
 */

const FRANCHISES = [
  { id: "starwars", label: "Star Wars" },
  { id: "marvel", label: "Marvel" },
];

// The "Multiverse" checkbox filter's own buckets (see
// buildMultiverseSelect/populateMultiverseMenu/earthBucketId in app.js) -
// franchise-agnostic like FRANCHISES above, not per-franchise data, since
// "which Earth" is a property of movie.otherEarth/season.otherEarth
// (data.js) wherever it exists, not something a franchise has to declare.
// A franchise with no otherEarth-flagged content at all (Star Wars today)
// just hides the whole control - see populateMultiverseMenu(). "616" (no
// otherEarth field) is the default/Sacred-Timeline bucket every title
// falls into unless otherEarth says otherwise; "others" is the catch-all
// for any otherEarth.label that isn't one of the NAMED buckets below it
// (today: Your Friendly Neighborhood Spider-Man's Earth-86445 and Marvel
// Zombies' Earth-89521 - both real, confirmed Earth numbers, just not
// given a named bucket/color of their own, on request; a real number
// alone doesn't automatically earn a title one, see the two bullets right
// below) - adding another NAMED bucket later is one more entry here,
// nothing else (earthBucketId() falls through to "others" for anything
// not matched). "96283"/"120703"/"688" were each split OUT of "others"
// into their own buckets on request, in two passes - the first pass split
// out the two GENUINE Spider-Man continuities (Raimi's own trilogy,
// Garfield's own reboot duology) and deliberately left "688" (Sony's
// Spider-Man Universe - Venom/Morbius/Madame Web/Kraven, none of which
// actually feature Spider-Man himself on screen) in "others", reasoning
// that "both Spider-Man universes" meant only the two that star the
// character; the very next request asked for 688 split out too, so don't
// read its previous absence here as a rule about which Earths "deserve"
// their own bucket - by this point every currently-named foreign Earth
// with real multi-title weight has one, and "others" is back to being
// genuinely just the two confirmed-but-not-broken-out cases above.
// "outsidetime" is a different SHAPE of bucket from every other named one
// here - it doesn't correspond to a numbered alternate Earth at all, just
// to Loki, both seasons (otherEarth.label: "Outside Time" on each, not
// "Earth-XXXXX") - the TVA's whole premise places it outside the flow of
// time itself, not on any parallel reality, so there's no Earth number to
// ever give it even in principle (unlike Earth-86445 above, a real,
// confirmed numbered Earth that just isn't split out into its own
// bucket). Bucketed and filtered exactly the same way regardless -
// `earthBucketId()`/`EARTH_BUCKETS` don't care whether a label is a real
// Earth number, just that it's a distinct `otherEarth.label` string worth
// its own checkbox.
const EARTH_BUCKETS = [
  { id: "616", label: "Earth-616 (Sacred Timeline)" },
  { id: "10005", label: "Earth-10005 (X-Men)" },
  { id: "828", label: "Earth-828 (Fantastic Four)" },
  { id: "96283", label: "Earth-96283 (Spider-Man – Maguire)" },
  { id: "120703", label: "Earth-120703 (Spider-Man – Garfield)" },
  { id: "688", label: "Earth-688 (Sony's Spider-Man Universe)" },
  { id: "outsidetime", label: "Outside Time" },
  { id: "others", label: "Others" },
];

const MOVIES_STARWARS = {
  ep1: {
    id: "ep1",
    title: "Star Wars: The Phantom Menace",
    badge: "Episode I",
    year: 1999,
    runtimeMin: 133,
    type: "film",
  },
  ep2: {
    id: "ep2",
    title: "Star Wars: Attack of the Clones",
    badge: "Episode II",
    year: 2002,
    runtimeMin: 142,
    type: "film",
  },
  ep3: {
    id: "ep3",
    title: "Star Wars: Revenge of the Sith",
    badge: "Episode III",
    year: 2005,
    runtimeMin: 140,
    type: "film",
  },
  solo: {
    id: "solo",
    title: "Solo: A Star Wars Story",
    year: 2018,
    runtimeMin: 135,
    type: "film",
  },
  rogue: {
    id: "rogue",
    title: "Rogue One: A Star Wars Story",
    year: 2016,
    runtimeMin: 133,
    type: "film",
  },
  ep4: {
    id: "ep4",
    title: "Star Wars: A New Hope",
    badge: "Episode IV",
    year: 1977,
    runtimeMin: 121,
    type: "film",
  },
  ep5: {
    id: "ep5",
    title: "Star Wars: The Empire Strikes Back",
    badge: "Episode V",
    year: 1980,
    runtimeMin: 124,
    type: "film",
  },
  ep6: {
    id: "ep6",
    title: "Star Wars: Return of the Jedi",
    badge: "Episode VI",
    year: 1983,
    runtimeMin: 132,
    type: "film",
  },
  ep7: {
    id: "ep7",
    title: "Star Wars: The Force Awakens",
    badge: "Episode VII",
    year: 2015,
    runtimeMin: 138,
    type: "film",
  },
  ep8: {
    id: "ep8",
    title: "Star Wars: The Last Jedi",
    badge: "Episode VIII",
    year: 2017,
    runtimeMin: 152,
    type: "film",
  },
  ep9: {
    id: "ep9",
    title: "Star Wars: The Rise of Skywalker",
    badge: "Episode IX",
    year: 2019,
    runtimeMin: 142,
    type: "film",
  },
  // Animated (CGI, Lucasfilm Animation) - the theatrical film that
  // introduced the animated Clone Wars continuity, unlike every other
  // MOVIES_STARWARS entry (all live action). animated (badge text suffix
  // "(Animated)", buildCard() in app.js) matters now that cards no longer
  // show real poster art - see that flag's own comment in CLAUDE.md.
  clonewarsMovie: {
    id: "clonewarsMovie",
    title: "Star Wars: The Clone Wars",
    year: 2008,
    runtimeMin: 98,
    type: "film",
    animated: true,
  },
  mandoGrogu: {
    id: "mandoGrogu",
    title: "The Mandalorian and Grogu",
    year: 2026,
    runtimeMin: 132,
    type: "film",
  },
};

// animated: true (badge text suffix "(Animated)", buildSeriesCard() in
// app.js) flags a whole show as animated - matters now that cards no
// longer show real poster art, see that flag's own comment in CLAUDE.md.
// Live-action shows (kenobi, mandalorian, bobafett, andor, ahsoka,
// acolyte, skeletonCrew) carry no such flag at all, same as any other
// boolean-absent-means-false field in this file.
const SERIES_STARWARS = {
  kenobi: { id: "kenobi", title: "Star Wars: Obi-Wan Kenobi" },
  clonewars: { id: "clonewars", title: "Star Wars: The Clone Wars", animated: true },
  rebels: { id: "rebels", title: "Star Wars Rebels", animated: true },
  badbatch: { id: "badbatch", title: "Star Wars: The Bad Batch", animated: true },
  mandalorian: { id: "mandalorian", title: "The Mandalorian" },
  bobafett: { id: "bobafett", title: "The Book of Boba Fett" },
  andor: { id: "andor", title: "Andor: A Star Wars Story" },
  ahsoka: { id: "ahsoka", title: "Star Wars: Ahsoka" },
  acolyte: { id: "acolyte", title: "Star Wars: The Acolyte" },
  talesEmpire: { id: "talesEmpire", title: "Star Wars: Tales of the Empire", animated: true },
  skeletonCrew: { id: "skeletonCrew", title: "Star Wars: Skeleton Crew" },
  maul: { id: "maul", title: "Star Wars: Maul – Shadow Lord", animated: true },
  resistance: { id: "resistance", title: "Star Wars Resistance", animated: true },
  talesJedi: { id: "talesJedi", title: "Star Wars: Tales of the Jedi", animated: true },
  talesUnderworld: { id: "talesUnderworld", title: "Star Wars: Tales of the Underworld", animated: true },
  youngJedi: { id: "youngJedi", title: "Star Wars: Young Jedi Adventures", animated: true },
};

// year = the season's real premiere year (also drives "Release Order" sorting)
const SEASONS_STARWARS = {
  // Clone Wars titles episodes with plain names (no "Chapter N"-style
  // official numbering), so no episodePrefix override here - same default
  // "E" prefix as The Acolyte.
  "cw-s1": {
    id: "cw-s1",
    seriesId: "clonewars",
    number: 1,
    label: "Season 1",
    episodes: 22,
    year: 2008,
    episodeTitles: ["Ambush", "Rising Malevolence", "Shadow of Malevolence", "Destroy Malevolence", "Rookies", "Downfall of a Droid", "Duel of the Droids", "Bombad Jedi", "Cloak of Darkness", "Lair of Grievous", "Dooku Captured", "The Gungan General", "Jedi Crash", "Defenders of Peace", "Trespass", "The Hidden Enemy", "Blue Shadow Virus", "Mystery of a Thousand Moons", "Storm Over Ryloth", "Innocents of Ryloth", "Liberty on Ryloth", "Hostage Crisis"],
    episodeRuntimes: [23, 24, 23, 22, 23, 21, 22, 22, 22, 23, 23, 23, 23, 23, 22, 22, 23, 22, 24, 24, 24, 22],
  },
  "cw-s2": {
    id: "cw-s2",
    seriesId: "clonewars",
    number: 2,
    label: "S2: Rise of the Bounty Hunters",
    episodes: 22,
    year: 2009,
    episodeTitles: ["Holocron Heist", "Cargo of Doom", "Children of the Force", "Senate Spy", "Landing at Point Rain", "Weapons Factory", "Legacy of Terror", "Brain Invaders", "Grievous Intrigue", "The Deserter", "Lightsaber Lost", "The Mandalore Plot", "Voyage of Temptation", "Duchess of Mandalore", "Senate Murders", "Cat and Mouse", "Bounty Hunters", "The Zillo Beast", "The Zillo Beast Strikes Back", "Death Trap", "R2 Come Home", "Lethal Trackdown"],
    episodeRuntimes: [22, 22, 22, 22, 22, 22, 23, 22, 22, 22, 23, 22, 23, 22, 22, 22, 22, 22, 22, 22, 22, 22],
  },
  "cw-s3": {
    id: "cw-s3",
    seriesId: "clonewars",
    number: 3,
    label: "S3: Secrets Revealed",
    episodes: 22,
    year: 2010,
    episodeTitles: ["Clone Cadets", "ARC Troopers", "Supply Lines", "Sphere of Influence", "Corruption", "The Academy", "Assassin", "Evil Plans", "Hunt for Ziro", "Heroes on Both Sides", "Pursuit of Peace", "Nightsisters", "Monster", "Witches of the Mist", "Overlords", "Altar of Mortis", "Ghosts of Mortis", "The Citadel", "Counter Attack", "Citadel Rescue", "Padawan Lost", "Wookiee Hunt"],
    episodeRuntimes: [23, 21, 22, 22, 22, 22, 22, 22, 21, 22, 22, 22, 23, 22, 23, 22, 22, 22, 22, 22, 23, 22],
  },
  "cw-s4": {
    id: "cw-s4",
    seriesId: "clonewars",
    number: 4,
    label: "S4: Battle Lines",
    episodes: 22,
    year: 2011,
    episodeTitles: ["Water War", "Gungan Attack", "Prisoners", "Shadow Warrior", "Mercy Mission", "Nomad Droids", "Darkness on Umbara", "The General", "Plan of Dissent", "Carnage of Krell", "Kidnapped", "Slaves of the Republic", "Escape from Kadavo", "A Friend in Need", "Deception", "Friends and Enemies", "The Box", "Crisis on Naboo", "Massacre", "Bounty", "Brothers", "Revenge"],
    episodeRuntimes: [22, 23, 22, 22, 22, 22, 22, 23, 23, 22, 22, 21, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22],
  },
  "cw-s5": {
    id: "cw-s5",
    seriesId: "clonewars",
    number: 5,
    label: "Season 5",
    episodes: 20,
    year: 2012,
    episodeTitles: ["Revival", "A War on Two Fronts", "Front Runners", "The Soft War", "Tipping Points", "The Gathering", "A Test of Strength", "Bound for Rescue", "A Necessary Bond", "Secret Weapons", "A Sunny Day in the Void", "Missing in Action", "Point of No Return", "Eminence", "Shades of Reason", "The Lawless", "Sabotage", "The Jedi Who Knew Too Much", "To Catch a Jedi", "The Wrong Jedi"],
    episodeRuntimes: [22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22],
  },
  "cw-s6": {
    id: "cw-s6",
    seriesId: "clonewars",
    number: 6,
    label: "S6: The Lost Missions",
    episodes: 13,
    year: 2014,
    episodeTitles: ["The Unknown", "Conspiracy", "Fugitive", "Orders", "An Old Friend", "The Rise of Clovis", "Crisis at the Heart", "The Disappeared, Part I", "The Disappeared, Part II", "The Lost One", "Voices", "Destiny", "Sacrifice"],
    episodeRuntimes: [22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22],
  },
  "cw-s7": {
    id: "cw-s7",
    seriesId: "clonewars",
    number: 7,
    label: "S7: The Final Season",
    episodes: 12,
    year: 2020,
    episodeTitles: ["The Bad Batch", "A Distant Echo", "On the Wings of Keeradaks", "Unfinished Business", "Gone with a Trace", "Deal No Deal", "Dangerous Debt", "Together Again", "Old Friends Not Forgotten", "The Phantom Apprentice", "Shattered", "Victory and Death"],
    episodeRuntimes: [28, 27, 22, 27, 26, 28, 25, 27, 32, 29, 28, 25],
  },
  // Two "slices" of cw-s7 above, used ONLY by the chronological ordering
  // (Release Order keeps cw-s7 whole, matching how it actually aired) - E1
  // -E8 stay with the rest of the season, E9-E12 (the Siege of Mandalore,
  // Order 66's aftermath) move to their own spot right after Revenge of
  // the Sith, both ~19 BBY. sliceOf/episodeOffset make every episode
  // checkbox here read/write cw-s7's own watched-state directly (see
  // episodeId() in app.js) - so it's still the same one season to
  // complete, counted once, in sync everywhere it's shown. Each slice
  // gets its OWN episodeTitles slice (buildEpisodePillsHtml indexes by the
  // slice's local loop position, not the real episode number) matching
  // the corresponding chunk of cw-s7's titles above. label stays the plain
  // season name here - seasonDisplayLabel() in app.js appends each slice's
  // covered episode range ("(e01-e08)"/"(e09-e12)") wherever it's displayed,
  // derived from episodeOffset/episodes below so it can't drift from them.
  "cw-s7-early": {
    id: "cw-s7-early",
    seriesId: "clonewars",
    number: 7,
    label: "S7: The Final Season",
    episodes: 8,
    year: 2020,
    sliceOf: "cw-s7",
    episodeOffset: 0,
    episodeTitles: ["The Bad Batch", "A Distant Echo", "On the Wings of Keeradaks", "Unfinished Business", "Gone with a Trace", "Deal No Deal", "Dangerous Debt", "Together Again"],
  },
  "cw-s7-finale": {
    id: "cw-s7-finale",
    seriesId: "clonewars",
    number: 7,
    label: "S7: The Final Season",
    episodes: 4,
    year: 2020,
    sliceOf: "cw-s7",
    episodeOffset: 8,
    episodeTitles: ["Old Friends Not Forgotten", "The Phantom Apprentice", "Shattered", "Victory and Death"],
  },

  // Curated CONTENT SLICES of cw-s1..cw-s7 and tj-s1, used by the "Anakin
  // Skywalker" STORY_LINE (see STORY_LINES below, and its
  // `chapters.chronological`) - each one is the real season, but filtered
  // down to just the episodes
  // that are actually about Anakin (picked by the user; episode numbers
  // cross-checked against each season's own episodeTitles above, not
  // re-derived from memory). Unlike cw-s7-early/-finale above, the picked
  // episodes aren't one contiguous run - `episodeNumbers` (an explicit,
  // ordered list of real episode numbers) replaces episodeOffset for that:
  // realEpisodeNumber() in app.js indexes into it instead of doing offset
  // arithmetic, and seasonDisplayLabel() skips the usual "(eXX-eYY)" range
  // for the same reason - there's no single contiguous range left to
  // describe, so the label stays plain and the meta line's own bare
  // episode count (see seasonMetaLineText() in app.js) is what tells you
  // how many made the cut. episodeTitles below is still just the matching
  // subset of the real season's titles, in the same order as
  // episodeNumbers.
  //   These merge into ONE normal "Star Wars: The Clone Wars" card (one row
  // per season) exactly like a run of whole adjacent seasons would - same
  // groupEraItems() (app.js) merge-by-seriesId logic, untouched - just with
  // fewer episodes listed per row.
  //   The remaining, non-Anakin episodes of these same seasons simply
  // aren't shown when this story line is selected - it's Anakin's story
  // only, not a full-content browser. Selecting "ALL" (no story line) still
  // shows the real, whole cw-s1..cw-s7/tj-s1 seasons untouched, and either
  // view is still checkable from the other, since a slice's episodeId()
  // always resolves back to the same real season.
  "cw-s1-anakin": {
    id: "cw-s1-anakin",
    seriesId: "clonewars",
    number: 1,
    label: "Season 1",
    episodes: 12,
    year: 2008,
    sliceOf: "cw-s1",
    episodeNumbers: [2, 3, 4, 6, 7, 13, 14, 17, 18, 19, 20, 21],
    episodeTitles: [
      "Rising Malevolence",
      "Shadow of Malevolence",
      "Destroy Malevolence",
      "Downfall of a Droid",
      "Duel of the Droids",
      "Jedi Crash",
      "Defenders of Peace",
      "Blue Shadow Virus",
      "Mystery of a Thousand Moons",
      "Storm Over Ryloth",
      "Innocents of Ryloth",
      "Liberty on Ryloth",
    ],
  },
  "cw-s2-anakin": {
    id: "cw-s2-anakin",
    seriesId: "clonewars",
    number: 2,
    label: "S2: Rise of the Bounty Hunters",
    episodes: 16,
    year: 2009,
    sliceOf: "cw-s2",
    episodeNumbers: [1, 2, 3, 5, 6, 7, 8, 11, 12, 13, 14, 18, 19, 20, 21, 22],
    episodeTitles: [
      "Holocron Heist",
      "Cargo of Doom",
      "Children of the Force",
      "Landing at Point Rain",
      "Weapons Factory",
      "Legacy of Terror",
      "Brain Invaders",
      "Lightsaber Lost",
      "The Mandalore Plot",
      "Voyage of Temptation",
      "Duchess of Mandalore",
      "The Zillo Beast",
      "The Zillo Beast Strikes Back",
      "Death Trap",
      "R2 Come Home",
      "Lethal Trackdown",
    ],
  },
  // Includes the Mortis trilogy (E15-E17) - widely considered the single
  // most important arc for Anakin's whole character arc (the Chosen One
  // prophecy, the Father/Son/Daughter as literal embodiments of the
  // Force's two sides) - the user flagged this one explicitly as an
  // "absolute must-watch".
  "cw-s3-anakin": {
    id: "cw-s3-anakin",
    seriesId: "clonewars",
    number: 3,
    label: "S3: Secrets Revealed",
    episodes: 10,
    year: 2010,
    sliceOf: "cw-s3",
    episodeNumbers: [1, 2, 10, 11, 15, 16, 17, 18, 19, 20],
    episodeTitles: [
      "Clone Cadets",
      "ARC Troopers",
      "Heroes on Both Sides",
      "Pursuit of Peace",
      "Overlords",
      "Altar of Mortis",
      "Ghosts of Mortis",
      "The Citadel",
      "Counter Attack",
      "Citadel Rescue",
    ],
  },
  "cw-s4-anakin": {
    id: "cw-s4-anakin",
    seriesId: "clonewars",
    number: 4,
    label: "S4: Battle Lines",
    episodes: 11,
    year: 2011,
    sliceOf: "cw-s4",
    episodeNumbers: [1, 2, 3, 4, 11, 12, 13, 15, 16, 17, 18],
    episodeTitles: [
      "Water War",
      "Gungan Attack",
      "Prisoners",
      "Shadow Warrior",
      "Kidnapped",
      "Slaves of the Republic",
      "Escape from Kadavo",
      "Deception",
      "Friends and Enemies",
      "The Box",
      "Crisis on Naboo",
    ],
  },
  // Includes Ahsoka's frame-up/trial arc (E17-E20) - the user flagged this
  // one explicitly too as an "absolute must-watch": it defines Anakin and
  // Ahsoka's bond going into the back half of the war, and her subsequent
  // (temporary) departure from the Jedi Order.
  "cw-s5-anakin": {
    id: "cw-s5-anakin",
    seriesId: "clonewars",
    number: 5,
    label: "Season 5",
    episodes: 8,
    year: 2012,
    sliceOf: "cw-s5",
    episodeNumbers: [2, 3, 4, 5, 17, 18, 19, 20],
    episodeTitles: [
      "A War on Two Fronts",
      "Front Runners",
      "The Soft War",
      "Tipping Points",
      "Sabotage",
      "The Jedi Who Knew Too Much",
      "To Catch a Jedi",
      "The Wrong Jedi",
    ],
  },
  "cw-s6-anakin": {
    id: "cw-s6-anakin",
    seriesId: "clonewars",
    number: 6,
    label: "S6: The Lost Missions",
    episodes: 8,
    year: 2014,
    sliceOf: "cw-s6",
    episodeNumbers: [1, 2, 3, 4, 10, 11, 12, 13],
    episodeTitles: ["The Unknown", "Conspiracy", "Fugitive", "Orders", "The Lost One", "Voices", "Destiny", "Sacrifice"],
  },
  // Just the Bad Batch arc (E1-E4) - used by the "Anakin Skywalker"
  // STORY_LINE (see its own comment below) to replace cw-s7-early wherever
  // that appears, sitting at that same pre-Revenge-of-the-Sith position.
  // The rest of the season (E9-E12, the Siege of Mandalore) plays out
  // during/after the film - see cw-s7-siege below, which replaces
  // cw-s7-finale at ITS own post-film position instead.
  "cw-s7-anakin": {
    id: "cw-s7-anakin",
    seriesId: "clonewars",
    number: 7,
    label: "S7: The Final Season",
    episodes: 4,
    year: 2020,
    sliceOf: "cw-s7",
    episodeNumbers: [1, 2, 3, 4],
    episodeTitles: ["The Bad Batch", "A Distant Echo", "On the Wings of Keeradaks", "Unfinished Business"],
  },
  // The Siege of Mandalore (E9-E12) - Anakin's last scene with Ahsoka and
  // handing over her division (E9) before he leaves to rescue the
  // Chancellor, through Ahsoka vs. Maul and Order 66 hitting the 501st
  // (E10-E12). Used directly by the "Anakin Skywalker" STORY_LINE's own
  // `chapters.chronological` (see STORY_LINES below) - its "Fall" chapter.
  "cw-s7-siege": {
    id: "cw-s7-siege",
    seriesId: "clonewars",
    number: 7,
    label: "S7: The Final Season",
    episodes: 4,
    year: 2020,
    sliceOf: "cw-s7",
    episodeNumbers: [9, 10, 11, 12],
    episodeTitles: ["Old Friends Not Forgotten", "The Phantom Apprentice", "Shattered", "Victory and Death"],
  },
  // Dooku's turn to the dark side - the one Anakin-relevant episode of
  // tj-s1-early's E1-4 (the rest, E1-3, are Qui-Gon/Dooku shorts with no
  // Anakin in them at all). Used by the "Anakin Skywalker" STORY_LINE (see
  // its own comment below) to replace tj-s1-early wherever that appears -
  // sits at that exact same chronological position (right after The
  // Phantom Menace).
  "tj-s1-e4": {
    id: "tj-s1-e4",
    seriesId: "talesJedi",
    number: 1,
    label: "Season 1",
    episodes: 1,
    year: 2022,
    sliceOf: "tj-s1",
    episodeNumbers: [4],
    episodeTitles: ["The Sith Lord"],
  },
  // Ahsoka processing Order 66 and Anakin's fall through her own training
  // flashbacks - the one episode of tj-s1-late's E5-E6 the "Anakin
  // Skywalker" STORY_LINE keeps; E6 ("Resolve") is Ahsoka meeting Bail
  // Organa with no Anakin presence at all, and is dropped from that story
  // line entirely rather than getting a slice of its own.
  "tj-s1-e5": {
    id: "tj-s1-e5",
    seriesId: "talesJedi",
    number: 1,
    label: "Season 1",
    episodes: 1,
    year: 2022,
    sliceOf: "tj-s1",
    episodeNumbers: [5],
    episodeTitles: ["Practice Makes Perfect"],
  },
  // Vader hunting the Rebellion, years after Anakin died: the Siege of
  // Lothal (E1-E2) shows him at the height of his power against the
  // Ghost crew, Twilight of the Apprentice (E21-E22) is the emotional
  // peak - his final duel with his former Padawan, Ahsoka. Used by the
  // "Anakin Skywalker" STORY_LINE to replace rb-s2 wherever that appears -
  // rb-s2's own full episodeTitles are on its own whole-season entry,
  // further down (see the "Rebels titles" comment just below).
  "rb-s2-anakin": {
    id: "rb-s2-anakin",
    seriesId: "rebels",
    number: 2,
    label: "Season 2",
    episodes: 4,
    year: 2015,
    sliceOf: "rb-s2",
    episodeNumbers: [1, 2, 21, 22],
    episodeTitles: ["The Siege of Lothal", "The Siege of Lothal, Part 2", "Twilight of the Apprentice", "Twilight of the Apprentice, Part 2"],
  },
  // Anakin returns - as a Force spirit, testing Ahsoka in a vision of their
  // shared past aboard the very cruiser the Clone Wars began on. Used by
  // the "Anakin Skywalker" STORY_LINE to replace ah-s1 wherever that
  // appears. episodePrefix carries over from ah-s1 below ("Part N", not
  // the default "E") so the pills read "Part 4"/"Part 5" here too,
  // matching the show's own episode titling.
  "ah-s1-anakin": {
    id: "ah-s1-anakin",
    seriesId: "ahsoka",
    number: 1,
    label: "Season 1",
    episodes: 2,
    year: 2023,
    sliceOf: "ah-s1",
    episodeNumbers: [4, 5],
    episodePrefix: "Part ",
    episodeTitles: ["Fallen Jedi", "Shadow Warrior"],
  },

  // Curated CONTENT SLICES of cw-s4/cw-s5/rb-s2/rb-s3, used by the "Maul"
  // STORY_LINE (see STORY_LINES below, and its `chapters.chronological`) -
  // same pattern as the Anakin slices above (episode numbers cross-checked
  // against each season's own episodeTitles, not re-derived from memory).
  // Maul's Chronological chapters also reuse cw-s7-siege above directly
  // (the Siege of Mandalore, E9-12) - he's as central to that arc as
  // Anakin/Ahsoka are, so it needs no Maul-specific slice of its own.
  "cw-s4-maul": {
    id: "cw-s4-maul",
    seriesId: "clonewars",
    number: 4,
    label: "S4: Battle Lines",
    episodes: 2,
    year: 2011,
    sliceOf: "cw-s4",
    episodeNumbers: [21, 22],
    episodeTitles: ["Brothers", "Revenge"],
  },
  // Non-contiguous, like the Anakin slices above: "Revival" (E1) is the
  // direct continuation of cw-s4-maul's finale, "Eminence"/"Shades of
  // Reason"/"The Lawless" (E14-16, the Shadow Collective's takeover of
  // Mandalore) come much later in the same season, after 12 unrelated
  // episodes - but both land in the same STORY_LINE chapter ("Crimelord"),
  // so one slice covers all four rather than splitting them in two.
  "cw-s5-maul": {
    id: "cw-s5-maul",
    seriesId: "clonewars",
    number: 5,
    label: "Season 5",
    episodes: 4,
    year: 2012,
    sliceOf: "cw-s5",
    episodeNumbers: [1, 14, 15, 16],
    episodeTitles: ["Revival", "Eminence", "Shades of Reason", "The Lawless"],
  },
  // Malachor - Maul lures in Kanan and Ezra as his "Old Master" alter ego
  // while, on the same episode's other thread, Ahsoka confronts Vader (see
  // rb-s2-anakin above - both slices cover the exact same two episodes,
  // from each character's own side of it).
  "rb-s2-maul": {
    id: "rb-s2-maul",
    seriesId: "rebels",
    number: 2,
    label: "Season 2",
    episodes: 2,
    year: 2015,
    sliceOf: "rb-s2",
    episodeNumbers: [21, 22],
    episodeTitles: ["Twilight of the Apprentice", "Twilight of the Apprentice, Part 2"],
  },
  // Maul's last arc - manipulating Ezra with visions of his lost family
  // (E3, E11), through his final duel with Obi-Wan on Tatooine and death
  // (E20, "Twin Suns").
  "rb-s3-maul": {
    id: "rb-s3-maul",
    seriesId: "rebels",
    number: 3,
    label: "Season 3",
    episodes: 3,
    year: 2016,
    sliceOf: "rb-s3",
    episodeNumbers: [3, 11, 20],
    episodeTitles: ["The Holocrons of Fate", "Visions and Voices", "Twin Suns"],
  },

  // Rebels titles plain episode names, no official numbering convention -
  // default "E" prefix, same as Clone Wars. Several two-part episodes
  // aired as one-hour specials sharing one title - the second half is
  // suffixed "Part 2"/"Part I"/"Part II" per how each season's official
  // titling actually differs (S1-S3 append a bare "Part 2", S4 spells
  // "Part 1"/"Part 2" into both halves) - not normalized, matches source.
  "rb-s1": {
    id: "rb-s1",
    seriesId: "rebels",
    number: 1,
    label: "Season 1",
    episodes: 15,
    year: 2014,
    episodeTitles: ["Spark of Rebellion", "Spark of Rebellion, Part 2", "Droids in Distress", "Fighter Flight", "Rise of the Old Masters", "Breaking Ranks", "Out of Darkness", "Empire Day", "Gathering Forces", "Path of the Jedi", "Idiot's Array", "Vision of Hope", "Call to Action", "Rebel Resolve", "Fire Across the Galaxy"],
    // "Spark of Rebellion" aired as one 44-minute TV movie (both halves at
    // once) - split evenly across its two episode entries here, same
    // treatment as every other two-parter that aired combined below.
    episodeRuntimes: [22, 22, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24],
  },
  "rb-s2": {
    id: "rb-s2",
    seriesId: "rebels",
    number: 2,
    label: "Season 2",
    episodes: 22,
    year: 2015,
    episodeTitles: ["The Siege of Lothal", "The Siege of Lothal, Part 2", "The Lost Commanders", "Relics of the Old Republic", "Always Two There Are", "Brothers of the Broken Horn", "Wings of the Master", "Blood Sisters", "Stealth Strike", "The Future of the Force", "Legacy", "A Princess on Lothal", "The Protector of Concord Dawn", "Legends of the Lasat", "The Call", "Homecoming", "The Honorable Ones", "Shroud of Darkness", "The Forgotten Droid", "The Mystery of Chopper Base", "Twilight of the Apprentice", "Twilight of the Apprentice, Part 2"],
    // Both two-parters (the premiere AND the finale) aired combined as one
    // TV movie each - split evenly across their two episode entries here.
    episodeRuntimes: [23, 23, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 22, 22],
  },
  "rb-s3": {
    id: "rb-s3",
    seriesId: "rebels",
    number: 3,
    label: "Season 3",
    episodes: 22,
    year: 2016,
    episodeTitles: ["Steps Into Shadow", "Steps Into Shadow, Part 2", "The Holocrons of Fate", "The Antilles Extraction", "Hera's Heroes", "The Last Battle", "Imperial Supercommandos", "Iron Squadron", "The Wynkahthu Job", "An Inside Man", "Visions and Voices", "Ghosts of Geonosis", "Ghosts of Geonosis, Part 2", "Warhead", "Trials of the Darksaber", "Legacy of Mandalore", "Through Imperial Eyes", "Secret Cargo", "Double Agent Droid", "Twin Suns", "Zero Hour", "Zero Hour, Part 2"],
    // Only the premiere ("Steps Into Shadow") aired combined as one TV
    // movie - split evenly. "Ghosts of Geonosis" and "Zero Hour" aired as
    // two separate, individually-timed episodes despite the shared title.
    episodeRuntimes: [22, 22, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24],
  },
  "rb-s4": {
    id: "rb-s4",
    seriesId: "rebels",
    number: 4,
    label: "Season 4",
    episodes: 16,
    year: 2017,
    episodeTitles: ["Heroes of Mandalore, Part 1", "Heroes of Mandalore, Part 2", "In the Name of the Rebellion, Part 1", "In the Name of the Rebellion, Part 2", "The Occupation", "Flight of the Defender", "Kindred", "Crawler Commandeers", "Rebel Assault", "Jedi Night", "DUME", "Wolves and a Door", "A World Between Worlds", "A Fool's Hope", "Family Reunion – and Farewell, Part 1", "Family Reunion – and Farewell, Part 2"],
    episodeRuntimes: [24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24],
  },

  "bb-s1": {
    id: "bb-s1",
    seriesId: "badbatch",
    number: 1,
    label: "Season 1",
    episodes: 16,
    year: 2021,
    episodeTitles: ["Aftermath", "Cut and Run", "Replacements", "Cornered", "Rampage", "Decommissioned", "Battle Scars", "Reunion", "Bounty Lost", "Common Ground", "Devil's Deal", "Rescue on Ryloth", "Infested", "War-Mantle", "Return to Kamino", "Kamino Lost"],
    episodeRuntimes: [76, 32, 30, 27, 27, 26, 29, 28, 29, 30, 30, 30, 30, 30, 28, 30],
  },
  "bb-s2": {
    id: "bb-s2",
    seriesId: "badbatch",
    number: 2,
    label: "Season 2",
    episodes: 16,
    year: 2023,
    episodeTitles: ["Spoils of War", "Ruins of War", "The Solitary Clone", "Faster", "Entombed", "Tribe", "The Clone Conspiracy", "Truth and Consequences", "The Crossing", "Retrieval", "Metamorphosis", "The Outpost", "Pabu", "Tipping Point", "The Summit", "Plan 99"],
    episodeRuntimes: [24, 28, 30, 26, 29, 28, 29, 31, 30, 29, 30, 32, 29, 30, 28, 29],
  },
  "bb-s3": {
    id: "bb-s3",
    seriesId: "badbatch",
    number: 3,
    label: "Season 3",
    episodes: 15,
    year: 2024,
    episodeTitles: ["Confined", "Paths Unknown", "Shadows of Tantiss", "A Different Approach", "The Return", "Infiltration", "Extraction", "Bad Territory", "The Harbinger", "Identity Crisis", "Point of No Return", "Juggernaut", "Into the Breach", "Flash Strike", "The Cavalry Has Arrived"],
    episodeRuntimes: [33, 27, 27, 28, 27, 28, 25, 28, 27, 25, 24, 23, 26, 24, 51],
  },

  // Maul - Shadow Lord officially numbers/titles episodes as "Chapter N",
  // same episodePrefix override pattern as Mandalorian/Boba Fett above.
  //   Unreleased (2026) - no per-episode runtimes exist anywhere yet to
  // verify, unlike every other show's episodeRuntimes above. totalRuntimeMin
  // (9h7min, per the user) is a season-level total instead - see
  // seasonTotalRuntimeMin() in app.js: it's only usable for a card showing
  // the WHOLE season, since there's no real per-episode split to sum a
  // partial slice from. Replace with a real episodeRuntimes array (and
  // drop this field) once the season actually airs and episode-by-episode
  // lengths are known.
  "maul-s1": {
    id: "maul-s1",
    seriesId: "maul",
    number: 1,
    label: "Season 1",
    episodes: 10,
    year: 2026,
    totalRuntimeMin: 547,
    episodePrefix: "Chapter ",
    episodeTitles: ["The Dark Revenge", "Sinister Schemes", "Whispers in the Unknown", "Pride and Vengeance", "Inquisition", "Night of the Hunted", "Call to the Oblivion", "The Creeping Fear", "Strange Allies", "Finale"],
  },

  "te-s1": {
    id: "te-s1",
    seriesId: "talesEmpire",
    number: 1,
    label: "Season 1",
    episodes: 6,
    year: 2024,
    episodeTitles: ["The Path of Fear", "The Path of Anger", "The Path of Hate", "Devoted", "Realization", "The Way Out"],
    episodeRuntimes: [17, 15, 14, 17, 13, 17],
  },

  "an-s1": {
    id: "an-s1",
    seriesId: "andor",
    number: 1,
    label: "Season 1",
    episodes: 12,
    year: 2022,
    episodeTitles: ["Kassa", "That Would Be Me", "Reckoning", "Aldhani", "The Axe Forgets", "The Eye", "Announcement", "Narkina 5", "Nobody's Listening!", "One Way Out", "Daughter of Ferrix", "Rix Road"],
    episodeRuntimes: [42, 38, 43, 50, 46, 54, 53, 57, 50, 46, 46, 57],
  },
  "an-s2": {
    id: "an-s2",
    seriesId: "andor",
    number: 2,
    label: "Season 2",
    episodes: 12,
    year: 2025,
    episodeTitles: ["One Year Later", "Sagrona Teema", "Harvest", "Ever Been to Ghorman?", "I Have Friends Everywhere", "What a Festive Evening", "Messenger", "Who Are You?", "Welcome to the Rebellion", "Make It Stop", "Who Else Knows?", "Jedha, Kyber, Erso"],
    episodeRuntimes: [54, 47, 56, 57, 57, 58, 46, 50, 60, 51, 45, 49],
  },

  // S2 left out, doesn't exist yet (only announced, no confirmed episode
  // count). Ahsoka officially titles episodes "Part One: ...", "Part Two: ..." etc
  // (spelled-out ordinals, not numerals) - same episodePrefix override
  // pattern as Mandalorian below, just rendered with a numeral ("Part 1:")
  // since the pill renderer only knows how to append numbers.
  "ah-s1": {
    id: "ah-s1",
    seriesId: "ahsoka",
    number: 1,
    label: "Season 1",
    episodes: 8,
    year: 2023,
    episodePrefix: "Part ",
    episodeTitles: ["Master and Apprentice", "Toil and Trouble", "Time to Fly", "Fallen Jedi", "Shadow Warrior", "Far, Far Away", "Dreams and Madness", "The Jedi, the Witch, and the Warlord"],
    episodeRuntimes: [57, 44, 37, 41, 52, 49, 46, 49],
  },

  // The Mandalorian officially numbers/titles episodes as "Chapter N",
  // counting straight through across seasons instead of resetting each
  // season (S2 starts at Chapter 9, S3 at Chapter 17) - episodePrefix
  // overrides the usual "EN:" pills with that, episodeOffset carries the
  // running chapter count the same way it would for a sliced season.
  "md-s1": {
    id: "md-s1",
    seriesId: "mandalorian",
    number: 1,
    label: "Season 1",
    episodes: 8,
    year: 2019,
    episodePrefix: "Chapter ",
    episodeTitles: ["The Mandalorian", "The Child", "The Sin", "Sanctuary", "The Gunslinger", "The Prisoner", "The Reckoning", "Redemption"],
    episodeRuntimes: [41, 34, 39, 43, 37, 45, 42, 50],
  },
  "md-s2": {
    id: "md-s2",
    seriesId: "mandalorian",
    number: 2,
    label: "Season 2",
    episodes: 8,
    year: 2020,
    episodeOffset: 8,
    episodePrefix: "Chapter ",
    episodeTitles: ["The Marshal", "The Passenger", "The Heiress", "The Siege", "The Jedi", "The Tragedy", "The Believer", "The Rescue"],
    episodeRuntimes: [56, 43, 37, 41, 48, 35, 40, 48],
  },
  "md-s3": {
    id: "md-s3",
    seriesId: "mandalorian",
    number: 3,
    label: "Season 3",
    episodes: 8,
    year: 2023,
    episodeOffset: 16,
    episodePrefix: "Chapter ",
    episodeTitles: ["The Apostate", "The Mines of Mandalore", "The Convert", "The Foundling", "The Pirate", "Guns for Hire", "The Spies", "The Return"],
    episodeRuntimes: [38, 45, 59, 33, 44, 47, 54, 42],
  },

  // The Book of Boba Fett officially numbers/titles episodes as "Chapter N"
  // too, same as The Mandalorian above (production even referred to it
  // internally as Mandalorian S3) - same episodePrefix override.
  "bf-s1": {
    id: "bf-s1",
    seriesId: "bobafett",
    number: 1,
    label: "Season 1",
    episodes: 7,
    year: 2021,
    episodePrefix: "Chapter ",
    episodeTitles: ["Stranger in a Strange Land", "The Tribes of Tatooine", "The Streets of Mos Espa", "The Gathering Storm", "Return of the Mandalorian", "From the Desert Comes a Stranger", "In the Name of Honor"],
    episodeRuntimes: [40, 54, 40, 50, 53, 48, 62],
  },

  "ac-s1": {
    id: "ac-s1",
    seriesId: "acolyte",
    number: 1,
    label: "Season 1",
    episodes: 8,
    year: 2024,
    // curated per-episode titles - see episodeTitles in app.js for how
    // these become "E1: Lost / Found" etc. on the episode pills. Most
    // shows don't have this (SEASONS only tracks a plain episode count
    // for them), which falls back to plain "Episode N" pills instead.
    episodeTitles: ["Lost / Found", "Revenge / Justice", "Destiny", "Day", "Night", "Teach / Corrupt", "Choice", "The Acolyte"],
    episodeRuntimes: [43, 39, 45, 35, 35, 39, 44, 49],
  },

  // Skeleton Crew, unlike Mandalorian/Boba Fett/Ahsoka above, does NOT
  // officially number episodes as "Chapter N" - just plain titles - so no
  // episodePrefix override, same as The Acolyte.
  "sc-s1": {
    id: "sc-s1",
    seriesId: "skeletonCrew",
    number: 1,
    label: "Season 1",
    episodes: 8,
    year: 2024,
    episodeTitles: ["This Could Be a Real Adventure", "Way, Way Out Past the Barrier", "Very Interesting, As an Astrogation Problem", "Can't Say I Remember No At Attin", "You Have a Lot to Learn About Pirates", "Zero Friends Again", "We're Gonna Be in So Much Trouble", "The Real Good Guys"],
    episodeRuntimes: [49, 32, 40, 39, 46, 34, 37, 39],
  },

  // Obi-Wan Kenobi's formal episode titles ARE just the ordinal ("Part
  // I".."Part VI") - no separate subtitle exists, unlike every other
  // curated show here. episodeTitlesAreSelfNumbered suppresses the usual
  // added "EN:" prefix (see buildEpisodePillsHtml in app.js) since "Part
  // I" already states its own position - printing "E1: Part I" would be
  // redundant, and the prefix+arabic-numeral mechanism can't produce the
  // official roman numeral anyway.
  "kenobi-s1": {
    id: "kenobi-s1",
    seriesId: "kenobi",
    number: 1,
    label: "Season 1",
    episodes: 6,
    year: 2022,
    episodeTitles: ["Part I", "Part II", "Part III", "Part IV", "Part V", "Part VI"],
    episodeTitlesAreSelfNumbered: true,
    episodeRuntimes: [56, 42, 48, 39, 43, 52],
  },

  // "The Recruit" is a two-part pilot (E1-E2) and "No Escape" a two-part
  // finale (E20-E21), both officially counted as separate episodes - 21
  // total, matching the season's real broadcast numbering.
  "res-s1": {
    id: "res-s1",
    seriesId: "resistance",
    number: 1,
    label: "Season 1",
    episodes: 21,
    year: 2018,
    episodeTitles: ["The Recruit: Part 1", "The Recruit: Part 2", "The Triple Dark", "Fuel for the Fire", "The High Tower", "The Children from Tehar", "Signal from Sector Six", "Synara's Score", "The Platform Classic", "Secrets and Holograms", "Station Theta Black", "Bibo", "Dangerous Business", "The Doza Dilemma", "The First Order Occupation", "The New Trooper", "The Core Problem", "The Disappeared", "Descent", "No Escape: Part 1", "No Escape: Part 2"],
    // "The Recruit" aired as one 44-minute TV movie (both halves at once) -
    // split evenly across its two episode entries here.
    episodeRuntimes: [22, 22, 25, 25, 25, 25, 25, 25, 25, 25, 24, 25, 24, 25, 24, 22, 24, 25, 25, 25, 25],
  },
  // episodes was wrong here (17, missing the two-part finale below) -
  // corrected to the real broadcast count of 19 per user confirmation.
  "res-s2": {
    id: "res-s2",
    seriesId: "resistance",
    number: 2,
    label: "Season 2",
    episodes: 19,
    year: 2019,
    episodeTitles: ["Into the Unknown", "A Quick Salvage Run", "Live Fire", "Hunt on Celsor 3", "The Engineer", "From Beneath", "The Relic Raiders", "Rendezvous Point", "The Voxx Vortex 5000", "Kaz's Curse", "Station to Station", "The Missing Agent", "Breakout", "The Mutiny", "The New World", "No Place Safe", "Rebuilding the Resistance", "The Escape: Part 1", "The Escape: Part 2"],
    // "The Escape" aired as one 44-minute TV movie (both halves at once) -
    // split evenly across its two episode entries here.
    episodeRuntimes: [26, 26, 26, 26, 26, 25, 25, 26, 26, 26, 26, 25, 26, 26, 26, 26, 26, 22, 22],
  },
  // Same split treatment as Clone Wars S7 above - used ONLY by the
  // chronological ordering (Release Order keeps res-s1 whole). E1-E19
  // stay before Episode VII/VIII, E20-E21 (the Starkiller Base aftermath,
  // leading straight into Episode VIII's fallout) move to their own spot
  // right after it instead. Each slice gets its own subset of res-s1's
  // episodeTitles above, same pattern as cw-s7-early/-finale - and the
  // same plain label + auto-appended episode range (see
  // seasonDisplayLabel() in app.js).
  "res-s1-early": {
    id: "res-s1-early",
    seriesId: "resistance",
    number: 1,
    label: "Season 1",
    episodes: 19,
    year: 2018,
    sliceOf: "res-s1",
    episodeOffset: 0,
    episodeTitles: ["The Recruit: Part 1", "The Recruit: Part 2", "The Triple Dark", "Fuel for the Fire", "The High Tower", "The Children from Tehar", "Signal from Sector Six", "Synara's Score", "The Platform Classic", "Secrets and Holograms", "Station Theta Black", "Bibo", "Dangerous Business", "The Doza Dilemma", "The First Order Occupation", "The New Trooper", "The Core Problem", "The Disappeared", "Descent"],
  },
  "res-s1-finale": {
    id: "res-s1-finale",
    seriesId: "resistance",
    number: 1,
    label: "Season 1",
    episodes: 2,
    year: 2018,
    sliceOf: "res-s1",
    episodeOffset: 19,
    episodeTitles: ["No Escape: Part 1", "No Escape: Part 2"],
  },

  "tj-s1": {
    id: "tj-s1",
    seriesId: "talesJedi",
    number: 1,
    label: "Season 1",
    episodes: 6,
    year: 2022,
    episodeTitles: ["Life and Death", "Justice", "Choices", "The Sith Lord", "Practice Makes Perfect", "Resolve"],
    episodeRuntimes: [19, 16, 16, 18, 13, 17],
  },
  // Same split treatment as Clone Wars S7 / Resistance S1 above - used
  // ONLY by the chronological ordering (Release Order keeps tj-s1 whole).
  // E1-E4 (the Dooku shorts, cca 36-22 BBY) sit right after The Phantom
  // Menace; E5-E6 (the Ahsoka shorts, 19 - cca 18 BBY) are chronologically
  // much later and move to their own spot right after The Bad Batch. Each
  // slice gets its own subset of tj-s1's episodeTitles above (see cw-s7-
  // early/-finale for why - buildEpisodePillsHtml indexes by the slice's
  // own local loop position, not the real episode number) - and the same
  // plain label + auto-appended episode range (see seasonDisplayLabel() in
  // app.js).
  "tj-s1-early": {
    id: "tj-s1-early",
    seriesId: "talesJedi",
    number: 1,
    label: "Season 1",
    episodes: 4,
    year: 2022,
    sliceOf: "tj-s1",
    episodeOffset: 0,
    episodeTitles: ["Life and Death", "Justice", "Choices", "The Sith Lord"],
  },
  "tj-s1-late": {
    id: "tj-s1-late",
    seriesId: "talesJedi",
    number: 1,
    label: "Season 1",
    episodes: 2,
    year: 2022,
    sliceOf: "tj-s1",
    episodeOffset: 4,
    episodeTitles: ["Practice Makes Perfect", "Resolve"],
  },

  "tu-s1": {
    id: "tu-s1",
    seriesId: "talesUnderworld",
    number: 1,
    label: "Season 1",
    episodes: 6,
    year: 2025,
    episodeTitles: ["A Way Forward", "Friends", "One Warrior to Another", "The Good Life", "A Good Turn", "One Good Deed"],
    episodeRuntimes: [17, 16, 18, 16, 14, 17],
  },

  "yj-s1": { id: "yj-s1", seriesId: "youngJedi", number: 1, label: "Season 1", episodes: 25, year: 2023 },
  "yj-s2": { id: "yj-s2", seriesId: "youngJedi", number: 2, label: "Season 2", episodes: 23, year: 2024 },
  "yj-s3": { id: "yj-s3", seriesId: "youngJedi", number: 3, label: "Season 3", episodes: 7, year: 2025 },
};

const ORDERINGS_STARWARS = [
  {
    id: "chronological",
    label: "Chronological",
    description: "Ideal if you're already familiar with the main storyline and want to experience every event in exact chronological sequence.",
    // Eras are taken from the user's own original in-universe reference
    // sheet (no longer kept in this repo) - see the comment above ORDERINGS
    // for the couple of deliberate departures from it (Young Jedi Adventures
    // dropped, Maul / Tales of the Underworld kept and slotted in by their
    // known setting since the sheet doesn't cover them, Ahsoka added since
    // the sheet lists it but no data for it existed yet). Item ORDER within
    // an era is sorted by each title's own earliest in-story year - "as it
    // actually happened" - not by the sheet's row order, which occasionally
    // reflects a recommended watch order instead (Tales of the Jedi and
    // Tales of the Empire are the two titles where this makes a visible
    // difference, see the notes on era "pt" and "an" below).
    //
    // yearBands: the small in-universe year strip drawn above each era's
    // cards (see drawYearBands in app.js). One entry per group of
    // consecutive rendered cards that share (roughly) the same in-story
    // year - `span` says how many cards-in-a-row that label covers, and
    // all the spans in one era must add up to that era's total card count
    // post-merge (movies + merged series groups). Deliberately coarse, not
    // a precise per-title reading - see the CSV for exact figures.
    // `milestone` marks the single point the axis calls out: year 0, the
    // Battle of Yavin (A New Hope).
    //
    // gapBefore: eras separated from the previous one by a big in-universe
    // jump get pulled further away on the axis so the empty stretch of
    // time actually reads as empty (see .era-block--gap-before in css).
    eras: [
      {
        id: "hr",
        label: "The High Republic",
        description: "The Republic thrives under the Jedi's watch - until a hidden threat the Order never sees coming.",
        itemIds: ["ac-s1"],
        yearBands: [{ label: "cca 132 BBY", span: 1 }],
      },
      {
        id: "pt",
        label: "Fall of the Jedi",
        description: "A Sith lord's scheme ignites a galaxy-wide war that will bring the Jedi to ruin.",
        // ~100 years pass between the High Republic and here
        gapBefore: true,
        // Tales of the Jedi's E1-E4 (the Dooku shorts) sit right after The
        // Phantom Menace - see the tj-s1-early/-late split in SEASONS
        // above; E5-E6 (the Ahsoka shorts) are much later and move to
        // their own spot after The Bad Batch instead, in "Reign of the
        // Empire" below. The Clone Wars (movie + seasons 1-6, plus S7's
        // first 8 episodes) takes place between Episode II and III, and
        // nothing else falls chronologically between them, so they merge
        // into one poster. S7's last 4 episodes are their own card AFTER
        // Revenge of the Sith instead - see the cw-s7-early / cw-s7-finale
        // split in SEASONS above - since they play out during/after Order
        // 66, not before it.
        itemIds: ["ep1", "tj-s1-early", "ep2", "clonewarsMovie", "cw-s1", "cw-s2", "cw-s3", "cw-s4", "cw-s5", "cw-s6", "cw-s7-early", "ep3", "cw-s7-finale"],
        yearBands: [
          { label: "32 BBY", span: 1 },
          { label: "cca 36–22 BBY", span: 1 },
          { label: "22 BBY", span: 2 },
          { label: "22–19 BBY", span: 1 },
          { label: "19 BBY", span: 2 },
        ],
      },
      {
        id: "an",
        label: "Reign of the Empire",
        description: "The Empire rules unchallenged while the last Jedi hide in the shadows.",
        // Again sorted by earliest in-story year, not the reference sheet's
        // watch-order row sequence: Tales of the Underworld opens the era
        // (per starwars.com), Tales of the Empire's earliest shorts land
        // right alongside it (its own episodes actually stretch all the way
        // to the New Republic era, but this is the one card it gets), Bad
        // Batch follows right on Order 66's heels (S1-3 together, nothing
        // between them), Tales of the Jedi's E5-E6 (the Ahsoka shorts) right after that -
        // see the tj-s1-early/-late split in SEASONS above - Maul roams
        // the underworld shortly after, Kenobi ~9 years before Rogue One.
        //   Andor and Rebels interleave rather than each running as one
        // block (Andor S1, Rebels S1-3, Andor S2, Rebels S4, Rogue One) -
        // both shows' own seasons span multiple years apiece (Andor S1:
        // 5-4 BBY, S2: 4-1 BBY; Rebels: 5-1 BBY end to end), so a strict
        // "earliest year" sort interleaves them this way rather than
        // grouping each show's seasons together the way Bad Batch's do.
        // Andor S1 and Rebels S1-3 no longer sit adjacent to their own
        // other season, so they render as smaller/separate cards here
        // instead of merging into one big per-show card (see
        // groupEraItems() in app.js).
        itemIds: ["tu-s1", "te-s1", "bb-s1", "bb-s2", "bb-s3", "tj-s1-late", "maul-s1", "solo", "kenobi-s1", "an-s1", "rb-s1", "rb-s2", "rb-s3", "an-s2", "rb-s4", "rogue"],
        yearBands: [
          { label: "cca 19 BBY", span: 1 },
          { label: "cca 19 – 0 BBY", span: 1 },
          { label: "19 – cca 17 BBY", span: 1 },
          { label: "19 – cca 18 BBY", span: 1 },
          { label: "cca 18 BBY", span: 1 },
          { label: "13 – 10 BBY", span: 1 },
          { label: "9 BBY", span: 1 },
          { label: "5 – 4 BBY", span: 1 },
          { label: "cca 5 – 2 BBY", span: 1 },
          { label: "cca 4 – 1 BBY", span: 1 },
          { label: "1 BBY", span: 1 },
          { label: "0 BBY", span: 1 },
        ],
      },
      {
        id: "ot",
        label: "Age of Rebellion",
        description: "A scattered Rebellion keeps hope alive against the might of the Empire.",
        itemIds: ["ep4", "ep5", "ep6"],
        yearBands: [
          { label: "0 BBY", span: 1, milestone: "Battle of Yavin" },
          { label: "2 ABY", span: 1 },
          { label: "4 ABY", span: 1 },
        ],
      },
      {
        id: "nr",
        label: "The New Republic",
        description: "The Empire has fallen, but the fledgling New Republic faces its remnants and a fragile peace.",
        itemIds: ["md-s1", "md-s2", "bf-s1", "md-s3", "ah-s1", "sc-s1", "mandoGrogu"],
        yearBands: [
          { label: "9 ABY", span: 1 },
          { label: "cca 9–10 ABY", span: 1 },
          { label: "cca 9–11 ABY", span: 3 },
          { label: "cca 10–12 ABY", span: 1 },
        ],
      },
      {
        id: "st",
        label: "Rise of the First Order",
        description: "From the Empire's ashes rises the First Order, met by a new generation of heroes.",
        // ~22 years pass between the fall of the Empire's remnants and here
        gapBefore: true,
        // Resistance begins just before The Force Awakens and leads
        // straight into it - S1's last 2 episodes (Starkiller Base's
        // fallout) are split off to sit right after The Last Jedi instead
        // of with the rest of the season, see res-s1-early/-finale above
        itemIds: ["res-s1-early", "ep7", "ep8", "res-s1-finale", "res-s2", "ep9"],
        yearBands: [
          { label: "34 ABY", span: 3 },
          { label: "34–35 ABY", span: 2 },
          { label: "35 ABY", span: 1 },
        ],
      },
    ],
  },
  {
    id: "release",
    label: "Release Order",
    description: "Ideal for your first watch. Follow the release order and experience all the plot twists, shocking reveals, and nostalgic callbacks just like millions of fans before you.",
    // ONE flat era, deliberately - this used to be split into "Original
    // Trilogy" / "Prequel Trilogy" / "Sequel Trilogy" + a fourth grab-bag
    // era for everything else, which forced the three trilogies to sit
    // apart from whatever else released around the same time even though
    // this mode's whole point is "what actually came out, in what order".
    // Every movie and season - trilogies included - is one single itemIds
    // list here, sorted purely by real-world release year (Young Jedi
    // Adventures is still the one deliberate exception, left out of
    // Release Order entirely - see the chronological ordering's own
    // comment on it). Seasons of the same show that released with nothing
    // else coming out in between still automatically share one poster
    // (see groupEraItems in app.js) - that's why e.g. cw-s1..cw-s6 sit
    // back to back below while rb-s1/rb-s2 and rb-s3 are split apart by
    // ep7 landing between them in real life.
    eras: [
      {
        id: "all",
        // No label text - a single era now spans the ENTIRE track (every
        // title, one flat list), so era-block__title's centered-on-the-
        // era-block positioning would put any text off in the horizontal
        // middle of the whole multi-thousand-px-wide timeline, invisible
        // without scrolling there first. Leaving it blank still renders
        // its two ::before/::after gradient lines (see style.css), which
        // meet edge-to-edge into one continuous accent rule under the
        // year-band strip - exactly the divider this ordering needs
        // without a title fighting the "Release Order" pill for the same
        // job.
        label: "",
        itemIds: [
          "ep4",
          "ep5",
          "ep6",
          "ep1",
          "ep2",
          "ep3",
          "clonewarsMovie",
          "cw-s1",
          "cw-s2",
          "cw-s3",
          "cw-s4",
          "cw-s5",
          "cw-s6",
          "rb-s1",
          "rb-s2",
          "ep7",
          "rb-s3",
          "rogue",
          "rb-s4",
          "ep8",
          "solo",
          "res-s1",
          "res-s2",
          "md-s1",
          "ep9",
          "cw-s7",
          "md-s2",
          "bb-s1",
          "bf-s1",
          "kenobi-s1",
          "an-s1",
          "tj-s1",
          "bb-s2",
          "md-s3",
          "ah-s1",
          "bb-s3",
          "te-s1",
          "ac-s1",
          "sc-s1",
          "an-s2",
          "tu-s1",
          "maul-s1",
          "mandoGrogu",
        ],
        // Real-world release years for the axis strip above the cards -
        // same drawYearBands()/`span` mechanism the chronological ordering
        // uses for its in-universe BBY/ABY years (see the comment on
        // ORDERINGS above), just fed real years instead. `span` counts
        // rendered CARDS, not raw itemIds above - a run of same-show
        // seasons that merges into one card (see groupEraItems) gets ONE
        // band entry covering the real years that single card spans (a
        // range, e.g. cw-s1..cw-s6 becoming one "Star Wars: The Clone
        // Wars" card covering 2008-2014), while separate cards that happen
        // to share one exact release year (e.g. Kenobi/Andor S1/Tales of
        // the Jedi S1, all 2022) share one band with span 3. Recompute
        // this by hand if itemIds above ever changes - nothing derives it
        // automatically the way an in-card meta line would.
        yearBands: [
          { label: "1977", span: 1 },
          { label: "1980", span: 1 },
          { label: "1983", span: 1 },
          { label: "1999", span: 1 },
          { label: "2002", span: 1 },
          { label: "2005", span: 1 },
          { label: "2008", span: 1 }, // The Clone Wars (film), alone
          { label: "2008–2014", span: 1 }, // Clone Wars S1-S6, merged into one card
          { label: "2014–2015", span: 1 }, // Rebels S1-S2, merged into one card
          { label: "2015", span: 1 },
          { label: "2016", span: 2 }, // Rebels S3 + Rogue One
          { label: "2017", span: 2 }, // Rebels S4 + The Last Jedi
          { label: "2018", span: 1 }, // Solo, alone
          { label: "2018–2019", span: 1 }, // Resistance S1-S2, merged into one card
          { label: "2019", span: 2 }, // Mandalorian S1 + The Rise of Skywalker
          { label: "2020", span: 2 }, // Clone Wars S7 + Mandalorian S2
          { label: "2021", span: 2 }, // Bad Batch S1 + Book of Boba Fett
          { label: "2022", span: 3 }, // Kenobi + Andor S1 + Tales of the Jedi
          { label: "2023", span: 3 }, // Bad Batch S2 + Mandalorian S3 + Ahsoka
          { label: "2024", span: 4 }, // Bad Batch S3 + Tales of the Empire + The Acolyte + Skeleton Crew
          { label: "2025", span: 2 }, // Andor S2 + Tales of the Underworld
          { label: "2026", span: 2 }, // Maul: Shadow Lord + The Mandalorian and Grogu
        ],
      },
    ],
  },
];

// STORY_LINES - "Storylines" is a THIRD top-level mode next to
// Chronological/Release Order (see the order-switch/story-line-select
// comments in app.js), not a filter layered on top of whichever of those
// two is active - picking one here is exactly as mutually exclusive with
// Chronological/Release Order as those two are with each other. A
// personal story arc has no release-date variant, so every story line
// renders chronologically ONLY - render() (app.js) always resolves to the
// "chronological" ordering while a story line is picked, regardless of
// whatever state.orderingId happens to be storing.
//   Two ways for a story line to say what belongs in it, in what eras:
//     - `chapters.chronological` - its OWN era breakdown, for when the
//       generic Chronological eras ("Fall of the Jedi", "Reign of the
//       Empire" ...) don't fit this story's own shape at all. Anakin's
//       arc reads as "Child -> Jedi -> Fall -> Sith -> Redemption ->
//       Legacy", not galaxy-scale era names, so it gets its own chapters
//       instead. Shape: `[{ id, label, description?, itemIds, gapBefore?,
//       yearBands? }, ...]` - a chapter's `itemIds` are the exact final
//       ids to render (slice ids like "cw-s1-anakin" included). A
//       chapter's own `yearBands` works exactly like a base ordering
//       era's (see the comment on ORDERINGS above) - hand-authored for
//       that chapter's own curated card sequence, so its `span` counts
//       stay accurate the way a base era's wouldn't once filtered.
//     - `replace` - the fallback for a simpler future story line that's
//       happy reusing Chronological's own eras, just thinned out. Maps an
//       item id AS IT APPEARS IN CHRONOLOGICAL'S itemIds to what actually
//       shows once this story line is picked: absent (no key) = excluded,
//       a single id = pass through unchanged or substitute a curated
//       slice, an array = one base item expands into several cards.
//       render() runs this against EVERY era of Chronological
//       independently (via filterItemIdsForStoryLine()) and drops any era
//       left with nothing in it - only used when `chapters.chronological`
//       is absent for that story line (chapters always win when both
//       exist, see render()). Chronological's OWN yearBands are skipped in
//       this path (see render()) - they're sized for its FULL, unfiltered
//       era card counts, and filtering just changed that.
//   Adding another story line (Maul, below) is one more entry here -
// `chapters` only if its own arc genuinely doesn't fit Chronological's
// generic eras, `replace` alone is enough if it does. No app.js changes
// needed either way.
const STORY_LINES_STARWARS = [
  {
    id: "anakin",
    label: "Anakin Skywalker",
    description: "Relive again the tragic story of Anakin Skywalker.",
    // No `replace` here - Anakin's arc doesn't fit Chronological's generic
    // eras ("Fall of the Jedi", "Reign of the Empire" ...) at all, so it
    // defines its own `chapters.chronological` below instead (which always
    // wins over `replace` when both exist anyway, see render() - keeping
    // an unreachable `replace` map around here would just be dead weight).
    // No `description` on any individual chapter either, unlike the base
    // orderings' eras - a one-word chapter title doesn't need a blurb the
    // way "Fall of the Jedi" does.
    chapters: {
      chronological: [
        {
          id: "child",
          label: "Child",
          itemIds: ["ep1", "tj-s1-e4"],
          // Both bands sourced from Chronological's own eras above (ep1's
          // "pt" band, tj-s1-early's) - tj-s1-e4 keeps tj-s1-early's whole
          // "cca" range since only its own E4 is used here, not the full
          // E1-4 the range was written for.
          yearBands: [
            { label: "32 BBY", span: 1 }, // The Phantom Menace
            { label: "cca 36–22 BBY", span: 1 }, // Tales of the Jedi E4
          ],
        },
        {
          id: "jedi",
          label: "Jedi",
          // cw-s7-anakin (Siege of Mandalore, S7's first 4 episodes) sits
          // here rather than in "fall" - it's the tail end of the Clone
          // Wars proper, so it stays merged into the one big Clone Wars
          // card (same seriesId, consecutive - see groupEraItems in
          // app.js) instead of breaking off into its own card.
          itemIds: ["ep2", "clonewarsMovie", "cw-s1-anakin", "cw-s2-anakin", "cw-s3-anakin", "cw-s4-anakin", "cw-s5-anakin", "cw-s6-anakin", "cw-s7-anakin"],
          // "22 BBY" spans BOTH movie cards below (ep2 + clonewarsMovie),
          // same as Chronological's own "pt" era does it. The merged
          // Clone Wars card keeps Chronological's own "cca" range for the
          // whole S1-S7(E1-8) stretch, since only individual episodes
          // within it are used here, not a more precise sub-range.
          yearBands: [
            { label: "22 BBY", span: 2 }, // Attack of the Clones + The Clone Wars (film)
            { label: "cca 22–19 BBY", span: 1 }, // Clone Wars S1-S6 + S7 (Siege of Mandalore start), merged into one card
          ],
        },
        {
          id: "fall",
          label: "Fall",
          // tj-s1-e5 ("Practice Makes Perfect") closes this chapter out -
          // Ahsoka reckoning with Order 66 and Anakin's turn through her
          // own training flashbacks, right on the heels of cw-s7-siege.
          itemIds: ["ep3", "cw-s7-siege", "tj-s1-e5"],
          // "19 BBY" spans both ep3 and cw-s7-siege, same as Chronological
          // does for this exact pair in its own "pt" era.
          yearBands: [
            { label: "19 BBY", span: 2 }, // Revenge of the Sith + Clone Wars S7 (Siege of Mandalore finale)
            { label: "cca 19–18 BBY", span: 1 }, // Tales of the Jedi E5
          ],
        },
        {
          id: "sith",
          label: "Sith",
          // Episode V ends the chapter whole - there's no mechanism to
          // split a MOVIE card the way a season can be sliced (see
          // "Season slices" above), so the reveal in its final scene
          // doesn't get its own card. Kept here rather than moved to
          // "redemption" since Vader is still the film's antagonist for
          // almost all of its runtime.
          itemIds: ["kenobi-s1", "rb-s2-anakin", "rogue", "ep4", "ep5"],
          // rb-s2-anakin ("Twilight of the Apprentice") is dated 3 BBY by
          // Star Wars: Timelines - more precise than Chronological's own
          // whole-Rebels-run range, since this is one specific two-part
          // episode, not the whole season.
          yearBands: [
            { label: "9 BBY", span: 1 }, // Obi-Wan Kenobi
            { label: "3 BBY", span: 1 }, // Rebels S2 (Twilight of the Apprentice)
            { label: "0 BBY", span: 2 }, // Rogue One + A New Hope
            { label: "2 ABY", span: 1 }, // The Empire Strikes Back
          ],
        },
        {
          id: "redemption",
          label: "Redemption",
          itemIds: ["ep6"],
          yearBands: [{ label: "4 ABY", span: 1 }], // Return of the Jedi
        },
        {
          id: "legacy",
          label: "Legacy",
          // Years pass between Vader's redemption and here (Ahsoka, set in
          // the New Republic era) - same kind of jump Chronological itself
          // marks with gapBefore between "ot" and "nr"/"st".
          gapBefore: true,
          itemIds: ["ah-s1-anakin"],
          // Same "cca" range Chronological's own "nr" era uses for the
          // Book of Boba Fett/Mandalorian S3/Ahsoka S1 stretch - ah-s1
          // itself has no more precise band of its own there either.
          yearBands: [{ label: "cca 9–11 ABY", span: 1 }],
        },
      ],
    },
  },
  // DRAFT - first pass, chapter boundaries/labels not yet confirmed by the
  // user (see the request that added this story line). Every item below
  // is a verified real Maul appearance (cross-checked against this
  // project's own already-researched episode titles plus independent
  // sources, not recalled from memory alone) - what's still a judgment
  // call is purely how they're grouped/named into chapters.
  {
    id: "maul",
    label: "Maul",
    description: "Follow the Sith apprentice who refused to stay dead - from Naboo to his final duel with Kenobi.",
    // No `replace` here either, same reasoning as Anakin above - his arc
    // doesn't fit Chronological's generic eras any better than Anakin's
    // does, so it gets its own `chapters.chronological`.
    chapters: {
      chronological: [
        {
          id: "apprentice",
          label: "Apprentice",
          itemIds: ["ep1"],
          yearBands: [{ label: "32 BBY", span: 1 }], // The Phantom Menace
        },
        {
          id: "crimelord",
          label: "Crimelord",
          // Everything from cw-s4-maul (found half-mad on the junk moon
          // Lotho Minor, hunting down Obi-Wan for revenge) through Solo,
          // all one chapter - not a perfect fit for "Crimelord" this early
          // (he's not running anything yet in "Brothers"/"Revenge"), but
          // it's the direct lead-in to the rest of the chapter and keeping
          // the structure simple (one fewer chapter) wins out here. Maul
          // spends the whole stretch after that building and running
          // criminal empires (Death Watch/Shadow Collective on Mandalore,
          // then Crimson Dawn), interrupted only by getting captured twice
          // along the way. cw-s4-maul through cw-s7-siege (Ahsoka and Rex
          // catching up with him during the Siege of Mandalore, reused
          // directly from the Anakin slices above) merge into one Clone
          // Wars card (same seriesId, consecutive - see groupEraItems in
          // app.js), then maul-s1 (rebuilding on Janix) and Solo (revealed
          // as Crimson Dawn's true leader) close it out.
          itemIds: ["cw-s4-maul", "cw-s5-maul", "cw-s7-siege", "maul-s1", "solo"],
          // The merged Clone Wars card's band is narrower than the
          // Anakin chapters' equivalent "cca 22–19 BBY" - unlike Anakin's,
          // this card's content skips the war's early years entirely
          // (starts at S4's finale, not S1), and Wookieepedia dates "The
          // Lawless" (the arc's climax) to cca 20-19 BBY specifically,
          // right where this card ends (cw-s7-siege, precisely 19 BBY).
          // maul-s1/solo reuse Chronological's own established bands for
          // them exactly (see the "an" era above).
          yearBands: [
            { label: "cca 20–19 BBY", span: 1 }, // Clone Wars S4 (Maul's return) + S5 (Shadow Collective) + S7 (Siege of Mandalore), merged into one card
            { label: "cca 18 BBY", span: 1 }, // Maul: Shadow Lord
            { label: "13–10 BBY", span: 1 }, // Solo
          ],
        },
        {
          id: "reckoning",
          label: "Reckoning",
          // Roughly a decade after Solo - grooming Ezra as his own
          // apprentice on Malachor, then manipulating him further with
          // visions of his lost family, before his final duel with
          // Obi-Wan on Tatooine ends it for good.
          gapBefore: true,
          itemIds: ["rb-s2-maul", "rb-s3-maul"],
          // Star Wars: Timelines dates "Twilight of the Apprentice" to 3
          // BBY and "Twin Suns" to 2 BBY - both slices merge into one
          // Rebels card (same seriesId, consecutive), spanning that range.
          yearBands: [{ label: "cca 3–2 BBY", span: 1 }],
        },
      ],
    },
  },
];

// ------------------------------------------------------------------------
//  MARVEL - Earth-616 / Sacred Timeline
// ------------------------------------------------------------------------
// Same shape as the Star Wars dataset above (MOVIES/SERIES/SEASONS/
// ORDERINGS), centered on Earth-616/Sacred Timeline - plus a handful of
// otherEarth titles glued onto that same axis (see movie.otherEarth's own
// comment further down: Fantastic Four, Deadpool & Wolverine, Your
// Friendly Neighborhood Spider-Man, and the Fox X-Men films/Earth-10005).
// Still not the animated multiverse anthologies (What If...?, Marvel
// Zombies - no single date to place, unlike everything otherEarth covers
// today) or the separate animated X-Men '97 continuity (unrelated to the
// live-action Fox films above), and not (yet) the earlier Netflix-era
// shows - candidates for a later pass, deliberately left out of this one
// to keep the catalog sourced and checkable rather than sprawling. No
// STORY_LINES yet either (see FRANCHISE_DATA below - falls back to `[]`).
//   Ids are prefixed/shaped so they can never collide with the Star Wars
// dataset's own ids (e.g. "cap1" vs Star Wars' "ep1") - both datasets
// share the same `state.watched` Set (app.js) rather than being
// partitioned per franchise, so distinct ids are what keeps watched-state
// from one franchise ever bleeding into the other's counts.
//   Movie years/runtimes are real, sourced facts (release year is common
// knowledge; runtimes cross-checked against public sources, not guessed -
// same standard as Star Wars' own `runtimeMin`). TV seasons intentionally
// carry ONLY year + episode count, no `episodeRuntimes`/`episodeTitles`/
// `totalRuntimeMin` - unlike Star Wars, none of that has been verified
// per-episode yet for ~15 shows worth of content (the same "too much to
// responsibly guess" reasoning CLAUDE.md already gives for Star Wars
// applies here from day one, not just after a catalog grows organically)
// - seasonTotalRuntimeMin()/seasonMetaLineText() (app.js) already handle
// a season with no runtime data at all gracefully (the meta line just
// omits it), so this isn't a missing-data bug, just an honest gap to fill
// in a future, dedicated verification pass.

const MOVIES_MARVEL = {
  // otherEarth: Earth-10005 (see movie.otherEarth's own comment further
  // down, and deadpool3's - this is the SAME Fox X-Men-movies universe
  // Deadpool & Wolverine visits, just a much earlier glimpse of it, the
  // TVA's own on-screen designation). The original trilogy's own years
  // ("cca 2000"/"cca 2003"/"cca 2006") are approximated FROM their real
  // release year - no specific in-universe date was ever confirmed for
  // them, unlike xmenfirstclass/xmendofp/xmenapocalypse/darkphoenix/logan
  // below, which each have a real, independently-sourced one instead (see
  // each entry's own comment).
  //   Every Earth-10005 (and Earth-828, Fantastic Four) title's card is
  // positioned on the Chronological axis by its OWN true year, interleaved
  // with Sacred Timeline exactly like any other card, NOT grouped together
  // as a separate "block" - see the yearBands comment on ORDERINGS_MARVEL
  // below for why an earlier pass tried exactly that (kept the whole
  // otherEarth run as one contiguous island) and it was wrong: the axis's
  // own point is real chronological order, and a foreign Earth's own
  // internal story can - and here does - span decades that overlap with
  // Sacred Timeline's own, so its cards have to interleave back and forth
  // across that whole span, not sit together as an isolated aside.
  // drawConnectors() (app.js) renders a SOLID line between two adjacent
  // cards that happen to share the exact same otherEarth.label (real
  // continuity within one foreign story, e.g. two X-Men films that landed
  // next to each other after the full interleave) vs. the usual dashed
  // line at any other seam - crossing into/out of Sacred Timeline, or
  // into/out of a DIFFERENT foreign Earth - see its own comment for the
  // mechanism. The connector itself stays ONE universal color either way
  // (see --other-earth-current's own comment for why the connector is the
  // one exception to per-universe coloring) - only solid/dashed varies.
  //   otherEarth.variant ("Original", on the trilogy only) is a SEPARATE
  // field from otherEarth.label on purpose - the label ("Earth-10005") is
  // what drawConnectors()/the CSS color override match on to decide "same
  // universe" and which color family applies, so it has to stay identical
  // across every Earth-10005 title; the variant is DISPLAY only, appended
  // after the Earth name wherever it's shown (card__origin-earth in
  // buildCard(), .year-band__earth in drawYearBands() -
  // "EARTH-10005 (ORIGINAL)") without ever touching that matching.
  // xmendofp (in this dataset) partially rewrites the trilogy's own ending
  // via time travel, so the qualifier flags that this specific
  // timeline-branch isn't the only/final word on how the story ends,
  // without this app having to model the rewrite itself as a separate
  // branch - a property of that ENDING, not of Earth-10005 as a whole
  // (everything else in the cluster is unaffected either way), which is
  // why it lives on the trilogy's own entries, not the shared Earth label.
  xmen1: { id: "xmen1", title: "X-Men", year: 2000, runtimeMin: 104, type: "film", otherEarth: { label: "Earth-10005", year: "cca 2000", variant: "Original" } },
  // otherEarth: Earth-96283 - Sam Raimi's own trilogy, the OTHER pre-MCU
  // Spider-Man continuity (Sony owns the character outright; this one
  // predates Sony/Marvel Studios' later deal for the 616 Tom Holland
  // version entirely, no crossover ties to it the way Deadpool & Wolverine
  // has to Earth-10005). Contemporary-set with no specific in-universe
  // date ever confirmed beyond that, so "cca" from release like the
  // Earth-10005 trilogy above - same reasoning, different universe.
  spidermanraimi1: { id: "spidermanraimi1", title: "Spider-Man", year: 2002, runtimeMin: 121, type: "film", otherEarth: { label: "Earth-96283", year: "cca 2002" } },
  xmen2: { id: "xmen2", title: "X2: X-Men United", year: 2003, runtimeMin: 133, type: "film", otherEarth: { label: "Earth-10005", year: "cca 2003", variant: "Original" } },
  spidermanraimi2: { id: "spidermanraimi2", title: "Spider-Man 2", year: 2004, runtimeMin: 127, type: "film", otherEarth: { label: "Earth-96283", year: "cca 2004" } },
  xmen3: { id: "xmen3", title: "X-Men: The Last Stand", year: 2006, runtimeMin: 104, type: "film", otherEarth: { label: "Earth-10005", year: "cca 2006", variant: "Original" } },
  spidermanraimi3: { id: "spidermanraimi3", title: "Spider-Man 3", year: 2007, runtimeMin: 139, type: "film", otherEarth: { label: "Earth-96283", year: "cca 2007" } },
  ironman1: { id: "ironman1", title: "Iron Man", year: 2008, runtimeMin: 126, type: "film" },
  hulk: { id: "hulk", title: "The Incredible Hulk", year: 2008, runtimeMin: 112, type: "film" },
  // otherEarth.variant: "Original" - the SAME pre-reboot Earth-10005 branch
  // as xmen1/xmen2/xmen3 below (a prequel to that trilogy, not a separate
  // thing), distinct from the "Rewrite" branch xmendofp spins off further
  // down. Its own in-universe year is real and sourced, not "cca": the
  // climax is explicitly dated on-screen to March 28, 1979, at Three Mile
  // Island - a real nuclear plant the film ties its fictional Weapon X
  // facility to on the exact date of the real 1979 accident there
  // (https://en.wikipedia.org/wiki/Three_Mile_Island_accident,
  // https://xmenmovies.fandom.com/wiki/Three_Mile_Island), the same
  // "explicit on-screen/real-event date, no approximation needed" situation
  // xmendofp's own 1973 and xmenapocalypse's 1983 already have.
  xmenoriginswolverine: { id: "xmenoriginswolverine", title: "X-Men Origins: Wolverine", year: 2009, runtimeMin: 107, type: "film", otherEarth: { label: "Earth-10005", year: "1979", variant: "Original" } },
  ironman2: { id: "ironman2", title: "Iron Man 2", year: 2010, runtimeMin: 124, type: "film" },
  thor1: { id: "thor1", title: "Thor", year: 2011, runtimeMin: 115, type: "film" },
  cap1: { id: "cap1", title: "Captain America: The First Avenger", year: 2011, runtimeMin: 124, type: "film" },
  // 1962 period piece (Cuban Missile Crisis) - a real in-universe date far
  // from its 2011 release, same reasoning as fantasticfour1's own 1964 -
  // see the otherEarth comment above xmen1 for the whole Earth-10005
  // cluster this belongs to.
  xmenfirstclass: { id: "xmenfirstclass", title: "X-Men: First Class", year: 2011, runtimeMin: 132, type: "film", otherEarth: { label: "Earth-10005", year: "1962" } },
  avengers1: { id: "avengers1", title: "The Avengers", year: 2012, runtimeMin: 143, type: "film", badge: "Avengers" },
  // otherEarth: Earth-120703 - Andrew Garfield's own separate Spider-Man
  // continuity, distinct from both the 616 Tom Holland version and the
  // earlier Raimi-era Earth-96283 above - a THIRD pre-MCU Spider-Man
  // universe, same "Sony owns the character, no crossover ties" situation.
  // No specific in-universe date confirmed, so "cca" from release.
  amazingspiderman1: { id: "amazingspiderman1", title: "The Amazing Spider-Man", year: 2012, runtimeMin: 136, type: "film", otherEarth: { label: "Earth-120703", year: "cca 2012" } },
  ironman3: { id: "ironman3", title: "Iron Man 3", year: 2013, runtimeMin: 130, type: "film" },
  thor2: { id: "thor2", title: "Thor: The Dark World", year: 2013, runtimeMin: 112, type: "film" },
  // Contemporary-set (some years after The Last Stand), no specific
  // in-universe year confirmed beyond that - "cca" from its own release
  // year, same reasoning as the original trilogy above. variant:
  // "Original" - same untouched pre-xmendofp branch as xmen1/xmen2/xmen3/
  // xmenoriginswolverine, not the "Rewrite" branch further down this file.
  xmenwolverine: { id: "xmenwolverine", title: "The Wolverine", year: 2013, runtimeMin: 126, type: "film", otherEarth: { label: "Earth-10005", year: "cca 2013", variant: "Original" } },
  cap2: { id: "cap2", title: "Captain America: The Winter Soldier", year: 2014, runtimeMin: 136, type: "film" },
  // otherEarth: Earth-120703, same as amazingspiderman1 above.
  amazingspiderman2: { id: "amazingspiderman2", title: "The Amazing Spider-Man 2", year: 2014, runtimeMin: 142, type: "film", otherEarth: { label: "Earth-120703", year: "cca 2014" } },
  gotg1: { id: "gotg1", title: "Guardians of the Galaxy", year: 2014, runtimeMin: 121, type: "film" },
  // Positioned on the Chronological axis at 2023, NOT 1973, even though the
  // bulk of the film's runtime (Wolverine's consciousness sent back) plays
  // out in 1973 - a deliberate reversal of an earlier pass, which placed it
  // at 1973 reasoning that the 1973 mission was "the one date that actually
  // sticks" once the 2023 future it opens on gets overwritten by the
  // story's own ending. The user asked for the opposite framing: 2023 (the
  // moment the timeline is REWRITTEN, from the events already in Sacred
  // Timeline up to that point) is this card's own position on the axis,
  // with the 1973 mission folded into its yearBands label instead
  // ("2023 + rewrite 1973" - see the label below, not otherEarth.year,
  // which stays the short "2023" so the card's own meta line has room for
  // it next to the runtime). This also makes it the pivot immediately
  // ahead of xmenapocalypse/darkphoenix/deadpool1/deadpool2 below, each
  // flagged `variant: "Rewrite"` and clustered right after this card
  // instead of sorting to their own individual years elsewhere on the axis
  // - see the big otherEarth comment above ORDERINGS_MARVEL for why this
  // one cluster is a deliberate, documented exception to this whole
  // franchise's "always fully interleave, never group as an island"
  // principle everywhere else.
  xmendofp: { id: "xmendofp", title: "X-Men: Days of Future Past", year: 2014, runtimeMin: 131, type: "film", otherEarth: { label: "Earth-10005", year: "2023" } },
  avengers2: { id: "avengers2", title: "Avengers: Age of Ultron", year: 2015, runtimeMin: 141, type: "film", badge: "Avengers" },
  antman1: { id: "antman1", title: "Ant-Man", year: 2015, runtimeMin: 117, type: "film" },
  cap3: { id: "cap3", title: "Captain America: Civil War", year: 2016, runtimeMin: 147, type: "film" },
  drstrange1: { id: "drstrange1", title: "Doctor Strange", year: 2016, runtimeMin: 115, type: "film" },
  // 1983, explicitly stated (nine years before Dark Phoenix's own 1992) -
  // same "real, sourced date" category as xmendofp above. `variant:
  // "Rewrite"` (not "Original", see xmen1's own comment for that other
  // branch) - this and the three otherEarth-flagged movies below it in
  // this file all take place in the timeline xmendofp's own 2023 event
  // rewrites, per the user's own explicit request - positioned on the axis
  // right after xmendofp (see its own comment) rather than at their own
  // 1983/1992/2016/2018 slots elsewhere, since the point is showing "here
  // is what the rewritten branch actually contains", not their own
  // standalone place in a strict year sort.
  xmenapocalypse: { id: "xmenapocalypse", title: "X-Men: Apocalypse", year: 2016, runtimeMin: 144, type: "film", otherEarth: { label: "Earth-10005", year: "1983", variant: "Rewrite" } },
  // No specific in-universe year ever confirmed - "cca" from its own
  // release year, same as the trilogy/The Wolverine. variant: "Rewrite",
  // same rewritten-branch cluster as xmenapocalypse above.
  deadpool1: { id: "deadpool1", title: "Deadpool", year: 2016, runtimeMin: 108, type: "film", otherEarth: { label: "Earth-10005", year: "cca 2016", variant: "Rewrite" } },
  gotg2: { id: "gotg2", title: "Guardians of the Galaxy Vol. 2", year: 2017, runtimeMin: 136, type: "film" },
  spiderman1: { id: "spiderman1", title: "Spider-Man: Homecoming", year: 2017, runtimeMin: 133, type: "film" },
  thor3: { id: "thor3", title: "Thor: Ragnarok", year: 2017, runtimeMin: 130, type: "film" },
  // 2029, explicitly on-screen (a car's dashboard display reads "March 1,
  // 2029") - director James Mangold's own stated reason was picking a
  // year clear of Days of Future Past's own already-established 2023
  // epilogue, so this is a real, sourced date like xmendofp/
  // xmenapocalypse above, not an approximation.
  logan: { id: "logan", title: "Logan", year: 2017, runtimeMin: 137, type: "film", otherEarth: { label: "Earth-10005", year: "2029" } },
  blackpanther1: { id: "blackpanther1", title: "Black Panther", year: 2018, runtimeMin: 134, type: "film" },
  avengers3: { id: "avengers3", title: "Avengers: Infinity War", year: 2018, runtimeMin: 149, type: "film", badge: "Avengers" },
  antman2: { id: "antman2", title: "Ant-Man and the Wasp", year: 2018, runtimeMin: 118, type: "film" },
  // otherEarth: Earth-688 - Sony's own separate Spider-Man Universe (SSU),
  // built around Spider-Man-adjacent characters rather than the wall-crawler
  // himself (he doesn't appear on-screen in this universe at all) - a
  // fourth distinct foreign Earth alongside 10005/828/96283/120703, no
  // crossover ties to any of them confirmed yet. No specific in-universe
  // date, so "cca" from release, same pattern as every otherEarth title
  // above with no confirmed date of its own.
  venom1: { id: "venom1", title: "Venom", year: 2018, runtimeMin: 112, type: "film", otherEarth: { label: "Earth-688", year: "cca 2018" } },
  // No specific in-universe year confirmed - "cca" from release, same as
  // the first Deadpool. variant: "Rewrite", same rewritten-branch cluster
  // as xmenapocalypse/deadpool1 above.
  deadpool2: { id: "deadpool2", title: "Deadpool 2", year: 2018, runtimeMin: 119, type: "film", otherEarth: { label: "Earth-10005", year: "cca 2018", variant: "Rewrite" } },
  captainmarvel1: { id: "captainmarvel1", title: "Captain Marvel", year: 2019, runtimeMin: 123, type: "film" },
  avengers4: { id: "avengers4", title: "Avengers: Endgame", year: 2019, runtimeMin: 181, type: "film", badge: "Avengers" },
  spiderman2: { id: "spiderman2", title: "Spider-Man: Far From Home", year: 2019, runtimeMin: 129, type: "film" },
  // 1992, explicitly stated (nine years after X-Men: Apocalypse's own
  // 1983) - a real, sourced date. variant: "Rewrite", same rewritten-branch
  // cluster as xmenapocalypse/deadpool1/deadpool2 above.
  darkphoenix: { id: "darkphoenix", title: "Dark Phoenix", year: 2019, runtimeMin: 114, type: "film", otherEarth: { label: "Earth-10005", year: "1992", variant: "Rewrite" } },
  // Director Josh Boone: rewritten to be set "during modern day rather
  // [than] in the 1980s" - no specific year beyond that, so "cca" from
  // release like the trilogy/Wolverine/Deadpool films above. variant:
  // "Rewrite" - the "modern day" setting IS itself the rewritten timeline
  // (unlike xmenwolverine above, which is "Original"), same rewritten-
  // branch cluster as xmenapocalypse/darkphoenix/deadpool1/deadpool2, moved
  // to sit right before deadpool2 in that cluster on the Chronological
  // axis (see xmendofp's own comment) rather than at its own standalone
  // cca-2020 slot - its yearBands label there is "rewrite late 2010s", not
  // a specific year, since no exact one was ever confirmed (same lowercase
  // "rewrite <value>" format as the rest of the cluster's own labels, not
  // the "LATE 2010s (REWRITE)" format an earlier pass used).
  newmutants: { id: "newmutants", title: "The New Mutants", year: 2020, runtimeMin: 94, type: "film", otherEarth: { label: "Earth-10005", year: "cca 2020", variant: "Rewrite" } },
  blackwidow: { id: "blackwidow", title: "Black Widow", year: 2021, runtimeMin: 134, type: "film" },
  // otherEarth: Earth-688, same as venom1 above.
  venom2: { id: "venom2", title: "Venom: Let There Be Carnage", year: 2021, runtimeMin: 97, type: "film", otherEarth: { label: "Earth-688", year: "cca 2021" } },
  shangchi: { id: "shangchi", title: "Shang-Chi and the Legend of the Ten Rings", year: 2021, runtimeMin: 132, type: "film" },
  eternals: { id: "eternals", title: "Eternals", year: 2021, runtimeMin: 156, type: "film" },
  spiderman3: { id: "spiderman3", title: "Spider-Man: No Way Home", year: 2021, runtimeMin: 148, type: "film" },
  // otherEarth: Earth-688, same as venom1/venom2 above.
  morbius: { id: "morbius", title: "Morbius", year: 2022, runtimeMin: 104, type: "film", otherEarth: { label: "Earth-688", year: "cca 2022" } },
  drstrange2: { id: "drstrange2", title: "Doctor Strange in the Multiverse of Madness", year: 2022, runtimeMin: 126, type: "film" },
  thor4: { id: "thor4", title: "Thor: Love and Thunder", year: 2022, runtimeMin: 119, type: "film" },
  blackpanther2: { id: "blackpanther2", title: "Black Panther: Wakanda Forever", year: 2022, runtimeMin: 161, type: "film" },
  antman3: { id: "antman3", title: "Ant-Man and the Wasp: Quantumania", year: 2023, runtimeMin: 125, type: "film" },
  gotg3: { id: "gotg3", title: "Guardians of the Galaxy Vol. 3", year: 2023, runtimeMin: 150, type: "film" },
  marvels: { id: "marvels", title: "The Marvels", year: 2023, runtimeMin: 105, type: "film" },
  // otherEarth: Earth-688, same as venom1/venom2/morbius above.
  madameweb: { id: "madameweb", title: "Madame Web", year: 2024, runtimeMin: 116, type: "film", otherEarth: { label: "Earth-688", year: "cca 2024" } },
  // otherEarth here despite most of the film's own RUNTIME playing out on
  // Earth-10005 (the TVA's official designation, confirmed on-screen, for
  // the "dead" Fox X-Men-movies universe - the corpse Deadpool digs up at
  // the start) rather than Earth-616/Sacred Timeline itself - the frame
  // story (Wade meeting Happy Hogan, the TVA) is 616, same pattern as
  // Fantastic Four being "glued on" rather than truly native. Unlike
  // Fantastic Four, there's no distinct in-universe YEAR to show instead
  // of the release year - Earth-10005's own story doesn't have one, it's
  // simply "now" - so otherEarth.year here just repeats `year` above, and
  // this card stays in its normal chronological SEQUENCE position (no
  // different year to move it to). It still gets its own one-off
  // yearBands entry though (ORDERINGS_MARVEL below), so the axis shows
  // the otherEarth color/Earth-label at the top too, not just the card.
  deadpool3: { id: "deadpool3", title: "Deadpool & Wolverine", year: 2024, runtimeMin: 128, type: "film", otherEarth: { label: "Earth-10005", year: "2024" } },
  // otherEarth: Earth-688, same as madameweb above.
  venom3: { id: "venom3", title: "Venom: The Last Dance", year: 2024, runtimeMin: 109, type: "film", otherEarth: { label: "Earth-688", year: "cca 2024" } },
  // otherEarth: Earth-688, same as madameweb/venom3 above.
  kraven: { id: "kraven", title: "Kraven the Hunter", year: 2024, runtimeMin: 127, type: "film", otherEarth: { label: "Earth-688", year: "cca 2024" } },
  cap4: { id: "cap4", title: "Captain America: Brave New World", year: 2025, runtimeMin: 118, type: "film" },
  thunderbolts: { id: "thunderbolts", title: "Thunderbolts*", year: 2025, runtimeMin: 126, type: "film" },
  // otherEarth (buildCard() in app.js, and season.otherEarth /
  // buildSeriesCard() for a whole SHOW instead of one movie - see
  // yourfriendlyspiderman in SERIES_MARVEL below) flags a title that's
  // "glued onto" the Chronological axis from OUTSIDE Earth-616/Sacred
  // Timeline, rather than truly part of its causal order. This one is
  // canonically set on Earth-828, only entering the Sacred Timeline later
  // via a multiversal crossover - but that's specific to Fantastic Four,
  // not a requirement of the field itself (see deadpool3/
  // yourfriendlyspiderman above/below, neither of which has a confirmed
  // crossover). Uses `year` above for Release Order (which doesn't care
  // which Earth a title is nominally set on) and shows otherEarth.year
  // (its own real in-universe date, "1964") instead of the real release
  // year on the card's own meta line under Chronological, plus which Earth
  // it's actually from - see the CSS comment on .card--other-earth for why.
  //   Chronological POSITION (ORDERINGS_MARVEL's own itemIds/yearBands
  // below) is a deliberate exception to "sort by true year" though - user
  // request, per the official timeline reference this file otherwise
  // follows (see that reference's own sourcing note above
  // ORDERINGS_MARVEL): this card sits between thunderbolts and
  // wonderman-s1 (cca 2026), NOT interleaved back at its own 1964 slot
  // between xmenfirstclass and xmenoriginswolverine the way a first pass
  // had it - the family's own arrival INTO Sacred Timeline (fleeing
  // Galactus at the end of their film) is what the official reference
  // dates to roughly this point on the axis, not their Earth-828 origin
  // story. The yearBands label there reads "back to 1964" (not a plain
  // "1964", and not "cca 2026" either) - flagging that this card, unlike
  // every neighbor around it, jumps back to an much earlier setting rather
  // than continuing the axis's forward march, the same kind of explicit
  // callback text xmendofp's own "2023 + rewrite 1973" label uses for the
  // same reason (see that band's own comment). Same category of deliberate,
  // documented "sort by true year" exception as the xmendofp rewrite
  // cluster - not a mistake for a future resort pass to "fix" back to 1964.
  fantasticfour1: {
    id: "fantasticfour1",
    title: "The Fantastic Four: First Steps",
    year: 2025,
    runtimeMin: 115,
    type: "film",
    otherEarth: { label: "Earth-828", year: "1964" },
  },
  spiderman4: { id: "spiderman4", title: "Spider-Man: Brand New Day", year: 2026, runtimeMin: 144, type: "film" },
  werewolfnight: { id: "werewolfnight", title: "Werewolf by Night", year: 2022, runtimeMin: 53, type: "film" },
  gotgholiday: { id: "gotgholiday", title: "The Guardians of the Galaxy Holiday Special", year: 2022, runtimeMin: 44, type: "film" },
  // Five short bonus films (4-15 min each) - originally bundled as
  // home-video EXTRAS on other MCU Blu-rays rather than released in
  // theaters, modeled here as ordinary movie cards (type: "film") despite
  // the short runtime, same as any other MOVIES_MARVEL entry. `year` is
  // each one's real HOME-VIDEO release year (the disc it shipped on), the
  // only real-world date any of them has - runtimes/dates verified via
  // Wikipedia/IMDb, not estimated (this project's own "never invent from
  // memory-only confidence" rule, same standard CLAUDE.md already applies
  // to episode data, applied here to a short film's own runtime/date).
  // None has a book-sourced in-universe date of its own (the DK official
  // timeline this file otherwise follows doesn't cover the One-Shots at
  // all) - each was positioned on the Chronological axis by user request,
  // relative to a specific neighboring movie, with a "cca" yearBands label
  // approximating that neighbor's own date rather than a confirmed one
  // (see each yearBands entry's own comment on ORDERINGS_MARVEL).
  //   id "oneshotagentcarter", not "agentcarter" - that id already belongs
  // to the ABC "Marvel's Agent Carter" SERIES below (SERIES_MARVEL), a
  // different entry entirely; keeping the two distinct avoids an id
  // collision between a MOVIES_MARVEL and a SERIES_MARVEL entry.
  // Chronologically set in 1946, same year Agent Carter's own Season 1
  // begins - sits right after Captain America: The First Avenger (WWII,
  // "1943-1945") and right before the Agent Carter show's own merged
  // "1946-1947" card, splitting what would otherwise be one shared "1946"
  // moment into two adjacent single-card bands.
  oneshotagentcarter: { id: "oneshotagentcarter", title: "Marvel One-Shot: Agent Carter", year: 2013, runtimeMin: 15, type: "film" },
  // Bundled on Captain America: The First Avenger's own Blu-ray
  // (Oct 25, 2011) - Agent Sitwell fails to lift Mjolnir at the New Mexico
  // SHIELD site where Thor's hammer landed, a direct comedic lead-in to
  // Thor. Positioned right before thor1 on request, splitting the
  // ironman2/hulk/thor1 "Spring 2010" band (see its own comment on
  // ORDERINGS_MARVEL) - shares that same rough moment loosely rather than
  // a book-sourced date of its own, hence "cca". oneshotconsultant (below)
  // sits on the OTHER side of thor1 instead, between it and avengers1 -
  // the two One-Shots bracket Thor rather than stacking back to back
  // before it.
  oneshotfunnything: { id: "oneshotfunnything", title: "Marvel One-Shot: A Funny Thing Happened on the Way to Thor's Hammer", year: 2011, runtimeMin: 4, type: "film" },
  // Bundled on Thor's own Blu-ray (Sept 13, 2011). Agent Coulson maneuvers
  // Tony Stark out of the Avengers Initiative roster in favor of Hawkeye -
  // positioned right after thor1 and right before avengers1 on request
  // (not right after oneshotfunnything - the two One-Shots sit on either
  // side of Thor itself, not stacked back to back before it), "cca 2011"
  // splitting what would otherwise be a big Spring-2010-to-Spring-2012 gap
  // with no card of its own between Thor and the Avengers. Under Release
  // Order it sorts by its own real Blu-ray date instead - Sept 13, 2011,
  // actually the EARLIER of this pair's two real home-video dates despite
  // sitting narratively after Thor here, so it lands there before
  // oneshotfunnything (Oct 25, 2011), not after.
  oneshotconsultant: { id: "oneshotconsultant", title: "Marvel One-Shot: The Consultant", year: 2011, runtimeMin: 4, type: "film" },
  // Bundled on The Avengers' own Blu-ray (Sept 25, 2012) - a black-market
  // dealer's salvaged Chitauri tech goes wrong in the aftermath of the
  // Battle of New York. Positioned right after avengers1 on request; "cca
  // Summer 2012", a few months past Avengers' own book-sourced "Spring
  // 2012" band.
  oneshotitem47: { id: "oneshotitem47", title: "Marvel One-Shot: Item 47", year: 2012, runtimeMin: 12, type: "film" },
  // Bundled on Thor: The Dark World's own Blu-ray (Feb 4, 2014) - Trevor
  // Slattery (the fake Mandarin from Iron Man 3) is interviewed in prison
  // by a mysterious visitor, a direct Iron Man 3 epilogue. Positioned
  // right after ironman3 on request; "cca early 2014", just past ironman3's
  // own book-sourced "December 2013 – Early 2014" band.
  oneshotallhailtheking: { id: "oneshotallhailtheking", title: "Marvel One-Shot: All Hail the King", year: 2014, runtimeMin: 14, type: "film" },
};

const SERIES_MARVEL = {
  wandavision: { id: "wandavision", title: "WandaVision" },
  falconws: { id: "falconws", title: "The Falcon and the Winter Soldier" },
  loki: { id: "loki", title: "Loki" },
  whatif: { id: "whatif", title: "What If...?", animated: true },
  marvelzombies: { id: "marvelzombies", title: "Marvel Zombies", animated: true },
  hawkeye: { id: "hawkeye", title: "Hawkeye" },
  moonknight: { id: "moonknight", title: "Moon Knight" },
  msmarvel: { id: "msmarvel", title: "Ms. Marvel" },
  shehulk: { id: "shehulk", title: "She-Hulk: Attorney at Law" },
  secretinvasion: { id: "secretinvasion", title: "Secret Invasion" },
  echo: { id: "echo", title: "Echo" },
  agatha: { id: "agatha", title: "Agatha All Along" },
  daredevilba: { id: "daredevilba", title: "Daredevil: Born Again" },
  ironheart: { id: "ironheart", title: "Ironheart" },
  wonderman: { id: "wonderman", title: "Wonder Man" },
  // Legacy pre-Disney+ era (ABC, 2015-2016) - real Earth-616/Sacred
  // Timeline canon (see the official chronological placement on
  // SEASONS_MARVEL below), just from years before this project started
  // tracking Marvel TV at all.
  agentcarter: { id: "agentcarter", title: "Marvel's Agent Carter" },
  // Animated anthology, 4 episodes released as one binge-drop - each one
  // its own standalone story from a different point in Wakandan history
  // (1260 BC to 1896 AD, per its own yearBands entry below), centuries
  // apart. Kept as ONE
  // whole-season card rather than sliced per-episode by era (unlike a
  // Star Wars slice - see the "Season slices" pattern in CLAUDE.md) - its
  // chronological placement below is deliberately its own standalone
  // "Ancient History" era at the very front of the axis instead, since
  // there's no single later era its individual episodes would slot into.
  eyeswakanda: { id: "eyeswakanda", title: "Eyes of Wakanda", animated: true },
  // otherEarth (its season entry below, and see movie.otherEarth's own
  // comment for the general mechanism) - officially confirmed NOT
  // Earth-616/Sacred Timeline (Marvel TV boss Brad Winderbaum: the show
  // couldn't use Peter's real rogues' gallery or origin if it were).
  // Earth-86445 is the now-confirmed number (was the placeholder generic
  // "Alt. Earth" label until it was revealed - user request) - still filed
  // under the generic "others" Multiverse bucket rather than a named one
  // of its own (user request - same "real number, not broken out" shape
  // as Marvel Zombies' Earth-89521 below, not every confirmed Earth number
  // automatically earns its own bucket/color, see EARTH_BUCKETS' own
  // comment).
  yourfriendlyspiderman: { id: "yourfriendlyspiderman", title: "Your Friendly Neighborhood Spider-Man" },
  // Netflix's original 2015-2018 "Defenders Saga" corner of the MCU -
  // real Earth-616/Sacred Timeline canon (Daredevil: Born Again's own
  // direct-continuation status, already reflected in daredevilba above,
  // confirms this predecessor show is canon too), just from a decade
  // before this project started tracking Marvel TV at all - same "legacy
  // era, still real canon" situation as agentcarter above. No otherEarth
  // flag needed on any of these five shows.
  //   id "daredevil", not "daredevilba" - that id already belongs to the
  // 2025 revival "Daredevil: Born Again" above; keeping the two distinct
  // avoids an id collision between this original series and its own
  // direct sequel show.
  daredevil: { id: "daredevil", title: "Daredevil" },
  jessicajones: { id: "jessicajones", title: "Jessica Jones" },
  lukecage: { id: "lukecage", title: "Luke Cage" },
  ironfist: { id: "ironfist", title: "Iron Fist" },
  // Miniseries uniting the four leads above - treated as a single-season
  // show like any other rather than anything special-cased, same pattern
  // as eyeswakanda/wonderman's own one-season entries.
  defenders: { id: "defenders", title: "Marvel's The Defenders" },
  // Stop-motion animated shorts anthology - Baby Groot growing up
  // sometime between Guardians of the Galaxy Vol. 2 (2014 in-universe) and
  // Vol. 3, with no specific in-universe date ever confirmed for either
  // season beyond that broad window - "cca" placement on the Chronological
  // axis, same convention as every other undated title in this file.
  iamgroot: { id: "iamgroot", title: "I Am Groot", animated: true },
};

const SEASONS_MARVEL = {
  "wandavision-s1": { id: "wandavision-s1", seriesId: "wandavision", number: 1, label: "Season 1", episodes: 9, year: 2021 },
  "falconws-s1": { id: "falconws-s1", seriesId: "falconws", number: 1, label: "Season 1", episodes: 6, year: 2021 },
  // otherEarth: "Outside Time" - not a numbered alternate reality like every
  // other otherEarth entry in this file, but its own distinct Multiverse
  // bucket by request: the season's own premise (the TVA "prunes" branched
  // timelines from OUTSIDE the flow of time itself) has no in-universe date
  // at all to place it by, not even an approximate one - the official
  // chronological reference this file otherwise follows explicitly declines
  // to place Loki on its own timeline for exactly this reason (see the
  // yearBands comment on ORDERINGS_MARVEL). Chronologically it's still
  // narratively glued onto the axis right after Avengers: Endgame (the
  // Tesseract theft it spins out of) and before WandaVision, same "still a
  // real card in the real sequence" treatment as every other otherEarth
  // title gets - it just has no year to show there, only its own one-off
  // "OUTSIDE TIME" yearBands label (see ORDERINGS_MARVEL's own Chronological
  // itemIds/yearBands). Under Release Order it stays at its own real
  // release slot (June 2021), same as every otherEarth title there.
  "loki-s1": { id: "loki-s1", seriesId: "loki", number: 1, label: "Season 1", episodes: 6, year: 2021, otherEarth: { label: "Outside Time" } },
  // otherEarth: "Outside Time", same as loki-s1 above - not because this
  // SEASON has its own separate identity there (under Chronological it's
  // requested right next to loki-s1, same seriesId + consecutive, so
  // groupEraItems() merges the two into ONE card - see the comment on
  // ORDERINGS_MARVEL's own itemIds), but because Multiverse filtering
  // (filterItemIdsForMultiverse(), app.js) reads each raw id's own
  // otherEarth BEFORE cards ever merge - without this field here,
  // unchecking "Outside Time" would hide loki-s1 but leave loki-s2 behind
  // as its own separate, wrongly-Sacred-Timeline-bucketed card. Also keeps
  // Release Order consistent (the two seasons DON'T merge there, real
  // release years a year and a half apart) - loki-s2 still needs its own
  // tint at its own real release slot, same as every other otherEarth
  // title does under that ordering.
  "loki-s2": { id: "loki-s2", seriesId: "loki", number: 2, label: "Season 2", episodes: 6, year: 2023, otherEarth: { label: "Outside Time" } },
  // otherEarth: "Outside Time", same bucket as Loki above and for the
  // exact same underlying reason CLAUDE.md's own comment on movie.otherEarth
  // originally deferred this show entirely: an anthology where every
  // episode is a genuinely different multiverse branch has no single date
  // to place it at, the same problem Loki's own season 1 has, just at the
  // scale of a whole season instead of one show's ongoing plot. Placed
  // narratively right after shangchi (see ORDERINGS_MARVEL's own
  // Chronological itemIds) rather than at a real date, and given the same
  // literal "OUTSIDE TIME" yearBands label + `noTimeline: true` treatment
  // as Loki's own band - see that band's own comment for why (no year of
  // any kind, no sub-label repeating the same text, no reach-indicator
  // line). Under Release Order it stays at its own real August 2021
  // release slot instead, same as every otherEarth title there.
  "whatif-s1": { id: "whatif-s1", seriesId: "whatif", number: 1, label: "Season 1", episodes: 9, year: 2021, otherEarth: { label: "Outside Time" } },
  // otherEarth: "Outside Time", same as whatif-s1 above - a DIFFERENT
  // season, not the same card (unlike loki-s1/loki-s2, these three whatif
  // seasons never sit consecutively in itemIds, so groupEraItems() never
  // merges them - each is its own separate card at its own separate point
  // on the axis). Placed narratively right after thor4 (Thor: Love and
  // Thunder) on request, splitting a shared "Fall 2025" span:3 band the
  // same way every other mid-band otherEarth insertion in this file does.
  "whatif-s2": { id: "whatif-s2", seriesId: "whatif", number: 2, label: "Season 2", episodes: 9, year: 2023, otherEarth: { label: "Outside Time" } },
  // otherEarth: "Outside Time", same as whatif-s1/s2 above. Placed
  // narratively right after agatha-s1 (Agatha All Along) on request,
  // splitting a shared "cca 2026" span:8 band the same way.
  "whatif-s3": { id: "whatif-s3", seriesId: "whatif", number: 3, label: "Season 3", episodes: 8, year: 2024, otherEarth: { label: "Outside Time" } },
  "hawkeye-s1": { id: "hawkeye-s1", seriesId: "hawkeye", number: 1, label: "Season 1", episodes: 6, year: 2021 },
  "moonknight-s1": { id: "moonknight-s1", seriesId: "moonknight", number: 1, label: "Season 1", episodes: 6, year: 2022 },
  "msmarvel-s1": { id: "msmarvel-s1", seriesId: "msmarvel", number: 1, label: "Season 1", episodes: 6, year: 2022 },
  "shehulk-s1": { id: "shehulk-s1", seriesId: "shehulk", number: 1, label: "Season 1", episodes: 9, year: 2022 },
  "secretinvasion-s1": { id: "secretinvasion-s1", seriesId: "secretinvasion", number: 1, label: "Season 1", episodes: 6, year: 2023 },
  "echo-s1": { id: "echo-s1", seriesId: "echo", number: 1, label: "Season 1", episodes: 5, year: 2024 },
  "agatha-s1": { id: "agatha-s1", seriesId: "agatha", number: 1, label: "Season 1", episodes: 9, year: 2024 },
  "daredevilba-s1": { id: "daredevilba-s1", seriesId: "daredevilba", number: 1, label: "Season 1", episodes: 9, year: 2025 },
  "daredevilba-s2": { id: "daredevilba-s2", seriesId: "daredevilba", number: 2, label: "Season 2", episodes: 8, year: 2026 },
  "ironheart-s1": { id: "ironheart-s1", seriesId: "ironheart", number: 1, label: "Season 1", episodes: 6, year: 2025 },
  "wonderman-s1": { id: "wonderman-s1", seriesId: "wonderman", number: 1, label: "Season 1", episodes: 8, year: 2026 },
  "agentcarter-s1": { id: "agentcarter-s1", seriesId: "agentcarter", number: 1, label: "Season 1", episodes: 8, year: 2015 },
  "agentcarter-s2": { id: "agentcarter-s2", seriesId: "agentcarter", number: 2, label: "Season 2", episodes: 10, year: 2016 },
  "eyeswakanda-s1": { id: "eyeswakanda-s1", seriesId: "eyeswakanda", number: 1, label: "Season 1", episodes: 4, year: 2025 },
  // otherEarth: "Earth-89521" - a direct continuation of the What If...?
  // season 1 episode "What If... Zombies?!" (itself part of the "Outside
  // Time" anthology above, no fixed date of its own), picking up "five
  // years" after that episode's ending - unlike Loki/What If...? though,
  // this is one continuous story set on ONE specific reality, not an
  // anthology jumping across many, so it gets a real (if approximate)
  // otherEarth placement instead of "Outside Time" - Earth-89521 per
  // Marvel Database (not Earth-2149, the unrelated classic comics
  // "Marvel Zombies" reality this show's title nods to but doesn't
  // depict). No specific in-universe year confirmed beyond "five years
  // after" an already-undated episode, so "cca" from its own release
  // year, same as every other undated otherEarth title. Filed under the
  // generic "others" Multiverse bucket for now, same as Your Friendly
  // Neighborhood Spider-Man's Earth-86445 - not given its own named
  // bucket/color yet (see EARTH_BUCKETS' own comment in data.js).
  "marvelzombies-s1": { id: "marvelzombies-s1", seriesId: "marvelzombies", number: 1, label: "Season 1", episodes: 4, year: 2025, otherEarth: { label: "Earth-89521", year: "cca 2025" } },
  // otherEarth here (see movie.otherEarth's own comment, and
  // yourfriendlyspiderman's above) - buildSeriesCard() (app.js) only
  // checks the FIRST season of a merged card, so every season of a show
  // that's otherEarth needs this set, not just its first. Only one season
  // exists so far, but a future S2 (announced for Jan 2027, no episode
  // count yet - not added until that's confirmed, same rule as any other
  // curated season count) would need it too.
  "yourfriendlyspiderman-s1": { id: "yourfriendlyspiderman-s1", seriesId: "yourfriendlyspiderman", number: 1, label: "Season 1", episodes: 10, year: 2025, otherEarth: { label: "Earth-86445", year: "2025" } },
  // Only plain episode COUNTS below (no episodeTitles/episodeRuntimes) -
  // same uncurated default every other Marvel show in this file uses
  // unless the user supplied titles directly (see CLAUDE.md's own
  // per-episode data rule). Counts/years verified via Wikipedia, not
  // guessed.
  "daredevil-s1": { id: "daredevil-s1", seriesId: "daredevil", number: 1, label: "Season 1", episodes: 13, year: 2015 },
  "daredevil-s2": { id: "daredevil-s2", seriesId: "daredevil", number: 2, label: "Season 2", episodes: 13, year: 2016 },
  "jessicajones-s1": { id: "jessicajones-s1", seriesId: "jessicajones", number: 1, label: "Season 1", episodes: 13, year: 2015 },
  "lukecage-s1": { id: "lukecage-s1", seriesId: "lukecage", number: 1, label: "Season 1", episodes: 13, year: 2016 },
  "ironfist-s1": { id: "ironfist-s1", seriesId: "ironfist", number: 1, label: "Season 1", episodes: 13, year: 2017 },
  "defenders-s1": { id: "defenders-s1", seriesId: "defenders", number: 1, label: "Season 1", episodes: 8, year: 2017 },
  "iamgroot-s1": { id: "iamgroot-s1", seriesId: "iamgroot", number: 1, label: "Season 1", episodes: 5, year: 2022 },
  "iamgroot-s2": { id: "iamgroot-s2", seriesId: "iamgroot", number: 2, label: "Season 2", episodes: 5, year: 2023 },
};

// Chronological eras follow "The Marvel Cinematic Universe: An Official
// Timeline" (Marvel Studios/DK, October 2023) as closely as this app's own
// card-per-season granularity allows - season/quarter labels below (e.g.
// "Spring 2024") are that book's own real table entries, cross-checked
// directly against it, not estimated. That table's own LAST row is
// "December 2025: The Guardians of the Galaxy Holiday Special" - nothing
// past that point (Ant-Man and the Wasp: Quantumania, Guardians Vol. 3,
// Secret Invasion, Loki season 2, The Marvels, Agatha All Along, and
// everything in the "Present Day" era below) is actually in the book,
// despite most of those having released BEFORE its October 2023 cutoff -
// they're this app's own best-effort placement instead, flagged "cca"
// throughout rather than presented as sourced. Loki season 1 is the one
// exception mid-table - never listed in the book at all (its own
// surrounding text notes the season "exists outside of time and space"
// once the TVA enters the picture), so it gets a "cca" band of its own
// too rather than sharing WandaVision's exact "Fall 2023".
//   One deliberate simplification versus what the book's table DOES
// cover: it spreads a handful of TV seasons across MULTIPLE non-
// contiguous windows in the same year (most notably She-Hulk: Attorney at
// Law, whose 9 episodes the table places across four separate points from
// Fall 2024 to Fall 2025) - this app has no per-episode chronological
// slicing (unlike Star Wars' curated story-line slices, which split by
// CONTENT, not by air-date), so each season still shows as one whole
// card, placed at whichever single window covers the most of it.
//   Several titles carry movie.otherEarth/season.otherEarth (see that
// field's own comment) - visually flagged as "glued onto" the axis from
// outside Earth-616 (card--other-earth in style.css) rather than
// excluded, but still sitting in the normal sequence, sorted by its own
// true year exactly like any other card - INTERLEAVED with Sacred
// Timeline wherever that year actually falls, not grouped together as
// its own separate block. (An earlier pass tried keeping the whole
// Earth-10005 run as one contiguous "island" positioned near Agent
// Carter/Fantastic Four - wrong: xmenwolverine/deadpool1/deadpool2/
// newmutants/logan's own years (2013-2029) run well past that island's
// neighbors, so keeping them glued to xmenfirstclass/the trilogy instead
// of their own correct spots read as visibly out of order the moment you
// actually looked at the sequence of numbers - "chronological" has to
// mean every card sorted by true year, full stop, switching between
// Sacred Timeline and any number of foreign Earths as many times as that
// requires.) Deadpool & Wolverine (Earth-10005, "now" - no distinct date
// beyond its own 2024 release) sits between Spider-Man: Far From Home's
// Summer 2024 and Eternals' Fall 2024; Your Friendly Neighborhood
// Spider-Man (Earth-86445) sits at its own 2025
// release slot next to Echo - each purely by its own true year, same as
// every Earth-10005 title. The Fantastic Four: First Steps (Earth-828,
// 1964) is the one deliberate EXCEPTION to this - see its own comment on
// MOVIES_MARVEL above for why it sits between thunderbolts and
// wonderman-s1 (cca 2026) instead of interleaved back at its own 1964,
// same category of user-requested override as the xmendofp rewrite
// cluster further down. drawConnectors() (app.js) renders a SOLID line
// between two
// adjacent cards that happen to share the exact same otherEarth.label
// (e.g. two X-Men films that landed next to each other after the full
// sort) and a dashed line at any other seam - crossing into/out of Sacred
// Timeline, or into/out of a DIFFERENT foreign Earth - see its own
// comment for the mechanism; the connector itself stays ONE universal
// color regardless of which Earth, see the color comment on
// --other-earth-current near :root in style.css for why.
const ORDERINGS_MARVEL = [
  {
    id: "chronological",
    label: "Chronological",
    description: "Ideal if you're already familiar with the story and want to experience every event in exact in-universe order.",
    // ONE flat era, deliberately - unlike Star Wars' own Chronological,
    // which leans heavily on named eras ("Fall of the Jedi" etc.) as a
    // core piece of its design. Marvel's own era breakdown (Ancient
    // History / Origins / Ultron to Civil War / Infinity Saga / Multiverse
    // Saga x2 / Present Day) existed here briefly but was dropped again -
    // it read as more clutter than signal for a first pass and wasn't
    // worth the design attention yet ("možná se k tomu vrátíme" - it can
    // come back later, deliberately, once it's worth doing well). The
    // yearBands strip and the era-label reservation/divider (both driven
    // by the SAME empty-label mechanism Release Order already uses, see
    // its own comment below) stay exactly as before - only the actual
    // era TITLES and their descriptions are gone. Concatenating what used
    // to be 7 separate eras into one doesn't need any yearBands span
    // recalculation - each band's span still covers the exact same run of
    // cards it always did, era boundaries never affected that counting.
    eras: [
      {
        id: "all",
        label: "",
        // cardGapBefore (render() in app.js, .card--gap-before in css) is
        // ORDERINGS_STARWARS' era-level `gapBefore` (see its own comment
        // above ORDERINGS_STARWARS) one level finer - this era has no
        // internal boundaries to hang that coarser mechanism off of (it's
        // deliberately ONE flat era, see the comment above), so a big
        // in-universe time jump MID-era instead pulls just that one card
        // further from its predecessor. Threshold: any jump bigger than 10
        // years between one card's yearBands year and the next gets this,
        // but ONLY within a single continuous story/timeline, checked
        // against the FINAL fully-interleaved sequence (see the yearBands
        // comment below for why every otherEarth title sorts by its own
        // true year rather than sitting apart from Sacred Timeline) -
        // eyeswakanda-s1's own ancient/legendary span (1260 BC - 1896)
        // into cap1's 1943 WWII origin (the real start of Sacred
        // Timeline's linear modern history) is the only one that
        // qualifies. Every other >10-year jump on the axis (there are
        // several, e.g. darkphoenix's 1992 into captainmarvel1's 1995 is
        // fine but logan's 2029 sits after spiderman4's cca 2028 at the
        // very end with nothing after it to gap against) turns out to
        // either fall under the threshold once actually measured against
        // its REAL neighbor post-interleave, or land at a universe
        // crossing - which this deliberately excludes even when the raw
        // gap is large, since crossing into/out of a different Earth
        // entirely isn't "time passing in the same story" the way this
        // mechanism is meant to convey, and drawConnectors()'s own dashed
        // connector line at exactly that seam already flags the
        // discontinuity, more precisely and without implying "this is
        // still one continuous timeline, just with a long gap in it".
        cardGapBefore: ["cap1"],
        itemIds: [
          "eyeswakanda-s1",
          "cap1",
          "oneshotagentcarter",
          "agentcarter-s1",
          "agentcarter-s2",
          "xmenfirstclass",
          "xmenoriginswolverine",
          "captainmarvel1",
          "xmen1",
          "spidermanraimi1",
          "xmen2",
          "spidermanraimi2",
          "xmen3",
          "spidermanraimi3",
          "ironman1",
          "ironman2",
          "hulk",
          "oneshotfunnything",
          "thor1",
          "oneshotconsultant",
          "avengers1",
          "oneshotitem47",
          "amazingspiderman1",
          "xmenwolverine",
          "thor2",
          "ironman3",
          "oneshotallhailtheking",
          "cap2",
          "gotg1",
          "amazingspiderman2",
          "gotg2",
          "iamgroot-s1",
          "iamgroot-s2",
          "daredevil-s1",
          "jessicajones-s1",
          "avengers2",
          "antman1",
          "daredevil-s2",
          "lukecage-s1",
          "ironfist-s1",
          "defenders-s1",
          "cap3",
          "blackwidow",
          "blackpanther1",
          "spiderman1",
          "drstrange1",
          "thor3",
          "antman2",
          "avengers3",
          "venom1",
          "venom2",
          "morbius",
          "xmendofp",
          "xmenapocalypse",
          "darkphoenix",
          "deadpool1",
          "newmutants",
          "deadpool2",
          "avengers4",
          "loki-s1",
          "loki-s2",
          "wandavision-s1",
          "madameweb",
          "shangchi",
          "whatif-s1",
          "marvelzombies-s1",
          "falconws-s1",
          "spiderman2",
          "deadpool3",
          "venom3",
          "eternals",
          "spiderman3",
          "drstrange2",
          "kraven",
          "hawkeye-s1",
          "echo-s1",
          "yourfriendlyspiderman-s1",
          "moonknight-s1",
          "blackpanther2",
          "shehulk-s1",
          "ironheart-s1",
          "msmarvel-s1",
          "thor4",
          "whatif-s2",
          "werewolfnight",
          "gotgholiday",
          "antman3",
          "gotg3",
          "secretinvasion-s1",
          "marvels",
          "agatha-s1",
          "whatif-s3",
          "cap4",
          "thunderbolts",
          "fantasticfour1",
          "wonderman-s1",
          "daredevilba-s1",
          "daredevilba-s2",
          "spiderman4",
          "logan",
        ],
        // agentcarter-s1/-s2 and daredevilba-s1/-s2 each merge into ONE
        // card (same seriesId, consecutive - see groupEraItems() in
        // app.js), so they share ONE band entry each below, not two -
        // yearBands walks rendered CARDS, not raw itemIds, and authoring
        // one span per raw id when two of them merge shifts every band
        // after it onto the wrong card (hit this for real once already -
        // see Gotcha #12 in CLAUDE.md).
        //   loki-s1 AND loki-s2 together get one "OUTSIDE TIME" band
        // (otherEarth: "Outside Time", its own Multiverse bucket - see
        // EARTH_BUCKETS above), sitting between avengers4 (the Tesseract
        // theft season 1 spins out of) and wandavision-s1 - splitting what
        // would otherwise be one plain "Fall 2023" span:2 band into two
        // separate span:1 "Fall 2023" bands either side of it (same
        // span-splitting care as Gotcha #12 above). The two seasons share
        // seriesId "loki" and sit CONSECUTIVELY in itemIds above, so
        // groupEraItems() merges them into one card - the band's own span
        // stays 1 either way (span counts CARDS, see Gotcha #12), not 2.
        //   No year at all, not even a "cca" one: the official chronological
        // reference this file otherwise follows explicitly declines to
        // place Loki on the timeline at all (per its own surrounding text,
        // the season "exists outside of time and space" once the TVA
        // enters the picture) - an earlier pass gave it a placeholder
        // "cca 2023" anyway, which read as a real (if approximate) date the
        // same way every other "cca" band on this axis does, exactly the
        // impression the show's own premise contradicts. `noTimeline: true`
        // (drawYearBands(), app.js) strips this ONE band down further than
        // any other otherEarth band on the axis: no `.year-band__earth`
        // sub-label (it would just repeat "OUTSIDE TIME" a second time -
        // every other otherEarth band's sub-label names something DIFFERENT
        // from its main label, the Earth vs. the date, but here they're the
        // same string) and no `.year-band__span` reach-indicator line
        // either (that line's whole job is pointing at "these specific
        // cards on the timeline" - the opposite of what this band is
        // saying). Just the literal label plus its own otherEarth color, so
        // it reads as distinctly NOT a date rather than a date this app
        // couldn't pin down.
        //   Every otherEarth title (fantasticfour1, the whole Earth-10005
        // roster, yourfriendlyspiderman-s1) sits chronologically by its
        // OWN in-universe year, fully INTERLEAVED with Sacred Timeline
        // wherever that year actually falls - never grouped apart as its
        // own separate run, see the big comment above ORDERINGS_MARVEL for
        // why an earlier "keep them all together" design was wrong. Each
        // still gets its own one-off yearBands entry (never sharing a
        // neighbor's plain band, even when the year happens to match one -
        // deadpool3's "2024" is its own entry, not merged into
        // spiderman2's neighboring "Summer 2024") so `otherEarth` (see the
        // comment on that movie's own entry) can render the band in that
        // Earth's own color (`--other-earth-current`, style.css) with its
        // own sub-label ("EARTH-828"/"EARTH-10005"/"ALT. EARTH",
        // drawYearBands() in app.js) instead of silently blending into
        // whatever's next to it - the whole point of otherEarth is to be
        // visible at the TOP of the axis too, not just on the card itself.
        // Deadpool & Wolverine's own otherEarth.year ("2024") had drifted
        // out of sync with its yearBands label ("cca 2026", left over from
        // an earlier layout) until this pass - caught the same way the
        // whole re-sort was verified: walking the final rendered sequence
        // and checking every label's year against its neighbors, not by
        // eyeballing one card at a time.
        // xmendofp/xmenapocalypse/darkphoenix/deadpool1/newmutants/
        // deadpool2's six consecutive bands below ("2023 + rewrite 1973"
        // through "rewrite 2018") are a deliberate, one-off EXCEPTION to
        // the "full interleave, always monotonic except at an otherEarth
        // seam" principle documented at length above ORDERINGS_MARVEL and
        // enforced everywhere else on this axis: read top to bottom they go
        // 2023 -> 1983 -> 1992 -> 2016 -> late-2010s -> 2018, i.e. backward
        // then forward again, entirely by request - the user wanted
        // xmendofp shown at its OWN 2023 rewrite-event position with the
        // five movies that take place in the timeline it rewrites
        // immediately following it as one clustered mini-sequence, not
        // scattered back into their own individual year slots the way
        // every other otherEarth title on this axis is. Originally placed
        // right after avengers4/loki-s1+s2/wandavision-s1 (i.e. AFTER the
        // "Fall 2023" real-world content it's conceptually anchored to);
        // moved to sit right BEFORE avengers4 instead on request, still
        // between morbius (cca 2022) and the "Fall 2023" bands - the
        // cluster's own INTERNAL order and content never changed, only
        // its position relative to Endgame/Loki/WandaVision. A future
        // full-resort pass (see the Python-script methodology mentioned
        // earlier in this file) needs to special-case this cluster - treat
        // it as one fixed unit that moves as a block - rather than "fixing"
        // it back into strict year order. All six still connect with a
        // SOLID line (drawConnectors() only compares otherEarth.label, not
        // variant, and every card here shares the same "Earth-10005"
        // label) and dashed seams on both outer edges (morbius before,
        // avengers4 after) - visually reading as one foreign-universe
        // island, which is exactly the point.
        yearBands: [
          { label: "1260 BC – 1896", span: 1 },
          { label: "1943–1945", span: 1 },
          { label: "1946", span: 1 },
          { label: "1946–1947", span: 1 },
          { label: "1962", span: 1, otherEarth: "Earth-10005" },
          { label: "1979", span: 1, otherEarth: "Earth-10005", otherEarthVariant: "Original" },
          { label: "Summer 1995", span: 1 },
          { label: "cca 2000", span: 1, otherEarth: "Earth-10005", otherEarthVariant: "Original" },
          { label: "cca 2002", span: 1, otherEarth: "Earth-96283" },
          { label: "cca 2003", span: 1, otherEarth: "Earth-10005", otherEarthVariant: "Original" },
          { label: "cca 2004", span: 1, otherEarth: "Earth-96283" },
          { label: "cca 2006", span: 1, otherEarth: "Earth-10005", otherEarthVariant: "Original" },
          { label: "cca 2007", span: 1, otherEarth: "Earth-96283" },
          { label: "Early–Spring 2008", span: 1 },
          { label: "Spring 2010", span: 2 },
          { label: "cca Spring 2010", span: 1 },
          { label: "Spring 2010", span: 1 },
          { label: "cca 2011", span: 1 },
          { label: "Spring 2012", span: 1 },
          { label: "cca Summer 2012", span: 1 },
          { label: "cca 2012", span: 1, otherEarth: "Earth-120703" },
          { label: "cca 2013", span: 1, otherEarth: "Earth-10005", otherEarthVariant: "Original" },
          { label: "Fall 2013", span: 1 },
          { label: "December 2013 – Early 2014", span: 1 },
          { label: "cca early 2014", span: 1 },
          { label: "Spring 2014", span: 1 },
          { label: "Summer 2014", span: 1 },
          { label: "cca 2014", span: 1, otherEarth: "Earth-120703" },
          { label: "Fall 2014", span: 1 },
          { label: "cca 2014–2015", span: 1 },
          { label: "cca 2015", span: 2 },
          { label: "Spring 2015", span: 1 },
          { label: "Summer 2015", span: 1 },
          { label: "cca 2016", span: 2 },
          { label: "cca 2017", span: 2 },
          { label: "Spring 2016", span: 1 },
          { label: "Spring–Summer 2016", span: 1 },
          { label: "Summer 2016", span: 1 },
          { label: "Fall 2016", span: 1 },
          { label: "Fall 2016–2017", span: 1 },
          { label: "Fall 2017", span: 1 },
          { label: "Spring 2018", span: 2 },
          { label: "cca 2018", span: 1, otherEarth: "Earth-688" },
          { label: "cca 2021", span: 1, otherEarth: "Earth-688" },
          { label: "cca 2022", span: 1, otherEarth: "Earth-688" },
          { label: "2023 + rewrite 1973", span: 1, otherEarth: "Earth-10005" },
          { label: "rewrite 1983", span: 1, otherEarth: "Earth-10005", otherEarthVariant: "Rewrite" },
          { label: "rewrite 1992", span: 1, otherEarth: "Earth-10005", otherEarthVariant: "Rewrite" },
          { label: "rewrite 2016", span: 1, otherEarth: "Earth-10005", otherEarthVariant: "Rewrite" },
          { label: "rewrite late 2010s", span: 1, otherEarth: "Earth-10005", otherEarthVariant: "Rewrite" },
          { label: "rewrite 2018", span: 1, otherEarth: "Earth-10005", otherEarthVariant: "Rewrite" },
          { label: "Fall 2023", span: 1 },
          { label: "OUTSIDE TIME", span: 1, otherEarth: "Outside Time", noTimeline: true },
          { label: "Fall 2023", span: 1 },
          { label: "cca 2024", span: 1, otherEarth: "Earth-688" },
          { label: "Spring 2024", span: 1 },
          { label: "OUTSIDE TIME", span: 1, otherEarth: "Outside Time", noTimeline: true },
          { label: "cca 2025", span: 1, otherEarth: "Earth-89521" },
          { label: "Spring 2024", span: 1 },
          { label: "Summer 2024", span: 1 },
          { label: "2024", span: 1, otherEarth: "Earth-10005" },
          { label: "cca 2024", span: 1, otherEarth: "Earth-688" },
          { label: "Fall 2024", span: 3 },
          { label: "cca 2024", span: 1, otherEarth: "Earth-688" },
          { label: "December 2024", span: 1 },
          { label: "cca early 2025", span: 1 },
          { label: "cca early 2025", span: 1, otherEarth: "Earth-86445" },
          { label: "Spring 2025", span: 2 },
          { label: "Summer 2025", span: 1 },
          { label: "cca Fall 2025", span: 1 },
          { label: "Fall 2025", span: 2 },
          { label: "OUTSIDE TIME", span: 1, otherEarth: "Outside Time", noTimeline: true },
          { label: "Fall 2025", span: 1 },
          { label: "December 2025", span: 1 },
          { label: "cca 2026", span: 5 },
          { label: "OUTSIDE TIME", span: 1, otherEarth: "Outside Time", noTimeline: true },
          { label: "cca 2026", span: 2 },
          { label: "back to 1964", span: 1, otherEarth: "Earth-828" },
          { label: "cca 2026", span: 1 },
          { label: "cca late 2026 – 2027", span: 1 },
          { label: "cca 2028", span: 1 },
          { label: "2029", span: 1, otherEarth: "Earth-10005" },
        ],
      },
    ],
  },

  {
    id: "release",
    label: "Release Order",
    description: "Ideal for your first watch. Follow the real release order and experience every twist, reveal, and post-credits tease exactly as audiences first did.",
    // ONE flat era, deliberately - same reasoning as Star Wars' own Release
    // Order (see the comment on ORDERINGS in data.js): every movie and
    // season, Phases included, in one itemIds list sorted purely by
    // real-world release year. label is deliberately "" for the same
    // reason too - a real label on an era spanning the entire, multi-
    // thousand-px-wide track would render off in the horizontal middle of
    // the whole timeline, invisible without scrolling there first.
    //   Unlike the chronological ordering, every otherEarth title here
    // (Fantastic Four, Deadpool & Wolverine, Your Friendly Neighborhood
    // Spider-Man - see movie.otherEarth's own comment above) sits at its
    // plain real-world release slot with no otherEarth styling at all -
    // release order is about the real-world release calendar, not
    // in-universe continuity, so which Earth a title is nominally set on
    // doesn't matter here the way it does there (isChronological gates
    // otherEarth off entirely in buildCard()/buildSeriesCard(), app.js).
    eras: [
      {
        id: "all",
        label: "",
        itemIds: [
          "xmen1",
          "spidermanraimi1",
          "xmen2",
          "spidermanraimi2",
          "xmen3",
          "spidermanraimi3",
          "ironman1",
          "hulk",
          "xmenoriginswolverine",
          "ironman2",
          "thor1",
          "xmenfirstclass",
          "cap1",
          "oneshotconsultant",
          "oneshotfunnything",
          "avengers1",
          "amazingspiderman1",
          "oneshotitem47",
          "ironman3",
          "oneshotagentcarter",
          "thor2",
          "xmenwolverine",
          "oneshotallhailtheking",
          "cap2",
          "amazingspiderman2",
          "gotg1",
          "xmendofp",
          "agentcarter-s1",
          "daredevil-s1",
          "avengers2",
          "antman1",
          "jessicajones-s1",
          "agentcarter-s2",
          "deadpool1",
          "daredevil-s2",
          "cap3",
          "xmenapocalypse",
          "lukecage-s1",
          "drstrange1",
          "logan",
          "ironfist-s1",
          "gotg2",
          "spiderman1",
          "defenders-s1",
          "thor3",
          "blackpanther1",
          "avengers3",
          "deadpool2",
          "antman2",
          "venom1",
          "captainmarvel1",
          "avengers4",
          "darkphoenix",
          "spiderman2",
          "newmutants",
          "wandavision-s1",
          "falconws-s1",
          "loki-s1",
          "blackwidow",
          "whatif-s1",
          "shangchi",
          "venom2",
          "eternals",
          "hawkeye-s1",
          "spiderman3",
          "moonknight-s1",
          "morbius",
          "drstrange2",
          "msmarvel-s1",
          "thor4",
          "iamgroot-s1",
          "shehulk-s1",
          "werewolfnight",
          "blackpanther2",
          "gotgholiday",
          "antman3",
          "gotg3",
          "secretinvasion-s1",
          "iamgroot-s2",
          "loki-s2",
          "marvels",
          "whatif-s2",
          "madameweb",
          "echo-s1",
          "deadpool3",
          "agatha-s1",
          "venom3",
          "kraven",
          "whatif-s3",
          "yourfriendlyspiderman-s1",
          "cap4",
          "daredevilba-s1",
          "thunderbolts",
          "ironheart-s1",
          "fantasticfour1",
          "eyeswakanda-s1",
          "marvelzombies-s1",
          "wonderman-s1",
          "daredevilba-s2",
          "spiderman4",
        ],
        // Same otherEarth split-per-band treatment as Chronological's own
        // yearBands (see the big comment on ORDERINGS_MARVEL and Gotcha #12)
        // - every band that would otherwise cover a MIX of Sacred Timeline
        // and otherEarth cards, or cards from two DIFFERENT otherEarth
        // universes, breaks into one sub-band per otherEarth-identity run
        // instead, purely so `drawYearBands()` (app.js) can color each
        // sub-band's own label/reach-indicator line in that Earth's own
        // color - requested explicitly, to make "this row is a different
        // universe" visible on the axis under Release Order too, not just
        // functional (the Multiverse filter itself already worked here).
        // The LABEL TEXT is still the plain real release year on every
        // sub-band, same as its neighbors (e.g. three separate "2016"
        // entries in a row, span 1 apiece, if that year happens to mix
        // Sacred Timeline and otherEarth titles) - only the color and
        // span change, never the year itself. Unlike Chronological, these
        // do NOT get an `.year-band__earth` sub-label naming the Earth
        // (drawYearBands() gates that specifically on isChronological) -
        // the label above it is a real release date, not a date "from the
        // film" the way otherEarth.year is under Chronological, so naming
        // the Earth right under it would misleadingly suggest otherwise;
        // the color alone already carries the "this is a different world"
        // signal. Regenerated with the same script-based approach used for
        // every other yearBands split in this file (walk itemIds in
        // lockstep with the ORIGINAL bands, split each into runs of
        // identical otherEarth-identity, verify span total still equals
        // the era's real card count) rather than hand-edited - this array
        // alone splits from 25 bands to 53 (59 once loki-s1's/loki-s2's/
        // all three whatif seasons' own "Outside Time" entries each split
        // or extend their own real-release-year bands further, same
        // reasoning as Chronological's own OUTSIDE TIME bands - see the
        // comment there), too many to safely hand-split without the same
        // kind of mistake Gotcha #12 already describes. Every otherEarth
        // title's own sub-band here keeps its real release-year label
        // (e.g. whatif-s2's "2023", whatif-s3's "2024"), unlike
        // Chronological's literal "OUTSIDE TIME" - Release Order is about
        // the real release calendar, which every one of these unambiguously
        // has a date on, same "no in-universe styling changes what's still
        // a real release" reasoning as every other otherEarth title under
        // this ordering.
        yearBands: [
          { label: "2000", span: 1, otherEarth: "Earth-10005", otherEarthVariant: "Original" },
          { label: "2002", span: 1, otherEarth: "Earth-96283" },
          { label: "2003", span: 1, otherEarth: "Earth-10005", otherEarthVariant: "Original" },
          { label: "2004", span: 1, otherEarth: "Earth-96283" },
          { label: "2006", span: 1, otherEarth: "Earth-10005", otherEarthVariant: "Original" },
          { label: "2007", span: 1, otherEarth: "Earth-96283" },
          { label: "2008", span: 2 },
          { label: "2009", span: 1, otherEarth: "Earth-10005", otherEarthVariant: "Original" },
          { label: "2010", span: 1 },
          { label: "2011", span: 1 },
          { label: "2011", span: 1, otherEarth: "Earth-10005" },
          { label: "2011", span: 3 },
          { label: "2012", span: 1 },
          { label: "2012", span: 1, otherEarth: "Earth-120703" },
          { label: "2012", span: 1 },
          { label: "2013", span: 3 },
          { label: "2013", span: 1, otherEarth: "Earth-10005", otherEarthVariant: "Original" },
          { label: "2014", span: 2 },
          { label: "2014", span: 1, otherEarth: "Earth-120703" },
          { label: "2014", span: 1 },
          { label: "2014", span: 1, otherEarth: "Earth-10005" },
          { label: "2015", span: 5 },
          { label: "2016", span: 1 },
          { label: "2016", span: 1, otherEarth: "Earth-10005", otherEarthVariant: "Rewrite" },
          { label: "2016", span: 2 },
          { label: "2016", span: 1, otherEarth: "Earth-10005", otherEarthVariant: "Rewrite" },
          { label: "2016", span: 2 },
          { label: "2017", span: 1, otherEarth: "Earth-10005" },
          { label: "2017", span: 5 },
          { label: "2018", span: 2 },
          { label: "2018", span: 1, otherEarth: "Earth-10005", otherEarthVariant: "Rewrite" },
          { label: "2018", span: 1 },
          { label: "2018", span: 1, otherEarth: "Earth-688" },
          { label: "2019", span: 2 },
          { label: "2019", span: 1, otherEarth: "Earth-10005", otherEarthVariant: "Rewrite" },
          { label: "2019", span: 1 },
          { label: "2020", span: 1, otherEarth: "Earth-10005", otherEarthVariant: "Rewrite" },
          { label: "2021", span: 2 },
          { label: "2021", span: 1, otherEarth: "Outside Time" },
          { label: "2021", span: 1 },
          { label: "2021", span: 1, otherEarth: "Outside Time" },
          { label: "2021", span: 1 },
          { label: "2021", span: 1, otherEarth: "Earth-688" },
          { label: "2021", span: 3 },
          { label: "2022", span: 1 },
          { label: "2022", span: 1, otherEarth: "Earth-688" },
          { label: "2022", span: 8 },
          { label: "2023", span: 6 },
          { label: "2023", span: 1, otherEarth: "Outside Time" },
          { label: "2024", span: 1, otherEarth: "Earth-688" },
          { label: "2024", span: 1 },
          { label: "2024", span: 1, otherEarth: "Earth-10005" },
          { label: "2024", span: 1 },
          { label: "2024", span: 2, otherEarth: "Earth-688" },
          { label: "2024", span: 1, otherEarth: "Outside Time" },
          { label: "2025", span: 1, otherEarth: "Earth-86445" },
          { label: "2025", span: 4 },
          { label: "2025", span: 1, otherEarth: "Earth-828" },
          { label: "2025", span: 1 },
          { label: "2025", span: 1, otherEarth: "Earth-89521" },
          { label: "2026", span: 3 },
        ],
      },
    ],
  },
];
// Marvel Studios/Disney+'s own officially-announced "watch before Avengers:
// Doomsday" list - NOT this app's own curation, a fixed externally-sourced
// list (confirmed across multiple outlets reporting Disney+'s own official
// watchlist page, e.g. https://screenrant.com/avengers-doomsday-marvel-
// movies-shows-watch-list-disney-plus-confirms/ and
// https://movieweb.com/marvel-must-watch-before-avengers-doomsday/ as of
// August 2026) - 15 titles: two pre-MCU Fox X-Men films (the on-screen tie
// to Doomsday's own returning cast), four Infinity Saga entries, one
// Disney+ series, and eight Multiverse Saga titles. Order here doesn't
// matter - buildDoomsdayWatchlistToggle()'s own filter (app.js) just needs
// the SET of ids, actual on-screen order still comes from whichever
// ordering (Chronological/Release Order) is currently active, same as
// every other filter in this app. "Loki" is included as `loki-s1` only,
// not both seasons - every source reporting this list dates the entry
// "(2021)", season 1's own release year, not season 2's 2023.
const DOOMSDAY_WATCHLIST_MARVEL = [
  "xmen1",
  "xmen2",
  "cap1",
  "avengers1",
  "avengers3",
  "avengers4",
  "loki-s1",
  "shangchi",
  "spiderman3",
  "drstrange2",
  "blackpanther2",
  "deadpool3",
  "cap4",
  "thunderbolts",
  "fantasticfour1",
];
// "Core MCU" checkbox (app.js) - unlike DOOMSDAY_WATCHLIST_MARVEL above,
// this is NOT a hand-curated list of ids: `filterItemIdsForCoreMcu()`
// (app.js) computes membership live from each title's own `otherEarth`
// field (present = not Sacred Timeline = excluded) so any future
// Sacred-Timeline addition is automatically included without this file
// needing an update. This array is the one deliberate EXCEPTION that
// otherEarth alone can't express - Agent Carter (`agentcarter-s1`/`-s2`)
// is genuine Earth-616/Sacred Timeline continuity (no otherEarth field at
// all) but was produced by the OLD "Marvel Television" division under ABC
// Studios, years before Marvel TV merged into Marvel Studios in 2019 -
// not "that modern Marvel Studios production" the checkbox is named for,
// even though it's unquestionably the same continuity. Everything else
// Sacred-Timeline in this dataset - including period pieces like Captain
// America: The First Avenger (1943) or the ancient-history anthology Eyes
// of Wakanda - IS a real Marvel Studios production regardless of when
// its own story is SET, so none of them need listing here; only the
// production-company exception does.
const CORE_MCU_EXCLUDE_MARVEL = ["agentcarter-s1", "agentcarter-s2"];
const FRANCHISE_DATA = {
  starwars: {
    movies: MOVIES_STARWARS,
    series: SERIES_STARWARS,
    seasons: SEASONS_STARWARS,
    orderings: ORDERINGS_STARWARS,
    storyLines: STORY_LINES_STARWARS,
    // No Doomsday watchlist - that's a Marvel-specific real-world
    // marketing campaign, meaningless for Star Wars. Same "empty array
    // hides the whole control" pattern as storyLines: [] below does for
    // Marvel - see populateDoomsdayWatchlistToggle() in app.js.
    doomsdayWatchlist: [],
    // "Core MCU" has no meaning for Star Wars either - unlike
    // doomsdayWatchlist above, this control doesn't hide on an empty
    // array here (an empty exclude list is meaningless on its own, since
    // membership is otherEarth-derived) - populateCoreMcuToggle() instead
    // reuses the exact same "does this franchise have ANY otherEarth
    // content at all" check populateMultiverseMenu() already uses, since
    // a franchise with none has nothing for this filter to meaningfully
    // narrow down either. This field only matters for Marvel below.
    coreMcuExclude: [],
  },
  marvel: {
    movies: MOVIES_MARVEL,
    series: SERIES_MARVEL,
    seasons: SEASONS_MARVEL,
    orderings: ORDERINGS_MARVEL,
    // No story lines yet - populateStoryLineMenu() (app.js) hides the
    // Storylines control entirely whenever the active franchise's array
    // is empty, so this isn't a placeholder to fill in before Marvel is
    // "done" - it's a real, supported state.
    storyLines: [],
    doomsdayWatchlist: DOOMSDAY_WATCHLIST_MARVEL,
    coreMcuExclude: CORE_MCU_EXCLUDE_MARVEL,
  },
};

// The "active" bindings every function in app.js reads as bare
// identifiers - see applyFranchiseData() there. `let`, not `const`,
// specifically so app.js CAN reassign them on a franchise switch; start
// out pointing at Star Wars' own data, the default franchise (FRANCHISES[0]).
let MOVIES = MOVIES_STARWARS;
let SERIES = SERIES_STARWARS;
let SEASONS = SEASONS_STARWARS;
let ORDERINGS = ORDERINGS_STARWARS;
let STORY_LINES = STORY_LINES_STARWARS;
