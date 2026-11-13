import { store, patchMany, statusTone, entryPerson, entryJob, employeeOptions, byId } from "../store.js";
import { esc, num, money, startOfWeek, addDays, today, fmtShort, fmtDate, emptyState, badge, sum, toast, downloadCSV, humanError, hhmm, groupBy } from "../util.js";
import { timeForm } from "../forms.js";

const ui = { from: startOfWeek(), weeks: 1, employee: "", status: "", selected: new Set() };

export default {
  render(el, _p, ctx) { draw(el, ctx); }
};

function draw(el, { go, actions }) {
  actions.innerHTML = `<button class="primary-btn" id="addTime">+ Heures</button>`;
  actions.querySelector("#addTime").onclick = () => timeForm();
  const to = addDays(ui.from, ui.weeks * 7 - 1);
  const rows = store.time_entries
    .filter(e => e.work_date >= ui.from && e.work_date <= to)
    .filter(e => !ui.employee || e.employee_id === ui.employee)
    .filter(e => !ui.status || e.status === ui.status)
    .sort((a, b) => (String(b.work_date) + entryPerson(b)).localeCompare(String(a.work_date) + entryPerson(a)));
  ui.selected = new Set([...ui.selected].filter(id => rows.some(r => r.id === id)));
  const pending = rows.filter(r => r.status === "À approuver");

  // résumé par employé (pour la paie)
  const byPerson = groupBy(rows.filter(r => r.status !== "Refusé"), r => entryPerson(r));
  const summary = Object.entries(byPerson).map(([name, es]) => {
    const total = sum(es, e => e.hours);
    const rate = Number(byId("profiles", es[0].employee_id)?.hourly_cost) || 0;
    // heures sup. : au-delà de 40 h par semaine (Normes du travail du Québec)
    const perWeek = groupBy(es, e => startOfWeek(e.work_date));
    const overtime = sum(Object.values(perWeek), w => Math.max(0, sum(w, e => e.hours) - 40));
    return { name, total, approved: sum(es.filter(e => e.status === "Approuvé"), e => e.hours), overtime, cost: total * rate };
  }).sort((a, b) => a.name.localeCompare(b.name));

  el.innerHTML = `
    <div class="toolbar">
      <div class="btn-row"><button class="ghost-btn" id="prevW">←</button><button class="ghost-btn" id="thisW">Cette semaine</button><button class="ghost-btn" id="nextW">→</button></div>
      <h2 class="month-title">${fmtDate(ui.from, { day: "numeric", month: "short" })} – ${fmtDate(to)}</h2>
      <select id="weeks" class="compact"><option value="1">1 semaine</option><option value="2" ${ui.weeks === 2 ? "selected" : ""}>2 semaines (paie)</option></select>
      <select id="emp" class="compact"><option value="">Tous les employés</option>${employeeOptions().map(o => `<option value="${o.value}" ${o.value === ui.employee ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>
      <select id="st" class="compact"><option value="">Tous les statuts</option>${["À approuver", "Approuvé", "Refusé"].map(s => `<option ${s === ui.status ? "selected" : ""}>${s}</option>`).join("")}</select>
      <button class="ghost-btn" id="expTime">Exporter pour la paie</button>
    </div>

    <div class="kpis small">
      <div class="kpi"><span>Total</span><strong>${num(sum(rows.filter(r => r.status !== "Refusé"), r => r.hours))} h</strong></div>
      <div class="kpi"><span>À approuver</span><strong>${num(sum(pending, r => r.hours))} h</strong><small>${pending.length} entrée(s)</small></div>
      <div class="kpi"><span>Coût main-d'oeuvre</span><strong>${money(sum(summary, s => s.cost))}</strong><small>selon coûts horaires</small></div>
    </div>

    ${summary.length ? `<section class="panel"><h3>Par employé</h3><div class="table-wrap"><table class="table compact"><thead><tr><th>Employé</th><th class="num">Heures</th><th class="num">Approuvées</th><th class="num">Heures sup. (&gt;40 h/sem.)</th><th class="num">Coût</th></tr></thead>
      <tbody>${summary.map(s => `<tr><td>${esc(s.name)}</td><td class="num">${num(s.total, 2)}</td><td class="num">${num(s.approved, 2)}</td><td class="num ${s.overtime ? "neg" : ""}">${num(s.overtime, 2)}</td><td class="num">${money(s.cost)}</td></tr>`).join("")}</tbody></table></div></section>` : ""}

    <section class="panel flush">
      <div class="panel-head pad">
        <label class="check"><input type="checkbox" id="selAll" ${rows.length && ui.selected.size === rows.length ? "checked" : ""}> Tout sélectionner</label>
        <span class="btn-row">
          <button class="ghost-btn small" id="rejectSel" ${ui.selected.size ? "" : "disabled"}>Refuser (${ui.selected.size})</button>
          <button class="primary-btn small" id="approveSel" ${ui.selected.size ? "" : "disabled"}>Approuver (${ui.selected.size})</button>
          <button class="ghost-btn small" id="approvePending" ${pending.length ? "" : "disabled"}>Approuver tout ce qui est en attente (${pending.length})</button>
        </span>
      </div>
      ${rows.length ? `<div class="table-wrap"><table class="table"><thead><tr><th></th><th>Date</th><th>Employé</th><th>Job</th><th>Horaire</th><th class="num">Heures</th><th>Statut</th><th>Note</th></tr></thead>
        <tbody>${rows.map(e => `<tr class="clickable" data-edit="${e.id}">
          <td data-stop><input type="checkbox" data-sel="${e.id}" ${ui.selected.has(e.id) ? "checked" : ""} aria-label="Sélectionner"></td>
          <td>${fmtShort(e.work_date)}</td><td>${esc(entryPerson(e))}</td><td>${esc(entryJob(e))}</td>
          <td><small>${hhmm(e.start_time)}${e.end_time ? `–${hhmm(e.end_time)}` : ""}${e.break_minutes ? ` (pause ${e.break_minutes} min)` : ""}</small></td>
          <td class="num">${num(e.hours, 2)}</td><td>${badge(e.status, statusTone(e.status))}</td><td><small>${esc(e.notes || "")}</small></td></tr>`).join("")}</tbody></table></div>`
        : emptyState("Aucune heure pour cette période", "Les heures entrées par les employés apparaîtront ici.")}
    </section>`;

  const redraw = () => draw(el, { go, actions });
  el.querySelector("#prevW").onclick = () => { ui.from = addDays(ui.from, -7 * ui.weeks); redraw(); };
  el.querySelector("#nextW").onclick = () => { ui.from = addDays(ui.from, 7 * ui.weeks); redraw(); };
  el.querySelector("#thisW").onclick = () => { ui.from = startOfWeek(); redraw(); };
  el.querySelector("#weeks").onchange = e => { ui.weeks = Number(e.target.value); redraw(); };
  el.querySelector("#emp").onchange = e => { ui.employee = e.target.value; redraw(); };
  el.querySelector("#st").onchange = e => { ui.status = e.target.value; redraw(); };
  el.querySelector("#selAll").onchange = e => { ui.selected = e.target.checked ? new Set(rows.map(r => r.id)) : new Set(); redraw(); };
  el.querySelectorAll("[data-sel]").forEach(c => c.onchange = () => { c.checked ? ui.selected.add(c.dataset.sel) : ui.selected.delete(c.dataset.sel); redraw(); });
  el.querySelectorAll("[data-stop]").forEach(td => td.addEventListener("click", e => e.stopPropagation()));
  el.querySelectorAll("[data-edit]").forEach(r => r.onclick = () => timeForm(store.time_entries.find(e => e.id === r.dataset.edit)));

  const setStatus = async (ids, status) => {
    try {
      const extra = status === "Approuvé" ? { approved_by: store.me.id, approved_at: new Date().toISOString() } : { approved_by: null, approved_at: null };
      await patchMany("time_entries", ids, { status, ...extra });
      ui.selected.clear();
      toast(`${ids.length} entrée(s) : ${status.toLowerCase()}`);
    } catch (e) { toast(humanError(e), "error"); }
  };
  el.querySelector("#approveSel").onclick = () => setStatus([...ui.selected], "Approuvé");
  el.querySelector("#rejectSel").onclick = () => setStatus([...ui.selected], "Refusé");
  el.querySelector("#approvePending").onclick = () => setStatus(pending.map(p => p.id), "Approuvé");
  el.querySelector("#expTime").onclick = () => downloadCSV(`heures-${ui.from}-au-${to}.csv`, [
    ["Date", "Employé", "Job", "Arrivée", "Départ", "Pause (min)", "Heures", "Statut", "Note"],
    ...rows.slice().reverse().map(e => [e.work_date, entryPerson(e), entryJob(e), hhmm(e.start_time), hhmm(e.end_time), e.break_minutes || 0, e.hours, e.status, e.notes || ""]),
    [],
    ["Résumé", "Employé", "", "", "", "", "Heures", "Heures sup.", "Coût"],
    ...summary.map(s => ["", s.name, "", "", "", "", s.total, s.overtime, s.cost.toFixed(2)])
  ]);
}
