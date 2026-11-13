const defaultData = {
  jobs: [
    { id: 'j1', name: 'Rénovation cuisine — Tremblay', client: 'Marie Tremblay', progress: 72, budget: '42 000 $', color: 'blue', timeLog: [] },
    { id: 'j2', name: 'Agrandissement — Gagnon', client: 'Simon Gagnon', progress: 46, budget: '96 500 $', color: 'green', timeLog: [] },
    { id: 'j3', name: 'Salle de bain — Lavoie', client: 'Émilie Lavoie', progress: 88, budget: '18 750 $', color: 'amber', timeLog: [] },
    { id: 'j4', name: 'Terrasse & pergola — Roy', client: 'Alex Roy', progress: 18, budget: '27 900 $', color: 'violet', timeLog: [] }
  ],
  tasks: [
    { text: 'Confirmer la livraison des armoires', due: 'Aujourd’hui · Cuisine Tremblay', done: false },
    { text: 'Envoyer le devis révisé à M. Gagnon', due: 'Aujourd’hui · Avant 16 h', done: false },
    { text: 'Planifier l’équipe pour le chantier Roy', due: 'Demain · Terrasse & pergola', done: false },
    { text: 'Commander la céramique', due: 'Terminé · Salle de bain Lavoie', done: true }
  ],
  events: [
    { id: 1, day: 2, start: '09:00', end: '10:00', title: 'Visite Tremblay', location: 'Cuisine Tremblay', color: 'blue' },
    { id: 2, day: 7, start: '09:00', end: '10:00', title: 'Livraison armoires', location: 'Cuisine Tremblay', color: 'yellow' },
    { id: 3, day: 10, start: '09:00', end: '10:00', title: 'Équipe Gagnon', location: 'Agrandissement Gagnon', color: 'green' },
    { id: 4, day: 14, start: '09:00', end: '10:00', title: 'Inspection Lavoie', location: 'Salle de bain Lavoie', color: 'blue' },
    { id: 5, day: 18, start: '09:00', end: '10:00', title: 'Rencontre Roy', location: 'Terrasse & pergola Roy', color: 'yellow' },
    { id: 6, day: 22, start: '09:00', end: '10:00', title: 'Facturation', location: 'Bureau', color: 'green' },
    { id: 7, day: 28, start: '08:00', end: '10:30', title: 'Visite de chantier', location: 'Cuisine Tremblay', color: 'blue' },
    { id: 8, day: 28, start: '10:45', end: '12:00', title: 'Rencontre client', location: 'Agrandissement Gagnon', color: 'yellow' },
    { id: 9, day: 28, start: '13:30', end: '15:00', title: 'Inspection finale', location: 'Salle de bain Lavoie', color: 'green' },
    { id: 10, day: 28, start: '15:30', end: '16:30', title: 'Préparation des devis', location: 'Bureau', color: 'blue' }
  ]
};
const TODAY_DAY = 28;
let data = JSON.parse(localStorage.getItem('atelier-ops-data') || 'null') || defaultData;
if (!Array.isArray(data.events)) data.events = defaultData.events;
if (!Array.isArray(data.jobs)) data.jobs = defaultData.jobs;
data.jobs.forEach((job, i) => { if (!job.id) job.id = `job-legacy-${i}`; if (!Array.isArray(job.timeLog)) job.timeLog = []; });
if (typeof data.activeTimer === 'undefined') data.activeTimer = null;
if (data.activeTimer && !data.jobs.some(job => job.id === data.activeTimer.jobId)) data.activeTimer = null;
const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
function save(message = 'Modifications sauvegardées') { localStorage.setItem('atelier-ops-data', JSON.stringify(data)); showToast(message); }
function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2500); }
function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h, m, sec].map(n => String(n).padStart(2, '0')).join(':');
}
function formatHours(totalSeconds) { return `${(totalSeconds / 3600).toFixed(1).replace('.', ',')} h`; }
function jobTotalSeconds(job) {
  const logged = job.timeLog.reduce((sum, entry) => sum + (entry.durationSeconds || 0), 0);
  const live = (data.activeTimer && data.activeTimer.jobId === job.id) ? Math.floor((Date.now() - data.activeTimer.startedAt) / 1000) : 0;
  return logged + live;
}
function formatEntry(entry) {
  const start = new Date(entry.start), end = new Date(entry.end);
  const dateStr = start.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
  const startStr = start.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
  const endStr = end.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr} · ${startStr}–${endStr} · ${formatHours(entry.durationSeconds)}`;
}
function startTimer(jobId) {
  if (data.activeTimer) { showToast('Arrêtez le chronomètre en cours avant d’en démarrer un autre.'); return; }
  data.activeTimer = { jobId, startedAt: Date.now() };
  renderJobs();
  save('Chronomètre démarré');
}
function stopTimer() {
  if (!data.activeTimer) return;
  const { jobId, startedAt } = data.activeTimer;
  const job = data.jobs.find(item => item.id === jobId);
  const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  if (job) job.timeLog.push({ id: `t-${Date.now()}`, start: new Date(startedAt).toISOString(), end: new Date().toISOString(), durationSeconds });
  data.activeTimer = null;
  renderJobs();
  save(`Temps enregistré : ${formatHours(durationSeconds)}`);
}
function deleteTimerEntry(jobId, entryId) {
  const job = data.jobs.find(item => item.id === jobId);
  if (!job) return;
  job.timeLog = job.timeLog.filter(entry => entry.id !== entryId);
  renderJobs();
  save('Session supprimée');
}
function tick() {
  if (!data.activeTimer) return;
  const card = document.querySelector(`.project-card[data-job-id="${data.activeTimer.jobId}"]`);
  const job = data.jobs.find(item => item.id === data.activeTimer.jobId);
  if (!card || !job) return;
  const liveEl = card.querySelector('.timer-live');
  const totalEl = card.querySelector('.timer-total');
  if (liveEl) liveEl.textContent = formatClock((Date.now() - data.activeTimer.startedAt) / 1000);
  if (totalEl) totalEl.textContent = `Total : ${formatHours(jobTotalSeconds(job))}`;
}
function renderJobs() {
  $('#active-job-count').textContent = data.jobs.length;
  const rows = data.jobs.slice(0, 4).map(job => {
    const isActive = data.activeTimer && data.activeTimer.jobId === job.id;
    return `<div class="job-row"><span class="job-logo">⌂</span><div><b>${esc(job.name)}${isActive ? '<span class="live-badge">En cours</span>' : ''}</b><small>${esc(job.client)}</small></div><div class="progress"><i style="width:${job.progress}%"></i></div><em>${job.progress}%</em></div>`;
  }).join('');
  $('#job-list').innerHTML = rows;
  $('#projects-grid').innerHTML = data.jobs.map(job => {
    const isActive = data.activeTimer && data.activeTimer.jobId === job.id;
    const blocked = data.activeTimer && !isActive;
    const historyRows = job.timeLog.slice().reverse().map(entry => `<div class="timer-entry"><span>${formatEntry(entry)}</span><button type="button" data-delete-entry="${entry.id}" data-job-id="${job.id}" aria-label="Supprimer cette session">✕</button></div>`).join('');
    return `<article class="project-card" data-job-id="${job.id}"><header><span class="metric-icon ${job.color || 'blue'}">⌂</span><span class="status">EN COURS</span></header><h2>${esc(job.name)}</h2><p>${esc(job.client)} · Budget : ${esc(job.budget)}</p><div class="progress"><i style="width:${job.progress}%"></i></div><footer><span>Progression</span><b>${job.progress}%</b></footer><div class="timer-block"><div class="timer-row"><button type="button" class="timer-button ${isActive ? 'active' : ''}" data-timer-action="${isActive ? 'stop' : 'start'}" data-job-id="${job.id}" ${blocked ? 'disabled title="Un autre chronomètre est déjà en cours"' : ''}>${isActive ? '⏹ Arrêter' : '▶ Démarrer'}</button><span class="timer-live">${isActive ? formatClock((Date.now() - data.activeTimer.startedAt) / 1000) : ''}</span><span class="timer-total">Total : ${formatHours(jobTotalSeconds(job))}</span></div>${job.timeLog.length ? `<details class="timer-history"><summary>Historique (${job.timeLog.length})</summary>${historyRows}</details>` : ''}</div></article>`;
  }).join('');
}
function renderTasks() {
  $('#task-list').innerHTML = data.tasks.map((task, index) => `<label class="task-item ${task.done ? 'done' : ''}"><input class="task-check" data-task="${index}" type="checkbox" ${task.done ? 'checked' : ''}/><span><b>${esc(task.text)}</b><span>${esc(task.due)}</span></span></label>`).join('');
}
function renderSchedule() {
  const todays = data.events.filter(e => e.day === TODAY_DAY).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  $('#schedule-list').innerHTML = todays.length
    ? todays.map(e => `<div class="schedule-item"><time>${esc(e.start || '—')}<small>${esc(e.end || '')}</small></time><span class="schedule-dot ${e.color === 'blue' ? '' : (e.color || '')}"></span><div class="schedule-info"><b>${esc(e.title)}</b><span>${esc(e.location || '')}</span></div><span class="schedule-avatar">SM</span></div>`).join('')
    : `<p style="color:#8a97ab;font-size:13px;padding:6px 0">Aucun rendez-vous prévu aujourd’hui.</p>`;
}
function renderCalendar() {
  const days = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  let html = days.map(day => `<div class="calendar-day muted">${day}</div>`).join('');
  for (let day = 1; day <= 31; day++) {
    const dayEvents = data.events.filter(e => e.day === day).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
    const pills = dayEvents.map(e => `<div class="event ${e.color === 'blue' ? '' : (e.color || '')}" data-event-id="${e.id}" title="${esc(e.start || '')}–${esc(e.end || '')} · ${esc(e.location || '')}">${esc(e.title)}</div>`).join('');
    html += `<div class="calendar-day ${day === TODAY_DAY ? 'today' : ''}" data-day="${day}">${day}${pills}</div>`;
  }
  $('#calendar-grid').innerHTML = html;
}
function openEventDialog(existingEvent, prefillDay) {
  const form = $('#event-form');
  form.reset();
  if (existingEvent) {
    form.id.value = existingEvent.id;
    form.title.value = existingEvent.title;
    form.location.value = existingEvent.location || '';
    form.day.value = existingEvent.day;
    form.start.value = existingEvent.start || '';
    form.end.value = existingEvent.end || '';
    form.color.value = existingEvent.color || 'blue';
    $('#event-dialog-title').textContent = 'Modifier le rendez-vous';
    $('#event-delete-button').hidden = false;
  } else {
    form.id.value = '';
    form.day.value = prefillDay || TODAY_DAY;
    $('#event-dialog-title').textContent = 'Ajouter un rendez-vous';
    $('#event-delete-button').hidden = true;
  }
  $('#event-dialog').showModal();
}
function saveEvent(event) {
  event.preventDefault();
  const form = event.target;
  const id = form.id.value;
  const day = Math.min(31, Math.max(1, Number(form.day.value) || 1));
  const payload = { day, start: form.start.value, end: form.end.value, title: form.title.value, location: form.location.value, color: form.color.value };
  if (id) {
    const index = data.events.findIndex(item => String(item.id) === id);
    if (index > -1) data.events[index] = { ...data.events[index], ...payload };
  } else {
    data.events.push({ id: Date.now(), ...payload });
  }
  renderCalendar(); renderSchedule();
  $('#event-dialog').close();
  form.reset();
  save('Rendez-vous sauvegardé');
}
function deleteEvent() {
  const id = $('#event-form').id.value;
  data.events = data.events.filter(item => String(item.id) !== id);
  renderCalendar(); renderSchedule();
  $('#event-dialog').close();
  save('Rendez-vous supprimé');
}
function renderClients() {
  const clients = [['Marie Tremblay','marie@exemple.ca','2','60 750 $'],['Simon Gagnon','simon@exemple.ca','1','96 500 $'],['Émilie Lavoie','emilie@exemple.ca','3','42 200 $'],['Alex Roy','alex@exemple.ca','1','27 900 $']];
  $('#client-table').innerHTML = `<div class="client-row header"><span>CLIENT</span><span>CONTACT</span><span>CHANTIERS</span><span>VALEUR</span><span></span></div>${clients.map((client, i) => `<div class="client-row"><span class="client-person"><span class="avatar">${client[0].split(' ').map(n=>n[0]).join('')}</span>${client[0]}</span><span>${client[1]}</span><span>${client[2]}</span><span>${client[3]}</span><span>⋮</span></div>`).join('')}`;
}
function renderTeam() { const people = [['SM','Shawn Martin','Propriétaire'],['JD','Julien Dubois','Chef d’équipe'],['ML','Mélanie Leblanc','Designer'],['AP','Antoine Pelletier','Menuisier'],['KB','Karim Bouchard','Apprenti'],['SC','Sophie Côté','Administration']]; $('#team-cards').innerHTML = people.map(person => `<article class="team-card"><span class="avatar">${person[0]}</span><span><b>${person[1]}</b><small>${person[2]}</small></span></article>`).join(''); }
function switchView(name) { document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === name)); document.querySelectorAll('.nav-link[data-view]').forEach(link => link.classList.toggle('active', link.dataset.view === name)); $('#breadcrumb').textContent = document.querySelector(`.nav-link[data-view="${name}"]`)?.textContent.trim() || 'Vue d’ensemble'; $('.sidebar').classList.remove('open'); window.scrollTo({top: 0, behavior: 'smooth'}); }
function addJob(event) { event.preventDefault(); const form = event.target; data.jobs.unshift({id: `job-${Date.now()}`, name: form.name.value, client: form.client.value, budget: `${Number(form.budget.value || 0).toLocaleString('fr-CA')} $`, progress: 0, color: 'blue', timeLog: []}); renderJobs(); $('#job-dialog').close(); form.reset(); save('Chantier créé et sauvegardé'); switchView('jobs'); }
function addTask(event) { event.preventDefault(); const form = event.target; data.tasks.unshift({text: form.task.value, due: form.due.value || 'Aujourd’hui', done: false}); renderTasks(); $('#task-dialog').close(); form.reset(); save('Tâche ajoutée'); }
function init() {
  renderJobs(); renderTasks(); renderSchedule(); renderCalendar(); renderClients(); renderTeam();
  document.querySelectorAll('[data-view], [data-go]').forEach(el => el.addEventListener('click', event => { event.preventDefault(); switchView(el.dataset.view || el.dataset.go); }));
  ['#new-job-button','#new-job-button-2'].forEach(selector => $(selector).addEventListener('click', () => $('#job-dialog').showModal()));
  $('#add-task-button').addEventListener('click', () => $('#task-dialog').showModal());
  $('#new-event-button').addEventListener('click', () => openEventDialog(null));
  $('#event-form').addEventListener('submit', saveEvent);
  $('#event-delete-button').addEventListener('click', deleteEvent);
  $('#calendar-grid').addEventListener('click', event => {
    const pill = event.target.closest('[data-event-id]');
    if (pill) { const found = data.events.find(item => String(item.id) === pill.dataset.eventId); if (found) openEventDialog(found); return; }
    const cell = event.target.closest('[data-day]');
    if (cell) openEventDialog(null, Number(cell.dataset.day));
  });
  $('#settings-button').addEventListener('click', () => { const exportData = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'}); const link = Object.assign(document.createElement('a'), {href: URL.createObjectURL(exportData), download: 'atelier-ops-sauvegarde.json'}); link.click(); URL.revokeObjectURL(link.href); showToast('Sauvegarde JSON téléchargée'); });
  $('#job-form').addEventListener('submit', addJob); $('#task-form').addEventListener('submit', addTask);
  $('#task-list').addEventListener('change', event => { if (event.target.matches('[data-task]')) { data.tasks[event.target.dataset.task].done = event.target.checked; renderTasks(); save(); } });
  $('#job-search').addEventListener('input', event => { const term = event.target.value.toLowerCase(); document.querySelectorAll('.project-card').forEach(card => card.hidden = !card.textContent.toLowerCase().includes(term)); });
  $('#projects-grid').addEventListener('click', event => {
    const timerBtn = event.target.closest('[data-timer-action]');
    if (timerBtn) { if (timerBtn.dataset.timerAction === 'start') startTimer(timerBtn.dataset.jobId); else stopTimer(); return; }
    const delBtn = event.target.closest('[data-delete-entry]');
    if (delBtn) deleteTimerEntry(delBtn.dataset.jobId, delBtn.dataset.deleteEntry);
  });
  setInterval(tick, 1000);
  $('#menu-button').addEventListener('click', () => $('.sidebar').classList.toggle('open'));
}
init();
