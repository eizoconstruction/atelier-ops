import { store, isAdmin, jobFinancials, clientOf, statusTone, OPEN_STATUSES, entryJob, jobName } from "../store.js";
import { esc, money, num, today, addDays, startOfWeek, fmtShort, sum, emptyState, badge, daysBetween, hhmm } from "../util.js";

export default {
  render(el, _params, { go }) {
    const t = today();
    const weekStart = startOfWeek(t);
    const weekEnd = addDays(weekStart, 6);
    const me = store.me;
    const admin = isAdmin();

    const openJobs = store.jobs.filter(j => OPEN_STATUSES.includes(j.status));
    const inProgress = store.jobs.filter(j => j.status === "En cours");
    const weekEntries = store.time_entries.filter(e => e.work_date >= weekStart && e.work_date <= weekEnd && (admin || e.employee_id === me.id));
    const weekHours = sum(weekEntries, e => e.hours);
    const pendingHours = store.time_entries.filter(e => e.status === "À approuver");
    const toInvoice = store.jobs.filter(j => j.status === "À facturer");
    const receivable = store.jobs.filter(j => j.status === "Facturé").reduce((s, j) => s + Math.max(0, (Number(j.price) || 0) - (Number(j.amount_paid) || 0)), 0);
    const backlog = sum(openJobs, j => j.price);

    // ---- prochains 7 jours : événements + débuts/fins de jobs ----
    const horizon = addDays(t, 7);
    const upcoming = [
      ...store.calendar_events.filter(e => e.event_date >= t && e.event_date <= horizon).map(e => ({ date: e.event_date, time: hhmm(e.start_time), title: e.title, sub: jobName(e.job_id) || e.kind, jobId: e.job_id })),
      ...store.jobs.filter(j => j.scheduled_date >= t && j.scheduled_date <= horizon).map(j => ({ date: j.scheduled_date, time: "", title: `Début : ${j.name}`, sub: clientOf(j)?.name || "", jobId: j.id })),
      ...store.jobs.filter(j => j.end_date >= t && j.end_date <= horizon && OPEN_STATUSES.includes(j.status)).map(j => ({ date: j.end_date, time: "", title: `Fin prévue : ${j.name}`, sub: clientOf(j)?.name || "", jobId: j.id }))
    ].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

    // ---- alertes ----
    const alerts = [];
    if (admin) {
      if (pendingHours.length) alerts.push({ tone: "warn", text: `${pendingHours.length} entrée(s) d'heures à approuver`, go: ["time"] });
      toInvoice.forEach(j => alerts.push({ tone: "warn", text: `À facturer : ${j.name} (${money(j.price)})`, go: ["jobs", j.id, "billing"] }));
      store.jobs.filter(j => j.status === "Facturé" && j.invoiced_at && daysBetween(j.invoiced_at, t) > 30 && (Number(j.price) - Number(j.amount_paid)) > 0)
        .forEach(j => alerts.push({ tone: "danger", text: `Facture en retard (+30 jours) : ${j.name}`, go: ["jobs", j.id, "billing"] }));
      openJobs.forEach(j => {
        const f = jobFinancials(j);
        if (f.budget && f.budgetUsed > 90) alerts.push({ tone: f.budgetUsed > 100 ? "danger" : "warn", text: `${j.name} : ${Math.round(f.budgetUsed)} % du budget de coûts utilisé`, go: ["jobs", j.id, "costs"] });
        if (j.end_date && j.end_date < t && j.status === "En cours") alerts.push({ tone: "warn", text: `${j.name} : date de fin dépassée`, go: ["jobs", j.id] });
      });
      if (!store.profiles.some(p => p.role !== "admin")) alerts.push({ tone: "info", text: "Aucun employé encore. Ajoute tes employés.", go: ["team"] });
      if (!store.vehicles.length) alerts.push({ tone: "info", text: "Aucun véhicule. Ajoute-les pour le kilométrage.", go: ["team"] });
    } else {
      const mine = store.time_entries.filter(e => e.employee_id === me.id && e.status === "Refusé");
      if (mine.length) alerts.push({ tone: "danger", text: `${mine.length} entrée(s) d'heures refusée(s) — à corriger`, go: ["myTime"] });
      if (!store.time_entries.some(e => e.employee_id === me.id && e.work_date === t)) alerts.push({ tone: "info", text: "Tu n'as pas encore entré tes heures aujourd'hui.", go: ["myTime"] });
    }

    const myJobs = admin ? inProgress : store.jobs.filter(j => (j.crew_ids || []).includes(me.id) && OPEN_STATUSES.includes(j.status));

    el.innerHTML = `
      <div class="kpis">
        ${admin ? `
          <button class="kpi" data-go="jobs"><span>Contrats ouverts</span><strong>${money(backlog)}</strong><small>${openJobs.length} job(s)</small></button>
          <button class="kpi" data-go="accounting"><span>À facturer</span><strong>${money(sum(toInvoice, j => j.price))}</strong><small>${toInvoice.length} job(s)</small></button>
          <button class="kpi" data-go="accounting"><span>Comptes à recevoir</span><strong>${money(receivable)}</strong><small>Factures non payées</small></button>
          <button class="kpi" data-go="time"><span>Heures cette semaine</span><strong>${num(weekHours)} h</strong><small>${pendingHours.length} à approuver</small></button>
        ` : `
          <button class="kpi" data-go="myTime"><span>Mes heures cette semaine</span><strong>${num(weekHours)} h</strong><small>Semaine du ${fmtShort(weekStart)}</small></button>
          <button class="kpi" data-go="jobs"><span>Mes jobs actifs</span><strong>${myJobs.length}</strong><small>Assignés à moi</small></button>
          <button class="kpi" data-go="mileage"><span>Mes km ce mois</span><strong>${num(sum(store.mileage_trips.filter(m => m.employee_id === me.id && String(m.trip_date).slice(0, 7) === t.slice(0, 7)), m => m.distance_km))} km</strong><small>Professionnels</small></button>
        `}
      </div>

      <div class="grid-2">
        <section class="panel">
          <div class="panel-head"><h2>${admin ? "Jobs en cours" : "Mes jobs"}</h2><button class="link-btn" data-go="jobs">Tous les jobs →</button></div>
          ${myJobs.length ? myJobs.slice(0, 6).map(j => {
            const f = jobFinancials(j);
            return `<button class="job-line" data-job="${j.id}">
              <span><b>${esc(j.name)}</b><small>${esc(clientOf(j)?.name || "Client à confirmer")} · ${fmtShort(j.scheduled_date)}${j.end_date ? ` → ${fmtShort(j.end_date)}` : ""}</small></span>
              <span class="progress"><i style="width:${Number(j.progress) || 0}%"></i></span>
              <span class="right">${admin ? `<b>${money(j.price)}</b><small>marge réelle ${Math.round(f.marginPct)} %</small>` : `<b>${Number(j.progress) || 0} %</b>`}</span>
            </button>`;
          }).join("") : emptyState("Aucun job en cours", admin ? "Crée un job ou passe un job planifié à « En cours »." : "Aucun job ne t'est assigné pour l'instant.")}
        </section>

        <section class="panel">
          <div class="panel-head"><h2>7 prochains jours</h2><button class="link-btn" data-go="calendar">Calendrier →</button></div>
          ${upcoming.length ? `<ul class="agenda">${upcoming.slice(0, 8).map(u => `
            <li ${u.jobId ? `data-job="${u.jobId}"` : ""}><time>${fmtShort(u.date)}${u.time ? `<small>${u.time}</small>` : ""}</time><span><b>${esc(u.title)}</b><small>${esc(u.sub || "")}</small></span></li>`).join("")}</ul>`
            : emptyState("Rien de prévu", "Les rendez-vous et débuts de chantier apparaîtront ici.")}
        </section>
      </div>

      <section class="panel">
        <div class="panel-head"><h2>À faire</h2></div>
        ${alerts.length ? `<ul class="alerts">${alerts.map(a => `<li class="${a.tone}"><button data-alert='${esc(JSON.stringify(a.go))}'>${esc(a.text)} <span>→</span></button></li>`).join("")}</ul>`
          : emptyState("Tout est à jour", "Aucune action en attente.")}
      </section>

      ${!admin ? `<section class="panel"><div class="panel-head"><h2>Mes dernières heures</h2><button class="link-btn" data-go="myTime">Entrer mes heures →</button></div>
        ${weekEntries.length ? weekEntries.slice(0, 6).map(e => `<div class="row-line"><span><b>${esc(entryJob(e))}</b><small>${fmtShort(e.work_date)}</small></span><span>${num(e.hours, 2)} h</span>${badge(e.status, statusTone(e.status))}</div>`).join("") : emptyState("Aucune heure cette semaine")}
      </section>` : ""}
    `;

    el.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
    el.querySelectorAll("[data-job]").forEach(b => b.addEventListener("click", () => go("jobs", b.dataset.job)));
    el.querySelectorAll("[data-alert]").forEach(b => b.addEventListener("click", () => go(...JSON.parse(b.dataset.alert))));
  }
};
