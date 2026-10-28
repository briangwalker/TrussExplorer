// ===== Truss names: generated default names for new designs (#27) =====
// "<Word> <Type> <code>", e.g. "Maple Pratt k3f9" (Brian, 2026-10-27).
//   Word: one from WORDS, at random (never the same word twice in a row)
//   Type: the bridge type, from the family and diagonal pattern
//   code: 4 characters from the time (minutes since 2026-01-01 UTC), so it is the same wherever you are, written in
//         CODE_ALPHABET: digits and consonants only (no a e i o u, and no l), so a code can never spell a word
//         (Dev Lead review, #195). It repeats every 30^4 minutes (~1.5 years); the file's savedAt has the full date.
// This becomes the public title in the shared database (#16), stored as autoName (docs/formats.md), so:
//   the word list is fixed and reviewed (letters only, nothing unkind in any combination), and a name that has been
//   given is stored, never recomputed, so changing this list never renames an existing design.
// No DOM, no app state: Node tests load it directly; build.py inlines it before app.js.
(function (root) {
'use strict';

const WORDS = [
  'Acorn', 'Alder', 'Amber', 'Anchor', 'Apple', 'Arbor', 'Aspen', 'Atlas', 'Aurora', 'Badger', 'Balsa', 'Bamboo', 'Basil', 'Beacon', 'Birch', 'Bison',
  'Bluebell', 'Bramble', 'Breeze', 'Brook', 'Cabin', 'Canyon', 'Cardinal', 'Cedar', 'Chestnut', 'Cinder', 'Clover', 'Cobalt', 'Comet', 'Copper', 'Coral', 'Cricket',
  'Cypress', 'Dahlia', 'Delta', 'Dune', 'Ember', 'Falcon', 'Fern', 'Fjord', 'Flint', 'Garnet', 'Glacier', 'Granite', 'Harbor', 'Hazel', 'Heron', 'Hickory',
  'Holly', 'Indigo', 'Iris', 'Ivy', 'Jasper', 'Juniper', 'Kestrel', 'Lantern', 'Larch', 'Laurel', 'Lichen', 'Linden', 'Lupine', 'Magnolia', 'Maple', 'Marble',
  'Meadow', 'Meteor', 'Mesa', 'Mica', 'Nebula', 'Nutmeg', 'Oak', 'Onyx', 'Orchid', 'Osprey', 'Otter', 'Pebble', 'Pine', 'Plover', 'Poplar',
  'Prairie', 'Quail', 'Quartz', 'Rapids', 'Raven', 'Redwood', 'Ridge', 'River', 'Robin', 'Rowan', 'Saffron', 'Sage', 'Sequoia', 'Sierra', 'Slate', 'Sparrow',
  'Spruce', 'Summit', 'Sycamore', 'Tamarack', 'Thistle', 'Thunder', 'Timber', 'Topaz', 'Trillium', 'Tundra', 'Walnut', 'Willow', 'Wren', 'Yarrow', 'Zephyr', 'Zinnia', 'Teak',
];

// the bridge type: letters only, so the name is also a clean file name
const PATTERN = { pratt: 'Pratt', howe: 'Howe', altP: 'AltPratt', altH: 'AltHowe', x: 'X', warren: 'Warren', custom: 'Custom' };
function bridgeType(p) {
  p = p || {};
  if (p.family === 'warren') return 'Warren';
  return PATTERN[p.pattern] || 'Truss';
}

const EPOCH = Date.UTC(2026, 0, 1);
const CODE_ALPHABET = '0123456789bcdfghjkmnpqrstvwxyz';   // 30 symbols, in increasing order
const SPAN = 30 ** 4;
function timeCode(when) {
  const t = when instanceof Date ? when.getTime() : typeof when === 'number' ? when : Date.now();
  let n = ((Math.floor((t - EPOCH) / 60000) % SPAN) + SPAN) % SPAN, s = '';
  for (let k = 0; k < 4; k++) { s = CODE_ALPHABET[n % 30] + s; n = Math.floor(n / 30); }
  return s;
}

let lastWord = null;
// p: the design (family, pattern); when: Date or ms (default now); rand: () => [0, 1) (default Math.random)
function make(p, when, rand) {
  rand = rand || Math.random;
  let w = WORDS[Math.floor(rand() * WORDS.length) % WORDS.length];
  if (w === lastWord) w = WORDS[(WORDS.indexOf(w) + 1) % WORDS.length];
  lastWord = w;
  return `${w} ${bridgeType(p)} ${timeCode(when)}`;
}
// does a name look like one of ours (for the database: a typed name is never uploaded)
const looksGenerated = s => typeof s === 'string' && /^[A-Z][a-z]+ [A-Za-z]+ [0-9bcdfghjkmnpqrstvwxyz]{4}$/.test(s);

const api = { WORDS, CODE_ALPHABET, bridgeType, timeCode, make, looksGenerated };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TrussNames = api;
})(typeof window !== 'undefined' ? window : globalThis);
