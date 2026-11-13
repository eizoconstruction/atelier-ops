import {
  store, isAdmin, byId, clientOf, jobFinancials, statusTone, JOB_STATUSES, patch, create, destroy,
  entryPerson, personName, tripVehicle, nextNumber
} from "../store.js";
import { esc, money, money2, num, fmtShort, fmtDate, emptyState, badge, sum, toast, today, downloadCSV, openForm, humanError, confirmBox } from "../util.js";
import { jobForm, expenseForm, timeForm, tripForm, eventForm } from "../forms.js";
import { filesGrid, bindFilesGrid, uploadDialog, linkDialog, uploadFiles } from "../files.js";

const ui = { filter: "actifs", search: "", sort: "date" };

export default {
  render(el, params, ctx) {
    const [id, tab] = params;
    if (id) return renderDetail(el, id, tab || "overview", ctx);
    renderList(el, ctx);
  }
};

// ======================= LISTE =======================
function renderList(el, { go, actions }) {
  const admin = isAdmin();
  if (admin) {
    actions.innerHTML = `<button class="primary-btn" id="newJob">+ Nouveau job</button>`;
    actions.querySelector("#newJob").onclick = () => jobForm(null, { onCreated: j => go("jobs", j.id) });
  }
  const filters = [
    ["actifs", "Actifs"], ["Soumission", "Soumission"], ["Planifié", "Planifiés"], ["En cours", "En cours"],
    ["À facturer", "À facturer"], ["Facturé", "Facturés"], ["Payé", "Payés"], ["tous", "Tous"]
  ];
  let rows = store.jobs.filter(j => {
    if (!admin && !(j.crew_ids || []).includes(store.me.id)) return false;
    if (ui.filter === "actifs") return !["Payé", "Annulé"].includes(j.status);
    if (ui.filter === "tous") return true;
    return j.status === ui.filter;
  });
  const q = ui.search.toLowerCase();
  if (q) rows = rows.filter(j => `${j.name} ${clientOf(j)?.name || ""} ${j.address || ""} ${j.invoice_number || ""}`.toLowerCase().includes(q));
  rows.sort((a, b) => ui.sort === "price" ? (b.price || 0) - (a.price || 0) : ui.sort === "name" ? a.name.localeCompare(b.name) : String(b.scheduled_date || "").localeCompare(String(a.scheduled_date || "")));

  el.innerHTML = `
    <div class="toolbar">
      <input class="search" id="jobSearch" type="search" placeholder="Rechercher un job, client, adresse…" value="${esc(ui.search)}">
      <div class="chips">${filters.map(([v, l]) => `<button class="chip ${ui.filter === v ? "active" : ""}" data-filter="${esc(v)}">${l} <small>${countFor(v)}</small></button>`).join("")}</div>
      <select id="jobSort" class="compact"><option value="date">Tri : date</option><option value="name" ${ui.sort === "name" ? "selected" : ""}>Tri : nom</option>${admin ? `<option value="price" ${ui.sort === "price" ? "selected" : ""}>Tri : prix</option>` : ""}</select>
      ${admin ? `<button class="ghost-btn" id="exportJobs">Exporter CSV</button>` : ""}
    </div>
    <section class="panel flush">
      ${rows.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Job</th><th>Client</th><th>Statut</th><th>Dates</th><th>Avancement</th>${admin ? "<th class='num'>Prix</th><th class='num'>Coût réel</th><th class='num'>Marge</th>" : ""}</tr></thead>
        <tbody>${rows.map(j => {
          const f = admin ? jobFinancials(j) : null;
          return `<tr class="clickable" data-job="${j.id}">
            <td><b>${esc(j.name)}</b><br><small class="muted">${esc(j.address || "")}</small></td>
            <td>${esc(clientOf(j)?.name || "—")}</td>
            <td>${badge(j.status, statusTone(j.status))}</td>
            <td><small>${fmtShort(j.scheduled_date)}${j.end_date ? ` → ${fmtShort(j.end_date)}` : ""}</small></td>
            <td><span class="progress small"><i style="width:${Number(j.progress) || 0}%"></i></span> <small>${Number(j.progress) || 0} %</small></td>
            ${admin ? `<td class="num">${money(j.price)}</td><td class="num">${money(f.realCost)}</td><td class="num ${f.marginPct < 15 && f.realCost ? "neg" : ""}">${f.realCost ? Math.round(f.marginPct) + " %" : "—"}</td>` : ""}
          </tr>`;
        }).join("")}</tbody></table></div>`
        : emptyState("Aucun job", admin ? "Crée un job avec « + Nouveau job »." : "Aucun job ne correspond.")}
    </section>`;

  const search = el.querySelector("#jobSearch");
  search.oninput = () => { ui.search = search.value; renderList(el, { go, actions }); el.querySelector("#jobSearch").focus(); const s = el.querySelector("#jobSearch"); s.setSelectionRange(s.value.length, s.value.length); };
  el.querySelectorAll("[data-filter]").forEach(b => b.onclick = () => { ui.filter = b.dataset.filter; renderList(el, { go, actions }); });
  el.querySelector("#jobSort").onchange = e => { ui.sort = e.target.value; renderList(el, { go, actions }); };
  el.querySelectorAll("[data-job]").forEach(r => r.onclick = () => go("jobs", r.dataset.job));
  el.querySelector("#exportJobs")?.addEventListener("click", () => {
    downloadCSV(`jobs-${today()}.csv`, [
      ["Job", "Client", "Adresse", "Statut", "Début", "Fin", "Prix", "Budget coûts", "Heures", "Main-d'oeuvre", "Dépenses", "Kilométrage", "Coût réel", "Profit", "Marge %", "Facture", "Payé"],
      ...rows.map(j => { const f = jobFinancials(j); return [j.name, clientOf(j)?.name || "", j.address || "", j.status, j.scheduled_date || "", j.end_date || "", j.price, j.cost, f.hours, f.labor.toFixed(2), f.expenses.toFixed(2), f.mileage.toFixed(2), f.realCost.toFixed(2), f.profit.toFixed(2), Math.round(f.marginPct), j.invoice_number || "", j.amount_paid || 0]; })
    ]);
  });
}

function countFor(v) {
  const visible = isAdmin() ? store.jobs : store.jobs.filter(j => (j.crew_ids || []).includes(store.me.id));
  if (v === "tous") return visible.length;
  if (v === "actifs") return visible.filter(j => !["Payé", "Annulé"].includes(j.status)).length;
  return visible.filter(j => j.status === v).length;
}

// ======================= DÉTAIL =======================
function renderDetail(el, id, tab, { go, actions }) {
  const job = byId("jobs", id);
  if (!job) { el.innerHTML = emptyState("Job introuvable", "Il a peut-être été supprimé.", `<button class="ghost-btn" onclick="location.hash='#/jobs'">Retour aux jobs</button>`); return; }
  const admin = isAdmin();
  const client = clientOf(job);
  const f = jobFinancials(job);
  const tabs = [
    ["overview", "Aperçu"],
    ...(admin ? [["costs", "Coûts et marge"]] : []),
    ["time", "Heures"], ["mileage", "Kilométrage"], ["files", "Fichiers"], ["log", "Journal"],
    ...(admin ? [["billing", "Facturation"]] : [])
  ];
  if (!tabs.some(t => t[0] === tab)) tab = "overview";

  actions.innerHTML = `<button class="ghost-btn" id="backJobs">← Jobs</button>${admin ? `<button class="primary-btn" id="editJob">Modifier</button>` : ""}`;
  actions.querySelector("#backJobs").onclick = () => go("jobs");
  actions.querySelector("#editJob")?.addEventListener("click", () => jobForm(job));

  el.innerHTML = `
    <section class="panel job-hero">
      <div class="job-hero-main">
        <p class="eyebrow">${esc(client?.name || "Client à confirmer")}</p>
        <h2>${esc(job.name)}</h2>
        <p class="muted">${esc(job.address || "Adresse à compléter")}${job.address ? ` · <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}" target="_blank" rel="noopener">Itinéraire</a>` : ""}</p>
        <div class="hero-badges">${badge(job.status, statusTone(job.status))} <span class="muted">${fmtDate(job.scheduled_date)}${job.end_date ? ` → ${fmtDate(job.end_date)}` : ""}</span></div>
      </div>
      <div class="job-hero-side">
        ${admin ? `<label class="field inline"><span>Statut</span><select id="quickStatus">${JOB_STATUSES.map(s => `<option ${s === job.status ? "selected" : ""}>${s}</option>`).join("")}</select></label>` : ""}
        <label class="field inline"><span>Avancement : <b id="progVal">${Number(job.progress) || 0} %</b></span><input type="range" id="quickProgress" min="0" max="100" step="5" value="${Number(job.progress) || 0}" ${admin ? "" : "disabled"}></label>
      </div>
    </section>
    ${admin ? `<div class="kpis small">
      <div class="kpi"><span>Prix</span><strong>${money(f.price)}</strong></div>
      <div class="kpi"><span>Coût réel</span><strong>${money(f.realCost)}</strong><small>${f.budget ? `${Math.round(f.budgetUsed)} % du budget` : "Pas de budget"}</small></div>
      <div class="kpi"><span>Profit</span><strong class="${f.profit < 0 ? "neg" : ""}">${money(f.profit)}</strong><small>${f.realCost ? `Marge ${Math.round(f.marginPct)} %` : ""}</small></div>
      <div class="kpi"><span>Solde à recevoir</span><strong>${money(f.balance)}</strong><small>Payé ${money(f.paid)}</small></div>
    </div>` : ""}
    <div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${k === tab ? "active" : ""}" data-tab="${k}">${l}</button>`).join("")}</div>
    <div id="tabBody"></div>`;

  el.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => go("jobs", id, b.dataset.tab));
  const qs = el.querySelector("#quickStatus");
  if (qs) qs.onchange = async () => {
    const changes = { status: qs.value };
    if (qs.value === "En cours" && !job.scheduled_date) changes.scheduled_date = today();
    if (qs.value === "Payé") { changes.progress = 100; changes.amount_paid = job.price; changes.paid_at = today(); }
    try { await patch("jobs", id, changes); toast(`Statut : ${qs.value}`); } catch (e) { toast(humanError(e), "error"); }
  };
  const qp = el.querySelector("#quickProgress");
  qp.oninput = () => { el.querySelector("#progVal").textContent = `${qp.value} %`; };
  qp.onchange = async () => { try { await patch("jobs", id, { progress: Number(qp.value) }); } catch (e) { toast(humanError(e), "error"); } };

  const body = el.querySelector("#tabBody");
  ({ overview, costs, time: timeTab, mileage: mileageTab, files: filesTab, log: logTab, billing }[tab])(body, job, f, go);
}

function overview(body, job, f) {
  const crew = (job.crew_ids || []).map(personName).filter(Boolean);
  const events = store.calendar_events.filter(e => e.job_id === job.id).sort((a, b) => a.event_date.localeCompare(b.event_date));
  const client = clientOf(job);
  body.innerHTML = `
    <div class="grid-2">
      <section class="panel">
        <h3>Description des travaux</h3>
        <p class="pre">${esc(job.summary || "Aucune description.")}</p>
        <h3>Équipe</h3>
        <p>${crew.length ? crew.map(n => `<span class="pill">${esc(n)}</span>`).join(" ") : "<span class='muted'>Personne d'assigné</span>"}</p>
        ${job.drive_url ? `<h3>Dossier</h3><p><a class="ghost-btn" href="${esc(job.drive_url)}" target="_blank" rel="noopener">Ouvrir le dossier Google Drive ↗</a></p>` : ""}
      </section>
      <section class="panel">
        <h3>Client</h3>
        ${client ? `<p><b>${esc(client.name)}</b><br>
          ${client.phone ? `<a href="tel:${esc(client.phone)}">${esc(client.phone)}</a><br>` : ""}
          ${client.email ? `<a href="mailto:${esc(client.email)}">${esc(client.email)}</a><br>` : ""}
          <span class="muted">${esc(client.billing_address || "")}</span></p>
          ${client.notes ? `<p class="note">${esc(client.notes)}</p>` : ""}` : "<p class='muted'>Aucun client lié.</p>"}
        <div class="panel-head"><h3>Événements</h3>${isAdmin() ? `<button class="link-btn" id="addEvent">+ Ajouter</button>` : ""}</div>
        ${events.length ? `<ul class="agenda">${events.map(e => `<li data-ev="${e.id}"><time>${fmtShort(e.event_date)}<small>${(e.start_time || "").slice(0, 5)}</small></time><span><b>${esc(e.title)}</b><small>${esc(e.kind)}</small></span></li>`).join("")}</ul>` : "<p class='muted'>Aucun événement.</p>"}
      </section>
    </div>`;
  body.querySelector("#addEvent")?.addEventListener("click", () => eventForm(null, { job_id: job.id }));
  if (isAdmin()) body.querySelectorAll("[data-ev]").forEach(li => li.onclick = () => eventForm(store.calendar_events.find(e => e.id === li.dataset.ev)));
}

function costs(body, job, f) {
  const exps = store.job_expenses.filter(x => x.job_id === job.id).sort((a, b) => String(b.expense_date).localeCompare(String(a.expense_date)));
  const byCat = exps.reduce((m, x) => { m[x.category] = (m[x.category] || 0) + Number(x.amount); return m; }, {});
  const noRate = store.time_entries.some(e => e.job_id === job.id && !Number(byId("profiles", e.employee_id)?.hourly_cost));
  body.innerHTML = `
    <div class="grid-2">
      <section class="panel">
        <h3>Budget vs réel</h3>
        <div class="cost-bars">
          ${bar("Main-d'oeuvre", f.labor, `${num(f.hours)} h`)}
          ${bar("Dépenses", f.expenses, `${exps.length} facture(s)`)}
          ${bar("Kilométrage", f.mileage, `${num(f.km)} km`)}
        </div>
        <div class="finance-row total"><span>Coût réel total</span><b>${money2(f.realCost)}</b></div>
        <div class="finance-row"><span>Budget prévu</span><b>${money2(f.budget)}</b></div>
        <div class="meter ${f.budgetUsed > 100 ? "over" : f.budgetUsed > 90 ? "warn" : ""}"><i style="width:${Math.min(100, f.budgetUsed)}%"></i></div>
        <div class="finance-row"><span>Prix du contrat</span><b>${money2(f.price)}</b></div>
        <div class="finance-row total"><span>Profit actuel</span><b class="${f.profit < 0 ? "neg" : ""}">${money2(f.profit)} (${Math.round(f.marginPct)} %)</b></div>
        ${noRate ? `<p class="note warn">Certains employés n'ont pas de coût horaire : leurs heures comptent pour 0 $. Ajoute-le dans <a href="#/team">Employés</a>.</p>` : ""}
      </section>
      <section class="panel">
        <div class="panel-head"><h3>Dépenses par catégorie</h3></div>
        ${Object.keys(byCat).length ? Object.entries(byCat).map(([c, v]) => `<div class="finance-row"><span>${esc(c)}</span><b>${money2(v)}</b></div>`).join("") : "<p class='muted'>Aucune dépense.</p>"}
      </section>
    </div>
    <section class="panel flush">
      <div class="panel-head pad"><h3>Dépenses (factures fournisseurs, sous-traitants)</h3><button class="primary-btn small" id="addExp">+ Dépense</button></div>
      ${exps.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Catégorie</th><th>Fournisseur</th><th>Description</th><th class="num">Montant</th></tr></thead>
      <tbody>${exps.map(x => `<tr class="clickable" data-exp="${x.id}"><td>${fmtShort(x.expense_date)}</td><td>${esc(x.category)}</td><td>${esc(x.supplier || "")}</td><td>${esc(x.description || "")}</td><td class="num">${money2(x.amount)}</td></tr>`).join("")}</tbody></table></div>` : emptyState("Aucune dépense", "Ajoute les factures de matériaux et de sous-traitants pour suivre ta marge réelle.")}
    </section>`;
  body.querySelector("#addExp").onclick = () => expenseForm(job.id);
  body.querySelectorAll("[data-exp]").forEach(r => r.onclick = () => expenseForm(job.id, store.job_expenses.find(x => x.id === r.dataset.exp)));

  function bar(label, value, sub) {
    const max = Math.max(f.realCost, f.budget, 1);
    return `<div class="cost-bar"><span>${label}<small>${sub}</small></span><span class="bar"><i style="width:${(value / max) * 100}%"></i></span><b>${money(value)}</b></div>`;
  }
}

function timeTab(body, job) {
  const admin = isAdmin();
  const entries = store.time_entries.filter(e => e.job_id === job.id).sort((a, b) => String(b.work_date).localeCompare(String(a.work_date)));
  const byPerson = entries.reduce((m, e) => { const n = entryPerson(e); m[n] = (m[n] || 0) + Number(e.hours); return m; }, {});
  body.innerHTML = `
    <section class="panel flush">
      <div class="panel-head pad"><h3>${num(sum(entries, e => e.hours))} h au total</h3><button class="primary-btn small" id="addTime">+ Heures</button></div>
      ${Object.keys(byPerson).length ? `<div class="pad pills">${Object.entries(byPerson).map(([n, h]) => `<span class="pill">${esc(n)} : <b>${num(h)} h</b></span>`).join(" ")}</div>` : ""}
      ${entries.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th>${admin ? "<th>Employé</th>" : ""}<th>Horaire</th><th class="num">Heures</th><th>Statut</th><th>Note</th></tr></thead>
      <tbody>${entries.map(e => `<tr class="clickable" data-time="${e.id}"><td>${fmtShort(e.work_date)}</td>${admin ? `<td>${esc(entryPerson(e))}</td>` : ""}<td><small>${(e.start_time || "").slice(0, 5)}${e.end_time ? `–${e.end_time.slice(0, 5)}` : ""}</small></td><td class="num">${num(e.hours, 2)}</td><td>${badge(e.status, statusTone(e.status))}</td><td><small>${esc(e.notes || "")}</small></td></tr>`).join("")}</tbody></table></div>` : emptyState("Aucune heure sur ce job")}
    </section>`;
  body.querySelector("#addTime").onclick = () => timeForm(null, { job_id: job.id });
  body.querySelectorAll("[data-time]").forEach(r => r.onclick = () => timeForm(store.time_entries.find(e => e.id === r.dataset.time)));
}

function mileageTab(body, job) {
  const trips = store.mileage_trips.filter(t => t.job_id === job.id).sort((a, b) => String(b.trip_date).localeCompare(String(a.trip_date)));
  body.innerHTML = `
    <section class="panel flush">
      <div class="panel-head pad"><h3>${num(sum(trips, t => t.distance_km))} km pour ce job</h3><button class="primary-btn small" id="addTrip">+ Trajet</button></div>
      ${trips.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Conducteur</th><th>Véhicule</th><th>Trajet</th><th class="num">km</th></tr></thead>
      <tbody>${trips.map(t => `<tr class="clickable" data-trip="${t.id}"><td>${fmtShort(t.trip_date)}</td><td>${esc(personName(t.employee_id) || t.employee_name || "")}</td><td>${esc(tripVehicle(t))}</td><td><small>${esc(t.start_label || "")} → ${esc(t.end_label || "")}</small></td><td class="num">${num(t.distance_km)}</td></tr>`).join("")}</tbody></table></div>` : emptyState("Aucun trajet lié à ce job")}
    </section>`;
  body.querySelector("#addTrip").onclick = () => tripForm(null, { job_id: job.id });
  body.querySelectorAll("[data-trip]").forEach(r => r.onclick = () => {
    const t = store.mileage_trips.find(x => x.id === r.dataset.trip);
    if (isAdmin() || t.employee_id === store.me.id) tripForm(t);
  });
}

function filesTab(body, job) {
  const files = store.job_files.filter(x => x.job_id === job.id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const cats = ["tous", ...new Set(files.map(x => x.category))];
  const current = body.dataset.cat && cats.includes(body.dataset.cat) ? body.dataset.cat : "tous";
  const shown = current === "tous" ? files : files.filter(x => x.category === current);
  body.innerHTML = `
    <section class="panel">
      <div class="panel-head"><div class="chips">${cats.map(c => `<button class="chip ${c === current ? "active" : ""}" data-cat="${c}">${c === "tous" ? "Tous" : esc(({ photo: "Photos", plan: "Plans", contract: "Contrats", quote: "Devis", invoice: "Factures", document: "Documents", other: "Autres" })[c] || c)}</button>`).join("")}</div>
        <span class="btn-row"><button class="ghost-btn small" id="addLink">+ Lien</button><button class="primary-btn small" id="addFile">+ Fichiers / photos</button></span></div>
      <div id="drop" class="dropzone">Glisse des fichiers ici</div>
      ${filesGrid(shown)}
    </section>`;
  body.querySelectorAll("[data-cat]").forEach(b => b.onclick = () => { body.dataset.cat = b.dataset.cat; filesTab(body, job); });
  body.querySelector("#addFile").onclick = () => uploadDialog(job.id);
  body.querySelector("#addLink").onclick = () => linkDialog(job.id);
  bindFilesGrid(body);
  const drop = body.querySelector("#drop");
  const panel = drop.parentElement;
  panel.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("on"); });
  panel.addEventListener("dragleave", () => drop.classList.remove("on"));
  panel.addEventListener("drop", async e => {
    e.preventDefault();
    drop.classList.remove("on");
    if (e.dataTransfer.files.length) uploadFiles(job.id, [...e.dataTransfer.files]);
  });
}

function logTab(body, job) {
  const logs = store.job_log_entries.filter(x => x.job_id === job.id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  body.innerHTML = `
    <section class="panel">
      <form id="logForm" class="log-form">
        <textarea name="body" rows="2" placeholder="Note de chantier : travaux faits, problème, décision du client…" required></textarea>
        <button class="primary-btn" type="submit">Ajouter</button>
      </form>
      ${logs.length ? `<ul class="timeline">${logs.map(l => `<li><div><b>${esc(personName(l.author_id) || "—")}</b> <small class="muted">${new Date(l.created_at).toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" })}</small>
        ${isAdmin() || l.author_id === store.me.id ? `<button class="icon-btn small" data-dellog="${l.id}" aria-label="Supprimer">✕</button>` : ""}</div><p class="pre">${esc(l.body)}</p></li>`).join("")}</ul>` : emptyState("Journal vide", "Garde une trace des décisions et imprévus du chantier.")}
    </section>`;
  body.querySelector("#logForm").onsubmit = async e => {
    e.preventDefault();
    const text = e.target.body.value.trim();
    if (!text) return;
    try { await create("job_log_entries", { job_id: job.id, author_id: store.me.id, body: text }); toast("Note ajoutée"); }
    catch (err) { toast(humanError(err), "error"); }
  };
  body.querySelectorAll("[data-dellog]").forEach(b => b.onclick = async () => {
    if (!(await confirmBox("Supprimer cette note ?", "Supprimer"))) return;
    try { await destroy("job_log_entries", b.dataset.dellog); } catch (err) { toast(humanError(err), "error"); }
  });
}

function billing(body, job, f) {
  const s = store.settings;
  const tps = f.price * (Number(s.tps_rate) / 100);
  const tvq = f.price * (Number(s.tvq_rate) / 100);
  const quotes = store.quotes.filter(q => q.job_id === job.id);
  body.innerHTML = `
    <div class="grid-2">
      <section class="panel">
        <h3>Facture</h3>
        <div class="finance-row"><span>Montant du contrat</span><b>${money2(f.price)}</b></div>
        <div class="finance-row"><span>TPS (${num(s.tps_rate, 3)} %)</span><b>${money2(tps)}</b></div>
        <div class="finance-row"><span>TVQ (${num(s.tvq_rate, 3)} %)</span><b>${money2(tvq)}</b></div>
        <div class="finance-row total"><span>Total avec taxes</span><b>${money2(f.price + tps + tvq)}</b></div>
        <div class="finance-row"><span>No de facture</span><b>${esc(job.invoice_number || "—")}</b></div>
        <div class="finance-row"><span>Facturé le</span><b>${job.invoiced_at ? fmtDate(job.invoiced_at) : "—"}</b></div>
        <div class="finance-row"><span>Reçu à ce jour</span><b>${money2(f.paid)}</b></div>
        <div class="finance-row total"><span>Solde (avant taxes)</span><b>${money2(f.balance)}</b></div>
        <div class="btn-row">
          <button class="primary-btn" id="invoiceBtn">${job.invoice_number ? "Modifier la facturation" : "Marquer comme facturé"}</button>
          <button class="ghost-btn" id="payBtn">Enregistrer un paiement</button>
        </div>
        <p class="help">La facture elle-même se fait dans QuickBooks ; ici on suit le numéro, la date et les paiements.</p>
      </section>
      <section class="panel">
        <h3>Devis liés</h3>
        ${quotes.length ? quotes.map(q => `<div class="row-line"><span><b>${esc(q.number || "")} ${esc(q.title)}</b><small>${fmtShort(String(q.created_at).slice(0, 10))}</small></span><span>${money(q.total)}</span>${badge(q.status, statusTone(q.status))}</div>`).join("") : "<p class='muted'>Aucun devis lié. Crée-en un dans « Estimation et devis ».</p>"}
      </section>
    </div>`;
  body.querySelector("#invoiceBtn").onclick = () => openForm({
    title: "Facturation",
    fields: [
      { name: "invoice_number", label: "No de facture (QuickBooks)", required: true },
      { name: "invoiced_at", label: "Date de la facture", type: "date", required: true },
      { name: "price", label: "Montant facturé (avant taxes)", type: "number", step: "0.01" }
    ],
    values: { invoice_number: job.invoice_number || nextNumber(s.invoice_prefix || "F-", store.jobs.map(j => j.invoice_number)), invoiced_at: job.invoiced_at || today(), price: job.price },
    onSubmit: async d => {
      await patch("jobs", job.id, { invoice_number: d.invoice_number, invoiced_at: d.invoiced_at, price: Number(d.price) || job.price, status: ["Payé"].includes(job.status) ? job.status : "Facturé" });
      toast("Job marqué comme facturé");
    }
  });
  body.querySelector("#payBtn").onclick = () => openForm({
    title: "Paiement reçu",
    fields: [
      { name: "amount", label: "Montant reçu (avant taxes)", type: "number", step: "0.01", required: true },
      { name: "date", label: "Date", type: "date", required: true }
    ],
    values: { amount: Math.max(0, f.balance), date: today() },
    onSubmit: async d => {
      const paid = (Number(job.amount_paid) || 0) + Number(d.amount);
      const changes = { amount_paid: Math.round(paid * 100) / 100 };
      if (paid >= (Number(job.price) || 0) - 0.5) { changes.status = "Payé"; changes.paid_at = d.date; }
      await patch("jobs", job.id, changes);
      toast(changes.status === "Payé" ? "Job payé en entier 🎉" : "Paiement enregistré");
    }
  });
}
