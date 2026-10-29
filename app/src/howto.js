import { h } from './ui.js';
import { APP_NAME, ROUND_PTS, FALLOFF_MM } from './config.js';

const total = ROUND_PTS.reduce((a, b) => a + b, 0);
export const STEPS = [
  ['Read the name', `Each day has a new slide with ${ROUND_PTS.length} brain regions, getting harder each round. A new one appears at midnight Berlin time.`],
  ['Choose the slice', 'The brain is cut into thin slices from front to back. Drag the slider (or use the arrows) to move through them. The number is AP: the distance from Bregma in millimetres. Positive is toward the nose, negative toward the back. The little side view shows where your slice sits.'],
  ['Tap the region', 'Tap where you think the region is on that slice. Both your slice and your tap count, so set the slider first, then tap.'],
  ['See your score', `The closer you get, the more points. Distance is measured in 3D, from your tap to the nearest part of the region, and a wrong slice counts too. Rounds are worth ${ROUND_PTS.join(' / ')} points (${total} in all). Zero points at ${FALLOFF_MM} mm away or more.`],
  ['Learn and carry on', 'After a guess you see where the region really was. The slider stays free, so you can look around. Then a short story or fun fact, and on to the next round.'],
];
const TIPS = [
  'Start from the middle and move until you recognise a shape: the big curved hippocampus, the cerebellum at the back, the ventricles (dark gaps) in the middle.',
  'Regions can be long. If you are not sure of the exact slice, any slice the region reaches is a good guess.',
  'You can play the daily slide once. Practice rounds are unlimited and do not count.',
];

export function howNode({ onStart = null } = {}) {
  return h(
    'article',
    { class: 'howto' },
    h('h1', {}, 'How to play'),
    h('p', { class: 'tag' }, `${APP_NAME}: find the brain region on the right slice.`),
    h('ol', { class: 'steps' }, STEPS.map(([t, d]) => h('li', {}, h('b', {}, t), h('span', {}, d)))),
    h('h2', {}, 'Tips'),
    h('ul', {}, TIPS.map((t) => h('li', {}, t))),
    h('h2', {}, 'Share and compete'),
    h('p', {}, 'Share your result as emoji squares. Create a profile to keep your scores online, and make a group to compare with friends. Today\'s scores in a group stay hidden until you have played too.'),
    h('div', { class: 'btns' }, onStart ? h('button', { type: 'button', class: 'btn btn-primary', onclick: onStart }, 'Got it, start playing') : h('a', { class: 'btn btn-primary', href: '#' }, 'Play')),
  );
}
