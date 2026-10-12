const fs = require('fs');
const content = fs.readFileSync('reports/tutor-progress.html', 'utf8');

const cssMatch = content.match(/\/\* Modern Report Design CSS \*\/[\s\S]*?(?=<\/style>)/);
const htmlMatch = content.match(/<div class="modern-report" id="printableReport" style="display: none;">[\s\S]*?(?=<\/div>\s*<\/div>\s*<\/div>)/);

let dataHtml = fs.readFileSync('reports/data.html', 'utf8');

// Insert CSS
if (cssMatch && !dataHtml.includes('Modern Report Design CSS')) {
  dataHtml = dataHtml.replace('</head>', '<style>\n' + cssMatch[0] + '\n</style>\n</head>');
}

// Insert HTML inside the Modal, replacing the table
if (htmlMatch) {
  const replacement = `
    <!-- Modal for Report Details -->
    <div id="reportModal" class="modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;">
      <div class="card" style="width: 100%; max-width: 850px; max-height: 90vh; overflow-y: auto; background: var(--color-background); border-radius: 12px; padding: 1.5rem; position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.5rem;" class="no-print">
          <h3 style="margin: 0;">Progress Report</h3>
          <div style="display: flex; gap: 1rem;">
            <button id="downloadPdfBtn" class="btn btn-primary" style="padding: 0.5rem 1rem;"><i data-lucide="download"></i> Download PDF</button>
            <button id="closeModalBtn" style="background: none; border: none; cursor: pointer; color: var(--color-text-secondary);"><i data-lucide="x"></i></button>
          </div>
        </div>
        
        <div id="pdfContainer" style="display: flex; justify-content: center;">
          ${htmlMatch[0]}</div></div></div>
        </div>
      </div>
    </div>
  `;
  
  dataHtml = dataHtml.replace(/<!-- Modal for Report Details -->[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/, replacement);
}

fs.writeFileSync('reports/data.html', dataHtml);
console.log('Successfully injected template!');
