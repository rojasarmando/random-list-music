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
