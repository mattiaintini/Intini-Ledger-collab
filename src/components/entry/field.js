/* eslint-disable @typescript-eslint/no-unused-vars -- file portato tale e quale da Backtesta */
// Portata dalla pagina di accesso di Backtesta (~/replay-lab/web/hero-field.js), stessa scena.
// Scena d'ingresso: una sola composizione in tre zone. A sinistra le candele reali su un fondo
// di profondita', a destra la heatmap del book, la scaletta degli ordini e il profilo dei volumi.
import { HERO_BARS } from './hero-bars.js';

const CX = 200, CY = 128;   // campo termico a bassa risoluzione, poi ingrandito con interpolazione

export function renderField(canvas, opts = {}) {
  if (!canvas) return null;
  const dim = opts.dim ? 0.45 : 1;
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  let w = 0, h = 0, raf = 0, heat = null, heatSoft = null, profile = null, book = null, bookLayer = null;
  const rnd = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };

  // --- dati veri: le candele dell'anteprima, normalizzate sull'altezza della scena
  const src = HERO_BARS.slice(-76);
  const hiP = Math.max(...src.map((b) => b[2])), loP = Math.min(...src.map((b) => b[3]));
  const norm = (p) => (p - loP) / (hiP - loP);
  const lastClose = norm(src.at(-1)[4]);
  const band = () => ({ top: h * 0.10, bot: h * 0.90 });
  // su schermo stretto la scaletta degli ordini non ha spazio: restano candele, heatmap e profilo
  const narrow = () => w < 700;
  const colX = () => (narrow()
    ? { cand: w * 0.58, heatL: 0, heatR: w, bookX: 0, bookW: 0, profR: w, profW: w * 0.3 }
    : { cand: w * 0.52, heatL: 0, heatR: w, bookX: w * 0.79, bookW: w * 0.23, profR: w, profW: w * 0.22 });

  const levels = Array.from({ length: 15 }, (_, i) => ({
    y: 0.10 + rnd(i * 5.7) * 0.8,
    thick: 0.006 + rnd(i * 2.3) * 0.02,
    heat: 0.5 + rnd(i * 8.1) * 0.6,
    from: rnd(i * 3.7) * 0.55,
    to: 0.45 + rnd(i * 6.9) * 0.55,
  }));
  const priceAt = (u) => lastClose + Math.sin(u * 5.1) * 0.10 + Math.sin(u * 12.7 + 1.1) * 0.03;

  function buildHeat() {
    const c = document.createElement('canvas'); c.width = CX; c.height = CY;
    const g = c.getContext('2d'); const img = g.createImageData(CX, CY);
    for (let x = 0; x < CX; x++) {
      const u = x / CX, px = 1 - priceAt(u);
      for (let y = 0; y < CY; y++) {
        const v = y / CY;
        let t = 0.09 + Math.exp(-Math.pow((v - px) / 0.10, 2)) * 0.2 + rnd(x * 1.37 + y * 2.11) * 0.045;
        for (const L of levels) {
          if (u < L.from || u > L.to) continue;
          const life = Math.min(1, (u - L.from) / 0.07) * Math.min(1, (L.to - u) / 0.06);
          t += L.heat * life * Math.exp(-Math.pow((v - (1 - L.y)) / L.thick, 2));
        }
        t = Math.min(1, t);
        let r, gg, b, a;
        if (t < 0.4) { const k = t / 0.4; r = 16 + k * 20; gg = 28 + k * 72; b = 66 + k * 124; a = k * 0.5; }
        else if (t < 0.75) { const k = (t - 0.4) / 0.35; r = 36 - k * 4; gg = 100 + k * 130; b = 190 + k * 15; a = 0.5 + k * 0.3; }
        else { const k = (t - 0.75) / 0.25; r = 32 + k * 223; gg = 230 + k * 20; b = 205; a = 0.8 + k * 0.2; }
        const o = (y * CX + x) * 4;
        img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = a * 255 * dim;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  // profilo dei volumi: quanto e' stato scambiato a ogni prezzo, con POC e area di valore
  function buildProfile() {
    const rows = 74, vol = new Array(rows).fill(0);
    for (const b of src) {
      const a = Math.floor(norm(b[3]) * (rows - 1)), z = Math.floor(norm(b[2]) * (rows - 1));
      const each = 1 / Math.max(1, z - a + 1);
      for (let r = a; r <= z; r++) vol[r] += each;
    }
    const max = Math.max(...vol), v = vol.map((x) => x / max);
    const poc = v.indexOf(1);
    // area di valore: si allarga dal POC finche' non copre il 70% del volume
    const total = v.reduce((s, x) => s + x, 0);
    let lo = poc, hi = poc, acc = v[poc];
    while (acc < total * 0.7 && (lo > 0 || hi < rows - 1)) {
      const dn = lo > 0 ? v[lo - 1] : -1, up = hi < rows - 1 ? v[hi + 1] : -1;
      if (up >= dn) { hi++; acc += v[hi]; } else { lo--; acc += v[lo]; }
    }
    return { v, poc, lo, hi };
  }

  // scaletta degli ordini attorno all'ultimo prezzo reale: prezzi veri, size che si muovono
  const lastPrice = src.at(-1)[4];
  const tick = Math.max(0.05, Math.round(((hiP - loP) / 80) * 20) / 20);
  const dec = tick < 1 ? 2 : 1;
  // i numeri non stanno in colonna: prendono posto in una griglia larga con uno scarto casuale,
  // cosi' sono sparsi nella scena ma non si sovrappongono mai
  function scatterSlots(n, small) {
    const out = [];
    if (small) {
      // schermo stretto: a destra c'e' solo il profilo, i numeri stanno sopra, sotto e a sinistra
      for (let j = 0; j < 4; j++) out.push({ xf: 0.17 + j * 0.22, yf: 0.045 });
      for (let j = 0; j < 4; j++) out.push({ xf: 0.17 + j * 0.22, yf: 0.94 });
      for (let j = 0; j < 3; j++) out.push({ xf: 0.19, yf: 0.12 + j * 0.24 });
    } else {
      out.push({ xf: 0.9, yf: 0.055 }, { xf: 0.9, yf: 0.115 }, { xf: 0.9, yf: 0.875 }, { xf: 0.9, yf: 0.935 });
      for (let j = 0; j < 5; j++) out.push({ xf: 0.062, yf: 0.15 + j * 0.16 });
      for (let j = 0; j < 3; j++) out.push({ xf: 0.225, yf: 0.22 + j * 0.24 });
      for (let j = 0; j < 6; j++) out.push({ xf: 0.34 + j * 0.09, yf: 0.05 });
      for (let j = 0; j < 6; j++) out.push({ xf: 0.32 + j * 0.09, yf: 0.92 });
    }
    return Array.from({ length: n }, (_, k) => {
      const p = out[k];
      if (!p) return { xf: -1, yf: 0 };   // in piu' del posto disponibile: non si disegna
      return {
        xf: p.xf + (rnd(k * 3.7 + 1) - 0.5) * 0.02,
        yf: Math.min(0.95, Math.max(0.03, p.yf + (rnd(k * 5.3 + 2) - 0.5) * 0.04)),
      };
    });
  }

  function buildBook() {
    const out = [];
    for (let i = -20; i <= 20; i++) {
      if (!i) continue;
      const cluster = Math.exp(-Math.pow(i / 9, 2)) * 0.5;
      out.push({
        i, ask: i > 0,
        price: (lastPrice + i * tick).toFixed(dec).replace('.', ','),
        size: Math.round(18 + rnd(i * 4.4 + 3) * 210 + cluster * 190),
        seed: rnd(i * 9.1),
      });
    }
    placeNumbers(out);
    return out;
  }
  let bookAt = 0;
  function stepBook(now) {
    if (now - bookAt < 340) return;
    bookAt = now;
    for (const r of book) {
      const drift = (Math.random() - 0.48) * 64;
      r.size = Math.max(12, Math.min(340, Math.round(r.size + drift)));
    }
    renderBookLayer();
  }

  // la heatmap con il suo alone viene composta una volta sola: sfocare a ogni frame costa troppo
  function buildHeatSoft() {
    const c = document.createElement('canvas'); c.width = 600; c.height = 340;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(heat, 0, 0, 600, 340);
    g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.55;
    if ('filter' in g) g.filter = 'blur(9px)';
    g.drawImage(heat, 0, 0, 600, 340);
    return c;
  }

  // la scaletta degli ordini si ridisegna solo quando le size cambiano, poi si incolla
  function renderBookLayer() {
    const { top, bot } = band(), { bookX, bookW } = colX();
    if (!bookX || !h) { bookLayer = null; return; }
    const lw = bookW + 24;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(lw * dpr)); c.height = Math.max(1, Math.round(h * dpr));
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const right = bookW + 12;
    const rows = book.length, rh = Math.min(22, (bot - top) / (rows + 2));
    const mid = (top + bot) / 2, fs = Math.max(9, Math.min(11.5, rh * 0.46));
    if ('filter' in g) g.filter = 'blur(4px)';
    for (const r of book) {
      const y = mid - r.i * rh * (r.ask ? 1 : 1) - (r.ask ? rh * 0.55 : -rh * 0.55);  // stacco sullo spread
      if (y < top || y > bot) continue;
      const end = right - r.seed * 14;   // l'asse non e' una riga perfetta
      const len = Math.max(8, (r.size / 340) * bookW);
      const col = r.ask ? '139,92,246' : '34,232,207';
      // piu' vicino al prezzo, piu' densa la massa
      const near = Math.exp(-Math.pow(r.i / 11, 2));
      const a = (0.17 + near * 0.26) * dim;
      const grd = g.createLinearGradient(end - len, 0, end, 0);
      grd.addColorStop(0, `rgba(${col},0)`);
      grd.addColorStop(0.72, `rgba(${col},${(a * 0.72).toFixed(3)})`);
      grd.addColorStop(1, `rgba(${col},${a.toFixed(3)})`);
      g.fillStyle = grd;
      const hgt = Math.max(3, rh * 0.5);
      g.beginPath();
      if (g.roundRect) g.roundRect(end - len, y - hgt / 2, len, hgt, hgt / 2);
      else g.rect(end - len, y - hgt / 2, len, hgt);
      g.fill();
    }
    if ('filter' in g) g.filter = 'none';
    const sep = g.createLinearGradient(right - bookW, 0, right + 10, 0);
    sep.addColorStop(0, 'rgba(255,255,255,0)');
    sep.addColorStop(0.5, `rgba(255,255,255,${(0.3 * dim).toFixed(3)})`);
    sep.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sep; g.fillRect(right - bookW, mid - 0.6, bookW + 12, 1.2);
    g.globalCompositeOperation = 'destination-out';
    const off = g.createLinearGradient(0, 0, lw * 0.34, 0);
    off.addColorStop(0, 'rgba(0,0,0,1)'); off.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = off; g.fillRect(0, 0, lw * 0.34, h);
    bookLayer = { canvas: c, x: bookX - bookW - 12, w: lw };
  }

  let placedNarrow = null;
  function placeNumbers(rows) {
    placedNarrow = narrow();
    const slots = scatterSlots(rows.length, placedNarrow);
    rows.forEach((r, k) => { r.xf = slots[k].xf; r.yf = slots[k].yf; });
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    w = r.width; h = r.height;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    if (!heat) { heat = buildHeat(); heatSoft = buildHeatSoft(); profile = buildProfile(); book = buildBook(); }
    if (book && placedNarrow !== narrow()) placeNumbers(book);
    renderBookLayer();
    draw(0);
  }

  // fondo delle candele: profondita' morbida sotto i prezzi, nessuna linea tracciata
  function drawDepth(g) {
    const { top, bot } = band(), { cand } = colX(), bw = cand / src.length;
    const halo = g.createRadialGradient(w * 0.2, h * 0.46, 0, w * 0.2, h * 0.46, w * 0.42);
    halo.addColorStop(0, `rgba(24,74,96,${(0.34 * dim).toFixed(3)})`);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = halo; g.fillRect(0, 0, cand, h);
    const area = g.createLinearGradient(0, top, 0, bot);
    area.addColorStop(0, `rgba(34,232,207,${(0.13 * dim).toFixed(3)})`);
    area.addColorStop(1, 'rgba(34,232,207,0)');
    g.beginPath(); g.moveTo(0, bot);
    src.forEach((b, i) => g.lineTo((i + 0.5) * bw, bot - norm(b[4]) * (bot - top)));
    g.lineTo(cand, bot); g.closePath();
    g.fillStyle = area; g.fill();
  }

  function drawCandles(g, k) {
    const { top, bot } = band(), { cand } = colX(), bw = cand / src.length;
    const y = (p) => bot - norm(p) * (bot - top);
    const glow = 0.9 + Math.sin(k / 5) * 0.1;
    g.save();
    g.globalCompositeOperation = 'lighter';
    src.forEach((b, i) => {
      const [, o, hg, lw, c] = b;
      const x = i * bw + bw * 0.5;
      const col = c >= o ? '34,232,207' : '150,110,255';
      g.strokeStyle = `rgba(${col},${(0.62 * dim * glow).toFixed(3)})`; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(x, y(hg)); g.lineTo(x, y(lw)); g.stroke();
      g.fillStyle = `rgba(${col},${(0.52 * dim * glow).toFixed(3)})`;
      g.fillRect(x - bw * 0.32, Math.min(y(o), y(c)), Math.max(1.6, bw * 0.64), Math.max(1.6, Math.abs(y(c) - y(o))));
    });
    g.restore();
  }

  function drawBook(g) {
    if (bookLayer) g.drawImage(bookLayer.canvas, bookLayer.x, 0, bookLayer.w, h);
  }

  function drawBookNumbers(g) {
    const fs = Math.max(9.5, Math.min(12, w / 128));
    g.save();
    g.textBaseline = 'middle';
    for (const r of book) {
      if (r.xf < 0) continue;
      const x = r.xf * w, y = r.yf * h;
      const a = 0.2 + r.seed * 0.28;
      g.font = `500 ${fs.toFixed(1)}px Archivo, Inter, system-ui, sans-serif`;
      g.textAlign = 'right';
      g.fillStyle = `rgba(255,255,255,${(a * 0.62 * dim).toFixed(3)})`;
      g.fillText(r.price, x, y);
      g.textAlign = 'left';
      g.fillStyle = r.ask ? `rgba(206,188,255,${((a + 0.14) * dim).toFixed(3)})` : `rgba(150,244,231,${((a + 0.14) * dim).toFixed(3)})`;
      g.fillText(String(r.size), x + 7, y);
    }
    g.restore();
  }

  function drawProfile(g) {
    const { top, bot } = band(), { profR } = colX();
    const { v, poc, lo, hi } = profile, maxW = colX().profW, rh = (bot - top) / v.length;
    g.save();
    v.forEach((val, r) => {
      const y = bot - (r + 1) * rh, len = Math.max(1, val * maxW);
      const inVA = r >= lo && r <= hi;
      g.fillStyle = r === poc ? `rgba(255,246,206,${(0.94 * dim).toFixed(3)})`
        : inVA ? `rgba(34,232,207,${(0.62 * dim).toFixed(3)})`
          : `rgba(130,185,215,${(0.3 * dim).toFixed(3)})`;
      g.fillRect(profR - len, y, len, Math.max(1.2, rh - 1.1));
    });
    g.restore();
  }

  function draw(now) {
    if (!heat) return;
    const k = now / 1000;
    const shift = reduced ? 0 : (k * 0.008) % 1;
    const { heatL, heatR, cand } = colX();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';

    // destra: la heatmap scorre, poi il book e il profilo le stanno sopra
    // la liquidita' sta su tutta la scena, appena accennata: nessuna zona con un taglio netto
    ctx.save();
    const hw = w * 0.62, x0 = heatL - shift * hw;
    ctx.globalAlpha = 0.34;
    for (const off of [x0 - hw, x0, x0 + hw, x0 + hw * 2]) ctx.drawImage(heatSoft, off, 0, hw, h);
    ctx.restore();

    if (!reduced) stepBook(now);
    drawBook(ctx);
    drawProfile(ctx);
    drawBookNumbers(ctx);

    // sinistra: fondo di profondita' e candele vere
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, cand + 2, h); ctx.clip();
    drawDepth(ctx);
    drawCandles(ctx, k);
    ctx.restore();

    // i due lati svaniscono verso il centro, dove sta il titolo
    ctx.globalCompositeOperation = 'destination-out';
    const gl = ctx.createLinearGradient(0, 0, w * 0.5, 0);
    gl.addColorStop(0, 'rgba(0,0,0,0)'); gl.addColorStop(.72, 'rgba(0,0,0,.12)'); gl.addColorStop(1, 'rgba(0,0,0,.88)');
    ctx.fillStyle = gl; ctx.fillRect(0, 0, w * 0.5, h);
    const gr = ctx.createLinearGradient(w * 0.5, 0, w * 0.82, 0);
    gr.addColorStop(0, 'rgba(0,0,0,.88)'); gr.addColorStop(.3, 'rgba(0,0,0,.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(w * 0.5, 0, w * 0.32, h);
    ctx.globalCompositeOperation = 'source-over';

    if (!reduced) raf = requestAnimationFrame(draw);
  }

  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
  resize();
  return { stop() { cancelAnimationFrame(raf); ro.disconnect(); } };
}
