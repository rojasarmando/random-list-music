// static/js/components/descargar.js

const STORAGE_KEY = 'random-list-music:wishlist.v2';
const DOWNLOAD_ENDPOINT = '/download'; // Cambia si tu API vive en otro host/puerto

// Elementos del DOM
const dlEmpty = document.getElementById('dl-empty');
const dlWrapper = document.getElementById('dl-wrapper');
const dlList = document.getElementById('dl-list');
const toggleAll = document.getElementById('dl-toggle-all');
const btnRefrescar = document.getElementById('btn-refrescar-deseos');
const btnDescargarSel = document.getElementById('btn-descargar-seleccion');
const log = document.getElementById('log-descarga');

// ------------ Helpers ------------
function loadWishlist() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function isValidUrl(u) {
  try { new URL(u); return true; } catch { return false; }
}

function logLine(msg) {
  if (!log) return;
  log.textContent += (log.textContent ? '\n' : '') + msg;
  log.scrollTop = log.scrollHeight;
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

    const btn = document.createElement('button');
    btn.className = 'px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50';
    btn.textContent = 'Descargar';
    btn.addEventListener('click', () => downloadOne(item));

    li.appendChild(check);
    li.appendChild(info);
    li.appendChild(btn);
    dlList.appendChild(li);
  }
}

// ------------ Descarga ------------
async function downloadOne(item) {
  logLine(`⬇️ Descargando: ${item.title || '(Sin título)'} (${item.url || 'sin URL'})`);

  if (!item.url || !isValidUrl(item.url)) {
    logLine(`❌ URL inválida para "${item.title || '(Sin título)'}"`);
    return;
  }

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
      // Intenta leer detalle del backend
      let detail = 'Fallo al descargar';
      try {
        const data = await resp.json();
        if (data && data.detail) detail = data.detail;
      } catch (_) { /* ignore */ }
      throw new Error(detail);
    }

    // Recibe MP3 como blob y dispara la descarga
    const blob = await resp.blob();
    if (!blob || blob.size === 0) {
      throw new Error('El archivo recibido está vacío.');
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (item.title || 'audio').replace(/[^\w\s.-]+/g, '_');
    a.href = url;
    a.download = `${safeName}.mp3`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    logLine(`✅ Listo: ${item.title || '(Sin título)'}`);
  } catch (e) {
    logLine(`❌ Error con "${item.title || '(Sin título)'}": ${e.message}`);
  }
}

async function downloadSelected() {
  const checks = dlList.querySelectorAll('input[type="checkbox"]:checked');
  if (checks.length === 0) {
    logLine('⚠️ No hay elementos seleccionados.');
    return;
  }

  const items = loadWishlist();
  const map = new Map(items.map(i => [String(i.id), i]));

  // Descarga secuencial para no saturar el servidor/ffmpeg
  for (const c of checks) {
    const it = map.get(String(c.dataset.id));
    if (it) {
      // eslint-disable-next-line no-await-in-loop
      await downloadOne(it);
    }
  }
}

// ------------ Eventos ------------
if (btnRefrescar) btnRefrescar.addEventListener('click', renderList);
if (btnDescargarSel) btnDescargarSel.addEventListener('click', downloadSelected);

if (toggleAll) {
  toggleAll.addEventListener('change', () => {
    const boxes = dlList.querySelectorAll('input[type="checkbox"]');
    boxes.forEach(b => (b.checked = toggleAll.checked));
  });
}

// Render inicial
renderList();
