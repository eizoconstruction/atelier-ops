import { store, patch, create, destroy } from "../store.js";
import { esc, money2, num, emptyState, badge, initials, openForm, toast, sum, startOfWeek, addDays, today } from "../util.js";
import { api } from "../api.js";

export default {
  render(el, _p, ctx) { draw(el, ctx); }
};

function draw(el, ctx) {
  ctx.actions.innerHTML = `<button class="ghost-btn" id="addVehicle">+ Véhicule</button><button class="primary-btn" id="addEmp">+ Employé</button>`;
  ctx.actions.querySelector("#addVehicle").onclick = () => vehicleForm();
  ctx.actions.querySelector("#addEmp").onclick = () => addEmployeeHelp();
  const ws = startOfWeek();
  const we = addDays(ws, 6);
  const people = store.profiles.slice().sort((a, b) => (a.active === false) - (b.active === false) || (a.role === "admin" ? -1 : 1) || a.full_name.localeCompare(b.full_name));

  el.innerHTML = `
    <section class="panel">
      <div class="panel-head"><h2>Employés</h2><small class="muted">${people.filter(p => p.active !== false).length} actif(s)</small></div>
      <div class="team-grid">${people.map(p => {
        const wk = sum(store.time_entries.filter(e => e.employee_id === p.id && e.work_date >= ws && e.work_date <= we), e => e.hours);
        const jobs = store.jobs.filter(j => (j.crew_ids || []).includes(p.id) && !["Payé", "Annulé"].includes(j.status)).length;
        return `<button class="team-card ${p.active === false ? "inactive" : ""}" data-emp="${p.id}">
          <span class="avatar big">${esc(initials(p.full_name))}</span>
          <span class="team-info"><b>${esc(p.full_name)}</b><small>${esc(p.title || (p.role === "admin" ? "Administrateur" : "Employé"))}</small>
            <small>${esc(p.email || "")}${p.phone ? ` · ${esc(p.phone)}` : ""}</small></span>
          <span class="team-stats">
            ${badge(p.role === "admin" ? "Admin" : "Employé", p.role === "admin" ? "invoice" : "plan")}
            ${p.active === false ? badge("Désactivé", "muted") : ""}
            <small>${num(wk)} h cette sem. · ${jobs} job(s) · ${Number(p.hourly_cost) ? `${money2(p.hourly_cost)}/h` : "<span class='neg'>coût horaire ?</span>"}</small>
          </span>
        </button>`;
      }).join("")}</div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Véhicules</h2></div>
      ${store.vehicles.length ? `<div class="team-grid">${store.vehicles.map(v => {
        const km = sum(store.mileage_trips.filter(t => t.vehicle_id === v.id && String(t.trip_date).startsWith(today().slice(0, 4))), t => t.distance_km);
        return `<button class="team-card ${v.active === false ? "inactive" : ""}" data-veh="${v.id}"><span class="avatar big">🚚</span><span class="team-info"><b>${esc(v.name)}</b><small>${esc(v.plate || "Sans plaque")}</small><small>${num(km)} km cette année</small></span>${v.active === false ? badge("Retiré", "muted") : ""}</button>`;
      }).join("")}</div>` : emptyState("Aucun véhicule", "Ajoute tes camions et remorques pour le registre de kilométrage.")}
    </section>`;

  el.querySelectorAll("[data-emp]").forEach(b => b.onclick = () => employeeForm(store.profiles.find(p => p.id === b.dataset.emp)));
  el.querySelectorAll("[data-veh]").forEach(b => b.onclick = () => vehicleForm(store.vehicles.find(v => v.id === b.dataset.veh)));
}

function employeeForm(p) {
  const isMe = p.id === store.me.id;
  return openForm({
    title: `Employé : ${p.full_name}`,
    fields: [
      { name: "full_name", label: "Nom complet", required: true },
      { name: "title", label: "Poste", placeholder: "ex. Charpentier-menuisier" },
      { name: "phone", label: "Téléphone", type: "tel" },
      { name: "email", label: "Courriel (connexion)", type: "email", help: "Le courriel de connexion se change dans Supabase > Authentication." },
      { name: "hourly_cost", label: "Coût horaire ($/h)", type: "number", step: "0.01", min: 0, help: "Salaire + charges sociales (environ +15 à 20 %). Sert au calcul des marges, n'est jamais montré aux employés." },
      { name: "role", label: "Accès", type: "select", placeholder: false, options: [{ value: "employee", label: "Employé (ses heures, ses trajets)" }, { value: "admin", label: "Administrateur (tout)" }] },
      { name: "active", label: "Compte actif (décocher pour bloquer l'accès sans effacer l'historique)", type: "checkbox", full: true }
    ],
    values: { ...p, active: p.active !== false },
    onSubmit: async d => {
      if (isMe && (d.role !== "admin" || !d.active)) throw new Error("Tu ne peux pas retirer ton propre accès admin.");
      await patch("profiles", p.id, { full_name: d.full_name, title: d.title, phone: d.phone, email: d.email, hourly_cost: Number(d.hourly_cost) || 0, role: d.role, active: d.active });
      toast("Employé mis à jour");
    }
  });
}

function addEmployeeHelp() {
  const demo = api.mode === "demo";
  return openForm({
    title: "Ajouter un employé",
    fields: demo
      ? [{ name: "full_name", label: "Nom complet", required: true }, { name: "email", label: "Courriel", type: "email" }, { name: "title", label: "Poste" }, { name: "hourly_cost", label: "Coût horaire ($/h)", type: "number", step: "0.01" }]
      : [{ name: "info", label: "Étapes", type: "static", full: true, default: STEPS }],
    submitLabel: demo ? "Ajouter" : "Compris",
    onSubmit: async d => {
      if (!demo) return;
      await create("profiles", { full_name: d.full_name, email: d.email, title: d.title, hourly_cost: Number(d.hourly_cost) || 0, role: "employee", active: true });
      toast("Employé ajouté (démo)");
    }
  }).then(() => {});
}
const STEPS = `1. Ouvre supabase.com > ton projet > Authentication > Users.
2. Clique « Add user » > « Create new user ». Entre son courriel et un mot de passe temporaire, coche « Auto Confirm User ».
3. Reviens ici et recharge la page : l'employé apparaît automatiquement (rôle Employé).
4. Clique sur sa fiche pour ajouter son nom, son poste et son coût horaire.
5. Envoie-lui l'adresse de l'app, son courriel et son mot de passe temporaire. Il pourra le changer avec « Mot de passe oublié ».`;

function vehicleForm(v = null) {
  return openForm({
    title: v ? "Modifier le véhicule" : "Nouveau véhicule",
    fields: [
      { name: "name", label: "Nom", required: true, placeholder: "ex. Ford F-150 2021" },
      { name: "plate", label: "Plaque" },
      { name: "notes", label: "Notes", type: "textarea", rows: 2 },
      { name: "active", label: "En service", type: "checkbox" }
    ],
    values: v ? { ...v, active: v.active !== false } : { active: true },
    onSubmit: async d => {
      if (v) await patch("vehicles", v.id, d); else await create("vehicles", d);
      toast("Véhicule enregistré");
    },
    onDelete: v ? async () => {
      if (store.mileage_trips.some(t => t.vehicle_id === v.id)) throw new Error("Ce véhicule a des trajets : décoche plutôt « En service » pour garder l'historique.");
      await destroy("vehicles", v.id);
    } : null
  });
}
