import { store, create, patch, destroy, clientOptions, jobOptions, byId, statusTone, nextNumber, clientOf } from "../store.js";
import { esc, money, money2, num, round2, emptyState, badge, toast, today, addDays, fmtDate, fmtShort, humanError, confirmBox, openForm } from "../util.js";

const blankDraft = () => ({
  id: null, number: "", title: "", client_id: "", job_id: "", status: "Brouillon",
  inputs: {
    materials: 0, hours: 0, rate: Number(store.settings.default_hourly_rate) || 75,
    labor_cost_rate: 0, subs: 0, rentals: 0, travel: 0, contingency: 5,
    margin: Number(store.settings.default_margin) || 25, scope: ""
  },
  lines: [],
  valid_until: addDays(today(), 30), notes: ""
});
let draft = null;

export default {
  refreshOnChange: false, // garde le brouillon en cours pendant la saisie
  render(el, _p, ctx) {
    if (!draft) draft = blankDraft();
    draw(el, ctx);
  }
};

function compute(d) {
  const i = d.inputs;
  const laborBilled = (Number(i.hours) || 0) * (Number(i.rate) || 0);
  const direct = (Number(i.materials) || 0) + (Number(i.subs) || 0) + (Number(i.rentals) || 0) + (Number(i.travel) || 0);
  const contingency = direct * ((Number(i.contingency) || 0) / 100);
  // coût interne : main-d'oeuvre au coût réel si connu, sinon au taux facturé
  const laborCost = (Number(i.hours) || 0) * (Number(i.labor_cost_rate) || Number(i.rate) || 0);
  const cost = direct + contingency + laborCost;
  const m = Math.min(90, Math.max(0, Number(i.margin) || 0)) / 100;
  const autoSubtotal = cost / (1 - m);
  const manual = d.lines.length > 0;
  const subtotal = manual ? d.lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0) : autoSubtotal;
  const tps = subtotal * (Number(store.settings.tps_rate) / 100);
  const tvq = subtotal * (Number(store.settings.tvq_rate) / 100);
  const realMargin = subtotal ? ((subtotal - cost) / subtotal) * 100 : 0;
  return { laborBilled, laborCost, direct, contingency, cost: round2(cost), subtotal: round2(subtotal), tps: round2(tps), tvq: round2(tvq), total: round2(subtotal + tps + tvq), realMargin, manual };
}

function draw(el, { go, actions }) {
  actions.innerHTML = `<button class="ghost-btn" id="newQuote">Nouveau devis</button>`;
  actions.querySelector("#newQuote").onclick = () => { draft = blankDraft(); draw(el, { go, actions }); };
  const c = compute(draft);
  const i = draft.inputs;
  const saved = store.quotes.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  el.innerHTML = `
    <div class="grid-quote">
      <section class="panel">
        <div class="panel-head"><h2>${draft.id ? `Devis ${esc(draft.number)}` : "Nouveau devis"}</h2>${draft.id ? badge(draft.status, statusTone(draft.status)) : ""}</div>
        <form id="qForm" class="form-grid" autocomplete="off">
          <label class="field full"><span>Titre du projet *</span><input name="title" value="${esc(draft.title)}" placeholder="ex. Rénovation salle de bain"></label>
          <label class="field"><span>Client</span><select name="client_id"><option value="">—</option>${clientOptions().map(o => `<option value="${o.value}" ${o.value === draft.client_id ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select></label>
          <label class="field"><span>Job lié (facultatif)</span><select name="job_id"><option value="">—</option>${jobOptions(true).map(o => `<option value="${o.value}" ${o.value === draft.job_id ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select></label>
          <h3 class="form-section full">Coûts estimés</h3>
          ${numField("materials", "Matériaux ($)", i.materials)}
          ${numField("subs", "Sous-traitants ($)", i.subs)}
          ${numField("rentals", "Location d'équipement ($)", i.rentals)}
          ${numField("travel", "Déplacements / livraison ($)", i.travel)}
          ${numField("hours", "Heures de main-d'oeuvre", i.hours, "0.5")}
          ${numField("rate", "Taux horaire facturé ($/h)", i.rate)}
          ${numField("labor_cost_rate", "Coût horaire réel ($/h)", i.labor_cost_rate, "0.5", "Salaire + charges. Vide = taux facturé")}
          ${numField("contingency", "Imprévus (% des coûts directs)", i.contingency, "1")}
          ${numField("margin", "Marge visée (%)", i.margin, "1")}
          <label class="field"><span>Valide jusqu'au</span><input type="date" name="valid_until" value="${esc(draft.valid_until || "")}"></label>
          <label class="field full"><span>Description des travaux (apparaît sur le devis)</span><textarea name="scope" rows="4" placeholder="Démolition, plomberie, céramique…">${esc(i.scope)}</textarea></label>
        </form>

        <div class="panel-head"><h3>Lignes du devis ${c.manual ? "" : "<small class='muted'>(facultatif — sinon une seule ligne au prix calculé)</small>"}</h3><button class="ghost-btn small" id="addLine">+ Ligne</button></div>
        ${draft.lines.length ? `<div class="lines">${draft.lines.map((l, n) => `
          <div class="line" data-line="${n}">
            <input data-k="label" value="${esc(l.label)}" placeholder="Description">
            <input data-k="qty" type="number" step="any" inputmode="decimal" value="${esc(l.qty)}" placeholder="Qté">
            <input data-k="unit" value="${esc(l.unit || "")}" placeholder="Unité">
            <input data-k="price" type="number" step="any" inputmode="decimal" value="${esc(l.price)}" placeholder="Prix unit.">
            <b>${money2((Number(l.qty) || 0) * (Number(l.price) || 0))}</b>
            <button class="icon-btn small" data-rmline="${n}" aria-label="Retirer">✕</button>
          </div>`).join("")}</div>` : ""}
      </section>

      <aside class="panel quote-summary">
        <p class="eyebrow">Prix au client</p>
        <div class="quote-total">${money2(c.total)}</div>
        <p class="muted">taxes incluses</p>
        <div class="finance-row"><span>Sous-total</span><b>${money2(c.subtotal)}</b></div>
        <div class="finance-row"><span>TPS ${num(store.settings.tps_rate, 3)} %</span><b>${money2(c.tps)}</b></div>
        <div class="finance-row"><span>TVQ ${num(store.settings.tvq_rate, 3)} %</span><b>${money2(c.tvq)}</b></div>
        <hr>
        <p class="eyebrow">Interne (pas sur le devis)</p>
        <div class="finance-row"><span>Coûts directs</span><b>${money2(c.direct)}</b></div>
        <div class="finance-row"><span>Imprévus</span><b>${money2(c.contingency)}</b></div>
        <div class="finance-row"><span>Main-d'oeuvre (coût)</span><b>${money2(c.laborCost)}</b></div>
        <div class="finance-row total"><span>Coût total estimé</span><b>${money2(c.cost)}</b></div>
        <div class="finance-row total"><span>Profit prévu</span><b class="${c.subtotal - c.cost < 0 ? "neg" : ""}">${money2(c.subtotal - c.cost)} (${Math.round(c.realMargin)} %)</b></div>
        <div class="btn-col">
          <button class="primary-btn full" id="saveQuote">${draft.id ? "Enregistrer les changements" : "Enregistrer le devis"}</button>
          <button class="ghost-btn full" id="printQuote">Imprimer / PDF</button>
          ${draft.id ? `<button class="ghost-btn full" id="toJob">${draft.job_id ? "Mettre le job à jour" : "Convertir en job"}</button>` : ""}
        </div>
      </aside>
    </div>

    <section class="panel flush">
      <div class="panel-head pad"><h2>Devis enregistrés</h2></div>
      ${saved.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>No</th><th>Projet</th><th>Client</th><th>Date</th><th class="num">Total</th><th>Statut</th><th></th></tr></thead>
        <tbody>${saved.map(q => `<tr><td>${esc(q.number || "")}</td><td><b>${esc(q.title)}</b></td><td>${esc(byId("clients", q.client_id)?.name || "—")}</td><td>${fmtShort(String(q.created_at).slice(0, 10))}</td><td class="num">${money(q.total)}</td>
          <td><select class="compact" data-qstatus="${q.id}">${["Brouillon", "Envoyé", "Accepté", "Refusé"].map(s => `<option ${s === q.status ? "selected" : ""}>${s}</option>`).join("")}</select></td>
          <td class="actions"><button class="link-btn" data-qopen="${q.id}">Ouvrir</button><button class="link-btn" data-qprint="${q.id}">PDF</button><button class="link-btn danger" data-qdel="${q.id}">Suppr.</button></td></tr>`).join("")}</tbody></table></div>`
        : emptyState("Aucun devis enregistré", "Remplis le calculateur et clique « Enregistrer le devis ».")}
    </section>`;

  // ---- liaisons ----
  const form = el.querySelector("#qForm");
  form.addEventListener("input", e => {
    const t = e.target;
    if (["title", "client_id", "job_id", "valid_until"].includes(t.name)) draft[t.name] = t.value;
    else if (t.name === "scope") draft.inputs.scope = t.value;
    else if (t.name) draft.inputs[t.name] = t.value === "" ? 0 : Number(t.value);
    refreshSummary(el);
  });
  form.addEventListener("change", e => {
    if (e.target.name === "job_id" && e.target.value && !draft.client_id) {
      draft.client_id = byId("jobs", e.target.value)?.client_id || "";
      draw(el, { go, actions });
    }
  });
  el.querySelector("#addLine").onclick = () => {
    if (!draft.lines.length && compute(draft).subtotal > 0) draft.lines.push({ label: draft.title || "Travaux", qty: 1, unit: "forfait", price: compute(draft).subtotal });
    else draft.lines.push({ label: "", qty: 1, unit: "", price: 0 });
    draw(el, { go, actions });
  };
  el.querySelectorAll("[data-line] input").forEach(inp => inp.addEventListener("input", () => {
    const n = Number(inp.closest("[data-line]").dataset.line);
    draft.lines[n][inp.dataset.k] = inp.type === "number" ? Number(inp.value) : inp.value;
    inp.closest("[data-line]").querySelector("b").textContent = money2((Number(draft.lines[n].qty) || 0) * (Number(draft.lines[n].price) || 0));
    refreshSummary(el);
  }));
  el.querySelectorAll("[data-rmline]").forEach(b => b.onclick = () => { draft.lines.splice(Number(b.dataset.rmline), 1); draw(el, { go, actions }); });

  el.querySelector("#saveQuote").onclick = async () => {
    if (!draft.title.trim()) return toast("Entre le titre du projet", "error");
    const k = compute(draft);
    const row = {
      title: draft.title.trim(), client_id: draft.client_id || null, job_id: draft.job_id || null, status: draft.status,
      inputs: draft.inputs, lines: draft.lines, cost: k.cost, subtotal: k.subtotal, tps: k.tps, tvq: k.tvq, total: k.total,
      valid_until: draft.valid_until || null, notes: draft.notes
    };
    try {
      if (draft.id) { await patch("quotes", draft.id, row); }
      else {
        row.number = nextNumber(store.settings.quote_prefix || "D-", store.quotes.map(q => q.number));
        const s = await create("quotes", row);
        draft.id = s.id; draft.number = s.number;
      }
      toast("Devis enregistré");
      draw(el, { go, actions });
    } catch (e) { toast(humanError(e), "error"); }
  };
  el.querySelector("#printQuote").onclick = () => printQuote({ ...draft, ...compute(draft) });
  el.querySelector("#toJob")?.addEventListener("click", () => convertToJob(go));

  el.querySelectorAll("[data-qopen]").forEach(b => b.onclick = () => { loadDraft(store.quotes.find(q => q.id === b.dataset.qopen)); draw(el, { go, actions }); window.scrollTo({ top: 0, behavior: "smooth" }); });
  el.querySelectorAll("[data-qprint]").forEach(b => b.onclick = () => { const q = store.quotes.find(x => x.id === b.dataset.qprint); printQuote({ ...q, inputs: q.inputs || {}, lines: q.lines || [] }); });
  el.querySelectorAll("[data-qdel]").forEach(b => b.onclick = async () => {
    if (!(await confirmBox("Supprimer ce devis ?", "Supprimer"))) return;
    await destroy("quotes", b.dataset.qdel);
    if (draft.id === b.dataset.qdel) draft = blankDraft();
    draw(el, { go, actions });
  });
  el.querySelectorAll("[data-qstatus]").forEach(s => s.onchange = async () => {
    try {
      await patch("quotes", s.dataset.qstatus, { status: s.value });
      if (draft.id === s.dataset.qstatus) draft.status = s.value;
      toast(`Devis : ${s.value}`);
      if (s.value === "Accepté") {
        const q = store.quotes.find(x => x.id === s.dataset.qstatus);
        if (!q.job_id && (await confirmBox("Devis accepté. Créer le job maintenant ?", "Créer le job"))) { loadDraft(q); await convertToJob(go); return; }
      }
      draw(el, { go, actions });
    } catch (e) { toast(humanError(e), "error"); }
  });
}

function numField(name, label, value, step = "0.01", help = "") {
  return `<label class="field"><span>${label}</span><input type="number" name="${name}" step="${step}" min="0" inputmode="decimal" value="${value || ""}">${help ? `<small class="help">${help}</small>` : ""}</label>`;
}

function refreshSummary(el) {
  const c = compute(draft);
  const box = el.querySelector(".quote-summary");
  const vals = [c.subtotal, c.tps, c.tvq, c.direct, c.contingency, c.laborCost, c.cost];
  box.querySelector(".quote-total").textContent = money2(c.total);
  box.querySelectorAll(".finance-row b").forEach((b, n) => {
    if (n < vals.length) b.textContent = money2(vals[n]);
    else { b.textContent = `${money2(c.subtotal - c.cost)} (${Math.round(c.realMargin)} %)`; b.classList.toggle("neg", c.subtotal - c.cost < 0); }
  });
}

function loadDraft(q) {
  draft = {
    id: q.id, number: q.number, title: q.title, client_id: q.client_id || "", job_id: q.job_id || "", status: q.status,
    inputs: { ...blankDraft().inputs, ...(q.inputs || {}) }, lines: (q.lines || []).map(l => ({ ...l })),
    valid_until: q.valid_until || "", notes: q.notes || ""
  };
}

async function convertToJob(go) {
  const k = compute(draft);
  try {
    let jobId = draft.job_id;
    const row = { price: k.subtotal, cost: k.cost, summary: draft.inputs.scope || null };
    if (jobId) await patch("jobs", jobId, row);
    else {
      const client = byId("clients", draft.client_id);
      const job = await create("jobs", { ...row, name: draft.title, client_id: draft.client_id || null, address: client?.billing_address || null, status: "Planifié", progress: 0, crew_ids: [] });
      jobId = job.id;
    }
    await patch("quotes", draft.id, { job_id: jobId, status: "Accepté" });
    draft.job_id = jobId; draft.status = "Accepté";
    toast("Job créé à partir du devis");
    go("jobs", jobId);
  } catch (e) { toast(humanError(e), "error"); }
}

function printQuote(q) {
  const s = store.settings;
  const client = byId("clients", q.client_id);
  const lines = q.lines?.length ? q.lines : [{ label: q.title || "Travaux", qty: 1, unit: "forfait", price: q.subtotal }];
  const html = `<!doctype html><html lang="fr-CA"><head><meta charset="utf-8"><title>Devis ${esc(q.number || "")} — ${esc(q.title || "")}</title>
  <style>
    @page { size: letter; margin: 18mm; }
    body { font: 12px/1.5 Inter, system-ui, sans-serif; color: #182231; margin: 0; }
    header { display: flex; justify-content: space-between; border-bottom: 3px solid #182231; padding-bottom: 12px; margin-bottom: 18px; }
    h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 14px; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: .06em; color: #a1722c; }
    .muted { color: #647184; } table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { padding: 7px 6px; border-bottom: 1px solid #d8dee8; text-align: left; vertical-align: top; } th { font-size: 11px; text-transform: uppercase; color: #647184; }
    .r { text-align: right; } .totals { width: 280px; margin-left: auto; margin-top: 12px; } .totals td { border: 0; padding: 3px 6px; }
    .grand td { border-top: 2px solid #182231; font-size: 15px; font-weight: 700; padding-top: 8px; }
    .scope { white-space: pre-wrap; } .sign { display: flex; gap: 40px; margin-top: 48px; } .sign div { flex: 1; border-top: 1px solid #182231; padding-top: 6px; }
    footer { margin-top: 30px; font-size: 10px; color: #647184; }
  </style></head><body>
  <header>
    <div><h1>${esc(s.company_name || "Eizo Construction")}</h1><div class="muted">${esc(s.company_address || "")}<br>${esc(s.company_phone || "")} ${esc(s.company_email || "")}</div></div>
    <div class="r"><h1>DEVIS</h1><div>No <b>${esc(q.number || "brouillon")}</b><br>Date : ${fmtDate(today())}${q.valid_until ? `<br>Valide jusqu'au ${fmtDate(q.valid_until)}` : ""}</div></div>
  </header>
  <h2>Client</h2>
  <div>${client ? `<b>${esc(client.name)}</b><br>${esc(client.billing_address || "")}<br>${esc(client.phone || "")} ${esc(client.email || "")}` : "<span class='muted'>À compléter</span>"}</div>
  <h2>Projet</h2><div><b>${esc(q.title || "")}</b></div>
  ${q.inputs?.scope ? `<div class="scope">${esc(q.inputs.scope)}</div>` : ""}
  <table><thead><tr><th>Description</th><th class="r">Qté</th><th>Unité</th><th class="r">Prix unitaire</th><th class="r">Montant</th></tr></thead>
  <tbody>${lines.map(l => `<tr><td>${esc(l.label)}</td><td class="r">${num(l.qty, 2)}</td><td>${esc(l.unit || "")}</td><td class="r">${money2(l.price)}</td><td class="r">${money2((Number(l.qty) || 0) * (Number(l.price) || 0))}</td></tr>`).join("")}</tbody></table>
  <table class="totals">
    <tr><td>Sous-total</td><td class="r">${money2(q.subtotal)}</td></tr>
    <tr><td>TPS (${num(s.tps_rate, 3)} %)${s.tps_number ? `<br><small class="muted">${esc(s.tps_number)}</small>` : ""}</td><td class="r">${money2(q.tps)}</td></tr>
    <tr><td>TVQ (${num(s.tvq_rate, 3)} %)${s.tvq_number ? `<br><small class="muted">${esc(s.tvq_number)}</small>` : ""}</td><td class="r">${money2(q.tvq)}</td></tr>
    <tr class="grand"><td>Total</td><td class="r">${money2(q.total)}</td></tr>
  </table>
  <div class="sign"><div>Signature du client</div><div>Date</div></div>
  <footer>Ce devis est valide ${q.valid_until ? `jusqu'au ${fmtDate(q.valid_until)}` : "30 jours"}. Les travaux non prévus au présent devis feront l'objet d'un avenant.</footer>
  <script>window.onload = () => setTimeout(() => window.print(), 300);<\/script>
  </body></html>`;
  const w = window.open("", "_blank");
  if (!w) return toast("Autorise les fenêtres pop-up pour imprimer le devis.", "error");
  w.document.open();
  w.document.write(html);
  w.document.close();
}
