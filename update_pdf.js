const fs = require('fs');
const path = require('path');

const replacementJs = `
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        
        let contentWidth = pageWidth - margin * 2;
        let contentHeight = (canvas.height * contentWidth) / canvas.width;

        // Force single page by scaling down if needed
        if (contentHeight > (pageHeight - margin * 2)) {
          contentHeight = pageHeight - margin * 2;
          contentWidth = (canvas.width * contentHeight) / canvas.height;
        }

        const xOffset = margin + ((pageWidth - margin * 2) - contentWidth) / 2;

        pdf.addImage(
          imgData, 'PNG',
          xOffset,
          margin,
          contentWidth,
          contentHeight
        );
`;

const replaceInFile = (file, pattern) => {
  const filepath = path.join('d:/abrar-main', file);
  if (fs.existsSync(filepath)) {
    let content = fs.readFileSync(filepath, 'utf-8');
    if (pattern.test(content)) {
      content = content.replace(pattern, replacementJs);
      fs.writeFileSync(filepath, content, 'utf-8');
      console.log('Updated', file);
    } else {
      console.log('Pattern not found in', file);
    }
  }
};

const tutorPattern = /const pageWidth = pdf\.internal\.pageSize\.getWidth\(\);.*?isFirstPage = false;\s*\}/s;
const studentPattern = /const pageWidth = pdf\.internal\.pageSize\.getWidth\(\);.*?isFirstPage = false;\s*\}/s;

replaceInFile('js/tutor-progress.js', tutorPattern);
replaceInFile('student-progress.html', studentPattern);
