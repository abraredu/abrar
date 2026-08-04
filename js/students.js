// js/students.js
import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('studentsTableBody');
  const statTotal = document.getElementById('statTotal');
  const statActive = document.getElementById('statActive');
  const statInactive = document.getElementById('statInactive');
  
  if (!tbody) return;
  
  const auth = getAuth();
  
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        // Pre-fetch classes for level and time
        const classesSnapshot = await getDocs(collection(db, "classes"));
        const classesData = {};
        classesSnapshot.forEach(doc => {
          classesData[doc.id] = doc.data();
        });

        // Pre-fetch tutors for name mapping if needed (optional, currently we store tutorId string but they might be ID keys)
        const tutorsSnapshot = await getDocs(collection(db, "tutors"));
        const tutorsData = {};
        tutorsSnapshot.forEach(doc => {
          tutorsData[doc.id] = doc.data();
        });

        const q = query(collection(db, "students"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        
        let allStudents = [];
        snapshot.forEach((doc) => {
          allStudents.push({ id: doc.id, ...doc.data() });
        });

        const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
        const searchInput = document.getElementById('searchInput');
        const courseFilter = document.getElementById('courseFilter');
        const statusFilter = document.getElementById('statusFilter');

        const renderTable = (students) => {
          let total = 0;
          let active = 0;
          let inactive = 0;
          
          tbody.innerHTML = '';
          
          if (students.length === 0) {
            tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; padding: 2rem;">No students found.</td></tr>';
            statTotal.textContent = 0;
            statActive.textContent = 0;
            statInactive.textContent = 0;
            return;
          }

          students.forEach((data) => {
            total++;
            if (data.status === 'active') active++;
            else inactive++;
            
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #f1f5f9';
            tr.style.transition = 'background-color 0.2s';
            tr.onmouseenter = () => tr.style.backgroundColor = '#f8fafc';
            tr.onmouseleave = () => tr.style.backgroundColor = 'transparent';
            
            // Determine Level and Time based on class
            let levelStr = '-';
            if (data.courseType === 'madrasa_individual') {
               levelStr = data.level ? `One-to-One (Lvl: ${data.level})` : 'One-to-One';
            } else if (data.courseType === 'quran_recitation') {
               levelStr = data.level ? `Qur'an (Lvl: ${data.level})` : 'Qur\'an';
            } else if (data.courseType === 'madrasa_group') {
               levelStr = data.level ? `Group Tuition (${data.level})` : 'Group Tuition';
            }
            let timeStr = '-';
            
            if (data.classId && classesData[data.classId]) {
               const cls = classesData[data.classId];
               levelStr = cls.className || cls.level || 'Group Tuition';
               timeStr = cls.schedule || '-';
            }

            // Resolve Tutor name
            let tutorName = data.tutorId || '-';
            if (data.tutorId && tutorsData[data.tutorId]) {
               tutorName = tutorsData[data.tutorId].name || data.tutorId;
            }

            // Formatter for Contact Details
            let contactHtml = `<div style="font-size:0.875rem;">${data.phone || '-'}</div>`;
            if(data.whatsapp && data.whatsapp !== data.phone) {
               contactHtml += `<div style="font-size:0.75rem; color:#64748b;">WA: ${data.whatsapp}</div>`;
            }

            tr.innerHTML = `
              <td style="padding: 1rem 1.5rem; color: #475569; font-weight: 500;">${data.studentId || '-'}</td>
              <td style="padding: 1rem 1.5rem; font-weight: 500; color: #0f172a;">${data.name || '-'}</td>
              <td style="padding: 1rem 1.5rem; color: #475569;">${data.parentName || '-'}</td>
              <td style="padding: 1rem 1.5rem; color: #475569;">${data.place || '-'}</td>
              <td style="padding: 1rem 1.5rem; color: #475569;">${contactHtml}</td>
              <td style="padding: 1rem 1.5rem; color: #475569;">${levelStr}</td>
              <td style="padding: 1rem 1.5rem; color: #475569;">${timeStr}</td>
              <td style="padding: 1rem 1.5rem; color: #475569;">${tutorName}</td>
              <td style="padding: 1rem 1.5rem; color: #475569;">${data.admissionDate || '-'}</td>
              <td style="padding: 1rem 1.5rem; color: #475569;">${data.classStartingDate || '-'}</td>
              <td style="padding: 1rem 1.5rem; color: #475569; font-weight: 500;">${data.monthlyFee ? formatter.format(data.monthlyFee) : '-'}</td>
              <td style="padding: 1rem 1.5rem;">
                <a href="student-view.html?id=${data.id}" style="color: #64748b; margin-right: 0.5rem;" title="View"><i data-lucide="eye" style="width: 18px; height: 18px;"></i></a>
                <a href="edit-student.html?id=${data.id}" style="color: #64748b;" title="Edit"><i data-lucide="edit" style="width: 18px; height: 18px;"></i></a>
              </td>
            `;
            tbody.appendChild(tr);
          });
          
          statTotal.textContent = total;
          statActive.textContent = active;
          statInactive.textContent = inactive;
          lucide.createIcons();
        };

        const filterData = () => {
          const searchTerm = (searchInput ? searchInput.value : '').toLowerCase();
          const course = courseFilter ? courseFilter.value : '';
          const status = statusFilter ? statusFilter.value : '';

          const filtered = allStudents.filter(student => {
            const matchesSearch = !searchTerm || 
              (student.name && student.name.toLowerCase().includes(searchTerm)) || 
              (student.studentId && student.studentId.toLowerCase().includes(searchTerm)) || 
              (student.phone && student.phone.toLowerCase().includes(searchTerm));
            
            const matchesCourse = !course || student.courseType === course;
            const matchesStatus = !status || student.status === status;

            return matchesSearch && matchesCourse && matchesStatus;
          });

          renderTable(filtered);
        };

        if (searchInput) searchInput.addEventListener('input', filterData);
        if (courseFilter) courseFilter.addEventListener('change', filterData);
        if (statusFilter) statusFilter.addEventListener('change', filterData);

        renderTable(allStudents);
        
      } catch (error) {
        console.error("Error fetching students: ", error);
        tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 2rem; color: #ef4444;">Error loading students: ${error.message}</td></tr>`;
      }
    }
  });
});
