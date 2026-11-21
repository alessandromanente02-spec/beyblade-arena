'use strict';
/* Beyblade Arena - PWA (GitHub Pages + Supabase, offline-first).
   La logica di torneo e statistiche (COSTANTI, UTIL, STATISTICHE, TORNEO: LOGICA) è la stessa
   dell'app originale: scripts/test.js la estrae da qui tramite i commenti-marcatore. */

/* ================= COSTANTI ================= */
const PH_LABEL = {G:'Girone', SP:'Spareggio', QF:'Quarti di finale', E:'Eliminazione diretta', SF:'Semifinali', F:'Finale'};
const PALETTE = ['#ff7a00','#1e88ff','#ff2d87','#22c55e','#8b5cf6','#ef4444','#14b8a6','#facc15','#0ea5e9','#84cc16','#f472b6','#6366f1'];
const BEY_IDS = ['lama','scudo','vortice','equilibrio','fulmine','corona'];
const DEF_W = {wr:40, per:30, pres:15, cons:15};
const FORMATS = {
  top8:{q:8, label:'Top 8 · quarti di finale', slots:[['QF1',{s:1},{s:8}],['QF2',{s:4},{s:5}],['QF3',{s:2},{s:7}],['QF4',{s:3},{s:6}],['SF1',{w:'QF1'},{w:'QF2'}],['SF2',{w:'QF3'},{w:'QF4'}],['F',{w:'SF1'},{w:'SF2'}]]},
  top6:{q:6, label:'Top 6 · 1° e 2° direttamente in semifinale', slots:[['E1',{s:3},{s:6}],['E2',{s:4},{s:5}],['SF1',{s:1},{w:'E2'}],['SF2',{s:2},{w:'E1'}],['F',{w:'SF1'},{w:'SF2'}]]},
  top4:{q:4, label:'Top 4 · semifinali', slots:[['SF1',{s:1},{s:4}],['SF2',{s:2},{s:3}],['F',{w:'SF1'},{w:'SF2'}]]},
  top2:{q:2, label:'Solo finale tra i primi 2', slots:[['F',{s:1},{s:2}]]}
};

/* ================= STATO ================= */
let L = {players:[], settings:{weights:{...DEF_W}}};
let T = {};
let ui = {tab:'live', liveSub:null, scope:'all', blader:null, openAnim:null, tour:null, full:false};
const store = {writable:true, status:'Caricamento…', level:'', loaded:false, net:true, codeBad:false, flushing:false};

/* ================= UTIL ================= */
const $ = s => document.querySelector(s);
const clone = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct = (v, d=0) => v == null || isNaN(v) ? '—' : (v*100).toFixed(d).replace('.', ',') + '%';
const dec = (v, d=2) => v == null || isNaN(v) ? '—' : v.toFixed(d).replace('.', ',');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const player = id => L.players.find(p => p.id === id) || {id, name: id || '?', color:'#9a9a9a', bey:'lama'};
const pname = id => player(id).name;
const pcol = id => player(id).color;
const AV_SIZE = {sm:30, lg:78, xl:112};
const av = (id, cls='') => {
  const p = player(id); const k = cls.split(/\s+/).find(x => AV_SIZE[x]);
  return `<span class="av ${cls}" style="--c:${esc(p.color)}" title="${esc(p.name)}">${beySVG(p.bey, p.color, {size: AV_SIZE[k] || 40, spin: /\bspin\b/.test(cls)})}</span>`;
};
const cname = id => `<span class="nm-c" style="--c:${esc(pcol(id))}">${esc(pname(id))}</span>`;
const fmtDate = (d, o={day:'numeric', month:'short', year:'numeric'}) => { try { return new Date(d + 'T12:00:00').toLocaleDateString('it-IT', o); } catch(e) { return d; } };
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
const toursSorted = () => Object.values(T).sort((a,b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.created||0) - (b.created||0));
const liveTour = () => toursSorted().reverse().find(t => t.status === 'live');
const findM = (t, id) => t.matches.find(m => m.id === id);
const played = m => m && m.a && m.b && m.sa != null && m.sb != null;
const winnerOf = m => played(m) ? (m.sa > m.sb ? m.a : m.b) : null;
const loserOf = m => played(m) ? (m.sa > m.sb ? m.b : m.a) : null;
const weights = () => ({...DEF_W, ...(L.settings && L.settings.weights || {})});
const ICON = {
  live:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v3M21 12h-3M12 21v-3M3 12h3"/></svg>',
  rank:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4 20V11M10 20V4M16 20v-6M22 20H2"/></svg>',
  blader:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M16 14.2a5 5 0 0 1 6 4.8"/></svg>',
  hist:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>',
  more:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  trophy:'<svg class="trophy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>',
  back:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M15 18l-6-6 6-6"/></svg>'
};

/* ================= STATISTICHE ================= */
function sd(arr){ if(arr.length < 2) return null; const m = arr.reduce((a,b)=>a+b,0)/arr.length; return Math.sqrt(arr.reduce((a,b)=>a+(b-m)**2,0)/(arr.length-1)); }

function accumulate(tours){
  const S = {};
  const get = id => S[id] || (S[id] = {id, M:0, W:0, L:0, PF:0, PA:0, cw:0, cl:0, clean:0, tours:{}, titles:0, finals:0, h2h:{}, seq:[]});
  for(const t of tours){
    for(const m of t.matches){
      if(!played(m)) continue;
      const sides = [[m.a, m.sa, m.sb, m.b], [m.b, m.sb, m.sa, m.a]];
      for(const [id, pf, pa, opp] of sides){
        const s = get(id), win = pf > pa;
        s.M++; win ? s.W++ : s.L++; s.PF += pf; s.PA += pa;
        if(win && pa === 3) s.cw++;
        if(!win && pf === 3) s.cl++;
        if(win && pa === 0) s.clean++;
        const tt = s.tours[t.id] || (s.tours[t.id] = {id:t.id, date:t.date, M:0, W:0, PF:0});
        tt.M++; if(win) tt.W++; tt.PF += pf;
        const h = s.h2h[opp] || (s.h2h[opp] = {W:0, L:0, PF:0, PA:0});
        win ? h.W++ : h.L++; h.PF += pf; h.PA += pa;
        s.seq.push(win ? 1 : 0);
      }
    }
    const f = t.matches.find(m => m.phase === 'F');
    if(played(f)){ get(winnerOf(f)).titles++; get(f.a).finals++; get(f.b).finals++; }
  }
  for(const s of Object.values(S)) derive(s);
  return S;
}

function derive(s){
  const w = weights();
  s.wr = s.M ? s.W / s.M : null;
  s.per = s.M ? s.PF / (4 * s.M) : null;
  s.eff = s.per ? s.wr / s.per : null;
  s.clutchRate = s.W ? s.cw / s.W : null;
  s.cleanRate = s.W ? s.clean / s.W : null;
  s.pres = (s.cw + 1) / (s.cw + s.cl + 2);
  const tl = Object.values(s.tours).filter(x => x.M >= 3).map(x => x.PF / (4 * x.M));
  const d = sd(tl);
  s.cons = tl.length >= 2 && d != null ? Math.max(0, Math.min(1, 1 - d / 0.5)) : null;
  let num = 0, den = 0;
  for(const [k, v] of [['wr', s.wr], ['per', s.per], ['pres', s.pres], ['cons', s.cons]]){
    if(v == null || !w[k]) continue; num += w[k] * v; den += w[k];
  }
  s.rating = den ? 100 * num / den : null;
  let best = 0, cur = 0; for(const x of s.seq){ cur = x ? cur + 1 : 0; best = Math.max(best, cur); }
  s.bestStreak = best;
  s.nTours = Object.keys(s.tours).length;
}

function standings(t, phases = ['G']){
  const rows = {};
  for(const p of t.players) rows[p] = {id:p, M:0, W:0, L:0, PF:0, PA:0};
  for(const m of t.matches){
    if(!phases.includes(m.phase) || !played(m)) continue;
    for(const [id, pf, pa] of [[m.a, m.sa, m.sb], [m.b, m.sb, m.sa]]){
      const r = rows[id] || (rows[id] = {id, M:0, W:0, L:0, PF:0, PA:0});
      r.M++; pf > pa ? r.W++ : r.L++; r.PF += pf; r.PA += pa;
    }
  }
  const h2h = (a, b) => { const m = t.matches.find(m => m.phase === 'G' && played(m) && ((m.a === a && m.b === b) || (m.a === b && m.b === a))); return m ? (winnerOf(m) === a ? -1 : 1) : 0; };
  return Object.values(rows).sort((x, y) => y.W - x.W || y.PF - x.PF || (y.PF - y.PA) - (x.PF - x.PA) || h2h(x.id, y.id) || pname(x.id).localeCompare(pname(y.id)));
}

/* ================= TORNEO: LOGICA ================= */
function roundRobin(ids){
  const p = [...ids]; if(p.length % 2) p.push(null);
  const n = p.length, out = [];
  for(let r = 0; r < n - 1; r++){
    for(let i = 0; i < n / 2; i++){
      const a = p[i], b = p[n - 1 - i];
      if(a && b) out.push(r % 2 ? [b, a] : [a, b]);
    }
    p.splice(1, 0, p.pop());
  }
  return out;
}
const phaseOf = id => id.startsWith('SP') ? 'SP' : id.startsWith('QF') ? 'QF' : id.startsWith('SF') ? 'SF' : id.startsWith('E') ? 'E' : 'F';

function srcVal(t, src){
  if(!src) return null;
  if(src.s){ const s = t.ko.seeds[src.s - 1]; if(s == null) return null; return typeof s === 'object' ? winnerOf(findM(t, s.w)) : s; }
  if(src.w) return winnerOf(findM(t, src.w));
  return null;
}
function resolveKO(t){
  if(!t.ko) return;
  for(const m of t.matches){
    if(!m.src || m.lock) continue;
    const a = srcVal(t, m.src.a), b = srcVal(t, m.src.b);
    if(a !== m.a || b !== m.b){ m.a = a; m.b = b; m.sa = null; m.sb = null; }
  }
  const f = t.matches.find(m => m.phase === 'F');
  t.champion = winnerOf(f) || null;
}
function generateKO(t, key){
  const F = FORMATS[key];
  const st = standings(t);
  const q = Math.min(F.q, st.length);
  const seeds = st.slice(0, q).map(r => r.id);
  const extra = [];
  if(st.length > q){
    const x = st[q - 1], y = st[q];
    if(x.W === y.W && x.PF === y.PF){
      extra.push({id:'SP1', phase:'SP', a:x.id, b:y.id, sa:null, sb:null});
      seeds[q - 1] = {w:'SP1'};
    }
  }
  t.ko = {format:key, seeds};
  t.matches = t.matches.filter(m => m.phase === 'G').concat(extra, F.slots.map(([id, a, b]) => ({id, phase:phaseOf(id), src:{a, b}, a:null, b:null, sa:null, sb:null})));
  resolveKO(t);
}
function defaultFormat(n){ return n >= 6 ? 'top6' : n >= 4 ? 'top4' : 'top2'; }

/* Unione di due versioni dello stesso torneo (due telefoni che registrano insieme).
   Partita per partita vince quella modificata più di recente (campo `at`); il tabellone
   vince la generazione più recente (`koAt`); data e stato vincono per `metaAt`. */
function mergeTour(loc, rem){
  if(!loc) return clone(rem);
  if(!rem) return loc;
  const out = clone(loc);
  const remKO = (rem.koAt || 0) > (loc.koAt || 0);
  if(remKO){
    if(rem.ko) out.ko = clone(rem.ko); else delete out.ko;
    out.koAt = rem.koAt;
    out.matches = out.matches.filter(m => m.phase === 'G').concat(clone(rem.matches.filter(m => m.phase !== 'G')));
  }
  for(const rm of rem.matches){
    if(rm.phase !== 'G' && (rem.koAt || 0) !== (out.koAt || 0)) continue;
    const i = out.matches.findIndex(m => m.id === rm.id);
    if(i < 0){ out.matches.push(clone(rm)); continue; }
    if((rm.at || 0) > (out.matches[i].at || 0)) out.matches[i] = clone(rm);
  }
  if((rem.metaAt || 0) > (loc.metaAt || 0)){ out.date = rem.date; out.status = rem.status; out.metaAt = rem.metaAt; }
  if(out.ko) resolveKO(out);
  return out;
}

/* ================= PERSISTENZA ================= */
/* Offline-first: tutto vive in localStorage; le modifiche entrano in una coda (sync.out)
   e partono verso Supabase appena c'è rete. Ogni 15 s si scaricano le novità degli altri. */
const CFG = window.BEY_CONFIG || {};
const CLOUD = !!(CFG.url && CFG.key);
const LS_KEY = 'beyblade-arena.v2', LS_CODE = 'beyblade-arena.codice';
let sync = {ver:{L:null, t:{}}, out:{}, last:null, seq:0};
let code = null;
let pendingRender = false;

function normLeague(d){
  const players = (d && Array.isArray(d.players) ? d.players : []).map((p, i) => ({
    ...p, color: p.color || PALETTE[i % PALETTE.length], bey: BEY_IDS.includes(p.bey) ? p.bey : BEY_IDS[i % BEY_IDS.length]}));
  return {players, settings: d && d.settings && d.settings.weights ? d.settings : {weights:{...DEF_W}}};
}
function lsSave(){ try{ localStorage.setItem(LS_KEY, JSON.stringify({L, T, sync, at:Date.now()})); }catch(e){} }
function lsLoad(){ try{ return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); }catch(e){ return null; } }
function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function lsSet(k, v){ try{ v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); }catch(e){} }

const nPending = () => Object.keys(sync.out).length;
function setSync(level, text){ store.level = level; store.status = text; const el = $('#sync'); if(!el) return; el.className = 'sync ' + level; el.querySelector('span').textContent = text; }
function refreshStatus(){
  const n = nPending();
  const da = `${n} da inviare`;
  if(!CLOUD) return setSync('warn', 'Solo su questo telefono');
  if(store.codeBad) return setSync('err', n ? `Codice non valido · ${da}` : 'Codice non valido');
  if(!store.net || navigator.onLine === false) return setSync('warn', n ? `Offline · ${da}` : 'Offline · dati sul telefono');
  if(store.flushing) return setSync('warn', 'Invio…');
  if(n) return setSync('warn', da);
  if(!store.loaded) return setSync('warn', 'Caricamento…');
  setSync('ok', store.writable ? 'Sincronizzato' : 'Sola lettura · aggiornato');
}

function mark(key){
  sync.out[key] = ++sync.seq;
  lsSave(); refreshStatus(); scheduleFlush();
}
function saveTour(t){ T[t.id] = t; delete sync.out['d:' + t.id]; mark('t:' + t.id); }
function saveLeague(){ mark('L'); }
async function removeTour(id){ delete T[id]; delete sync.out['t:' + id]; mark('d:' + id); }

async function sbFetch(path, opts = {}){
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 12000);
  const h = {apikey: CFG.key, 'Content-Type': 'application/json'};
  if(/^eyJ/.test(CFG.key)) h.Authorization = 'Bearer ' + CFG.key;
  const base = String(CFG.url).replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  try {
    const r = await fetch(base + path, {...opts, headers:h, signal:ctl.signal, cache:'no-store'});
    if(!r.ok){ const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
    return await r.json();
  } finally { clearTimeout(tm); }
}
const rpc = (fn, args) => sbFetch('/rest/v1/rpc/' + fn, {method:'POST', body:JSON.stringify(args)});

let flushTimer = null;
function scheduleFlush(){ clearTimeout(flushTimer); flushTimer = setTimeout(flush, 250); }

async function flush(){
  if(!CLOUD || store.flushing || !code || !nPending()) return;
  store.flushing = true; refreshStatus();
  let changed = false;
  try {
    for(const key of Object.keys(sync.out)){
      const rev = sync.out[key]; if(rev == null) continue;
      let res = null;
      if(key === 'L'){
        res = await rpc('bey_salva_lega', {p_codice:code, p_data:L});
        if(res && res.ok) sync.ver.L = res.updated_at;
      } else if(key.startsWith('t:')){
        const id = key.slice(2);
        if(!T[id]){ delete sync.out[key]; continue; }
        for(let tries = 0; tries < 3; tries++){
          res = await rpc('bey_salva_torneo', {p_codice:code, p_id:id, p_data:T[id], p_base:sync.ver.t[id] || null});
          if(!res || res.ok || res.errore !== 'conflitto') break;
          T[id] = mergeTour(T[id], res.data); sync.ver.t[id] = res.updated_at; changed = true;
        }
        if(res && res.ok) sync.ver.t[id] = res.updated_at;
      } else if(key.startsWith('d:')){
        const id = key.slice(2);
        res = await rpc('bey_elimina_torneo', {p_codice:code, p_id:id});
        if(res && res.ok) delete sync.ver.t[id];
      }
      if(res && res.ok){ if(sync.out[key] === rev) delete sync.out[key]; }
      else if(res && res.errore === 'codice'){
        code = null; lsSet(LS_CODE, null); store.writable = false; store.codeBad = true; changed = true;
        toast('Codice gruppo non valido: reinseriscilo in Altro. Le modifiche restano sul telefono.');
        break;
      }
    }
    store.net = true;
  } catch(e){ store.net = false; }
  store.flushing = false;
  lsSave(); refreshStatus();
  if(changed) safeRender();
}

async function pull(){
  if(!CLOUD) return;
  // 5 s di sovrapposizione: una scrittura appena conclusa altrove non sfugge
  const since = sync.last ? new Date(Date.parse(sync.last) - 5000).toISOString() : null;
  const f = since ? '&updated_at=gt.' + encodeURIComponent(since) : '';
  const same = (a, b) => a && b && Date.parse(a) === Date.parse(b);
  try {
    const [lg, tt, del] = await Promise.all([
      sbFetch('/rest/v1/bey_lega?select=data,updated_at&id=eq.main' + f),
      sbFetch('/rest/v1/bey_tornei?select=id,data,updated_at' + f),
      sbFetch('/rest/v1/bey_eliminati?select=id,updated_at' + f)]);
    let changed = false, max = sync.last;
    const bump = ts => { if(!max || Date.parse(ts) > Date.parse(max)) max = ts; };
    for(const r of lg){
      bump(r.updated_at);
      if(same(r.updated_at, sync.ver.L)) continue;
      sync.ver.L = r.updated_at;
      if(!sync.out.L){ L = normLeague(r.data); changed = true; }
    }
    for(const r of tt){
      bump(r.updated_at);
      if(same(r.updated_at, sync.ver.t[r.id])) continue;
      sync.ver.t[r.id] = r.updated_at;
      if(sync.out['d:' + r.id]) continue;
      T[r.id] = sync.out['t:' + r.id] && T[r.id] ? mergeTour(T[r.id], r.data) : r.data;
      changed = true;
    }
    for(const r of del){
      bump(r.updated_at);
      if(T[r.id] && !sync.out['t:' + r.id]){ delete T[r.id]; delete sync.ver.t[r.id]; changed = true; }
    }
    sync.last = max;
    const first = !store.loaded;
    store.net = true; store.loaded = true;
    lsSave(); refreshStatus();
    if(changed || first) safeRender();
  } catch(e){ store.net = false; refreshStatus(); }
}

/* accessi: ogni telefono segnala in modo anonimo che sta usando l'app (tabella bey_accessi,
   consultabile solo dal pannello Supabase). Un'apertura all'avvio o al ritorno dopo 30 min,
   poi al massimo un segnale ogni 5 min finché l'app è in primo piano. Errori ignorati. */
const LS_DEV = 'beyblade-arena.dispositivo';
let lastPing = 0, pingNew = true, hiddenAt = 0;
function deviceId(){
  let d = lsGet(LS_DEV);
  if(!d || !/^[A-Za-z0-9_-]{8,40}$/.test(d)){ d = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); lsSet(LS_DEV, d); }
  return d;
}
function deviceType(){
  const u = navigator.userAgent || '';
  const os = /iPhone|iPod/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /Macintosh/.test(u) ? 'Mac' : 'Altro';
  const app = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
  return os + (app ? ' · app' : ' · browser');
}
function ping(){
  if(!CLOUD || document.visibilityState !== 'visible') return;
  const now = Date.now();
  if(!pingNew && now - lastPing < 5 * 60000) return;
  const nuova = pingNew; lastPing = now; pingNew = false;
  rpc('bey_ping', {p_dev:deviceId(), p_tipo:deviceType(), p_ua:(navigator.userAgent || '').slice(0, 300), p_modifica:!!code, p_nuova:nuova})
    .catch(() => { lastPing = 0; pingNew = pingNew || nuova; });
}

/* niente ridisegno mentre si scrive in un campo o è aperto un foglio: si rimanda */
function safeRender(){
  const a = document.activeElement;
  const typing = a && a.closest && a.closest('#view') && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName);
  if(!$('#sheet').hidden || typing){ pendingRender = true; return; }
  render();
}

function initStore(){
  const cache = lsLoad();
  if(cache){ L = normLeague(cache.L); T = cache.T || {}; if(cache.sync) sync = {ver:{L:null, t:{}}, out:{}, last:null, seq:0, ...cache.sync}; }
  code = lsGet(LS_CODE);
  store.writable = !CLOUD || !!code;
  store.loaded = !CLOUD || !!cache;
  refreshStatus(); render();
  if(!CLOUD) return;
  const tick = () => { if(document.visibilityState === 'visible'){ pull(); flush(); ping(); } };
  pull().then(flush).then(ping);
  setInterval(tick, 15000);
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'hidden') hiddenAt = Date.now();
    else if(hiddenAt && Date.now() - hiddenAt > 30 * 60000) pingNew = true;
    tick();
  });
  window.addEventListener('online', () => { store.net = true; tick(); });
  window.addEventListener('offline', () => { store.net = false; refreshStatus(); });
}

/* ================= AZIONI ================= */
let undoFn = null, toastTimer = null;
function toast(msg, undo){
  $('#toastMsg').textContent = msg;
  const b = $('#toastBtn'); b.hidden = !undo; undoFn = undo || null;
  $('#toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; undoFn = null; }, undo ? 6000 : 3000);
}
$('#toastBtn').addEventListener('click', () => { if(undoFn){ undoFn(); undoFn = null; } $('#toast').hidden = true; });

/* undo: rimette la versione precedente ma con `at` nuovi, così vince anche sugli altri telefoni */
function restore(before){
  const now = Date.now();
  const cur = T[before.id];
  for(const m of before.matches){
    const c = cur && findM(cur, m.id);
    if(!c || c.sa !== m.sa || c.sb !== m.sb || c.a !== m.a || c.b !== m.b) m.at = now;
  }
  saveTour(before); render();
}

function setResult(tid, mid, sa, sb){
  if(!store.writable) return;
  const t = T[tid]; if(!t) return;
  const before = clone(t);
  const m = findM(t, mid); if(!m || !m.a || !m.b) return;
  m.sa = sa; m.sb = sb; m.at = Date.now();
  resolveKO(t);
  saveTour(t);
  ui.flash = mid;
  closeSheet(); render();
  toast(`${pname(m.a)} ${sa}–${sb} ${pname(m.b)}`, () => restore(before));
}
function clearResult(tid, mid){
  const t = T[tid]; const before = clone(t); const m = findM(t, mid);
  m.sa = null; m.sb = null; m.at = Date.now(); resolveKO(t); saveTour(t); closeSheet(); render();
  toast('Risultato cancellato', () => restore(before));
}

function openSheet(html){ $('#sheetCard').innerHTML = '<div class="grab"></div>' + html; $('#sheet').hidden = false; }
function closeSheet(){ $('#sheet').hidden = true; $('#sheetCard').innerHTML = ''; if(pendingRender){ pendingRender = false; render(); } }
function confirmBox(title, text, okLabel, fn, danger=true){
  openSheet(`<h2>${esc(title)}</h2><p class="muted" style="margin:0">${esc(text)}</p>
    <div class="row"><button class="btn grow" data-act="closeSheet">Annulla</button><button class="btn grow ${danger ? 'danger' : 'primary'}" id="okBtn">${esc(okLabel)}</button></div>`);
  $('#okBtn').addEventListener('click', () => { closeSheet(); fn(); });
}

async function copyText(text, label='Copiato'){
  try { await navigator.clipboard.writeText(text); toast(label); }
  catch(e){ openSheet(`<h2>Copia manualmente</h2><textarea readonly id="cpy">${esc(text)}</textarea><button class="btn" data-act="closeSheet">Chiudi</button>`); const ta = $('#cpy'); ta.focus(); ta.select(); }
}

function newPlayer(name){
  name = String(name || '').trim(); if(!name) return null;
  const ex = L.players.find(p => p.name.toLowerCase() === name.toLowerCase()); if(ex) return ex.id;
  let id = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '') || 'b';
  while(L.players.some(p => p.id === id)) id += '_';
  const n = L.players.length;
  L.players.push({id, name, color:PALETTE[n % PALETTE.length], bey:BEY_IDS[n % BEY_IDS.length]});
  saveLeague();
  return id;
}

function summaryText(t){
  const lines = [`🌀 TORNEO BEYBLADE · ${fmtDate(t.date)}`];
  if(t.champion) lines.push(`🏆 Campione: ${pname(t.champion)}`);
  const f = t.matches.find(m => m.phase === 'F');
  if(played(f)) lines.push(`Finale: ${pname(f.a)} ${f.sa}-${f.sb} ${pname(f.b)}`);
  lines.push('', 'Classifica girone:');
  standings(t).forEach((r, i) => lines.push(`${i+1}. ${pname(r.id)} · ${r.W}V ${r.L}S · ${r.PF} pt`));
  const ko = t.matches.filter(m => m.phase !== 'G' && played(m));
  if(ko.length){ lines.push('', 'Fase finale:'); ko.forEach(m => lines.push(`${PH_LABEL[m.phase]}: ${pname(m.a)} ${m.sa}-${m.sb} ${pname(m.b)}`)); }
  return lines.join('\n');
}

/* ================= RENDER: COMPONENTI ================= */
function scorepad(t, m){
  const pad = (side) => {
    const me = side === 'a' ? m.a : m.b;
    return `<div class="col" style="--c:${esc(pcol(me))}"><div class="lbl">Vince ${esc(pname(me))}</div><div class="btns">${[0,1,2,3].map(x => {
      const sa = side === 'a' ? 4 : x, sb = side === 'a' ? x : 4;
      return `<button class="sbtn ${x===0?'c0':''}" data-act="res" data-t="${t.id}" data-m="${m.id}" data-sa="${sa}" data-sb="${sb}" aria-label="${esc(pname(me))} vince 4 a ${x}">4<span class="s">–${x}</span></button>`;
    }).join('')}</div></div>`;
  };
  return `<div class="scorepad">${pad('a')}${pad('b')}</div>`;
}

function matchRow(t, m, opts = {}){
  if(!m.a || !m.b){
    const lab = s => !s ? '?' : s.s ? `${s.s}° girone` : s.w ? `Vinc. ${s.w}` : '?';
    const sa = m.src ? (m.src.a.s && t.ko && typeof t.ko.seeds[m.src.a.s-1] === 'object' ? 'Vinc. spareggio' : lab(m.src.a)) : '?';
    const sb = m.src ? (m.src.b.s && t.ko && typeof t.ko.seeds[m.src.b.s-1] === 'object' ? 'Vinc. spareggio' : lab(m.src.b)) : '?';
    return `<div class="pending"><span>${m.a ? esc(pname(m.a)) : sa}</span><span class="small">vs</span><span style="text-align:right">${m.b ? esc(pname(m.b)) : sb}</span></div>`;
  }
  const w = winnerOf(m);
  const cls = played(m) ? '' : 'todo';
  const here = opts.here ? 'here' : '';
  const fl = ui.flash === m.id ? 'flash' : '';
  return `<button class="m ${cls} ${here} ${fl}" data-act="openMatch" data-t="${t.id}" data-m="${m.id}">
    <span class="a">${av(m.a, 'sm')}<span class="nm ${w ? (w === m.a ? 'w' : 'l') : ''}">${esc(pname(m.a))}</span></span>
    <span class="sc">${played(m) ? `${m.sa}–${m.sb}` : 'DA GIOCARE'}</span>
    <span class="b"><span class="nm ${w ? (w === m.b ? 'w' : 'l') : ''}">${esc(pname(m.b))}</span>${av(m.b, 'sm')}</span>
  </button>`;
}

function standingsTable(t, qualifyN){
  const st = standings(t);
  return `<div class="tbl-wrap"><table><thead><tr><th>Blader</th><th>G</th><th>V</th><th>S</th><th>PF</th><th>PS</th><th>Diff</th></tr></thead><tbody>
    ${st.map((r, i) => `<tr class="${qualifyN && i < qualifyN ? 'q' : ''}"><td><span class="who"><span class="pos">${i+1}</span>${av(r.id,'sm')}${esc(pname(r.id))}</span></td><td>${r.M}</td><td><b>${r.W}</b></td><td>${r.L}</td><td>${r.PF}</td><td>${r.PA}</td><td>${r.PF - r.PA > 0 ? '+' : ''}${r.PF - r.PA}</td></tr>`).join('')}
  </tbody></table></div>`;
}

function vsBlock(m, size = 'lg', spin = true){
  return `<div class="vs"><div class="p">${av(m.a, size + (spin ? ' spin' : ''))}<b>${esc(pname(m.a))}</b></div><div class="x">VS</div><div class="p">${av(m.b, size + (spin ? ' spin' : ''))}<b>${esc(pname(m.b))}</b></div></div>`;
}

function koBlock(t, interactive){
  const ko = t.matches.filter(m => m.phase !== 'G');
  if(!ko.length) return '';
  const order = ['SP','QF','E','SF','F'];
  return order.filter(p => ko.some(m => m.phase === p)).map(p => {
    const ms = ko.filter(m => m.phase === p);
    return `<div class="ko-round"><h3>${PH_LABEL[p]}</h3><div class="card flush mlist">${ms.map(m => {
      const playable = interactive && store.writable && m.a && m.b && !played(m);
      return playable ? `<div class="kobox stack">
          ${vsBlock(m, '', false)}
          ${scorepad(t, m)}
          <button class="link small" data-act="openMatch" data-t="${t.id}" data-m="${m.id}">Cambia blader</button>
        </div>` : matchRow(t, m);
    }).join('')}</div></div>`;
  }).join('');
}

/* ================= VISTE ================= */
function viewLive(){
  const t = liveTour();
  if(!t){
    const last = toursSorted().reverse().find(x => x.champion);
    const show = L.players.slice(0, 3);
    return `<section class="empty">
      <div class="beys">${show.map((p, i) => av(p.id, (i === 1 ? 'xl' : 'lg') + ' spin')).join('')}</div>
      <h1>3, 2, 1… Let it rip!</h1>
      <p class="muted" style="margin:0;max-width:34ch">Scegli chi gioca: il girone si genera da solo e ogni sfida si registra con un tocco. Funziona anche senza rete.</p>
      ${store.writable ? `<button class="btn primary" data-act="newTour" style="min-width:240px">Nuovo torneo</button>`
        : `<p class="note">Per registrare un torneo inserisci il codice gruppo.</p><button class="btn yellow" data-act="tab" data-v="more">Inserisci il codice</button>`}
    </section>
    ${last ? `<div class="champ">${ICON.trophy}<div class="grow"><div class="eyebrow">Ultimo campione · ${esc(fmtDate(last.date))}</div><h2>${esc(pname(last.champion))}</h2></div>${av(last.champion,'lg spin')}</div>` : ''}
    ${!Object.keys(T).length && store.loaded ? `<p class="note">Nessun torneo salvato. Se hai un backup, importalo da Altro.</p>` : ''}`;
  }
  const G = t.matches.filter(m => m.phase === 'G');
  const done = G.filter(played).length;
  const groupDone = done === G.length;
  const hasKO = t.matches.some(m => m.phase !== 'G');
  const sub = ui.liveSub || (hasKO ? 'ko' : 'g');
  const head = `<div class="card stack">
    <div class="row"><div class="grow"><div class="eyebrow">Torneo in corso</div><h2 style="font-size:21px">${esc(fmtDate(t.date, {weekday:'long', day:'numeric', month:'long'}))}</h2></div>
      ${store.writable ? `<button class="btn" data-act="tourMenu" data-t="${t.id}" aria-label="Opzioni torneo">•••</button>` : ''}</div>
    <div class="row small muted"><span class="grow">${t.players.length} blader · girone ${done}/${G.length}</span>${hasKO ? `<span>fase finale ${t.matches.filter(m=>m.phase!=='G'&&played(m)).length}/${t.matches.filter(m=>m.phase!=='G').length}</span>` : ''}</div>
    <div class="progress"><i style="width:${G.length ? done / G.length * 100 : 0}%"></i></div>
  </div>
  <div class="seg"><button aria-pressed="${sub==='g'}" data-act="liveSub" data-v="g">Girone</button><button aria-pressed="${sub==='ko'}" data-act="liveSub" data-v="ko">Fase finale</button><button aria-pressed="${sub==='st'}" data-act="liveSub" data-v="st">Classifica</button></div>`;

  if(sub === 'st'){
    return head + `<div class="card flush">${standingsTable(t, t.ko ? FORMATS[t.ko.format].q : 0)}</div>
      <p class="small muted" style="margin:0">Ordine: vittorie, poi punti fatti, poi differenza punti, poi scontro diretto.</p>`;
  }
  if(sub === 'ko'){
    if(!hasKO){
      return head + `<div class="card stack"><h2 style="font-size:20px">Fase finale</h2>
        <p class="muted" style="margin:0">${groupDone ? 'Girone completato: genera il tabellone dalla classifica.' : `Mancano ${G.length - done} sfide del girone. Puoi comunque generare il tabellone con la classifica attuale.`}</p>
        ${store.writable ? `<button class="btn ${groupDone ? 'primary' : ''} block" data-act="koSetup" data-t="${t.id}">Genera fase finale</button>` : ''}</div>`;
    }
    const f = t.matches.find(m => m.phase === 'F');
    return head + (t.champion ? `<div class="champ pop">${ICON.trophy}<div class="grow"><div class="eyebrow">Campione</div><h2>${esc(pname(t.champion))}</h2><div class="small">Finale ${f.sa}–${f.sb} contro ${esc(pname(loserOf(f)))}</div></div>${av(t.champion,'lg spin')}</div>
      ${store.writable ? `<button class="btn primary block" data-act="closeTour" data-t="${t.id}">Concludi torneo</button>` : ''}` : '')
      + koBlock(t, true)
      + (store.writable ? `<button class="link" data-act="koSetup" data-t="${t.id}">Rigenera tabellone dalla classifica</button>` : '');
  }
  // girone
  const nextIdx = G.findIndex(m => !played(m));
  const nx = nextIdx >= 0 ? G[nextIdx] : null;
  const after = nx ? G.slice(nextIdx + 1).find(m => !played(m)) : null;
  let top = '';
  if(nx && store.writable){
    top = `<div class="card next pop" style="--ca:${esc(pcol(nx.a))};--cb:${esc(pcol(nx.b))}">
      <div class="vsbg"><div style="text-align:center;margin-bottom:8px"><span class="eyebrow">Prossima sfida · ${nextIdx + 1} di ${G.length}</span></div>
        ${vsBlock(nx)}</div>
      <div class="body">
      ${scorepad(t, nx)}
      ${after ? `<div class="upnext">Poi tocca a <b>${esc(pname(after.a))}</b> contro <b>${esc(pname(after.b))}</b></div>` : `<div class="upnext">È l'ultima sfida del girone.</div>`}
    </div></div>`;
  } else if(nx){
    top = `<div class="card next" style="--ca:${esc(pcol(nx.a))};--cb:${esc(pcol(nx.b))}"><div class="vsbg"><div style="text-align:center;margin-bottom:8px"><span class="eyebrow">Sfida in corso · ${nextIdx + 1} di ${G.length}</span></div>${vsBlock(nx)}</div></div>`;
  } else {
    top = `<div class="card stack"><div class="eyebrow">Girone completato</div><p style="margin:0">Classifica pronta. ${hasKO ? 'Il tabellone è in Fase finale.' : 'Passa alla fase finale.'}</p>
      ${!hasKO && store.writable ? `<button class="btn primary block" data-act="koSetup" data-t="${t.id}">Genera fase finale</button>` : ''}</div>`;
  }
  const koWarn = hasKO ? `<p class="note">Il tabellone è già generato. Se modifichi il girone, rigeneralo da Fase finale.</p>` : '';
  return head + top + koWarn + `<div class="sec-h"><h2>Classifica live</h2><button class="link small" data-act="liveSub" data-v="st">Completa</button></div>
    <div class="card flush">${standingsTable(t, 0)}</div>
    <div class="sec-h"><h2>Tutte le sfide</h2>${store.writable ? '<span class="small muted">tocca per modificare</span>' : ''}</div>
    <div class="card flush mlist">${G.map(m => matchRow(t, m, {here: m === nx})).join('')}</div>`;
}

function viewRank(){
  const tours = toursSorted();
  const scoped = ui.scope === 'all' ? tours : tours.filter(t => t.id === ui.scope);
  const S = accumulate(scoped);
  const rows = Object.values(S).filter(s => s.M > 0).sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
  const chips = `<div class="chips scroll"><button class="chip txt" aria-pressed="${ui.scope==='all'}" data-act="scope" data-v="all">Tutti i tornei</button>${tours.slice().reverse().map(t => `<button class="chip txt" aria-pressed="${ui.scope===t.id}" data-act="scope" data-v="${t.id}">${esc(fmtDate(t.date, {day:'numeric', month:'short'}))}${t.status==='live' ? ' · live' : ''}</button>`).join('')}</div>`;
  if(!rows.length) return chips + `<div class="card muted">Nessuna partita giocata.</div>`;
  const list = `<div class="card flush">${rows.map((s, i) => `<button class="rank" data-act="blader" data-v="${s.id}">
      <span class="n">${i+1}</span>${av(s.id)}
      <span class="grow"><span class="nm">${esc(pname(s.id))}</span> ${s.M < 12 ? '<span class="tag">pochi dati</span>' : ''}
        <span class="meta"><span>${s.W}V ${s.L}S</span><span>WR ${pct(s.wr)}</span><span>Peric. ${dec(s.per)}</span>${ui.scope === 'all' ? `<span>${s.titles ? '🏆'.repeat(Math.min(s.titles, 5)) : '0 titoli'}</span>` : ''}</span>
        <span class="bar" style="--c:${esc(pcol(s.id))}"><i style="width:${(s.rating||0)}%"></i></span></span>
      <span class="rt">${s.rating == null ? '—' : Math.round(s.rating)}<small>RATING</small></span>
    </button>`).join('')}</div>`;
  const full = `<div class="card flush"><div class="tbl-wrap sticky"><table><thead><tr><th>Blader</th><th>G</th><th>V</th><th>PF</th><th>PS</th><th>WR</th><th>Peric.</th><th>Effic.</th><th>Clutch</th><th>Clean</th><th>Press.</th><th>Consist.</th><th>Rating</th></tr></thead><tbody>
    ${rows.map(s => `<tr><td><span class="who">${av(s.id,'sm')}${esc(pname(s.id))}</span></td><td>${s.M}</td><td>${s.W}</td><td>${s.PF}</td><td>${s.PA}</td><td>${pct(s.wr,1)}</td><td>${dec(s.per,3)}</td><td>${pct(s.eff)}</td><td>${pct(s.clutchRate)}</td><td>${pct(s.cleanRate)}</td><td>${pct(s.pres)}</td><td>${pct(s.cons)}</td><td><b>${s.rating == null ? '—' : Math.round(s.rating)}</b></td></tr>`).join('')}
  </tbody></table></div></div>`;
  return chips + `<div class="seg"><button aria-pressed="${!ui.full}" data-act="full" data-v="0">Classifica</button><button aria-pressed="${ui.full}" data-act="full" data-v="1">Tutte le metriche</button></div>`
    + (ui.full ? full : list)
    + (ui.scope !== 'all' ? `<p class="small muted" style="margin:0">Nel singolo torneo la Consistency non si calcola: il Rating usa solo le altre tre componenti.</p>` : '')
    + legend();
}

function legend(){
  const w = weights(); const tot = w.wr + w.per + w.pres + w.cons || 1;
  const p = k => Math.round(w[k] / tot * 100);
  return `<details class="card legend"><summary>Come si calcolano le statistiche</summary><dl>
    <dt>Win Rate · quanto vinci?</dt><dd>Vittorie / partite.</dd>
    <dt>Indice di pericolosità · quanto devo avere paura di te?</dt><dd>Punti fatti / (4 × partite). Da 0 a 1.</dd>
    <dt>Efficienza realizzativa · quanto sei efficiente?</dt><dd>Win Rate / Pericolosità: quanto dei punti che fai si trasforma in vittorie.</dd>
    <dt>Clutch Wins Rate · quanto sei clutch?</dt><dd>Vittorie 4–3 / vittorie totali.</dd>
    <dt>Clean Wins Rate · quanto domini?</dt><dd>Vittorie 4–0 / vittorie totali.</dd>
    <dt>Rendimento sotto pressione</dt><dd>Quota di partite finite 4–3 che vinci: <code>(vinte 4–3 + 1) / (finite 4–3 + 2)</code>. Il +1/+2 evita 0% o 100% con una sola partita tirata.</dd>
    <dt>Consistency · quanto sei consistente?</dt><dd>Stabilità della pericolosità da un torneo all'altro: <code>1 − dev.std / 0,5</code>. Vicino a 1 = rendi sempre allo stesso modo. Servono almeno 2 tornei con 3+ partite.</dd>
    <dt>Rating (0–100)</dt><dd>${p('wr')}% Win Rate + ${p('per')}% Pericolosità + ${p('pres')}% Pressione + ${p('cons')}% Consistency. Pesi modificabili in Altro.</dd>
  </dl></details>`;
}

function trendChart(s){
  const pts = Object.values(s.tours).sort((a, b) => a.date < b.date ? -1 : 1);
  if(pts.length < 2) return '<p class="small muted" style="margin:0">Serve almeno un secondo torneo per vedere l\'andamento.</p>';
  const W = 320, H = 150, pl = 32, pr = 10, pt = 10, pb = 24;
  const x = i => pl + (pts.length === 1 ? 0 : i * (W - pl - pr) / (pts.length - 1));
  const y = v => pt + (1 - v) * (H - pt - pb);
  const line = (vals, col, dash) => `<polyline fill="none" stroke="${col}" stroke-width="3" stroke-linejoin="round" ${dash ? 'stroke-dasharray="5 4"' : ''} points="${vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}"/>` + vals.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${i === vals.length - 1 ? 5 : 3.5}" fill="${col}" stroke="#0b0e22" stroke-width="1.5"/>`).join('');
  const wr = pts.map(p => p.W / p.M), pe = pts.map(p => p.PF / (4 * p.M));
  const col = pcol(s.id);
  const area = `<polygon fill="${esc(col)}" opacity=".2" points="${x(0)},${y(0)} ${wr.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} ${x(pts.length-1)},${y(0)}"/>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Andamento per torneo">
    ${[0, .5, 1].map(v => `<line x1="${pl}" x2="${W-pr}" y1="${y(v)}" y2="${y(v)}" stroke="#2a3168" stroke-width="1.5"/><text x="${pl-6}" y="${y(v)+3}" text-anchor="end">${v*100}%</text>`).join('')}
    ${pts.map((p, i) => `<text x="${x(i)}" y="${H-6}" text-anchor="middle">${esc(fmtDate(p.date, {day:'numeric', month:'numeric'}))}</text>`).join('')}
    ${area}${line(wr, esc(col))}${line(pe, '#9aa3d0', true)}
  </svg><div class="row small muted" style="gap:16px"><span><b style="color:${esc(col)}">━</b> Win rate</span><span><b>┅</b> Pericolosità</span></div>`;
}

function viewBlader(){
  const S = accumulate(toursSorted());
  const list = L.players.filter(p => S[p.id]).map(p => S[p.id]).sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
  if(!list.length) return `<div class="card muted">Nessuna partita giocata.</div>`;
  if(ui.blader && !S[ui.blader]) ui.blader = null;
  return `<div class="sec-h"><h2>Blader</h2><span class="small muted">tocca per le statistiche</span></div>
    <div class="blist">${list.map((s, i) => {
      const open = ui.blader === s.id;
      return `<div class="bl ${open ? 'open' : ''}" id="bl-${esc(s.id)}" style="--c:${esc(pcol(s.id))}">
        <button class="bl-h" data-act="toggleBlader" data-v="${esc(s.id)}" aria-expanded="${open}">
          <span class="n">${i + 1}</span>${av(s.id, open ? 'spin' : '')}
          <span class="grow"><span class="nm">${esc(pname(s.id))}</span>
            <span class="meta"><span>${s.W}V ${s.L}S</span><span>${s.titles} ${s.titles === 1 ? 'titolo' : 'titoli'}</span><span>${s.nTours} ${s.nTours === 1 ? 'torneo' : 'tornei'}</span></span></span>
          <span class="rt">${s.rating == null ? '—' : Math.round(s.rating)}<small>RATING</small></span>
          <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        ${open ? `<div class="bl-b ${ui.openAnim === s.id ? 'anim' : ''}">${bladerDetail(s, i + 1)}</div>` : ''}
      </div>`;
    }).join('')}</div>`;
}

function bladerDetail(s, pos){
  const col = pcol(s.id);
  const model = (typeof BEY_MODELS !== 'undefined' ? BEY_MODELS : []).find(m => m.id === player(s.id).bey);
  const metric = (k, q, v, frac) => `<div class="metric"><span class="k">${k}</span><span class="v">${v}</span><span class="q">${q}</span><span class="bar" style="--c:${esc(col)}"><i style="width:${frac == null ? 0 : Math.max(0, Math.min(1, frac)) * 100}%"></i></span></div>`;
  const opp = Object.entries(s.h2h).map(([id, h]) => ({id, ...h, M:h.W + h.L})).sort((a, b) => b.M - a.M);
  const nem = opp.filter(o => o.M >= 2).sort((a, b) => a.W / a.M - b.W / b.M)[0];
  const fav = opp.filter(o => o.M >= 2).sort((a, b) => b.W / b.M - a.W / a.M)[0];
  return `<div class="hero">${av(s.id,'lg spin')}<div><h1>${esc(pname(s.id))}</h1><div class="small">${pos}° nel ranking · ${s.nTours} ${s.nTours === 1 ? 'torneo' : 'tornei'}${model ? ` · ${esc(model.name)}` : ''}</div></div>
      <div class="big"><b>${s.rating == null ? '—' : Math.round(s.rating)}</b><span>RATING</span></div></div>
    <div class="tiles">
      <div class="tile"><b>${s.titles}</b><span>Titoli</span></div>
      <div class="tile"><b>${s.finals}</b><span>Finali</span></div>
      <div class="tile"><b>${s.bestStreak}</b><span>Serie vittorie</span></div>
      <div class="tile"><b>${s.W}–${s.L}</b><span>Vinte–perse</span></div>
      <div class="tile"><b>${s.PF}</b><span>Punti fatti</span></div>
      <div class="tile"><b>${s.PF - s.PA > 0 ? '+' : ''}${s.PF - s.PA}</b><span>Differenza</span></div>
    </div>
    <div class="card stack">
      ${metric('Win Rate', 'Quanto vinci?', pct(s.wr, 1), s.wr)}
      ${metric('Pericolosità', 'Quanto devo avere paura di te?', dec(s.per, 3), s.per)}
      ${metric('Efficienza', 'Quanto sei efficiente?', pct(s.eff), s.eff)}
      ${metric('Clutch Wins Rate', `${s.cw} vittorie 4–3`, pct(s.clutchRate), s.clutchRate)}
      ${metric('Clean Wins Rate', `${s.clean} vittorie 4–0`, pct(s.cleanRate), s.cleanRate)}
      ${metric('Sotto pressione', `${s.cw} vinte su ${s.cw + s.cl} finite 4–3`, pct(s.pres), s.pres)}
      ${metric('Consistency', 'Quanto sei costante tra un torneo e l\'altro?', pct(s.cons), s.cons)}
    </div>
    <div class="sec-h"><h2>Andamento</h2></div>
    <div class="card">${trendChart(s)}</div>
    ${nem || fav ? `<div class="tiles" style="grid-template-columns:1fr 1fr">
      ${fav ? `<div class="tile"><span>Vittima preferita</span><div class="row" style="margin-top:6px">${av(fav.id,'sm')}<b style="font-size:17px">${esc(pname(fav.id))}</b></div><span>${fav.W}–${fav.L}</span></div>` : ''}
      ${nem ? `<div class="tile"><span>Bestia nera</span><div class="row" style="margin-top:6px">${av(nem.id,'sm')}<b style="font-size:17px">${esc(pname(nem.id))}</b></div><span>${nem.W}–${nem.L}</span></div>` : ''}
    </div>` : ''}
    <div class="sec-h"><h2>Testa a testa</h2></div>
    <div class="card flush">${opp.map(o => `<div class="h2h">${av(o.id,'sm')}<div><b>${esc(pname(o.id))}</b><div class="split"><i style="width:${o.W / o.M * 100}%;background:var(--win)"></i><i style="width:${o.L / o.M * 100}%;background:var(--loss)"></i></div></div>
      <div style="text-align:right"><b class="num" style="font-size:17px">${o.W}–${o.L}</b><div class="small muted">${o.PF}–${o.PA} pt</div></div></div>`).join('')}</div>`;
}

function viewHist(){
  const tours = toursSorted().reverse();
  if(ui.tour && T[ui.tour]) return viewTour(T[ui.tour]);
  if(!tours.length) return `<div class="card muted">Nessun torneo ancora.</div>`;
  const champs = {};
  tours.forEach(t => { if(t.champion) champs[t.champion] = (champs[t.champion] || 0) + 1; });
  return `<div class="sec-h"><h2>Albo d'oro</h2></div>
    <div class="chips">${Object.entries(champs).sort((a, b) => b[1] - a[1]).map(([id, n]) => `<span class="chip">${av(id,'sm')}${esc(pname(id))} <b class="num" style="font-size:15px">×${n}</b></span>`).join('')}</div>
    <div class="sec-h"><h2>Tornei</h2><span class="small muted">${tours.length}</span></div>
    <div class="card flush">${tours.map(t => {
      const f = t.matches.find(m => m.phase === 'F');
      const d = new Date(t.date + 'T12:00:00');
      return `<button class="tcard" data-act="tour" data-v="${t.id}">
        <span class="d"><b>${d.getDate()}</b><span>${esc(d.toLocaleDateString('it-IT', {month:'short'}))} ${String(d.getFullYear()).slice(2)}</span></span>
        <span><b style="font-size:17px">${t.champion ? esc(pname(t.champion)) : t.status === 'live' ? 'In corso' : '—'}</b> ${t.status === 'live' ? '<span class="live-pill">live</span>' : ''}
          <span class="small muted" style="display:block">${t.players.length} blader${played(f) ? ` · finale ${f.sa}–${f.sb} vs ${esc(pname(loserOf(f)))}` : ''}</span></span>
        ${t.champion ? av(t.champion) : '<span></span>'}
      </button>`;
    }).join('')}</div>`;
}

function viewTour(t){
  const f = t.matches.find(m => m.phase === 'F');
  const sfLosers = t.matches.filter(m => m.phase === 'SF' && played(m)).map(loserOf);
  const G = t.matches.filter(m => m.phase === 'G');
  return `<button class="link row" data-act="tour" data-v="" style="gap:4px">${ICON.back} Tutti i tornei</button>
    <div class="row"><div class="grow"><div class="eyebrow">${t.status === 'live' ? 'In corso' : 'Torneo'}</div><h1 style="font-size:22px">${esc(fmtDate(t.date, {weekday:'long', day:'numeric', month:'long', year:'numeric'}))}</h1></div></div>
    ${t.champion ? `<div class="card"><div class="podium">
      <div class="p2">${played(f) ? av(loserOf(f)) + `<b>${esc(pname(loserOf(f)))}</b>` : ''}<div class="st">2</div></div>
      <div class="p1">${av(t.champion,'lg spin')}<b>${esc(pname(t.champion))}</b><div class="st">1</div></div>
      <div class="p3">${sfLosers.length ? `<div class="row" style="justify-content:center;gap:4px">${sfLosers.map(id => av(id,'sm')).join('')}</div><b>${sfLosers.map(id => esc(pname(id))).join(' · ')}</b>` : ''}<div class="st">3</div></div>
    </div></div>` : ''}
    <div class="row wrap"><button class="btn grow" data-act="copySummary" data-t="${t.id}">Copia riepilogo</button>${store.writable ? `<button class="btn grow" data-act="tourMenu" data-t="${t.id}">Opzioni</button>` : ''}</div>
    <div class="sec-h"><h2>Classifica girone</h2></div>
    <div class="card flush">${standingsTable(t, 0)}</div>
    ${t.matches.some(m => m.phase !== 'G') ? `<div class="sec-h"><h2>Fase finale</h2></div>${koBlock(t, false)}` : ''}
    <div class="sec-h"><h2>Girone · ${G.length} sfide</h2>${store.writable ? '<span class="small muted">tocca per modificare</span>' : ''}</div>
    <div class="card flush mlist">${G.map(m => matchRow(t, m)).join('')}</div>`;
}

function viewMore(){
  const w = weights();
  const slider = (k, label) => `<label class="f">${label} <span class="row"><input type="range" min="0" max="100" step="5" value="${w[k]}" data-w="${k}" id="w_${k}" ${store.writable ? '' : 'disabled'}><b class="num" style="min-width:34px;text-align:right;color:var(--text);font-size:20px">${w[k]}</b></span></label>`;
  const n = nPending();
  const codeCard = !CLOUD ? '' : code
    ? `<div class="card stack"><div class="sec-h"><h2>Modifica attiva</h2></div>
        <p style="margin:0">Questo telefono può registrare tornei e risultati.</p>
        <button class="btn" data-act="codeOff">Blocca questo telefono</button></div>`
    : `<div class="card stack"><div class="sec-h"><h2>Sblocca la modifica</h2></div>
        <p class="muted" style="margin:0">Inserisci il codice gruppo per registrare tornei da questo telefono. Senza codice puoi solo guardare classifiche e storico.</p>
        <input type="password" id="codeIn" autocomplete="off" placeholder="Codice gruppo" aria-label="Codice gruppo">
        <button class="btn primary" data-act="codeOn">Sblocca</button></div>`;
  return codeCard + `<div class="card stack"><div class="sec-h"><h2>Dati</h2></div>
      <p style="margin:0">${!CLOUD ? 'Il cloud non è configurato: i dati restano solo su questo telefono. Fai un backup ogni tanto.'
        : `Tutto viene salvato prima sul telefono e poi inviato al cloud appena c'è rete, così al campo si gioca anche offline.${n ? ` <b>${n} ${n === 1 ? 'modifica' : 'modifiche'} in attesa di invio.</b>` : ''}`}</p>
      <div class="row wrap">
        ${CLOUD ? `<button class="btn grow yellow" data-act="syncNow">Sincronizza ora</button>` : ''}
        <button class="btn grow" data-act="exportXlsx">Esporta Excel</button>
        <button class="btn grow" data-act="copyBackup">Copia backup</button>
        ${store.writable ? `<button class="btn grow" data-act="importBackup">Importa backup</button>` : ''}
      </div></div>
    <div class="card stack"><div class="sec-h"><h2>Blader</h2>${store.writable ? '<button class="link small" data-act="addPlayer">+ Aggiungi</button>' : ''}</div>
      ${L.players.map(p => `<div class="row"><button class="btn ghost" style="padding:2px;min-height:auto" data-act="style" data-v="${p.id}" aria-label="Beyblade e colore di ${esc(p.name)}" ${store.writable ? '' : 'disabled'}>${av(p.id)}</button>
        <input type="text" value="${esc(p.name)}" data-rename="${p.id}" id="rn_${p.id}" aria-label="Nome" ${store.writable ? '' : 'disabled'}></div>`).join('')}
      ${store.writable ? '<p class="small muted" style="margin:0">Tocca la Beyblade per cambiare modello e colore.</p>' : ''}</div>
    <div class="card stack"><div class="sec-h"><h2>Pesi del Rating</h2>${store.writable ? '<button class="link small" data-act="resetW">Ripristina</button>' : ''}</div>
      ${slider('wr', 'Win Rate')}${slider('per', 'Pericolosità')}${slider('pres', 'Rendimento sotto pressione')}${slider('cons', 'Consistency')}
      <p class="small muted" style="margin:0">I pesi vengono normalizzati: conta solo il rapporto tra loro.</p></div>
    ${legend()}`;
}

/* ================= RENDER ================= */
function render(){
  pendingRender = false;
  const tabs = [['live','Torneo'],['rank','Classifica'],['blader','Blader'],['hist','Storico'],['more','Altro']];
  $('#tabs').innerHTML = tabs.map(([k, l]) => `<button data-act="tab" data-v="${k}" ${ui.tab === k ? 'aria-current="page"' : ''}>${ICON[k]}${l}</button>`).join('');
  const v = {live:viewLive, rank:viewRank, blader:viewBlader, hist:viewHist, more:viewMore}[ui.tab];
  $('#view').innerHTML = v();
  ui.flash = null;
  refreshStatus();
}

/* ================= EVENTI ================= */
// Pagina Blader: apre (o chiude, con id null) la scheda di un blader e la porta in vista.
function openBlader(id){
  const same = ui.tab === 'blader';
  ui.blader = id; ui.tab = 'blader'; ui.openAnim = id;
  render(); ui.openAnim = null;
  const el = id && document.getElementById('bl-' + id);
  if(el){
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({block:'start', behavior: same && !reduce ? 'smooth' : 'auto'});
  } else if(!same) window.scrollTo(0, 0);
}
function styleSheet(pid){
  const p = L.players.find(x => x.id === pid); if(!p) return;
  openSheet(`<h2>${esc(p.name)}</h2>
    <div style="display:grid;place-items:center">${beySVG(p.bey, p.color, {size:120, spin:true})}</div>
    <div class="f" style="font-size:13px;color:var(--muted);font-weight:800">Modello</div>
    <div class="models">${BEY_MODELS.map(m => `<button data-act="setBey" data-p="${p.id}" data-v="${m.id}" aria-pressed="${p.bey === m.id}">${beySVG(m.id, p.color, {size:54})}${esc(m.name)}<small>${esc(m.tipo)}</small></button>`).join('')}</div>
    <div class="f" style="font-size:13px;color:var(--muted);font-weight:800">Colore</div>
    <div class="swatches">${PALETTE.map(c => `<button data-act="setCol" data-p="${p.id}" data-v="${c}" style="--c:${c}" aria-label="Colore ${c}" aria-pressed="${p.color === c}"></button>`).join('')}</div>
    <button class="btn" data-act="closeSheet">Fatto</button>`);
}

const ACT = {
  tab: el => { ui.tab = el.dataset.v; render(); window.scrollTo(0, 0); },
  liveSub: el => { ui.liveSub = el.dataset.v; render(); },
  scope: el => { ui.scope = el.dataset.v; render(); },
  full: el => { ui.full = el.dataset.v === '1'; render(); },
  blader: el => { openBlader(el.dataset.v || null); },
  toggleBlader: el => { openBlader(ui.blader === el.dataset.v ? null : el.dataset.v); },
  tour: el => { ui.tour = el.dataset.v || null; render(); window.scrollTo(0, 0); },
  closeSheet: () => closeSheet(),
  res: el => setResult(el.dataset.t, el.dataset.m, +el.dataset.sa, +el.dataset.sb),
  openMatch: el => {
    const t = T[el.dataset.t], m = findM(t, el.dataset.m);
    if(!store.writable) return;
    const isKO = m.phase !== 'G';
    const pick = (side, cur) => `<select id="pick_${side}">${['<option value="">—</option>'].concat(t.players.map(p => `<option value="${p}" ${p === cur ? 'selected' : ''}>${esc(pname(p))}</option>`)).join('')}</select>`;
    openSheet(`<div class="eyebrow">${PH_LABEL[m.phase]}</div>
      ${m.a && m.b ? `<div class="vs"><div class="p">${av(m.a)}<b style="font-size:17px">${esc(pname(m.a))}</b></div><div class="x">${played(m) ? `<span class="num" style="font-size:24px;color:var(--text);-webkit-text-stroke:0;text-shadow:none">${m.sa}–${m.sb}</span>` : 'VS'}</div><div class="p">${av(m.b)}<b style="font-size:17px">${esc(pname(m.b))}</b></div></div>
      ${scorepad(t, m)}` : ''}
      ${played(m) ? `<button class="btn danger" data-act="clearRes" data-t="${t.id}" data-m="${m.id}">Cancella risultato</button>` : ''}
      ${isKO ? `<details ${m.a && m.b ? '' : 'open'}><summary>Cambia blader</summary><div class="stack" style="margin-top:10px">
        <div class="row">${pick('a', m.a)}<span class="muted">vs</span>${pick('b', m.b)}</div>
        <button class="btn" data-act="setPair" data-t="${t.id}" data-m="${m.id}">Conferma accoppiamento</button>
        ${m.lock ? `<button class="link small" data-act="unlock" data-t="${t.id}" data-m="${m.id}">Torna all'accoppiamento automatico</button>` : ''}
      </div></details>` : ''}
      <button class="btn ghost" data-act="closeSheet">Chiudi</button>`);
  },
  clearRes: el => clearResult(el.dataset.t, el.dataset.m),
  setPair: el => {
    const t = T[el.dataset.t], m = findM(t, el.dataset.m);
    const a = $('#pick_a').value || null, b = $('#pick_b').value || null;
    if(a && a === b){ toast('Scegli due blader diversi'); return; }
    if(a !== m.a || b !== m.b){ m.sa = null; m.sb = null; }
    m.a = a; m.b = b; m.lock = true; m.at = Date.now(); resolveKO(t); saveTour(t); closeSheet(); render();
  },
  unlock: el => { const t = T[el.dataset.t], m = findM(t, el.dataset.m); delete m.lock; m.at = Date.now(); resolveKO(t); saveTour(t); closeSheet(); render(); },
  newTour: () => {
    const sel = new Set();
    const draw = () => {
      const n = sel.size;
      openSheet(`<h2>Nuovo torneo</h2>
        <label class="f">Data<input type="date" id="nt_date" value="${esc($('#nt_date')?.value || today())}"></label>
        <div class="f" style="font-size:13px;color:var(--muted);font-weight:800">Chi gioca?</div>
        <div class="chips">${L.players.map(p => `<button class="chip" aria-pressed="${sel.has(p.id)}" data-pick="${p.id}">${av(p.id,'sm')}${esc(p.name)}</button>`).join('')}</div>
        <div class="row"><input type="text" id="nt_new" placeholder="Nuovo blader" aria-label="Nome nuovo blader"><button class="btn" id="nt_add">Aggiungi</button></div>
        <button class="btn primary" id="nt_go" ${n < 2 ? 'disabled' : ''}>${n < 2 ? 'Scegli almeno 2 blader' : `Let it rip! · ${n} blader, ${n * (n - 1) / 2} sfide`}</button>`);
      document.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => { const id = b.dataset.pick; sel.has(id) ? sel.delete(id) : sel.add(id); const d = $('#nt_date').value; draw(); $('#nt_date').value = d; }));
      $('#nt_add').addEventListener('click', () => { const d = $('#nt_date').value; const id = newPlayer($('#nt_new').value); if(id) sel.add(id); draw(); $('#nt_date').value = d; });
      $('#nt_go').addEventListener('click', () => {
        const ids = L.players.map(p => p.id).filter(id => sel.has(id));
        const date = $('#nt_date').value || today();
        // suffisso casuale: due telefoni che creano un torneo lo stesso giorno non si sovrascrivono
        let id; do { id = 't' + date.replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6); } while(T[id]);
        const pairs = roundRobin(ids);
        const t = {id, date, status:'live', created:Date.now(), players:ids, matches:pairs.map(([a, b], i) => ({id:'G' + (i + 1), phase:'G', a, b, sa:null, sb:null})), champion:null};
        saveTour(t); closeSheet(); ui.liveSub = 'g'; ui.tab = 'live'; render(); window.scrollTo(0, 0);
      });
    };
    draw();
  },
  koSetup: el => {
    const tid = el.dataset.t; const t0 = T[tid]; const n = t0.players.length;
    const opts = Object.entries(FORMATS).filter(([k, f]) => f.q <= n);
    const def = t0.ko ? t0.ko.format : defaultFormat(n);
    openSheet(`<h2>Fase finale</h2>
      <p class="muted" style="margin:0">Il tabellone si costruisce dalla classifica del girone. Se all'ultimo posto utile ci sono due blader a pari vittorie e pari punti, viene aggiunto uno spareggio.</p>
      <div class="stack">${opts.map(([k, f]) => `<label class="row chip txt" style="border-radius:12px;padding:12px;white-space:normal"><input type="radio" name="fmt" value="${k}" ${k === def ? 'checked' : ''}> ${esc(f.label)}</label>`).join('')}</div>
      ${t0.ko && t0.matches.some(m => m.phase !== 'G' && played(m)) ? '<p class="note">Rigenerando, i risultati della fase finale già inseriti vengono cancellati.</p>' : ''}
      <button class="btn primary" id="ko_go">Genera tabellone</button>`);
    $('#ko_go').addEventListener('click', () => { const t = T[tid]; const k = document.querySelector('input[name=fmt]:checked').value; generateKO(t, k); t.koAt = Date.now(); saveTour(t); closeSheet(); ui.liveSub = 'ko'; render(); });
  },
  closeTour: el => { const t = T[el.dataset.t]; t.status = 'done'; t.metaAt = Date.now(); saveTour(t); ui.liveSub = null; render(); toast(`Torneo concluso · campione ${pname(t.champion)}`); },
  tourMenu: el => {
    const tid = el.dataset.t; const t = T[tid];
    openSheet(`<h2>Opzioni torneo</h2><div class="stack">
      <label class="f">Data<input type="date" id="tm_date" value="${esc(t.date)}"></label>
      <button class="btn" id="tm_save">Salva data</button>
      <button class="btn" data-act="copySummary" data-t="${t.id}">Copia riepilogo per WhatsApp</button>
      ${t.status === 'done' ? `<button class="btn" id="tm_reopen">Riapri come torneo in corso</button>` : `<button class="btn" id="tm_close">Segna come concluso</button>`}
      <button class="btn danger" id="tm_del">Elimina torneo</button>
      <button class="btn ghost" data-act="closeSheet">Chiudi</button></div>`);
    const cur = () => T[tid];
    $('#tm_save').addEventListener('click', () => { const x = cur(); x.date = $('#tm_date').value || x.date; x.metaAt = Date.now(); saveTour(x); closeSheet(); render(); });
    const ro = $('#tm_reopen'); if(ro) ro.addEventListener('click', () => { const x = cur(); const other = liveTour(); if(other && other.id !== x.id){ other.status = 'done'; other.metaAt = Date.now(); saveTour(other); } x.status = 'live'; x.metaAt = Date.now(); saveTour(x); closeSheet(); ui.tab = 'live'; render(); });
    const cl = $('#tm_close'); if(cl) cl.addEventListener('click', () => { const x = cur(); x.status = 'done'; x.metaAt = Date.now(); saveTour(x); closeSheet(); render(); });
    $('#tm_del').addEventListener('click', () => confirmBox('Eliminare il torneo?', `Il torneo del ${fmtDate(t.date)} e tutte le sue ${t.matches.filter(played).length} partite verranno cancellati, anche dagli altri telefoni. Non si può annullare.`, 'Elimina', async () => { ui.tour = null; await removeTour(tid); render(); }));
  },
  copySummary: el => copyText(summaryText(T[el.dataset.t]), 'Riepilogo copiato'),
  copyBackup: () => copyText(JSON.stringify({app:'beyblade-arena', v:1, exported:new Date().toISOString(), league:L, tournaments:Object.values(T)}), 'Backup copiato'),
  importBackup: () => {
    openSheet(`<h2>Importa backup</h2><p class="muted" style="margin:0">Incolla il testo copiato con "Copia backup". I tornei con lo stesso identificativo vengono sovrascritti.</p>
      <textarea id="imp" placeholder="{&quot;app&quot;:&quot;beyblade-arena&quot;…"></textarea><button class="btn primary" id="imp_go">Importa</button><button class="btn ghost" data-act="closeSheet">Annulla</button>`);
    $('#imp_go').addEventListener('click', () => {
      try {
        const d = JSON.parse($('#imp').value);
        if(!d || !Array.isArray(d.tournaments) || !d.league) throw new Error('formato');
        for(const p of d.league.players || []) if(!L.players.some(x => x.id === p.id)) L.players.push(p);
        if(d.league.settings) L.settings = d.league.settings;
        L = normLeague(L);
        saveLeague();
        for(const t of d.tournaments) saveTour(t);
        closeSheet(); render(); toast(`Importati ${d.tournaments.length} tornei`);
      } catch(e){ toast('Testo non valido: incolla il backup completo'); }
    });
  },
  addPlayer: () => {
    openSheet(`<h2>Nuovo blader</h2><input type="text" id="np" placeholder="Nome"><button class="btn primary" id="np_go">Aggiungi</button>`);
    $('#np').focus();
    $('#np_go').addEventListener('click', () => { const id = newPlayer($('#np').value); closeSheet(); render(); if(id) styleSheet(id); });
  },
  style: el => { if(store.writable) styleSheet(el.dataset.v); },
  setBey: el => { const p = L.players.find(x => x.id === el.dataset.p); p.bey = el.dataset.v; saveLeague(); pendingRender = true; styleSheet(p.id); },
  setCol: el => { const p = L.players.find(x => x.id === el.dataset.p); p.color = el.dataset.v; saveLeague(); pendingRender = true; styleSheet(p.id); },
  resetW: () => { L.settings = {...(L.settings || {}), weights:{...DEF_W}}; saveLeague(); render(); },
  exportXlsx: () => exportXlsx(),
  syncNow: async () => { await flush(); await pull(); render(); toast(store.net ? (nPending() ? 'Alcune modifiche non sono partite' : 'Tutto sincronizzato') : 'Nessuna connessione'); },
  codeOn: async () => {
    const v = ($('#codeIn').value || '').trim(); if(!v) return;
    let res;
    try { res = await rpc('bey_verifica', {p_codice:v}); }
    catch(e){ toast('Serve la rete per verificare il codice'); return; }
    if(res && res.ok){
      code = v; lsSet(LS_CODE, v); store.writable = true; store.codeBad = false;
      render(); toast('Modifica sbloccata su questo telefono'); flush();
    } else toast('Codice sbagliato');
  },
  codeOff: () => confirmBox('Bloccare questo telefono?', nPending() ? `Ci sono ${nPending()} modifiche non ancora inviate: partiranno solo dopo aver reinserito il codice.` : 'Potrai solo guardare finché non reinserisci il codice.', 'Blocca', () => { code = null; lsSet(LS_CODE, null); store.writable = false; render(); })
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if(!el) return;
  const f = ACT[el.dataset.act]; if(f){ e.preventDefault(); f(el, e); }
});
document.addEventListener('change', e => {
  const el = e.target;
  if(el.dataset.w){ L.settings = {...(L.settings || {}), weights:{...weights(), [el.dataset.w]:+el.value}}; saveLeague(); render(); }
  if(el.dataset.rename){ const p = L.players.find(x => x.id === el.dataset.rename); const v = el.value.trim(); if(p && v && v !== p.name){ p.name = v; saveLeague(); render(); } }
});
document.addEventListener('input', e => { const el = e.target; if(el.dataset.w){ el.parentElement.querySelector('b').textContent = el.value; } });
document.addEventListener('focusout', () => { if(pendingRender) setTimeout(() => { if(pendingRender) safeRender(); }, 0); });
document.addEventListener('keydown', e => { if(e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); if(e.key === 'Enter' && e.target.id === 'codeIn') ACT.codeOn(); });

/* ================= EXPORT EXCEL ================= */
function loadXLSX(){
  return new Promise((res, rej) => {
    if(window.XLSX) return res(window.XLSX);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => res(window.XLSX); s.onerror = rej; document.head.appendChild(s);
  });
}
async function exportXlsx(){
  let X; try { X = await loadXLSX(); } catch(e){ toast('Impossibile caricare il generatore Excel (serve la rete la prima volta)'); return; }
  const tours = toursSorted();
  const S = accumulate(tours);
  const r2 = v => v == null ? '' : Math.round(v * 10000) / 10000;
  const stats = [['BLADER','TORNEI','TITOLI','PARTITE','VITTORIE','SCONFITTE','PUNTI FATTI','PUNTI SUBITI','WIN RATE','PERICOLOSITA','EFFICIENZA','CLUTCH WINS','CLUTCH WINS RATE','CLEAN WINS','CLEAN WINS RATE','SOTTO PRESSIONE','CONSISTENCY','RATING']];
  Object.values(S).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).forEach(s => stats.push([pname(s.id), s.nTours, s.titles, s.M, s.W, s.L, s.PF, s.PA, r2(s.wr), r2(s.per), r2(s.eff), s.cw, r2(s.clutchRate), s.clean, r2(s.cleanRate), r2(s.pres), r2(s.cons), s.rating == null ? '' : Math.round(s.rating * 10) / 10]));
  const wb = X.utils.book_new();
  const ws = X.utils.aoa_to_sheet(stats); ws['!cols'] = stats[0].map((h, i) => ({wch: i ? 13 : 12}));
  X.utils.book_append_sheet(wb, ws, 'STATISTICHE');
  const used = new Set();
  for(const t of tours){
    const rows = [['FASE','BLADER A','','BLADER B','PUNTI A','PUNTI B','VINCITORE']];
    for(const m of t.matches) rows.push([PH_LABEL[m.phase], m.a ? pname(m.a) : '', 'vs', m.b ? pname(m.b) : '', m.sa ?? '', m.sb ?? '', winnerOf(m) ? pname(winnerOf(m)) : '']);
    rows.push([], ['CLASSIFICA GIRONE','V','S','PF','PS','DIFF']);
    standings(t).forEach(r => rows.push([pname(r.id), r.W, r.L, r.PF, r.PA, r.PF - r.PA]));
    if(t.champion) rows.push([], ['CAMPIONE', pname(t.champion)]);
    const [y, mo, d] = t.date.split('-');
    let name = `${+d}_${+mo}_${y}`; while(used.has(name)) name += 'b'; used.add(name);
    const s2 = X.utils.aoa_to_sheet(rows); s2['!cols'] = [{wch:20},{wch:12},{wch:4},{wch:12},{wch:9},{wch:9},{wch:12}];
    X.utils.book_append_sheet(wb, s2, name);
  }
  const buf = X.write(wb, {bookType:'xlsx', type:'array'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  a.download = `BEYBLADE_TOURNAMENTS_${today()}.xlsx`;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
  toast('Excel pronto');
}

/* ================= AVVIO ================= */
$('#brand').innerHTML = beySVG('fulmine', '#ff3d68', {size:34, spin:true, cls:'slow'}) + '<span class="bt"><small aria-hidden="true">ベイブレード・アリーナ</small>Beyblade Arena</span>';
initStore();
if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
