const fs = require('fs');
let dash = fs.readFileSync('dashboard.html', 'utf8');

dash = dash.replace(
  /<h2[^>]*>Recent Financial Activity<\/h2>\s*<a href="finance\/accounts\.html"[^>]*>View All<\/a>/,
  '<h2 style="font-size: 1.125rem; font-weight: 600;">Recent Progress Reports</h2>\n            <a href="reports/data.html" class="btn btn-outline" style="padding: 0.5rem 1rem; font-size: 0.875rem;">View All</a>'
);

dash = dash.replace(
  /<div id="recentActivitiesList">\s*<div[^>]*>Loading...<\/div>\s*<\/div>/,
  '<div id="recentActivitiesList" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">\n            <div style="padding: 1rem; text-align: center; color: var(--color-text-secondary); grid-column: 1 / -1;">Loading...</div>\n          </div>'
);

if (!dash.includes('id="reportModal"')) {
  const tutorHtml = fs.readFileSync('reports/tutor-progress.html', 'utf8');
  const cssMatch = tutorHtml.match(/<style>\s*\/\* Colorful report form styles[\s\S]*?<\/style>/);
  let css = '';
  if (cssMatch) {
    const modernCss = cssMatch[0].match(/\/\* Modern Report Design CSS \*\/[\s\S]*?(?=<\/style>)/);
    if (modernCss) {
      css = '<style>\n' + modernCss[0] + '\n</style>';
    }
  }

  const modalMatch = tutorHtml.match(/<div class="modern-report" id="printableReport" style="display: none;">[\s\S]*?(?=<\/div>\s*<\/div>\s*<\/main>)/);
  if (modalMatch && css) {
    dash = dash.replace('</head>', css + '\n</head>');
    const modalHtml = `
    <!-- Modal for Report Details -->
    <div id="reportModal" class="modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;">
      <div class="card" style="width: 100%; max-width: 850px; max-height: 90vh; overflow-y: auto; background: var(--color-background); border-radius: 12px; padding: 1.5rem; position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.5rem;" class="no-print">
          <h3 style="margin: 0;">Progress Report</h3>
          <div style="display: flex; gap: 1rem;">
            <button id="printPdfBtn" class="btn btn-outline" style="padding: 0.5rem 1rem;"><i data-lucide="printer"></i> Print</button>
            <button id="downloadPdfBtn" class="btn btn-primary" style="padding: 0.5rem 1rem;"><i data-lucide="download"></i> Download PDF</button>
            <button id="closeModalBtn" style="background: none; border: none; cursor: pointer; color: var(--color-text-secondary);"><i data-lucide="x"></i></button>
          </div>
        </div>
        <div id="pdfContainer" style="display: flex; justify-content: center;">
        ` + modalMatch[0] + `
        </div>
      </div>
    </div>
    `;
    dash = dash.replace('</div>\n\n  <script>', '</div>\n' + modalHtml + '\n  <script>');
    
    if (!dash.includes('html2canvas')) {
      dash = dash.replace('</body>', '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>\n<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>\n</body>');
    }
  }
}

fs.writeFileSync('dashboard.html', dash);
console.log('Done!');
