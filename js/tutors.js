// js/tutors.js
import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
  const tbody = document.getElementById('tutorsTableBody');
  const statTotal = document.getElementById('statTotal');
  const statActive = document.getElementById('statActive');
  
  if (!tbody) return;

  try {
    const q = query(collection(db, "tutors"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    
    let total = 0;
    let active = 0;
    
    tbody.innerHTML = '';
    
    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No tutors found.</td></tr>';
      statTotal.textContent = 0;
      statActive.textContent = 0;
      return;
    }
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      total++;
      if (data.status === 'active') active++;
      
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--color-border)';
      
      let typeLabel = '-';
      if (data.tutorType) {
        const types = Array.isArray(data.tutorType) ? data.tutorType : [data.tutorType];
        typeLabel = types.map(t => {
          return t === 'madrasa_individual' ? 'Madrasa Individual' : 
                 t === 'madrasa_group' ? 'Madrasa Group' : 
                 t === 'quran_recitation' ? 'Qur\'an Recitation' : t;
        }).join(', ');
      }
                        
      const salaryModel = '<span style="font-size: 0.75rem; color: var(--color-text-secondary);"><i data-lucide="settings" style="width: 12px; height: 12px; vertical-align: middle;"></i> Managed per role</span>';
                          
      const statusBadge = data.status === 'active' 
        ? `<span style="background: var(--color-sidebar-active); color: var(--color-success); padding: 0.25rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 500;">Active</span>`
        : `<span style="background: #FEF2F2; color: var(--color-danger); padding: 0.25rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 500;">${data.status}</span>`;

      tr.innerHTML = `
        <td style="padding: 0.75rem; font-weight: 500;">${data.name || '-'}</td>
        <td style="padding: 0.75rem;">${data.tutorId || '-'}</td>
        <td style="padding: 0.75rem;">${typeLabel}</td>
        <td style="padding: 0.75rem;">${data.phone || '-'}</td>
        <td style="padding: 0.75rem;">${salaryModel}</td>
        <td style="padding: 0.75rem;">${statusBadge}</td>
        <td style="padding: 0.75rem;">
          <a href="tutor-view.html?id=${doc.id}" style="color: var(--color-text-secondary); margin-right: 0.5rem;" title="View"><i data-lucide="eye" style="width: 16px; height: 16px;"></i></a>
          <a href="edit-tutor.html?id=${doc.id}" style="color: var(--color-text-secondary);" title="Edit"><i data-lucide="edit" style="width: 16px; height: 16px;"></i></a>
        </td>
      `;
      tbody.appendChild(tr);
    });
    
    statTotal.textContent = total;
    statActive.textContent = active;
    lucide.createIcons();
    
  } catch (error) {
    console.error("Error fetching tutors: ", error);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--color-danger);">Error loading tutors: ${error.message}</td></tr>`;
  }
});
