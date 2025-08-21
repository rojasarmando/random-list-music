// static/js/components/ruta.js
const STORAGE_PATH_KEY = 'random-list-music:fixed-path';

const input = document.getElementById('fixed-path');
const btnGuardar = document.getElementById('btn-guardar-ruta');
const btnBorrar = document.getElementById('btn-borrar-ruta');
const estado = document.getElementById('estado-ruta');

function loadPath() {
  try {
    return localStorage.getItem(STORAGE_PATH_KEY) || '';
  } catch {
    return '';
  }
}

function savePath(val) {
  localStorage.setItem(STORAGE_PATH_KEY, val);
  // Emite evento por si otros componentes quieren reaccionar
  document.dispatchEvent(new CustomEvent('fixedPathChanged', { detail: { path: val } }));
}

function clearPath() {
  localStorage.removeItem(STORAGE_PATH_KEY);
  document.dispatchEvent(new CustomEvent('fixedPathChanged', { detail: { path: '' } }));
}

function showStatus(msg) {
  if (!estado) return;
  estado.textContent = msg;
  if (msg) setTimeout(() => (estado.textContent = ''), 2000);
}

// Inicializa con el valor guardado
const current = loadPath();
if (input) input.value = current;

// Guardar
if (btnGuardar) {
  btnGuardar.addEventListener('click', () => {
    const val = (input?.value || '').trim();
    if (!val) {
      showStatus('⚠️ Ingresa una ruta válida.');
      input?.focus();
      return;
    }
    savePath(val);
    showStatus('Ruta guardada ✓');
  });
}

// Borrar
if (btnBorrar) {
  btnBorrar.addEventListener('click', () => {
    clearPath();
    if (input) input.value = '';
    showStatus('Ruta borrada');
  });
}
