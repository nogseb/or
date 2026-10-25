/* Planches animées du bandeau, dans l'esprit de nogues.app : trois dessins techniques qui se construisent
   puis sont effacés à la gomme, en alternance. C · les lingots s'empilent, B · le graphique se construit,
   F · l'enregistreur du cours. Chaque trait naît blanc chaud puis refroidit en bronze.
   Canvas 2D sans bibliothèque ; pause hors écran ou onglet masqué ; image fixe si les animations sont réduites.
   Montants calculés avec le cours du jour (data/cours.json). */
(() => {
  'use strict';
  const band = document.querySelector('.band');
  const cv = document.createElement('canvas');
  if (!band || !cv.getContext) return;
  const ctx = cv.getContext('2d');
  cv.className = 'band-canvas';
  cv.setAttribute('aria-hidden', 'true');
  band.prepend(cv);

  const NB = ' ';
  const RECORD = 146.2;
  const ANNUAL = [36.3, 35.8, 34.5, 40.0, 49.8, 48.9, 55.0, 57.7, 70.9, 97.5, 125.9];
  const MONTHLY = [112.15, 113.66, 118.34, 130.13, 136.48, 135.03, 129.61, 126.31, 118.0, 114.64, 122.33, 120.81];
  const MONTHS = ['oct.', 'nov.', 'déc.', 'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.'];
  let SPOT = 118.6;
  const nf = (d) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const F0 = nf(0), F1 = nf(1), F2 = nf(2);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const TAU = Math.PI * 2;

  /* ---------- Outils ---------- */
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lin = (t, a, b) => clamp01((t - a) / (b - a));
  const ease = (p) => 1 - Math.pow(1 - p, 3);
  const easeIn = (p) => p * p * p;
  const seg = (t, a, b) => ease(lin(t, a, b));
  const lerp = (a, b, p) => a + (b - a) * p;
  function hexRgb(h) {
    h = String(h).replace('#', '').trim();
    if (h.length === 3) h = h.replace(/(.)/g, '$1$1');
    const n = parseInt(h, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgba = (h, a) => { const c = hexRgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; };
  const mix = (h1, h2, p) => { const A = hexRgb(h1), B = hexRgb(h2); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * p)).join(',') + ')'; };
  function colors() {
    const st = getComputedStyle(band), g = (n) => st.getPropertyValue(n).trim();
    return { ink: g('--hero-ink'), deep: g('--hero-deep'), shine: g('--hero-shine'), h1: g('--hero-1'), h2: g('--hero-2') };
  }

  function makeDraw(C, kk) {
    const D = {
      kk,
      hot: (a = 1) => rgba(C.shine, 0.95 * a),
      cold: (a = 1) => rgba(C.deep, 0.58 * a),
      tone: (t, end, a = 1) => (t < end + 0.35 ? D.hot(a) : D.cold(a)),
      set(color) { ctx.strokeStyle = color; ctx.fillStyle = color; },
      font(px) { ctx.font = '500 ' + Math.round(px * kk) + 'px "IBM Plex Mono", ui-monospace, Menlo, monospace'; },
      text(s, x, y, align = 'center', a = 1, px = 11) {
        if (a <= 0) return;
        D.font(px); ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = rgba(C.ink, 0.86 * a); ctx.fillText(s, x, y);
      },
      // Polylignes tracées sur une fraction p de leur longueur totale.
      paths(list, p) {
        let total = 0;
        list.forEach((pts) => { for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); });
        let rem = total * clamp01(p);
        if (rem <= 0) return;
        ctx.beginPath();
        for (let k = 0; k < list.length && rem > 0; k++) {
          const pts = list[k];
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length; i++) {
            const sl = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
            if (rem >= sl) { ctx.lineTo(pts[i][0], pts[i][1]); rem -= sl; }
            else { const q = rem / sl; ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], q), lerp(pts[i - 1][1], pts[i][1], q)); rem = 0; break; }
          }
        }
        ctx.stroke();
      },
      line(x1, y1, x2, y2, p = 1) { D.paths([[[x1, y1], [x2, y2]]], p); },
      arrow(x, y, ux, uy) {
        const nx = -uy, ny = ux, s = 6 * kk;
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.lineTo(x + ux * s + nx * s * 0.42, y + uy * s + ny * s * 0.42);
        ctx.lineTo(x + ux * s - nx * s * 0.42, y + uy * s - ny * s * 0.42);
        ctx.closePath(); ctx.fill();
      },
      // Cote : traits d'attache, ligne de cote, flèches et valeur une fois tracée.
      cote(x1, y1, x2, y2, p, label, la, pos) {
        if (p <= 0) return;
        const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux, e = 5 * kk;
        ctx.beginPath();
        ctx.moveTo(x1 - nx * e, y1 - ny * e); ctx.lineTo(x1 + nx * e, y1 + ny * e);
        ctx.moveTo(x1, y1); ctx.lineTo(x1 + dx * p, y1 + dy * p);
        const done = p > 0.985;
        if (done) { ctx.moveTo(x2 - nx * e, y2 - ny * e); ctx.lineTo(x2 + nx * e, y2 + ny * e); }
        ctx.stroke();
        D.arrow(x1, y1, ux, uy);
        if (done) D.arrow(x2, y2, -ux, -uy);
        if (done && label && pos) D.text(label, pos.x, pos.y, pos.align || 'center', la, pos.px || 10.5);
      },
      cross(x, y, s) { ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); ctx.stroke(); },
      circle(cx, cy, r) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke(); },
      dash(on) { ctx.setLineDash(on ? [3 * kk, 4 * kk] : []); },
      fillPoly(pts, fill) { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
    };
    return D;
  }

  function roundRect(x, y, w, h, r) {
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  // La gomme balaie la planche de gauche à droite et efface ce qu'elle a dépassé.
  function eraser(D, C, S, W, H, q, drawFn) {
    if (q <= 0) { drawFn(); return; }
    if (q >= 1) return;
    const ex = S.x - 30 + (S.w + 60) * q;
    ctx.save(); ctx.beginPath(); ctx.rect(ex, 0, W - ex, H); ctx.clip(); drawFn(); ctx.restore();
    const k = D.kk, ey = S.y + S.h * 0.5 + Math.sin(q * Math.PI * 7) * S.h * 0.3;
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(-0.4);
    ctx.beginPath(); roundRect(-9 * k, -22 * k, 18 * k, 44 * k, 3 * k);
    ctx.fillStyle = rgba(C.shine, 0.92); ctx.fill();
    ctx.strokeStyle = rgba(C.ink, 0.55); ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-9 * k, -5 * k); ctx.lineTo(9 * k, -5 * k); ctx.stroke();
    ctx.restore();
  }

  // Lingot en perspective cavalière : tronc de pyramide vu de face, côté droit et dessus.
  function ingot(ox, oy, w) {
    const d = w * 0.42, h = w * 0.26, i = w * 0.09, j = d * 0.2;
    const P = (x, y, z) => [ox + x + z * 0.55, oy - y - z * 0.42];
    const f0 = P(0, 0, 0), f1 = P(w, 0, 0), f2 = P(w - i, h, j), f3 = P(i, h, j), r1 = P(w, 0, d), r2 = P(w - i, h, d - j), t3 = P(i, h, d - j);
    return {
      w, h, d,
      front: [f0, f1, f2, f3], right: [f1, r1, r2, f2], top: [f3, f2, r2, t3],
      outline: [[f0, f1, f2, f3, f0], [f1, r1, r2, f2], [r2, t3, f3]],
      center: P(w / 2, h, d / 2),
      box: [f0[0], t3[1], r1[0], f0[1]]
    };
  }

  /* ---------- Planche C : les lingots s'empilent ---------- */
  const lingots = {
    cycle: 16.5,
    draw(D, C, tc, S, W, H) {
      const k = D.kk;
      const w = Math.min(S.w * 0.2, S.h * 0.48, 104 * k), g = w * 0.08;
      const ref = ingot(0, 0, w), h = ref.h, d = ref.d;
      const ox = S.x + S.w * 0.06, oy = S.y + S.h - 16 * k;
      const pileR = ox + 3 * w + 2 * g + d * 0.55, pileTop = oy - 3 * h - d * 0.42;
      const SLOTS = [[0, 0], [1, 0], [2, 0], [0.5, 1], [1.5, 1], [1, 2]];
      eraser(D, C, S, W, H, lin(tc, 13.8, 15.6), () => {
        SLOTS.forEach((s, n) => {
          const st = 0.4 + n * 1.45;
          if (tc < st) return;
          const drop = lin(tc, st + 1.05, st + 1.38);
          const G = ingot(ox + s[0] * (w + g), oy - s[1] * h - h * 1.9 * (1 - easeIn(drop)), w);
          const fr = lin(tc, st, st + 0.2) * (1 - lin(tc, st + 0.9, st + 1.3));
          if (fr > 0) {
            D.dash(true); ctx.strokeStyle = rgba(C.ink, 0.38 * fr);
            ctx.strokeRect(G.box[0] - 4 * k, G.box[1] - 4 * k, G.box[2] - G.box[0] + 8 * k, G.box[3] - G.box[1] + 8 * k);
            D.dash(false);
          }
          const fa = lin(tc, st + 0.75, st + 1.05);
          if (fa > 0) {
            ctx.save(); ctx.globalAlpha *= fa;
            D.fillPoly(G.front, mix(C.h2, C.deep, 0.16));
            D.fillPoly(G.right, mix(C.h2, C.deep, 0.42));
            D.fillPoly(G.top, mix(C.h1, C.shine, 0.45));
            ctx.restore();
          }
          D.set(D.tone(tc, st + 0.85)); D.paths(G.outline, seg(tc, st + 0.05, st + 0.85));
          const sa = lin(tc, st + 0.95, st + 1.2);
          if (sa > 0) {
            ctx.save(); ctx.translate(G.center[0], G.center[1]); ctx.transform(1, 0, -0.8, 0.62, 0, 0);
            ctx.font = '500 ' + Math.round(w * 0.13) + 'px "IBM Plex Mono", ui-monospace, monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = rgba(C.deep, 0.8 * sa); ctx.fillText('999,9', 0, 0);
            ctx.restore();
          }
          if (drop >= 1 && tc < st + 1.7) {
            D.set(D.hot(1 - lin(tc, st + 1.38, st + 1.7)));
            D.line(G.box[0] - 3 * k, G.box[3] + 1, G.box[0] - 11 * k, G.box[3] + 1);
            D.line(G.box[2] + 3 * k, G.box[3] - d * 0.42 + 1, G.box[2] + 11 * k, G.box[3] - d * 0.42 + 1);
          }
        });
        const cp = seg(tc, 9.4, 10.2), cx = pileR + 12 * k;
        if (cp > 0) {
          D.set(D.tone(tc, 10.2));
          D.cote(cx, oy, cx, pileTop, cp, '6 lingots de 1' + NB + 'kg', lin(tc, 10.1, 10.5), { x: cx + 9 * k, y: (oy + pileTop) / 2 - 4 * k, align: 'left' });
          D.text('= ' + F0.format(Math.round(6000 * SPOT / 100) * 100) + NB + '€', cx + 9 * k, (oy + pileTop) / 2 + 12 * k, 'left', lin(tc, 10.5, 10.9), 10.5);
        }
      });
    }
  };

  /* ---------- Planche B : le graphique se construit ---------- */
  const graphique = {
    cycle: 16,
    draw(D, C, tc, S, W, H) {
      const k = D.kk;
      const x0 = S.x + 30 * k, x1 = S.x + S.w - 6, yb = S.y + S.h - 18 * k, yt = S.y + 8;
      const Y = (v) => yb - (v / 160) * (yb - yt);
      const n = ANNUAL.length, slot = (x1 - x0 - 8 * k) / n, bw = Math.min(slot * 0.58, 30 * k);
      eraser(D, C, S, W, H, lin(tc, 13.4, 15.2), () => {
        D.set(D.tone(tc, 1.0)); D.line(x0, yb, x0, yt, seg(tc, 0.2, 1.0));
        D.set(D.tone(tc, 1.4)); D.line(x0, yb, x1, yb, seg(tc, 0.6, 1.4));
        [40, 80, 120, 160].forEach((v, i) => {
          const a = 1.0 + i * 0.15, p = seg(tc, a, a + 0.8);
          if (p <= 0) return;
          D.dash(true); D.set(D.tone(tc, a + 0.8, 0.7)); D.line(x0, Y(v), x1, Y(v), p); D.dash(false);
          D.text(String(v), x0 - 5 * k, Y(v) + 3.5 * k, 'right', lin(tc, a + 0.3, a + 0.8), 9.5);
        });
        ANNUAL.forEach((v, i) => {
          const a = 2.0 + i * 0.38, p = seg(tc, a, a + 0.7);
          if (p <= 0) return;
          const cx = x0 + 8 * k + slot * (i + 0.5), top = lerp(yb, Y(v), p), fa = lin(tc, a + 0.6, a + 0.95);
          if (fa > 0) { ctx.fillStyle = i === n - 1 ? rgba(C.shine, 0.75 * fa) : rgba(C.deep, 0.16 * fa); ctx.fillRect(cx - bw / 2, top, bw, yb - top); }
          D.set(D.tone(tc, a + 0.7)); ctx.strokeRect(cx - bw / 2, top, bw, yb - top);
          if (i % 2 === 0) D.text('’' + (16 + i), cx, yb + 12 * k, 'center', lin(tc, a, a + 0.4), 9);
          if (i === 0 || i === n - 1) D.text(F0.format(v), cx, top - 5 * k, 'center', lin(tc, a + 0.7, a + 1.0), 10);
        });
        const pT = seg(tc, 6.6, 7.6);
        if (pT > 0) {
          D.dash(true); D.set(D.tone(tc, 7.6)); D.line(x0, Y(SPOT), x1, Y(SPOT), pT); D.dash(false);
          D.text('aujourd’hui ' + F1.format(SPOT) + NB + '€/g', x0 + 6 * k, Y(SPOT) - 5 * k, 'left', lin(tc, 7.4, 7.9), 10);
        }
        const pR = seg(tc, 7.8, 8.8);
        if (pR > 0) {
          D.dash(true); D.set(D.tone(tc, 8.8)); D.line(x0, Y(RECORD), x1, Y(RECORD), pR); D.dash(false);
          D.text('record ' + F1.format(RECORD) + NB + '€/g', x0 + 6 * k, Y(RECORD) - 5 * k, 'left', lin(tc, 8.6, 9.1), 10);
        }
        const pc = seg(tc, 9.2, 9.9), cxc = x0 + 8 * k + slot * 9;
        if (pc > 0 && Math.abs(Y(RECORD) - Y(SPOT)) > 14 * k) {
          const gap = Math.round((SPOT / RECORD - 1) * 100);
          D.set(D.tone(tc, 9.9));
          D.cote(cxc, Y(RECORD), cxc, Y(SPOT), pc, (gap < 0 ? '−' : '+') + Math.abs(gap) + NB + '%', lin(tc, 9.8, 10.2),
            { x: cxc - 7 * k, y: (Y(RECORD) + Y(SPOT)) / 2 + 4 * k, align: 'right' });
        }
      });
    }
  };

  /* ---------- Planche F : l'enregistreur du cours ---------- */
  const enregistreur = {
    cycle: 24.8,
    draw(D, C, tc, S, W, H) {
      const k = D.kk;
      const T0 = 1.2, PLOT = 18, penX = S.x + S.w * 0.8, v = (S.w * 0.62) / PLOT;
      const ts = Math.max(0, Math.min(tc - T0, PLOT)), off = v * ts;
      const DATA = MONTHLY.concat([SPOT]);
      const vmin = Math.min(108, Math.floor((SPOT - 4) / 10) * 10), vmax = Math.max(140, Math.ceil((SPOT + 4) / 10) * 10);
      const yT = S.y + 12 * k, yB = S.y + S.h - 22 * k;
      const Y = (val) => yT + ((vmax - val) / (vmax - vmin)) * (yB - yT);
      const f = (s) => {
        const u = clamp01(s / PLOT) * 12, i = Math.min(11, Math.floor(u)), fr = u - i, sm = fr * fr * (3 - 2 * fr);
        const amp = Math.max(0, Math.min(1, (PLOT - s) * 2) * Math.min(1, s * 2));
        return lerp(DATA[i], DATA[i + 1], sm) + amp * (0.9 * Math.sin(s * 5.3) + 0.5 * Math.sin(s * 11.7 + 1) + 0.3 * Math.sin(s * 23.3 + 2));
      };
      eraser(D, C, S, W, H, lin(tc, 22.6, 24.4), () => {
        const left = S.x + 24 * k, right = S.x + S.w;
        const levels = [];
        for (let lv = Math.ceil(vmin / 10) * 10; lv <= vmax; lv += 10) levels.push(lv);
        levels.forEach((val, i) => {
          const a = 0.1 + i * 0.12, p = seg(tc, a, a + 0.8);
          if (p <= 0) return;
          D.dash(true); D.set(D.tone(tc, a + 0.8, 0.7)); D.line(left, Y(val), right, Y(val), p); D.dash(false);
          D.text(String(val), S.x + 18 * k, Y(val) + 3.5 * k, 'right', lin(tc, a + 0.3, a + 0.8), 9.5);
        });
        const ga = lin(tc, 0.6, 1.2);
        if (ga > 0) {
          const gx = 22 * k;
          ctx.strokeStyle = rgba(C.deep, 0.22 * ga); ctx.lineWidth = 1;
          const m0 = Math.ceil((off - (penX - left)) / gx), m1 = Math.floor((off + (right - penX)) / gx);
          ctx.beginPath();
          for (let m = m0; m <= m1; m++) { const x = penX - (off - m * gx); ctx.moveTo(x, yT); ctx.lineTo(x, yB); }
          ctx.stroke(); ctx.lineWidth = 1.3;
          D.set(D.cold(ga)); D.line(left, yB, right, yB);
        }
        for (let m = 0; m <= 12; m += 3) {
          const sm = (m * PLOT) / 12;
          if (sm > ts + 1e-6) continue;
          const x = penX - (off - v * sm);
          if (x < left) continue;
          D.set(D.cold()); D.line(x, yB, x, yB - 5 * k);
          D.text(MONTHS[m], x, yB + 12 * k, 'center', 1, 9);
        }
        if (tc <= T0) return;
        const pts = [];
        for (let s = Math.max(0, ts - (penX - left) / v); s <= ts; s += 0.03) pts.push([penX - v * (ts - s), Y(f(s))]);
        pts.push([penX, Y(f(ts))]);
        if (pts.length > 1) {
          ctx.lineWidth = 1.6; D.set(D.cold(1.1)); D.paths([pts], 1);
          const hotPts = pts.filter((p) => p[0] >= penX - v * 0.9);
          if (hotPts.length > 1) { D.set(D.hot()); D.paths([hotPts], 1); }
          ctx.lineWidth = 1.3;
        }
        if (ts > 6.4) {
          const xp = penX - v * (ts - 6), yp = Y(f(6));
          if (xp > left) { const a = lin(ts, 6.4, 7.0); D.set(D.cold(a)); D.cross(xp, yp, 4 * k); D.text('pic ' + F1.format(DATA[4]), xp, yp - 8 * k, 'center', a, 9.5); }
        }
        const tipY = Y(f(ts)), pivot = [penX + S.w * 0.15, yT - 8 * k];
        D.set(rgba(C.ink, 0.5)); D.line(pivot[0], pivot[1], penX, tipY);
        D.set(rgba(C.ink, 0.6)); D.circle(pivot[0], pivot[1], 3.5 * k);
        if (ts >= PLOT) {
          const pul = 0.5 + 0.5 * Math.sin(tc * 4);
          ctx.fillStyle = rgba(C.shine, 0.35 * (1 - pul)); ctx.beginPath(); ctx.arc(penX, tipY, (4 + 7 * pul) * k, 0, TAU); ctx.fill();
          D.text('aujourd’hui', penX + 9 * k, tipY - 18 * k, 'left', lin(tc, T0 + PLOT, T0 + PLOT + 0.5), 9.5);
        }
        ctx.fillStyle = rgba(C.shine, 1); ctx.strokeStyle = rgba(C.ink, 0.7);
        ctx.beginPath(); ctx.arc(penX, tipY, 3 * k, 0, TAU); ctx.fill(); ctx.stroke();
        D.text(F1.format(ts >= PLOT ? SPOT : f(ts)) + NB + '€/g', penX + 9 * k, tipY - 5 * k, 'left', 1, 10.5);
      });
    }
  };

  /* ---------- Alternance des planches ---------- */
  const PLATES = [lingots, graphique, enregistreur];
  const STILL = { plate: 0, t: 12 };
  let W = 0, H = 0, S = null, kk = 1, raf = 0, visible = true;
  let plate = 0, plateStart = performance.now();

  function measure() {
    const r = band.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const wrap = band.querySelector('.wrap'), board = band.querySelector('.board');
    if (!wrap || !board) { S = null; return; }
    const cs = getComputedStyle(wrap), wr = wrap.getBoundingClientRect(), br = board.getBoundingClientRect();
    const l = wr.left - r.left + parseFloat(cs.paddingLeft), rr = wr.right - r.left - parseFloat(cs.paddingRight);
    const top = 14, bottom = br.top - r.top - 12;
    // Sur écran étroit, le texte occupe toute la largeur du bandeau : pas de planche, pour garder la lecture nette.
    S = W < 700 ? null : { x: l + (rr - l) * 0.56, y: top, w: (rr - l) * 0.44, h: bottom - top };
    if (S) kk = Math.max(0.8, Math.min(1.15, S.w / 440));
  }
  function render(p, t) {
    if (!S || S.w < 60 || S.h < 80) { ctx.clearRect(0, 0, W, H); return; }
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.lineWidth = 1.3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const C = colors();
    PLATES[p].draw(makeDraw(C, kk), C, t, S, W, H);
    ctx.restore();
  }
  function frame(now) {
    raf = 0;
    if (!visible || document.hidden || reduce.matches) return;
    if (!S) { ctx.clearRect(0, 0, W, H); return; }
    let t = (now - plateStart) / 1000;
    if (t > 120) { plateStart = now; t = 0; }
    while (t >= PLATES[plate].cycle) {
      plateStart += PLATES[plate].cycle * 1000;
      t -= PLATES[plate].cycle;
      plate = (plate + 1) % PLATES.length;
    }
    render(plate, t);
    raf = requestAnimationFrame(frame);
  }
  let pausedAt = 0;
  function start() {
    if (reduce.matches) { render(STILL.plate, STILL.t); return; }
    if (pausedAt) { plateStart += performance.now() - pausedAt; pausedAt = 0; }
    if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function pause() { if (!pausedAt) pausedAt = performance.now(); }

  measure();
  if (reduce.matches) render(STILL.plate, STILL.t);
  start();

  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      measure();
      if (reduce.matches) render(STILL.plate, STILL.t); else start();
    }).observe(band);
  } else {
    window.addEventListener('resize', () => { measure(); if (reduce.matches) render(STILL.plate, STILL.t); });
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => {
      visible = es[0].isIntersecting;
      if (visible) start(); else pause();
    }).observe(band);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else start(); });
  if (reduce.addEventListener) reduce.addEventListener('change', () => { if (reduce.matches) render(STILL.plate, STILL.t); else start(); });
  const redrawStill = () => { if (reduce.matches) render(STILL.plate, STILL.t); };
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', redrawStill);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); redrawStill(); });

  // Cours du jour publié avec le site : les montants des planches suivent.
  fetch('data/cours.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d && typeof d.eur_g === 'number' && d.eur_g > 30 && d.eur_g < 500) { SPOT = d.eur_g; redrawStill(); } })
    .catch(() => { /* cours de référence conservé */ });
})();
