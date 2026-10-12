const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!fullPath.includes('node_modules') && !fullPath.includes('.git')) {
        processDir(fullPath);
      }
    } else if (fullPath.endsWith('.html')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      const oldSubmenuStr = `<div class="submenu" style="padding-left: 3rem; margin-top: -0.25rem; margin-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem;">\n          <a href="../courses/manage.html" style="color: var(--color-text-secondary); text-decoration: none; font-size: 0.875rem; padding: 0.4rem 0.5rem; border-radius: var(--radius-md); transition: all var(--transition-fast);" onmouseover="this.style.color='var(--color-primary)'" onmouseout="this.style.color='var(--color-text-secondary)'">Manage</a>\n        </div>`;
      const newSubmenuStr = `<div class="submenu">\n          <a href="../courses/manage.html" class="submenu-item">Manage</a>\n        </div>`;
      
      const oldSubmenuStr2 = `<div class="submenu" style="padding-left: 3rem; margin-top: -0.25rem; margin-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem;">\r\n          <a href="../courses/manage.html" style="color: var(--color-text-secondary); text-decoration: none; font-size: 0.875rem; padding: 0.4rem 0.5rem; border-radius: var(--radius-md); transition: all var(--transition-fast);" onmouseover="this.style.color='var(--color-primary)'" onmouseout="this.style.color='var(--color-text-secondary)'">Manage</a>\r\n        </div>`;
      
      if (content.includes(oldSubmenuStr)) {
        content = content.replace(oldSubmenuStr, newSubmenuStr);
        fs.writeFileSync(fullPath, content);
        console.log('Updated', fullPath);
      } else if (content.includes(oldSubmenuStr2)) {
        content = content.replace(oldSubmenuStr2, newSubmenuStr);
        fs.writeFileSync(fullPath, content);
        console.log('Updated', fullPath);
      }
    }
  }
}

processDir('D:\\abrar-main');
console.log('Done');
