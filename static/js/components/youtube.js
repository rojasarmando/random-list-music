

const STORAGE_KEY = 'random-list-music:wishlist.v2';
const YT_LIST_ENDPOINT = '/youtube/list';
const YT_PAGE_SIZE = 10; // resultados por página

// DOM
const qInput = document.getElementById('yt-query');
const btnListar = document.getElementById('yt-btn-listar');
const btnGuardarSel = document.getElementById('yt-guardar-seleccion');
const panel = document.getElementById('yt-panel');
const list = document.getElementById('yt-list'); // tiene max-h y overflow-auto
const summary = document.getElementById('yt-summary');
const state = document.getElementById('yt-estado');
const log = document.getElementById('yt-log');

// ---------- estado de paginación ----------
let currentQuery = '';
let offset = 0;
let isLoading = false;
let noMore = false;
const seen = new Set(); // dedupe por URL (o id si no hay URL)

// ---------- helpers storage ----------
function loadWishlist() {
  try { const raw = localStorage.getItem(STORAGE_KEY); const a = raw ? JSON.parse(raw) : []; return Array.isArray(a) ? a : []; } catch { return []; }
}
function saveWishlist(items) { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
function addToWishlist(item) {
  const items = loadWishlist();
  if (items.some(x => (x.url || '').trim() === (item.url || '').trim())) return false; // dedupe por URL
  items.unshift(item);
  saveWishlist(items);
  return true;
}

// ---------- helpers ui ----------
function spinnerTpl(label = 'Cargando...') {
  return `
    <span class="inline-flex items-center gap-2">
      <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
      </svg>
      ${label}
    </span>`;
}
function startLoadingButton(btn, label='Cargando...') {
  if (!btn) return;
  btn.disabled = true;
  btn.dataset.prevHtml = btn.innerHTML;
  btn.innerHTML = spinnerTpl(label);
}
function stopLoadingButton(btn, fallback='Acción') {
  if (!btn) return;
  btn.disabled = false;
  btn.innerHTML = btn.dataset.prevHtml || fallback;
  delete btn.dataset.prevHtml;
}
function logLine(msg) {
  if (!log) return;
  log.textContent += (log.textContent ? '\n' : '') + msg;
  log.scrollTop = log.scrollHeight;
}
function setState(msg) {
  if (state) state.textContent = msg || '';
  if (msg) setTimeout(() => { if (state.textContent === msg) state.textContent=''; }, 1800);
}

// ---------- helpers YouTube (preview) ----------
function getVideoIdFromUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      const parts = u.pathname.split('/').filter(Boolean);
      return parts[0] || '';
    }
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/watch')) return u.searchParams.get('v') || '';
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts[0] === 'shorts' || parts[0] === 'embed') return parts[1] || '';
    }
    return '';
  } catch {
    return '';
  }
}
function getVideoId(item) {
  const candidate = (item.id || '').toString().trim();
  if (candidate && candidate.length >= 8) return candidate;
  const fromUrl = getVideoIdFromUrl(item.url || '');
  return fromUrl || candidate || '';
}
function thumbCandidates(id) {
  return [
    `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${id}/sddefault.jpg`,
    `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    `https://i.ytimg.com/vi/${id}/default.jpg`,
  ];
}
function createThumbImg(id, linkHref) {
  const a = document.createElement('a');
  a.href = linkHref || '#';
  a.target = '_blank';
  a.rel = 'noopener';

  const img = document.createElement('img');
  img.alt = 'Preview';
  img.loading = 'lazy';
  img.className = 'w-28 h-16 sm:w-36 sm:h-20 rounded-lg object-cover bg-gray-100 flex-shrink-0';
  const sources = thumbCandidates(id);
  let idx = 0;
  img.src = sources[idx];
  img.onerror = () => {
    idx++;
    if (idx < sources.length) img.src = sources[idx];
    else img.onerror = null;
  };

  a.appendChild(img);
  return a;
}

// ---------- render / append ----------
function resetResults() {
  list.innerHTML = '';
  panel.classList.add('hidden');
  summary.textContent = '';
}
function appendResults(items = []) {
  if (!items.length && list.children.length === 0) {
    panel.classList.remove('hidden');
    list.innerHTML = `<li class="p-4 text-sm text-gray-500">No se encontraron resultados.</li>`;
    summary.textContent = '';
    return 0;
  }
  panel.classList.remove('hidden');

  let appended = 0;
  for (const it of items) {
    const key = (it.url || it.id || '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    appended++;

    const li = document.createElement('li');
    li.className = 'p-3 flex items-center gap-3';
    li.dataset.id = it.id || '';

    // Checkbox
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'rounded';
    check.dataset.id = it.id || '';

    // Preview
    const vid = getVideoId(it);
    const preview = vid ? createThumbImg(vid, it.url) : document.createElement('div');
    if (!vid) {
      preview.className = 'w-28 h-16 sm:w-36 sm:h-20 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400';
      preview.textContent = 'Sin preview';
    }

    // Info
    const info = document.createElement('div');
    info.className = 'min-w-0 flex-1';
    const title = document.createElement('div');
    title.className = 'font-medium truncate';
    title.textContent = it.title || '(Sin título)';

    const link = document.createElement('a');
    link.href = it.url || '#';
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'text-sm text-blue-600 hover:underline break-all';
    link.textContent = it.url || '(Sin URL)';

    info.appendChild(title);
    info.appendChild(link);

    // Botón Guardar
    const btnSave = document.createElement('button');
    btnSave.className = 'px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50';
    btnSave.textContent = 'Guardar';
    btnSave.addEventListener('click', () => saveOne(it, btnSave));

    li.appendChild(check);
    li.appendChild(preview);
    li.appendChild(info);
    li.appendChild(btnSave);
    list.appendChild(li);
  }

  // Actualiza resumen (conteo visible)
  const totalRendered = list.querySelectorAll('li').length;
  summary.innerHTML = `<span class="font-medium">${totalRendered}</span> resultado(s) cargados`;

  return appended;
}

// ---------- carga incremental ----------
async function loadMore() {
  if (isLoading || noMore || !currentQuery) return;
  isLoading = true;
  setState('Cargando más...');

  try {
    const resp = await fetch(YT_LIST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // offset: cantidad ya cargada; si tu backend no lo soporta, devolverá siempre la primera página.
      body: JSON.stringify({ query: currentQuery, limit: YT_PAGE_SIZE, offset, mode: 'auto' })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.detail || 'No se pudo obtener resultados.');

    const items = Array.isArray(data.items) ? data.items : [];
    const added = appendResults(items);
    offset += items.length;

    // Si no llegaron más de YT_PAGE_SIZE o todos fueron duplicados, asumimos fin
    if (items.length < YT_PAGE_SIZE || added === 0) {
      noMore = true;
      setState('No hay más resultados');
    } else {
      setState('Listo ✓');
    }
  } catch (e) {
    logLine('❌ ' + e.message);
  } finally {
    isLoading = false;
  }
}

// Carga más cuando el usuario se acerca al fondo del scroll
function onScrollLoadMore() {
  // list es el UL con overflow-auto
  if (!list) return;
  const threshold = 100; // px antes del final
  if (list.scrollTop + list.clientHeight >= list.scrollHeight - threshold) {
    loadMore();
  }
}

// ---------- acciones ----------
async function listar() {
  const q = (qInput?.value || '').trim();
  if (!q) { setState('⚠️ Ingresa un enlace o término de búsqueda.'); return; }

  // Reinicia estado
  startLoadingButton(btnListar, 'Buscando...');
  currentQuery = q;
  offset = 0;
  isLoading = false;
  noMore = false;
  seen.clear();
  resetResults();
  setState('');

  try {
    await loadMore(); // primera página
  } finally {
    stopLoadingButton(btnListar, 'Listar');
  }
}

async function saveOne(item, btn = null) {
  if (btn) startLoadingButton(btn, 'Guardando...');
  try {
    const saved = addToWishlist({
      id: Date.now() + Math.random(),
      title: item.title || 'audio',
      url: item.url || '',
      addedAt: new Date().toISOString()
    });
    if (!saved) {
      setState('Ya estaba en la lista ✓');
      if (btn) { btn.textContent = 'Ya guardado'; btn.disabled = true; }
    } else {
      setState('Guardado ✓');
      if (btn) { btn.textContent = 'Guardado ✓'; btn.disabled = true; }
    }
  } catch (e) {
    logLine('❌ ' + e.message);
    if (btn) stopLoadingButton(btn, 'Guardar');
    return;
  }
}

async function saveSelected() {
  const checks = Array.from(list.querySelectorAll('input[type="checkbox"]:checked'));
  if (checks.length === 0) { setState('⚠️ No hay seleccionados.'); return; }

  startLoadingButton(btnGuardarSel, 'Guardando selección...');
  try {
    for (const c of checks) {
      const li = c.closest('li');
      if (!li) continue;
      const id = li.dataset.id;
      const title = li.querySelector('.font-medium')?.textContent || '';
      const url = li.querySelector('a')?.href || '';
      const btn = li.querySelector('button');

      const saved = addToWishlist({
        id: Date.now() + Math.random(),
        title: title || 'audio',
        url: url || '',
        addedAt: new Date().toISOString()
      });
      if (saved) {
        if (btn) { btn.textContent = 'Guardado ✓'; btn.disabled = true; }
      } else {
        if (btn) { btn.textContent = 'Ya guardado'; btn.disabled = true; }
      }
    }
    setState('Guardados ✓');
  } catch (e) {
    logLine('❌ ' + e.message);
  } finally {
    stopLoadingButton(btnGuardarSel, 'Guardar selección');
  }
}

// ---------- eventos ----------
if (btnListar) btnListar.addEventListener('click', listar);
if (btnGuardarSel) btnGuardarSel.addEventListener('click', saveSelected);
if (list) list.addEventListener('scroll', onScrollLoadMore);
