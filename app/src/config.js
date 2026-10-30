// Everything you are likely to tweak lives here. (The Worker in worker/ imports this file too.)

export const APP_NAME = 'BrainTap'; // rename the game here (page title, header, share text)
export const TAGLINE = 'Find the brain region. A new slide every day.';

// Where data is kept in the browser. Do NOT change these when renaming, or players lose their stats / profile.
export const STORAGE_KEY = 'braintap:profile:v1';
export const CLOUD_KEY = 'braintap:cloud:v1';

export const ROUND_PTS = [25, 35, 40]; // points per round (sum = 100)

// Which regions each round draws from (levels are set per region in tools/regions.csv).
//   round 1: any region of level 1 or 2
//   round 2: level 3 + the first half of level 4
//   round 3: the second half of level 4 + level 5
// "First half" of a level = its larger regions (peak cross-section area from the atlas build), so round 2 gets the easier
// half. Without area data (mock slices) it falls back to A-Z order.
// A rule can also pin one region in the daily game only, e.g. { levels: [1, 2], fixed: 'CA1' } (practice ignores `fixed`).
export const ROUND_RULES = [
  { levels: [1, 2] },
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
  { file: 'IMG-20260314-WA0004_lq.jpg', title: 'Alice painting', alt: 'Painting by Alice', credit: 'Alice' },
  { file: 'VID-20261029-WA0002.mp4', title: 'GCaMP Mouse Neuron!', alt: 'Video of a mouse neuron expressing GCaMP and a calcium spike', credit: 'Vachan' }
];

export const SIDE_IMAGE = { file: 'mouse-brain-lateral.png', flip: true, x0: 0.016, x1: 0.984, y0: 0.04, y1: 0.95 };

// Credits for your artwork, shown in the footer. e.g. { text: 'Neuron drawing by Jane Doe', href: 'https://example.com' }
export const CREDITS = [

{ text: 'Mouse brain lateral view by DBCLS (CC BY 3.0), cropped and flipped horizontally', href: 'https://commons.wikimedia.org/wiki/File:Mouse_brain_lateral_view.png' }

];

// Privacy notice (page #privacy). FILL THESE IN before launch: they are shown to players as the responsible party.
export const OPERATOR = {
  name: '', // your name or organisation
  address: '', // postal address
  email: '', // contact for privacy requests
};
export const PRIVACY_UPDATED = '2026-10-28'; // change when you edit the notice
export const MIN_AGE = 16; // shown in the privacy notice
