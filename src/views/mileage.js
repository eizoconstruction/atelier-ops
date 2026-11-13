import { store, isAdmin, personName, tripVehicle, jobName, employeeOptions, vehicleOptions, jobOptions } from "../store.js";
import { esc, num, money2, today, fmtShort, fmtMonth, emptyState, badge, sum, toast, downloadCSV, haversineKm, round2 } from "../util.js";
import { tripForm } from "../forms.js";

const GPS_KEY = "atelier-ops-gps-trip";
const ui = { month: today().slice(0, 7), employee: "", vehicle: "", type: "" };
let watchId = null;
let wakeLock = null;

const getTrip = () => { try { return JSON.parse(localStorage.getItem(GPS_KEY) || "null"); } catch { return null; } };
const setTrip = t => (t ? localStorage.setItem(GPS_KEY, JSON.stringify(t)) : localStorage.removeItem(GPS_KEY));

// ---------- suivi GPS ----------
function startWatching(onUpdate) {
  if (!("geolocation" in navigator)) { toast("Ce téléphone ne donne pas accès au GPS.", "error"); return false; }
  stopWatching();
  watchId = navigator.geolocation.watchPosition(
    pos => {
      const t = getTrip();
      if (!t) return stopWatching();
      const p = { lat: pos.coords.latitude, lon: pos.coords.longitude, acc: pos.coords.accuracy, ts: pos.timestamp };
      if (p.acc > 60) { t.lastAcc = p.acc; setTrip(t); return onUpdate(t); } // point trop imprécis
      if (t.last) {
        const d = haversineKm(t.last, p);
        const hours = (p.ts - t.last.ts) / 3600000;
        // ignorer le « bruit » à l'arrêt (< 25 m) et les sauts impossibles (> 200 km/h)
        if (d * 1000 < 25) { t.lastAcc = p.acc; setTrip(t); return onUpdate(t); }
        if (hours > 0 && d / hours > 200) {
          // saut improbable : on l'ignore, mais après 3 rejets de suite on repart de ce point (sans compter la distance)
          t.rejects = (t.rejects || 0) + 1;
          if (t.rejects >= 3) { t.last = p; t.rejects = 0; }
          setTrip(t);
          return;
        }
        t.rejects = 0;
        t.km = round2((t.km || 0) + d);
      } else t.first = p;
      t.last = p;
      t.points = (t.points || 0) + 1;
      t.lastAcc = p.acc;
      setTrip(t);
      onUpdate(t);
    },
    err => {
      const msg = err.code === 1 ? "Accès à la position refusé. Autorise la localisation pour Atelier Ops dans les réglages du téléphone." : "Position GPS indisponible pour l'instant.";
      toast(msg, "error");
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
  );
  // garder l'écran allumé : sur téléphone, le GPS d'une app web s'arrête souvent quand l'écran s'éteint
  if ("wakeLock" in navigator) navigator.wakeLock.request("screen").then(l => { wakeLock = l; }).catch(() => {});
  return true;
}
function stopWatching() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}
document.addEventListener("visibilitychange", () => {
  // reprendre le suivi au retour sur l'app
  if (document.visibilityState === "visible" && getTrip() && watchId === null && location.hash.startsWith("#/mileage")) {
    startWatching(() => updateGpsBox());
  }
});

function updateGpsBox() {
  const t = getTrip();
  const box = document.getElementById("gpsLive");
  if (!t || !box) return;
  box.querySelector("[data-km]").textContent = `${num(t.km || 0, 1)} km`;
  box.querySelector("[data-acc]").textContent = t.lastAcc ? `précision ± ${Math.round(t.lastAcc)} m` : "recherche du signal…";
}

export default {
  render(el, _p, ctx) {
    draw(el, ctx);
    if (getTrip() && watchId === null) startWatching(() => updateGpsBox());
  }
};

function draw(el, ctx) {
  const admin = isAdmin();
  const me = store.me;
  const rate = Number(store.settings.mileage_rate) || 0.7;
  const trip = getTrip();
  ctx.actions.innerHTML = `<button class="primary-btn" id="addTrip">+ Trajet</button>`;
  ctx.actions.querySelector("#addTrip").onclick = () => tripForm();

  const rows = store.mileage_trips
    .filter(t => String(t.trip_date).slice(0, 7) === ui.month)
    .filter(t => admin || t.employee_id === me.id)
    .filter(t => !ui.employee || t.employee_id === ui.employee)
    .filter(t => !ui.vehicle || t.vehicle_id === ui.vehicle)
    .filter(t => !ui.type || t.trip_type === ui.type)
    .sort((a, b) => String(b.trip_date).localeCompare(String(a.trip_date)));
  const pro = rows.filter(t => t.trip_type === "Professionnel");
  const proKm = sum(pro, t => t.distance_km);
  const yearKm = sum(store.mileage_trips.filter(t => String(t.trip_date).slice(0, 4) === ui.month.slice(0, 4) && t.trip_type === "Professionnel" && (admin || t.employee_id === me.id) && (!ui.employee || t.employee_id === ui.employee)), t => t.distance_km);
  const months = [...new Set([today().slice(0, 7), ...store.mileage_trips.map(t => String(t.trip_date).slice(0, 7))])].sort().reverse();

  el.innerHTML = `
    <section class="panel gps ${trip ? "on" : ""}" id="gpsLive">
      ${trip ? `
        <p class="eyebrow">Trajet GPS en cours depuis ${new Date(trip.start).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}</p>
        <div class="punch-clock" data-km>${num(trip.km || 0, 1)} km</div>
        <p class="muted" data-acc>${trip.lastAcc ? `précision ± ${Math.round(trip.lastAcc)} m` : "recherche du signal…"}</p>
        <p class="help">Garde l'app ouverte pendant le trajet (l'écran reste allumé). Si l'app est fermée, le suivi reprend à la réouverture, mais la distance parcourue entre-temps sera comptée en ligne droite.</p>
        <div class="btn-row"><button class="ghost-btn" id="gpsCancel">Annuler</button><button class="primary-btn big" id="gpsStop">Arrivé — terminer le trajet</button></div>
      ` : `
        <div class="gps-start">
          <div><p class="eyebrow">Suivi GPS</p><h3>Enregistrer un trajet en conduisant</h3><p class="muted">La distance est calculée à partir de la position du téléphone.</p></div>
          <div class="form-grid tight">
            <label class="field"><span>Véhicule</span><select id="gpsVehicle"><option value="">—</option>${vehicleOptions().map(o => `<option value="${o.value}" ${o.value === localStorage.getItem("atelier-ops-last-vehicle") ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select></label>
            <label class="field"><span>Job</span><select id="gpsJob"><option value="">Aucun</option>${jobOptions().map(o => `<option value="${o.value}">${esc(o.label)}</option>`).join("")}</select></label>
          </div>
          <button class="primary-btn big" id="gpsStart">▶ Démarrer le trajet</button>
        </div>
      `}
    </section>

    <div class="toolbar">
      <select id="month" class="compact">${months.map(m => `<option value="${m}" ${m === ui.month ? "selected" : ""}>${fmtMonth(m)}</option>`).join("")}</select>
      ${admin ? `<select id="emp" class="compact"><option value="">Tous les conducteurs</option>${employeeOptions().map(o => `<option value="${o.value}" ${o.value === ui.employee ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>` : ""}
      <select id="veh" class="compact"><option value="">Tous les véhicules</option>${vehicleOptions().map(o => `<option value="${o.value}" ${o.value === ui.vehicle ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>
      <select id="typ" class="compact"><option value="">Pro + perso</option><option ${ui.type === "Professionnel" ? "selected" : ""}>Professionnel</option><option ${ui.type === "Personnel" ? "selected" : ""}>Personnel</option></select>
      <button class="ghost-btn" id="expKm">Exporter le registre</button>
    </div>

    <div class="kpis small">
      <div class="kpi"><span>Km professionnels (mois)</span><strong>${num(proKm)} km</strong><small>${pro.length} trajet(s)</small></div>
      <div class="kpi"><span>Allocation (${money2(rate)}/km)</span><strong>${money2(proKm * rate)}</strong></div>
      <div class="kpi"><span>Km pro. depuis janvier</span><strong>${num(yearKm)} km</strong><small>Le taux de l'ARC baisse après 5 000 km</small></div>
    </div>

    <section class="panel flush">
      ${rows.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th>${admin ? "<th>Conducteur</th>" : ""}<th>Véhicule</th><th>Job</th><th>Trajet</th><th class="num">km</th><th>Type</th><th>Source</th></tr></thead>
        <tbody>${rows.map(t => `<tr class="clickable" data-trip="${t.id}"><td>${fmtShort(t.trip_date)}</td>${admin ? `<td>${esc(personName(t.employee_id) || t.employee_name || "")}</td>` : ""}<td>${esc(tripVehicle(t))}</td><td>${esc(jobName(t.job_id) || t.job_name || "—")}</td>
          <td><small>${esc(t.start_label || "")} → ${esc(t.end_label || "")}${t.notes ? `<br>${esc(t.notes)}` : ""}</small></td><td class="num"><b>${num(t.distance_km)}</b></td>
          <td>${badge(t.trip_type, t.trip_type === "Professionnel" ? "progress" : "muted")}</td><td><small>${esc({ gps: "GPS", odometre: "Odomètre", manuel: "Manuel" }[t.source] || "Manuel")}</small></td></tr>`).join("")}</tbody></table></div>`
        : emptyState("Aucun trajet ce mois-ci", "Démarre un trajet GPS ou ajoute-le manuellement.")}
    </section>`;

  const redraw = () => draw(el, ctx);
  el.querySelector("#month").onchange = e => { ui.month = e.target.value; redraw(); };
  el.querySelector("#emp")?.addEventListener("change", e => { ui.employee = e.target.value; redraw(); });
  el.querySelector("#veh").onchange = e => { ui.vehicle = e.target.value; redraw(); };
  el.querySelector("#typ").onchange = e => { ui.type = e.target.value; redraw(); };
  el.querySelectorAll("[data-trip]").forEach(r => r.onclick = () => tripForm(store.mileage_trips.find(t => t.id === r.dataset.trip)));

  el.querySelector("#gpsStart")?.addEventListener("click", () => {
    setTrip({ start: Date.now(), km: 0, vehicle_id: el.querySelector("#gpsVehicle").value, job_id: el.querySelector("#gpsJob").value });
    if (!startWatching(() => updateGpsBox())) { setTrip(null); return; }
    toast("Trajet démarré — bonne route !");
    redraw();
  });
  el.querySelector("#gpsCancel")?.addEventListener("click", () => { stopWatching(); setTrip(null); redraw(); });
  el.querySelector("#gpsStop")?.addEventListener("click", async () => {
    const t = getTrip();
    stopWatching();
    // si l'app a été fermée, compléter avec la ligne droite entre le dernier point et l'arrivée
    const result = await tripForm(null, {
      source: "gps", distance_km: round2(t.km || 0), vehicle_id: t.vehicle_id, job_id: t.job_id,
      start_label: "", end_label: t.job_id ? jobName(t.job_id) : "",
      notes: ""
    });
    if (result) setTrip(null);
    else startWatching(() => updateGpsBox()); // annulé : on continue le suivi
    redraw();
  });

  el.querySelector("#expKm").onclick = () => downloadCSV(`kilometrage-${ui.month}.csv`, [
    ["Registre des déplacements — " + (store.settings.company_name || "")],
    ["Date", "Conducteur", "Véhicule", "Départ", "Destination", "But / job", "Odomètre départ", "Odomètre arrivée", "Km", "Type", "Taux", "Montant"],
    ...rows.slice().reverse().map(t => [t.trip_date, personName(t.employee_id) || t.employee_name || "", tripVehicle(t), t.start_label || "", t.end_label || "", [jobName(t.job_id), t.notes].filter(Boolean).join(" — "), t.start_odometer || "", t.end_odometer || "", t.distance_km, t.trip_type, rate, t.trip_type === "Professionnel" ? (t.distance_km * rate).toFixed(2) : ""]),
    [],
    ["", "", "", "", "", "", "", "Total pro.", proKm, "", "", (proKm * rate).toFixed(2)]
  ]);
}
