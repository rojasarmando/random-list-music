// static/js/components/descargar.js

const STORAGE_KEY = 'random-list-music:wishlist.v2';
const FIXED_PATH_KEY = 'random-list-music:fixed-path';
const DOWNLOAD_ENDPOINT = '/download';       // devuelve archivo al navegador
const SAVE_ENDPOINT = '/download/save';      // guarda archivo en ruta del servidor

// Elementos del DOM
const dlEmpty = document.getElementById('dl-empty');
const dlWrapper = document.getElementById('dl-wrapper');
const dlList = document.getElementById('dl-list');
const toggleAll = document.getElementById('dl-toggle-all');
const btnRefrescar = document.getElementById('btn-refrescar-deseos');
const btnDescargarSel = document.getElementById('btn-descargar-seleccion');
const btnGuardarSel = document.getElementById('btn-guardar-seleccion');
const log = document.getElementById('log-descarga');

// ------------ Helpers de almacenamiento ------------
function loadWishlist() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function saveWishlist(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}
function removeFromWishlist(id) {
  const items = loadWishlist();
  const next = items.filter(x => String(x.id) !== String(id));
  saveWishlist(next);
}

// ------------ Helpers varios ------------
function getFixedPath() {
  return localStorage.getItem(FIXED_PATH_KEY) || '';
}
function isValidUrl(u) {
  try { new URL(u); return true; } catch { return false; }
}
function logLine(msg) {
  if (!log) return;
  log.textContent += (log.textContent ? '\n' : '') + msg;
  log.scrollTop = log.scrollHeight;
}
function startLoadingButton(btn, label = 'Procesando...') {
  if (!btn) return;
  btn.disabled = true;
  btn.dataset.prevHtml = btn.innerHTML;
  btn.innerHTML = `
    <span class="inline-flex items-center gap-2">
      <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
      </svg>
      ${label}
    </span>`;
}
function stopLoadingButton(btn, fallback = 'Acción') {
  if (!btn) return;
  btn.disabled = false;
  btn.innerHTML = btn.dataset.prevHtml || fallback;
  delete btn.dataset.prevHtml;
}
function setBulkDisabled(disabled) {
  if (btnRefrescar) btnRefrescar.disabled = disabled;
  if (btnDescargarSel) btnDescargarSel.disabled = disabled;
  if (btnGuardarSel) btnGuardarSel.disabled = disabled;
  if (toggleAll) {
    toggleAll.disabled = disabled;
    if (disabled) toggleAll.checked = false;
  }
  dlList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.disabled = disabled);
  dlList.querySelectorAll('[data-role="download-btn"]').forEach(b => b.disabled = disabled);
  dlList.querySelectorAll('[data-role="save-btn"]').forEach(b => b.disabled = disabled);
}

// ------------ Render ------------
function renderList() {
  const items = loadWishlist();
  dlList.innerHTML = '';

  if (items.length === 0) {
    dlEmpty.classList.remove('hidden');
    dlWrapper.classList.add('hidden');
    return;
  }
  dlEmpty.classList.add('hidden');
  dlWrapper.classList.remove('hidden');

  for (const item of items) {
    const li = document.createElement('li');
    li.className = 'p-3 flex items-start gap-3';
    li.dataset.id = item.id;

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'mt-1 rounded';
    check.dataset.id = item.id;

    const info = document.createElement('div');
    info.className = 'min-w-0 flex-1';
    const title = document.createElement('div');
    title.className = 'font-medium truncate';
    title.textContent = item.title || '(Sin título)';

    const link = document.createElement('a');
    link.href = item.url || '#';
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'text-sm text-blue-600 hover:underline break-all';
    link.textContent = item.url || '(Sin URL)';

    info.appendChild(title);
    info.appendChild(link);

    const actions = document.createElement('div');
    actions.className = 'flex gap-2';

    const btnDownload = document.createElement('button');
    btnDownload.className = 'px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50';
    btnDownload.textContent = 'Descargar';
    btnDownload.dataset.role = 'download-btn';
    btnDownload.addEventListener('click', () => downloadOne(item, btnDownload));

    const btnSave = document.createElement('button');
    btnSave.className = 'px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50';
    btnSave.textContent = 'Guardar';
    btnSave.dataset.role = 'save-btn';
    btnSave.addEventListener('click', () => saveOne(item, btnSave));

    actions.appendChild(btnDownload);
    actions.appendChild(btnSave);

    li.appendChild(check);
    li.appendChild(info);
    li.appendChild(actions);
    dlList.appendChild(li);
  }
}

// ------------ Acciones: Descargar (al navegador) ------------
async function downloadOne(item, btn = null) {
  logLine(`⬇️ Descargar: ${item.title || '(Sin título)'} (${item.url || 'sin URL'})`);
  if (!item.url || !isValidUrl(item.url)) {
    logLine(`❌ URL inválida para "${item.title || '(Sin título)'}"`);
    return;
  }

  if (btn) startLoadingButton(btn, 'Descargando...');

  try {
    const resp = await fetch(DOWNLOAD_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        url: item.url,
        title: item.title || 'audio',
        format: 'mp3'
      })
    });

    if (!resp.ok) {
      let detail = 'Fallo al descargar';
      try { const data = await resp.json(); if (data?.detail) detail = data.detail; } catch {}
      throw new Error(detail);
    }

    const blob = await resp.blob();
    if (!blob || blob.size === 0) throw new Error('El archivo recibido está vacío.');

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (item.title || 'audio').replace(/[^\w\s.-]+/g, '_');
    a.href = url; a.download = `${safeName}.mp3`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);

    logLine(`✅ Descargado: ${item.title || '(Sin título)'}`);
    // Elimina de la wishlist tras éxito
    removeFromWishlist(item.id);
    renderList();
  } catch (e) {
    logLine(`❌ Error al descargar "${item.title || '(Sin título)'}": ${e.message}`);
  } finally {
    if (btn) stopLoadingButton(btn, 'Descargar');
  }
}

// ------------ Acciones: Guardar (al directorio fijo del servidor) ------------
async function saveOne(item, btn = null) {
  const destPath = getFixedPath();
  logLine(`💾 Guardar: ${item.title || '(Sin título)'} → ${destPath || '(sin ruta fija)'}`);

  if (!item.url || !isValidUrl(item.url)) {
    logLine(`❌ URL inválida para "${item.title || '(Sin título)'}"`);
    return;
  }
  if (!destPath) {
    logLine('⚠️ Configura primero la “Ruta Fija” en su pestaña.');
    return;
  }

  if (btn) startLoadingButton(btn, 'Guardando...');

  try {
    const resp = await fetch(SAVE_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        url: item.url,
        title: item.title || 'audio',
        format: 'mp3',
        dest_path: destPath
      })
    });

    if (!resp.ok) {
      let detail = 'Fallo al guardar';
      try { const data = await resp.json(); if (data?.detail) detail = data.detail; } catch {}
      throw new Error(detail);
    }

    const data = await resp.json();
    logLine(`✅ Guardado: ${item.title || '(Sin título)'} en ${data?.saved_path || destPath}`);

    // Elimina de la wishlist tras éxito
    removeFromWishlist(item.id);
    renderList();
  } catch (e) {
    logLine(`❌ Error al guardar "${item.title || '(Sin título)'}": ${e.message}`);
  } finally {
    if (btn) stopLoadingButton(btn, 'Guardar');
  }
}

// ------------ Bulk: Descargar selección ------------
async function downloadSelected() {
  const checks = Array.from(dlList.querySelectorAll('input[type="checkbox"]:checked'));
  if (checks.length === 0) { logLine('⚠️ No hay elementos seleccionados.'); return; }

  const ids = checks.map(c => String(c.dataset.id));
  startLoadingButton(btnDescargarSel, 'Descargando selección...');
  setBulkDisabled(true);

  try {
    for (const id of ids) {
      const current = loadWishlist();
      const item = current.find(x => String(x.id) === id);
      if (!item) continue;
      const li = dlList.querySelector(`li[data-id="${CSS.escape(id)}"]`);
      const perBtn = li?.querySelector('[data-role="download-btn"]') || null;
      // eslint-disable-next-line no-await-in-loop
      await downloadOne(item, perBtn);
    }
  } finally {
    stopLoadingButton(btnDescargarSel, 'Descargar selección');
    setBulkDisabled(false);
  }
}

// ------------ Bulk: Guardar selección ------------
async function saveSelected() {
  const checks = Array.from(dlList.querySelectorAll('input[type="checkbox"]:checked'));
  if (checks.length === 0) { logLine('⚠️ No hay elementos seleccionados.'); return; }

  const destPath = getFixedPath();
  if (!destPath) { logLine('⚠️ Configura primero la “Ruta Fija” en su pestaña.'); return; }

  const ids = checks.map(c => String(c.dataset.id));
  startLoadingButton(btnGuardarSel, 'Guardando selección...');
  setBulkDisabled(true);

  try {
    for (const id of ids) {
      const current = loadWishlist();
      const item = current.find(x => String(x.id) === id);
      if (!item) continue;
      const li = dlList.querySelector(`li[data-id="${CSS.escape(id)}"]`);
      const perBtn = li?.querySelector('[data-role="save-btn"]') || null;
      // eslint-disable-next-line no-await-in-loop
      await saveOne(item, perBtn);
    }
  } finally {
    stopLoadingButton(btnGuardarSel, 'Guardar selección');
    setBulkDisabled(false);
  }
}

// ------------ Eventos ------------
if (btnRefrescar) btnRefrescar.addEventListener('click', renderList);
if (btnDescargarSel) btnDescargarSel.addEventListener('click', downloadSelected);
if (btnGuardarSel) btnGuardarSel.addEventListener('click', saveSelected);

if (toggleAll) {
  toggleAll.addEventListener('change', () => {
    const boxes = dlList.querySelectorAll('input[type="checkbox"]');
    boxes.forEach(b => (b.checked = toggleAll.checked));
  });
}

// Render inicial
renderList();
