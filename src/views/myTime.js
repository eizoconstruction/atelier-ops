import { store, create, statusTone, entryJob, jobOptions } from "../store.js";
import { esc, num, startOfWeek, addDays, today, fmtDate, fmtShort, emptyState, badge, sum, toast, humanError, hhmm, round2 } from "../util.js";
import { timeForm } from "../forms.js";

const PUNCH_KEY = "atelier-ops-punch";
const ui = { week: startOfWeek() };
let ticker = null;

const getPunch = () => { try { return JSON.parse(localStorage.getItem(PUNCH_KEY) || "null"); } catch { return null; } };
const setPunch = p => (p ? localStorage.setItem(PUNCH_KEY, JSON.stringify(p)) : localStorage.removeItem(PUNCH_KEY));
const pad = n => String(n).padStart(2, "0");
const clock = ms => { const s = Math.floor(ms / 1000); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`; };
const timeOf = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export default {
  render(el, _p, ctx) { draw(el, ctx); }
};

function draw(el, ctx) {
  const me = store.me;
  const punch = getPunch();
  const weekEnd = addDays(ui.week, 6);
  const mine = store.time_entries.filter(e => e.employee_id === me.id && e.work_date >= ui.week && e.work_date <= weekEnd)
    .sort((a, b) => String(b.work_date).localeCompare(String(a.work_date)));
  const days = Array.from({ length: 7 }, (_, i) => addDays(ui.week, i));
  const myJobs = jobOptions().filter(o => (store.jobs.find(j => j.id === o.value)?.crew_ids || []).includes(me.id));
  const jobChoices = myJobs.length ? [...myJobs, ...jobOptions().filter(o => !myJobs.some(m => m.value === o.value))] : jobOptions();

  el.innerHTML = `
    <section class="panel punch ${punch ? "on" : ""}">
      ${punch ? `
        <p class="eyebrow">Au travail depuis ${hhmm(timeOf(new Date(punch.start)))}</p>
        <div class="punch-clock" id="punchClock">${clock(Date.now() - punch.start)}</div>
        <p><b>${esc(entryJob({ job_id: punch.jobId }))}</b></p>
        <label class="field"><span>Pause (minutes)</span><input type="number" id="punchBreak" min="0" step="5" value="${punch.breakMin ?? 30}" inputmode="numeric"></label>
        <label class="field"><span>Note (travaux faits)</span><textarea id="punchNote" rows="2">${esc(punch.note || "")}</textarea></label>
        <div class="btn-row"><button class="ghost-btn" id="punchCancel">Annuler</button><button class="primary-btn big" id="punchOut">Terminer ma journée</button></div>
      ` : `
        <p class="eyebrow">Pointage</p>
        <label class="field"><span>Job</span><select id="punchJob">${jobChoices.map(o => `<option value="${o.value}">${esc(o.label)}</option>`).join("") || "<option value=''>Aucun job</option>"}</select></label>
        <button class="primary-btn big full" id="punchIn" ${jobChoices.length ? "" : "disabled"}>▶ Commencer maintenant</button>
        <button class="link-btn" id="manual">ou entrer des heures manuellement</button>
      `}
    </section>

    <div class="toolbar">
      <div class="btn-row"><button class="ghost-btn" id="prevW">←</button><button class="ghost-btn" id="thisW">Cette semaine</button><button class="ghost-btn" id="nextW">→</button></div>
      <h2 class="month-title">Semaine du ${fmtDate(ui.week, { day: "numeric", month: "long" })}</h2>
      <strong class="week-total">${num(sum(mine.filter(e => e.status !== "Refusé"), e => e.hours), 2)} h</strong>
    </div>

    <section class="panel">
      <div class="week-strip">${days.map(d => {
        const h = sum(mine.filter(e => e.work_date === d && e.status !== "Refusé"), e => e.hours);
        return `<button class="week-day ${d === today() ? "today" : ""} ${h ? "has" : ""}" data-day="${d}"><small>${fmtDate(d, { weekday: "short" })}</small><b>${new Date(d + "T12:00").getDate()}</b><span>${h ? `${num(h)} h` : "+"}</span></button>`;
      }).join("")}</div>
      ${mine.length ? mine.map(e => `
        <button class="row-line clickable" data-edit="${e.id}">
          <span><b>${esc(entryJob(e))}</b><small>${fmtDate(e.work_date, { weekday: "long", day: "numeric", month: "short" })} · ${hhmm(e.start_time)}${e.end_time ? `–${hhmm(e.end_time)}` : ""}${e.notes ? ` · ${esc(e.notes)}` : ""}</small></span>
          <b>${num(e.hours, 2)} h</b>${badge(e.status, statusTone(e.status))}
        </button>`).join("") : emptyState("Aucune heure cette semaine", "Utilise le pointage ou touche une journée pour entrer tes heures.")}
      <p class="help">Tu peux modifier ou supprimer une entrée tant qu'elle n'est pas approuvée. Une entrée refusée doit être corrigée.</p>
    </section>`;

  const redraw = () => draw(el, ctx);
  el.querySelector("#prevW").onclick = () => { ui.week = addDays(ui.week, -7); redraw(); };
  el.querySelector("#nextW").onclick = () => { ui.week = addDays(ui.week, 7); redraw(); };
  el.querySelector("#thisW").onclick = () => { ui.week = startOfWeek(); redraw(); };
  el.querySelectorAll("[data-day]").forEach(b => b.onclick = () => timeForm(null, { work_date: b.dataset.day, job_id: jobChoices[0]?.value }));
  el.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => timeForm(store.time_entries.find(e => e.id === b.dataset.edit)));
  el.querySelector("#manual")?.addEventListener("click", () => timeForm(null, { job_id: el.querySelector("#punchJob")?.value }));

  el.querySelector("#punchIn")?.addEventListener("click", () => {
    setPunch({ jobId: el.querySelector("#punchJob").value, start: Date.now(), breakMin: 30 });
    toast("Bonne journée !");
    redraw();
  });
  el.querySelector("#punchCancel")?.addEventListener("click", () => { setPunch(null); redraw(); });
  const keep = () => { const p = getPunch(); if (!p) return; p.breakMin = Number(el.querySelector("#punchBreak").value) || 0; p.note = el.querySelector("#punchNote").value; setPunch(p); };
  el.querySelector("#punchBreak")?.addEventListener("input", keep);
  el.querySelector("#punchNote")?.addEventListener("input", keep);
  el.querySelector("#punchOut")?.addEventListener("click", async () => {
    keep();
    const p = getPunch();
    const start = new Date(p.start);
    const end = new Date();
    const hours = round2(Math.max(0, (end - start) / 3600000 - (p.breakMin || 0) / 60));
    if (hours < 0.1) { toast("Moins de 6 minutes : rien n'est enregistré.", "error"); setPunch(null); return redraw(); }
    try {
      await create("time_entries", {
        employee_id: me.id, job_id: p.jobId, work_date: today(),
        start_time: timeOf(start), end_time: timeOf(end), break_minutes: p.breakMin || 0,
        hours, notes: p.note || "", status: "À approuver"
      });
      setPunch(null);
      toast(`${num(hours, 2)} h enregistrées`);
    } catch (e) { toast(humanError(e), "error"); }
  });

  clearInterval(ticker);
  if (punch) ticker = setInterval(() => {
    const c = document.getElementById("punchClock");
    if (!c) return clearInterval(ticker);
    c.textContent = clock(Date.now() - punch.start);
  }, 1000);
}
