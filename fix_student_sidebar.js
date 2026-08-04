const fs = require('fs');

const path = 'd:\\abrar-main\\student-dashboard.html';
let content = fs.readFileSync(path, 'utf8');

const sidebarRegex = /<aside class="sidebar" id="sidebar">[\s\S]*?<\/aside>/;
const studentSidebar = `<aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <img src="logo.png" alt="ABRAR Logo" style="height: 32px; width: auto;">
        </div>
      </div>
      
      <nav class="sidebar-nav">
        <a href="student-dashboard.html" class="nav-item active">
          <i data-lucide="layout-dashboard"></i> Dashboard
        </a>
        <a href="student-progress.html" class="nav-item">
          <i data-lucide="line-chart"></i> Progress of Month
        </a>
        <a href="student-receipts.html" class="nav-item">
          <i data-lucide="receipt"></i> Receipts
        </a>
      </nav>
      
      <div class="sidebar-footer">
        <a href="#" id="logoutBtnSidebar" class="nav-item text-danger">
          <i data-lucide="log-out"></i> Logout
        </a>
      </div>
    </aside>`;
    
content = content.replace(sidebarRegex, studentSidebar);

// Also update logout btn id if needed in JS, but their student-dashboard.js probably uses the header or something. Let's make sure there's an inline logout handler if there wasn't one.
// Let's add a quick logout handler if it isn't there.
if (!content.includes('localStorage.removeItem(\'studentToken\')')) {
  // It probably already handles logout via js/student-dashboard.js, but we changed the button id to `logoutBtnSidebar`. 
  // Let's keep the id `logoutBtn` so their JS works.
  content = content.replace('logoutBtnSidebar', 'logoutBtn');
}

fs.writeFileSync(path, content);
console.log('student-dashboard.html sidebar fixed.');
