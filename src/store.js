// État central de l'app + calculs dérivés (coûts réels, marges, etc.).

import { api } from "./api.js";
import { sum } from "./util.js";

export const JOB_STATUSES = ["Soumission", "Planifié", "En cours", "À facturer", "Facturé", "Payé", "Annulé"];
export const OPEN_STATUSES = ["Soumission", "Planifié", "En cours", "À facturer"];
export const EXPENSE_CATEGORIES = ["Matériaux", "Sous-traitant", "Location", "Permis", "Transport", "Autre"];
export const FILE_CATEGORIES = [
  { value: "photo", label: "Photo" },
  { value: "plan", label: "Plan" },
  { value: "contract", label: "Contrat" },
  { value: "quote", label: "Devis / soumission" },
  { value: "invoice", label: "Facture / reçu" },
  { value: "document", label: "Document" },
  { value: "other", label: "Autre" }
];
export const EVENT_KINDS = ["Rendez-vous", "Livraison", "Inspection", "Visite", "Autre"];

const TABLES = ["profiles", "clients", "jobs", "time_entries", "vehicles", "mileage_trips", "job_expenses", "job_files", "job_log_entries", "quotes", "calendar_events", "app_settings"];

const DEFAULT_SETTINGS = { id: 1, company_name: "Eizo Construction", tps_rate: 5, tvq_rate: 9.975, mileage_rate: 0.7, default_margin: 25, default_hourly_rate: 75, quote_prefix: "D-", invoice_prefix: "F-" };

export const store = {
  me: null,          // profil connecté
  session: null,
  loaded: false,
  errors: [],
  profiles: [], clients: [], jobs: [], time_entries: [], vehicles: [], mileage_trips: [],
  job_expenses: [], job_files: [], job_log_entries: [], quotes: [], calendar_events: [],
  settings: { ...DEFAULT_SETTINGS }
};

const listeners = new Set();
export const onStoreChange = fn => listeners.add(fn);
export const emit = () => listeners.forEach(fn => fn());

export const isAdmin = () => store.me?.role === "admin";

export async function loadAll() {
  store.errors = [];
  const results = await Promise.allSettled(TABLES.map(t => api.list(t, t === "app_settings" ? { order: null } : {})));
  results.forEach((r, i) => {
    const t = TABLES[i];
    if (r.status === "fulfilled") {
      if (t === "app_settings") store.settings = { ...DEFAULT_SETTINGS, ...(r.value?.[0] || {}) };
      else store[t] = r.value || [];
    } else {
      // table absente (migration pas encore faite) ou accès refusé : on continue sans planter
      console.warn(`Lecture ${t} impossible`, r.reason);
      store.errors.push({ table: t, message: r.reason?.message || String(r.reason) });
      if (t !== "app_settings") store[t] = [];
    }
  });
  store.me = store.profiles.find(p => p.id === store.session?.user?.id) || store.me;
  store.loaded = true;
  emit();
}

// ---- mutations génériques : écrivent puis mettent l'état à jour ----
const tableKey = t => (t === "app_settings" ? null : t);

export async function create(table, row) {
  const saved = await api.insert(table, row);
  store[tableKey(table)].unshift(saved);
  emit();
  return saved;
}
export async function patch(table, id, changes) {
  const saved = await api.update(table, id, changes);
  if (table === "app_settings") store.settings = { ...store.settings, ...saved };
  else {
    const arr = store[table];
    const i = arr.findIndex(r => r.id === id);
    if (i > -1) arr[i] = saved; else arr.unshift(saved);
  }
  emit();
  return saved;
}
export async function patchMany(table, ids, changes) {
  const saved = await api.updateMany(table, ids, changes);
  const byId = Object.fromEntries(saved.map(r => [r.id, r]));
  store[table] = store[table].map(r => byId[r.id] || r);
  emit();
  return saved;
}
export async function destroy(table, id) {
  await api.remove(table, id);
  store[table] = store[table].filter(r => r.id !== id);
  if (table === "jobs") {
    ["job_expenses", "job_files", "job_log_entries", "calendar_events"].forEach(t => { store[t] = store[t].filter(r => r.job_id !== id); });
  }
  emit();
}
export async function saveSettings(changes) {
  try { return await patch("app_settings", 1, changes); }
  catch (e) {
    // la ligne n'existe pas encore
    const saved = await api.insert("app_settings", { id: 1, ...changes });
    store.settings = { ...store.settings, ...saved };
    emit();
    return saved;
  }
}

// ---- recherches ----
export const byId = (table, id) => store[table].find(r => r.id === id);
export const clientOf = job => byId("clients", job?.client_id);
export const jobName = id => byId("jobs", id)?.name || "";
export const personName = id => byId("profiles", id)?.full_name || "";
export const vehicleName = id => byId("vehicles", id)?.name || "";

// Les anciennes rangées (avant v2) stockaient des noms plutôt que des identifiants.
export const entryPerson = e => personName(e.employee_id) || e.employee_name || "Employé à confirmer";
export const entryJob = e => jobName(e.job_id) || e.job_name || "—";
export const tripVehicle = t => vehicleName(t.vehicle_id) || t.vehicle_name || "—";

export const activeEmployees = () => store.profiles.filter(p => p.active !== false);
export const jobOptions = (includeClosed = false) =>
  store.jobs
    .filter(j => includeClosed || !["Payé", "Annulé"].includes(j.status))
    .map(j => ({ value: j.id, label: `${j.name}${clientOf(j) ? ` — ${clientOf(j).name}` : ""}` }));
export const clientOptions = () => store.clients.slice().sort((a, b) => a.name.localeCompare(b.name)).map(c => ({ value: c.id, label: c.name }));
export const employeeOptions = () => activeEmployees().map(p => ({ value: p.id, label: p.full_name }));
export const vehicleOptions = () => store.vehicles.filter(v => v.active !== false).map(v => ({ value: v.id, label: v.name }));

// ---- calculs financiers d'un job ----
export function jobFinancials(job) {
  const rate = Number(store.settings.mileage_rate) || 0.7;
  const entries = store.time_entries.filter(e => e.job_id === job.id && e.status !== "Refusé");
  const hours = sum(entries, e => e.hours);
  const labor = sum(entries, e => (Number(e.hours) || 0) * (Number(byId("profiles", e.employee_id)?.hourly_cost) || 0));
  const expenses = sum(store.job_expenses.filter(x => x.job_id === job.id), x => x.amount);
  const km = sum(store.mileage_trips.filter(t => t.job_id === job.id && t.trip_type === "Professionnel"), t => t.distance_km);
  const mileage = km * rate;
  const realCost = labor + expenses + mileage;
  const price = Number(job.price) || 0;
  const budget = Number(job.cost) || 0;
  const profit = price - realCost;
  const marginPct = price ? (profit / price) * 100 : 0;
  const budgetUsed = budget ? (realCost / budget) * 100 : 0;
  const paid = Number(job.amount_paid) || 0;
  return { hours, labor, expenses, km, mileage, realCost, price, budget, profit, marginPct, budgetUsed, paid, balance: price - paid };
}

export const statusTone = s => ({
  "Soumission": "neutral", "Planifié": "plan", "En cours": "progress", "À facturer": "warn",
  "Facturé": "invoice", "Payé": "ok", "Annulé": "muted", "À approuver": "warn", "Approuvé": "ok", "Refusé": "danger",
  "Brouillon": "neutral", "Envoyé": "plan", "Accepté": "ok"
}[s] || "neutral");

export function nextNumber(prefix, existing) {
  const year = new Date().getFullYear();
  const nums = existing.map(n => Number(String(n || "").split("-").pop())).filter(Number.isFinite);
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${year}-${String(next).padStart(3, "0")}`;
}
