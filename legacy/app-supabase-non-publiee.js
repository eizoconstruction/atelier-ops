const money = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

const SUPABASE_URL = "https://qjnuksrjdymakizznkiy.supabase.co";
const SUPABASE_KEY = "sb_publishable_5X7nWxX2nIobh_2eUN69Xw_jmF7U-HX";

const state = {
  filter: "all",
  selectedJobId: null,
  mileageEmployee: "Tous",
  mileageVehicle: "Tous",
  tripActive: false,
  jobs: [],
  team: [],
  time: [],
  vehicles: [],
  mileage: []
};

const db = {
  enabled: Boolean(SUPABASE_URL && SUPABASE_KEY),
  connected: false
};

const AUTH_STORAGE_KEY = "atelier-ops-session";

const auth = {
  session: null,
  profile: null
};

function loadStoredSession() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeSession(session) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* stockage indisponible, la session ne survivra pas au rechargement */
  }
}

function clearStoredSession() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {}
}

const titles = {
  dashboard: "Vue d'ensemble",
  jobs: "Clients et jobs",
  calculator: "Estimation des jobs",
  calendar: "Calendrier",
  time: "Feuilles de temps",
  employeeTime: "Saisie employé",
  mileage: "Kilométrage",
  documents: "Documents projet",
  accounting: "Comptabilité",
  team: "Employés"
};

function qs(selector) {
  return document.querySelector(selector);
}

function qsa(selector) {
  return [...document.querySelectorAll(selector)];
}

function setDataStatus(text, connected = false) {
  const status = qs("#dataStatus");
  const dot = qs(".status-dot");
  if (status) status.textContent = text;
  if (dot) dot.classList.toggle("offline", !connected);
}

async function supabaseRequest(path, options = {}) {
  if (!db.enabled) throw new Error("Supabase n'est pas configuré.");
  const token = auth.session?.access_token || SUPABASE_KEY;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Erreur Supabase ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function authRequest(path, body) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error_description || data.msg || data.error || "Courriel ou mot de passe invalide.";
    throw new Error(message);
  }
  return data;
}

async function loadProfile() {
  if (!auth.session) return;
  const rows = await supabaseRequest(`profiles?select=*&id=eq.${auth.session.user.id}`);
  auth.profile = rows?.[0] || null;
}

async function signIn(email, password) {
  const data = await authRequest("token?grant_type=password", { email, password });
  auth.session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user: data.user
  };
  await loadProfile();
  if (!auth.profile) {
    auth.session = null;
    auth.profile = null;
    throw new Error("Aucun profil trouvé pour ce compte. Demande à ton admin de le créer.");
  }
  storeSession(auth.session);
}

async function signOut() {
  try {
    if (auth.session?.access_token) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${auth.session.access_token}`
        }
      });
    }
  } catch (error) {
    console.warn("Déconnexion Supabase:", error);
  }
  auth.session = null;
  auth.profile = null;
  clearStoredSession();
  showLoginScreen();
}

function showLoginScreen(message) {
  const loginScreen = qs("#loginScreen");
  const appShell = qs("#appShell");
  if (appShell) appShell.hidden = true;
  if (loginScreen) loginScreen.hidden = false;
  const errorEl = qs("#loginError");
  if (errorEl) {
    if (message) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    } else {
      errorEl.hidden = true;
      errorEl.textContent = "";
    }
  }
  const submitBtn = qs("#loginSubmit");
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Se connecter";
  }
}

function showApp() {
  const loginScreen = qs("#loginScreen");
  const appShell = qs("#appShell");
  if (loginScreen) loginScreen.hidden = true;
  if (appShell) appShell.hidden = false;
  applyRoleUI();
}

function applyRoleUI() {
  const isAdmin = auth.profile?.role === "admin";
  qsa(".admin-only").forEach(el => {
    el.hidden = !isAdmin;
  });
  const nameEl = qs("#userName");
  const roleEl = qs("#userRole");
  if (nameEl) nameEl.textContent = auth.profile?.full_name || auth.session?.user?.email || "—";
  if (roleEl) roleEl.textContent = isAdmin ? "Admin" : "Employé";

  const activeNav = qs(".nav-item.active");
  if (activeNav && activeNav.classList.contains("admin-only") && !isAdmin) {
    qs('.nav-item[data-view="dashboard"]')?.click();
  }
}

function mapJobFromDb(job, clientsById = {}) {
  const client = clientsById[job.client_id];
  return {
    id: job.id,
    name: job.name,
    client: client?.name || "Client à confirmer",
    address: job.address || "",
    status: job.status || "Planifié",
    date: job.scheduled_date || "",
    crew: job.assigned_team || "À assigner",
    price: Number(job.price || 0),
    cost: Number(job.cost || 0),
    drive: job.drive_url || "Dossier Drive à créer",
    invoice: job.status === "À facturer" ? Number(job.price || 0) : 0,
    summary: job.summary || "Dossier à compléter.",
    documents: [],
    plans: [],
    quotes: [],
    photos: [],
    log: []
  };
}

function mapTimeFromDb(entry, profilesById = {}, jobsById = {}) {
  return {
    id: entry.id,
    person: entry.employee_name || profilesById[entry.employee_id]?.full_name || "Employé à confirmer",
    job: entry.job_name || jobsById[entry.job_id]?.name || "Job à confirmer",
    hours: Number(entry.hours || 0),
    status: entry.status || "À approuver",
    note: entry.notes || ""
  };
}

function mapMileageFromDb(trip, profilesById = {}, vehiclesById = {}, jobsById = {}) {
  return {
    id: trip.id,
    date: trip.trip_date,
    employee: trip.employee_name || profilesById[trip.employee_id]?.full_name || "Employé à confirmer",
    vehicle: trip.vehicle_name || vehiclesById[trip.vehicle_id]?.name || "Véhicule à confirmer",
    job: trip.job_name || jobsById[trip.job_id]?.name || "Job à confirmer",
    start: trip.start_label || "",
    end: trip.end_label || "",
    km: Number(trip.distance_km || 0),
    type: trip.trip_type || "Professionnel"
  };
}

async function loadFromSupabase() {
  try {
    const [clients, jobs, profiles, timeEntries, vehicles, mileageTrips] = await Promise.all([
      supabaseRequest("clients?select=*&order=created_at.desc"),
      supabaseRequest("jobs?select=*&order=created_at.desc"),
      supabaseRequest("profiles?select=*&order=created_at.desc"),
      supabaseRequest("time_entries?select=*&order=created_at.desc"),
      supabaseRequest("vehicles?select=*&order=created_at.desc"),
      supabaseRequest("mileage_trips?select=*&order=created_at.desc")
    ]);

    const clientsById = Object.fromEntries(clients.map(client => [client.id, client]));
    const jobsByIdRaw = Object.fromEntries(jobs.map(job => [job.id, job]));
    const profilesById = Object.fromEntries(profiles.map(profile => [profile.id, profile]));
    const vehiclesById = Object.fromEntries(vehicles.map(vehicle => [vehicle.id, vehicle]));

    state.jobs = jobs.map(job => mapJobFromDb(job, clientsById));
    state.team = profiles.map(profile => ({
      id: profile.id,
      name: profile.full_name,
      role: profile.role === "admin" ? "Admin" : "Employé",
      hours: 0,
      jobs: 0,
      access: profile.role
    }));
    state.time = timeEntries.map(entry => mapTimeFromDb(entry, profilesById, jobsByIdRaw));
    state.vehicles = vehicles.map(vehicle => ({ id: vehicle.id, label: vehicle.name }));
    state.mileage = mileageTrips.map(trip => mapMileageFromDb(trip, profilesById, vehiclesById, jobsByIdRaw));
    state.selectedJobId = state.jobs[0]?.id || null;
    db.connected = true;
    setDataStatus("Supabase connecté", true);
  } catch (error) {
    console.warn("Supabase fallback:", error);
    db.connected = false;
    setDataStatus("Mode local - permissions Supabase à vérifier", false);
  }
}

async function createJobInSupabase(data) {
  if (!db.connected) return null;
  const [client] = await supabaseRequest("clients", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      name: data.client,
      created_at: new Date().toISOString()
    })
  });
  const [job] = await supabaseRequest("jobs", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      client_id: client.id,
      name: data.name,
      status: data.status,
      scheduled_date: data.date,
      assigned_team: "À assigner",
      price: Number(data.price),
      cost: Math.round(Number(data.price) * 0.64),
      summary: "Nouveau job ajouté au pipeline. Dossier à compléter.",
      drive_url: `Dossier Drive / ${data.client}`
    })
  });
  return mapJobFromDb(job, { [client.id]: client });
}

async function createQuoteJobInSupabase(quote) {
  if (!db.connected) return null;
  const clientName = "Client à confirmer";
  const [client] = await supabaseRequest("clients", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ name: clientName })
  });
  const [job] = await supabaseRequest("jobs", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      client_id: client.id,
      name: quote.name || "Job sans titre",
      status: "Planifié",
      scheduled_date: "2026-07-20",
      assigned_team: "À assigner",
      price: Math.round(quote.total),
      cost: Math.round(quote.cost),
      summary: "Job créé depuis le calculateur. Détails à compléter.",
      drive_url: "Dossier Drive à créer"
    })
  });
  return mapJobFromDb(job, { [client.id]: client });
}

async function createTimeEntryInSupabase(data) {
  if (!db.connected) return null;
  const [entry] = await supabaseRequest("time_entries", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      employee_name: data.person,
      job_name: data.job,
      work_date: data.date,
      hours: Number(data.hours),
      status: "À approuver",
      notes: data.note || ""
    })
  });
  return mapTimeFromDb(entry);
}

function margin(job) {
  if (!job.price) return 0;
  return Math.round(((job.price - job.cost) / job.price) * 100);
}

function emptyState(title, body) {
  return `<div class="empty-state"><strong>${title}</strong><span>${body}</span></div>`;
}

function statusBadge(status) {
  const cls = status === "Planifié" ? "plan" : status === "En cours" ? "progress" : "invoice";
  return `<span class="badge ${cls}">${status}</span>`;
}

function renderDashboard() {
  const openJobs = state.jobs.filter(job => job.status !== "À facturer");
  const revenue = openJobs.reduce((sum, job) => sum + job.price, 0);
  const cost = openJobs.reduce((sum, job) => sum + job.cost, 0);
  const hours = state.time.reduce((sum, entry) => sum + entry.hours, 0);
  const invoices = state.jobs.reduce((sum, job) => sum + job.invoice, 0);

  qs("#plannedRevenue").textContent = money.format(revenue);
  qs("#grossMargin").textContent = `${revenue ? Math.round(((revenue - cost) / revenue) * 100) : 0}%`;
  qs("#weekHours").textContent = `${hours.toFixed(1)} h`;
  qs("#openInvoices").textContent = money.format(invoices);

  qs("#activeJobs").innerHTML = state.jobs.length ? state.jobs.slice(0, 4).map(job => `
    <article class="job-card">
      <div>
        <h3>${job.name}</h3>
        <div class="job-meta">${job.client} · ${job.date} · ${job.crew}</div>
      </div>
      <div>${statusBadge(job.status)}</div>
      <div class="job-meta">${money.format(job.price)} · marge ${margin(job)}%</div>
    </article>
  `).join("") : emptyState("Aucun job actif", "Crée ton premier job avec le bouton Nouveau job.");

  qs("#scheduleMini").innerHTML = state.jobs.length ? state.jobs.slice(0, 3).map(job => `
    <div class="finance-row"><span>${job.date}</span><strong>${job.crew}</strong></div>
  `).join("") : emptyState("Aucun horaire", "Les prochains jobs apparaîtront ici.");

  qs("#alerts").innerHTML = [
    "Version vierge prête à configurer.",
    "Ajoute tes employés, véhicules et premiers jobs.",
    "La sauvegarde réelle sera activée avec Supabase."
  ].map(alert => `<li>${alert}</li>`).join("");
}

function renderJobs() {
  const search = qs("#globalSearch").value.toLowerCase().trim();
  const rows = state.jobs.filter(job => {
    const matchesFilter = state.filter === "all" || job.status === state.filter;
    const matchesSearch = !search || `${job.name} ${job.client} ${job.crew}`.toLowerCase().includes(search);
    return matchesFilter && matchesSearch;
  });

  qs("#jobsTable").innerHTML = rows.length ? rows.map(job => `
    <tr class="${job.id === state.selectedJobId ? "selected-row" : ""}">
      <td><strong>${job.name}</strong><br><span class="job-meta">${job.drive}</span></td>
      <td>${job.client}</td>
      <td>${statusBadge(job.status)}</td>
      <td>${job.date}</td>
      <td>${job.crew}</td>
      <td>${money.format(job.price)}</td>
      <td>${margin(job)}%</td>
      <td><button class="mini-btn" data-job-id="${job.id}">Voir dossier</button></td>
    </tr>
  `).join("") : `<tr><td colspan="8">${emptyState("Aucun job", "Ajoute ton premier job pour remplir ce tableau.")}</td></tr>`;

  renderJobDetail();
  qsa("[data-job-id]").forEach(button => button.addEventListener("click", () => {
    state.selectedJobId = button.dataset.jobId;
    renderJobs();
  }));
}

function detailList(items) {
  return items.map(item => `<li>${item}</li>`).join("");
}

function renderJobDetail() {
  const job = state.jobs.find(item => item.id === state.selectedJobId) || state.jobs[0];
  if (!job) {
    qs("#jobDetail").innerHTML = emptyState("Aucun dossier sélectionné", "Le détail du job apparaîtra ici après la création d'un projet.");
    return;
  }

  qs("#jobDetail").innerHTML = `
    <div class="detail-head">
      <div>
        <p class="eyebrow">Dossier de job</p>
        <h2>${job.name}</h2>
        <p>${job.client} · ${job.address}</p>
      </div>
      ${statusBadge(job.status)}
    </div>
    <div class="detail-stats">
      <div><span>Prix</span><strong>${money.format(job.price)}</strong></div>
      <div><span>Coût</span><strong>${money.format(job.cost)}</strong></div>
      <div><span>Marge</span><strong>${margin(job)}%</strong></div>
    </div>
    <p class="detail-summary">${job.summary}</p>
    <div class="detail-tabs">
      <section>
        <h3>Documents</h3>
        <ul>${detailList(job.documents)}</ul>
      </section>
      <section>
        <h3>Plans</h3>
        <ul>${detailList(job.plans)}</ul>
      </section>
      <section>
        <h3>Devis</h3>
        <ul>${detailList(job.quotes)}</ul>
      </section>
      <section>
        <h3>Photos</h3>
        <ul>${detailList(job.photos)}</ul>
      </section>
    </div>
    <section class="job-log">
      <h3>Journal de bord</h3>
      ${job.log.map(entry => `<div>${entry}</div>`).join("")}
    </section>
    <button class="secondary-btn full">Ouvrir le dossier Drive</button>
  `;
}

function renderCalendar() {
  const days = [
    { date: 29, muted: true },
    { date: 30, muted: true },
    { date: 1 },
    { date: 2 },
    { date: 3 },
    { date: 4 },
    { date: 5 },
    { date: 6 },
    { date: 7 },
    { date: 8 },
    { date: 9 },
    { date: 10 },
    { date: 11, today: true },
    { date: 12 },
    { date: 13 },
    { date: 14 },
    { date: 15 },
    { date: 16 },
    { date: 17 },
    { date: 18 },
    { date: 19 },
    { date: 20 },
    { date: 21 },
    { date: 22 },
    { date: 23 },
    { date: 24 },
    { date: 25 },
    { date: 26 },
    { date: 27 },
    { date: 28 },
    { date: 29 },
    { date: 30 },
    { date: 31 },
    { date: 1, muted: true },
    { date: 2, muted: true }
  ];
  const jobsByDay = state.jobs.reduce((map, job) => {
    const day = Number(job.date.slice(-2));
    map[day] = [...(map[day] || []), job];
    return map;
  }, {});

  qs("#calendarGrid").innerHTML = days.map(day => {
    const jobs = day.muted ? [] : jobsByDay[day.date] || [];
    const count = jobs.length ? `${jobs.length} job${jobs.length > 1 ? "s" : ""}` : "";
    const classes = ["calendar-day", day.muted ? "muted" : "", day.today ? "today" : ""].filter(Boolean).join(" ");
    return `
      <article class="${classes}">
        <div class="calendar-date"><span>${day.date}</span><span class="calendar-count">${count}</span></div>
        ${jobs.map(job => {
          const itemClass = job.status === "À facturer" ? "invoice" : job.status === "En cours" ? "progress" : "";
          return `<div class="calendar-item ${itemClass}"><b>${job.client}</b><br>${job.name}<br>${job.crew}</div>`;
        }).join("")}
      </article>
    `;
  }).join("");
}

function renderTime() {
  qs("#timeEntries").innerHTML = state.time.length ? state.time.map(entry => `
    <div class="time-row">
      <span><strong>${entry.person}</strong><br><span class="job-meta">${entry.job}</span></span>
      <span>${entry.hours} h</span>
      <span class="badge ${entry.status === "Approuvé" ? "progress" : "warn"}">${entry.status}</span>
    </div>
  `).join("") : emptyState("Aucune feuille de temps", "Les heures envoyées par les employés apparaîtront ici.");
}

function renderEmployeeTime() {
  const employees = state.team.map(member => member.name);
  const jobs = state.jobs.map(job => job.name);
  const selectedPerson = qs("#employeeTimePerson")?.value || employees[0] || "";

  qs("#employeeTimePerson").innerHTML = optionList(employees, selectedPerson, "Ajouter un employé");
  qs("#employeeTimeJob").innerHTML = optionList(jobs, qs("#employeeTimeJob")?.value || jobs[0] || "", "Ajouter un job");

  const rows = state.time.filter(entry => entry.person === (qs("#employeeTimePerson").value || selectedPerson));
  const total = rows.reduce((sum, entry) => sum + entry.hours, 0);
  qs("#employeeWeekTotal").textContent = `${total.toFixed(2).replace(".00", "")} h`;
  qs("#employeeTimeList").innerHTML = rows.length ? rows.map(entry => `
    <article class="employee-time-card">
      <div>
        <strong>${entry.job}</strong>
        <span>${entry.status}</span>
      </div>
      <b>${entry.hours} h</b>
    </article>
  `).join("") : emptyState("Aucune heure entrée", "Les heures envoyées depuis ce formulaire seront listées ici.");
}

function optionList(items, selected, placeholder = "Aucune option") {
  if (!items.length) return `<option value="">${placeholder}</option>`;
  return items.map(item => `<option ${item === selected ? "selected" : ""}>${item}</option>`).join("");
}

function renderMileage() {
  const employees = ["Tous", ...state.team.map(member => member.name)];
  const vehicles = ["Tous", ...state.vehicles.map(vehicle => vehicle.label)];
  const tripEmployees = state.team.map(member => member.name);
  const tripVehicles = state.vehicles.map(vehicle => vehicle.label);
  const tripJobs = state.jobs.map(job => job.name);

  qs("#employeeFilter").innerHTML = optionList(employees, state.mileageEmployee);
  qs("#vehicleFilter").innerHTML = optionList(vehicles, state.mileageVehicle);
  qs("#tripEmployee").innerHTML = optionList(tripEmployees, tripEmployees[0], "Ajouter un employé");
  qs("#tripVehicle").innerHTML = optionList(tripVehicles, tripVehicles[0], "Ajouter un véhicule");
  qs("#tripJob").innerHTML = optionList(tripJobs, tripJobs[0], "Ajouter un job");

  const rows = state.mileage.filter(trip => {
    const employeeMatch = state.mileageEmployee === "Tous" || trip.employee === state.mileageEmployee;
    const vehicleMatch = state.mileageVehicle === "Tous" || trip.vehicle === state.mileageVehicle;
    return employeeMatch && vehicleMatch;
  });
  const proRows = rows.filter(trip => trip.type === "Professionnel");
  const totalKm = proRows.reduce((sum, trip) => sum + trip.km, 0);
  const reimbursement = totalKm * 0.70;

  qs("#mileageMonth").textContent = `${totalKm.toFixed(1)} km`;
  qs("#mileageReimbursement").textContent = money.format(reimbursement);
  qs("#mileageTrips").textContent = String(proRows.length);
  qs("#tripStatus").textContent = state.tripActive ? "Trajet GPS actif - enregistrement en cours." : "Aucun trajet en cours.";
  qs("#finishTrip").disabled = !state.tripActive;

  qs("#mileageTable").innerHTML = rows.length ? rows.map(trip => `
    <tr>
      <td>${trip.date}</td>
      <td>${trip.employee}</td>
      <td>${trip.vehicle}</td>
      <td>${trip.job}</td>
      <td>${trip.start}</td>
      <td>${trip.end}</td>
      <td><strong>${trip.km.toFixed(1)}</strong></td>
      <td><span class="badge ${trip.type === "Professionnel" ? "progress" : "warn"}">${trip.type}</span></td>
    </tr>
  `).join("") : `<tr><td colspan="8">${emptyState("Aucun trajet", "Les trajets professionnels apparaîtront ici.")}</td></tr>`;
}

function renderDocuments() {
  qs("#docGrid").innerHTML = state.jobs.length ? state.jobs.map(job => `
    <article class="doc-card">
      <h3>${job.client}</h3>
      <p>${job.name}</p>
      <a href="#" aria-label="Ouvrir ${job.drive}">${job.drive}</a>
      <p class="job-meta">Contrat · Photos · Plans · Factures</p>
    </article>
  `).join("") : emptyState("Aucun document", "Les dossiers de projet seront liés aux jobs que tu crées.");
}

function renderAccounting() {
  const rows = state.jobs.map(job => ({
    label: job.name,
    revenue: job.price,
    cost: job.cost,
    profit: job.price - job.cost
  }));

  qs("#financeRows").innerHTML = rows.length ? rows.map(row => `
    <div class="finance-row">
      <span><strong>${row.label}</strong><br><span class="job-meta">Coût ${money.format(row.cost)}</span></span>
      <span>${money.format(row.profit)}</span>
    </div>
  `).join("") : emptyState("Aucune donnée financière", "Les marges et profits apparaîtront avec tes premiers jobs.");
}

function renderTeam() {
  qs("#teamGrid").innerHTML = state.team.length ? state.team.map(member => `
    <article class="team-card">
      <h3>${member.name}</h3>
      <p>${member.role}</p>
      <div class="team-stats"><span>Heures</span><strong>${member.hours}</strong></div>
      <div class="team-stats"><span>Jobs</span><strong>${member.jobs}</strong></div>
      <div class="team-stats"><span>Accès</span><strong>${member.access}</strong></div>
    </article>
  `).join("") : emptyState("Aucun employé", "Ajoute tes employés quand la base de données sera branchée.");
}

function renderQuote() {
  const data = Object.fromEntries(new FormData(qs("#quoteForm")).entries());
  const materials = Number(data.materials);
  const labor = Number(data.hours) * Number(data.rate);
  const subs = Number(data.subs);
  const travel = Number(data.travel);
  const cost = materials + labor + subs + travel;
  const subtotal = cost / (1 - Number(data.margin) / 100);
  const tax = subtotal * (Number(data.tax) / 100);
  const total = subtotal + tax;

  qs("#quoteTotal").textContent = money.format(total);
  qs("#quoteLines").innerHTML = [
    ["Coût total", money.format(cost)],
    ["Main-d'oeuvre", money.format(labor)],
    ["Sous-total avant taxes", money.format(subtotal)],
    ["Taxes", money.format(tax)]
  ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");

  return { name: data.name, total, cost };
}

function renderAll() {
  renderDashboard();
  renderJobs();
  renderCalendar();
  renderTime();
  renderEmployeeTime();
  renderMileage();
  renderDocuments();
  renderAccounting();
  renderTeam();
  renderQuote();
}

function setView(view) {
  qsa(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === view));
  qsa(".view").forEach(section => section.classList.toggle("active", section.id === view));
  qs("#viewTitle").textContent = titles[view];
}

qsa(".nav-item").forEach(item => item.addEventListener("click", () => setView(item.dataset.view)));
qsa("[data-jump]").forEach(button => button.addEventListener("click", () => setView(button.dataset.jump)));
qsa("[data-filter]").forEach(button => button.addEventListener("click", () => {
  qsa("[data-filter]").forEach(item => item.classList.remove("active"));
  button.classList.add("active");
  state.filter = button.dataset.filter;
  renderJobs();
}));

qs("#globalSearch").addEventListener("input", renderJobs);
qs("#quoteForm").addEventListener("input", renderQuote);
qs("#newJobBtn").addEventListener("click", () => qs("#jobDialog").showModal());
qs("#closeJobDialog").addEventListener("click", () => qs("#jobDialog").close());
qs("#cancelJobDialog").addEventListener("click", () => qs("#jobDialog").close());
qs("#employeeTimePerson").addEventListener("change", renderEmployeeTime);
qs("#employeeTimeForm").addEventListener("submit", async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  if (!data.person || !data.job) return;
  try {
    const saved = await createTimeEntryInSupabase(data);
    state.time.unshift(saved || {
      person: data.person,
      job: data.job,
      hours: Number(data.hours),
      status: "À approuver",
      note: data.note || ""
    });
  } catch (error) {
    console.warn("Entrée locale seulement:", error);
    state.time.unshift({
      person: data.person,
      job: data.job,
      hours: Number(data.hours),
      status: "À approuver",
      note: data.note || ""
    });
    setDataStatus("Mode local - écriture Supabase refusée", false);
  }
  event.currentTarget.elements.note.value = "";
  renderTime();
  renderEmployeeTime();
  renderDashboard();
});
qs("#employeeFilter").addEventListener("change", event => {
  state.mileageEmployee = event.target.value;
  renderMileage();
});
qs("#vehicleFilter").addEventListener("change", event => {
  state.mileageVehicle = event.target.value;
  renderMileage();
});
qs("#startTrip").addEventListener("click", () => {
  if (!qs("#tripEmployee").value || !qs("#tripVehicle").value || !qs("#tripJob").value) return;
  state.tripActive = true;
  renderMileage();
});
qs("#finishTrip").addEventListener("click", () => {
  if (!state.tripActive) return;
  state.tripActive = false;
  state.mileage.unshift({
    date: "2026-07-11",
    employee: qs("#tripEmployee").value,
    vehicle: qs("#tripVehicle").value,
    job: qs("#tripJob").value,
    start: "Position GPS départ",
    end: "Position GPS arrivée",
    km: 14.7,
    type: "Professionnel"
  });
  state.mileageEmployee = "Tous";
  state.mileageVehicle = "Tous";
  renderMileage();
});
qs("#approveAll").addEventListener("click", () => {
  state.time = state.time.map(entry => ({ ...entry, status: "Approuvé" }));
  renderTime();
  renderDashboard();
});

qs("#saveQuote").addEventListener("click", async event => {
  event.preventDefault();
  const quote = renderQuote();
  try {
    const saved = await createQuoteJobInSupabase(quote);
    state.jobs.unshift(saved || {
      id: Date.now(),
      name: quote.name || "Job sans titre",
      client: "Client à confirmer",
      status: "Planifié",
      date: "2026-07-20",
      crew: "À assigner",
      price: Math.round(quote.total),
      cost: Math.round(quote.cost),
      drive: "Dossier Drive à créer",
      invoice: 0,
      summary: "Job créé depuis le calculateur. Détails à compléter.",
      documents: ["Devis généré"],
      plans: ["Plan à ajouter"],
      quotes: ["Prix calculé"],
      photos: ["Photos à ajouter"],
      log: ["Job créé depuis le calculateur."]
    });
  } catch (error) {
    console.warn("Job local seulement:", error);
    state.jobs.unshift({
      id: Date.now(),
      name: quote.name || "Job sans titre",
      client: "Client à confirmer",
      status: "Planifié",
      date: "2026-07-20",
      crew: "À assigner",
      price: Math.round(quote.total),
      cost: Math.round(quote.cost),
      drive: "Dossier Drive à créer",
      invoice: 0,
      summary: "Job créé depuis le calculateur. Détails à compléter.",
      documents: ["Devis généré"],
      plans: ["Plan à ajouter"],
      quotes: ["Prix calculé"],
      photos: ["Photos à ajouter"],
      log: ["Job créé depuis le calculateur."]
    });
    setDataStatus("Mode local - écriture Supabase refusée", false);
  }
  state.selectedJobId = state.jobs[0].id;
  setView("jobs");
  renderAll();
});

qs("#jobForm").addEventListener("submit", async event => {
  const submitter = event.submitter;
  if (submitter?.value === "cancel") return;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  try {
    const saved = await createJobInSupabase(data);
    state.jobs.unshift(saved || {
      id: Date.now(),
      name: data.name,
      client: data.client,
      status: data.status,
      date: data.date,
      crew: "À assigner",
      price: Number(data.price),
      cost: Math.round(Number(data.price) * 0.64),
      drive: `Dossier Drive / ${data.client}`,
      invoice: data.status === "À facturer" ? Number(data.price) : 0,
      summary: "Nouveau job ajouté au pipeline. Dossier à compléter.",
      documents: ["Contrat à préparer"],
      plans: ["Plan à ajouter"],
      quotes: ["Devis à finaliser"],
      photos: ["Photos initiales à ajouter"],
      log: ["Job créé manuellement."]
    });
  } catch (error) {
    console.warn("Job local seulement:", error);
    state.jobs.unshift({
      id: Date.now(),
      name: data.name,
      client: data.client,
      status: data.status,
      date: data.date,
      crew: "À assigner",
      price: Number(data.price),
      cost: Math.round(Number(data.price) * 0.64),
      drive: `Dossier Drive / ${data.client}`,
      invoice: data.status === "À facturer" ? Number(data.price) : 0,
      summary: "Nouveau job ajouté au pipeline. Dossier à compléter.",
      documents: ["Contrat à préparer"],
      plans: ["Plan à ajouter"],
      quotes: ["Devis à finaliser"],
      photos: ["Photos initiales à ajouter"],
      log: ["Job créé manuellement."]
    });
    setDataStatus("Mode local - écriture Supabase refusée", false);
  }
  state.selectedJobId = state.jobs[0].id;
  qs("#jobDialog").close();
  event.currentTarget.reset();
  setView("jobs");
  renderAll();
});

qs("#exportJobs").addEventListener("click", () => {
  const header = "job,client,statut,date,equipe,prix,marge";
  const rows = state.jobs.map(job => [job.name, job.client, job.status, job.date, job.crew, job.price, `${margin(job)}%`].join(","));
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "jobs.csv";
  link.click();
  URL.revokeObjectURL(link.href);
});

async function initApp() {
  renderAll();
  await loadFromSupabase();
  renderAll();
}

qs("#loginForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.target;
  const email = form.email.value.trim();
  const password = form.password.value;
  const submitBtn = qs("#loginSubmit");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Connexion...";
  }
  try {
    await signIn(email, password);
    showApp();
    await initApp();
  } catch (error) {
    showLoginScreen(error.message || "Courriel ou mot de passe invalide.");
  }
});

qs("#logoutBtn")?.addEventListener("click", () => {
  signOut();
});

async function bootstrap() {
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  const stored = loadStoredSession();
  if (stored?.access_token) {
    auth.session = stored;
    try {
      await loadProfile();
      if (!auth.profile) throw new Error("Profil introuvable.");
      showApp();
      await initApp();
      return;
    } catch (error) {
      console.warn("Session invalide, reconnexion requise:", error);
      auth.session = null;
      auth.profile = null;
      clearStoredSession();
    }
  }
  showLoginScreen();
}

bootstrap();
