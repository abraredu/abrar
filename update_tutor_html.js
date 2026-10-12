const fs = require('fs');

const path = 'd:\\abrar-main\\tutor-dashboard.html';
let content = fs.readFileSync(path, 'utf8');

const targetHeader = `<th style="padding: 1rem 1.5rem; font-weight: 600; color: var(--color-text-secondary);">Status</th>`;
const replaceHeader = `<th style="padding: 1rem 1.5rem; font-weight: 600; color: var(--color-text-secondary);">Status</th>
                      <th style="padding: 1rem 1.5rem; font-weight: 600; color: var(--color-text-secondary);">Action</th>`;

const targetColspan = `<td colspan="4" style="padding: 2rem;`;
const replaceColspan = `<td colspan="5" style="padding: 2rem;`;

if(content.includes(targetHeader)) {
  content = content.replace(targetHeader, replaceHeader);
  content = content.replace(targetColspan, replaceColspan);
  fs.writeFileSync(path, content);
  console.log("tutor-dashboard.html updated.");
} else {
  console.log("targetHeader not found in tutor-dashboard.html");
}
