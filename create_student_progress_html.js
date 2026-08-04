const fs = require('fs');

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Progress Reports - ABRAR Management System</title>
  <link rel="icon" type="image/png" href="icon.png">
  <link rel="stylesheet" href="css/style.css">
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    .report-card {
      background: white;
      border: 1px solid var(--color-border);
      border-radius: 12px;
      padding: 1.5rem;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .report-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      border-color: var(--color-primary);
    }
    .report-card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .report-month {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--color-text);
    }
    .report-tutor {
      font-size: 0.875rem;
      color: var(--color-text-secondary);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    /* Modal Styles */
    .modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      display: none;
      justify-content: center;
      align-items: flex-start;
      padding: 2rem;
      z-index: 9999;
      overflow-y: auto;
    }
    .modal-overlay.active {
      display: flex;
    }
    .modal-content {
      background: white;
      width: 100%;
      max-width: 800px;
      border-radius: 12px;
      position: relative;
      margin: auto;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
    }
    .modal-close {
      position: absolute;
      top: 1rem; right: 1rem;
      background: none; border: none;
      cursor: pointer; color: var(--color-text-secondary);
    }
    
    @media print {
      body * { visibility: hidden; }
      #printableReport, #printableReport * { visibility: visible; }
      #printableReport {
        position: absolute;
        left: 0; top: 0; width: 100%; margin: 0; padding: 0; border: none; box-shadow: none;
      }
      .no-print { display: none !important; }
      .modal-overlay { background: none; padding: 0; }
      .modal-content { max-width: 100%; border-radius: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="app-container">
    
    <!-- Sidebar -->
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <img src="logo.png" alt="ABRAR Logo" style="height: 32px; width: auto;">
        </div>
      </div>
      
      <nav class="sidebar-nav">
        <a href="student-dashboard.html" class="nav-item">
          <i data-lucide="layout-dashboard"></i> Dashboard
        </a>
        <a href="student-progress.html" class="nav-item active">
          <i data-lucide="line-chart"></i> Progress of Month
        </a>
        <a href="student-receipts.html" class="nav-item">
          <i data-lucide="receipt"></i> Receipts
        </a>
      </nav>
      
      <div class="sidebar-footer">
        <a href="#" id="logoutBtn" class="nav-item text-danger">
          <i data-lucide="log-out"></i> Logout
        </a>
      </div>
    </aside>

    <div class="sidebar-overlay" id="sidebarOverlay"></div>

    <main class="main-content">
      <header class="top-header">
        <div class="header-left">
          <button class="mobile-menu-btn" id="mobileMenuBtn">
            <i data-lucide="menu"></i>
          </button>
          <h1 class="page-title">My Progress Reports</h1>
        </div>
      </header>

      <div class="page-content">
        <div id="reportsGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;">
          <p style="color: var(--color-text-secondary); grid-column: 1/-1;">Loading your reports...</p>
        </div>
      </div>
    </main>
  </div>
  
  <!-- Report Modal -->
  <div class="modal-overlay" id="reportModal">
    <div class="modal-content" id="printableReport">
      <button class="modal-close no-print" id="closeModalBtn"><i data-lucide="x"></i></button>
      
      <div style="padding: 2rem;">
        <div class="report-header">
          <img src="logo.png" alt="ABRAR Logo">
          <div class="report-title">ABRAR MONTHLY PROGRESS REPORT</div>
        </div>
        
        <div class="report-section">
          <h4>Student Details</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <div style="font-size: 0.75rem; color: var(--color-text-secondary); text-transform: uppercase;">Student Name</div>
              <div style="font-weight: 500; font-size: 1.1rem;" id="vStudentName">-</div>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: var(--color-text-secondary); text-transform: uppercase;">Report Month</div>
              <div style="font-weight: 500; font-size: 1.1rem;" id="vReportMonth">-</div>
            </div>
          </div>
        </div>

        <div class="report-section">
          <h4>1. Attendance</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <div style="font-size: 0.75rem; color: var(--color-text-secondary); text-transform: uppercase;">Classes Conducted</div>
              <div style="font-weight: 500; font-size: 1.1rem;" id="vClassesConducted">-</div>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: var(--color-text-secondary); text-transform: uppercase;">Classes Attended</div>
              <div style="font-weight: 500; font-size: 1.1rem;" id="vClassesAttended">-</div>
            </div>
          </div>
        </div>

        <div class="report-section">
          <h4>2. Performance & Progress Ratings</h4>
          
          <div style="display: grid; gap: 1rem; margin-top: 1rem;">
            <div style="display: flex; justify-content: space-between; padding-bottom: 0.5rem; border-bottom: 1px solid var(--color-border);">
              <span>Live Class Performance</span>
              <strong id="vLiveClass">-</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding-bottom: 0.5rem; border-bottom: 1px solid var(--color-border);">
              <span>Lesson Progress</span>
              <strong id="vLessonProgress">-</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding-bottom: 0.5rem; border-bottom: 1px solid var(--color-border);">
              <span>Revision & Homework</span>
              <strong id="vRevision">-</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding-bottom: 0.5rem; border-bottom: 1px solid var(--color-border);">
              <span>Classroom Activities</span>
              <strong id="vActivities">-</strong>
            </div>
          </div>
        </div>

        <div class="report-section">
          <h4>3. Topics & Remarks</h4>
          
          <div style="margin-bottom: 1.5rem;">
            <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">Topics Covered This Month</div>
            <div style="background: #fafafa; padding: 1rem; border-radius: 8px; font-size: 0.95rem; white-space: pre-wrap;" id="vTopics">-</div>
          </div>
          <div style="margin-bottom: 1.5rem;">
            <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">Mentor's Remarks</div>
            <div style="background: #fafafa; padding: 1rem; border-radius: 8px; font-size: 0.95rem; white-space: pre-wrap;" id="vRemarks">-</div>
          </div>
          <div>
            <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">Recommendations to Parents</div>
            <div style="background: #fafafa; padding: 1rem; border-radius: 8px; font-size: 0.95rem; white-space: pre-wrap;" id="vRecommendations">-</div>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem;" class="no-print">
          <button type="button" class="btn btn-primary" onclick="window.print()">
            <i data-lucide="printer"></i> Print / Save as PDF
          </button>
        </div>
      </div>
    </div>
  </div>

  <script>
    lucide.createIcons();
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (mobileMenuBtn && sidebar && overlay) {
      mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.add('active');
        overlay.classList.add('active');
      });
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
      });
    }
  </script>
  <script type="module" src="js/firebase-config.js"></script>
  <script type="module" src="js/student-progress.js"></script>
</body>
</html>`;

fs.writeFileSync('d:\\abrar-main\\student-progress.html', htmlContent);
console.log('student-progress.html created');
