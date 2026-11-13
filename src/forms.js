// Formulaires réutilisés par plusieurs écrans.

import {
  store, create, patch, destroy, isAdmin, JOB_STATUSES, EXPENSE_CATEGORIES, EVENT_KINDS,
  clientOptions, jobOptions, employeeOptions, vehicleOptions
} from "./store.js";
import { openForm, today, hoursFromTimes, toast, hhmm, round2 } from "./util.js";

const NEW_CLIENT = "__new__";

// ---------- client ----------
export function clientForm(client = null) {
  return openForm({
    title: client ? "Modifier le client" : "Nouveau client",
    fields: [
      { name: "name", label: "Nom", required: true, full: true },
      { name: "phone", label: "Téléphone", type: "tel" },
      { name: "email", label: "Courriel", type: "email" },
      { name: "billing_address", label: "Adresse de facturation", full: true },
      { name: "notes", label: "Notes", type: "textarea" }
    ],
    values: client || {},
    onSubmit: async d => {
      if (client) await patch("clients", client.id, d); else await create("clients", d);
      toast(client ? "Client mis à jour" : "Client ajouté");
    },
    onDelete: client && isAdmin() ? async () => {
      if (store.jobs.some(j => j.client_id === client.id)) throw new Error("Ce client a des jobs. Supprime ou réassigne ses jobs d'abord.");
      await destroy("clients", client.id);
      toast("Client supprimé");
    } : null
  });
}

// ---------- job ----------
export function jobForm(job = null, preset = {}) {
  const v = job ? { ...job } : { status: "Planifié", scheduled_date: today(), progress: 0, crew_ids: [], ...preset };
  return openForm({
    title: job ? "Modifier le job" : "Nouveau job",
    wide: true,
    fields: [
      { name: "name", label: "Nom du job", required: true, full: true, placeholder: "ex. Sous-sol — chambre et salle de bain" },
      { name: "client_id", label: "Client", type: "select", options: [...clientOptions(), { value: NEW_CLIENT, label: "+ Nouveau client…" }], placeholder: "Choisir un client" },
      { name: "new_client", label: "Nom du nouveau client", help: "Seulement si « Nouveau client » est choisi" },
      { name: "address", label: "Adresse du chantier", full: true },
      { name: "status", label: "Statut", type: "select", options: JOB_STATUSES, placeholder: false },
      { name: "progress", label: "Avancement (%)", type: "number", min: 0, max: 100, step: 5 },
      { name: "scheduled_date", label: "Début", type: "date" },
      { name: "end_date", label: "Fin prévue", type: "date" },
      { name: "price", label: "Prix du contrat (avant taxes)", type: "number", min: 0, step: "0.01" },
      { name: "cost", label: "Budget de coûts prévu", type: "number", min: 0, step: "0.01", help: "Matériaux + main-d'oeuvre + sous-traitants estimés" },
      { name: "crew_ids", label: "Équipe assignée", type: "multiselect", options: employeeOptions(), full: true },
      { name: "drive_url", label: "Lien du dossier Google Drive", type: "url", full: true, placeholder: "https://drive.google.com/…" },
      { name: "summary", label: "Description des travaux", type: "textarea" }
    ],
    values: v,
    onSubmit: async d => {
      let clientId = d.client_id || null;
      if (clientId === NEW_CLIENT) {
        if (!d.new_client) throw new Error("Entre le nom du nouveau client.");
        clientId = (await create("clients", { name: d.new_client })).id;
      }
      const row = {
        name: d.name, client_id: clientId, address: d.address, status: d.status,
        progress: Math.max(0, Math.min(100, Number(d.progress) || 0)),
        scheduled_date: d.scheduled_date || null, end_date: d.end_date || null,
        price: Number(d.price) || 0, cost: Number(d.cost) || 0,
        crew_ids: d.crew_ids || [], drive_url: d.drive_url || null, summary: d.summary
      };
      if (row.end_date && row.scheduled_date && row.end_date < row.scheduled_date) throw new Error("La date de fin est avant la date de début.");
      if (job) await patch("jobs", job.id, row);
      else {
        const saved = await create("jobs", row);
        preset.onCreated?.(saved);
      }
      toast(job ? "Job mis à jour" : "Job créé");
    },
    onDelete: job ? async () => { await destroy("jobs", job.id); toast("Job supprimé"); location.hash = "#/jobs"; } : null,
    deleteLabel: "Supprimer le job"
  });
}

// ---------- dépense ----------
export function expenseForm(jobId, expense = null) {
  return openForm({
    title: expense ? "Modifier la dépense" : "Ajouter une dépense",
    fields: [
      { name: "job_id", label: "Job", type: "select", options: jobOptions(true), required: true, full: true },
      { name: "expense_date", label: "Date", type: "date", required: true },
      { name: "category", label: "Catégorie", type: "select", options: EXPENSE_CATEGORIES, placeholder: false },
      { name: "supplier", label: "Fournisseur", list: [...new Set(store.job_expenses.map(e => e.supplier).filter(Boolean))] },
      { name: "amount", label: "Montant avant taxes ($)", type: "number", step: "0.01", min: 0, required: true },
      { name: "description", label: "Description", full: true }
    ],
    values: expense || { job_id: jobId, expense_date: today(), category: "Matériaux" },
    onSubmit: async d => {
      const row = { ...d, amount: round2(d.amount) };
      if (expense) await patch("job_expenses", expense.id, row); else await create("job_expenses", row);
      toast("Dépense enregistrée");
    },
    onDelete: expense ? async () => { await destroy("job_expenses", expense.id); toast("Dépense supprimée"); } : null
  });
}

// ---------- heures ----------
export function timeForm(entry = null, preset = {}) {
  const admin = isAdmin();
  const me = store.me;
  const locked = entry && !admin && entry.status === "Approuvé";
  const values = entry
    ? { ...entry, start_time: hhmm(entry.start_time), end_time: hhmm(entry.end_time) }
    : { work_date: today(), employee_id: me.id, break_minutes: 30, ...preset };
  return openForm({
    title: entry ? (locked ? "Heures approuvées (lecture seule)" : "Modifier les heures") : "Entrer des heures",
    fields: [
      ...(admin ? [{ name: "employee_id", label: "Employé", type: "select", options: employeeOptions(), required: true }] : []),
      { name: "work_date", label: "Date", type: "date", required: true },
      { name: "job_id", label: "Job", type: "select", options: jobOptions(), required: true, full: !admin },
      { name: "start_time", label: "Arrivée", type: "time" },
      { name: "end_time", label: "Départ", type: "time" },
      { name: "break_minutes", label: "Pause (minutes)", type: "number", min: 0, step: 5 },
      { name: "hours", label: "Total d'heures", type: "number", step: "0.25", min: 0, help: "Calculé automatiquement si arrivée et départ sont remplis" },
      { name: "notes", label: "Note (travaux faits)", type: "textarea" },
      ...(admin ? [{ name: "status", label: "Statut", type: "select", options: ["À approuver", "Approuvé", "Refusé"], placeholder: false }] : [])
    ],
    values: { status: "À approuver", ...values },
    onChange: (d, form) => {
      if (d.start_time && d.end_time) form.elements.hours.value = hoursFromTimes(d.start_time, d.end_time, d.break_minutes);
    },
    submitLabel: locked ? "Fermer" : "Enregistrer",
    onSubmit: async d => {
      if (locked) return;
      const hours = d.start_time && d.end_time ? hoursFromTimes(d.start_time, d.end_time, d.break_minutes) : Number(d.hours) || 0;
      if (!hours || hours <= 0) throw new Error("Entre l'arrivée et le départ, ou le total d'heures.");
      if (hours > 18) throw new Error("Plus de 18 h dans une journée ? Vérifie les heures.");
      const row = {
        employee_id: admin ? d.employee_id : me.id,
        job_id: d.job_id, work_date: d.work_date,
        start_time: d.start_time || null, end_time: d.end_time || null,
        break_minutes: Number(d.break_minutes) || 0, hours, notes: d.notes
      };
      if (admin) {
        row.status = d.status || "À approuver";
        if (row.status === "Approuvé" && entry?.status !== "Approuvé") { row.approved_by = me.id; row.approved_at = new Date().toISOString(); }
      } else row.status = "À approuver"; // une correction repasse en approbation
      if (entry) await patch("time_entries", entry.id, row); else await create("time_entries", row);
      toast("Heures enregistrées");
    },
    onDelete: entry && (admin || entry.status !== "Approuvé") ? async () => { await destroy("time_entries", entry.id); toast("Entrée supprimée"); } : null
  });
}

// ---------- trajet ----------
export function tripForm(trip = null, preset = {}) {
  const admin = isAdmin();
  const me = store.me;
  const lastVehicle = localStorage.getItem("atelier-ops-last-vehicle") || "";
  const values = trip || { trip_date: today(), employee_id: me.id, trip_type: "Professionnel", vehicle_id: lastVehicle, source: "manuel", ...preset };
  return openForm({
    title: trip ? "Modifier le trajet" : "Ajouter un trajet",
    fields: [
      ...(admin ? [{ name: "employee_id", label: "Conducteur", type: "select", options: employeeOptions(), required: true }] : []),
      { name: "trip_date", label: "Date", type: "date", required: true },
      { name: "vehicle_id", label: "Véhicule", type: "select", options: vehicleOptions() },
      { name: "job_id", label: "Job", type: "select", options: jobOptions(true), placeholder: "Aucun (bureau, fournisseur…)" },
      { name: "trip_type", label: "Type", type: "select", options: ["Professionnel", "Personnel"], placeholder: false },
      { name: "start_label", label: "Départ", placeholder: "ex. Bureau" },
      { name: "end_label", label: "Destination", placeholder: "ex. BMR Granby" },
      { name: "start_odometer", label: "Odomètre départ", type: "number", step: "0.1" },
      { name: "end_odometer", label: "Odomètre arrivée", type: "number", step: "0.1" },
      { name: "distance_km", label: "Distance (km)", type: "number", step: "0.1", min: 0, help: "Calculée si les deux odomètres sont remplis" },
      { name: "notes", label: "But du déplacement", type: "textarea", rows: 2 }
    ],
    values,
    onChange: (d, form) => {
      if (d.start_odometer && d.end_odometer && d.end_odometer > d.start_odometer) form.elements.distance_km.value = round2(d.end_odometer - d.start_odometer);
    },
    onSubmit: async d => {
      let km = Number(d.distance_km) || 0;
      let source = trip?.source || preset.source || "manuel";
      if (d.start_odometer && d.end_odometer) {
        if (d.end_odometer < d.start_odometer) throw new Error("L'odomètre d'arrivée est plus petit que celui du départ.");
        km = round2(d.end_odometer - d.start_odometer);
        if (source === "manuel") source = "odometre";
      }
      if (km <= 0) throw new Error("Entre la distance ou les deux odomètres.");
      const row = {
        employee_id: admin ? d.employee_id : me.id,
        trip_date: d.trip_date, vehicle_id: d.vehicle_id || null, job_id: d.job_id || null,
        trip_type: d.trip_type, start_label: d.start_label, end_label: d.end_label,
        start_odometer: d.start_odometer || null, end_odometer: d.end_odometer || null,
        distance_km: km, notes: d.notes, source,
        reimbursement_rate: Number(store.settings.mileage_rate) || 0.7
      };
      if (d.vehicle_id) localStorage.setItem("atelier-ops-last-vehicle", d.vehicle_id);
      if (trip) await patch("mileage_trips", trip.id, row); else await create("mileage_trips", row);
      toast("Trajet enregistré");
    },
    onDelete: trip ? async () => { await destroy("mileage_trips", trip.id); toast("Trajet supprimé"); } : null
  });
}

// ---------- événement de calendrier ----------
export function eventForm(ev = null, preset = {}) {
  return openForm({
    title: ev ? "Modifier l'événement" : "Nouvel événement",
    fields: [
      { name: "title", label: "Titre", required: true, full: true },
      { name: "kind", label: "Type", type: "select", options: EVENT_KINDS, placeholder: false },
      { name: "event_date", label: "Date", type: "date", required: true },
      { name: "start_time", label: "Début", type: "time" },
      { name: "end_time", label: "Fin", type: "time" },
      { name: "job_id", label: "Job lié", type: "select", options: jobOptions(true), placeholder: "Aucun" },
      { name: "employee_id", label: "Personne", type: "select", options: employeeOptions(), placeholder: "Toute l'équipe" },
      { name: "notes", label: "Notes", type: "textarea", rows: 2 }
    ],
    values: ev ? { ...ev, start_time: hhmm(ev.start_time), end_time: hhmm(ev.end_time) } : { event_date: today(), kind: "Rendez-vous", ...preset },
    onSubmit: async d => {
      const row = { ...d, job_id: d.job_id || null, employee_id: d.employee_id || null, start_time: d.start_time || null, end_time: d.end_time || null };
      if (ev) await patch("calendar_events", ev.id, row); else await create("calendar_events", row);
      toast("Événement enregistré");
    },
    onDelete: ev ? async () => { await destroy("calendar_events", ev.id); toast("Événement supprimé"); } : null
  });
}
