/* Décor vectoriel animé : courbe du cours et anneaux dans le bandeau, guillochés et paillettes en fond.
   Purement décoratif (aria-hidden), sans dépendance ; respecte « réduire les animations ». */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const svgEl = (tag, attrs, parent) => {
    const n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach((k) => n.setAttribute(k, attrs[k]));
    if (parent) parent.appendChild(n);
    return n;
  };
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const STAR = '<svg viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0 -10 L1.8 -1.8 L10 0 L1.8 1.8 L0 10 L-1.8 1.8 L-10 0 L-1.8 -1.8 Z"/></svg>';

  function paillettes(parent, count, area) {
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span');
      s.className = 'paillette';
      s.style.left = (area.x0 + rnd() * (area.x1 - area.x0)).toFixed(1) + '%';
      s.style.top = (area.y0 + rnd() * (area.y1 - area.y0)).toFixed(1) + '%';
      s.style.setProperty('--d', (6 + rnd() * 6).toFixed(1) + 's');
      s.style.setProperty('--delay', (-rnd() * 12).toFixed(1) + 's');
      s.style.setProperty('--s', Math.round(7 + rnd() * 9) + 'px');
      s.innerHTML = STAR;
      parent.appendChild(s);
    }
  }

  /* ---------- 1. Fond de page : bandes guillochées et paillettes ---------- */
  function guilloche(cls, lines, period, ampBase) {
    const W = 3000, H = 40 + lines * 11 + ampBase * 3;
    const wrap = document.createElement('div');
    wrap.className = 'guilloche ' + cls;
    wrap.style.setProperty('--p', period + 'px');
    wrap.style.height = H + 'px';
    const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, fill: 'none', focusable: 'false' });
    for (let i = 0; i < lines; i++) {
      const a = ampBase + i * 1.4;
      const y = 20 + ampBase * 1.5 + i * 11;
      const phase = (i * period) / (lines * 1.6);
      let x = -period - phase;
      let d = `M${x.toFixed(1)} ${y} Q${(x + period / 4).toFixed(1)} ${(y - 2 * a).toFixed(1)} ${(x + period / 2).toFixed(1)} ${y}`;
      x += period / 2;
      while (x < W) { x += period / 2; d += ` T${x.toFixed(1)} ${y}`; }
      svgEl('path', { d, class: 'g-line' }, svg);
    }
    wrap.appendChild(svg);
    return wrap;
  }
  const page = document.createElement('div');
  page.className = 'decor decor-page';
  page.setAttribute('aria-hidden', 'true');
  page.appendChild(guilloche('g1', 8, 180, 9));
  page.appendChild(guilloche('g2', 6, 240, 12));
  paillettes(page, 9, { x0: 3, x1: 97, y0: 8, y1: 92 });
  document.body.prepend(page);

  /* ---------- 2. Bandeau : courbe réelle du cours (13 mois) et anneaux ---------- */
  const band = document.querySelector('.band');
  if (!band) return;
  const deco = document.createElement('div');
  deco.className = 'decor decor-band';
  deco.setAttribute('aria-hidden', 'true');

  // Moyennes mensuelles d'octobre 2025 à octobre 2026, en €/g.
  const V = [112.15, 113.66, 118.34, 130.13, 136.48, 135.03, 129.61, 126.31, 118.0, 114.64, 122.33, 120.81, 119.22];
  const VW = 520, VH = 220, X0 = 18, X1 = 500, Y0 = 34, Y1 = 196, LO = 108, HI = 140;
  const pts = V.map((v, i) => [X0 + ((X1 - X0) * i) / (V.length - 1), Y1 - ((v - LO) / (HI - LO)) * (Y1 - Y0)]);
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  const last = pts[pts.length - 1];

  const curve = svgEl('svg', { class: 'decor-curve', viewBox: `0 0 ${VW} ${VH}`, focusable: 'false' });
  const defs = svgEl('defs', {}, curve);
  const grad = svgEl('linearGradient', { id: 'decor-or', x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
  svgEl('stop', { offset: '0', class: 'c-stop1' }, grad);
  svgEl('stop', { offset: '1', class: 'c-stop2' }, grad);
  [60, 110, 160].forEach((gy) => svgEl('line', { x1: X0, x2: X1, y1: gy, y2: gy, class: 'c-grid' }, curve));
  svgEl('path', { d: d + ` L${X1} ${VH} L${X0} ${VH} Z`, class: 'c-area', fill: 'url(#decor-or)' }, curve);
  const line = svgEl('path', { d, class: 'c-line' }, curve);
  svgEl('circle', { cx: last[0], cy: last[1], r: 5, class: 'c-end' }, curve);

  const runner = svgEl('g', { opacity: reduce ? '1' : '0' }, curve);
  if (reduce) runner.setAttribute('transform', `translate(${last[0]} ${last[1]})`);
  svgEl('circle', { r: 9, class: 'c-halo' }, runner);
  svgEl('circle', { r: 3.2, class: 'c-dot' }, runner);
  if (!reduce) {
    // Le point parcourt l'année puis s'arrête sur « aujourd'hui » avant de repartir.
    svgEl('animateMotion', { path: d, dur: '14s', begin: '3.6s', repeatCount: 'indefinite', keyPoints: '0;1;1', keyTimes: '0;0.78;1', calcMode: 'linear' }, runner);
    svgEl('animate', { attributeName: 'opacity', values: '0;1;1;0', keyTimes: '0;0.04;0.96;1', dur: '14s', begin: '3.6s', repeatCount: 'indefinite' }, runner);
  }
  deco.appendChild(curve);

  const RING = '<svg viewBox="0 0 120 64" aria-hidden="true">' +
    '<ellipse class="r-body" cx="60" cy="34" rx="50" ry="19"/>' +
    '<ellipse class="r-edge" cx="60" cy="34" rx="50" ry="19"/>' +
    '<ellipse class="r-glint" cx="60" cy="34" rx="50" ry="19" pathLength="100"/>' +
    '</svg>';
  ['a1', 'a2'].forEach((cls) => {
    const r = document.createElement('div');
    r.className = 'anneau ' + cls;
    r.innerHTML = RING;
    deco.appendChild(r);
  });
  paillettes(deco, 5, { x0: 52, x1: 96, y0: 6, y1: 48 });

  band.prepend(deco);
  if (!reduce) {
    try { line.style.setProperty('--len', Math.ceil(line.getTotalLength()) + ''); } catch (e) { /* tracé immédiat */ }
    line.classList.add('draw');
  }
})();
