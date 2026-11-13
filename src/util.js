// Petits utilitaires partagés par tous les écrans.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}

const moneyFmt = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
const moneyFmt2 = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = n => moneyFmt.format(Number(n) || 0);
export const money2 = n => moneyFmt2.format(Number(n) || 0);
export const num = (n, d = 1) => (Number(n) || 0).toLocaleString("fr-CA", { minimumFractionDigits: 0, maximumFractionDigits: d });
export const pct = n => `${Math.round(Number(n) || 0)} %`;
export const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

// ---- dates (toujours en heure locale, format AAAA-MM-JJ) ----
export function isoDate(d = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
export const today = () => isoDate(new Date());
export function parseISO(s) {
  if (!s) return null;
  const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(s, n) {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
export function startOfWeek(s = today()) {
  const d = parseISO(s);
  const dow = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - dow);
  return isoDate(d);
}
export function monthKey(s) { return String(s || "").slice(0, 7); }
export function fmtDate(s, opts = { day: "numeric", month: "short", year: "numeric" }) {
  const d = parseISO(s);
  return d ? d.toLocaleDateString("fr-CA", opts) : "—";
}
export const fmtShort = s => fmtDate(s, { day: "numeric", month: "short" });
export function fmtMonth(key) {
  const [y, m] = key.split("-").map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString("fr-CA", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function daysBetween(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}
export function hoursFromTimes(start, end, breakMin = 0) {
  if (!start || !end) return 0;
  const [h1, m1] = start.split(":").map(Number);
  const [h2, m2] = end.split(":").map(Number);
  let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins < 0) mins += 24 * 60;
  return round2(Math.max(0, mins - (Number(breakMin) || 0)) / 60);
}
export const hhmm = t => (t ? String(t).slice(0, 5) : "");

// ---- distance GPS (km) ----
export function haversineKm(a, b) {
  const R = 6371;
  const toRad = x => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const initials = name => String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join("");
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);
export const sum = (arr, fn) => arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0);

export function groupBy(arr, fn) {
  return arr.reduce((m, x) => { const k = fn(x); (m[k] ||= []).push(x); return m; }, {});
}

// ---- toast ----
let toastTimer;
export function toast(message, kind = "ok") {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

// ---- téléchargement CSV ----
export function downloadCSV(filename, rows) {
  const escCell = v => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // séparateur ; = ouvre correctement dans Excel en français
  const csv = "﻿" + rows.map(r => r.map(escCell).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---- formulaires en fenêtre (dialog) ----
// fields: [{ name, label, type: text|number|date|time|select|textarea|checkbox|email|tel|url|file|hidden|multiselect,
//            options:[{value,label}] | [string], required, step, min, max, placeholder, full, help, accept }]
export function openForm({ title, fields, values = {}, submitLabel = "Enregistrer", onSubmit, onDelete, deleteLabel = "Supprimer", onChange, wide = false }) {
  return new Promise(resolve => {
    const dlg = document.createElement("dialog");
    dlg.className = `modal ${wide ? "wide" : ""}`;
    dlg.innerHTML = `
      <form class="modal-form" novalidate>
        <header class="modal-head">
          <h2>${esc(title)}</h2>
          <button type="button" class="icon-btn" data-close aria-label="Fermer">✕</button>
        </header>
        <div class="form-grid">${fields.map(f => fieldHTML(f, values[f.name])).join("")}</div>
        <p class="form-error" hidden></p>
        <footer class="modal-foot">
          ${onDelete ? `<button type="button" class="danger-btn" data-delete>${esc(deleteLabel)}</button>` : ""}
          <span class="spacer"></span>
          <button type="button" class="ghost-btn" data-close>Annuler</button>
          <button type="submit" class="primary-btn">${esc(submitLabel)}</button>
        </footer>
      </form>`;
    document.body.appendChild(dlg);
    const form = dlg.querySelector("form");
    const errEl = dlg.querySelector(".form-error");
    const close = result => { dlg.close(); dlg.remove(); resolve(result); };
    dlg.addEventListener("cancel", e => { e.preventDefault(); close(null); });
    dlg.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => close(null)));
    if (onChange) form.addEventListener("input", () => onChange(readForm(form, fields), form));
    dlg.querySelector("[data-delete]")?.addEventListener("click", async () => {
      if (!(await confirmBox(`${deleteLabel} ? Cette action est définitive.`))) return;
      try { await onDelete(); close("deleted"); } catch (e) { errEl.textContent = humanError(e); errEl.hidden = false; }
    });
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const data = readForm(form, fields);
      const missing = fields.filter(f => f.required && (data[f.name] === "" || data[f.name] === null || data[f.name] === undefined));
      if (missing.length) {
        errEl.textContent = `Champ requis : ${missing.map(f => f.label).join(", ")}`;
        errEl.hidden = false;
        return;
      }
      const btn = form.querySelector("[type=submit]");
      btn.disabled = true;
      btn.textContent = "Enregistrement…";
      try {
        await onSubmit?.(data);
        close(data);
      } catch (err) {
        console.error(err);
        errEl.textContent = humanError(err);
        errEl.hidden = false;
        btn.disabled = false;
        btn.textContent = submitLabel;
      }
    });
    dlg.showModal();
    if (onChange) onChange(readForm(form, fields), form);
    form.querySelector("input:not([type=hidden]),select,textarea")?.focus();
  });
}

function optionsOf(f) {
  return (f.options || []).map(o => (typeof o === "object" ? o : { value: o, label: o }));
}

function fieldHTML(f, value) {
  const v = value ?? f.default ?? "";
  const id = `f-${f.name}-${Math.random().toString(36).slice(2, 7)}`;
  const req = f.required ? " *" : "";
  const cls = `field ${f.full || f.type === "textarea" ? "full" : ""}`;
  const help = f.help ? `<small class="help">${esc(f.help)}</small>` : "";
  if (f.type === "hidden") return `<input type="hidden" name="${f.name}" value="${esc(v)}">`;
  if (f.type === "section") return `<h3 class="form-section full">${esc(f.label)}</h3>`;
  if (f.type === "select") {
    return `<label class="${cls}" for="${id}"><span>${esc(f.label)}${req}</span>
      <select id="${id}" name="${f.name}">${f.placeholder !== false ? `<option value="">${esc(f.placeholder || "—")}</option>` : ""}
      ${optionsOf(f).map(o => `<option value="${esc(o.value)}" ${String(o.value) === String(v) ? "selected" : ""}>${esc(o.label)}</option>`).join("")}
      </select>${help}</label>`;
  }
  if (f.type === "multiselect") {
    const sel = new Set((v || []).map(String));
    return `<fieldset class="${cls} checks"><legend>${esc(f.label)}</legend>
      ${optionsOf(f).map(o => `<label class="check"><input type="checkbox" name="${f.name}" value="${esc(o.value)}" ${sel.has(String(o.value)) ? "checked" : ""}> ${esc(o.label)}</label>`).join("") || "<small class='help'>Aucune option</small>"}
      ${help}</fieldset>`;
  }
  if (f.type === "textarea") {
    return `<label class="${cls}" for="${id}"><span>${esc(f.label)}${req}</span><textarea id="${id}" name="${f.name}" rows="${f.rows || 3}" placeholder="${esc(f.placeholder || "")}">${esc(v)}</textarea>${help}</label>`;
  }
  if (f.type === "checkbox") {
    return `<label class="${cls} check"><input type="checkbox" name="${f.name}" ${v ? "checked" : ""}> ${esc(f.label)}${help}</label>`;
  }
  if (f.type === "file") {
    return `<label class="${cls}" for="${id}"><span>${esc(f.label)}${req}</span><input id="${id}" type="file" name="${f.name}" ${f.multiple ? "multiple" : ""} ${f.accept ? `accept="${esc(f.accept)}"` : ""} ${f.capture ? `capture="${f.capture}"` : ""}>${help}</label>`;
  }
  if (f.type === "static") {
    return `<div class="${cls} static" data-static="${f.name}"><span>${esc(f.label)}</span><strong>${esc(v)}</strong></div>`;
  }
  const attrs = [
    f.step ? `step="${f.step}"` : f.type === "number" ? 'step="any"' : "",
    f.min !== undefined ? `min="${f.min}"` : "",
    f.max !== undefined ? `max="${f.max}"` : "",
    f.placeholder ? `placeholder="${esc(f.placeholder)}"` : "",
    f.list ? `list="${id}-list"` : "",
    f.type === "number" ? 'inputmode="decimal"' : ""
  ].join(" ");
  const datalist = f.list ? `<datalist id="${id}-list">${f.list.map(o => `<option value="${esc(o)}">`).join("")}</datalist>` : "";
  return `<label class="${cls}" for="${id}"><span>${esc(f.label)}${req}</span><input id="${id}" type="${f.type || "text"}" name="${f.name}" value="${esc(v)}" ${attrs}>${datalist}${help}</label>`;
}

function readForm(form, fields) {
  const out = {};
  for (const f of fields) {
    if (f.type === "section" || f.type === "static") continue;
    if (f.type === "multiselect") { out[f.name] = [...form.querySelectorAll(`[name="${f.name}"]:checked`)].map(i => i.value); continue; }
    const el = form.elements[f.name];
    if (!el) continue;
    if (f.type === "checkbox") out[f.name] = el.checked;
    else if (f.type === "file") out[f.name] = [...(el.files || [])];
    else if (f.type === "number") out[f.name] = el.value === "" ? (f.required ? "" : null) : Number(el.value);
    else out[f.name] = el.value.trim();
  }
  return out;
}

export function confirmBox(message, okLabel = "Confirmer") {
  return new Promise(resolve => {
    const dlg = document.createElement("dialog");
    dlg.className = "modal small";
    dlg.innerHTML = `<div class="modal-form"><p class="confirm-text">${esc(message)}</p>
      <footer class="modal-foot"><span class="spacer"></span><button class="ghost-btn" data-no>Annuler</button><button class="danger-btn" data-yes>${esc(okLabel)}</button></footer></div>`;
    document.body.appendChild(dlg);
    const done = v => { dlg.close(); dlg.remove(); resolve(v); };
    dlg.querySelector("[data-no]").onclick = () => done(false);
    dlg.querySelector("[data-yes]").onclick = () => done(true);
    dlg.addEventListener("cancel", e => { e.preventDefault(); done(false); });
    dlg.showModal();
  });
}

export function humanError(e) {
  const msg = e?.message || String(e);
  if (/row-level security|permission denied|42501/i.test(msg)) return "Accès refusé : ce compte n'a pas la permission de faire cette action.";
  if (/Failed to fetch|NetworkError/i.test(msg)) return "Pas de connexion avec le serveur. Vérifie ton internet.";
  if (/JWT expired|invalid jwt/i.test(msg)) return "Session expirée : reconnecte-toi.";
  return msg;
}

export function emptyState(title, body = "", action = "") {
  return `<div class="empty-state"><strong>${esc(title)}</strong>${body ? `<span>${esc(body)}</span>` : ""}${action}</div>`;
}

export function badge(text, tone = "") {
  return `<span class="badge ${tone ? `t-${tone}` : ""}">${esc(text)}</span>`;
}
