// Données de référence, calendrier de travail et calculs.
// Aucun accès au réseau ici : tout se calcule à partir de l'état partagé DB.

export const DIFFS = [
  {k: "MDU",     l: "MDU",                          s: "MDU",                 main: true},
  {k: "POTEAUX", l: "KO poteaux",                   s: "KO poteaux",          main: true},
  {k: "ADRESSE", l: "Mauvaise adresse non traitée", s: "Adresse non traitée", main: true},
  {k: "CLIENT",  l: "Problème client",              s: "Problème client",     main: true},
  {k: "ID",      l: "ID affecté",                   s: "ID affecté",          main: true, hint: "Client affecté à un autre OTB"},
  {k: "BOX",     l: "Mauvaise Box",                 s: "Mauvaise Box",        main: false},
  {k: "AUTRE",   l: "Autre imprévu",                s: "Autre imprévu",       main: false},
];
export const MAIN_DIFFS = DIFFS.filter(d => d.main);
export const DIFF_L = Object.fromEntries(DIFFS.map(d => [d.k, d.l]));
export const STATUTS = {
  OK:      {l: "Installé (OK)",     s: "OK",         c: "ok"},
  KO:      {l: "Non installé (KO)", s: "KO",         c: "ko"},
  ATTENTE: {l: "En attente",        s: "En attente", c: "wait"},
  ANNULE:  {l: "Annulé",            s: "Annulé",     c: "off"},
};
export const ROLES = {attente: "En attente de validation", technicien: "Technicien", chef: "Chef d'équipe", admin: "Administrateur"};
export const EXC_TYPES = {ferie: "Férié", conge: "Congé / suspension", autre: "Non travaillé (autre)", travail: "Travaillé (exception)"};
export const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
export const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export const TIER = {
  excellent: {l: "Excellent",       b: "b-ok",   c: "c-ok",   col: "var(--ok)"},
  objectif:  {l: "Dans l'objectif", b: "b-gold", c: "c-gold", col: "var(--gold)"},
  hors:      {l: "Hors objectif",   b: "b-warn", c: "c-warn", col: "var(--warn)"},
};
export const DAY_STATE = {ok: "Objectif atteint", warn: "Objectif non atteint", ko: "Aucune installation", off: "Non travaillé", run: "Journée en cours"};
export const PERIODS = {jour: "Aujourd'hui", semaine: "Cette semaine", "semaine-prec": "Semaine précédente", mois: "Mois de travail en cours", "mois-prec": "Mois de travail précédent", perso: "Dates au choix"};

export function slug(s){
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim().replace(/\s+/g, "-").replace(/[^A-Z0-9_\-.~:@+]/g, "").slice(0, 80) || ("X" + Math.random().toString(36).slice(2, 8));
}

export const DEFAULT_ZONES = [
  ["YOP","YOP 1","Selmer"],["YOP","YOP 2","Wassakara"],["YOP","YOP 3","Mossikro, Millionnaire"],
  ["YOP","YOP 4","Toit rge, Locodjoro, Agbayaté, Abobodmé"],["YOP","YOP 5","Banco 2, Saint André, Sicogi"],
  ["YOP","YOP 6","Lhèm"],["YOP","YOP 7","Kouté"],["YOP","YOP 8","Koweït"],["YOP","YOP 10","Niangon, Base CIE"],
  ["YOP","YOP 11","Port Bouet 2"],["YOP","YOP 12","Azito"],["YOP","YOP 14","Kimi, Maroc, Anador"],
  ["YOP","YOP 18","Ananeraie, Coopec"],["YOP","YOP 19","Mamie Adjoua"],
  ["ABJ","ABJ 01","Adjamé"],["ABJ","ABJ 02","Attecoubé"],["ABJ","ABJ 03","Adjamé Roxy et Forum"],["ABJ","ABJ 04","Williamsville"],
  ["PAV","PAV 01","Faya"],["PAV","PAV 02","Abatta"],["PAV","PAV 03","Abatta"],["PAV","PAV 04","Palmeraie"],
  ["PAV","PAV 05","Palmeraie"],["PAV","PAV 06","M'badon, M'pouto"],["PAV","PAV 07","Bingerville"],
  ["MMA","MMA 01","Treichville (Zone 3, industrielle)"],["MMA","MMA 02","Marcory (Résidentiel, Centre)"],
  ["MMA","MMA 03","Zone 4 (Zone 4C, Bietry)"],["MMA","MMA 04","Treichville (Centre, Marché)"],
  ["MMA","MMA 05","Remblais Koumassi"],["MMA","MMA 06","Koumassi (Camp commando)"],["MMA","MMA 07","Koumassi (Soweto)"],
  ["MMA","MMA 09","Campement"],
  ["BOU","BOU 01","Angré (7ème, 8ème, château)"],["BOU","BOU 02","Palmeraie (Bonoumin)"],
  ["BOU","BOU 03","2 Plateaux (Colombie, Vallon, 2 Plateaux)"],["BOU","BOU 04","Palmeraie (Palmeraie)"],
  ["BOU","BOU 05","Dokui (Dokui, Abté)"],["BOU","BOU 06","Dokui (Djomi, Anador)"],
  ["BOU","BOU 07","Dokui (Vidange, Williamsville)"],["BOU","BOU 08","Dokui (Williamsville)"],
  ["GBO","GBO 01","Cocody (Centre, blocoss, ...)"],["GBO","GBO 02","Cocody (Anono, Riv 1, Riv 2, Golf Riv 3)"],
  ["GBO","GBO 03","Cocody 2 Plateaux"],
].map((z, i) => ({id: slug(z[1]), secteur: z[0], code: z[1], quartiers: z[2], actif: true, ordre: i}));

export const DEFAULT_SETTINGS = {
  objectifJour: 3, jourDebutMois: 17, premierSamedi: "2026-11-07", rythmeSamedi: 2, seuilKoZone: 5,
  debutSuivi: "", types: ["Standard"],
  objectifsDuree: [{id: "general", type: "", zone: "", excellent: 7200, objectif: 10800}],
  exceptions: [],
};

/* ---------- État partagé ---------- */
export const DB = {tickets: [], zonesDb: [], subzones: [], reports: [], settingsDb: null, users: {}};
export const VIEW = {demo: false, demoTickets: []};
export const data = () => VIEW.demo ? VIEW.demoTickets : DB.tickets;

/* ---------- Utilitaires ---------- */
export const pad = n => String(n).padStart(2, "0");
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const today = () => ymd(new Date());
export const dow = s => parseYmd(s).getDay();
export const daysBetween = (a, b) => { const A = a.split("-").map(Number), B = b.split("-").map(Number); return Math.round((Date.UTC(A[0], A[1] - 1, A[2]) - Date.UTC(B[0], B[1] - 1, B[2])) / 864e5); };
export const fmtD = s => s ? s.split("-").reverse().join("/") : "—";
export const fmtDShort = s => { const d = parseYmd(s); return `${d.getDate()} ${MOIS[d.getMonth()]}`; };
export function fmtDur(sec){ if (sec == null || !isFinite(sec)) return "—"; sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return `${pad(h)}h${pad(m)}min${pad(s)}s`; }
export function parseHMS(v){ if (!v) return null; const p = String(v).split(":").map(Number); if (p.some(isNaN)) return null; return (p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0); }
export const secToHMS = s => `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s % 3600 / 60))}:${pad(Math.round(s % 60))}`;
export function fmtHeure(hms){ const s = parseHMS(hms); if (s == null) return "—"; return `${pad(Math.floor(s / 3600))}h${pad(Math.floor(s % 3600 / 60))}min${pad(s % 60)}s`; }
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
export const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 : 0;
export const nkey = s => String(s || "").trim().toUpperCase().replace(/\s+/g, "");
export const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- Réglages, zones ---------- */
export function settings(){
  const st = Object.assign({}, DEFAULT_SETTINGS, DB.settingsDb || {});
  if (!Array.isArray(st.objectifsDuree) || !st.objectifsDuree.length) st.objectifsDuree = DEFAULT_SETTINGS.objectifsDuree;
  if (!st.objectifsDuree.some(o => !o.type && !o.zone)) st.objectifsDuree = [DEFAULT_SETTINGS.objectifsDuree[0], ...st.objectifsDuree];
  if (!Array.isArray(st.types) || !st.types.length) st.types = DEFAULT_SETTINGS.types;
  if (!Array.isArray(st.exceptions)) st.exceptions = [];
  return st;
}
export function zones(){
  const map = new Map(DEFAULT_ZONES.map(z => [z.id, z]));
  DB.zonesDb.forEach(z => map.set(z.id, Object.assign({}, map.get(z.id) || {}, z)));
  return [...map.values()].sort((a, b) => (a.ordre ?? 999) - (b.ordre ?? 999) || a.code.localeCompare(b.code, "fr", {numeric: true}));
}
export const zoneByCode = code => zones().find(z => z.code === code);
export const subzonesOf = code => DB.subzones.filter(s => s.zone === code).sort((a, b) => String(a.code).localeCompare(String(b.code), "fr", {numeric: true}));
export function szLabel(zone, code){
  if (!code) return zone || "—";
  const s = DB.subzones.find(x => x.zone === zone && x.code === code);
  return `${zone}/${code}${s && s.nom ? " · " + s.nom : ""}`;
}

/* ---------- Calendrier de travail ---------- */
export function trackStart(){
  const st = settings();
  if (st.debutSuivi) return st.debutSuivi;
  const ds = data().map(t => t.date).filter(Boolean).sort();
  return ds[0] || today();
}
export function satWorked(s){ const st = settings(); const r = Math.max(1, +st.rythmeSamedi || 1); const w = Math.floor(daysBetween(s, st.premierSamedi) / 7); return ((w % r) + r) % r === 0; }
export function dayInfo(s){
  const st = settings();
  const ex = st.exceptions.find(e => e.date === s);
  let worked, type;
  if (ex){ worked = ex.type === "travail"; type = EXC_TYPES[ex.type] || "Exception"; }
  else {
    const d = dow(s);
    if (d === 0){ worked = false; type = "Dimanche"; }
    else if (d === 6){ worked = satWorked(s); type = worked ? "Samedi travaillé" : "Samedi non travaillé"; }
    else { worked = true; type = "Jour travaillé"; }
  }
  if (s < trackStart()) return {worked: false, type: "Avant le suivi", obj: 0};
  return {worked, type, obj: worked ? (+st.objectifJour || 0) : 0};
}
export function wmStart(s){ const jd = settings().jourDebutMois; const d = parseYmd(s); return d.getDate() >= jd ? ymd(new Date(d.getFullYear(), d.getMonth(), jd)) : ymd(new Date(d.getFullYear(), d.getMonth() - 1, jd)); }
export function wmEnd(a){ const d = parseYmd(a); return ymd(new Date(d.getFullYear(), d.getMonth() + 1, d.getDate() - 1)); }
export const weekStart = s => addDays(s, -((dow(s) + 6) % 7));
export function periodRange(p, a, b){
  const t = today();
  switch (p){
    case "jour": return [t, t];
    case "semaine": { const m = weekStart(t); return [m, addDays(m, 6)]; }
    case "semaine-prec": { const m = addDays(weekStart(t), -7); return [m, addDays(m, 6)]; }
    case "mois": { const s = wmStart(t); return [s, wmEnd(s)]; }
    case "mois-prec": { const s = wmStart(addDays(wmStart(t), -1)); return [s, wmEnd(s)]; }
    case "perso": { const x = a || t, y = b || t; return x <= y ? [x, y] : [y, x]; }
    case "tout": { const ds = data().map(t => t.date).sort(); return [ds[0] || t, t]; }
  }
  return [t, t];
}
export const periodLabel = (a, b) => a === b ? fmtD(a) : `du ${fmtD(a)} au ${fmtD(b)}`;

/* ---------- Durées et performance ---------- */
export function targetFor(type, zone){
  const list = settings().objectifsDuree;
  return list.find(o => o.type && o.zone && o.type === type && o.zone === zone)
      || list.find(o => o.type && !o.zone && o.type === type)
      || list.find(o => !o.type && o.zone && o.zone === zone)
      || list.find(o => !o.type && !o.zone);
}
// Durée en secondes à partir des heures saisies (« 08:30:00 »). Une fin avant le début n'est pas une durée.
export function dur(t){ const a = parseHMS(t.debut), b = parseHMS(t.fin); if (a == null || b == null || b < a) return null; return b - a; }
export function tierOf(sec, tg){ if (sec == null) return null; return sec <= tg.excellent ? "excellent" : sec <= tg.objectif ? "objectif" : "hors"; }

/* ---------- Calculs ---------- */
let cache = {src: null, set: null};
export function invalidate(){ cache.src = null; }
export function countedOk(){
  const src = data();
  if (cache.src === src) return cache.set;
  const first = new Map();
  src.filter(t => t.statut === "OK").sort((a, b) => (a.date + String(a.createdAt).padStart(15, "0")).localeCompare(b.date + String(b.createdAt).padStart(15, "0"))).forEach(t => { const k = nkey(t.numero); if (!first.has(k)) first.set(k, t.id); });
  cache = {src, set: new Set(first.values())};
  return cache.set;
}
export function objectiveFor(a, b){
  const end = b < today() ? b : today();
  let obj = 0, worked = 0;
  for (let d = a; d <= end; d = addDays(d, 1)){ const i = dayInfo(d); obj += i.obj; if (i.worked) worked++; }
  return {obj, worked};
}
const inScope = (t, f) => t.date >= f.a && t.date <= f.b && (!f.zone || t.zone === f.zone) && (!f.tech || t.techId === f.tech);
const avgOf = ts => ts.length ? ts.reduce((s, t) => s + dur(t), 0) / ts.length : null;
export function stats(f){
  const counted = countedOk();
  const list = data().filter(t => inScope(t, f));
  const ok = list.filter(t => t.statut === "OK" && counted.has(t.id));
  const ko = list.filter(t => t.statut === "KO");
  const attente = list.filter(t => t.statut === "ATTENTE");
  const annule = list.filter(t => t.statut === "ANNULE");
  const timed = ok.filter(t => dur(t) != null);
  const tiers = {excellent: 0, objectif: 0, hors: 0};
  timed.forEach(t => tiers[tierOf(dur(t), targetFor(t.type, t.zone))]++);
  const diffs = Object.fromEntries(DIFFS.map(d => [d.k, list.filter(t => t.statut !== "ANNULE" && (t.difficultes || []).includes(d.k))]));
  const poteaux = list.filter(t => (t.difficultes || []).includes("POTEAUX")).reduce((s, t) => s + (+t.poteaux || 0), 0);
  const {obj, worked} = objectiveFor(f.a, f.b);
  return {list, ok, ko, attente, annule, timed, tiers, avgDur: avgOf(timed), diffs, poteaux, obj, worked,
    ecart: ok.length - obj, realisation: pct(ok.length, obj), reussite: pct(ok.length, ok.length + ko.length), noHours: ok.filter(t => dur(t) == null).length};
}
export function byDay(f){
  const counted = countedOk(), rows = [];
  const end = f.b < today() ? f.b : today();
  for (let d = f.a; d <= end; d = addDays(d, 1)){
    const ts = data().filter(t => t.date === d && (!f.zone || t.zone === f.zone) && (!f.tech || t.techId === f.tech));
    const okL = ts.filter(t => t.statut === "OK" && counted.has(t.id));
    const ok = okL.length, ko = ts.filter(t => t.statut === "KO").length;
    const info = dayInfo(d);
    let state;
    if (!info.obj) state = "off"; else if (ok >= info.obj) state = "ok"; else if (d === today()) state = "run"; else if (ok === 0) state = "ko"; else state = "warn";
    rows.push({d, ok, ko, obj: info.obj, info, state, avg: avgOf(okL.filter(t => dur(t) != null))});
  }
  return rows;
}
export function zoneStats(f){
  const counted = countedOk(), seuil = +settings().seuilKoZone || 5;
  const list = data().filter(t => t.date >= f.a && t.date <= f.b && (!f.tech || t.techId === f.tech));
  return zones().map(z => {
    const ts = list.filter(t => t.zone === z.code);
    const ok = ts.filter(t => t.statut === "OK" && counted.has(t.id));
    const avg = avgOf(ok.filter(t => dur(t) != null));
    const ko = ts.filter(t => t.statut === "KO").length;
    const nd = ts.filter(t => t.statut !== "ANNULE").reduce((s, t) => s + (t.difficultes || []).filter(k => MAIN_DIFFS.some(d => d.k === k)).length, 0);
    const hard = (avg != null && avg > targetFor("", z.code).objectif) || ko >= seuil;
    return {z, ok: ok.length, ko, avg, nd, hard, any: ts.length};
  });
}
export function subzoneStats(f){
  const counted = countedOk(), map = new Map();
  data().filter(t => t.sousZone && inScope(t, f)).forEach(t => { const k = t.zone + "|" + t.sousZone; if (!map.has(k)) map.set(k, []); map.get(k).push(t); });
  return [...map.entries()].map(([k, ts]) => {
    const [zone, code] = k.split("|");
    const ok = ts.filter(t => t.statut === "OK" && counted.has(t.id));
    const tm = ok.filter(t => dur(t) != null);
    const avg = avgOf(tm);
    const hors = tm.filter(t => tierOf(dur(t), targetFor(t.type, t.zone)) === "hors").length;
    const ko = ts.filter(t => t.statut === "KO").length;
    const nd = ts.filter(t => t.statut !== "ANNULE").reduce((s, t) => s + (t.difficultes || []).length, 0);
    return {zone, code, label: szLabel(zone, code), ok: ok.length, timed: tm.length, avg, hors, horsPct: pct(hors, tm.length), ko, nd, hard: avg != null && avg > targetFor("", zone).objectif};
  }).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1) || b.ko - a.ko || b.nd - a.nd);
}
export function alerts(f){
  const days = byDay(f).filter(r => r.obj && r.d < today());
  const seuil = +settings().seuilKoZone || 5;
  const keys = new Map(); data().forEach(t => { const k = nkey(t.numero) + "|" + t.statut; keys.set(k, (keys.get(k) || 0) + 1); });
  const st = stats(f);
  return [
    {l: "Jours travaillés sous l'objectif", n: days.filter(r => r.ok < r.obj).length},
    {l: "Jours travaillés sans aucune installation", n: days.filter(r => r.ok === 0).length},
    {l: `Zones avec ${seuil} KO ou plus`, n: zoneStats(f).filter(z => z.ko >= seuil).length},
    {l: "Tickets en attente", n: st.attente.length},
    {l: "Installations sans heures (durée non comptée)", n: st.noHours},
    {l: "Tickets enregistrés en double", n: [...keys.values()].filter(n => n > 1).length},
  ];
}

/* ---------- Données d'exemple (jamais enregistrées) ---------- */
export function makeDemo(){
  let seed = 20261114;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const zs = ["YOP 4", "YOP 10", "MMA 06", "MMA 09", "BOU 03", "GBO 02", "ABJ 01", "PAV 04", "YOP 1", "MMA 02"];
  const out = []; let n = 4100;
  const end = today(), start = addDays(wmStart(end), -14);
  for (let d = start; d <= end; d = addDays(d, 1)){
    const dw = dow(d); if (dw === 0 || (dw === 6 && !satWorked(d))) continue;
    const nOk = pick([1, 2, 3, 3, 3, 4, 2, 3, 0, 3]), nKo = pick([0, 0, 1, 0, 1, 2, 0]);
    let clock = 7.5 * 3600 + rnd() * 1800;
    const add = statut => {
      const zone = pick(zs), sz = String(1 + Math.floor(rnd() * 3));
      const base = zone === "MMA 06" || zone === "BOU 03" ? 3.1 : zone === "GBO 02" ? 1.7 : 2.3;
      const len = Math.max(3000, Math.round((base + (rnd() - .5) * 1.4) * 3600));
      const deb = Math.round(clock); clock += len + 1800 + rnd() * 2400;
      const diffs = statut === "KO" ? [pick(["POTEAUX", "ADRESSE", "CLIENT", "ID", "MDU", "POTEAUX"])] : (rnd() < .25 ? [pick(["MDU", "CLIENT"])] : []);
      if (statut === "KO" && rnd() < .25) diffs.push(pick(["MDU", "BOX"]));
      out.push({id: "demo" + n, numero: "TK-" + (n++), client: "Client exemple", type: "Standard", zone, sousZone: sz, date: d, statut,
        difficultes: [...new Set(diffs)], poteaux: diffs.includes("POTEAUX") ? 1 + Math.floor(rnd() * 3) : 0, obs: "",
        debut: statut === "OK" ? secToHMS(deb) : "", fin: statut === "OK" ? secToHMS(deb + len) : "",
        techId: rnd() < .5 ? "demo-a" : "demo-b", createdAt: parseYmd(d).getTime() + deb * 1000, updatedAt: parseYmd(d).getTime() + deb * 1000});
    };
    for (let i = 0; i < nOk; i++) add("OK");
    for (let i = 0; i < nKo; i++) add("KO");
    if (rnd() < .2) add("ATTENTE");
  }
  return out;
}
