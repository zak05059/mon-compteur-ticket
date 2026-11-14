// Mon Compteur de Ticket — interface.
import {
  DIFFS, MAIN_DIFFS, DIFF_L, STATUTS, ROLES, EXC_TYPES, JOURS, TIER, DAY_STATE, PERIODS,
  DB, VIEW, data, slug, today, dow, parseYmd, fmtD, fmtDShort, fmtDur, fmtHeure, parseHMS, secToHMS, esc, pct, nkey, uid,
  settings, zones, zoneByCode, subzonesOf, szLabel, dayInfo, wmStart, wmEnd, periodRange, periodLabel,
  targetFor, dur, tierOf, invalidate, countedOk, stats, byDay, zoneStats, subzoneStats, alerts, makeDemo,
} from "./data.js";
import { createStore, errorText } from "./store.js";
import { makePdf, deliverFile } from "./pdf.js";

const $ = s => document.querySelector(s);
const clean = o => JSON.parse(JSON.stringify(o));

/* ================= État ================= */
const S = {store: null, mode: "", user: null, profile: null, sync: {pending: false, cache: false}, online: navigator.onLine, subscribed: false, installEvt: null};
const UI = {
  tab: "home", homeScope: "team", authTab: "login",
  tk: {q: "", per: "mois", statut: "", zone: "", diff: ""},
  dash: {per: "mois", a: "", b: "", zone: "", tech: ""},
  rep: {per: "mois-prec", a: "", b: "", zone: ""}, xper: "mois",
  openZone: null, sheet: null,
};
try { const s = JSON.parse(localStorage.getItem("mct:ui") || "{}"); if (s.tab) UI.tab = s.tab; if (s.homeScope) UI.homeScope = s.homeScope; } catch (e) {}
const rememberUI = () => { try { localStorage.setItem("mct:ui", JSON.stringify({tab: UI.tab, homeScope: UI.homeScope})); } catch (e) {} };

const role = () => VIEW.demo ? "admin" : (S.profile && S.profile.role) || "";
const isMember = () => ["technicien", "chef", "admin"].includes(role());
const isChef = () => ["chef", "admin"].includes(role());
const isAdmin = () => role() === "admin";
const myId = () => VIEW.demo ? "demo-a" : (S.user && S.user.uid) || "";
const canEditTicket = t => VIEW.demo || isChef() || (isMember() && t.techId === myId());
const canZones = () => !VIEW.demo && isChef();
const DEMO_NAMES = {"demo-a": "Technicien A (exemple)", "demo-b": "Technicien B (exemple)"};
function techName(id){
  if (!id) return "Non renseigné";
  if (DEMO_NAMES[id]) return DEMO_NAMES[id];
  const u = DB.users[id]; const n = u && u.nom || "";
  if (id === myId()) return !n || n === "Vous" ? "Vous" : n + " (vous)";
  return n || "Technicien";
}

/* ================= Écriture ================= */
function writeErr(e){ toast(errorText(e)); console.warn(e); }
// Firestore garde l'écriture même hors ligne : on n'attend pas la réponse du serveur pour fermer l'écran.
function put(coll, item){
  if (VIEW.demo){
    if (coll !== "tickets"){ toast("Quittez le mode exemple pour modifier les zones et les rapports."); return false; }
    const i = VIEW.demoTickets.findIndex(x => x.id === item.id); if (i >= 0) VIEW.demoTickets[i] = clean(item); else VIEW.demoTickets.push(clean(item));
    changed(); return true;
  }
  S.store.put(coll, item).catch(writeErr); return true;
}
function del(coll, id){
  if (VIEW.demo){ VIEW.demoTickets = VIEW.demoTickets.filter(x => x.id !== id); changed(); return; }
  S.store.del(coll, id).catch(writeErr);
}
function putSettings(st){ if (VIEW.demo){ toast("Quittez le mode exemple pour modifier les réglages."); return false; } S.store.putSettings(st).catch(writeErr); return true; }

/* ================= Démarrage et comptes ================= */
async function boot(){
  try { S.store = await createStore(); }
  catch (e) { showFatal("Impossible de charger le service en ligne. Vérifiez la connexion internet puis rouvrez l'application."); return; }
  S.mode = S.store.mode;
  let unProfile = null;
  S.store.onAuth(user => {
    S.user = user;
    if (unProfile){ unProfile(); unProfile = null; }
    if (!user){ S.profile = null; showAuth(); return; }
    unProfile = S.store.watchProfile(user, (p, err) => {
      if (!p){ if (err) showFatal(errorText(err)); return; }
      S.profile = p;
      if (p.role === "attente" || !ROLES[p.role]) showPending();
      else showShell();
    });
  });
}
function hideSplash(){ $("#splash").hidden = true; }
function showFatal(msg){ hideSplash(); $("#shell").hidden = true; const a = $("#auth"); a.hidden = false; a.innerHTML = `<div class="auth"><div class="card auth-card"><div class="auth-brand"><img src="icons/logo.jpg" alt=""><h1>Mon Compteur de Ticket</h1></div><p class="err">${esc(msg)}</p><button class="btn btn-ghost btn-block" type="button" onclick="location.reload()">Réessayer</button></div></div>`; }
function showAuth(msg){
  hideSplash(); $("#shell").hidden = true; closeSheet();
  const a = $("#auth"); a.hidden = false;
  const login = UI.authTab === "login", reset = UI.authTab === "reset";
  a.innerHTML = `<div class="auth"><div class="auth-card">
    <div class="auth-brand"><img src="icons/logo.jpg" alt="KBOWD Group"><h1>Mon Compteur de Ticket</h1><p>Suivi des installations FTTH · KBOWD Group</p></div>
    <div class="card"><div class="stack">
      ${reset ? "" : `<div class="seg tabs2" role="group"><button type="button" data-auth="login" aria-pressed="${login}">Se connecter</button><button type="button" data-auth="signup" aria-pressed="${!login}">Créer un compte</button></div>`}
      ${reset ? `<h2>Mot de passe oublié</h2><p class="small muted" style="margin:0">Saisissez votre adresse : vous recevrez un lien pour choisir un nouveau mot de passe.</p>` : ""}
      <form id="authForm" class="stack" novalidate>
        ${UI.authTab === "signup" ? `<label class="field"><span>Nom et prénom</span><input type="text" id="a-nom" name="nom" autocomplete="name" required></label>` : ""}
        <label class="field"><span>Adresse e-mail</span><input type="email" id="a-mail" name="email" autocomplete="email" inputmode="email" required></label>
        ${reset ? "" : `<label class="field"><span>Mot de passe</span><input type="password" id="a-pw" name="pw" autocomplete="${login ? "current-password" : "new-password"}" minlength="6" required>${login ? "" : "<small>6 caractères au minimum</small>"}</label>`}
        <div class="err" id="a-err" role="alert">${msg ? esc(msg) : ""}</div>
        <button class="btn btn-violet btn-block" type="submit">${reset ? "Envoyer le lien" : login ? "Se connecter" : "Créer mon compte"}</button>
      </form>
      ${login ? `<button class="link" type="button" data-auth="reset">Mot de passe oublié ?</button>` : reset ? `<button class="link" type="button" data-auth="login">Retour à la connexion</button>` : `<p class="small muted" style="margin:0">Après la création, un administrateur valide votre compte avant que vous puissiez saisir.</p>`}
    </div></div></div></div>`;
  a.querySelector("#authForm").addEventListener("submit", async e => {
    e.preventDefault(); const f = e.target, err = a.querySelector("#a-err"), btn = f.querySelector("button[type=submit]");
    const email = f.email.value.trim(), pw = f.pw ? f.pw.value : "";
    if (!email) return fail(err, "Saisissez votre adresse e-mail.", f.email);
    if (UI.authTab === "signup" && !f.nom.value.trim()) return fail(err, "Saisissez votre nom.", f.nom);
    if (!reset && pw.length < 6) return fail(err, "Le mot de passe doit contenir au moins 6 caractères.", f.pw);
    btn.disabled = true; err.textContent = "";
    try {
      if (reset){ await S.store.reset(email); UI.authTab = "login"; showAuth("Lien envoyé. Consultez votre boîte e-mail."); return; }
      if (login) await S.store.signIn(email, pw); else await S.store.signUp(f.nom.value.trim(), email, pw);
    } catch (x) { err.textContent = errorText(x); btn.disabled = false; }
  });
}
function showPending(){
  hideSplash(); $("#shell").hidden = true;
  const a = $("#auth"); a.hidden = false;
  a.innerHTML = `<div class="auth"><div class="auth-card"><div class="auth-brand"><img src="icons/logo.jpg" alt=""><h1>Compte en attente</h1>
    <p>Bonjour ${esc(S.profile.nom || "")}. Un administrateur doit valider votre compte. Cet écran s'ouvrira tout seul dès la validation.</p></div>
    <div class="card stack"><div class="kv"><dt>Compte</dt><dd>${esc(S.user.email || "")}</dd><dt>Statut</dt><dd><span class="badge b-gold">En attente</span></dd></div>
    <button class="btn btn-ghost btn-block" type="button" data-act="logout">Se déconnecter</button></div></div></div>`;
}
function showShell(){
  hideSplash(); $("#auth").hidden = true; $("#auth").innerHTML = ""; $("#shell").hidden = false;
  if (!S.subscribed){
    S.subscribed = true;
    S.store.subscribe((kind, items) => {
      if (kind === "settings") DB.settingsDb = items;
      else if (kind === "users") DB.users = Object.fromEntries(items.map(u => [u.uid, u]));
      else if (kind === "zones") DB.zonesDb = items;
      else DB[kind] = items;
      changed();
    }, sync => { S.sync = sync; paintSync(); }, e => toast(errorText(e)));
  }
  render();
}

/* ================= Rendu ================= */
let pending = false;
function changed(){ invalidate(); if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; if (!$("#shell").hidden) render(); }); }
function paintSync(){
  const el = $("#sync"); if (!el) return;
  let cls = "", txt = "Synchronisé";
  if (S.mode === "local"){ cls = "local"; txt = "Sur l'appareil"; }
  else if (!S.online){ cls = "off"; txt = S.sync.pending ? "Hors ligne · en attente d'envoi" : "Hors ligne"; }
  else if (S.sync.pending){ cls = "off"; txt = "Envoi…"; }
  el.className = "sync " + cls; el.title = txt; el.setAttribute("aria-label", txt); el.querySelector("span").textContent = txt;
}
function render(){
  const t = today(), ws = wmStart(t);
  $("#subtitle").textContent = `${JOURS[dow(t)][0].toUpperCase() + JOURS[dow(t)].slice(1)} ${fmtD(t)} · mois ${fmtD(ws).slice(0, 5)}–${fmtD(wmEnd(ws)).slice(0, 5)}`;
  const name = (S.profile && S.profile.nom) || "?";
  $("#avatarBtn").textContent = name.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  paintSync();
  const banner = $("#banner");
  if (VIEW.demo){ banner.hidden = false; banner.innerHTML = `<span><b>Mode exemple.</b> Essayez librement : rien n'est enregistré.</span><button type="button" data-act="demo-off">Quitter</button>`; }
  else if (S.mode === "local"){ banner.hidden = false; banner.innerHTML = `<span>Firebase n'est pas encore configuré : les tickets restent sur ce téléphone.</span>`; }
  else banner.hidden = true;
  document.querySelectorAll(".dock-btn").forEach(b => b.setAttribute("aria-current", b.dataset.tab === UI.tab ? "page" : "false"));
  const fn = {home: viewHome, tickets: viewTickets, dash: viewDash, zones: viewZones, menu: viewMenu}[UI.tab] || viewHome;
  $("#view").innerHTML = fn();
  if (UI.sheet && UI.sheet.refresh) renderSheet();
}

function ring(v, max){
  const r = 66, c = 2 * Math.PI * r, p = max ? Math.min(v / max, 1) : 0, done = max && v >= max;
  return `<svg viewBox="0 0 164 164" aria-hidden="true">
    <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${done ? "var(--ok)" : "var(--violet)"}"/><stop offset="1" stop-color="${done ? "var(--ok)" : "var(--gold)"}"/></linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <circle cx="82" cy="82" r="${r}" fill="none" stroke="var(--glass-2)" stroke-width="12"/>
    <circle cx="82" cy="82" r="${r + 10}" fill="none" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 6"/>
    ${p > 0 ? `<circle cx="82" cy="82" r="${r}" fill="none" stroke="url(#rg)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" filter="url(#glow)"/>` : ""}</svg>`;
}
function emptyBlock(wrap = true){
  return `<div class="${wrap ? "card " : ""}empty"><h3>Aucun ticket pour le moment</h3>
    <p class="muted">Touchez le bouton « + » pour saisir votre première installation.</p>
    <div class="btn-row" style="justify-content:center;margin-top:14px"><button class="btn btn-primary" data-act="new-ticket" type="button">+ Nouveau ticket</button>
    <button class="btn btn-ghost" data-act="demo-on" type="button">Voir avec des exemples</button></div></div>`;
}
function perfMini(t){
  const tg = targetFor(t.type, t.zone), d = dur(t), tier = tierOf(d, tg), max = tg.objectif * 1.4;
  return `<button class="mini" type="button" data-act="open" data-id="${t.id}" style="background:none;border-left:0;border-right:0;border-top:0;text-align:left;width:100%">
    <span class="mt">${esc(t.numero)} · ${esc(szLabel(t.zone, t.sousZone))}</span><span class="md ${TIER[tier].c}">${fmtDur(d)}</span>
    <span class="mb"><i style="width:${Math.min(d / max, 1) * 100}%;background:${TIER[tier].col}"></i><s style="left:${tg.excellent / max * 100}%"></s><s style="left:${tg.objectif / max * 100}%"></s></span></button>`;
}
function installCard(){
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone) return "";
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent);
  if (S.installEvt) return `<section class="card" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><div style="flex:1 1 200px"><h2>Installer l'application</h2><p class="small muted" style="margin:4px 0 0">Ajoutez Mon Compteur de Ticket à l'écran d'accueil du téléphone.</p></div><button class="btn btn-primary" type="button" data-act="install">Installer</button></section>`;
  if (ios) return `<section class="card"><h2>Installer sur iPhone</h2><p class="small muted" style="margin:6px 0 0">Dans Safari, touchez Partager puis « Sur l'écran d'accueil ».</p></section>`;
  return "";
}
function viewHome(){
  const t = today();
  const f = {a: t, b: t, tech: UI.homeScope === "me" ? myId() : ""};
  const st = stats(f), info = dayInfo(t), tg = targetFor("", "");
  const inTarget = st.timed.length ? pct(st.tiers.excellent + st.tiers.objectif, st.timed.length) : null;
  let msg, cls;
  if (!info.obj){ msg = `${info.type} : pas d'objectif aujourd'hui`; cls = "off"; }
  else if (st.ok.length >= info.obj){ msg = "Objectif du jour atteint"; cls = "ok"; }
  else { msg = `Il en manque ${info.obj - st.ok.length}`; cls = st.ok.length ? "warn" : "ko"; }
  const recent = [...data()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 5);
  const perfToday = st.timed.slice().sort((a, b) => dur(b) - dur(a));
  return `<div class="stack">
    ${installCard()}
    <section class="card">
      <div class="card-head"><div><div class="eyebrow">Aujourd'hui</div><h2 style="margin-top:2px">${esc(JOURS[dow(t)][0].toUpperCase() + JOURS[dow(t)].slice(1))} ${fmtDShort(t)}</h2></div>
        <div class="seg" role="group" aria-label="Portée"><button type="button" data-act="scope" data-v="team" aria-pressed="${UI.homeScope === "team"}">Équipe</button><button type="button" data-act="scope" data-v="me" aria-pressed="${UI.homeScope === "me"}">Moi</button></div></div>
      <div class="hero">
        <div class="ring">${ring(st.ok.length, info.obj)}<div class="val"><span class="big num">${st.ok.length}<small>/${info.obj}</small></span><span class="lbl">installations</span></div></div>
        <div class="stack" style="gap:12px;min-width:0;width:100%">
          <div class="hero-msg ${cls}">${esc(msg)}</div>
          <div class="kpis">
            <div class="kpi"><div class="k">KO du jour</div><div class="v c-ko">${st.ko.length}</div></div>
            <div class="kpi"><div class="k">Temps moyen</div><div class="v sm num">${fmtDur(st.avgDur)}</div></div>
            <div class="kpi"><div class="k">Cible tenue</div><div class="v ${inTarget == null ? "" : inTarget >= 80 ? "c-ok" : inTarget >= 50 ? "c-gold" : "c-warn"}">${inTarget == null ? "—" : Math.round(inTarget) + "%"}</div></div>
          </div>
          <div class="small muted">Objectif de durée : excellent jusqu'à ${fmtDur(tg.excellent)}, objectif jusqu'à ${fmtDur(tg.objectif)}</div>
        </div>
      </div>
    </section>
    <section class="card">
      <div class="card-head"><h2>Difficultés du jour</h2><span class="small muted">Touchez pour voir les tickets</span></div>
      <div class="counters">${MAIN_DIFFS.map(d => { const n = st.diffs[d.k].length; return `<button class="counter ${n ? "hot" : ""}" type="button" data-act="diff-list" data-k="${d.k}" data-per="jour"><span class="n num">${n}</span><span class="t">${esc(d.l)}</span></button>`; }).join("")}</div>
    </section>
    ${perfToday.length ? `<section class="card"><div class="card-head"><h2>Performance du jour</h2><span class="small muted">Durée de chaque installation</span></div>${perfToday.map(perfMini).join("")}</section>` : ""}
    ${data().length ? `<section class="card"><div class="card-head"><h2>Derniers tickets</h2><button class="link" type="button" data-act="tab" data-v="tickets">Tout voir</button></div>
      <div class="list">${recent.map(ticketRow).join("")}</div></section>` : emptyBlock()}
  </div>`;
}
function ticketRow(t){
  const s = STATUTS[t.statut] || STATUTS.ATTENTE, d = dur(t);
  const tier = t.statut === "OK" ? tierOf(d, targetFor(t.type, t.zone)) : null;
  const diffs = (t.difficultes || []).map(k => DIFFS.find(x => x.k === k)?.s || k).join(", ");
  const dup = t.statut === "OK" && !countedOk().has(t.id);
  return `<button class="row" type="button" data-act="open" data-id="${t.id}">
    <span class="dot ${s.c}" aria-hidden="true"></span>
    <span class="main"><span class="t1">${esc(t.numero)} · ${esc(szLabel(t.zone, t.sousZone))}</span>
      <span class="t2">${fmtD(t.date)} · ${esc(s.s)}${diffs ? " · " + esc(diffs) : ""}${dup ? " · doublon non compté" : ""}</span></span>
    <span class="side">${d != null ? `<span class="num">${fmtDur(d)}</span>${tier ? `<span class="badge ${TIER[tier].b}">${TIER[tier].l}</span>` : ""}` : `<span class="badge b-${s.c}">${esc(s.s)}</span>`}</span>
  </button>`;
}
function periodSelect(id, val, withTout){
  const opts = Object.entries(PERIODS).concat(withTout ? [["tout", "Tout l'historique"]] : []);
  return `<select id="${id}" data-bind="${id}" aria-label="Période">${opts.map(([k, l]) => `<option value="${k}" ${val === k ? "selected" : ""}>${l}</option>`).join("")}</select>`;
}
function zoneSelect(id, val){
  return `<select id="${id}" data-bind="${id}" aria-label="Zone"><option value="">Toutes les zones</option>${zones().filter(z => z.actif !== false || z.code === val).map(z => `<option value="${esc(z.code)}" ${val === z.code ? "selected" : ""}>${esc(z.code)}</option>`).join("")}</select>`;
}
function viewTickets(){
  const k = UI.tk, [a, b] = periodRange(k.per), q = k.q.trim().toLowerCase();
  const list = data().filter(t => t.date >= a && t.date <= b && (!k.statut || t.statut === k.statut) && (!k.zone || t.zone === k.zone) && (!k.diff || (t.difficultes || []).includes(k.diff))
    && (!q || [t.numero, t.client, t.zone, t.sousZone, szLabel(t.zone, t.sousZone), t.obs].join(" ").toLowerCase().includes(q)))
    .sort((x, y) => y.date.localeCompare(x.date) || (y.createdAt || 0) - (x.createdAt || 0));
  return `<div class="stack">
    <section class="card"><div class="filters">
      <input type="search" id="tk-q" data-bind="tk-q" placeholder="Numéro, client, zone…" value="${esc(k.q)}" aria-label="Rechercher" style="flex-basis:100%">
      ${periodSelect("tk-per", k.per, true)}
      <select id="tk-statut" data-bind="tk-statut" aria-label="Statut"><option value="">Tous les statuts</option>${Object.entries(STATUTS).map(([x, s]) => `<option value="${x}" ${k.statut === x ? "selected" : ""}>${s.l}</option>`).join("")}</select>
      ${zoneSelect("tk-zone", k.zone)}
      <select id="tk-diff" data-bind="tk-diff" aria-label="Difficulté"><option value="">Toutes les difficultés</option>${DIFFS.map(d => `<option value="${d.k}" ${k.diff === d.k ? "selected" : ""}>${d.l}</option>`).join("")}</select>
    </div></section>
    <section class="card">
      <div class="card-head"><h2>${list.length} ticket${list.length > 1 ? "s" : ""}</h2><span class="small muted">${esc(periodLabel(a, b))}</span></div>
      ${list.length ? `<div class="list">${list.slice(0, 300).map(ticketRow).join("")}</div>${list.length > 300 ? `<p class="small muted">300 premiers affichés. Affinez les filtres.</p>` : ""}`
        : data().length ? `<div class="empty"><h3>Aucun ticket pour ces filtres</h3><p class="muted">Élargissez la période ou retirez un filtre.</p></div>` : emptyBlock(false)}
    </section></div>`;
}
const kpi = (k, v, s = "", cls = "") => `<div class="kpi"><div class="k">${k}</div><div class="v ${cls}">${v}</div>${s ? `<div class="s">${s}</div>` : ""}</div>`;
function viewDash(){
  const k = UI.dash, [a, b] = periodRange(k.per, k.a, k.b), f = {a, b, zone: k.zone, tech: k.tech};
  const st = stats(f), days = byDay(f), nt = st.timed.length;
  const techs = [...new Set(data().map(t => t.techId).filter(Boolean))];
  const shown = days.slice(-31), maxBar = Math.max(1, ...shown.map(r => Math.max(r.ok, r.obj)));
  const step = shown.length > 16 ? Math.ceil(shown.length / 8) : 1;
  const zs = zoneStats(f).filter(z => z.any || z.ok).sort((x, y) => y.ok - x.ok || y.ko - x.ko);
  const subs = subzoneStats(f).slice(0, 15);
  const perf = st.timed.slice().sort((x, y) => dur(y) - dur(x));
  const color = s => ({ok: "linear-gradient(180deg,var(--ok),color-mix(in srgb,var(--ok) 55%,transparent))", warn: "linear-gradient(180deg,var(--warn),color-mix(in srgb,var(--warn) 55%,transparent))", ko: "var(--ko)", run: "linear-gradient(180deg,var(--wait),color-mix(in srgb,var(--wait) 55%,transparent))", off: "var(--glass-2)"}[s]);
  return `<div class="stack">
    <section class="card"><div class="filters">
      ${periodSelect("d-per", k.per)}${zoneSelect("d-zone", k.zone)}
      ${techs.length ? `<select id="d-tech" data-bind="d-tech" aria-label="Technicien"><option value="">Toute l'équipe</option>${techs.map(id => `<option value="${esc(id)}" ${k.tech === id ? "selected" : ""}>${esc(techName(id))}</option>`).join("")}</select>` : ""}
      ${k.per === "perso" ? `<input type="date" id="d-a" data-bind="d-a" value="${k.a || a}" aria-label="Du"><input type="date" id="d-b" data-bind="d-b" value="${k.b || b}" aria-label="Au">` : ""}
    </div><p class="small muted" style="margin:10px 0 0">${esc(periodLabel(a, b))} · ${st.worked} jour${st.worked > 1 ? "s" : ""} travaillé${st.worked > 1 ? "s" : ""} à ce jour</p></section>

    <section class="card"><div class="card-head"><h2>Production</h2></div>
      <div class="grid4">
        ${kpi("Installations (OK)", st.ok.length, "", "c-ok")}
        ${kpi("Objectif", st.obj, `${settings().objectifJour} par jour travaillé`)}
        ${kpi("Écart", (st.ecart > 0 ? "+" : "") + st.ecart, "", st.ecart >= 0 ? "c-ok" : "c-ko")}
        ${kpi("Réalisation", st.obj ? Math.round(st.realisation) + "%" : "—", "", st.realisation >= 100 ? "c-ok" : st.realisation >= 70 ? "c-gold" : "c-warn")}
        ${kpi("Moyenne / jour", st.worked ? String(Math.round(st.ok.length / st.worked * 10) / 10).replace(".", ",") : "—")}
        ${kpi("KO", st.ko.length, st.ok.length + st.ko.length ? `Réussite ${Math.round(st.reussite)}%` : "", "c-ko")}
        ${kpi("En attente", st.attente.length, "", "c-wait")}
        ${kpi("Annulés", st.annule.length, "", "c-off")}
      </div>${k.zone || k.tech ? `<p class="small muted" style="margin:10px 0 0">L'objectif affiché est celui de toute l'équipe.</p>` : ""}</section>

    <section class="card"><div class="card-head"><h2>Installations par jour</h2><span class="small muted">${shown.length < days.length ? "31 derniers jours" : ""}</span></div>
      ${shown.length ? `<div class="bars">${shown.map(r => `<div class="bar" title="${fmtD(r.d)} : ${r.ok} OK / objectif ${r.obj}"><div class="b" style="height:${(Math.max(r.ok, r.obj ? 0 : .12) / maxBar * 100).toFixed(1)}%;background:${color(r.state)}"></div>${r.obj ? `<div class="tgt" style="bottom:${(r.obj / maxBar * 100).toFixed(1)}%"></div>` : ""}</div>`).join("")}</div>
        <div class="bars-x">${shown.map((r, i) => `<span>${i % step === 0 ? parseYmd(r.d).getDate() : ""}</span>`).join("")}</div>
        <div class="legend"><span><i style="background:var(--ok)"></i>Objectif atteint</span><span><i style="background:var(--warn)"></i>Sous l'objectif</span><span><i style="background:var(--ko)"></i>Aucune</span><span><i style="background:var(--wait)"></i>En cours</span><span><i style="background:var(--gold);height:2px"></i>Objectif du jour</span></div>`
        : `<p class="muted">La période commence plus tard.</p>`}</section>

    <section class="card"><div class="card-head"><h2>Temps d'installation</h2><span class="small muted">${nt} installation${nt > 1 ? "s" : ""} avec heures</span></div>
      <div class="grid4" style="margin-bottom:14px">
        ${kpi("Durée moyenne", fmtDur(st.avgDur), "", "sm num")}
        ${kpi("Excellent", nt ? Math.round(pct(st.tiers.excellent, nt)) + "%" : "—", `${st.tiers.excellent} ticket${st.tiers.excellent > 1 ? "s" : ""}`, "c-ok")}
        ${kpi("Dans l'objectif", nt ? Math.round(pct(st.tiers.objectif, nt)) + "%" : "—", `${st.tiers.objectif} ticket${st.tiers.objectif > 1 ? "s" : ""}`, "c-gold")}
        ${kpi("Hors objectif", nt ? Math.round(pct(st.tiers.hors, nt)) + "%" : "—", `${st.tiers.hors} ticket${st.tiers.hors > 1 ? "s" : ""}`, "c-warn")}
      </div>
      ${nt ? `<div class="stackbar" role="img" aria-label="Répartition des durées"><i style="width:${pct(st.tiers.excellent, nt)}%;background:var(--ok)"></i><i style="width:${pct(st.tiers.objectif, nt)}%;background:var(--gold)"></i><i style="width:${pct(st.tiers.hors, nt)}%;background:var(--warn)"></i></div>` : ""}
      ${st.noHours ? `<p class="small c-warn" style="margin:10px 0 0">${st.noHours} installation${st.noHours > 1 ? "s" : ""} sans heures : durée non comptée.</p>` : ""}</section>

    ${perf.length ? `<section class="card"><div class="card-head"><h2>Performance par ticket</h2><span class="small muted">Du plus long au plus court · traits = objectifs</span></div>
      ${perf.slice(0, 25).map(perfMini).join("")}${perf.length > 25 ? `<p class="small muted" style="margin:10px 0 0">25 plus longs sur ${perf.length}.</p>` : ""}</section>` : ""}

    <section class="card"><div class="card-head"><h2>Difficultés</h2><span class="small muted">Un ticket compte une fois par type</span></div>
      <div class="counters" style="margin-bottom:14px">${MAIN_DIFFS.map(d => { const n = st.diffs[d.k].length; return `<button class="counter ${n ? "hot" : ""}" type="button" data-act="diff-list" data-k="${d.k}" data-per="${k.per}"><span class="n num">${n}</span><span class="t">${esc(d.l)}</span></button>`; }).join("")}</div>
      <div class="small muted">Autres : Mauvaise Box ${st.diffs.BOX.length} · Autre imprévu ${st.diffs.AUTRE.length} · Poteaux demandés ${st.poteaux}</div></section>

    <section class="card"><div class="card-head"><h2>Installations par zone</h2><span class="small muted">${zs.length} zone${zs.length > 1 ? "s" : ""} actives</span></div>
      ${zs.length ? `<div class="tbl-wrap"><table><thead><tr><th>Zone</th><th class="n">OK</th><th class="n">KO</th><th class="n">Durée moy.</th><th class="n">Diff.</th><th>Évaluation</th></tr></thead><tbody>
        ${zs.map(z => `<tr><td><b>${esc(z.z.code)}</b><div class="small muted">${esc(z.z.quartiers || "")}</div></td><td class="n">${z.ok}</td><td class="n">${z.ko}</td><td class="n">${fmtDur(z.avg)}</td><td class="n">${z.nd}</td><td>${z.hard ? `<span class="badge b-warn">Difficile</span>` : z.avg != null ? `<span class="badge b-ok">Dans la cible</span>` : ""}</td></tr>`).join("")}
      </tbody></table></div>` : `<p class="muted">Aucun ticket sur la période.</p>`}</section>

    <section class="card"><div class="card-head"><h2>Sous-zones les plus difficiles</h2><span class="small muted">Classées par durée moyenne</span></div>
      ${subs.length ? `<div class="tbl-wrap"><table><thead><tr><th>Sous-zone</th><th class="n">OK</th><th class="n">Durée moy.</th><th class="n">Hors obj.</th><th class="n">KO</th><th class="n">Diff.</th></tr></thead><tbody>
        ${subs.map(s => `<tr><td><b>${esc(s.label)}</b>${s.hard ? ` <span class="badge b-warn">Difficile</span>` : ""}</td><td class="n">${s.ok}</td><td class="n">${fmtDur(s.avg)}</td><td class="n">${s.timed ? Math.round(s.horsPct) + "%" : "—"}</td><td class="n">${s.ko}</td><td class="n">${s.nd}</td></tr>`).join("")}
      </tbody></table></div><p class="small muted" style="margin:10px 0 0">Utile pour savoir quels tickets redemander au dispatch.</p>` : `<p class="muted">Renseignez la sous-zone à la saisie pour obtenir ce classement.</p>`}</section>

    <section class="card"><div class="card-head"><h2>Points à traiter</h2></div>
      <div class="alerts">${alerts(f).map(x => `<div class="alert ${x.n ? "on" : "off"}"><span>${esc(x.l)}</span><b>${x.n}</b></div>`).join("")}</div></section>

    <section class="card"><div class="card-head"><h2>Jour par jour</h2></div>
      <div class="tbl-wrap"><table><thead><tr><th>Date</th><th class="n">OK</th><th class="n">KO</th><th class="n">Obj.</th><th class="n">Écart</th><th class="n">Durée moy.</th><th>État</th></tr></thead><tbody>
      ${[...days].reverse().map(r => `<tr class="day-${r.state}"><td><b>${fmtDShort(r.d)}</b><div class="small muted">${JOURS[dow(r.d)]}</div></td><td class="n">${r.ok}</td><td class="n">${r.ko}</td><td class="n">${r.obj}</td><td class="n">${r.obj ? (r.ok - r.obj > 0 ? "+" : "") + (r.ok - r.obj) : "—"}</td><td class="n">${fmtDur(r.avg)}</td><td class="small">${r.obj ? DAY_STATE[r.state] : esc(r.info.type)}</td></tr>`).join("")}
      </tbody></table></div></section>
  </div>`;
}
function viewZones(){
  const zl = zones(), [a, b] = periodRange("mois"), counted = countedOk();
  const month = data().filter(t => t.date >= a && t.date <= b);
  const bySec = {}; zl.forEach(z => { (bySec[z.secteur] = bySec[z.secteur] || []).push(z); });
  return `<div class="stack">
    <section class="card"><div class="card-head"><div><h2>${zl.filter(z => z.actif !== false).length} zones actives</h2><p class="small muted" style="margin:4px 0 0">Touchez une zone pour voir et nommer ses sous-zones. Chiffres du mois de travail.</p></div>
      ${canZones() ? `<button class="btn btn-violet btn-sm" type="button" data-act="zone-new">+ Zone</button>` : ""}</div></section>
    <section class="card">${Object.entries(bySec).map(([sec, list]) => `<div class="sector"><h3>${esc(sec)}</h3>
      ${list.map(z => {
        const ts = month.filter(t => t.zone === z.code);
        const ok = ts.filter(t => t.statut === "OK" && counted.has(t.id)).length, ko = ts.filter(t => t.statut === "KO").length;
        const subs = subzonesOf(z.code), open = UI.openZone === z.id;
        return `<div class="zone"><button type="button" data-act="zone-toggle" data-id="${z.id}" aria-expanded="${open}">
          <span class="zcode">${esc(z.code)}</span>
          <span style="min-width:0"><span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(z.quartiers || "")}</span><span class="small muted">${subs.length} sous-zone${subs.length > 1 ? "s" : ""}${z.actif === false ? " · désactivée" : ""}</span></span>
          <span class="small num" style="text-align:right"><span class="c-ok">${ok} OK</span><br><span class="c-ko">${ko} KO</span></span></button>
          ${open ? `<div class="sub">
            ${subs.length ? subs.map(s => `<div class="sz"><span><b>${esc(z.code)}/${esc(s.code)}</b> ${esc(s.nom || "")}</span><span class="small muted num">${month.filter(t => t.zone === z.code && t.sousZone === s.code).length} ce mois${isChef() && !VIEW.demo ? ` · <button class="link" type="button" data-act="sz-edit" data-id="${s.id}">Renommer</button>` : ""}</span></div>`).join("") : `<p class="small muted" style="margin:0">Aucune sous-zone. Ajoutez-en une ici ou depuis la saisie d'un ticket.</p>`}
            <div class="btn-row">${isMember() && !VIEW.demo ? `<button class="btn btn-ghost btn-sm" type="button" data-act="sz-new" data-zone="${esc(z.code)}">+ Sous-zone</button>` : ""}${canZones() ? `<button class="btn btn-ghost btn-sm" type="button" data-act="zone-edit" data-id="${z.id}">Modifier la zone</button>` : ""}</div>
          </div>` : ""}</div>`;
      }).join("")}</div>`).join("")}</section></div>`;
}
function viewMenu(){
  const p = S.profile || {}, reps = [...DB.reports].sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0)), st = settings();
  const theme = (() => { try { return localStorage.getItem("mct:theme") || "dark"; } catch (e) { return "dark"; } })();
  const nPending = Object.values(DB.users).filter(u => u.role === "attente").length;
  return `<div class="stack">
    <section class="card" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
      <div class="avatar" style="width:52px;height:52px;font-size:18px;display:grid;place-items:center">${esc((p.nom || "?").trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase())}</div>
      <div style="flex:1 1 160px;min-width:0"><b>${esc(p.nom || "")}</b><div class="small muted">${esc(ROLES[p.role] || "")}${S.user && S.user.email ? " · " + esc(S.user.email) : ""}</div></div>
      ${S.mode === "firebase" ? `<button class="btn btn-ghost btn-sm" type="button" data-act="logout">Se déconnecter</button>` : ""}
    </section>
    ${installCard()}
    <section class="card"><div class="card-head"><h2>Rapport global PDF</h2></div>
      <div class="filters">${periodSelect("r-per", UI.rep.per)}${zoneSelect("r-zone", UI.rep.zone)}
      ${UI.rep.per === "perso" ? `<input type="date" id="r-a" data-bind="r-a" value="${UI.rep.a || today()}" aria-label="Du"><input type="date" id="r-b" data-bind="r-b" value="${UI.rep.b || today()}" aria-label="Au">` : ""}</div>
      <div class="btn-row" style="margin-top:12px"><button class="btn btn-primary" type="button" data-act="report-make">Générer le PDF</button></div>
      <p class="small muted" style="margin:10px 0 0">Chiffres clés, temps d'installation, difficultés, zones, sous-zones et détail jour par jour. Chaque rapport est archivé.</p>
      ${reps.length ? `<div class="sep" style="margin:14px 0 6px"></div><div class="list">${reps.slice(0, 20).map(r => `<button class="row" type="button" data-act="report-get" data-id="${r.id}"><span class="dot" style="background:var(--violet)"></span>
        <span class="main"><span class="t1">${esc(periodLabel(r.a, r.b))}${r.zone ? " · " + esc(r.zone) : ""}</span><span class="t2">Généré le ${new Date(r.createdAt).toLocaleDateString("fr-FR")} · ${esc(techName(r.authorId))}</span></span><span class="side"><span class="badge b-violet">PDF</span></span></button>`).join("")}</div>` : ""}
    </section>
    <section class="card"><div class="card-head"><h2>Export des tickets</h2></div>
      <div class="filters">${periodSelect("x-per", UI.xper, true)}</div>
      <div class="btn-row" style="margin-top:12px"><button class="btn btn-ghost" type="button" data-act="export-csv">Exporter en CSV (Excel)</button></div></section>
    ${isAdmin() && S.mode === "firebase" ? `<section class="card"><div class="card-head"><h2>Équipe</h2>${nPending ? `<span class="badge b-gold">${nPending} en attente</span>` : ""}</div>
      <button class="row" type="button" data-act="users"><span class="dot" style="background:var(--violet)"></span><span class="main"><span class="t1">Comptes et rôles</span><span class="t2">${Object.keys(DB.users).length} compte${Object.keys(DB.users).length > 1 ? "s" : ""} · valider les nouveaux comptes</span></span><span class="side">›</span></button></section>` : ""}
    <section class="card"><div class="card-head"><h2>Réglages</h2>${isAdmin() ? "" : `<span class="badge b-off">Lecture seule</span>`}</div>
      <div class="list">
        <button class="row" type="button" data-act="set-general"><span class="dot" style="background:var(--violet)"></span><span class="main"><span class="t1">Objectif et calendrier</span><span class="t2">${st.objectifJour} par jour · mois du ${st.jourDebutMois} au ${st.jourDebutMois - 1} · samedis ${+st.rythmeSamedi === 1 ? "tous travaillés" : "1 sur " + st.rythmeSamedi}</span></span><span class="side">›</span></button>
        <button class="row" type="button" data-act="set-durees"><span class="dot" style="background:var(--gold)"></span><span class="main"><span class="t1">Objectifs de durée</span><span class="t2">${st.objectifsDuree.length} objectif${st.objectifsDuree.length > 1 ? "s" : ""} · par type de ticket et par zone</span></span><span class="side">›</span></button>
        <button class="row" type="button" data-act="set-types"><span class="dot" style="background:var(--wait)"></span><span class="main"><span class="t1">Types de ticket</span><span class="t2">${esc(st.types.join(", "))}</span></span><span class="side">›</span></button>
        <button class="row" type="button" data-act="set-exc"><span class="dot" style="background:var(--warn)"></span><span class="main"><span class="t1">Jours fériés et congés</span><span class="t2">${st.exceptions.length} jour${st.exceptions.length > 1 ? "s" : ""} déclaré${st.exceptions.length > 1 ? "s" : ""}</span></span><span class="side">›</span></button>
      </div></section>
    <section class="card"><div class="card-head"><h2>Apparence</h2></div>
      <div class="seg" role="group" aria-label="Thème">${[["dark", "Sombre"], ["light", "Clair"], ["auto", "Automatique"]].map(([v, l]) => `<button type="button" data-act="theme" data-v="${v}" aria-pressed="${theme === v}">${l}</button>`).join("")}</div></section>
    <section class="card"><div class="card-head"><h2>Données</h2></div>
      <p class="small muted" style="margin:0 0 12px">${S.mode === "firebase" ? "Les tickets sont enregistrés dans Firebase et partagés avec l'équipe. Sans réseau, la saisie est gardée sur le téléphone puis envoyée au retour de la connexion." : "Firebase n'est pas configuré : les tickets restent sur ce téléphone. Suivez le guide README pour activer le partage."}</p>
      <div class="btn-row">${VIEW.demo ? `<button class="btn btn-ghost" type="button" data-act="demo-off">Quitter le mode exemple</button>` : `<button class="btn btn-ghost" type="button" data-act="demo-on">Voir avec des exemples</button>`}</div></section>
    <p class="small muted" style="text-align:center;margin:0">Mon Compteur de Ticket · KBOWD Group · version 1.0</p>
  </div>`;
}

/* ================= Feuilles ================= */
function openSheet(s){ UI.sheet = s; renderSheet(); }
function closeSheet(){ UI.sheet = null; $("#sheetRoot").innerHTML = ""; document.body.style.overflow = ""; }
function renderSheet(){
  const s = UI.sheet; if (!s) return;
  const root = $("#sheetRoot"), keep = root.querySelector(".sheet")?.scrollTop || 0;
  root.innerHTML = `<div class="sheet-bg" data-act="sheet-bg"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(s.title)}">
    <div class="sheet-head"><h2>${esc(s.title)}</h2><button class="x" type="button" data-act="close" aria-label="Fermer">×</button></div>${s.body()}</div></div>`;
  document.body.style.overflow = "hidden";
  root.querySelector(".sheet").scrollTop = keep;
  if (s.after) s.after(root);
}
function confirmSheet(title, text, label, fn){
  const prev = UI.sheet;
  openSheet({title, prev, onYes: fn, body: () => `<p>${esc(text)}</p><div class="btn-row" style="margin-top:16px"><button class="btn btn-ghost" type="button" data-act="confirm-no">Annuler</button><button class="btn btn-danger" type="button" data-act="confirm-yes">${esc(label)}</button></div>`});
}
function fail(err, msg, el){ err.textContent = msg; if (el) el.focus(); return false; }

function perfBlock(t, d){
  const tg = targetFor(t.type, t.zone), max = tg.objectif * 1.3;
  const p1 = tg.excellent / max * 100, p2 = tg.objectif / max * 100, tier = tierOf(d, tg), pos = Math.min(d / max, 1) * 100;
  const gap = tier === "excellent" ? `${fmtDur(tg.excellent - d).replace(/^00h/, "")} sous le seuil excellent` : tier === "objectif" ? `${fmtDur(tg.objectif - d).replace(/^00h/, "")} sous l'objectif` : `Objectif dépassé de ${fmtDur(d - tg.objectif).replace(/^00h/, "")}`;
  return `<div class="perf-wrap">
    <div class="perf-head"><div><div class="eyebrow">Compteur de performance</div><div class="perf-time ${TIER[tier].c}">${fmtDur(d)}</div></div><span class="level ${tier}">${TIER[tier].l}</span></div>
    <div class="perf" role="img" aria-label="Durée comparée aux objectifs"><span class="z" style="width:${p1}%;background:var(--ok-soft)"></span><span class="z" style="width:${p2 - p1}%;background:var(--gold-soft)"></span><span class="z" style="flex:1;background:var(--warn-soft)"></span>
      <span class="tick" style="left:${p1}%"></span><span class="tick" style="left:${p2}%"></span><span class="needle" style="left:${pos}%;background:${TIER[tier].col};box-shadow:0 0 12px ${TIER[tier].col}"></span></div>
    <div class="perf-marks"><span class="m" style="left:${p1}%"><b>${fmtDur(tg.excellent)}</b>Excellent</span><span class="m" style="left:${p2}%"><b>${fmtDur(tg.objectif)}</b>Objectif</span></div>
    <div class="small muted">${gap}</div></div>`;
}
function openTicket(id){
  openSheet({title: "Ticket", refresh: true, body: () => {
    const t = data().find(x => x.id === id);
    if (!t) return `<p class="muted">Ce ticket n'existe plus.</p>`;
    const s = STATUTS[t.statut] || STATUTS.ATTENTE, d = dur(t), ed = canEditTicket(t);
    const counted = t.statut !== "OK" || countedOk().has(t.id), z = zoneByCode(t.zone);
    return `<div class="stack">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="badge b-${s.c}">${esc(s.l)}</span>${!counted ? `<span class="badge b-warn">Doublon non compté</span>` : ""}${(t.difficultes || []).map(k => `<span class="badge b-violet">${esc(DIFF_L[k] || k)}</span>`).join("")}</div>
      ${d != null ? `<div class="card" style="padding:16px">${perfBlock(t, d)}</div>` : t.statut === "OK" ? `<p class="small c-warn" style="margin:0">Heures non renseignées : la durée ne compte pas dans les moyennes.</p>` : ""}
      <dl class="kv">
        <dt>Numéro</dt><dd>${esc(t.numero)}</dd><dt>Date</dt><dd>${fmtD(t.date)}</dd><dt>Client</dt><dd>${esc(t.client || "—")}</dd>
        <dt>Type</dt><dd>${esc(t.type || "—")}</dd><dt>Zone</dt><dd>${esc(t.zone)}${z ? ` <span class="muted small">${esc(z.quartiers)}</span>` : ""}</dd>
        <dt>Sous-zone</dt><dd>${t.sousZone ? esc(szLabel(t.zone, t.sousZone)) : "—"}</dd>
        <dt>Début</dt><dd class="num">${fmtHeure(t.debut)}</dd><dt>Fin</dt><dd class="num">${fmtHeure(t.fin)}</dd>
        ${(t.difficultes || []).includes("POTEAUX") ? `<dt>Poteaux</dt><dd>${+t.poteaux || 0}</dd>` : ""}
        <dt>Technicien</dt><dd>${esc(techName(t.techId))}</dd>
        ${t.obs ? `<dt>Observation</dt><dd>${esc(t.obs)}</dd>` : ""}
      </dl>
      ${ed ? `<div class="btn-row"><button class="btn btn-violet" type="button" data-act="edit" data-id="${t.id}">Modifier</button><button class="btn btn-danger" type="button" data-act="delete" data-id="${t.id}">Supprimer</button></div>` : `<p class="small muted" style="margin:0">Seuls l'auteur du ticket et les chefs d'équipe peuvent le modifier.</p>`}
    </div>`;
  }});
}

/* ----- Saisie d'un ticket ----- */
function ticketForm(existing){
  if (!VIEW.demo && !isMember()){ toast("Votre compte n'est pas encore validé."); return; }
  const st = settings();
  const t = existing ? clean(existing) : {numero: "", date: today(), client: "", type: st.types[0], zone: "", sousZone: "", statut: "OK", difficultes: [], poteaux: 0, obs: "", debut: "", fin: ""};
  const isNew = !existing;
  openSheet({title: isNew ? "Nouveau ticket" : `Modifier ${t.numero}`, body: () => `
    <form id="tform" class="stack" novalidate>
      <div class="form-grid">
        <label class="field"><span>Numéro du ticket *</span><input type="text" id="f-num" name="numero" value="${esc(t.numero)}" autocomplete="off" required></label>
        <label class="field"><span>Date de traitement *</span><input type="date" id="f-date" name="date" value="${esc(t.date)}" required></label>
        <label class="field"><span>Nom du client</span><input type="text" id="f-client" name="client" value="${esc(t.client)}"></label>
        <label class="field"><span>Type de ticket</span><select id="f-type" name="ttype">${st.types.map(x => `<option ${x === t.type ? "selected" : ""}>${esc(x)}</option>`).join("")}${t.type && !st.types.includes(t.type) ? `<option selected>${esc(t.type)}</option>` : ""}</select></label>
        <label class="field"><span>Zone *</span><select id="f-zone" name="zone" required><option value="">Choisir…</option>${[...new Set(zones().map(z => z.secteur))].map(sec => `<optgroup label="${esc(sec)}">${zones().filter(z => z.secteur === sec && (z.actif !== false || z.code === t.zone)).map(z => `<option value="${esc(z.code)}" ${z.code === t.zone ? "selected" : ""}>${esc(z.code)} · ${esc(z.quartiers)}</option>`).join("")}</optgroup>`).join("")}</select></label>
        <label class="field"><span>Sous-zone</span><select id="f-sz" name="sousZone">${szOptions(t.zone, t.sousZone)}</select></label>
        <div class="full form-grid" id="f-newsz" hidden>
          <label class="field"><span>Code de la sous-zone *</span><input type="text" id="f-szcode" placeholder="ex. 2" autocomplete="off"></label>
          <label class="field"><span>Nom de la sous-zone</span><input type="text" id="f-sznom" placeholder="ex. Camp commando nord"></label>
        </div>
      </div>
      <div class="field"><span>Statut *</span><div class="statuts">${Object.entries(STATUTS).map(([k, s]) => `<label class="chip ${s.c}"><input type="radio" name="statut" value="${k}" ${t.statut === k ? "checked" : ""}><span>${esc(s.s)}</span></label>`).join("")}</div></div>
      <div class="form-grid">
        <label class="field"><span>Heure de début</span><input type="time" step="1" id="f-deb" name="debut" value="${esc(t.debut)}"></label>
        <label class="field"><span>Heure de fin</span><input type="time" step="1" id="f-fin" name="fin" value="${esc(t.fin)}"></label>
      </div>
      <div id="f-perf">${perfPreview(t.debut, t.fin, t.type, t.zone)}</div>
      <div class="field"><span>Difficultés <small>(une ou plusieurs)</small></span><div class="chips">${DIFFS.map(d => `<label class="chip" title="${esc(d.hint || "")}"><input type="checkbox" name="diff" value="${d.k}" ${(t.difficultes || []).includes(d.k) ? "checked" : ""}><span>${esc(d.l)}</span></label>`).join("")}</div>
        <small>ID affecté : client affecté à un autre OTB. Mauvaise adresse non traitée : rapport de mauvaise adresse, installation non faite.</small></div>
      <label class="field" id="f-potwrap" ${(t.difficultes || []).includes("POTEAUX") ? "" : "hidden"}><span>Nombre de poteaux nécessaires</span><input type="number" min="0" step="1" id="f-pot" name="poteaux" value="${+t.poteaux || 0}"></label>
      <label class="field"><span>Observation</span><textarea id="f-obs" name="obs">${esc(t.obs)}</textarea></label>
      <div class="err" id="f-err" role="alert"></div>
      <button class="btn btn-primary btn-block" type="submit">Enregistrer le ticket</button>
    </form>`,
    after: root => {
      const form = root.querySelector("#tform");
      const upd = e => {
        const id = e.target.id;
        if (id === "f-zone"){ form.sousZone.innerHTML = szOptions(form.zone.value, ""); form.querySelector("#f-newsz").hidden = true; }
        if (id === "f-sz") form.querySelector("#f-newsz").hidden = form.sousZone.value !== "__new";
        if (e.target.name === "diff") form.querySelector("#f-potwrap").hidden = !form.querySelector("input[name=diff][value=POTEAUX]").checked;
        form.querySelector("#f-perf").innerHTML = perfPreview(form.debut.value, form.fin.value, form.ttype.value, form.zone.value);
      };
      form.addEventListener("change", upd);
      form.addEventListener("input", e => { if (e.target.type === "time") upd(e); });
      form.addEventListener("submit", e => { e.preventDefault(); submitTicket(form, existing); });
    }});
}
function szOptions(zone, cur){
  if (!zone) return `<option value="">Choisissez d'abord la zone</option>`;
  const subs = subzonesOf(zone);
  return `<option value="">Aucune</option>${subs.map(s => `<option value="${esc(s.code)}" ${s.code === cur ? "selected" : ""}>${esc(zone)}/${esc(s.code)}${s.nom ? " · " + esc(s.nom) : ""}</option>`).join("")}
    ${cur && !subs.some(s => s.code === cur) ? `<option value="${esc(cur)}" selected>${esc(zone)}/${esc(cur)}</option>` : ""}<option value="__new">+ Nouvelle sous-zone…</option>`;
}
function perfPreview(deb, fin, type, zone){
  if (!deb || !fin) return `<p class="small muted" style="margin:0">Saisissez l'heure de début et l'heure de fin (secondes comprises) pour calculer la durée et le niveau de performance.</p>`;
  const a = parseHMS(deb), b = parseHMS(fin);
  if (b < a) return `<p class="err" style="margin:0">L'heure de fin est avant l'heure de début.</p>`;
  return `<div class="card" style="padding:14px;box-shadow:none">${perfBlock({type, zone}, b - a)}</div>`;
}
function submitTicket(form, existing){
  const err = form.querySelector("#f-err");
  const numero = form.numero.value.trim(), date = form.date.value, zone = form.zone.value;
  const statut = (form.querySelector("input[name=statut]:checked") || {}).value;
  const diffs = [...form.querySelectorAll("input[name=diff]:checked")].map(i => i.value);
  let sousZone = form.sousZone.value;
  if (!numero) return fail(err, "Saisissez le numéro du ticket.", form.numero);
  if (!date) return fail(err, "Saisissez la date de traitement.", form.date);
  if (!zone) return fail(err, "Choisissez la zone.", form.zone);
  if (!statut) return fail(err, "Choisissez le statut.");
  if (statut === "KO" && !diffs.length) return fail(err, "Un KO doit avoir au moins une difficulté.");
  if (diffs.includes("AUTRE") && !form.obs.value.trim()) return fail(err, "Décrivez l'« autre imprévu » dans l'observation.", form.obs);
  const deb = form.debut.value, fin = form.fin.value;
  if (deb && fin && parseHMS(fin) < parseHMS(deb)) return fail(err, "L'heure de fin est avant l'heure de début.", form.fin);
  let newSz = null;
  if (sousZone === "__new"){
    const code = form.querySelector("#f-szcode").value.trim();
    if (!code) return fail(err, "Saisissez le code de la nouvelle sous-zone.", form.querySelector("#f-szcode"));
    sousZone = code;
    if (!subzonesOf(zone).some(s => s.code === code)) newSz = {id: slug(zone) + "__" + slug(code), zone, code, nom: form.querySelector("#f-sznom").value.trim(), actif: true, createdAt: Date.now()};
  }
  const k = nkey(numero);
  const blocking = data().filter(x => nkey(x.numero) === k && (!existing || x.id !== existing.id) && (x.statut !== "KO" || statut !== "OK"));
  if (blocking.length){
    const o = blocking[0];
    err.innerHTML = `Le ticket ${esc(numero)} existe déjà (${esc(STATUTS[o.statut]?.l || o.statut)}, ${fmtD(o.date)}). <button class="link" type="button" data-act="open" data-id="${o.id}">Ouvrir ce ticket</button>`;
    return;
  }
  const now = Date.now();
  const t = Object.assign(existing ? clean(existing) : {id: uid("t"), createdAt: now, techId: myId()}, {
    numero, date, client: form.client.value.trim(), type: form.ttype.value, zone, sousZone, statut, difficultes: diffs,
    poteaux: diffs.includes("POTEAUX") ? Math.max(0, parseInt(form.poteaux.value || "0", 10) || 0) : 0,
    obs: form.obs.value.trim(), debut: deb, fin, updatedAt: now,
  });
  if (newSz && !VIEW.demo) put("subzones", newSz);
  if (!put("tickets", t)) return;
  const d = dur(t);
  toast(d != null ? `Ticket enregistré · ${fmtDur(d)} · ${TIER[tierOf(d, targetFor(t.type, t.zone))].l}` : statut === "OK" ? "Enregistré. Heures manquantes : la durée ne comptera pas." : "Ticket enregistré.");
  closeSheet();
}

/* ----- Zones ----- */
function zoneForm(z){
  const secteurs = [...new Set(zones().map(x => x.secteur))];
  openSheet({title: z ? `Modifier ${z.code}` : "Nouvelle zone", body: () => `<form id="zform" class="stack" novalidate>
    <div class="form-grid">
      <label class="field"><span>Code de la zone *</span><input type="text" id="z-code" name="code" value="${esc(z ? z.code : "")}" ${z ? "readonly" : ""} placeholder="ex. YOP 20" autocomplete="off"></label>
      <label class="field"><span>Secteur *</span><input type="text" id="z-sec" name="secteur" list="z-secs" value="${esc(z ? z.secteur : "")}" placeholder="ex. YOP" autocomplete="off"><datalist id="z-secs">${secteurs.map(s => `<option value="${esc(s)}">`).join("")}</datalist></label>
      <label class="field full"><span>Quartiers couverts</span><input type="text" id="z-q" name="quartiers" value="${esc(z ? z.quartiers : "")}" placeholder="ex. Niangon sud, Lokoa"></label>
      ${z ? `<label class="chip full"><input type="checkbox" id="z-actif" name="actif" ${z.actif !== false ? "checked" : ""}><span>Zone active (proposée à la saisie)</span></label>` : ""}
    </div>
    ${z ? `<p class="small muted" style="margin:0">Le code ne change pas, pour garder l'historique. Désactivez la zone pour ne plus la proposer.</p>` : ""}
    <div class="err" id="z-err" role="alert"></div><button class="btn btn-primary" type="submit">Enregistrer la zone</button></form>`,
    after: root => root.querySelector("#zform").addEventListener("submit", e => {
      e.preventDefault(); const f = e.target, err = f.querySelector("#z-err");
      const code = f.code.value.trim().replace(/\s+/g, " ").toUpperCase(), secteur = f.secteur.value.trim().toUpperCase();
      if (!code) return fail(err, "Saisissez le code de la zone.", f.code);
      if (!secteur) return fail(err, "Saisissez le secteur.", f.secteur);
      if (!z && zones().some(x => x.code === code)) return fail(err, `La zone ${code} existe déjà.`, f.code);
      const item = Object.assign(z ? clean(z) : {id: slug(code), code, ordre: 1000 + zones().length, createdAt: Date.now()}, {secteur, quartiers: f.quartiers.value.trim(), actif: z ? f.actif.checked : true});
      if (put("zones", item)){ toast(z ? "Zone modifiée." : `Zone ${code} ajoutée.`); UI.openZone = item.id; closeSheet(); }
    })});
}
function subzoneForm(zone, s){
  openSheet({title: s ? `Renommer ${zone}/${s.code}` : `Nouvelle sous-zone · ${zone}`, body: () => `<form id="sform" class="stack" novalidate>
    <div class="form-grid">
      <label class="field"><span>Code *</span><input type="text" id="s-code" name="code" value="${esc(s ? s.code : "")}" ${s ? "readonly" : ""} placeholder="ex. 2" autocomplete="off"></label>
      <label class="field"><span>Nom</span><input type="text" id="s-nom" name="nom" value="${esc(s ? s.nom : "")}" placeholder="ex. Camp commando nord"></label>
    </div><div class="err" id="s-err" role="alert"></div><button class="btn btn-primary" type="submit">Enregistrer</button></form>`,
    after: root => root.querySelector("#sform").addEventListener("submit", e => {
      e.preventDefault(); const f = e.target, err = f.querySelector("#s-err"), code = f.code.value.trim();
      if (!code) return fail(err, "Saisissez le code de la sous-zone.", f.code);
      if (!s && subzonesOf(zone).some(x => x.code === code)) return fail(err, `La sous-zone ${zone}/${code} existe déjà.`, f.code);
      const item = Object.assign(s ? clean(s) : {id: slug(zone) + "__" + slug(code), zone, code, actif: true, createdAt: Date.now()}, {nom: f.nom.value.trim()});
      if (put("subzones", item)){ toast("Sous-zone enregistrée."); closeSheet(); }
    })});
}

/* ----- Équipe (admin) ----- */
function usersSheet(){
  openSheet({title: "Comptes et rôles", refresh: true, body: () => {
    const list = Object.values(DB.users).sort((a, b) => (a.role === "attente" ? 0 : 1) - (b.role === "attente" ? 0 : 1) || String(a.nom).localeCompare(String(b.nom), "fr"));
    return `<div class="stack"><p class="small muted" style="margin:0">Technicien : saisit ses tickets. Chef d'équipe : modifie tous les tickets et gère les zones. Administrateur : réglages et comptes.</p>
      <div class="list">${list.map(u => `<div class="row" style="grid-template-columns:1fr auto;cursor:default"><span class="main"><span class="t1">${esc(u.nom || "Sans nom")}${u.uid === myId() ? " (vous)" : ""}</span><span class="t2">${esc(u.email || "")}</span></span>
        <select data-act="user-role" data-id="${esc(u.uid)}" aria-label="Rôle de ${esc(u.nom || "")}" style="width:auto;min-height:38px" ${u.uid === myId() ? "disabled" : ""}>${Object.entries(ROLES).map(([k, l]) => `<option value="${k}" ${u.role === k ? "selected" : ""}>${k === "attente" ? "En attente" : l}</option>`).join("")}</select></div>`).join("")}</div></div>`;
  }});
}

/* ----- Réglages ----- */
function guard(err){ if (VIEW.demo){ err.textContent = "Quittez le mode exemple pour enregistrer."; return false; } if (!isAdmin()){ err.textContent = "Seuls les administrateurs modifient les réglages."; return false; } return true; }
function setGeneral(){
  const st = settings();
  openSheet({title: "Objectif et calendrier", body: () => `<form id="gform" class="stack" novalidate>
    <div class="form-grid">
      <label class="field"><span>Objectif journalier</span><input type="number" min="0" step="1" name="objectifJour" value="${st.objectifJour}"><small>Installations réussies par jour travaillé</small></label>
      <label class="field"><span>Début du mois de travail</span><input type="number" min="1" max="28" name="jourDebutMois" value="${st.jourDebutMois}"><small>17 = du 17 au 16 du mois suivant</small></label>
      <label class="field"><span>Premier samedi travaillé</span><input type="date" name="premierSamedi" value="${st.premierSamedi}"></label>
      <label class="field"><span>Samedis travaillés</span><select name="rythmeSamedi">${[1, 2, 3, 4].map(n => `<option value="${n}" ${+st.rythmeSamedi === n ? "selected" : ""}>${n === 1 ? "Tous les samedis" : "Un samedi sur " + n}</option>`).join("")}</select></label>
      <label class="field"><span>Alerte : KO par zone</span><input type="number" min="1" step="1" name="seuilKoZone" value="${st.seuilKoZone}"></label>
      <label class="field"><span>Début du suivi</span><input type="date" name="debutSuivi" value="${st.debutSuivi || ""}"><small>Avant cette date, pas d'objectif. Vide : date du premier ticket.</small></label>
    </div><p class="small muted" style="margin:0">Le dimanche n'est jamais travaillé. Les jours non travaillés ne comptent pas dans l'objectif.</p>
    <div class="err" id="g-err" role="alert"></div><button class="btn btn-primary" type="submit" ${isAdmin() ? "" : "disabled"}>Enregistrer</button></form>`,
    after: root => root.querySelector("#gform").addEventListener("submit", e => {
      e.preventDefault(); const f = e.target, err = f.querySelector("#g-err"); if (!guard(err)) return;
      const jd = parseInt(f.jourDebutMois.value, 10);
      if (!(jd >= 1 && jd <= 28)) return fail(err, "Le jour de début doit être entre 1 et 28.", f.jourDebutMois);
      if (!f.premierSamedi.value || dow(f.premierSamedi.value) !== 6) return fail(err, "Choisissez une date qui tombe un samedi.", f.premierSamedi);
      if (putSettings(Object.assign(clean(settings()), {objectifJour: Math.max(0, parseInt(f.objectifJour.value, 10) || 0), jourDebutMois: jd, premierSamedi: f.premierSamedi.value,
        rythmeSamedi: parseInt(f.rythmeSamedi.value, 10), seuilKoZone: Math.max(1, parseInt(f.seuilKoZone.value, 10) || 5), debutSuivi: f.debutSuivi.value || ""}))){ toast("Réglages enregistrés."); closeSheet(); }
    })});
}
function setTypes(){
  const draft = {types: [...settings().types]};
  openSheet({title: "Types de ticket", draft, body: () => `<div class="stack"><p class="small muted" style="margin:0">Chaque type peut avoir ses propres objectifs de durée.</p>
    <div class="list">${draft.types.map((x, i) => `<div class="row" style="grid-template-columns:1fr auto;cursor:default"><span class="t1">${esc(x)}</span>${draft.types.length > 1 ? `<button class="link" type="button" data-act="type-del" data-i="${i}" style="color:var(--ko)">Retirer</button>` : ""}</div>`).join("")}</div>
    <div class="inline-form"><label class="field"><span>Nouveau type</span><input type="text" id="ty-new" placeholder="ex. Installation MDU"></label><button class="btn btn-ghost btn-sm" type="button" data-act="type-add">Ajouter</button></div>
    <div class="err" id="ty-err" role="alert"></div><button class="btn btn-primary" type="button" data-act="types-save" ${isAdmin() ? "" : "disabled"}>Enregistrer</button></div>`});
}
function setDurees(){
  const draft = {list: clean(settings().objectifsDuree)};
  openSheet({title: "Objectifs de durée", draft, body: () => `<div class="stack">
    <p class="small muted" style="margin:0">L'objectif le plus précis s'applique : type et zone, puis type, puis zone, puis objectif général. Durées en heures:minutes:secondes.</p>
    ${draft.list.map((o, i) => { const gen = !o.type && !o.zone && i === 0; return `<div class="card" style="padding:14px;box-shadow:none"><div class="form-grid">
      <label class="field"><span>Type de ticket</span><select data-dur="${i}" data-f="type" ${gen ? "disabled" : ""}><option value="">Tous les types</option>${settings().types.map(x => `<option ${x === o.type ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></label>
      <label class="field"><span>Zone</span><select data-dur="${i}" data-f="zone" ${gen ? "disabled" : ""}><option value="">Toutes les zones</option>${zones().map(z => `<option value="${esc(z.code)}" ${z.code === o.zone ? "selected" : ""}>${esc(z.code)}</option>`).join("")}</select></label>
      <label class="field"><span>Excellent jusqu'à</span><input type="time" step="1" data-dur="${i}" data-f="excellent" value="${secToHMS(o.excellent)}"></label>
      <label class="field"><span>Objectif jusqu'à</span><input type="time" step="1" data-dur="${i}" data-f="objectif" value="${secToHMS(o.objectif)}"></label>
    </div>${gen ? `<p class="small muted" style="margin:8px 0 0">Objectif général, utilisé quand aucun autre ne correspond.</p>` : `<button class="link" type="button" data-act="dur-del" data-i="${i}" style="color:var(--ko);margin-top:6px">Retirer cet objectif</button>`}</div>`; }).join("")}
    <button class="btn btn-ghost" type="button" data-act="dur-add">+ Objectif par type ou par zone</button>
    <div class="err" id="du-err" role="alert"></div><button class="btn btn-primary" type="button" data-act="dur-save" ${isAdmin() ? "" : "disabled"}>Enregistrer</button></div>`,
    after: root => root.querySelectorAll("[data-dur]").forEach(el => el.addEventListener("change", () => {
      const o = draft.list[+el.dataset.dur], f = el.dataset.f; o[f] = f === "excellent" || f === "objectif" ? (parseHMS(el.value) ?? o[f]) : el.value;
    }))});
}
function setExceptions(){
  const draft = {list: clean(settings().exceptions).sort((a, b) => a.date.localeCompare(b.date))};
  openSheet({title: "Jours fériés et congés", draft, body: () => `<div class="stack">
    ${draft.list.length ? `<div class="list">${draft.list.map((e, i) => `<div class="row" style="grid-template-columns:1fr auto;cursor:default"><span class="main"><span class="t1">${fmtD(e.date)} · ${esc(EXC_TYPES[e.type] || e.type)}</span><span class="t2">${esc(e.motif || "")}</span></span><button class="link" type="button" data-act="exc-del" data-i="${i}" style="color:var(--ko)">Retirer</button></div>`).join("")}</div>` : `<p class="muted" style="margin:0">Aucun jour déclaré.</p>`}
    <div class="inline-form"><label class="field"><span>Date</span><input type="date" id="e-date"></label>
      <label class="field"><span>Type</span><select id="e-type">${Object.entries(EXC_TYPES).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></label>
      <label class="field" style="grid-column:1/-1"><span>Motif</span><input type="text" id="e-motif" placeholder="ex. Fête de l'Indépendance"></label>
      <button class="btn btn-ghost btn-sm" type="button" data-act="exc-add">Ajouter</button></div>
    <div class="err" id="ex-err" role="alert"></div><button class="btn btn-primary" type="button" data-act="exc-save" ${isAdmin() ? "" : "disabled"}>Enregistrer</button></div>`});
}

/* ================= Rapport et export ================= */
function snapshot(a, b, zone){
  const f = {a, b, zone, tech: ""}, st = stats(f), byType = {};
  st.timed.forEach(t => { (byType[t.type || "—"] = byType[t.type || "—"] || []).push(t); });
  return {a, b, zone: zone || "", createdAt: Date.now(), authorId: myId(), objectifJour: settings().objectifJour,
    kpi: {ok: st.ok.length, obj: st.obj, ecart: st.ecart, realisation: st.realisation, worked: st.worked, ko: st.ko.length, attente: st.attente.length, annule: st.annule.length, reussite: st.reussite, poteaux: st.poteaux},
    temps: {avg: st.avgDur, timed: st.timed.length, tiers: st.tiers, noHours: st.noHours,
      byType: Object.entries(byType).map(([k, ts]) => { const g = {excellent: 0, objectif: 0, hors: 0}; ts.forEach(t => g[tierOf(dur(t), targetFor(t.type, t.zone))]++); return {type: k, n: ts.length, avg: ts.reduce((s, t) => s + dur(t), 0) / ts.length, ...g}; })},
    diffs: DIFFS.map(d => ({k: d.k, l: d.l, n: st.diffs[d.k].length})),
    days: byDay(f).map(r => ({d: r.d, ok: r.ok, ko: r.ko, obj: r.obj, state: r.state, type: r.info.type, avg: r.avg})),
    zones: zoneStats(f).filter(z => z.any && (!zone || z.z.code === zone)).sort((x, y) => y.ok - x.ok).map(z => ({code: z.z.code, quartiers: z.z.quartiers || "", ok: z.ok, ko: z.ko, avg: z.avg, nd: z.nd, hard: z.hard})),
    subzones: subzoneStats(f).slice(0, 40).map(s => ({label: s.label, ok: s.ok, avg: s.avg, horsPct: s.horsPct, timed: s.timed, ko: s.ko, nd: s.nd, hard: s.hard})),
    alerts: alerts(f).map(x => ({l: x.l, n: x.n}))};
}
async function reportPdf(r){
  try {
    const blob = await makePdf(r, techName(r.authorId).replace(" (vous)", ""));
    await deliverFile(blob, `rapport-compteur-ticket_${r.a}_${r.b}${r.zone ? "_" + slug(r.zone) : ""}.pdf`);
    toast("Rapport PDF prêt.");
  } catch (e) { console.warn(e); toast("Impossible de créer le PDF. Vérifiez la connexion internet (premier usage)."); }
}
async function makeReport(){
  const [a, b] = periodRange(UI.rep.per, UI.rep.a, UI.rep.b);
  const r = snapshot(a, b, UI.rep.zone);
  if (!VIEW.demo && isMember()){ r.id = uid("r"); put("reports", r); }
  await reportPdf(r);
}
async function exportCsv(){
  const [a, b] = periodRange(UI.xper);
  const list = data().filter(t => t.date >= a && t.date <= b).sort((x, y) => x.date.localeCompare(y.date));
  if (!list.length){ toast("Aucun ticket sur cette période."); return; }
  const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["Date", "Numéro", "Client", "Type", "Zone", "Sous-zone", "Nom sous-zone", "Statut", "Difficultés", "Poteaux", "Heure début", "Heure fin", "Durée", "Durée (s)", "Performance", "Compté", "Technicien", "Observation"];
  const rows = list.map(t => { const d = dur(t), tier = t.statut === "OK" ? tierOf(d, targetFor(t.type, t.zone)) : null, sz = DB.subzones.find(s => s.zone === t.zone && s.code === t.sousZone);
    return [fmtD(t.date), t.numero, t.client, t.type, t.zone, t.sousZone, sz ? sz.nom : "", STATUTS[t.statut]?.l || t.statut, (t.difficultes || []).map(k => DIFF_L[k] || k).join(" + "), t.poteaux || "",
      t.debut ? fmtHeure(t.debut) : "", t.fin ? fmtHeure(t.fin) : "", d != null ? fmtDur(d) : "", d != null ? d : "", tier ? TIER[tier].l : "", t.statut === "OK" ? (countedOk().has(t.id) ? "oui" : "doublon") : "", techName(t.techId), t.obs]; });
  const csv = "﻿" + [head, ...rows].map(r => r.map(q).join(";")).join("\r\n");
  await deliverFile(new Blob([csv], {type: "text/csv;charset=utf-8"}), `tickets_${a}_${b}.csv`);
  toast(`${list.length} tickets exportés.`);
}

/* ================= Interactions ================= */
let toastT = null;
function toast(m){ const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3800); }
function goTab(v){ UI.tab = v; rememberUI(); closeSheet(); render(); window.scrollTo(0, 0); }
function setDemo(on){ VIEW.demo = on; if (on && !VIEW.demoTickets.length) VIEW.demoTickets = makeDemo(); invalidate(); closeSheet(); render(); }
function applyTheme(v){ try { localStorage.setItem("mct:theme", v); } catch (e) {} if (v === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", v); render(); }

document.addEventListener("click", async e => {
  const auth = e.target.closest("[data-auth]"); if (auth){ UI.authTab = auth.dataset.auth; showAuth(); return; }
  const tab = e.target.closest("[data-tab]"); if (tab){ goTab(tab.dataset.tab); return; }
  const el = e.target.closest("[data-act]"); if (!el) return;
  const act = el.dataset.act, id = el.dataset.id, s = UI.sheet;
  switch (act){
    case "sheet-bg": if (e.target === el) closeSheet(); break;
    case "close": closeSheet(); break;
    case "tab": goTab(el.dataset.v); break;
    case "scope": UI.homeScope = el.dataset.v; rememberUI(); render(); break;
    case "new-ticket": ticketForm(null); break;
    case "open": openTicket(id); break;
    case "edit": { const t = data().find(x => x.id === id); if (t && canEditTicket(t)) ticketForm(t); break; }
    case "delete": { const t = data().find(x => x.id === id); if (!t) return;
      confirmSheet("Supprimer ce ticket ?", `Le ticket ${t.numero} sera supprimé pour toute l'équipe.`, "Supprimer", () => { del("tickets", id); toast("Ticket supprimé."); closeSheet(); }); break; }
    case "confirm-no": if (s && s.prev) openSheet(s.prev); else closeSheet(); break;
    case "confirm-yes": if (s && s.onYes) s.onYes(); break;
    case "diff-list": UI.tk = {q: "", per: el.dataset.per === "jour" ? "jour" : (PERIODS[el.dataset.per] ? el.dataset.per : "mois"), statut: "", zone: "", diff: el.dataset.k}; goTab("tickets"); break;
    case "zone-toggle": UI.openZone = UI.openZone === id ? null : id; render(); break;
    case "zone-new": if (canZones()) zoneForm(null); break;
    case "zone-edit": { const z = zones().find(x => x.id === id); if (z && canZones()) zoneForm(z); break; }
    case "sz-new": subzoneForm(el.dataset.zone, null); break;
    case "sz-edit": { const sz = DB.subzones.find(x => x.id === id); if (sz) subzoneForm(sz.zone, sz); break; }
    case "users": usersSheet(); break;
    case "set-general": setGeneral(); break;
    case "set-types": setTypes(); break;
    case "set-durees": setDurees(); break;
    case "set-exc": setExceptions(); break;
    case "type-add": { const v = $("#ty-new").value.trim(); if (v && !s.draft.types.includes(v)) s.draft.types.push(v); renderSheet(); break; }
    case "type-del": s.draft.types.splice(+el.dataset.i, 1); renderSheet(); break;
    case "types-save": { const err = $("#ty-err"); if (!guard(err)) return; if (putSettings(Object.assign(clean(settings()), {types: s.draft.types}))){ toast("Types enregistrés."); closeSheet(); } break; }
    case "dur-add": s.draft.list.push({id: uid("o"), type: settings().types[0], zone: "", excellent: 7200, objectif: 10800}); renderSheet(); break;
    case "dur-del": s.draft.list.splice(+el.dataset.i, 1); renderSheet(); break;
    case "dur-save": { const err = $("#du-err"); if (!guard(err)) return;
      if (s.draft.list.some(o => !(o.excellent > 0 && o.objectif > 0 && o.excellent <= o.objectif))) return fail(err, "« Excellent » doit être inférieur ou égal à « Objectif ».");
      const keys = s.draft.list.map(o => (o.type || "") + "|" + (o.zone || "")); if (new Set(keys).size !== keys.length) return fail(err, "Deux objectifs portent sur le même type et la même zone.");
      if (putSettings(Object.assign(clean(settings()), {objectifsDuree: s.draft.list}))){ toast("Objectifs de durée enregistrés."); closeSheet(); } break; }
    case "exc-add": { const d = $("#e-date").value; if (!d) return fail($("#ex-err"), "Choisissez une date.");
      s.draft.list = s.draft.list.filter(x => x.date !== d); s.draft.list.push({date: d, type: $("#e-type").value, motif: $("#e-motif").value.trim()}); s.draft.list.sort((a, b) => a.date.localeCompare(b.date)); renderSheet(); break; }
    case "exc-del": s.draft.list.splice(+el.dataset.i, 1); renderSheet(); break;
    case "exc-save": { const err = $("#ex-err"); if (!guard(err)) return; if (putSettings(Object.assign(clean(settings()), {exceptions: s.draft.list}))){ toast("Calendrier enregistré."); closeSheet(); } break; }
    case "report-make": el.disabled = true; el.textContent = "Préparation…"; try { await makeReport(); } finally { el.disabled = false; el.textContent = "Générer le PDF"; } break;
    case "report-get": { const r = DB.reports.find(x => x.id === id); if (r) await reportPdf(r); break; }
    case "export-csv": await exportCsv(); break;
    case "demo-on": setDemo(true); break;
    case "demo-off": setDemo(false); break;
    case "theme": applyTheme(el.dataset.v); break;
    case "install": if (S.installEvt){ S.installEvt.prompt(); try { await S.installEvt.userChoice; } catch (x) {} S.installEvt = null; render(); } break;
    case "logout": VIEW.demo = false; S.subscribed = false; closeSheet(); await S.store.signOut(); break;
  }
});
document.addEventListener("change", e => {
  const el = e.target;
  if (el.dataset.act === "user-role"){
    const u = DB.users[el.dataset.id]; if (!u || !isAdmin()) return;
    S.store.setUser(u.uid, {role: el.value}).then(() => toast(`${u.nom || "Compte"} : ${ROLES[el.value]}.`)).catch(writeErr);
    return;
  }
  const b = el.dataset.bind; if (!b) return;
  const map = {"tk-per": ["tk", "per"], "tk-statut": ["tk", "statut"], "tk-zone": ["tk", "zone"], "tk-diff": ["tk", "diff"],
    "d-per": ["dash", "per"], "d-zone": ["dash", "zone"], "d-tech": ["dash", "tech"], "d-a": ["dash", "a"], "d-b": ["dash", "b"],
    "r-per": ["rep", "per"], "r-zone": ["rep", "zone"], "r-a": ["rep", "a"], "r-b": ["rep", "b"]};
  if (b === "x-per"){ UI.xper = el.value; return; }
  if (map[b]){ UI[map[b][0]][map[b][1]] = el.value; render(); }
});
let searchT = null;
document.addEventListener("input", e => {
  if (e.target.dataset.bind !== "tk-q") return;
  UI.tk.q = e.target.value; clearTimeout(searchT);
  searchT = setTimeout(() => { const pos = e.target.selectionStart; render(); const i = $("#tk-q"); if (i){ i.focus(); try { i.setSelectionRange(pos, pos); } catch (x) {} } }, 250);
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && UI.sheet) closeSheet(); });
window.addEventListener("online", () => { S.online = true; paintSync(); });
window.addEventListener("offline", () => { S.online = false; paintSync(); });
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); S.installEvt = e; if (!$("#shell").hidden) render(); });
let lastDay = today();
setInterval(() => { if (today() !== lastDay){ lastDay = today(); invalidate(); if (!$("#shell").hidden) render(); } }, 60000);

// Accès pour les tests automatiques
window.__mct = {S, UI, DB, VIEW, render, setDemo, openTicket, ticketForm, setGeneral, setTypes, setDurees, setExceptions, zoneForm, subzoneForm, usersSheet, snapshot, goTab};
boot();
