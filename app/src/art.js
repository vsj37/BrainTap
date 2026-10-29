// Art page: a gallery of your own neuron pictures (config.js GALLERY, files in public/art/). Display only.
import { h } from './ui.js';

export function artNode(items, base) {
  const dlg = h('dialog', { class: 'lightbox', 'aria-label': 'Picture' });
  const close = h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => dlg.close?.() }, 'Close');
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close?.(); }); // click the backdrop to close

  const open = (it) => {
    dlg.replaceChildren(h('img', { src: `${base}art/${it.file}`, alt: it.alt || it.title || '' }), h('p', { class: 'cap' }, [it.title, it.credit && `by ${it.credit}`].filter(Boolean).join(' · ')), close);
    if (typeof dlg.showModal === 'function') dlg.showModal();
  };

  const grid = items.length
    ? h(
        'ul',
        { class: 'gallery' },
        items.map((it) =>
          h(
            'li',
            {},
            h('button', { type: 'button', class: 'thumb', 'aria-label': `Enlarge: ${it.title || it.alt || it.file}`, onclick: () => open(it) }, h('img', { src: `${base}art/${it.file}`, alt: it.alt || it.title || '', loading: 'lazy', decoding: 'async' })),
            h('div', { class: 'meta' }, it.title && h('b', {}, it.title), it.caption && h('span', {}, it.caption), it.credit && h('span', { class: 'credit' }, 'By ', it.href ? h('a', { href: it.href, rel: 'noopener' }, it.credit) : it.credit)),
          ),
        ),
      )
    : h('p', { class: 'empty' }, 'Neuron pictures are coming soon.');

  return h('div', {}, h('h1', {}, 'Art'), h('p', { class: 'small' }, 'Neurons, pictured. Tap a picture to enlarge it.'), grid, dlg);
}
