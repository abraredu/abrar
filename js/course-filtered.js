// js/course-filtered.js
import { db } from './firebase-config.js';
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
  const tbody = document.getElementById('filteredTableBody');
  
  if (!tbody) return;

  const courseType = tbody.getAttribute('data-course');
  
  try {
    const q = query(
      collection(db, "students"), 
      where("courseType", "==", courseType)
    );
    // Ideally we would also orderBy createdAt, but Firestore requires a composite index for where() + orderBy().
    // For simplicity, we skip orderBy here or sort client-side.
    
    const snapshot = await getDocs(q);
    
    tbody.innerHTML = '';
    
    let totalStudents = 0;
    let activeStudents = 0;

    if (snapshot.empty) {
      tbody.innerHTML = `
        <tr><td colspan="7" style="text-align: center; padding: 4rem 2rem; color: #64748b;">
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem;">
            <i data-lucide="inbox" style="width: 48px; height: 48px; color: #cbd5e1;"></i>
            <p style="font-size: 1.125rem; font-weight: 500; color: #334155;">No students found</p>
            <p style="font-size: 0.875rem;">No students are enrolled in this course yet.</p>
          </div>
        </td></tr>
      `;
      if(document.getElementById('statTotalStudents')) document.getElementById('statTotalStudents').textContent = '0';
      if(document.getElementById('statActiveStudents')) document.getElementById('statActiveStudents').textContent = '0';
      lucide.createIcons();
      return;
    }
    
    // Sort client-side if needed
    const docs = [];
    snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
    docs.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
    
    const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

    docs.forEach((data) => {
      totalStudents++;
      if (data.status === 'active') activeStudents++;

      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #f1f5f9';
      tr.style.transition = 'background-color 0.2s';
      tr.onmouseenter = () => tr.style.backgroundColor = '#f8fafc';
      tr.onmouseleave = () => tr.style.backgroundColor = 'transparent';
      
      const statusBadge = data.status === 'active' 
        ? `<span style="background: #dcfce7; color: #166534; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; display: inline-block;">Active</span>`
        : `<span style="background: #fee2e2; color: #991b1b; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; display: inline-block;">${data.status}</span>`;

      tr.innerHTML = `
        <td style="padding: 1rem 1.5rem;">
          <div style="font-weight: 500; color: #0f172a;">${data.name || '-'}</div>
          <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">${data.parentName || ''}</div>
        </td>
        <td style="padding: 1rem 1.5rem; color: #475569;">${data.studentId || '-'}</td>
        <td style="padding: 1rem 1.5rem; color: #475569;">${data.phone || '-'}</td>
        <td style="padding: 1rem 1.5rem; color: #475569;">${data.tutorId || '-'}</td>
        <td style="padding: 1rem 1.5rem; color: #475569; font-weight: 500;">${data.monthlyFee ? formatter.format(data.monthlyFee) : '-'}</td>
        <td style="padding: 1rem 1.5rem;">${statusBadge}</td>
        <td style="padding: 1rem 1.5rem; text-align: right;">
          <a href="../students/student-view.html?id=${data.id}" style="display: inline-block; color: #64748b; padding: 0.25rem; border-radius: 0.25rem; transition: all 0.2s;" title="View" onmouseover="this.style.color='#0ea5e9'; this.style.backgroundColor='#e0f2fe';" onmouseout="this.style.color='#64748b'; this.style.backgroundColor='transparent';"><i data-lucide="eye" style="width: 18px; height: 18px;"></i></a>
        </td>
      `;
      tbody.appendChild(tr);
    });
    
    if(document.getElementById('statTotalStudents')) document.getElementById('statTotalStudents').textContent = totalStudents;
    if(document.getElementById('statActiveStudents')) document.getElementById('statActiveStudents').textContent = activeStudents;
    
    lucide.createIcons();
    
  } catch (error) {
    console.error("Error fetching students: ", error);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--color-danger);">Error loading students: ${error.message}</td></tr>`;
  }
});
