const fs = require('fs');

const path = 'd:\\abrar-main\\js\\tutor-dashboard.js';
let content = fs.readFileSync(path, 'utf8');

const target = `
      studentsSnap.forEach(docSnap => {
        const student = docSnap.data();
        if (student.status === 'active') activeStudentsCount++;
        
        const statusColor = student.status === 'active' ? 'var(--color-primary)' : 'var(--color-text-secondary)';
        
        studentsHtml += \`
          <tr style="border-bottom: 1px solid var(--color-border);">
            <td style="padding: 1rem; font-weight: 500;">\${student.name}</td>
            <td style="padding: 1rem; color: var(--color-text-secondary);">\${student.regNo || '-'}</td>
            <td style="padding: 1rem;">\${student.course || '-'}</td>
            <td style="padding: 1rem; color: \${statusColor}; font-weight: 500;">
              \${student.status ? student.status.charAt(0).toUpperCase() + student.status.slice(1) : '-'}
            </td>
          </tr>
        \`;
      });
`;

const replace = `
      const today = new Date();
      // Set to start of day for accurate day-only comparisons
      today.setHours(0, 0, 0, 0);

      studentsSnap.forEach(docSnap => {
        const student = docSnap.data();
        if (student.status === 'active') activeStudentsCount++;
        
        const statusColor = student.status === 'active' ? 'var(--color-primary)' : 'var(--color-text-secondary)';
        
        let actionHtml = '-';
        if (student.status === 'active' && (student.classStartingDate || student.admissionDate)) {
          const startDateStr = student.classStartingDate || student.admissionDate;
          const startDate = new Date(startDateStr);
          
          if (!isNaN(startDate.getTime())) {
            const startDay = startDate.getDate();
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            
            // Calculate anniversary for this current month
            let anniversaryDate = new Date(currentYear, currentMonth, startDay);
            
            // If the start date day is e.g. 31, but this month only has 28 days, JS Date handles it by rolling over to next month.
            // We could prevent that, but JS rollover is generally acceptable here.
            
            // Difference in days between today and the anniversary
            const diffTime = anniversaryDate.getTime() - today.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            
            // If it is 3 days before, on the day, or up to 3 days after
            if (diffDays >= -3 && diffDays <= 3) {
              const urlParams = new URLSearchParams();
              urlParams.set('student', student.name || '');
              
              const reportLink = \`reports/progress.html?\${urlParams.toString()}\`;
              actionHtml = \`<a href="\${reportLink}" style="background: var(--color-primary); color: white; padding: 0.35rem 0.75rem; border-radius: 4px; font-size: 0.75rem; text-decoration: none; font-weight: 500; display: inline-flex; align-items: center; gap: 0.25rem;"><i data-lucide="file-text" style="width: 14px; height: 14px;"></i> Report Due</a>\`;
            }
          }
        }
        
        studentsHtml += \`
          <tr style="border-bottom: 1px solid var(--color-border);">
            <td style="padding: 1rem; font-weight: 500;">\${student.name}</td>
            <td style="padding: 1rem; color: var(--color-text-secondary);">\${student.studentId || student.regNo || '-'}</td>
            <td style="padding: 1rem;">\${student.courseType || student.course || '-'}</td>
            <td style="padding: 1rem; color: \${statusColor}; font-weight: 500;">
              \${student.status ? student.status.charAt(0).toUpperCase() + student.status.slice(1) : '-'}
            </td>
            <td style="padding: 1rem;">\${actionHtml}</td>
          </tr>
        \`;
      });
`;

if(content.includes('studentsSnap.forEach(docSnap => {')) {
  // It's safer to just replace using string splitting if indentation is slightly off
  const before = content.substring(0, content.indexOf('studentsSnap.forEach(docSnap => {'));
  const afterIdx = content.indexOf('document.getElementById(\'studentsTableBody\').innerHTML = studentsHtml;');
  const after = content.substring(afterIdx);
  
  content = before + replace + '    ' + after;
  fs.writeFileSync(path, content);
  console.log("tutor-dashboard.js updated.");
} else {
  console.log("Could not find studentsSnap loop");
}
