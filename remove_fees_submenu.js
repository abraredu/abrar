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
  
  // Find Admission link and the Fees link immediately following it, and remove the Fees link.
  // We use regex to match the admission link and the fees link regardless of relative path prefix.
  const regex = /(<a href=\"[^\"]*students\/admission\.html\"[^>]*>Admission<\/a>)\s*<a href=\"[^\"]*finance\/fees\.html\" class=\"submenu-item\">Fees<\/a>/;
  
  if (regex.test(content)) {
    let newContent = content.replace(regex, '$1');
    if (content !== newContent) {
      fs.writeFileSync(filePath, newContent);
      console.log(`Updated ${filePath}`);
    }
  }
}
processDirectory(rootDir);
console.log('Done removing fees from students submenu.');
