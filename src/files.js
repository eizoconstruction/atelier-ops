// Fichiers de chantier : photos, plans, contrats, reçus (Supabase Storage)
// + liens externes (Google Drive, etc.).

import { api } from "./api.js";
import { store, create, destroy, isAdmin, FILE_CATEGORIES, jobOptions, jobName, personName } from "./store.js";
import { esc, openForm, toast, fmtShort, emptyState, humanError, confirmBox } from "./util.js";

const catLabel = v => FILE_CATEGORIES.find(c => c.value === v)?.label || v;
const isImage = f => /^image\//.test(f.mime_type || "") || /\.(jpe?g|png|gif|webp|heic)$/i.test(f.title || "");
const urlCache = new Map();

async function signedUrl(path) {
  const hit = urlCache.get(path);
  if (hit && hit.exp > Date.now()) return hit.url;
  const url = await api.files.url(path, 3600);
  urlCache.set(path, { url, exp: Date.now() + 50 * 60 * 1000 });
  return url;
}

// Réduit les photos du téléphone (souvent 4-8 Mo) avant l'envoi
async function shrinkImage(file, maxSide = 2000, quality = 0.82) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 600 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) });
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch { return file; }
}

const safeName = n => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(-80);

export async function uploadFiles(jobId, fileList, category) {
  let ok = 0;
  for (const original of fileList) {
    const file = await shrinkImage(original);
    const cat = category || (/^image\//.test(file.type) ? "photo" : "document");
    const path = `${jobId}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${safeName(file.name)}`;
    try {
      await api.files.upload(path, file);
      await create("job_files", { job_id: jobId, category: cat, title: original.name, storage_path: path, mime_type: file.type, size_bytes: file.size, uploaded_by: store.me.id });
      ok++;
    } catch (e) {
      toast(`Échec : ${original.name} — ${humanError(e)}`, "error");
    }
  }
  if (ok) toast(`${ok} fichier(s) ajouté(s)`);
}

export function uploadDialog(jobId = null) {
  return openForm({
    title: "Ajouter des fichiers",
    fields: [
      { name: "job_id", label: "Job", type: "select", options: jobOptions(true), required: true, full: true },
      { name: "category", label: "Catégorie", type: "select", options: FILE_CATEGORIES, placeholder: "Automatique (photo / document)" },
      { name: "files", label: "Fichiers", type: "file", multiple: true, required: true, full: true, help: "Sur téléphone, tu peux prendre une photo directement." }
    ],
    values: { job_id: jobId },
    submitLabel: "Téléverser",
    onSubmit: async d => {
      if (!d.files.length) throw new Error("Choisis au moins un fichier.");
      await uploadFiles(d.job_id, d.files, d.category);
    }
  });
}

export function linkDialog(jobId = null) {
  return openForm({
    title: "Ajouter un lien",
    fields: [
      { name: "job_id", label: "Job", type: "select", options: jobOptions(true), required: true, full: true },
      { name: "title", label: "Titre", required: true, placeholder: "ex. Plans d'architecte (Drive)" },
      { name: "category", label: "Catégorie", type: "select", options: FILE_CATEGORIES, placeholder: false },
      { name: "url", label: "Adresse (URL)", type: "url", required: true, full: true }
    ],
    values: { job_id: jobId, category: "document" },
    onSubmit: async d => {
      if (!/^https?:\/\//i.test(d.url)) throw new Error("L'adresse doit commencer par https://");
      await create("job_files", { ...d, uploaded_by: store.me.id });
      toast("Lien ajouté");
    }
  });
}

export async function openFile(f) {
  try {
    const url = f.storage_path ? await signedUrl(f.storage_path) : f.url;
    if (url) window.open(url, "_blank", "noopener");
  } catch (e) { toast(humanError(e), "error"); }
}

export async function deleteFile(f) {
  if (!(await confirmBox(`Supprimer « ${f.title} » ?`, "Supprimer"))) return;
  try {
    if (f.storage_path) await api.files.remove(f.storage_path).catch(() => {});
    await destroy("job_files", f.id);
    toast("Fichier supprimé");
  } catch (e) { toast(humanError(e), "error"); }
}

// Grille de fichiers (job unique ou tous)
export function filesGrid(files, { showJob = false } = {}) {
  if (!files.length) return emptyState("Aucun fichier", "Ajoute des photos, plans ou contrats.");
  return `<div class="file-grid">${files.map(f => `
    <article class="file-card" data-file="${f.id}">
      <button class="file-thumb" data-open="${f.id}" aria-label="Ouvrir ${esc(f.title)}">
        ${isImage(f) && f.storage_path ? `<img data-thumb="${esc(f.storage_path)}" alt="" loading="lazy">` : `<span class="file-ico">${f.url ? "🔗" : (f.mime_type || "").includes("pdf") ? "PDF" : "📄"}</span>`}
      </button>
      <div class="file-meta">
        <b title="${esc(f.title)}">${esc(f.title)}</b>
        <small>${esc(catLabel(f.category))}${showJob ? ` · ${esc(jobName(f.job_id))}` : ""} · ${fmtShort(String(f.created_at).slice(0, 10))}${f.uploaded_by ? ` · ${esc(personName(f.uploaded_by))}` : ""}</small>
      </div>
      ${isAdmin() || f.uploaded_by === store.me.id ? `<button class="icon-btn small" data-del="${f.id}" aria-label="Supprimer">✕</button>` : ""}
    </article>`).join("")}</div>`;
}

export function bindFilesGrid(root) {
  root.querySelectorAll("[data-open]").forEach(b => b.addEventListener("click", () => openFile(store.job_files.find(f => f.id === b.dataset.open))));
  root.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => deleteFile(store.job_files.find(f => f.id === b.dataset.del))));
  root.querySelectorAll("img[data-thumb]").forEach(async img => {
    try { img.src = await signedUrl(img.dataset.thumb); } catch { img.remove(); }
  });
}
