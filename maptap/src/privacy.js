import { h } from './ui.js';
import { APP_NAME, OPERATOR, PRIVACY_UPDATED, MIN_AGE, GROUP_CAP } from './config.js';

// Privacy notice (GDPR-style). Template: fill OPERATOR in src/config.js and have it reviewed for your situation.
export function privacyNode() {
  const who = [OPERATOR.name, OPERATOR.address].filter(Boolean).join(', ');
  const mail = OPERATOR.email ? h('a', { href: `mailto:${OPERATOR.email}` }, OPERATOR.email) : '[contact email not set yet]';
  const sec = (title, ...body) => h('section', { class: 'prose' }, h('h2', {}, title), ...body);
  return h(
    'article',
    { class: 'privacy' },
    h('h1', {}, 'Privacy notice'),
    h('p', { class: 'small' }, `Last updated ${PRIVACY_UPDATED}`),
    sec('Who is responsible', h('p', {}, who ? `${who}.` : '[operator name and address not set yet]'), h('p', {}, 'Contact for privacy questions and requests: ', mail, '.')),
    sec(
      'The short version',
      h('ul', {}, [
        'No cookies, no analytics, no ads, no tracking, no third-party fonts or scripts.',
        'You can play without giving us anything. Your stats then stay in your browser.',
        'If you create a profile, we store a username you choose and your game results. No email, no password, no real name needed.',
        'People in a group you join can see your username and your scores.',
        'You can download or delete everything at any time on the Stats page.',
      ].map((t) => h('li', {}, t))),
    ),
    sec(
      'What is stored in your browser',
      h('p', {}, 'The game saves your scores, streaks and the round you are on, plus (if you create a profile) your recovery key, in your browser\'s local storage. It never leaves your device unless you have a profile. It is needed for the game to work as you asked and is not used for tracking, so no cookie banner is required. Clearing your browser data removes it.'),
    ),
    sec(
      'What we store if you create a profile',
      h('ul', {}, [
        'Your username (shown to members of your groups).',
        'A random profile ID and a hashed copy of your recovery key (we cannot read your key and cannot restore a lost one).',
        'Each day you played: the date, your three scores and which regions were asked.',
        'Groups you created or joined, and when you joined.',
      ].map((t) => h('li', {}, t))),
      h('p', {}, 'Please do not use your real name or anything else that identifies you in the username if you do not want group members to know it.'),
    ),
    sec(
      'Why, and on what basis',
      h('p', {}, 'To run the profile and group features you asked for: results, leaderboards, invitations (Art. 6(1)(b) GDPR). By ticking the box when creating a profile you also confirm that you have read this notice.'),
    ),
    sec(
      'Who can see it',
      h('ul', {}, [
        `Members of a group you join (up to ${GROUP_CAP} people) see your username and your results. A day's scores are shown to a member only after they have played that day's slide too.`,
        'Nobody else sees your profile. There is no public leaderboard and no search for players. Group invitations are links; anyone with the link can see the group name and member count and join, so share it only with people you want in.',
        'Our hosting provider, Cloudflare, processes the data on our behalf to deliver the site and store the database, and handles technical connection data (such as IP addresses) to deliver pages and protect against abuse. See Cloudflare\'s privacy policy for details. The database is set up in the EU jurisdiction where this was configured by the operator.',
      ].map((t) => h('li', {}, t))),
    ),
    sec('How long', h('p', {}, 'Until you delete your profile. Deleting it removes your username, results and group memberships. If you own a group, it passes to the longest-standing member, or is deleted if you were the only one. Backups at the hosting provider may keep copies for a short time.')),
    sec(
      'Your rights',
      h('p', {}, 'You can ask for access, correction, deletion, restriction or a copy of your data, and object to processing. Most of this you can do yourself on the Stats page (rename, download, delete). Otherwise write to ', mail, '. You also have the right to complain to your data protection authority.'),
    ),
    sec('Age', h('p', {}, `${APP_NAME} profiles are for people aged ${MIN_AGE} or over. If you are younger, you can still play without a profile.`)),
    sec('Image credit', h('p', {}, 'Brain slices are derived from the Allen Mouse Common Coordinate Framework (Allen Institute for Brain Science).')),
    sec('Changes', h('p', {}, 'If this notice changes in a meaningful way the date at the top changes.')),
    h('p', {}, h('a', { class: 'btn btn-ghost', href: '#' }, 'Back')),
  );
}
