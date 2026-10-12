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
  
  if (content.includes('finance/salaries.html') && content.includes('class=\"submenu-item\">Salary</a>')) {
    return;
  }
  
  const isSubdir = path.dirname(filePath) !== rootDir;
  const prefix = isSubdir ? '../finance/' : 'finance/';
  
  const submenu = `
        <div class=\"submenu\">
          <a href=\"${prefix}fees.html\" class=\"submenu-item\">Fees</a>
          <a href=\"${prefix}salaries.html\" class=\"submenu-item\">Salary</a>
          <a href=\"${prefix}accounts.html\" class=\"submenu-item\">Account</a>
        </div>`;
        
  const financeRegex = /(<a href=\"[^\"]*finance\/accounts\.html\"[^>]*>[\s\S]*?<i data-lucide=\"wallet\"><\/i> Finance\s*<\/a>)/;
  
  if (financeRegex.test(content)) {
    content = content.replace(financeRegex, `$1${submenu}`);
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
  }
}
processDirectory(rootDir);
console.log('Done updating sidebars.');
