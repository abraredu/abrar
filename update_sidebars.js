const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const dashboardPath = path.join(rootDir, 'dashboard.html');

// 1. Get template sidebar from dashboard.html
const dashboardHtml = fs.readFileSync(dashboardPath, 'utf8');
const sidebarRegex = /<aside class="sidebar" id="sidebar">[\s\S]*?<\/aside>/;
const match = dashboardHtml.match(sidebarRegex);

if (!match) {
  console.error("Could not find sidebar in dashboard.html");
  process.exit(1);
}

const templateSidebar = match[0];

// 2. Find all HTML files
function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        walk(filePath, fileList);
      }
    } else if (file.endsWith('.html') && 
               file !== 'index.html' && 
               file !== 'dashboard.html' && 
               file !== 'fix-db.html' &&
               !file.startsWith('student-') &&
               !file.startsWith('tutor-dashboard')) {
      if (!filePath.includes(path.sep + 'web' + path.sep)) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

const htmlFiles = walk(rootDir);

htmlFiles.forEach(filePath => {
  const relPath = path.relative(rootDir, filePath);
  const dirDepth = relPath.split(path.sep).length - 1;
  const prefix = '../'.repeat(dirDepth);

  // Read current file
  let content = fs.readFileSync(filePath, 'utf8');

  // Skip if it doesn't have a sidebar
  if (!content.match(sidebarRegex)) {
    console.log(`Skipping ${relPath} - no sidebar found`);
    return;
  }

  // Adjust links in the template for this specific depth
  let customizedSidebar = templateSidebar;

  // We know the template is from dashboard.html (root)
  // Let's replace hrefs and srcs
  customizedSidebar = customizedSidebar.replace(/href="([^"]+)"/g, (match, p1) => {
    if (p1.startsWith('http') || p1.startsWith('#')) return match;
    return `href="${prefix}${p1}"`;
  });

  customizedSidebar = customizedSidebar.replace(/src="([^"]+)"/g, (match, p1) => {
    if (p1.startsWith('http')) return match;
    return `src="${prefix}${p1}"`;
  });

  // Determine which section is active based on the folder
  const folder = relPath.split(path.sep)[0];
  const normalizedRel = relPath.replace(/\\/g, '/');
  
  // Remove all active classes
  customizedSidebar = customizedSidebar.replace(/class="nav-item active"/g, 'class="nav-item"');
  customizedSidebar = customizedSidebar.replace(/class="submenu-item active"/g, 'class="submenu-item"');
  
  // Add active class back based on folder name or specific page
  let targetHref = '';
  if (folder === 'students') targetHref = `${prefix}students/students.html`;
  else if (folder === 'courses') targetHref = `${prefix}courses/classes.html`;
  else if (folder === 'tutors') targetHref = `${prefix}tutors/tutors.html`;
  else if (folder === 'finance') targetHref = `${prefix}finance/accounts.html`;
  else if (folder === 'reports') targetHref = `${prefix}reports/reports.html`;
  else if (folder === 'notifications') targetHref = `${prefix}notifications/notifications.html`;
  else if (folder === 'messages') targetHref = `${prefix}messages/messages.html`;
  else if (folder === 'settings.html') targetHref = `${prefix}settings.html`; // Settings is at root

  if (targetHref) {
    const escapedTarget = targetHref.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const replaceRegex = new RegExp(`href="${escapedTarget}" class="nav-item"`);
    customizedSidebar = customizedSidebar.replace(replaceRegex, `href="${targetHref}" class="nav-item active"`);
  }

  // Handle active submenus
  if (normalizedRel === 'students/admission.html') {
    const escapedAdmission = `${prefix}students/admission.html`.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    customizedSidebar = customizedSidebar.replace(
      new RegExp(`href="${escapedAdmission}" class="submenu-item"`),
      `href="${prefix}students/admission.html" class="submenu-item active" style="font-weight: 600; color: var(--color-primary);"`
    );
  } else if (normalizedRel === 'finance/fees.html') {
    const escapedFees = `${prefix}finance/fees.html`.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    customizedSidebar = customizedSidebar.replace(
      new RegExp(`href="${escapedFees}" class="submenu-item"`),
      `href="${prefix}finance/fees.html" class="submenu-item active" style="font-weight: 600; color: var(--color-primary);"`
    );
  } else if (normalizedRel === 'courses/manage.html') {
    const escapedManage = `${prefix}courses/manage.html`.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    customizedSidebar = customizedSidebar.replace(
      new RegExp(`href="${escapedManage}" class="submenu-item"`),
      `href="${prefix}courses/manage.html" class="submenu-item active" style="font-weight: 600; color: var(--color-primary);"`
    );
  } else if (normalizedRel === 'courses/upgrade.html') {
    const escapedUpgrade = `${prefix}courses/upgrade.html`.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    customizedSidebar = customizedSidebar.replace(
      new RegExp(`href="${escapedUpgrade}" class="submenu-item"`),
      `href="${prefix}courses/upgrade.html" class="submenu-item active" style="font-weight: 600; color: var(--color-primary);"`
    );
  }

  // Replace sidebar in content
  content = content.replace(sidebarRegex, customizedSidebar);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated sidebar in ${relPath}`);
});

console.log('All sidebars updated successfully.');
