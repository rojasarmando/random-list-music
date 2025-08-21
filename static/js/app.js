// Año en footer
const y = document.getElementById('year');
if (y) y.textContent = new Date().getFullYear();

// Cambio de vistas al hacer click en el menú
const buttons = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('main section');

function showView(id) {
  views.forEach(v => v.classList.toggle('hidden', v.id !== id));
  buttons.forEach(b => {
    const isActive = b.dataset.target === id;
    b.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
}

buttons.forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.target));
});

// Wishlist: guarda en localStorage
const wlKey = 'random-list-music:wishlist';
const wishlist = document.getElementById('wishlist');
const estadoDeseos = document.getElementById('estado-deseos');
const saved = localStorage.getItem(wlKey);
if (saved && wishlist) wishlist.value = saved;

const btnGuardar = document.getElementById('btn-guardar-deseos');
if (btnGuardar) {
  btnGuardar.addEventListener('click', () => {
    localStorage.setItem(wlKey, wishlist?.value || '');
    if (estadoDeseos) {
      estadoDeseos.textContent = 'Lista guardada localmente ✓';
      setTimeout(() => (estadoDeseos.textContent = ''), 2000);
    }
  });
}

// Placeholder Descargar
const btnDescargar = document.getElementById('btn-descargar');
if (btnDescargar) {
  btnDescargar.addEventListener('click', async () => {
    const out = document.getElementById('log-descarga');
    if (out) {
      out.textContent = 'Iniciando descarga...\n';
      out.textContent += '(Demo) Aún no hay endpoint implementado.\n';
    }
  });
}

// Mezclar contra FastAPI /process
const btnMezclar = document.getElementById('btn-mezclar');
if (btnMezclar) {
  btnMezclar.addEventListener('click', async () => {
    const path = document.getElementById('ruta-mezcla')?.value?.trim();
    const option = document.getElementById('modo-mezcla')?.value;
    const log = document.getElementById('log-mezcla');
    const state = document.getElementById('estado-mezcla');

    if (!path) {
      if (log) log.textContent = '⚠️ Debes especificar una ruta.';
      return;
    }

    if (state) state.textContent = 'Procesando...';
    if (log) log.textContent = '';

    try {
      const resp = await fetch('/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, option })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.detail || 'Error en el servidor');
      if (log) log.textContent = JSON.stringify(data, null, 2);
      if (state) state.textContent = 'Listo ✓';
    } catch (e) {
      if (state) state.textContent = '';
      if (log) log.textContent = '❌ ' + e.message;
    } finally {
      if (state) setTimeout(() => (state.textContent = ''), 2000);
    }
  });
}
