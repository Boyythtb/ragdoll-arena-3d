export function showToast(message, type = 'info', duration = 2800) {
  let container = document.getElementById('game-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'game-toast-container';
    container.className = 'game-toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: '🎉',
    warning: '⚠️',
    error: '❌',
    info: '🥊'
  };

  const toast = document.createElement('div');
  toast.className = `game-toast-pill toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || '✨'}</span>
    <span class="toast-text">${message}</span>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => {
      if (toast.parentElement) toast.parentElement.removeChild(toast);
    }, 300);
  }, duration);
}
