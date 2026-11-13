import { store, statusTone, OPEN_STATUSES } from "../store.js";
import { esc, money, emptyState, badge, sum, fmtShort, initials, downloadCSV, today } from "../util.js";
import { clientForm, jobForm } from "../forms.js";

const ui = { search: "", selected: null };

export default {
  render(el, params, { go, actions }) {
    if (params[0]) ui.selected = params[0];
    actions.innerHTML = `<button class="ghost-btn" id="expClients">Exporter CSV</button><button class="primary-btn" id="newClient">+ Nouveau client</button>`;
    actions.querySelector("#newClient").onclick = () => clientForm();
    actions.querySelector("#expClients").onclick = () => downloadCSV(`clients-${today()}.csv`, [
      ["Nom", "Téléphone", "Courriel", "Adresse", "Nb jobs", "Valeur totale", "Notes"],
      ...store.clients.map(c => { const js = store.jobs.filter(j => j.client_id === c.id); return [c.name, c.phone || "", c.email || "", c.billing_address || "", js.length, sum(js, j => j.price), c.notes || ""]; })
    ]);

    const q = ui.search.toLowerCase();
    const list = store.clients
      .filter(c => !q || `${c.name} ${c.email || ""} ${c.phone || ""} ${c.billing_address || ""}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
    const sel = store.clients.find(c => c.id === ui.selected) || null;

    el.innerHTML = `
      <div class="split">
        <section class="panel flush list-pane">
          <div class="pad"><input class="search" id="clientSearch" type="search" placeholder="Rechercher un client…" value="${esc(ui.search)}"></div>
          ${list.length ? `<ul class="client-list">${list.map(c => {
            const js = store.jobs.filter(j => j.client_id === c.id);
            const open = js.filter(j => OPEN_STATUSES.includes(j.status)).length;
            return `<li class="${c.id === ui.selected ? "active" : ""}" data-client="${c.id}"><span class="avatar">${esc(initials(c.name))}</span>
              <span><b>${esc(c.name)}</b><small>${js.length} job(s)${open ? ` · ${open} actif(s)` : ""}</small></span><span class="right">${money(sum(js, j => j.price))}</span></li>`;
          }).join("")}</ul>` : emptyState("Aucun client", "Ajoute ton premier client.")}
        </section>
        <section class="panel detail-pane">${sel ? clientDetail(sel) : emptyState("Choisis un client", "Ses coordonnées et l'historique de ses jobs s'afficheront ici.")}</section>
      </div>`;

    const s = el.querySelector("#clientSearch");
    s.oninput = () => { ui.search = s.value; this.render(el, [], { go, actions }); const n = el.querySelector("#clientSearch"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
    el.querySelectorAll("[data-client]").forEach(li => li.onclick = () => { ui.selected = li.dataset.client; this.render(el, [], { go, actions }); el.querySelector(".detail-pane").scrollIntoView({ behavior: "smooth", block: "start" }); });
    el.querySelector("#editClient")?.addEventListener("click", () => clientForm(sel));
    el.querySelector("#clientNewJob")?.addEventListener("click", () => jobForm(null, { client_id: sel.id, address: sel.billing_address, onCreated: j => go("jobs", j.id) }));
    el.querySelectorAll("[data-job]").forEach(r => r.onclick = () => go("jobs", r.dataset.job));
  }
};

function clientDetail(c) {
  const js = store.jobs.filter(j => j.client_id === c.id).sort((a, b) => String(b.scheduled_date || "").localeCompare(String(a.scheduled_date || "")));
  const total = sum(js, j => j.price);
  const paid = sum(js, j => j.amount_paid);
  return `
    <div class="panel-head"><div><h2>${esc(c.name)}</h2><p class="muted">Client depuis ${fmtShort(String(c.created_at).slice(0, 10))}</p></div>
      <span class="btn-row"><button class="ghost-btn small" id="editClient">Modifier</button><button class="primary-btn small" id="clientNewJob">+ Job</button></span></div>
    <div class="contact-grid">
      <div><span>Téléphone</span>${c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : "—"}</div>
      <div><span>Courriel</span>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : "—"}</div>
      <div class="full"><span>Adresse</span>${c.billing_address ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.billing_address)}" target="_blank" rel="noopener">${esc(c.billing_address)}</a>` : "—"}</div>
    </div>
    ${c.notes ? `<p class="note">${esc(c.notes)}</p>` : ""}
    <div class="kpis small">
      <div class="kpi"><span>Valeur totale</span><strong>${money(total)}</strong></div>
      <div class="kpi"><span>Payé</span><strong>${money(paid)}</strong></div>
      <div class="kpi"><span>Jobs</span><strong>${js.length}</strong></div>
    </div>
    <h3>Jobs</h3>
    ${js.length ? js.map(j => `<button class="job-line" data-job="${j.id}"><span><b>${esc(j.name)}</b><small>${fmtShort(j.scheduled_date)}</small></span>${badge(j.status, statusTone(j.status))}<span class="right"><b>${money(j.price)}</b></span></button>`).join("") : "<p class='muted'>Aucun job pour ce client.</p>"}`;
}
