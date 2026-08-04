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
    
    let allTutors = [];
    snapshot.forEach((doc) => {
      allTutors.push({ id: doc.id, ...doc.data() });
    });

    const searchInput = document.getElementById('searchInput');
    const typeFilter = document.getElementById('typeFilter');
    const statusFilter = document.getElementById('statusFilter');

    let currentTutors = [];

    const renderTable = (tutors) => {
      currentTutors = tutors;
      let total = 0;
      let active = 0;
      
      tbody.innerHTML = '';
      
      if (tutors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No tutors found.</td></tr>';
        statTotal.textContent = 0;
        statActive.textContent = 0;
        return;
      }
      
      tutors.forEach((data) => {
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
            <a href="tutor-view.html?id=${data.id}" style="color: var(--color-text-secondary); margin-right: 0.5rem;" title="View"><i data-lucide="eye" style="width: 16px; height: 16px;"></i></a>
            <a href="edit-tutor.html?id=${data.id}" style="color: var(--color-text-secondary);" title="Edit"><i data-lucide="edit" style="width: 16px; height: 16px;"></i></a>
          </td>
        `;
        tbody.appendChild(tr);
      });
      
      statTotal.textContent = total;
      statActive.textContent = active;
      lucide.createIcons();
    };

    const filterData = () => {
      const searchTerm = (searchInput ? searchInput.value : '').toLowerCase();
      const type = typeFilter ? typeFilter.value : '';
      const status = statusFilter ? statusFilter.value : '';

      const filtered = allTutors.filter(tutor => {
        const matchesSearch = !searchTerm || 
          (tutor.name && tutor.name.toLowerCase().includes(searchTerm)) || 
          (tutor.tutorId && tutor.tutorId.toLowerCase().includes(searchTerm)) || 
          (tutor.phone && tutor.phone.toLowerCase().includes(searchTerm));
        
        let matchesType = !type;
        if (type && tutor.tutorType) {
           const types = Array.isArray(tutor.tutorType) ? tutor.tutorType : [tutor.tutorType];
           matchesType = types.includes(type);
        }
        
        const matchesStatus = !status || tutor.status === status;

        return matchesSearch && matchesType && matchesStatus;
      });

      renderTable(filtered);
    };

    if (searchInput) searchInput.addEventListener('input', filterData);
    if (typeFilter) typeFilter.addEventListener('change', filterData);
    if (statusFilter) statusFilter.addEventListener('change', filterData);

    renderTable(allTutors);

    // ── Export CSV Logic ──
    const exportBtn = document.getElementById('exportTutorsBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        if (currentTutors.length === 0) {
          alert('No tutors to export.');
          return;
        }

        const headers = ['Tutor ID', 'Name', 'Phone', 'WhatsApp', 'Email', 'Address', 'Tutor Type', 'Joining Date', 'userId', 'Status'];
        const keys = ['tutorId', 'name', 'phone', 'whatsapp', 'email', 'address', 'tutorType', 'joiningDate', 'loginUsername', 'status'];

        let csvRows = [headers.join(',')];

        currentTutors.forEach(t => {
          const rowVals = keys.map(k => {
            let val = t[k] || '';
            if (k === 'tutorType' && Array.isArray(val)) {
              val = val.join('; ');
            }
            const valStr = String(val).trim();
            if (valStr.includes(',') || valStr.includes('"') || valStr.includes('\n') || valStr.includes('\r')) {
              return `"${valStr.replace(/"/g, '""')}"`;
            }
            return valStr;
          });
          csvRows.push(rowVals.join(','));
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "abrar_tutors_export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      });
    }
    
  } catch (error) {
    console.error("Error fetching tutors: ", error);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--color-danger);">Error loading tutors: ${error.message}</td></tr>`;
  }
});
