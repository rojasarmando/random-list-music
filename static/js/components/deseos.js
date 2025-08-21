const STORAGE_KEY = 'random-list-music:wishlist.v2'; // v2 por nuevo formato [{id,title,url,addedAt}]
const listEl = document.getElementById('wishlist-list');
const emptyEl = document.getElementById('wishlist-empty');

// Modal refs
const modal = document.getElementById('modal');
const modalBackdrop = document.getElementById('modal-backdrop');
const btnAbrirModal = document.getElementById('btn-abrir-modal');
const btnCerrarModal = document.getElementById('btn-cerrar-modal');
const btnCancelar = document.getElementById('btn-cancelar');
const form = document.getElementById('form-deseo');
const inputTitle = document.getElementById('song-title');
const inputUrl = document.getElementById('song-url');

// --- Helpers de almacenamiento ---
function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveAll(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

// --- Helpers de UI ---
function openModal() {
  modal.classList.remove('hidden');
  modalBackdrop.classList.remove('hidden');
  inputTitle.value = '';
  inputUrl.value = '';
  setTimeout(() => inputTitle.focus(), 0);
}

function closeModal() {
  modal.classList.add('hidden');
  modalBackdrop.classList.add('hidden');
  form.reset();
}

function normalizeYouTubeUrl(val) {
  const trimmed = (val || '').trim();
  if (!trimmed) return '';

  // Si es un ID de video (11-12 chars típicos) sin URL
  const idLike = /^[a-zA-Z0-9_-]{8,}$/;
  if (idLike.test(trimmed) && !trimmed.includes('http')) {
    return `https://www.youtube.com/watch?v=${trimmed}`;
  }

  // Si es una URL válida, devolvemos tal cual
  try {
    const u = new URL(trimmed);
    // Normaliza youtu.be/<id> a watch?v=<id>
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.split('/').filter(Boolean).pop();
      if (id) return `https://www.youtube.com/watch?v=${id}`;
    }
    return u.toString();
  } catch {
    // Si no parsea como URL, lo tratamos como ID
    return `https://www.youtube.com/watch?v=${trimmed}`;
  }
}

function renderList() {
  const items = loadAll();
  listEl.innerHTML = '';

  if (!items.length) {
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');

  for (const item of items) {
    const li = document.createElement('li');
    li.className = 'flex items-center justify-between gap-3 p-3';

    const left = document.createElement('div');
    left.className = 'min-w-0';
    const title = document.createElement('div');
    title.className = 'font-medium truncate';
    title.textContent = item.title;

    const link = document.createElement('a');
    link.className = 'text-sm text-blue-600 hover:underline break-all';
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = item.url;

    left.appendChild(title);
    left.appendChild(link);

    const del = document.createElement('button');
    del.className = 'px-3 py-1.5 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50';
    del.textContent = 'Eliminar';
    del.dataset.id = item.id;

    del.addEventListener('click', () => {
      const current = loadAll();
      const next = current.filter(x => String(x.id) !== String(item.id));
      saveAll(next);
      renderList();
    });

    li.appendChild(left);
    li.appendChild(del);
    listEl.appendChild(li);
  }
}

// --- Eventos Modal ---
if (btnAbrirModal) btnAbrirModal.addEventListener('click', openModal);
if (btnCerrarModal) btnCerrarModal.addEventListener('click', closeModal);
if (btnCancelar) btnCancelar.addEventListener('click', closeModal);
if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
});

// --- Submit del formulario ---
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const title = inputTitle.value.trim();
    const rawUrl = inputUrl.value.trim();

    if (!title) {
      inputTitle.focus();
      return;
    }
    if (!rawUrl) {
      inputUrl.focus();
      return;
    }

    const url = normalizeYouTubeUrl(rawUrl);

    const items = loadAll();
    const newItem = {
      id: Date.now(),
      title,
      url,
      addedAt: new Date().toISOString()
    };
    items.unshift(newItem); // al inicio
    saveAll(items);

    closeModal();
    renderList();
  });
}

// Inicializar
renderList();
