/* Vendre mon or à Toulouse : calculs, graphique et outils de décision. Aucune dépendance. */
(() => {
  'use strict';

  /* ---------- Données ---------- */
  const STORE_KEY = 'or-toulouse-v1';
  const REF = {
    eur_g: 118.6,
    updated: '2026-10-20T08:00:00+02:00',
    status: 'reference',
    source: 'GOLDMARKET, Gold.fr, BullionVault'
  };
  const RECORD = 146.2;      // €/g, sommet en euros début mars 2026
  const AVG_2026 = 125.93;   // €/g, moyenne janvier–septembre 2026
  const AVG_2016 = 36.3;
  const AVG_2021 = 48.9;
  const TITRES = { '24': 0.999, '22': 0.916, '18': 0.75, '14': 0.585, '9': 0.375 };
  const CARAT_LABELS = { '24': '24 ct (999)', '22': '22 ct (916)', '18': '18 ct (750)', '14': '14 ct (585)', '9': '9 ct (375)' };

  // Moyennes annuelles en €/g. 2016–2025 : estimations LBMA (USD) × taux moyen BCE, arrondies.
  const ANNUAL = [
    { label: '2016', v: 36.3 }, { label: '2017', v: 35.8 }, { label: '2018', v: 34.5 },
    { label: '2019', v: 40.0 }, { label: '2020', v: 49.8 }, { label: '2021', v: 48.9 },
    { label: '2022', v: 55.0 }, { label: '2023', v: 57.7 }, { label: '2024', v: 70.9 },
    { label: '2025', v: 97.5 }, { label: '2026', v: 125.9, partial: true, note: 'janvier à septembre' }
  ];
  // Moyennes mensuelles en €/g (countryeconomy.com ; octobre 2026 : clôtures du 1er au 19).
  const MONTHLY = [
    { label: 'octobre 2025', s: 'oct.', v: 112.15 }, { label: 'novembre 2025', s: 'nov.', v: 113.66 },
    { label: 'décembre 2025', s: 'déc.', v: 118.34 }, { label: 'janvier 2026', s: 'janv.', v: 130.13 },
    { label: 'février 2026', s: 'févr.', v: 136.48 }, { label: 'mars 2026', s: 'mars', v: 135.03 },
    { label: 'avril 2026', s: 'avr.', v: 129.61 }, { label: 'mai 2026', s: 'mai', v: 126.31 },
    { label: 'juin 2026', s: 'juin', v: 118.0 }, { label: 'juillet 2026', s: 'juil.', v: 114.64 },
    { label: 'août 2026', s: 'août', v: 122.33 }, { label: 'septembre 2026', s: 'sept.', v: 120.81 },
    { label: 'octobre 2026', s: 'oct.', v: 119.22, partial: true, note: 'du 1er au 19' }
  ];
  const SHOPS = [
    { id: 'godot', name: 'Godot & Fils' },
    { id: 'goldfr', name: 'Gold.fr – Le Comptoir National' },
    { id: 'cob', name: "Comptoir de l'Or et du Bijou" },
    { id: 'fidso', name: 'Fidso – Or Expertise' },
    { id: 'goldmarket', name: 'GOLDMARKET' },
    { id: 'placeor', name: "Place de l'Or" },
    { id: 'autre', name: 'Autre acheteur' }
  ];
  const DEFAULT_LOTS = [
    { name: 'Alliance', carat: '18', g: 4.0 },
    { name: 'Bague fine', carat: '18', g: 3.5 },
    { name: 'Chevalière', carat: '18', g: 6.0 },
    { name: 'Bracelet gourmette', carat: '18', g: 14.0 },
    { name: 'Bracelet jonc', carat: '18', g: 9.5 }
  ];

  /* ---------- État (préférences du visiteur, dans ce navigateur) ---------- */
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) { saved = {}; }
  const validLots = Array.isArray(saved.lots) && saved.lots.length > 0;
  const state = {
    live: REF,
    spotOverride: typeof saved.spotOverride === 'number' && saved.spotOverride > 0 ? saved.spotOverride : null,
    lots: validLots ? saved.lots.map(cleanLot) : DEFAULT_LOTS.map((l) => ({ ...l })),
    isExample: validLots ? saved.isExample === true : true,
    thr: Object.assign({ high: 125, low: 110, date: '2027-03-31' }, saved.thr || {}),
    quotes: saved.quotes && typeof saved.quotes === 'object' ? saved.quotes : {},
    checks: saved.checks && typeof saved.checks === 'object' ? saved.checks : {},
    view: saved.view === 'monthly' ? 'monthly' : 'annual'
  };
  function cleanLot(l) {
    return {
      name: typeof l.name === 'string' ? l.name.slice(0, 60) : '',
      carat: TITRES[l.carat] ? String(l.carat) : '18',
      g: Number.isFinite(+l.g) && +l.g >= 0 ? +l.g : 0
    };
  }
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        spotOverride: state.spotOverride, lots: state.lots, isExample: state.isExample,
        thr: state.thr, quotes: state.quotes, checks: state.checks, view: state.view
      }));
    } catch (e) { /* stockage indisponible : la page fonctionne sans */ }
  }
  const spot = () => state.spotOverride || state.live.eur_g;

  /* ---------- Formats ---------- */
  const fmt = (d) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const F0 = fmt(0), F1 = fmt(1), F2 = fmt(2);
  const eur = (n) => F0.format(Math.round(n)) + ' €';
  const signedPct = (r, d = 0) => {
    const v = r * 100;
    const s = Math.abs(v) < 0.5 / Math.pow(10, d) ? '' : (v > 0 ? '+' : '−');
    return s + fmt(d).format(Math.abs(v)) + ' %';
  };
  const $ = (id) => document.getElementById(id);

  /* ---------- Bandeau et valeurs liées ---------- */
  function renderBinds() {
    const s = spot();
    const values = {
      spot: F2.format(s),
      spot18: F2.format(s * 0.75),
      t85: F2.format(s * 0.75 * 0.85),
      t80: F2.format(s * 0.75 * 0.80),
      t75: F2.format(s * 0.75 * 0.75),
      vsRecord: signedPct(s / RECORD - 1),
      vsAvg: signedPct(s / AVG_2026 - 1),
      avg2026: F2.format(AVG_2026),
      x2016: F1.format(s / AVG_2016),
      x2021: F1.format(s / AVG_2021)
    };
    document.querySelectorAll('[data-bind]').forEach((el) => {
      const k = el.getAttribute('data-bind');
      if (k in values) el.textContent = values[k];
    });

    const src = $('board-source');
    if (state.spotOverride) {
      src.textContent = 'Cours saisi manuellement : ' + F2.format(state.spotOverride) + ' €/g. Tous les calculs de la page l\'utilisent.';
    } else if (state.live.status === 'live') {
      const d = new Date(state.live.updated);
      const when = isNaN(d) ? '' : d.toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
      src.textContent = 'Cours au ' + when + ' (' + (state.live.source || 'gold-api.com, taux BCE') + '). Mise à jour automatique chaque jour ouvré.';
    } else {
      src.textContent = 'Cours de référence relevé le 20 octobre 2026 au matin (' + REF.source + '). Mise à jour automatique chaque jour ouvré.';
    }
    const input = $('spot-input');
    if (document.activeElement !== input) input.value = s.toFixed(2);
    $('spot-reset').hidden = !state.spotOverride;
  }

  /* ---------- Graphique ---------- */
  const chartEl = $('chart');
  const readout = $('readout');
  let chartData = [];

  function niceDomain(vals, step, floorZero) {
    let lo = Math.min(...vals), hi = Math.max(...vals);
    lo = floorZero ? 0 : Math.floor((lo - step * 0.4) / step) * step;
    hi = Math.ceil((hi + step * 0.3) / step) * step;
    return [lo, hi];
  }

  function drawChart() {
    const annual = state.view === 'annual';
    const data = annual ? ANNUAL : MONTHLY;
    chartData = data;
    const W = Math.max(300, Math.round(chartEl.clientWidth || 640));
    const narrow = W < 560;
    const H = narrow ? 250 : 300;
    const m = { l: 38, r: narrow ? 70 : 88, t: 16, b: 30 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const s = spot();
    const thrHigh = +state.thr.high, thrLow = +state.thr.low;

    const refs = [s, RECORD];
    if (!annual) {
      if (thrHigh > 0) refs.push(thrHigh);
      if (thrLow > 0) refs.push(thrLow);
    }
    const step = annual ? 40 : 10;
    const [y0, y1] = niceDomain(data.map((d) => d.v).concat(refs), step, annual);
    const y = (v) => m.t + ph - ((v - y0) / (y1 - y0)) * ph;
    const n = data.length;
    const band = pw / n;
    const x = (i) => m.l + band * i + band / 2;

    let svg = '';
    // Grille et axe Y
    for (let v = y0; v <= y1 + 0.001; v += step) {
      svg += `<line class="ch-grid" x1="${m.l}" x2="${m.l + pw}" y1="${y(v)}" y2="${y(v)}"/>`;
      svg += `<text class="ch-axis" x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${F0.format(v)}</text>`;
    }
    // Axe X
    data.forEach((d, i) => {
      const show = annual ? (!narrow || i % 2 === 0 || i === n - 1) : (!narrow || i % 2 === 0);
      if (!show) return;
      const lbl = annual ? (narrow ? '’' + d.label.slice(2) : d.label) : d.s;
      svg += `<text class="ch-axis" x="${x(i)}" y="${H - 10}" text-anchor="middle">${lbl}</text>`;
    });
    if (!annual) {
      // repères d'années sous les mois de janvier
      svg += `<text class="ch-axis" x="${x(0)}" y="${H + 4}" text-anchor="middle">2025</text>`;
      svg += `<text class="ch-axis" x="${x(3)}" y="${H + 4}" text-anchor="middle">2026</text>`;
    }

    // Séries
    if (annual) {
      const bw = Math.min(38, band * 0.62);
      data.forEach((d, i) => {
        const top = y(d.v);
        svg += `<rect class="ch-bar${d.partial ? ' partial' : ''}" data-i="${i}" x="${x(i) - bw / 2}" y="${top}" width="${bw}" height="${y(y0) - top}" rx="2"/>`;
        if (!narrow) svg += `<text class="ch-lbl val" x="${x(i)}" y="${top - 5}" text-anchor="middle">${F0.format(d.v)}</text>`;
      });
    } else {
      const pts = data.map((d, i) => [x(i), y(d.v)]);
      const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      const area = line + ` L ${pts[n - 1][0].toFixed(1)} ${y(y0)} L ${pts[0][0].toFixed(1)} ${y(y0)} Z`;
      svg += `<path class="ch-area" d="${area}"/>`;
      svg += `<path class="ch-line" d="${line}"/>`;
      pts.forEach((p, i) => {
        const partial = data[i].partial;
        svg += `<circle class="ch-dot${partial ? '' : ' on'}" data-i="${i}" cx="${p[0]}" cy="${p[1]}" r="${partial ? 4.5 : 3}"/>`;
      });
    }

    // Lignes de référence et étiquettes à droite (écartées si elles se chevauchent)
    const lines = [
      { v: RECORD, cls: 'ch-record', lcls: 'record', txt: 'Record ' + F0.format(RECORD) },
      { v: s, cls: 'ch-spot', lcls: 'spot', txt: 'Auj. ' + F1.format(s) }
    ];
    if (!annual) {
      if (thrHigh > 0) lines.push({ v: thrHigh, cls: 'ch-thr', lcls: 'thr', txt: 'Seuil ' + F0.format(thrHigh) });
      if (thrLow > 0) lines.push({ v: thrLow, cls: 'ch-thr low', lcls: 'thr low', txt: 'Plancher ' + F0.format(thrLow) });
    }
    lines.forEach((l) => { l.y = y(l.v); l.ly = l.y; });
    const sorted = lines.slice().sort((a, b) => a.y - b.y);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].ly - sorted[i - 1].ly < 13) sorted[i].ly = sorted[i - 1].ly + 13;
    }
    lines.forEach((l) => {
      svg += `<line class="${l.cls}" x1="${m.l}" x2="${m.l + pw}" y1="${l.y}" y2="${l.y}"/>`;
      svg += `<text class="ch-lbl ${l.lcls}" x="${m.l + pw + 6}" y="${l.ly + 4}">${l.txt}</text>`;
    });
    svg += `<line class="ch-guide" id="ch-guide" x1="0" x2="0" y1="${m.t}" y2="${m.t + ph}" visibility="hidden"/>`;

    chartEl.innerHTML = `<svg viewBox="0 0 ${W} ${H + (annual ? 0 : 8)}" width="${W}" height="${H + (annual ? 0 : 8)}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
    chartEl.setAttribute('aria-label', annual
      ? 'Moyennes annuelles du cours de l\'or fin en euros par gramme, de 36 € en 2016 à 126 € en 2026.'
      : 'Moyennes mensuelles du cours de l\'or fin en euros par gramme, d\'octobre 2025 à octobre 2026, avec un pic à 136 € en février 2026.');

    const svgEl = chartEl.querySelector('svg');
    const guide = svgEl.querySelector('#ch-guide');
    const pick = (clientX) => {
      const r = svgEl.getBoundingClientRect();
      const px = ((clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(n - 1, Math.floor((px - m.l) / band)));
      guide.setAttribute('x1', x(i)); guide.setAttribute('x2', x(i));
      guide.setAttribute('visibility', 'visible');
      svgEl.querySelectorAll('[data-i]').forEach((el) => el.classList.toggle('dim', annual && +el.getAttribute('data-i') !== i));
      setReadout(i);
    };
    svgEl.addEventListener('pointermove', (e) => pick(e.clientX));
    svgEl.addEventListener('pointerdown', (e) => pick(e.clientX));
    svgEl.addEventListener('pointerleave', () => {
      guide.setAttribute('visibility', 'hidden');
      svgEl.querySelectorAll('[data-i]').forEach((el) => el.classList.remove('dim'));
      setReadout(null);
    });
    setReadout(null);

    document.querySelectorAll('.only-monthly').forEach((el) => { el.hidden = annual; });
    $('chart-note').innerHTML = annual
      ? 'Moyennes annuelles. 2016–2025 : estimations calculées à partir des moyennes LBMA en dollars et du taux moyen BCE, arrondies. 2026 : janvier à septembre.<sup class="ref"><a href="#src-4">4</a></sup>'
      : 'Moyennes mensuelles.<sup class="ref"><a href="#src-4">4</a></sup> Octobre 2026 : moyenne des clôtures du 1er au 19 octobre (point évidé).<sup class="ref"><a href="#src-5">5</a></sup>';
  }

  function setReadout(i) {
    const annual = state.view === 'annual';
    if (i === null) {
      readout.textContent = annual
        ? 'Moyenne 2025 : 97,5 €/g · 2026 (janv.–sept.) : 125,9 €/g · aujourd\'hui : ' + F2.format(spot()) + ' €/g'
        : 'Pic : 136,48 €/g en février 2026 · creux : 114,64 €/g en juillet · aujourd\'hui : ' + F2.format(spot()) + ' €/g';
      return;
    }
    const d = chartData[i];
    const label = annual ? 'Moyenne ' + d.label : d.label;
    const note = d.note ? ' (' + d.note + ')' : '';
    const delta = signedPct(spot() / d.v - 1);
    readout.textContent = label + note + ' : ' + F2.format(d.v) + ' €/g · cours actuel ' + delta;
  }

  let rafId = 0;
  const scheduleDraw = () => { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(drawChart); };
  if ('ResizeObserver' in window) new ResizeObserver(scheduleDraw).observe(chartEl);
  else window.addEventListener('resize', scheduleDraw);

  document.querySelectorAll('.seg button').forEach((b) => {
    b.addEventListener('click', () => {
      state.view = b.dataset.view;
      document.querySelectorAll('.seg button').forEach((o) => o.setAttribute('aria-selected', String(o === b)));
      save(); drawChart();
    });
  });
  document.querySelectorAll('.seg button').forEach((o) => o.setAttribute('aria-selected', String(o.dataset.view === state.view)));

  /* ---------- Seuils ---------- */
  function renderThresholds() {
    const s = spot();
    const hi = +state.thr.high, lo = +state.thr.low;
    const box = $('thr-status');
    let pill, big, txt;
    if (hi > 0 && s >= hi) {
      pill = '<span class="pill good">Seuil haut atteint</span>';
      big = 'Vendre le solde.';
      txt = 'L\'or fin cote ' + F2.format(s) + ' €/g, au-dessus de votre seuil de ' + F1.format(hi) + ' €/g.';
    } else if (lo > 0 && s <= lo) {
      pill = '<span class="pill bad">Sous le plancher</span>';
      big = 'Arbitrer : sécuriser ou conserver.';
      txt = 'L\'or fin cote ' + F2.format(s) + ' €/g, sous votre plancher de ' + F1.format(lo) + ' €/g. Soit vendre le solde pour figer le niveau actuel, soit garder ces bijoux durablement : l\'or reste une réserve de valeur.';
    } else {
      pill = '<span class="pill warn">Zone intermédiaire</span>';
      big = 'Vendre la première tranche, garder la seconde.';
      const gap = hi > 0 ? ' Il manque ' + signedPct(hi / s - 1, 1).replace('+', '') + ' pour atteindre votre seuil haut' : '';
      const room = lo > 0 ? ' ; marge de ' + signedPct(1 - lo / s, 1).replace('+', '') + ' avant le plancher.' : '.';
      txt = 'L\'or fin cote ' + F2.format(s) + ' €/g.' + gap + room;
    }
    let deadline = '';
    const dl = new Date(state.thr.date + 'T23:59:59');
    if (!isNaN(dl)) {
      const days = Math.ceil((dl - new Date()) / 864e5);
      const dtxt = dl.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      deadline = days > 0
        ? 'Date butoir : ' + dtxt + ', dans ' + F0.format(days) + ' jours. À cette date, vendre le solde quel que soit le cours.'
        : 'Date butoir du ' + dtxt + ' dépassée : vendre le solde.';
    }
    box.innerHTML = `<div>${pill}</div><p class="big">${big}</p><p>${txt}</p><p class="muted">${deadline}</p>`;
  }
  [['thr-high', 'high'], ['thr-low', 'low'], ['thr-date', 'date']].forEach(([id, key]) => {
    const el = $(id);
    el.value = state.thr[key];
    el.addEventListener('input', () => {
      if (key === 'date') state.thr.date = el.value;
      else { const v = parseFloat(el.value); state.thr[key] = Number.isFinite(v) ? v : 0; }
      save(); renderThresholds(); if (state.view === 'monthly') drawChart();
    });
  });

  /* ---------- Estimation des bijoux ---------- */
  const lotsEl = $('lots');
  function renderLots() {
    lotsEl.innerHTML = '';
    state.lots.forEach((lot, i) => {
      const row = document.createElement('div');
      row.className = 'lot';
      const name = document.createElement('input');
      name.type = 'text'; name.id = 'lot-name-' + i; name.value = lot.name; name.setAttribute('aria-label', 'Nom du bijou ' + (i + 1));
      name.placeholder = 'Bijou ' + (i + 1);
      const sel = document.createElement('select');
      sel.id = 'lot-carat-' + i; sel.setAttribute('aria-label', 'Titre du bijou ' + (i + 1));
      Object.keys(CARAT_LABELS).forEach((k) => {
        const o = document.createElement('option'); o.value = k; o.textContent = CARAT_LABELS[k]; sel.appendChild(o);
      });
      sel.value = lot.carat;
      const g = document.createElement('input');
      g.type = 'number'; g.id = 'lot-g-' + i; g.min = '0'; g.step = '0.1'; g.inputMode = 'decimal';
      g.value = lot.g; g.setAttribute('aria-label', 'Poids en grammes du bijou ' + (i + 1));
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'btn-x'; del.textContent = '×';
      del.setAttribute('aria-label', 'Retirer ' + (lot.name || 'ce bijou'));
      const touch = () => { state.isExample = false; save(); renderTotals(); };
      name.addEventListener('input', () => { lot.name = name.value.slice(0, 60); touch(); });
      sel.addEventListener('change', () => { lot.carat = sel.value; touch(); });
      g.addEventListener('input', () => { const v = parseFloat(g.value); lot.g = Number.isFinite(v) && v >= 0 ? v : 0; touch(); });
      del.addEventListener('click', () => { state.lots.splice(i, 1); state.isExample = false; save(); renderLots(); renderTotals(); });
      row.append(name, sel, g, del);
      lotsEl.appendChild(row);
    });
  }
  $('lot-add').addEventListener('click', () => {
    state.lots.push({ name: '', carat: '18', g: 0 });
    state.isExample = false; save(); renderLots(); renderTotals();
    const last = $('lot-name-' + (state.lots.length - 1)); if (last) last.focus();
  });
  $('lot-reset').addEventListener('click', () => {
    state.lots = DEFAULT_LOTS.map((l) => ({ ...l })); state.isExample = true; save(); renderLots(); renderTotals();
  });

  function computeLots() {
    let weight = 0, fine = 0, w18 = 0;
    state.lots.forEach((l) => {
      weight += l.g; fine += l.g * TITRES[l.carat];
      if (l.carat === '18') w18 += l.g;
    });
    const metal = fine * spot();
    return { weight, fine, w18, metal, o80: metal * 0.8, o85: metal * 0.85, o90: metal * 0.9 };
  }

  function renderTotals() {
    const c = computeLots();
    $('lots-example').hidden = !state.isExample;
    const taxed = c.o85 > 5000;
    const taxRow = taxed
      ? `<div><dt>Fiscalité si vendu en une seule fois</dt><dd>6,5 % : −${eur(c.o85 * 0.065)}</dd></div>`
      : `<div><dt>Fiscalité</dt><dd>Exonéré (moins de 5 000 €)</dd></div>`;
    $('totals').innerHTML = `
      <div><dt>Poids total</dt><dd>${F1.format(c.weight)} g</dd></div>
      <div><dt>Or fin contenu</dt><dd>${F2.format(c.fine)} g</dd></div>
      <div><dt>Valeur métal au cours utilisé</dt><dd>${eur(c.metal)}</dd></div>
      <div><dt>Offre à 80 % (correcte)</dt><dd>${eur(c.o80)}</dd></div>
      <div class="em"><dt>Offre à 85 % (bonne)</dt><dd>${eur(c.o85)}</dd></div>
      <div><dt>Offre à 90 % (excellente)</dt><dd>${eur(c.o90)}</dd></div>
      ${taxRow}
      <div><dt>Dont or 18 carats, pour vos devis</dt><dd>${F1.format(c.w18)} g</dd></div>`;
    renderLevers(c);
    renderQuotes(c);
    renderScript(c);
  }

  function renderLevers(c) {
    const items = [
      { k: 'Choix du comptoir', d: 'offre à 75 % ou à 88 % de la valeur métal', v: c.metal * (0.88 - 0.75) },
      { k: 'Mouvement du cours', d: '± 6 %, la variation du dernier mois', v: c.metal * 0.85 * 0.06 },
      { k: 'Fiscalité', d: c.o85 > 5000 ? '6,5 % au-delà de 5 000 € par cession' : 'aucune sous 5 000 € par cession', v: c.o85 > 5000 ? c.o85 * 0.065 : 0 }
    ];
    const max = Math.max(1, ...items.map((i) => i.v));
    $('levers').innerHTML = items.map((i) => `
      <div class="lever">
        <div><strong>${i.k}</strong><span class="sub muted" style="display:block;font-size:.84rem">${i.d}</span></div>
        <div class="bar" aria-hidden="true"><span style="width:${Math.max(i.v > 0 ? 2 : 0, (i.v / max) * 100)}%"></span></div>
        <div class="n">${i.v > 0 ? '± ' : ''}${eur(i.v)}</div>
      </div>`).join('');
  }

  /* ---------- Devis ---------- */
  function verdict(r) {
    if (r >= 0.85) return '<span class="pill good">Bonne offre</span>';
    if (r >= 0.80) return '<span class="pill gold">Correcte</span>';
    if (r >= 0.75) return '<span class="pill warn">Faible, à négocier</span>';
    return '<span class="pill bad">À refuser</span>';
  }
  const quotesBody = $('quotes-body');
  function buildQuotes() {
    quotesBody.innerHTML = '';
    SHOPS.forEach((sh) => {
      const tr = document.createElement('tr');
      tr.dataset.shop = sh.id;
      const tdName = document.createElement('td'); tdName.className = 'name'; tdName.textContent = sh.name;
      const tdIn = document.createElement('td'); tdIn.className = 'n';
      const inp = document.createElement('input');
      inp.type = 'number'; inp.id = 'quote-' + sh.id; inp.min = '0'; inp.max = '300'; inp.step = '0.01'; inp.inputMode = 'decimal';
      inp.placeholder = '—'; inp.setAttribute('aria-label', 'Prix proposé par ' + sh.name + ' en euros par gramme');
      if (state.quotes[sh.id]) inp.value = state.quotes[sh.id];
      inp.addEventListener('input', () => {
        const v = parseFloat(inp.value);
        if (Number.isFinite(v) && v > 0) state.quotes[sh.id] = v; else delete state.quotes[sh.id];
        save(); renderQuotes(computeLots());
      });
      tdIn.appendChild(inp);
      const tdPct = document.createElement('td'); tdPct.className = 'n'; tdPct.dataset.role = 'pct';
      const tdVer = document.createElement('td'); tdVer.dataset.role = 'ver';
      const tdTot = document.createElement('td'); tdTot.className = 'n'; tdTot.dataset.role = 'tot';
      tr.append(tdName, tdIn, tdPct, tdVer, tdTot);
      quotesBody.appendChild(tr);
    });
  }
  function renderQuotes(c) {
    const metal18 = spot() * 0.75;
    let best = null;
    SHOPS.forEach((sh) => { const v = state.quotes[sh.id]; if (v && (!best || v > state.quotes[best])) best = sh.id; });
    quotesBody.querySelectorAll('tr').forEach((tr) => {
      const v = state.quotes[tr.dataset.shop];
      const pct = tr.querySelector('[data-role="pct"]');
      const ver = tr.querySelector('[data-role="ver"]');
      const tot = tr.querySelector('[data-role="tot"]');
      tr.classList.toggle('best', !!v && tr.dataset.shop === best);
      if (!v) { pct.textContent = '—'; ver.innerHTML = '<span class="pill neutral">À demander</span>'; tot.textContent = '—'; return; }
      const r = v / metal18;
      pct.textContent = F0.format(r * 100) + ' %';
      ver.innerHTML = verdict(r) + (tr.dataset.shop === best ? ' <span class="pill gold">Meilleure</span>' : '');
      // Le prix 18 carats est ramené aux autres titres au prorata de l'or fin.
      const total = state.lots.reduce((acc, l) => acc + l.g * v * (TITRES[l.carat] / 0.75), 0);
      tot.textContent = eur(total);
    });
    const count = Object.keys(state.quotes).length;
    $('quotes-note').textContent = count
      ? 'Montants calculés sur ' + F1.format(c.weight) + ' g de bijoux, les autres titres étant ramenés au prorata de l\'or fin. Une offre « bonne » aujourd\'hui démarre à ' + F2.format(metal18 * 0.85) + ' €/g.'
      : 'Aucun devis saisi pour l\'instant. Une offre « bonne » aujourd\'hui démarre à ' + F2.format(metal18 * 0.85) + ' €/g.';
  }

  /* ---------- Script d'appel ---------- */
  let scriptText = '';
  function renderScript(c) {
    const w = c.w18 > 0 ? F0.format(Math.round(c.w18)) : 'quelques';
    scriptText = 'Bonjour, je souhaite vendre des bijoux en or 18 carats (poinçon 750), environ ' + w +
      ' grammes au total, rachetés au poids pour la fonte. Pouvez-vous m\'indiquer votre prix de rachat au gramme aujourd\'hui, net de toute commission, et le cours de l\'or fin sur lequel il est calculé ? ' +
      'Le paiement se fait-il par virement instantané ? Faut-il prendre rendez-vous ? Merci.';
    $('call-script').textContent = scriptText;
  }
  $('copy-script').addEventListener('click', () => {
    const msg = $('copy-msg');
    const fallback = () => {
      const range = document.createRange(); range.selectNodeContents($('call-script'));
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      msg.textContent = 'Texte sélectionné : copiez-le avec le menu ou le raccourci de votre appareil.';
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(scriptText).then(() => { msg.textContent = 'Texte copié.'; }).catch(fallback);
    } else fallback();
  });

  /* ---------- Check-list ---------- */
  document.querySelectorAll('#checks input[type="checkbox"]').forEach((cb) => {
    cb.checked = !!state.checks[cb.id];
    cb.addEventListener('change', () => { state.checks[cb.id] = cb.checked; save(); });
  });

  /* ---------- Cours saisi ---------- */
  const spotInput = $('spot-input');
  spotInput.addEventListener('change', () => {
    const v = parseFloat(spotInput.value);
    if (Number.isFinite(v) && v >= 20 && v <= 500) {
      state.spotOverride = Math.abs(v - state.live.eur_g) < 0.005 ? null : v;
    } else {
      spotInput.value = spot().toFixed(2);
    }
    save(); renderAll();
  });
  $('spot-reset').addEventListener('click', () => { state.spotOverride = null; save(); renderAll(); });

  /* ---------- Navigation ---------- */
  document.querySelectorAll('a[href^="http"]').forEach((a) => { a.target = '_blank'; a.rel = 'noopener'; });
  const navLinks = Array.from(document.querySelectorAll('.tabs a'));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) navLinks.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + en.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['bref', 'quand', 'ou', 'sources'].forEach((id) => { const el = $(id); if (el) io.observe(el); });
  }

  /* ---------- Rendu ---------- */
  function renderAll() {
    renderBinds();
    renderThresholds();
    renderTotals();
    drawChart();
  }
  buildQuotes();
  renderLots();
  renderAll();

  // Cours du jour publié par la mise à jour automatique (data/cours.json).
  fetch('data/cours.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (d && typeof d.eur_g === 'number' && d.eur_g > 30 && d.eur_g < 500 && d.status === 'live') {
        state.live = d;
        if (state.spotOverride && Math.abs(state.spotOverride - d.eur_g) < 0.005) state.spotOverride = null;
        renderAll();
      }
    })
    .catch(() => { /* hors ligne ou fichier absent : le cours de référence reste affiché */ });
})();
