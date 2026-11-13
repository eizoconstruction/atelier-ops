import { store, saveSettings, loadAll } from "../store.js";
import { esc, toast, humanError, downloadCSV, today } from "../util.js";
import { api } from "../api.js";

export default {
  render(el, _p, ctx) {
    const s = store.settings;
    ctx.actions.innerHTML = "";
    const field = (name, label, type = "text", extra = "") => `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(s[name] ?? "")}" ${type === "number" ? 'step="any" inputmode="decimal"' : ""} ${extra}></label>`;
    el.innerHTML = `
      <form id="setForm" class="panel">
        <h2>Entreprise (apparaît sur les devis)</h2>
        <div class="form-grid">
          ${field("company_name", "Nom de l'entreprise")}
          ${field("company_phone", "Téléphone", "tel")}
          ${field("company_email", "Courriel", "email")}
          <label class="field full"><span>Adresse</span><input name="company_address" value="${esc(s.company_address || "")}"></label>
          ${field("tps_number", "No TPS")}
          ${field("tvq_number", "No TVQ")}
        </div>
        <h2>Taux</h2>
        <div class="form-grid">
          ${field("tps_rate", "TPS (%)", "number")}
          ${field("tvq_rate", "TVQ (%)", "number")}
          ${field("mileage_rate", "Allocation kilométrique ($/km)", "number")}
          ${field("default_hourly_rate", "Taux horaire facturé par défaut ($/h)", "number")}
          ${field("default_margin", "Marge visée par défaut (%)", "number")}
          ${field("quote_prefix", "Préfixe des devis")}
          ${field("invoice_prefix", "Préfixe des factures")}
        </div>
        <div class="btn-row"><button class="primary-btn" type="submit">Enregistrer</button></div>
      </form>

      <section class="panel">
        <h2>Données</h2>
        <p class="muted">Mode : <b>${api.mode === "demo" ? "Démo (données dans ce navigateur seulement)" : "Supabase (données partagées et sauvegardées)"}</b></p>
        <div class="btn-row">
          <button class="ghost-btn" id="backup">Télécharger une sauvegarde complète (JSON)</button>
          <button class="ghost-btn" id="reload">Recharger les données</button>
          ${api.mode === "demo" ? `<button class="danger-btn" id="resetDemo">Réinitialiser la démo</button>` : ""}
        </div>
        ${store.errors.length ? `<p class="note warn">Tables non lues : ${store.errors.map(e => `${esc(e.table)} (${esc(e.message)})`).join(" · ")}</p>` : ""}
      </section>`;

    el.querySelector("#setForm").onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const changes = {};
      for (const [k, v] of f.entries()) changes[k] = ["tps_rate", "tvq_rate", "mileage_rate", "default_hourly_rate", "default_margin"].includes(k) ? Number(v) || 0 : v;
      try { await saveSettings(changes); toast("Paramètres enregistrés"); } catch (err) { toast(humanError(err), "error"); }
    };
    el.querySelector("#backup").onclick = () => {
      const data = {};
      ["profiles", "clients", "jobs", "time_entries", "vehicles", "mileage_trips", "job_expenses", "job_files", "job_log_entries", "quotes", "calendar_events"].forEach(t => { data[t] = store[t]; });
      data.app_settings = store.settings;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `atelier-ops-sauvegarde-${today()}.json` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    el.querySelector("#reload").onclick = async () => { await loadAll(); toast("Données rechargées"); };
    el.querySelector("#resetDemo")?.addEventListener("click", () => { api.reset(); location.reload(); });
    void downloadCSV;
  }
};
