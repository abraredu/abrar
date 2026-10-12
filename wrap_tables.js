const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== '.git' && f !== '.gemini' && f !== 'node_modules') {
        walkDir(dirPath, callback);
      }
    } else {
      if (f.endsWith('.html')) {
        callback(dirPath);
      }
    }
  });
}

walkDir('.', (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (content.includes('<div class="table-responsive">')) {
    return;
  }

  // Regex to match <table ...> ... </table>
  // Use dotAll flag 's' if supported, or [\s\S]*?
  let newContent = content.replace(/(<table[^>]*>[\s\S]*?<\/table>)/gi, (match) => {
    return `<div class="table-responsive">\n${match}\n</div>`;
  });

  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated ${filePath}`);
  }
});
