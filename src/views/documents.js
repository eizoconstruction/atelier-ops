import { store, isAdmin, clientOf, FILE_CATEGORIES } from "../store.js";
import { esc, emptyState } from "../util.js";
import { filesGrid, bindFilesGrid, uploadDialog, linkDialog } from "../files.js";

const ui = { job: "", cat: "", search: "" };

export default {
  render(el, _p, ctx) { draw(el, ctx); }
};

function draw(el, ctx) {
  ctx.actions.innerHTML = `<button class="ghost-btn" id="addLink">+ Lien</button><button class="primary-btn" id="addFiles">+ Fichiers / photos</button>`;
  ctx.actions.querySelector("#addFiles").onclick = () => uploadDialog(ui.job || null);
  ctx.actions.querySelector("#addLink").onclick = () => linkDialog(ui.job || null);

  const visibleJobs = isAdmin() ? store.jobs : store.jobs.filter(j => (j.crew_ids || []).includes(store.me.id));
  const jobIds = new Set(visibleJobs.map(j => j.id));
  const q = ui.search.toLowerCase();
  const files = store.job_files
    .filter(f => jobIds.has(f.job_id))
    .filter(f => !ui.job || f.job_id === ui.job)
    .filter(f => !ui.cat || f.category === ui.cat)
    .filter(f => !q || String(f.title).toLowerCase().includes(q))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  const folders = visibleJobs
    .map(j => ({ j, n: store.job_files.filter(f => f.job_id === j.id).length }))
    .sort((a, b) => b.n - a.n || a.j.name.localeCompare(b.j.name));

  el.innerHTML = `
    <div class="split">
      <section class="panel flush list-pane">
        <ul class="client-list">
          <li class="${!ui.job ? "active" : ""}" data-job=""><span class="avatar">▤</span><span><b>Tous les dossiers</b><small>${store.job_files.filter(f => jobIds.has(f.job_id)).length} fichier(s)</small></span></li>
          ${folders.map(({ j, n }) => `<li class="${ui.job === j.id ? "active" : ""}" data-job="${j.id}"><span class="avatar">⌂</span><span><b>${esc(j.name)}</b><small>${[clientOf(j)?.name, `${n} fichier(s)`].filter(Boolean).map(esc).join(" · ")}</small></span>${j.drive_url ? `<a class="right link-btn" href="${esc(j.drive_url)}" target="_blank" rel="noopener" title="Dossier Drive">Drive ↗</a>` : ""}</li>`).join("")}
        </ul>
      </section>
      <section class="panel detail-pane">
        <div class="toolbar">
          <input class="search" id="docSearch" type="search" placeholder="Rechercher un fichier…" value="${esc(ui.search)}">
          <select id="docCat" class="compact"><option value="">Toutes catégories</option>${FILE_CATEGORIES.map(c => `<option value="${c.value}" ${c.value === ui.cat ? "selected" : ""}>${c.label}</option>`).join("")}</select>
        </div>
        ${visibleJobs.length ? filesGrid(files, { showJob: !ui.job }) : emptyState("Aucun job", "Les documents sont classés par job.")}
      </section>
    </div>`;

  el.querySelectorAll("[data-job]").forEach(li => li.addEventListener("click", e => { if (e.target.closest("a")) return; ui.job = li.dataset.job; draw(el, ctx); }));
  el.querySelector("#docCat").onchange = e => { ui.cat = e.target.value; draw(el, ctx); };
  const s = el.querySelector("#docSearch");
  s.oninput = () => { ui.search = s.value; draw(el, ctx); const n = el.querySelector("#docSearch"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  bindFilesGrid(el);
}
