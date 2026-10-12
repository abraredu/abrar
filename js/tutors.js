// js/tutors.js
import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy, limit, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
    
    let currentStatusFilter = '';
    const statusTabs = document.getElementById('statusTabs');
    if (statusTabs) {
      const buttons = statusTabs.querySelectorAll('.filter-tab');
      buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          buttons.forEach(b => {
            b.classList.remove('btn-primary', 'active');
            b.classList.add('btn-outline');
          });
          e.target.classList.remove('btn-outline');
          e.target.classList.add('btn-primary', 'active');
          currentStatusFilter = e.target.getAttribute('data-status');
          filterData();
        });
      });
    }

    let currentTutors = [];

    const renderTable = (tutors) => {
      currentTutors = tutors;
      let total = 0;
      let active = 0;
      
      tbody.innerHTML = '';
      
      if (tutors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No tutors found.</td></tr>';
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
          <td style="padding: 0.75rem;"><input type="checkbox" class="row-checkbox" value="${data.id}"></td>
          <td style="padding: 0.75rem; font-weight: 500;">${data.name || '-'}</td>
          <td style="padding: 0.75rem;">${data.tutorId || '-'}</td>
          <td style="padding: 0.75rem;">${typeLabel}</td>
          <td style="padding: 0.75rem;">${data.phone || '-'}</td>
          <td style="padding: 0.75rem;">${salaryModel}</td>
          <td style="padding: 0.75rem;">${statusBadge}</td>
          <td style="padding: 0.75rem; display: flex; gap: 0.5rem; align-items: center;">
            <a href="tutor-view.html?id=${data.id}" style="color: var(--color-text-secondary);" title="View"><i data-lucide="eye" style="width: 16px; height: 16px;"></i></a>
            <a href="edit-tutor.html?id=${data.id}" style="color: var(--color-text-secondary);" title="Edit"><i data-lucide="edit" style="width: 16px; height: 16px;"></i></a>
            <button class="delete-btn" data-id="${data.id}" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 0;" title="Delete"><i data-lucide="trash-2" style="width: 16px; height: 16px;"></i></button>
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
      const status = currentStatusFilter;

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

    renderTable(allTutors);

    // Delete handlers
    tbody.addEventListener('click', async (e) => {
      const deleteBtn = e.target.closest('.delete-btn');
      if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        if (confirm('Are you sure you want to delete this tutor?')) {
          try {
            await deleteDoc(doc(db, "tutors", id));
            allTutors = allTutors.filter(t => t.id !== id);
            filterData();
          } catch (error) {
            console.error("Error deleting tutor:", error);
            alert("Failed to delete tutor.");
          }
        }
      }
    });

    // Bulk delete logic
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');

    const updateBulkDeleteBtnVisibility = () => {
      const anyChecked = document.querySelectorAll('.row-checkbox:checked').length > 0;
      if (bulkDeleteBtn) bulkDeleteBtn.style.display = anyChecked ? 'flex' : 'none';
    };

    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.row-checkbox');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
        updateBulkDeleteBtnVisibility();
      });
    }

    tbody.addEventListener('change', (e) => {
      if (e.target.classList.contains('row-checkbox')) {
        updateBulkDeleteBtnVisibility();
        if (selectAllCheckbox) {
          const all = document.querySelectorAll('.row-checkbox').length;
          const checked = document.querySelectorAll('.row-checkbox:checked').length;
          selectAllCheckbox.checked = (all === checked && all > 0);
        }
      }
    });

    if (bulkDeleteBtn) {
      bulkDeleteBtn.addEventListener('click', async () => {
        const checkedBoxes = document.querySelectorAll('.row-checkbox:checked');
        if (checkedBoxes.length === 0) return;
        
        if (confirm(`Are you sure you want to delete ${checkedBoxes.length} selected tutors?`)) {
          try {
            for (const cb of checkedBoxes) {
              const id = cb.value;
              await deleteDoc(doc(db, "tutors", id));
              allTutors = allTutors.filter(t => t.id !== id);
            }
            filterData();
            if (selectAllCheckbox) selectAllCheckbox.checked = false;
            updateBulkDeleteBtnVisibility();
          } catch (error) {
            console.error("Error deleting tutors:", error);
            alert("Failed to delete some tutors.");
          }
        }
      });
    }


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
