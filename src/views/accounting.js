import { store, jobFinancials, clientOf, statusTone, byId, jobName } from "../store.js";
import { esc, money, money2, num, today, fmtShort, fmtMonth, emptyState, badge, sum, downloadCSV, daysBetween } from "../util.js";
import { expenseForm } from "../forms.js";

const ui = { period: today().slice(0, 4), tab: "jobs" };

export default {
  render(el, _p, ctx) { draw(el, ctx); }
};

const inPeriod = d => d && String(d).startsWith(ui.period);

function draw(el, ctx) {
  ctx.actions.innerHTML = `<button class="primary-btn" id="addExp">+ Dépense</button>`;
  ctx.actions.querySelector("#addExp").onclick = () => expenseForm(store.jobs[0]?.id || "");
  const s = store.settings;
  const rate = Number(s.mileage_rate) || 0.7;

  const years = [...new Set([today().slice(0, 4), ...store.jobs.map(j => String(j.scheduled_date || "").slice(0, 4)), ...store.job_expenses.map(x => String(x.expense_date).slice(0, 4))].filter(Boolean))].sort().reverse();
  const months = [...new Set([today().slice(0, 7), ...store.job_expenses.map(x => String(x.expense_date).slice(0, 7)), ...store.jobs.map(j => String(j.invoiced_at || "").slice(0, 7))].filter(m => m.length === 7 && m.startsWith(ui.period.slice(0, 4))))].sort().reverse();

  // ---- période ----
  const invoiced = store.jobs.filter(j => inPeriod(j.invoiced_at));
  const revenue = sum(invoiced, j => j.price);
  const expenses = store.job_expenses.filter(x => inPeriod(x.expense_date));
  const expTotal = sum(expenses, x => x.amount);
  const entries = store.time_entries.filter(e => inPeriod(e.work_date) && e.status !== "Refusé");
  const labor = sum(entries, e => (Number(e.hours) || 0) * (Number(byId("profiles", e.employee_id)?.hourly_cost) || 0));
  const kmCost = sum(store.mileage_trips.filter(t => inPeriod(t.trip_date) && t.trip_type === "Professionnel"), t => t.distance_km) * rate;
  const costs = expTotal + labor + kmCost;
  const tps = revenue * (Number(s.tps_rate) / 100);
  const tvq = revenue * (Number(s.tvq_rate) / 100);
  const receivables = store.jobs.filter(j => j.status === "Facturé" && (Number(j.price) - Number(j.amount_paid)) > 0.5)
    .map(j => ({ j, due: Number(j.price) - Number(j.amount_paid), age: j.invoiced_at ? daysBetween(j.invoiced_at, today()) : 0 }))
    .sort((a, b) => b.age - a.age);

  const jobsRows = store.jobs.filter(j => j.status !== "Annulé" && (inPeriod(j.scheduled_date) || inPeriod(j.invoiced_at) || ["En cours", "À facturer", "Facturé"].includes(j.status)))
    .map(j => ({ j, f: jobFinancials(j) }))
    .sort((a, b) => b.f.price - a.f.price);

  el.innerHTML = `
    <div class="toolbar">
      <select id="year" class="compact">${years.map(y => `<option ${ui.period.slice(0, 4) === y ? "selected" : ""}>${y}</option>`).join("")}</select>
      <select id="month" class="compact"><option value="">Toute l'année</option>${months.map(m => `<option value="${m}" ${ui.period === m ? "selected" : ""}>${fmtMonth(m)}</option>`).join("")}</select>
      <span class="spacer"></span>
      <button class="ghost-btn" id="expQB">Exporter les dépenses (QuickBooks)</button>
    </div>

    <div class="kpis">
      <div class="kpi"><span>Facturé (avant taxes)</span><strong>${money(revenue)}</strong><small>${invoiced.length} facture(s)</small></div>
      <div class="kpi"><span>Coûts de la période</span><strong>${money(costs)}</strong><small>Dépenses ${money(expTotal)} · M-O ${money(labor)} · Km ${money(kmCost)}</small></div>
      <div class="kpi"><span>Profit brut</span><strong class="${revenue - costs < 0 ? "neg" : ""}">${money(revenue - costs)}</strong><small>${revenue ? `${Math.round(((revenue - costs) / revenue) * 100)} %` : ""}</small></div>
      <div class="kpi"><span>Comptes à recevoir</span><strong>${money(sum(receivables, r => r.due))}</strong><small>${receivables.length} facture(s) ouvertes</small></div>
    </div>

    <div class="tabs">${[["jobs", "Rentabilité par job"], ["ar", "Comptes à recevoir"], ["exp", "Dépenses"], ["tax", "Taxes"]].map(([k, l]) => `<button class="tab ${ui.tab === k ? "active" : ""}" data-tab="${k}">${l}</button>`).join("")}</div>
    <section class="panel flush" id="accBody"></section>
    <p class="help">Les coûts de main-d'oeuvre utilisent le coût horaire de chaque employé (Employés et véhicules). Les montants servent au suivi de gestion ; la comptabilité officielle reste dans QuickBooks.</p>`;

  const body = el.querySelector("#accBody");
  if (ui.tab === "jobs") {
    body.innerHTML = jobsRows.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Job</th><th>Statut</th><th class="num">Prix</th><th class="num">Budget</th><th class="num">M-O</th><th class="num">Dépenses</th><th class="num">Km</th><th class="num">Coût réel</th><th class="num">Profit</th><th class="num">Marge</th></tr></thead>
      <tbody>${jobsRows.map(({ j, f }) => `<tr class="clickable" data-job="${j.id}"><td><b>${esc(j.name)}</b><br><small class="muted">${esc(clientOf(j)?.name || "")}</small></td><td>${badge(j.status, statusTone(j.status))}</td>
        <td class="num">${money(f.price)}</td><td class="num">${money(f.budget)}</td><td class="num">${money(f.labor)}</td><td class="num">${money(f.expenses)}</td><td class="num">${money(f.mileage)}</td>
        <td class="num ${f.budget && f.realCost > f.budget ? "neg" : ""}">${money(f.realCost)}</td><td class="num ${f.profit < 0 ? "neg" : ""}">${money(f.profit)}</td><td class="num">${f.price ? Math.round(f.marginPct) + " %" : "—"}</td></tr>`).join("")}
      <tr class="total"><td colspan="2">Total</td><td class="num">${money(sum(jobsRows, r => r.f.price))}</td><td class="num">${money(sum(jobsRows, r => r.f.budget))}</td><td class="num">${money(sum(jobsRows, r => r.f.labor))}</td><td class="num">${money(sum(jobsRows, r => r.f.expenses))}</td><td class="num">${money(sum(jobsRows, r => r.f.mileage))}</td><td class="num">${money(sum(jobsRows, r => r.f.realCost))}</td><td class="num">${money(sum(jobsRows, r => r.f.profit))}</td><td></td></tr>
      </tbody></table></div>` : emptyState("Aucun job pour cette période");
  } else if (ui.tab === "ar") {
    body.innerHTML = receivables.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Facture</th><th>Job</th><th>Client</th><th>Date</th><th class="num">Âge</th><th class="num">Solde (avant taxes)</th><th class="num">Avec taxes</th></tr></thead>
      <tbody>${receivables.map(({ j, due, age }) => `<tr class="clickable" data-job="${j.id}" data-tab-target="billing"><td>${esc(j.invoice_number || "—")}</td><td>${esc(j.name)}</td><td>${esc(clientOf(j)?.name || "")}</td><td>${fmtShort(j.invoiced_at)}</td>
        <td class="num ${age > 60 ? "neg" : ""}">${age} j</td><td class="num">${money2(due)}</td><td class="num">${money2(due * (1 + (Number(s.tps_rate) + Number(s.tvq_rate)) / 100))}</td></tr>`).join("")}</tbody></table></div>`
      : emptyState("Aucun compte à recevoir", "Toutes les factures sont payées.");
  } else if (ui.tab === "exp") {
    body.innerHTML = expenses.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Job</th><th>Catégorie</th><th>Fournisseur</th><th>Description</th><th class="num">Montant</th></tr></thead>
      <tbody>${expenses.sort((a, b) => String(b.expense_date).localeCompare(String(a.expense_date))).map(x => `<tr class="clickable" data-exp="${x.id}"><td>${fmtShort(x.expense_date)}</td><td>${esc(jobName(x.job_id))}</td><td>${esc(x.category)}</td><td>${esc(x.supplier || "")}</td><td>${esc(x.description || "")}</td><td class="num">${money2(x.amount)}</td></tr>`).join("")}
      <tr class="total"><td colspan="5">Total</td><td class="num">${money2(expTotal)}</td></tr></tbody></table></div>` : emptyState("Aucune dépense pour cette période");
  } else {
    body.innerHTML = `<div class="pad">
      <div class="finance-row"><span>Ventes facturées (avant taxes)</span><b>${money2(revenue)}</b></div>
      <div class="finance-row"><span>TPS perçue estimée (${num(s.tps_rate, 3)} %)</span><b>${money2(tps)}</b></div>
      <div class="finance-row"><span>TVQ perçue estimée (${num(s.tvq_rate, 3)} %)</span><b>${money2(tvq)}</b></div>
      <div class="finance-row"><span>Dépenses de la période (avant taxes)</span><b>${money2(expTotal)}</b></div>
      <div class="finance-row"><span>CTI estimés (TPS payée sur dépenses)</span><b>${money2(expTotal * Number(s.tps_rate) / 100)}</b></div>
      <div class="finance-row"><span>RTI estimés (TVQ payée sur dépenses)</span><b>${money2(expTotal * Number(s.tvq_rate) / 100)}</b></div>
      <div class="finance-row total"><span>Net à remettre estimé</span><b>${money2(tps + tvq - expTotal * (Number(s.tps_rate) + Number(s.tvq_rate)) / 100)}</b></div>
      <p class="help">Estimation seulement (suppose que toutes les dépenses sont taxables). Ta déclaration officielle doit partir des chiffres de QuickBooks.</p></div>`;
  }

  el.querySelector("#year").onchange = e => { ui.period = e.target.value; draw(el, ctx); };
  el.querySelector("#month").onchange = e => { ui.period = e.target.value || ui.period.slice(0, 4); draw(el, ctx); };
  el.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { ui.tab = b.dataset.tab; draw(el, ctx); });
  el.querySelectorAll("[data-job]").forEach(r => r.onclick = () => ctx.go("jobs", r.dataset.job, r.dataset.tabTarget || "costs"));
  el.querySelectorAll("[data-exp]").forEach(r => r.onclick = () => { const x = store.job_expenses.find(e => e.id === r.dataset.exp); expenseForm(x.job_id, x); });
  el.querySelector("#expQB").onclick = () => downloadCSV(`depenses-${ui.period}.csv`, [
    ["Date", "Fournisseur", "Catégorie", "Description", "Client / Job", "Montant avant taxes", "TPS estimée", "TVQ estimée"],
    ...expenses.map(x => {
      const j = byId("jobs", x.job_id);
      return [x.expense_date, x.supplier || "", x.category, x.description || "", `${clientOf(j)?.name || ""} — ${j?.name || ""}`, Number(x.amount).toFixed(2), (x.amount * s.tps_rate / 100).toFixed(2), (x.amount * s.tvq_rate / 100).toFixed(2)];
    })
  ]);
}
