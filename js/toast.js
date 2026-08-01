const style = document.createElement('style');
style.textContent = `
  .toast-container {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 99999;
    display: flex;
    flex-direction: column;
    gap: 10px;
    pointer-events: none;
  }
  .toast {
    background: #fff;
    color: #363636;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    font-family: inherit;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    opacity: 0;
    transform: translateY(-20px);
    transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    pointer-events: auto;
  }
  .toast.show {
    opacity: 1;
    transform: translateY(0);
  }
  .toast.hide {
    opacity: 0;
    transform: translateY(-20px) scale(0.9);
  }
  .toast-icon {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .toast-icon.success {
    background: #4ade80;
    color: #fff;
  }
  .toast-icon.error {
    background: #ef4444;
    color: #fff;
  }
  .toast-icon svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;
document.head.appendChild(style);

const createContainer = () => {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
};

const showToast = (message, type = 'success') => {
  const container = createContainer();
  const toastEl = document.createElement('div');
  toastEl.className = 'toast';
  
  let iconHtml = '';
  if (type === 'success') {
    iconHtml = `<div class="toast-icon success"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg></div>`;
  } else if (type === 'error') {
    iconHtml = `<div class="toast-icon error"><svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"></path></svg></div>`;
  }
  
  toastEl.innerHTML = `${iconHtml}<span>${message}</span>`;
  container.appendChild(toastEl);
  
  // Trigger animation
  requestAnimationFrame(() => {
    toastEl.classList.add('show');
  });
  
  setTimeout(() => {
    toastEl.classList.add('hide');
    toastEl.addEventListener('transitionend', () => {
      toastEl.remove();
    });
  }, 3000);
};

export const toast = {
  success: (msg) => showToast(msg, 'success'),
  error: (msg) => showToast(msg, 'error'),
  custom: (msg) => showToast(msg, 'custom')
};

// Also expose to window in case it's used globally
window.toast = toast;
