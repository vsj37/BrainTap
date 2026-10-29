// Everything you are likely to tweak lives here. (The Worker in worker/ imports this file too.)

export const APP_NAME = 'BrainTap'; // rename the game here (page title, header, share text)
export const TAGLINE = 'Find the brain region. A new slide every day.';

// Where data is kept in the browser. Do NOT change these when renaming, or players lose their stats / profile.
export const STORAGE_KEY = 'braintap:profile:v1';
export const CLOUD_KEY = 'braintap:cloud:v1';

export const ROUND_PTS = [25, 35, 40]; // points per round (sum = 100)

// Which regions each round draws from (levels are set per region in tools/regions.csv).
//   round 1: CA1 in the daily game (levels 1-2 in practice)
//   round 2: level 3 + the first half of level 4
//   round 3: the second half of level 4 + level 5
// "First half" of a level = its larger regions (peak cross-section area from the atlas build), so round 2 gets the easier
// half. Without area data (mock slices) it falls back to A-Z order.
export const ROUND_RULES = [
  { levels: [1, 2], fixed: 'CA1' }, // the daily game always opens with CA1 (practice rounds use the levels instead)
  { levels: [3], splitLevel: { level: 4, part: 'first' } },
  { levels: [5], splitLevel: { level: 4, part: 'second' } },
];

export const FALLOFF_MM = 4.0; // score reaches 0 at this 3D distance (mm) from the target; larger = more forgiving

export const GROUP_CAP = 40; // members per group
export const MAX_GROUPS_JOINED = 10; // groups one player can be in
export const MAX_GROUPS_OWNED = 5; // groups one player can create

// Your own artwork: put files in public/art/ and name them here (SVG or transparent PNG). Empty = not shown.
export const ART = {
  hero: '', // e.g. 'neuron.svg' (shown next to the title on the home screen)
};

// Pictures on the Art page (#art). Put the files in public/art/ and list them here, then deploy. Tips: JPG/WebP/PNG/SVG,
// about 1600 px on the long side, under ~500 KB each. Always give alt text (what the image shows) and a credit.
//   { file: 'neuron-1.jpg', title: 'Pyramidal neuron, CA1', alt: 'Branching neuron stained green', credit: 'Jane Doe', href: 'https://example.com', caption: 'optional line' }
export const GALLERY = [

  { file: 'IMG-20260314-WA0004_lq.jpg', title: 'Alice painting', alt: 'Beautiful', credit: 'Alice', href: 'https://…', caption: 'optional' }
];

// Credits for your artwork, shown in the footer. e.g. { text: 'Neuron drawing by Jane Doe', href: 'https://example.com' }
export const CREDITS = [];

// Privacy notice (page #privacy). FILL THESE IN before launch: they are shown to players as the responsible party.
export const OPERATOR = {
  name: '', // your name or organisation
  address: '', // postal address
  email: '', // contact for privacy requests
};
export const PRIVACY_UPDATED = '2026-10-28'; // change when you edit the notice
export const MIN_AGE = 16; // shown in the privacy notice
