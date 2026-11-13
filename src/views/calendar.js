import { store, isAdmin, clientOf, statusTone, jobName, personName } from "../store.js";
import { esc, today, isoDate, parseISO, fmtMonth, hhmm, emptyState, fmtDate } from "../util.js";
import { eventForm } from "../forms.js";

const ui = { month: today().slice(0, 7), mine: false };
const DOW = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default {
  render(el, _p, ctx) { draw(el, ctx); }
};

function itemsForDay(d) {
  const me = store.me.id;
  const jobs = store.jobs.filter(j => {
    if (["Annulé"].includes(j.status) || !j.scheduled_date) return false;
    if (ui.mine && !(j.crew_ids || []).includes(me)) return false;
    const end = j.end_date || j.scheduled_date;
    return d >= j.scheduled_date && d <= end;
  });
  const events = store.calendar_events.filter(e => e.event_date === d && (!ui.mine || !e.employee_id || e.employee_id === me))
    .sort((a, b) => String(a.start_time || "").localeCompare(String(b.start_time || "")));
  return { jobs, events };
}

function draw(el, { go, actions }) {
  const admin = isAdmin();
  actions.innerHTML = admin ? `<button class="primary-btn" id="newEvent">+ Événement</button>` : "";
  actions.querySelector("#newEvent")?.addEventListener("click", () => eventForm());

  const [y, m] = ui.month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(y, m - 1, 1 - offset);
  const cells = [];
  for (let n = 0; n < 42; n++) {
    const d = new Date(start);
    d.setDate(start.getDate() + n);
    cells.push(isoDate(d));
  }
  // retirer la dernière semaine si entièrement hors du mois
  while (cells.length > 35 && cells.slice(-7).every(c => c.slice(0, 7) !== ui.month)) cells.splice(-7);
  const t = today();

  // agenda (liste) pour mobile
  const monthDays = cells.filter(c => c.slice(0, 7) === ui.month);
  const agenda = monthDays.map(d => ({ d, ...itemsForDay(d) })).filter(x => x.events.length || x.jobs.some(j => j.scheduled_date === x.d || j.end_date === x.d));

  el.innerHTML = `
    <div class="toolbar">
      <div class="btn-row"><button class="ghost-btn" id="prevM">←</button><button class="ghost-btn" id="todayM">Aujourd'hui</button><button class="ghost-btn" id="nextM">→</button></div>
      <h2 class="month-title">${fmtMonth(ui.month)}</h2>
      <label class="check"><input type="checkbox" id="mineOnly" ${ui.mine ? "checked" : ""}> Seulement mes jobs</label>
    </div>
    <section class="panel flush calendar-desktop">
      <div class="calendar">
        ${DOW.map(d => `<div class="cal-dow">${d}</div>`).join("")}
        ${cells.map(d => {
          const { jobs, events } = itemsForDay(d);
          const out = d.slice(0, 7) !== ui.month;
          const dow = (parseISO(d).getDay() + 6) % 7;
          return `<div class="cal-day ${out ? "out" : ""} ${d === t ? "today" : ""} ${dow > 4 ? "weekend" : ""}" data-day="${d}">
            <span class="cal-num">${parseISO(d).getDate()}</span>
            ${jobs.slice(0, 3).map(j => `<button class="cal-item job t-${statusTone(j.status)}" data-job="${j.id}" title="${esc(j.name)}">${j.scheduled_date === d ? "▸ " : ""}${esc(j.name)}</button>`).join("")}
            ${jobs.length > 3 ? `<small class="muted">+${jobs.length - 3} job(s)</small>` : ""}
            ${events.map(e => `<button class="cal-item ev" data-ev="${e.id}" title="${esc(e.title)}">${hhmm(e.start_time) ? `<b>${hhmm(e.start_time)}</b> ` : ""}${esc(e.title)}</button>`).join("")}
          </div>`;
        }).join("")}
      </div>
    </section>
    <section class="panel calendar-mobile">
      ${agenda.length ? agenda.map(x => `
        <div class="agenda-day ${x.d === t ? "today" : ""}"><h3>${fmtDate(x.d, { weekday: "long", day: "numeric", month: "long" })}</h3>
          ${x.events.map(e => `<button class="agenda-item ev" data-ev="${e.id}"><b>${hhmm(e.start_time) || "Journée"}</b><span>${esc(e.title)}<small>${esc(jobName(e.job_id) || e.kind)}${e.employee_id ? ` · ${esc(personName(e.employee_id))}` : ""}</small></span></button>`).join("")}
          ${x.jobs.filter(j => j.scheduled_date === x.d || j.end_date === x.d).map(j => `<button class="agenda-item job" data-job="${j.id}"><b>${j.scheduled_date === x.d ? "Début" : "Fin"}</b><span>${esc(j.name)}<small>${esc(clientOf(j)?.name || "")}</small></span></button>`).join("")}
        </div>`).join("") : emptyState("Rien ce mois-ci")}
      <p class="help">Les jobs s'affichent du début à la fin prévue. Sur ordinateur, la vue mensuelle complète est affichée.</p>
    </section>`;

  const shift = n => { const d = new Date(y, m - 1 + n, 1); ui.month = isoDate(d).slice(0, 7); draw(el, { go, actions }); };
  el.querySelector("#prevM").onclick = () => shift(-1);
  el.querySelector("#nextM").onclick = () => shift(1);
  el.querySelector("#todayM").onclick = () => { ui.month = today().slice(0, 7); draw(el, { go, actions }); };
  el.querySelector("#mineOnly").onchange = e => { ui.mine = e.target.checked; draw(el, { go, actions }); };
  el.querySelectorAll("[data-job]").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); go("jobs", b.dataset.job); }));
  el.querySelectorAll("[data-ev]").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation();
    const ev = store.calendar_events.find(x => x.id === b.dataset.ev);
    if (admin) eventForm(ev);
    else if (ev.job_id) go("jobs", ev.job_id);
  }));
  if (admin) el.querySelectorAll("[data-day]").forEach(c => c.addEventListener("click", () => eventForm(null, { event_date: c.dataset.day })));
}
