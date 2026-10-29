// Art page: a gallery of your own neuron pictures and short videos (config.js GALLERY, files in public/art/). Display only.
// Images: jpg/png/webp/gif/svg. Videos: mp4 (H.264) or webm.
import { h } from './ui.js';

const isVideo = (f) => /\.(mp4|webm)$/i.test(f);

function media(it, base, { big = false } = {}) {
  const src = `${base}art/${encodeURIComponent(it.file)}`;
  const alt = it.alt || it.title || '';
  if (isVideo(it.file)) {
    // grid: silent looping preview; enlarged: controls
    return h('video', { src, muted: true, loop: true, playsinline: true, autoplay: true, preload: 'metadata', 'aria-label': alt, ...(big ? { controls: true } : {}) });
  }
  return h('img', { src, alt, ...(big ? {} : { loading: 'lazy', decoding: 'async' }) });
}

export function artNode(items, base) {
  const dlg = h('dialog', { class: 'lightbox', 'aria-label': 'Picture' });
  const close = h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => dlg.close?.() }, 'Close');
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close?.(); }); // click the backdrop to close
  dlg.addEventListener('close', () => dlg.replaceChildren()); // stops a playing video

  const open = (it) => {
    dlg.replaceChildren(media(it, base, { big: true }), h('p', { class: 'cap' }, [it.title, it.credit && `by ${it.credit}`].filter(Boolean).join(' · ')), close);
    if (typeof dlg.showModal === 'function') dlg.showModal();
  };

  const grid = items.length
    ? h(
        'ul',
        { class: 'gallery' },
        items.map((it) => {
          const m = media(it, base);
          if (m.tagName === 'VIDEO') m.muted = true; // the attribute alone does not always set the property
          return h(
            'li',
            {},
            h('button', { type: 'button', class: 'thumb', 'aria-label': `Enlarge: ${it.title || it.alt || it.file}`, onclick: () => open(it) }, m),
            h('div', { class: 'meta' }, it.title && h('b', {}, it.title), it.caption && h('span', {}, it.caption), it.credit && h('span', { class: 'credit' }, 'By ', it.href ? h('a', { href: it.href, rel: 'noopener' }, it.credit) : it.credit)),
          );
        }),
      )
    : h('p', { class: 'empty' }, 'Neuron pictures are coming soon.');

  return h('div', {}, h('h1', {}, 'Art'), h('p', { class: 'small' }, 'Neurons, pictured. Tap one to enlarge it.'), grid, dlg);
}
