const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'finance');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace the buttons
  let newContent = content.replace(/<a href=\"fees\.html\" class=\"btn btn-outline\"[^>]*>Fees<\/a>\s*/g, '');
  newContent = newContent.replace(/<a href=\"salaries\.html\" class=\"btn btn-outline\"[^>]*>Salaries<\/a>\s*/g, '');
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent);
    console.log('Updated', filePath);
  }
}
