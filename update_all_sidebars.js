const fs = require('fs');
const path = require('path');

const rootDir = __dirname;

function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (!fullPath.includes('node_modules') && !fullPath.includes('.git') && !fullPath.includes('.gemini')) {
        processDirectory(fullPath);
      }
    } else if (fullPath.endsWith('.html')) {
      updateSidebar(fullPath);
    }
  }
}

function updateSidebar(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Skip if already has Data submenu
  if (content.includes('reports/data.html')) {
    return;
  }
  
  // Find where to insert (after Progress link)
  const isSubdir = path.dirname(filePath) !== rootDir;
  
  // Determine relative path based on dashboard link
  const prefix = isSubdir ? '../' : '';
  
  const dataLink = `
        <div class="submenu">
          <a href="${prefix}reports/data.html" class="submenu-item">Data</a>
        </div>`;
          
  const progressRegex = /(<a href="[^"]*reports\/progress\.html"[^>]*>[\s\S]*?<\/a>)/;
  
  if (progressRegex.test(content)) {
    content = content.replace(progressRegex, `$1${dataLink}`);
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
  }
}

processDirectory(rootDir);
console.log("Done updating sidebars.");
