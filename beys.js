/* Beyblade Arena - Beyblade stilizzate in SVG (stile cartoon: colori pieni, contorno nero spesso).
   6 modelli originali; ogni blader ha {bey: modello, color: colore}.
   beySVG(model, color, {size, spin, title}) -> stringa SVG da inserire nell'HTML. */
'use strict';

const BEY_MODELS = [
  {id:'lama',       name:'Lama',       tipo:'Attacco'},
  {id:'scudo',      name:'Scudo',      tipo:'Difesa'},
  {id:'vortice',    name:'Vortice',    tipo:'Stamina'},
  {id:'equilibrio', name:'Equilibrio', tipo:'Bilanciata'},
  {id:'fulmine',    name:'Fulmine',    tipo:'Attacco'},
  {id:'corona',     name:'Corona',     tipo:'Difesa'}
];

const BEY_INK = '#1b1530';

/* colore: hex -> piÃ¹ chiaro (amt>0) o piÃ¹ scuro (amt<0), amt in [-1,1] */
function beyShade(hex, amt){
  let h = String(hex || '#888').replace('#', '');
  if(h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16); if(isNaN(n)) return hex;
  const ch = [n >> 16 & 255, n >> 8 & 255, n & 255].map(c => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt)));
  return '#' + ch.map(c => c.toString(16).padStart(2, '0')).join('');
}

const _bp = (r, deg) => { const a = (deg - 90) * Math.PI / 180; return (r * Math.cos(a)).toFixed(2) + ',' + (r * Math.sin(a)).toFixed(2); };
/* poligono in coordinate polari [[r, gradi], ...] ruotato di rot */
const _poly = (pts, rot = 0) => 'M' + pts.map(([r, d]) => _bp(r, d + rot)).join('L') + 'Z';
/* contorno chiuso con raggio funzione dell'angolo */
const _radial = (fn, step = 3) => { const pts = []; for(let d = 0; d < 360; d += step) pts.push([fn(d), d]); return _poly(pts); };
const _copies = (n, pts) => Array.from({length:n}, (_, i) => _poly(pts, i * 360 / n)).join('');

/* sagome dei modelli: livello esterno (lame) + eventuali dettagli */
const BEY_SHAPES = {
  lama: c => ({
    outer: _copies(3, [[17, -8], [30, 0], [44, 14], [48, 34], [40, 30], [33, 44], [24, 62], [17, 70]]),
    marks: _copies(3, [[37, 14], [43, 22], [38, 26]]), body: 0
  }),
  scudo: c => ({
    outer: _radial(d => 40 + 5 * Math.pow(Math.max(0, Math.cos(d * 6 * Math.PI / 180)), 0.6), 2),
    marks: Array.from({length:6}, (_, i) => `M${_bp(31, i * 60)}L${_bp(39, i * 60)}`).join('')
  }),
  vortice: c => ({
    outer: _copies(4, [[18, -10], [36, -4], [47, 12], [47, 40], [40, 52], [30, 50], [18, 60]]),
    marks: _copies(4, [[38, 14], [44, 22], [43, 36]]), body: 0
  }),
  equilibrio: c => ({
    outer: [_poly([[18, -20], [38, -14], [47, 8], [44, 30], [30, 24], [18, 40]], 0), _poly([[18, -20], [38, -14], [47, 8], [44, 30], [30, 24], [18, 40]], 180),
            _poly([[18, -16], [34, -6], [37, 18], [26, 14], [18, 22]], 90), _poly([[18, -16], [34, -6], [37, 18], [26, 14], [18, 22]], 270)].join(''),
    marks: _poly([[37, -4], [43, 8], [38, 12]], 0) + _poly([[37, -4], [43, 8], [38, 12]], 180), body: 0
  }),
  fulmine: c => ({
    outer: _copies(5, [[20, -18], [36, -10], [31, 2], [48, 10], [34, 18], [38, 28], [20, 42]]),
    marks: _copies(5, [[37, 8], [43, 10], [37, 14]]), body: 0
  }),
  corona: c => ({
    outer: _radial(d => { const k = ((d % 45) + 45) % 45; return k < 20 ? 46 : 39; }, 1),
    marks: Array.from({length:8}, (_, i) => `M${_bp(41, i * 45 + 10)}L${_bp(44, i * 45 + 10)}`).join('')
  })
};

function beyModelOf(id){ return BEY_MODELS.some(m => m.id === id) ? id : 'lama'; }

function beySVG(model, color, opts = {}){
  model = beyModelOf(model);
  const size = opts.size || 40;
  const col = color || '#888';
  const light = beyShade(col, .45), dark = beyShade(col, -.35), pale = beyShade(col, .75);
  const sh = BEY_SHAPES[model](col);
  const sw = 3.2;
  const title = opts.title ? `<title>${String(opts.title).replace(/[<&>]/g, '')}</title>` : '';
  return `<svg class="bey ${opts.spin ? 'spin' : ''} ${opts.cls || ''}" width="${size}" height="${size}" viewBox="-54 -54 108 108" ${opts.title ? 'role="img"' : 'aria-hidden="true"'}>${title}
<circle cx="4" cy="6" r="40" fill="${BEY_INK}" opacity=".28"/>
<g class="bey-rot">
<path d="${sh.outer}" fill="${col}" stroke="${BEY_INK}" stroke-width="${sw}" stroke-linejoin="round"/>
${sh.body ? `<circle r="${sh.body}" fill="${beyShade(col, -.12)}" stroke="${BEY_INK}" stroke-width="${sw}"/>` : ''}
<path d="${sh.marks}" fill="${light}" stroke="${light}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<circle r="27" fill="${dark}" stroke="${BEY_INK}" stroke-width="${sw}"/>
<path d="M${_bp(22, -40)}A22 22 0 0 1 ${_bp(22, 40)}" fill="none" stroke="${light}" stroke-width="5" stroke-linecap="round"/>
<path d="M${_bp(22, 140)}A22 22 0 0 1 ${_bp(22, 220)}" fill="none" stroke="${light}" stroke-width="5" stroke-linecap="round" opacity=".6"/>
<circle r="13" fill="${pale}" stroke="${BEY_INK}" stroke-width="${sw}"/>
<path d="M${_bp(6, 0)}L${_bp(6, 120)}L${_bp(6, 240)}Z" fill="${col}" stroke="${BEY_INK}" stroke-width="2" stroke-linejoin="round"/>
<path d="M-9 -15 A17 17 0 0 1 9 -15" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".85"/>
</g></svg>`;
}

if(typeof module !== 'undefined') module.exports = {BEY_MODELS, beySVG, beyShade, beyModelOf};
