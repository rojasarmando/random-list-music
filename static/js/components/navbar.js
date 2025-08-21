// Navegación entre vistas
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
