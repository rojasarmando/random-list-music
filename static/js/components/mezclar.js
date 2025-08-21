
const FIXED_PATH_KEY = 'random-list-music:fixed-path';
const LIST_ENDPOINT = '/songs/list'; // Backend para listar canciones
// /process ya existe para ejecutar la lógica de mezcla

// Referencias DOM
const btnMezclar = document.getElementById('btn-mezclar');
const btnListar = document.getElementById('btn-listar');
const inputRuta = document.getElementById('ruta-mezcla');
const selectModo = document.getElementById('modo-mezcla');
const log = document.getElementById('log-mezcla');
const state = document.getElementById('estado-mezcla');

// Panel de listado
const songsPanel = document.getElementById('songs-panel');
const songsSummary = document.getElementById('songs-summary');
const songsList = document.getElementById('songs-list');

// ---------- Prefill con la ruta fija ----------
(function prefillRutaDesdeLocalStorage() {
  if (!inputRuta) return;
  const saved = localStorage.getItem(FIXED_PATH_KEY) || '';
  if (saved && !inputRuta.value) inputRuta.value = saved;
})();
document.addEventListener('fixedPathChanged', (e) => {
  if (!inputRuta) return;
  if (!inputRuta.value) {
    const newVal = e?.detail?.path ?? localStorage.getItem(FIXED_PATH_KEY) ?? '';
    if (newVal) inputRuta.value = newVal;
  }
});

// ---------- Helpers UI ----------
function setProcessing(on) {
  if (on) {
    if (state) state.textContent = 'Procesando...';
    if (btnMezclar) {
      btnMezclar.disabled = true;
      btnMezclar.dataset.prevHtml = btnMezclar.innerHTML;
      btnMezclar.innerHTML = spinnerTpl('Iniciando...');
    }
  } else {
    if (btnMezclar) {
      btnMezclar.disabled = false;
      btnMezclar.innerHTML = btnMezclar.dataset.prevHtml || 'Iniciar mezcla';
      delete btnMezclar.dataset.prevHtml;
    }
    if (state) {
      state.textContent = 'Listo ✓';
      setTimeout(() => (state.textContent = ''), 2000);
    }
  }
}
function spinnerTpl(label = 'Cargando...') {
  return `
    <span class="inline-flex items-center gap-2">
      <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none"
           viewBox="0 0 24 24" aria-hidden="true">
        <circle class="opacity-25" cx="12" cy="12" r="10"
                stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
      </svg>
      ${label}
    </span>`;
}
function startLoadingButton(btn, label = 'Cargando...') {
  if (!btn) return;
  btn.disabled = true;
  btn.dataset.prevHtml = btn.innerHTML;
  btn.innerHTML = spinnerTpl(label);
}
function stopLoadingButton(btn, fallback = 'Acción') {
  if (!btn) return;
  btn.disabled = false;
  btn.innerHTML = btn.dataset.prevHtml || fallback;
  delete btn.dataset.prevHtml;
}
function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '-';
  const units = ['B','KB','MB','GB','TB'];
  let i = 0, num = bytes;
  while (num >= 1024 && i < units.length - 1) { num /= 1024; i++; }
  return `${num.toFixed(num < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
function logLine(msg) {
  if (!log) return;
  log.textContent += (log.textContent ? '\n' : '') + msg;
  log.scrollTop = log.scrollHeight;
}

// ---------- Listado de canciones ----------
async function listarCanciones() {
  // 1) Ruta desde input o fallback
  let path = inputRuta?.value?.trim();
  if (!path) {
    const fallback = localStorage.getItem(FIXED_PATH_KEY) || '';
    if (fallback) {
      path = fallback;
      if (inputRuta) inputRuta.value = fallback;
    }
  }
  if (!path) {
    logLine('⚠️ Debes especificar una ruta (configura la “Ruta Fija” o escribe una manualmente).');
    return;
  }

  startLoadingButton(btnListar, 'Listando...');

  try {
    const resp = await fetch(LIST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path,
        exts: ['.mp3'],         // Filtra a MP3; puedes añadir más extensiones si quieres
        include_subdirs: false  // Solo carpeta actual
      })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.detail || 'No se pudo listar el directorio.');

    // Render
    renderSongs(data);
  } catch (e) {
    songsPanel?.classList.add('hidden');
    songsList.innerHTML = '';
    songsSummary.textContent = '';
    logLine('❌ ' + e.message);
  } finally {
    stopLoadingButton(btnListar, 'Listar canciones');
  }
}

function renderSongs(payload) {
  const files = Array.isArray(payload?.files) ? payload.files : [];
  const basePath = payload?.path || '';
  const total = payload?.total ?? files.length;

  if (files.length === 0) {
    songsPanel?.classList.remove('hidden');
    songsList.innerHTML = `
      <li class="p-4 text-sm text-gray-500">No se encontraron canciones en <code>${basePath}</code>.</li>
    `;
    songsSummary.textContent = '';
    return;
  }

  songsPanel?.classList.remove('hidden');
  songsList.innerHTML = '';
  songsSummary.innerHTML = `
    <span class="font-medium">${total}</span> archivo(s) en <code>${basePath}</code>
  `;

  for (const f of files) {
    const li = document.createElement('li');
    li.className = 'p-3 flex items-center justify-between gap-3';

    const left = document.createElement('div');
    left.className = 'min-w-0';
    const name = document.createElement('div');
    name.className = 'font-medium truncate';
    name.textContent = f.name;

    const meta = document.createElement('div');
    meta.className = 'text-xs text-gray-500';
    meta.textContent = [formatBytes(f.size_bytes), f.modified].filter(Boolean).join(' • ');

    left.appendChild(name);
    left.appendChild(meta);
    li.appendChild(left);

    songsList.appendChild(li);
  }
}

// ---------- Acción Mezclar ----------
if (btnMezclar) {
  btnMezclar.addEventListener('click', async () => {
    let path = inputRuta?.value?.trim();
    if (!path) {
      const fallback = localStorage.getItem(FIXED_PATH_KEY) || '';
      if (fallback) {
        path = fallback;
        if (inputRuta) inputRuta.value = fallback;
      }
    }
    const option = selectModo?.value;

    if (!path) {
      if (log) log.textContent = '⚠️ Debes especificar una ruta (configura la “Ruta Fija” o escribe una manualmente).';
      return;
    }

    if (log) log.textContent = '';
    setProcessing(true);

    try {
      const resp = await fetch('/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, option })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.detail || 'Error en el servidor');
      if (log) log.textContent = JSON.stringify(data, null, 2);
    } catch (e) {
      if (state) state.textContent = '';
      if (log) log.textContent = '❌ ' + e.message;
    } finally {
      setProcessing(false);

      listarCanciones(); 

    }
  });
}

// ---------- Eventos ----------
if (btnListar) btnListar.addEventListener('click', listarCanciones);
