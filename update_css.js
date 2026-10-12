const fs = require('fs');
const path = require('path');

const cssToInsert = `    /* Modern Report Design CSS */
    @import url('https://fonts.googleapis.com/css2?family=Anek+Malayalam:wght@300;400;500;600;700;800&display=swap');

    .modern-report {
      background-color: #ffffff;
      color: #1e293b;
      font-family: 'Anek Malayalam', sans-serif;
      position: relative;
      overflow: hidden;
      padding: 0;
      border-radius: 16px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
    }

    /* Subtle background pattern */
    .modern-report::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background-image: radial-gradient(#0f766e 0.5px, transparent 0.5px);
      background-size: 20px 20px;
      opacity: 0.03;
      z-index: 1;
      pointer-events: none;
    }

    .report-top-header {
      background: linear-gradient(135deg, #115e59 0%, #0d9488 100%);
      color: white;
      padding: 2.5rem 2.5rem 4rem 2.5rem;
      display: flex;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
      z-index: 2;
    }
    
    .report-top-header::before {
      content: '';
      position: absolute;
      top: -50px; right: -50px;
      width: 200px; height: 200px;
      background: rgba(255,255,255,0.1);
      border-radius: 50%;
    }
    
    .report-top-header::after {
      content: '';
      position: absolute;
      bottom: -60px;
      left: -10%;
      width: 120%;
      height: 100px;
      background: #ffffff;
      border-radius: 50%;
      border-top: 6px solid #f59e0b;
      box-shadow: 0 -4px 15px rgba(245, 158, 11, 0.3);
    }

    .report-top-left, .report-top-right {
      position: relative;
      z-index: 3;
    }

    .brand-title {
      font-family: 'Anek Malayalam', sans-serif;
      font-size: 3rem;
      font-weight: 800;
      line-height: 1;
      letter-spacing: 2px;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
    }
    .brand-subtitle {
      font-size: 0.95rem;
      font-weight: 600;
      letter-spacing: 1px;
      margin-top: 5px;
      color: #ccfbf1;
    }

    .report-title-main, .report-title-sub {
      font-size: 1.8rem;
      font-weight: 800;
      line-height: 1.1;
      text-transform: uppercase;
      text-align: right;
    }
    .report-title-motto {
      font-size: 0.95rem;
      color: #fcd34d;
      margin-top: 8px;
      font-weight: 600;
      text-align: right;
    }

    .report-main-body {
      padding: 1rem 2.5rem 0rem 2.5rem;
      position: relative;
      z-index: 2;
    }

    .report-section-box {
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.25rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
      position: relative;
      overflow: hidden;
    }
    
    .report-section-box::before {
      content: '';
      position: absolute;
      top: 0; left: 0;
      width: 4px; height: 100%;
      background: #0d9488;
      border-radius: 4px 0 0 4px;
    }

    .student-info-box {
      display: flex;
      justify-content: space-between;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      box-shadow: none;
    }
    .student-info-box::before {
      background: #f59e0b;
    }
    .info-col-label {
      font-size: 0.75rem;
      font-weight: 700;
      color: #0f766e;
      margin-bottom: 0.35rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .info-col-val {
      font-size: 1.05rem;
      font-weight: 700;
      color: #1e293b;
    }

    .report-grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
    }

    .section-title {
      font-size: 1.15rem;
      font-weight: 800;
      color: #0f766e;
      margin-top: 0;
      margin-bottom: 1rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .attendance-boxes {
      display: flex;
      gap: 0.75rem;
      justify-content: space-between;
    }
    .att-box {
      background: linear-gradient(to bottom right, #f0fdfa, #ccfbf1);
      border-radius: 12px;
      padding: 1rem 0.5rem;
      text-align: center;
      flex: 1;
      border: 1px solid #99f6e4;
      box-shadow: 0 2px 4px rgba(0,0,0,0.02);
    }
    .att-label {
      font-size: 0.65rem;
      font-weight: 700;
      color: #115e59;
      line-height: 1.3;
      margin-bottom: 0.5rem;
      letter-spacing: 0.5px;
    }
    .att-val {
      font-size: 1.6rem;
      font-weight: 800;
      color: #0d9488;
    }

    .progress-col {
      text-align: center;
      flex-shrink: 0;
      width: 150px;
    }
    .flex-row { display: flex; gap: 1rem; }
    .align-center { align-items: center; }

    .circular-progress {
      width: 110px; height: 110px;
      border-radius: 50%;
      background: conic-gradient(#f59e0b 0% 80%, #f1f5f9 80% 100%);
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto;
      box-shadow: 0 4px 10px rgba(245, 158, 11, 0.2);
    }
    .circle-inner {
      width: 86px; height: 86px;
      background: white;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-shadow: inset 0 2px 5px rgba(0,0,0,0.05);
    }
    .inner-text {
      font-size: 0.8rem;
      font-weight: 800;
      color: #0f766e;
    }
    .inner-stars {
      color: #f59e0b;
      font-size: 0.95rem;
      margin-top: 2px;
    }
    .progress-remark {
      font-size: 0.9rem;
      font-weight: 600;
      color: #334155;
      line-height: 1.6;
      background: #f8fafc;
      padding: 1rem;
      border-radius: 12px;
      border: 1px dashed #cbd5e1;
    }

    .perf-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0 0.5rem;
    }
    .perf-table th {
      font-size: 0.75rem;
      font-weight: 700;
      color: #64748b;
      text-align: left;
      padding: 0 0.75rem 0.25rem 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .perf-table td {
      padding: 0.85rem 0.75rem;
      font-size: 0.95rem;
      color: #334155;
      font-weight: 600;
      background: #f8fafc;
    }
    .perf-table tr td:first-child {
      border-radius: 8px 0 0 8px;
    }
    .perf-table tr td:last-child {
      border-radius: 0 8px 8px 0;
    }
    .text-right { text-align: right !important; }

    .rating-stars { color: #f59e0b; font-size: 1.1rem; letter-spacing: 3px; }

    .remark-pill {
      background: #ccfbf1;
      color: #0f766e;
      font-size: 0.7rem;
      font-weight: 800;
      padding: 0.4rem 0.8rem;
      border-radius: 99px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      box-shadow: 0 2px 4px rgba(15, 118, 110, 0.1);
    }
    .remark-pill.needs-imp {
      background: #fee2e2;
      color: #b91c1c;
      box-shadow: 0 2px 4px rgba(185, 28, 28, 0.1);
    }

    .topics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.85rem 1.5rem;
    }
    .topic-item {
      display: flex;
      align-items: flex-start;
      gap: 0.6rem;
      font-size: 0.9rem;
      font-weight: 600;
      color: #334155;
      background: #f8fafc;
      padding: 0.5rem 0.75rem;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .topic-bullet {
      color: #f59e0b;
      font-size: 1.2rem;
      line-height: 0.8;
    }

    .obs-text {
      font-size: 0.9rem;
      color: #475569;
      line-height: 1.7;
      font-weight: 500;
    }

    .report-footer-section {
      background: linear-gradient(135deg, #0f766e 0%, #115e59 100%);
      color: white;
      text-align: center;
      padding: 1.5rem;
      margin-top: 0.5rem;
      position: relative;
      z-index: 2;
    }
    .report-footer-section::before {
      content: '';
      position: absolute;
      top: -4px; left: 0; width: 100%; height: 4px;
      background: #f59e0b;
    }
    .footer-remark {
      font-size: 1.2rem;
      font-weight: 800;
      margin-bottom: 0.5rem;
      letter-spacing: 1px;
    }
    .footer-brand {
      font-size: 0.8rem;
      font-weight: 500;
      color: #ccfbf1;
      letter-spacing: 0.5px;
    }

    @media print {
      .modern-report { box-shadow: none; border-radius: 0; border: none; }
      .report-top-header::after { border-top-color: #f59e0b !important; }
      .modern-report::before { display: none; }
    }`;

const files = [
  'student-progress.html',
  'tutor-dashboard.html',
  'reports/tutor-progress.html'
];

files.forEach(file => {
  const filepath = path.join('d:/abrar-main', file);
  if (fs.existsSync(filepath)) {
    let content = fs.readFileSync(filepath, 'utf-8');
    // Using Regex to replace the modern report design css
    const pattern = /\/\*\s*Modern Report Design CSS\s*\*\/.*?@media print\s*\{[^}]+\}\s*\n    \}/s;
    if (pattern.test(content)) {
      content = content.replace(pattern, cssToInsert);
      fs.writeFileSync(filepath, content, 'utf-8');
      console.log('Updated', file);
    } else {
      console.log('Pattern not found in', file);
    }
  }
});
