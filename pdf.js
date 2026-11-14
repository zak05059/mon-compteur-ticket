// Rapport global PDF (jsPDF) et téléchargement de fichiers.
import { DIFFS, JOURS, DAY_STATE, fmtD, fmtDur, dow, pct, periodLabel } from "./data.js";

let loading = null;
function loadJsPdf(){
  if (window.jspdf) return Promise.resolve();
  if (loading) return loading;
  const urls = ["https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"];
  loading = urls.reduce((p, u) => p.catch(() => new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = u; s.onload = () => window.jspdf ? res() : rej(); s.onerror = rej; document.head.appendChild(s);
  })), Promise.reject());
  loading.catch(() => { loading = null; });
  return loading;
}
async function logoData(){
  try {
    const blob = await (await fetch("icons/logo.jpg")).blob();
    return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = () => r(null); fr.readAsDataURL(blob); });
  } catch (e) { return null; }
}

export async function deliverFile(blob, filename){
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  try {
    const file = new File([blob], filename, {type: blob.type});
    if (isIOS && navigator.canShare && navigator.canShare({files: [file]})){ await navigator.share({files: [file], title: filename}); return true; }
  } catch (e) { if (e && e.name === "AbortError") return false; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

export async function makePdf(r, authorName){
  await loadJsPdf();
  const logo = await logoData();
  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({unit: "mm", format: "a4"});
  const W = 210, H = 297, M = 14;
  const V = [123, 47, 190], VD = [55, 20, 95], BG = [11, 7, 20], Y = [233, 182, 28], INK = [23, 18, 31], GREY = [93, 86, 106], LINE = [226, 220, 234];
  const COL = {ok: [20, 145, 92], warn: [197, 90, 0], ko: [211, 38, 74], off: [128, 119, 143], run: [31, 111, 214]};
  const T = s => String(s ?? "").replace(/≤/g, "<=").replace(/≥/g, ">=").replace(/…/g, "...").replace(/[‘’]/g, "'").replace(/[  ]/g, " ");
  let y = 0;

  // Bandeau
  doc.setFillColor(...BG); doc.rect(0, 0, W, 34, "F");
  doc.setFillColor(...V); doc.rect(0, 0, W * 0.62, 34, "F");
  doc.setFillColor(...Y); doc.rect(0, 34, W, 1.4, "F");
  if (logo){ try { doc.setFillColor(255, 255, 255); doc.circle(M + 11, 17, 11.6, "F"); doc.addImage(logo, "JPEG", M, 6, 22, 22); } catch (e) {} }
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(16.5);
  doc.text("Rapport global des installations", M + 28, 15);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(T(`Mon Compteur de Ticket · KBOWD Group`), M + 28, 21.5);
  doc.text(T(`${periodLabel(r.a, r.b)} · ${r.zone ? "zone " + r.zone : "toutes les zones"}`), M + 28, 27);
  y = 44;

  const ensure = h => { if (y + h > H - 16){ doc.addPage(); y = 18; } };
  const title = t => { ensure(16); doc.setTextColor(...VD); doc.setFont("helvetica", "bold"); doc.setFontSize(12.5); doc.text(T(t), M, y); y += 2.5; doc.setDrawColor(...Y); doc.setLineWidth(.6); doc.line(M, y, M + 16, y); doc.setDrawColor(...LINE); doc.setLineWidth(.2); doc.line(M + 16, y, W - M, y); y += 6; };
  const para = (t, size = 9.5, color = GREY) => { doc.setFont("helvetica", "normal"); doc.setFontSize(size); doc.setTextColor(...color); const lines = doc.splitTextToSize(T(t), W - 2 * M); ensure(lines.length * 4.6); doc.text(lines, M, y); y += lines.length * 4.6 + 1; };
  function table(cols, rows, opt = {}){
    const total = cols.reduce((s, c) => s + c.w, 0), scale = (W - 2 * M) / total, ws = cols.map(c => c.w * scale), rowH = 6.4;
    const head = () => {
      doc.setFillColor(...V); doc.rect(M, y, W - 2 * M, rowH, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.3); doc.setTextColor(255, 255, 255);
      let x = M; cols.forEach((c, i) => { doc.text(T(c.h), c.r ? x + ws[i] - 2 : x + 2, y + 4.3, {align: c.r ? "right" : "left"}); x += ws[i]; });
      y += rowH;
    };
    ensure(rowH * 2); head();
    rows.forEach((row, ri) => {
      if (y + rowH > H - 16){ doc.addPage(); y = 18; head(); }
      if (ri % 2 === 1){ doc.setFillColor(246, 243, 250); doc.rect(M, y, W - 2 * M, rowH, "F"); }
      if (opt.mark){ const c = opt.mark(ri); if (c){ doc.setFillColor(...c); doc.rect(M, y, 1.4, rowH, "F"); } }
      let x = M;
      row.forEach((cell, i) => {
        const c = cols[i], v = cell !== null && typeof cell === "object" ? cell : {t: cell};
        doc.setTextColor(...(v.color || INK)); doc.setFont("helvetica", v.bold ? "bold" : "normal"); doc.setFontSize(8.5);
        let s = T(v.t); const maxW = ws[i] - 4;
        while (s.length > 1 && doc.getTextWidth(s) > maxW) s = s.slice(0, -2) + ".";
        doc.text(s, c.r ? x + ws[i] - 2 : x + 2, y + 4.3, {align: c.r ? "right" : "left"});
        x += ws[i];
      });
      doc.setDrawColor(...LINE); doc.setLineWidth(.15); doc.line(M, y + rowH, W - M, y + rowH);
      y += rowH;
    });
    y += 5;
  }
  function kpiGrid(items){
    const cw = (W - 2 * M - 9) / 4, ch = 17;
    items.forEach((it, i) => {
      if (i % 4 === 0){ ensure(ch + 3); if (i) y += ch + 3; }
      const x = M + (i % 4) * (cw + 3);
      doc.setFillColor(244, 240, 249); doc.roundedRect(x, y, cw, ch, 2, 2, "F");
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.8); doc.setTextColor(...GREY); doc.text(T(it.k), x + 3, y + 5.2);
      doc.setFont("helvetica", "bold"); doc.setFontSize(it.small ? 11 : 14); doc.setTextColor(...(it.color || INK)); doc.text(T(it.v), x + 3, y + 12.6);
    });
    y += ch + 7;
  }

  const gen = new Date(r.createdAt);
  para(`Généré le ${gen.toLocaleDateString("fr-FR")} à ${gen.toLocaleTimeString("fr-FR", {hour: "2-digit", minute: "2-digit"})}${authorName ? " par " + authorName : ""}. Objectif : ${r.objectifJour} installations par jour travaillé, calculé jusqu'au jour de génération.`);
  y += 2;
  title("Chiffres clés");
  const k = r.kpi;
  kpiGrid([
    {k: "Installations réussies", v: String(k.ok), color: COL.ok}, {k: "Objectif de la période", v: String(k.obj)},
    {k: "Écart", v: (k.ecart > 0 ? "+" : "") + k.ecart, color: k.ecart >= 0 ? COL.ok : COL.ko}, {k: "Taux de réalisation", v: k.obj ? Math.round(k.realisation) + " %" : "—"},
    {k: "Jours travaillés", v: String(k.worked)}, {k: "Moyenne par jour travaillé", v: k.worked ? String(Math.round(k.ok / k.worked * 10) / 10).replace(".", ",") : "—"},
    {k: "KO", v: String(k.ko), color: COL.ko}, {k: "Taux de réussite", v: k.ok + k.ko ? Math.round(k.reussite) + " %" : "—"},
    {k: "En attente", v: String(k.attente), color: COL.run}, {k: "Annulés", v: String(k.annule), color: COL.off},
    {k: "Durée moyenne", v: fmtDur(r.temps.avg), small: true}, {k: "Poteaux demandés", v: String(k.poteaux)},
  ]);
  title("Temps d'installation");
  const tt = r.temps, n = tt.timed;
  para(`${n} installation${n > 1 ? "s" : ""} avec heures. Excellent : ${tt.tiers.excellent} (${n ? Math.round(pct(tt.tiers.excellent, n)) : 0} %) · Dans l'objectif : ${tt.tiers.objectif} (${n ? Math.round(pct(tt.tiers.objectif, n)) : 0} %) · Hors objectif : ${tt.tiers.hors} (${n ? Math.round(pct(tt.tiers.hors, n)) : 0} %).${tt.noHours ? ` ${tt.noHours} installation(s) sans heures, non comptées.` : ""}`, 9.5, INK);
  if (n){
    ensure(10);
    const bw = W - 2 * M; let x = M;
    [["excellent", COL.ok], ["objectif", [201, 162, 39]], ["hors", COL.warn]].forEach(([key, c]) => { const w = bw * tt.tiers[key] / n; if (w > 0){ doc.setFillColor(...c); doc.rect(x, y, w, 4, "F"); x += w; } });
    y += 9;
    table([{h: "Type de ticket", w: 60}, {h: "Avec heures", w: 26, r: 1}, {h: "Durée moyenne", w: 32, r: 1}, {h: "Excellent", w: 22, r: 1}, {h: "Dans l'obj.", w: 22, r: 1}, {h: "Hors obj.", w: 22, r: 1}],
      tt.byType.map(b => [b.type, b.n, fmtDur(b.avg), b.excellent, b.objectif, {t: b.hors, color: b.hors ? COL.warn : INK}]));
  }
  title("Difficultés");
  table([{h: "Type de difficulté", w: 120}, {h: "Tickets", w: 30, r: 1}], r.diffs.map(d => [d.l, {t: d.n, bold: d.n > 0}]));
  title("Installations par zone");
  if (r.zones.length) table([{h: "Zone", w: 22}, {h: "Quartiers", w: 64}, {h: "OK", w: 14, r: 1}, {h: "KO", w: 14, r: 1}, {h: "Durée moy.", w: 28, r: 1}, {h: "Diff.", w: 14, r: 1}, {h: "Évaluation", w: 26}],
    r.zones.map(z => [{t: z.code, bold: true}, z.quartiers, z.ok, z.ko, fmtDur(z.avg), z.nd, z.hard ? {t: "Difficile", color: COL.warn, bold: true} : z.avg != null ? {t: "Dans la cible", color: COL.ok} : ""]));
  else para("Aucun ticket sur la période.");
  title("Sous-zones (de la plus longue à la plus courte)");
  if (r.subzones.length) table([{h: "Sous-zone", w: 70}, {h: "OK", w: 14, r: 1}, {h: "Durée moy.", w: 28, r: 1}, {h: "Hors obj.", w: 22, r: 1}, {h: "KO", w: 14, r: 1}, {h: "Diff.", w: 14, r: 1}],
    r.subzones.map(s => [{t: s.label + (s.hard ? "  (difficile)" : ""), color: s.hard ? COL.warn : INK, bold: s.hard}, s.ok, fmtDur(s.avg), s.timed ? Math.round(s.horsPct) + " %" : "—", s.ko, s.nd]));
  else para("Aucune sous-zone renseignée sur la période.");
  title("Points à traiter");
  table([{h: "Point", w: 130}, {h: "Nombre", w: 25, r: 1}], r.alerts.map(a => [a.l, {t: a.n, color: a.n ? COL.warn : COL.ok, bold: true}]));
  title("Jour par jour");
  table([{h: "Date", w: 24}, {h: "Jour", w: 34}, {h: "OK", w: 13, r: 1}, {h: "KO", w: 13, r: 1}, {h: "Objectif", w: 18, r: 1}, {h: "Écart", w: 16, r: 1}, {h: "Durée moy.", w: 26, r: 1}, {h: "État", w: 38}],
    r.days.map(d => [fmtD(d.d), JOURS[dow(d.d)], d.ok, d.ko, d.obj, d.obj ? (d.ok - d.obj > 0 ? "+" : "") + (d.ok - d.obj) : "—", fmtDur(d.avg), d.obj ? DAY_STATE[d.state] : d.type]),
    {mark: i => COL[r.days[i].state]});
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++){
    doc.setPage(p); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...GREY);
    doc.text(T(`Mon Compteur de Ticket · ${periodLabel(r.a, r.b)}`), M, H - 8);
    doc.text(`Page ${p} / ${pages}`, W - M, H - 8, {align: "right"});
  }
  return doc.output("blob");
}
