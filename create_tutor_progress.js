const fs = require('fs');
const path = require('path');

const srcPath = 'd:\\abrar-main\\reports\\progress.html';
const destPath = 'd:\\abrar-main\\reports\\tutor-progress.html';

let content = fs.readFileSync(srcPath, 'utf8');

// Replace the sidebar with tutor sidebar
const sidebarRegex = /<aside class="sidebar" id="sidebar">[\s\S]*?<\/aside>/;
const tutorSidebar = `<aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-logo">
            <img src="../logo.png" alt="ABRAR Logo" style="height: 32px; width: auto;">
          </div>
        </div>
        
        <nav class="sidebar-nav">
          <a href="../tutor-dashboard.html" class="nav-item">
            <i data-lucide="layout-dashboard"></i> Dashboard
          </a>
          <a href="tutor-progress.html" class="nav-item active">
            <i data-lucide="line-chart"></i> Progress Report
          </a>
        </nav>
        
        <div class="sidebar-footer">
          <a href="#" id="tutorLogoutBtnSidebar" class="nav-item text-danger">
            <i data-lucide="log-out"></i> Logout
          </a>
        </div>
      </aside>`;
content = content.replace(sidebarRegex, tutorSidebar);

// Remove layout.js and replace with inline mobile menu and logout
const layoutJsRegex = /<script type="module" src="\.\.\/js\/layout\.js"><\/script>/;
const inlineJs = `<script>
    document.addEventListener('DOMContentLoaded', () => {
      const mobileMenuBtn = document.getElementById('mobileMenuBtn');
      const sidebar = document.getElementById('sidebar');
      const sidebarOverlay = document.getElementById('sidebarOverlay');

      if (mobileMenuBtn && sidebar && sidebarOverlay) {
        mobileMenuBtn.addEventListener('click', () => {
          sidebar.classList.add('open', 'active');
          sidebarOverlay.classList.add('active');
        });

        sidebarOverlay.addEventListener('click', () => {
          sidebar.classList.remove('open', 'active');
          sidebarOverlay.classList.remove('active');
        });
      }

      // Logout handler
      const logoutBtn = document.getElementById('tutorLogoutBtnSidebar');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          localStorage.removeItem('tutorLoggedIn');
          localStorage.removeItem('tutorId');
          localStorage.removeItem('tutorName');
          window.location.href = '../index.html';
        });
      }
    });
  </script>`;
content = content.replace(layoutJsRegex, inlineJs);

// Remove firebase-config.js and auth checks (if any exist, though progress.js doesn't have them now, progress.html might have firebase-config)
content = content.replace(/<script type="module" src="\.\.\/js\/firebase-config\.js"><\/script>/, '');

fs.writeFileSync(destPath, content);
console.log('Created tutor-progress.html');
