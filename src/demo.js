// Moteur « démo » : mêmes fonctions que Supabase, données dans le navigateur.
// Sert à essayer l'app et à la tester sans toucher aux vraies données.

import { addDays, isoDate, startOfWeek, uid } from "./util.js";

const KEY = "atelier-ops-demo-db-v2";
const FILE_KEY = "atelier-ops-demo-files-v2";

function seed() {
  const t = isoDate(new Date());
  const mon = startOfWeek(t);
  const now = new Date().toISOString();
  const admin = { id: "u-admin", full_name: "Shawn Dubé", role: "admin", email: "demo@atelier-ops.local", phone: "", title: "Propriétaire", hourly_cost: 0, active: true, created_at: now };
  const e1 = { id: "u-e1", full_name: "Julien Fortin", role: "employee", email: "julien@exemple.ca", phone: "450-555-0101", title: "Charpentier-menuisier", hourly_cost: 42, active: true, created_at: now };
  const e2 = { id: "u-e2", full_name: "Kevin Roy", role: "employee", email: "kevin@exemple.ca", phone: "450-555-0102", title: "Apprenti", hourly_cost: 28, active: true, created_at: now };
  const c1 = { id: "c1", name: "Famille Bergeron", phone: "450-555-0199", email: "bergeron@exemple.ca", billing_address: "12 rue des Érables, Granby", notes: "", created_at: now };
  const c2 = { id: "c2", name: "Mme Côté", phone: "450-555-0142", email: "cote@exemple.ca", billing_address: "88 ch. du Lac, Bromont", notes: "Mobilité réduite — prévoir accès", created_at: now };
  const c3 = { id: "c3", name: "Immeubles Lapointe", phone: "450-555-0177", email: "info@lapointe.exemple", billing_address: "301 boul. Principal, Cowansville", notes: "", created_at: now };
  const j1 = { id: "j1", client_id: c1.id, name: "Sous-sol — chambre et salle de bain", address: "12 rue des Érables, Granby", status: "En cours", scheduled_date: addDays(t, -6), end_date: addDays(t, 14), assigned_team: "", crew_ids: [e1.id, e2.id], price: 38500, cost: 26000, progress: 35, summary: "Chambre au sous-sol, agrandissement salle de bain, plancher chauffant, céramique.", drive_url: "", invoice_number: null, invoiced_at: null, amount_paid: 10000, paid_at: null, notes: "", created_at: now };
  const j2 = { id: "j2", client_id: c2.id, name: "Salle de bain accessible", address: "88 ch. du Lac, Bromont", status: "Planifié", scheduled_date: addDays(t, 10), end_date: addDays(t, 24), crew_ids: [e1.id], price: 24800, cost: 17500, progress: 0, summary: "Douche sans seuil, barres d'appui, lavabo accessible.", drive_url: "", amount_paid: 0, created_at: now };
  const j3 = { id: "j3", client_id: c3.id, name: "Remplacement balcons — 4 logements", address: "301 boul. Principal, Cowansville", status: "À facturer", scheduled_date: addDays(t, -40), end_date: addDays(t, -3), crew_ids: [e1.id, e2.id], price: 18200, cost: 12400, progress: 100, summary: "", drive_url: "", amount_paid: 0, created_at: now };
  const time = [];
  [0, 1, 2, 3].forEach(i => {
    time.push({ id: uid(), employee_id: e1.id, job_id: j1.id, work_date: addDays(mon, i), start_time: "07:30", end_time: "16:00", break_minutes: 30, hours: 8, status: i < 2 ? "Approuvé" : "À approuver", notes: "", created_at: now });
    time.push({ id: uid(), employee_id: e2.id, job_id: j1.id, work_date: addDays(mon, i), start_time: "07:30", end_time: "15:30", break_minutes: 30, hours: 7.5, status: "À approuver", notes: "", created_at: now });
  });
  const vehicles = [
    { id: "v1", name: "Ford F-150 (2021)", plate: "FXX 123", active: true, notes: "", created_at: now },
    { id: "v2", name: "Remorque fermée", plate: "R 45 678", active: true, notes: "", created_at: now }
  ];
  const mileage = [
    { id: uid(), employee_id: admin.id, vehicle_id: "v1", job_id: j1.id, trip_date: addDays(t, -2), start_label: "Bureau", end_label: "Granby — chantier Bergeron", distance_km: 32.4, trip_type: "Professionnel", reimbursement_rate: 0.7, source: "manuel", created_at: now },
    { id: uid(), employee_id: admin.id, vehicle_id: "v1", job_id: j2.id, trip_date: addDays(t, -1), start_label: "Bureau", end_label: "Bromont — visite Mme Côté", distance_km: 21.8, trip_type: "Professionnel", reimbursement_rate: 0.7, source: "manuel", created_at: now }
  ];
  const expenses = [
    { id: uid(), job_id: j1.id, expense_date: addDays(t, -5), category: "Matériaux", supplier: "BMR Granby", description: "Colombages, gypse, isolant", amount: 4380.55, created_at: now },
    { id: uid(), job_id: j1.id, expense_date: addDays(t, -3), category: "Sous-traitant", supplier: "Électricien Gagnon", description: "Plancher chauffant — branchement", amount: 1250, created_at: now },
    { id: uid(), job_id: j3.id, expense_date: addDays(t, -30), category: "Matériaux", supplier: "Rona Cowansville", description: "Bois traité, quincaillerie", amount: 6900, created_at: now }
  ];
  const events = [
    { id: uid(), title: "Livraison céramique", event_date: addDays(t, 1), start_time: "09:00", end_time: "10:00", job_id: j1.id, kind: "Livraison", notes: "", created_at: now },
    { id: uid(), title: "Inspection plomberie", event_date: addDays(t, 3), start_time: "13:00", end_time: "14:00", job_id: j1.id, kind: "Inspection", notes: "", created_at: now }
  ];
  const logs = [{ id: uid(), job_id: j1.id, author_id: admin.id, body: "Démolition terminée, cloisons montées.", created_at: now }];
  return {
    profiles: [admin, e1, e2],
    clients: [c1, c2, c3],
    jobs: [j1, j2, j3],
    time_entries: time,
    vehicles,
    mileage_trips: mileage,
    job_expenses: expenses,
    job_files: [],
    job_log_entries: logs,
    quotes: [],
    calendar_events: events,
    app_settings: [{ id: 1, company_name: "Eizo Construction", company_address: "", company_phone: "", company_email: "", tps_number: "", tvq_number: "", tps_rate: 5, tvq_rate: 9.975, mileage_rate: 0.7, default_margin: 25, default_hourly_rate: 75, quote_prefix: "D-", invoice_prefix: "F-" }]
  };
}

export function createDemoBackend() {
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { db = null; }
  if (!db) db = seed();
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* quota */ } };
  persist();
  let files;
  try { files = JSON.parse(localStorage.getItem(FILE_KEY) || "{}"); } catch { files = {}; }
  const listeners = [];
  const demoUserId = () => sessionStorage.getItem("atelier-ops-demo-user") || "u-admin";
  const session = () => {
    if (sessionStorage.getItem("atelier-ops-demo-signed-out")) return null;
    const p = db.profiles.find(x => x.id === demoUserId());
    return { user: { id: p.id, email: p.email }, access_token: "demo" };
  };
  const tbl = name => (db[name] ||= []);
  const clone = x => JSON.parse(JSON.stringify(x));

  return {
    mode: "demo",
    auth: {
      async session() { return session(); },
      async signIn(email) {
        const p = db.profiles.find(x => x.email === email) || db.profiles[0];
        sessionStorage.setItem("atelier-ops-demo-user", p.id);
        sessionStorage.removeItem("atelier-ops-demo-signed-out");
        return session();
      },
      async signOut() { sessionStorage.setItem("atelier-ops-demo-signed-out", "1"); listeners.forEach(cb => cb("SIGNED_OUT", null)); },
      async resetPassword() {},
      async updatePassword() {},
      onChange(cb) { listeners.push(cb); },
      // propre à la démo : changer de rôle pour tester la vue employé
      switchUser(id) { sessionStorage.setItem("atelier-ops-demo-user", id); }
    },
    async list(table, { order = "created_at", ascending = false } = {}) {
      const rows = clone(tbl(table));
      if (order) rows.sort((a, b) => String(a[order] ?? "").localeCompare(String(b[order] ?? "")) * (ascending ? 1 : -1));
      return rows;
    },
    async get(table, id) { return clone(tbl(table).find(r => String(r.id) === String(id)) || null); },
    async insert(table, row) {
      const r = { id: uid(), created_at: new Date().toISOString(), ...row };
      tbl(table).unshift(r);
      persist();
      return clone(r);
    },
    async update(table, id, patch) {
      const r = tbl(table).find(x => String(x.id) === String(id));
      if (!r) throw new Error("Introuvable");
      Object.assign(r, patch, { updated_at: new Date().toISOString() });
      persist();
      return clone(r);
    },
    async updateMany(table, ids, patch) {
      const set = new Set(ids.map(String));
      tbl(table).forEach(r => { if (set.has(String(r.id))) Object.assign(r, patch); });
      persist();
      return clone(tbl(table).filter(r => set.has(String(r.id))));
    },
    async remove(table, id) {
      db[table] = tbl(table).filter(x => String(x.id) !== String(id));
      if (table === "jobs") {
        ["job_expenses", "job_files", "job_log_entries", "calendar_events"].forEach(t => { db[t] = tbl(t).filter(x => x.job_id !== id); });
      }
      persist();
    },
    files: {
      async upload(path, file) {
        const dataUrl = await new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result);
          fr.onerror = rej;
          fr.readAsDataURL(file);
        });
        files[path] = dataUrl;
        try { localStorage.setItem(FILE_KEY, JSON.stringify(files)); }
        catch { /* gros fichier : gardé en mémoire seulement */ }
        return path;
      },
      async url(path) { return files[path] || ""; },
      async remove(path) { delete files[path]; try { localStorage.setItem(FILE_KEY, JSON.stringify(files)); } catch {} }
    },
    reset() { localStorage.removeItem(KEY); localStorage.removeItem(FILE_KEY); }
  };
}
