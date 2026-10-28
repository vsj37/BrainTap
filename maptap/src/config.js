// Everything you are likely to tweak lives here.

export const APP_NAME = 'BrainTap'; // rename the game here (page title, header, share text)
export const TAGLINE = 'Find the brain region. A new slide every day.';

// Where profiles are stored in the browser. Do NOT change this when renaming, or players lose their stats.
export const STORAGE_KEY = 'braintap:profile:v1';

export const ROUND_PTS = [25, 35, 40]; // points per round (sum = 100)
export const ROUND_LEVELS = [[1], [2, 3], [4, 5]]; // difficulty levels per round (tools/regions.csv)
export const FALLOFF_MM = 4.0; // score reaches 0 at this 3D distance (mm) from the target; larger = more forgiving

// Your own artwork: put files in public/art/ and name them here (SVG or transparent PNG). Empty = not shown.
export const ART = {
  hero: '', // e.g. 'neuron.svg' (shown next to the title on the home screen)
};

// Credits for your artwork, shown in the footer. e.g. { text: 'Neuron drawing by Jane Doe', href: 'https://example.com' }
export const CREDITS = [];
