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
  
  if (content.includes('assessments/assessments.html')) {
    return;
  }
  
  const isSubdir = path.dirname(filePath) !== rootDir;
  const prefix = isSubdir ? '../' : '';
  
  const assessmentLink = `
        <a href="${prefix}assessments/assessments.html" class="nav-item">
          <i data-lucide="clipboard-check"></i> Assessments
        </a>`;
          
  const regex = /(<a href="[^"]*reports\/reports\.html"[^>]*>[\s\S]*?<\/a>)/;
  
  if (regex.test(content)) {
    content = content.replace(regex, `${assessmentLink}\n        $1`);
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
  }
}

processDirectory(rootDir);
console.log("Done updating sidebars.");
