// js/layout.js
import './auth.js';
document.addEventListener('DOMContentLoaded', () => {
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  if (mobileMenuBtn && sidebar && sidebarOverlay) {
    mobileMenuBtn.addEventListener('click', () => {
      sidebar.classList.add('open');
      sidebarOverlay.classList.add('active');
    });

    sidebarOverlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      sidebarOverlay.classList.remove('active');
    });
  }

  // Handle Submenus as Toggles
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    const nextEl = item.nextElementSibling;
    if (nextEl && nextEl.classList.contains('submenu')) {
      const isItemActive = item.classList.contains('active');
      const isSubmenuActive = nextEl.querySelector('.submenu-item.active') !== null;
      const shouldBeOpen = isItemActive || isSubmenuActive;

      if (!shouldBeOpen) {
        nextEl.style.display = 'none';
      }

      const toggleBtn = document.createElement('div');
      toggleBtn.style.marginLeft = 'auto';
      toggleBtn.style.display = 'flex';
      toggleBtn.style.alignItems = 'center';
      
      toggleBtn.innerHTML = `<i data-lucide="chevron-down" style="transition: transform 0.2s; ${shouldBeOpen ? 'transform: rotate(180deg);' : ''}"></i>`;
      
      toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const icon = toggleBtn.querySelector('svg') || toggleBtn.querySelector('i');
        if (nextEl.style.display === 'none') {
          nextEl.style.display = 'flex';
          if (icon) icon.style.transform = 'rotate(180deg)';
        } else {
          nextEl.style.display = 'none';
          if (icon) icon.style.transform = 'rotate(0deg)';
        }
      });
      
      item.appendChild(toggleBtn);
      
      item.addEventListener('click', (e) => {
        const href = item.getAttribute('href');
        // If the item doesn't have a real link, act as a toggle
        if (!href || href === '#') {
          e.preventDefault();
          toggleBtn.click();
        }
      });
    }
  });

  if (window.lucide) {
    lucide.createIcons();
  }
});
