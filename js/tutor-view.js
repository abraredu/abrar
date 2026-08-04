// js/tutor-view.js
import { db, auth } from './firebase-config.js';
import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const tutorId = urlParams.get('id');

  if (!tutorId) {
    document.getElementById('tutorNameTitle').textContent = 'Tutor Not Found';
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    if (user) {
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
          <button id="downloadIdBtn" class="btn btn-outline" style="font-size: 0.75rem; padding: 0.25rem 0.5rem; display: inline-flex; align-items: center; gap: 0.25rem;">
            <i data-lucide="download" style="width: 14px; height: 14px;"></i> Download ID Document
          </button>
        `;
        // Delay adding event listener until DOM updates
        setTimeout(() => {
          document.getElementById('downloadIdBtn').addEventListener('click', async (e) => {
            e.preventDefault();
            const btn = e.currentTarget;
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i data-lucide="loader" class="animate-spin" style="width: 14px; height: 14px;"></i> Downloading...';
            lucide.createIcons();
            
            try {
              const { downloadFile } = await import('./download-helper.js');
              await downloadFile(data.idDocumentUrl, `${data.name || 'Tutor'}_ID`);
            } catch (err) {
              console.error("Failed to load download helper:", err);
            } finally {
              btn.innerHTML = originalHTML;
              lucide.createIcons();
            }
          });
        }, 0);
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

      // Fetch Assigned Students
      const allStudentsSnap = await getDocs(collection(db, "students"));
      const assignedStudents = [];
      allStudentsSnap.forEach(docSnap => {
        const student = docSnap.data();
        const sTutorId = student.tutorId || '';
        if (sTutorId.includes(tutorId) || 
            sTutorId.includes(data.tutorId) || 
            (data.name && sTutorId.toLowerCase().includes(data.name.toLowerCase()))) {
          assignedStudents.push(student);
        }
      });
      
      const assignedContainer = document.getElementById('assignedStudentsContainer');
      if (assignedContainer) {
        if (assignedStudents.length > 0) {
          let html = '<ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem;">';
          assignedStudents.forEach(s => {
            html += `
              <li style="display: flex; justify-content: space-between; padding: 0.75rem; border: 1px solid var(--color-border); border-radius: 6px;">
                <div>
                  <div style="font-weight: 500;">${s.name}</div>
                  <div style="font-size: 0.75rem; color: var(--color-text-secondary);">${s.courseType || ''}</div>
                </div>
                <div style="font-size: 0.75rem; color: var(--color-text-secondary);">${s.studentId || ''}</div>
              </li>`;
          });
          html += '</ul>';
          assignedContainer.innerHTML = html;
        } else {
          assignedContainer.innerHTML = '<p class="text-muted" style="font-size: 0.875rem;">No students assigned yet.</p>';
        }
      }

    } else {
      document.getElementById('tutorNameTitle').textContent = 'Tutor Not Found';
    }
    } catch (error) {
      console.error("Error fetching tutor:", error);
      document.getElementById('tutorNameTitle').textContent = 'Error Loading Tutor';
    }
    } else {
      // Not logged in
    }
  });
});
