import "./styles.css";
import { api, setDemo } from "./api.js";
import { store, loadAll, onStoreChange, isAdmin } from "./store.js";
import { $, esc, initials, toast, humanError, openForm } from "./util.js";

import dashboard from "./views/dashboard.js";
import jobs from "./views/jobs.js";
import clients from "./views/clients.js";
import quotes from "./views/quotes.js";
import calendar from "./views/calendar.js";
import time from "./views/time.js";
import myTime from "./views/myTime.js";
import mileage from "./views/mileage.js";
import documents from "./views/documents.js";
import accounting from "./views/accounting.js";
import team from "./views/team.js";
import settings from "./views/settings.js";

// Ordre = ordre du menu. who: "all" | "admin" | "employee"
const VIEWS = [
  { id: "dashboard", label: "Vue d'ensemble", sub: "Priorités et alertes", icon: "◧", who: "all", mod: dashboard, mobile: true },
  { id: "jobs", label: "Jobs", sub: "Projets et dossiers", icon: "⌂", who: "all", mod: jobs, mobile: true },
  { id: "clients", label: "Clients", sub: "Coordonnées et historique", icon: "☺", who: "admin", mod: clients },
  { id: "quotes", label: "Estimation et devis", sub: "Coûts, marge, taxes", icon: "∑", who: "admin", mod: quotes },
  { id: "calendar", label: "Calendrier", sub: "Horaire des chantiers", icon: "▦", who: "all", mod: calendar, mobile: true },
  { id: "time", label: "Feuilles de temps", sub: "Heures et approbation", icon: "◷", who: "admin", mod: time, mobile: true, short: "Approb." },
  { id: "myTime", label: "Mes heures", sub: "Pointage et saisie", icon: "▶", who: "all", mod: myTime, mobile: true, short: "Pointage" },
  { id: "mileage", label: "Kilométrage", sub: "Trajets et véhicules", icon: "➚", who: "all", mod: mileage, mobile: true, short: "Km" },
  { id: "documents", label: "Documents", sub: "Photos, plans, contrats", icon: "▤", who: "all", mod: documents },
  { id: "accounting", label: "Comptabilité", sub: "Facturation et profits", icon: "$", who: "admin", mod: accounting },
  { id: "team", label: "Employés et véhicules", sub: "Accès, taux, flotte", icon: "☷", who: "admin", mod: team },
  { id: "settings", label: "Paramètres", sub: "Entreprise, taxes, taux", icon: "⚙", who: "admin", mod: settings }
];

const visibleViews = () => VIEWS.filter(v => v.who === "all" || (v.who === "admin" ? isAdmin() : !isAdmin()));

// ---------- routeur (#/vue/param) ----------
function parseHash() {
  const [, view = "dashboard", ...rest] = location.hash.replace(/^#/, "").split("/");
  return { view, params: rest };
}
export function go(view, ...params) {
  const h = `#/${[view, ...params].filter(Boolean).join("/")}`;
  if (location.hash === h) render(); else location.hash = h;
}
window.addEventListener("hashchange", () => render());

let current = null;
function render() {
  if (!store.me) return;
  const { view, params } = parseHash();
  const allowed = visibleViews();
  const def = allowed.find(v => v.id === view) || allowed[0];
  current = def;
  $("#viewTitle").textContent = def.label;
  $("#viewSub").textContent = def.sub;
  document.title = `${def.label} — Atelier Ops`;
  $("#topActions").innerHTML = "";
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === def.id));
  const el = $("#view");
  try {
    def.mod.render(el, params, { go, actions: $("#topActions") });
  } catch (e) {
    console.error(e);
    el.innerHTML = `<div class="panel"><h2>Oups</h2><p>Cet écran a rencontré une erreur : ${esc(e.message)}</p></div>`;
  }
  closeMenu();
}

function buildNav() {
  const views = visibleViews();
  $("#nav").innerHTML = views.map(v => `
    <button class="nav-item" data-view="${v.id}"><span class="nav-ico">${v.icon}</span><span><b>${esc(v.label)}</b><small>${esc(v.sub)}</small></span></button>`).join("");
  $("#bottomNav").innerHTML = views.filter(v => v.mobile).slice(0, 5).map(v => `
    <button class="nav-item" data-view="${v.id}"><span class="nav-ico">${v.icon}</span><small>${esc(v.short || v.label.split(" ")[0])}</small></button>`).join("");
  document.querySelectorAll(".nav-item").forEach(b => b.addEventListener("click", () => go(b.dataset.view)));
  $("#meName").textContent = store.me.full_name || store.session?.user?.email;
  $("#meRole").textContent = isAdmin() ? "Administrateur" : (store.me.title || "Employé");
  $("#meAvatar").textContent = initials(store.me.full_name);

  // en mode démo : basculer entre la vue admin et la vue employé
  if (api.mode === "demo") {
    $("#demoSwitch").innerHTML = `<label class="demo-switch"><span>Mode démo — voir comme :</span>
      <select id="demoUser">${store.profiles.map(p => `<option value="${p.id}" ${p.id === store.me.id ? "selected" : ""}>${esc(p.full_name)} (${p.role === "admin" ? "admin" : "employé"})</option>`).join("")}</select></label>
      <button class="link-btn light" id="demoExit" type="button">Quitter la démo</button>`;
    $("#demoUser").onchange = e => { api.auth.switchUser(e.target.value); location.reload(); };
    $("#demoExit").onclick = () => { setDemo(false); location.href = location.pathname; };
  }
}

// ---------- menu mobile ----------
const closeMenu = () => document.body.classList.remove("menu-open");
$("#menuBtn").addEventListener("click", () => document.body.classList.toggle("menu-open"));
$("#backdrop").addEventListener("click", closeMenu);

// ---------- état de connexion ----------
function setConn() {
  const el = $("#connStatus");
  const online = navigator.onLine;
  const demo = api.mode === "demo";
  el.className = `conn ${demo ? "demo" : online ? "ok" : "off"}`;
  el.querySelector("span").textContent = demo ? "Démo" : online ? "En ligne" : "Hors ligne";
}
window.addEventListener("online", setConn);
window.addEventListener("offline", setConn);

function showBanner() {
  const b = $("#banner");
  const missing = store.errors.filter(e => /does not exist|schema cache|Could not find/i.test(e.message));
  if (missing.length && isAdmin()) {
    b.innerHTML = `<div class="banner warn"><b>Base de données à mettre à jour.</b> Certaines tables manquent (${missing.map(m => esc(m.table)).join(", ")}). Exécute <code>supabase/migrations/002_v2.sql</code> dans Supabase &gt; SQL Editor.</div>`;
  } else if (store.errors.length && !missing.length && store.errors.some(e => /fetch/i.test(e.message))) {
    b.innerHTML = `<div class="banner danger">Impossible de joindre le serveur. Les données affichées peuvent être incomplètes.</div>`;
  } else b.innerHTML = "";
}

// ---------- connexion ----------
function showLogin(message, info) {
  $("#appShell").hidden = true;
  $("#loginScreen").hidden = false;
  const err = $("#loginError");
  err.hidden = !message;
  err.textContent = message || "";
  const inf = $("#loginInfo");
  inf.hidden = !info;
  inf.textContent = info || "";
  const btn = $("#loginSubmit");
  btn.disabled = false;
  btn.textContent = "Se connecter";
}

async function enterApp(session) {
  store.session = session;
  $("#loginScreen").hidden = true;
  $("#appShell").hidden = false;
  $("#view").innerHTML = `<div class="loading">Chargement des données…</div>`;
  setConn();
  try {
    await loadAll();
  } catch (e) {
    showLogin(humanError(e));
    return;
  }
  if (!store.me) {
    await api.auth.signOut();
    showLogin("Ce compte n'a pas de profil Atelier Ops. Demande à l'administrateur de l'activer (voir README, section « Ajouter un employé »).");
    return;
  }
  if (store.me.active === false) {
    await api.auth.signOut();
    showLogin("Ce compte est désactivé.");
    return;
  }
  buildNav();
  showBanner();
  render();
}

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.currentTarget;
  const btn = $("#loginSubmit");
  btn.disabled = true;
  btn.textContent = "Connexion…";
  try {
    const session = await api.auth.signIn(f.email.value.trim(), f.password.value);
    await enterApp(session);
  } catch (err) {
    showLogin(/invalid login/i.test(err.message) ? "Courriel ou mot de passe invalide." : humanError(err));
  }
});

$("#forgotBtn").addEventListener("click", async () => {
  const email = $("#loginForm").email.value.trim();
  if (!email) return showLogin("Entre ton courriel, puis clique « Mot de passe oublié ».");
  try {
    await api.auth.resetPassword(email);
    showLogin("", "Si ce courriel existe, un lien de réinitialisation vient d'être envoyé.");
  } catch (err) { showLogin(humanError(err)); }
});

$("#demoBtn").addEventListener("click", () => { setDemo(true); location.reload(); });

$("#logoutBtn").addEventListener("click", async () => {
  await api.auth.signOut();
  store.me = null;
  showLogin();
});

// re-rendre l'écran courant quand les données changent (après une sauvegarde)
let pending = false;
onStoreChange(() => {
  if (!store.me || pending) return;
  pending = true;
  queueMicrotask(() => { pending = false; if (current?.mod.refreshOnChange !== false) render(); });
});

async function handlePasswordReset() {
  // l'utilisateur arrive depuis le lien « mot de passe oublié »
  if (!new URLSearchParams(location.search).has("reset")) return false;
  await openForm({
    title: "Choisir un nouveau mot de passe",
    fields: [{ name: "password", label: "Nouveau mot de passe (8 caractères min.)", type: "password", required: true }],
    onSubmit: async d => {
      if (d.password.length < 8) throw new Error("Au moins 8 caractères.");
      await api.auth.updatePassword(d.password);
      toast("Mot de passe changé");
    }
  });
  history.replaceState(null, "", location.pathname + location.hash);
  return true;
}

async function bootstrap() {
  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
  if (api.mode === "demo") $("#demoBtn").textContent = "Entrer dans la démo";
  api.auth.onChange((event, session) => {
    if (event === "SIGNED_OUT") { store.me = null; showLogin(); }
    if (event === "TOKEN_REFRESHED" && session) store.session = session;
  });
  try {
    const session = await api.auth.session();
    if (session) {
      await handlePasswordReset();
      await enterApp(session);
    } else showLogin();
  } catch (e) {
    showLogin(humanError(e));
  }
}

bootstrap();
