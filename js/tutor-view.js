// js/tutor-view.js
import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const tutorId = urlParams.get('id');

  if (!tutorId) {
    document.getElementById('tutorNameTitle').textContent = 'Tutor Not Found';
    return;
  }

  try {
    const docRef = doc(db, "tutors", tutorId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      
      document.getElementById('tutorNameTitle').textContent = data.name || 'Unknown';
      document.getElementById('tutorIdTitle').textContent = data.tutorId || '-';
      
      // Photo
      if (data.photoUrl) {
        document.getElementById('profileImage').src = data.photoUrl;
      } else {
        document.getElementById('profileImage').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'Tutor')}&background=random`;
      }
      
      // Documents
      const docsContainer = document.getElementById('documentsContainer');
      if (data.idDocumentUrl) {
        docsContainer.innerHTML = `
          <a href="${data.idDocumentUrl}" target="_blank" class="btn btn-outline" style="font-size: 0.75rem; padding: 0.25rem 0.5rem; display: inline-flex; align-items: center; gap: 0.25rem;">
            <i data-lucide="file-text" style="width: 14px; height: 14px;"></i> View ID Document
          </a>
        `;
      }
      document.getElementById('tutorIdVal').textContent = data.tutorId || '-';
      document.getElementById('phoneVal').textContent = data.phone || '-';
      document.getElementById('whatsappVal').textContent = data.whatsapp || '-';
      document.getElementById('emailVal').textContent = data.email || '-';
      document.getElementById('addressVal').textContent = data.address || '-';
      
      let typeLabel = '-';
      if (data.tutorType) {
        const types = Array.isArray(data.tutorType) ? data.tutorType : [data.tutorType];
        typeLabel = types.map(t => {
          return t === 'madrasa_individual' ? 'Madrasa Individual' : 
                 t === 'madrasa_group' ? 'Madrasa Group' : 
                 t === 'quran_recitation' ? 'Qur\'an Recitation' : t;
        }).join(', ');
      }
                          
      document.getElementById('tutorTypeVal').textContent = typeLabel;
      document.getElementById('joiningVal').textContent = data.joiningDate || '-';
      
      const salaryModel = data.salaryType === 'per_class' ? 'Per Class' :
                          data.salaryType === 'per_student' ? 'Per Student' :
                          data.salaryType === 'fixed_monthly' ? 'Fixed Monthly' : data.salaryType;

      document.getElementById('salaryTypeVal').textContent = salaryModel;
      
      const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
      document.getElementById('salaryRateVal').textContent = formatter.format(data.salaryRate || 0);

      const statusBadge = data.status === 'active' 
        ? `<span style="background: var(--color-sidebar-active); color: var(--color-success); padding: 0.25rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 500;">Active</span>`
        : `<span style="background: #FEF2F2; color: var(--color-danger); padding: 0.25rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 500;">${data.status}</span>`;
      document.getElementById('statusVal').innerHTML = statusBadge;
      
      // Update Edit Link
      document.getElementById('editBtn').onclick = () => {
        window.location.href = `edit-tutor.html?id=${tutorId}`;
      };

    } else {
      document.getElementById('tutorNameTitle').textContent = 'Tutor Not Found';
    }
  } catch (error) {
    console.error("Error fetching tutor:", error);
    document.getElementById('tutorNameTitle').textContent = 'Error Loading Tutor';
  }
});
