// js/students.js
import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy, limit, deleteDoc, doc, where, writeBatch, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

        const isStudentActive = (s) => String(s.status || '').trim().toLowerCase() === 'active';

        const updateStats = () => {
          let active = 0;
          let inactive = 0;
          allStudents.forEach(s => {
            if (isStudentActive(s)) active++;
            else inactive++;
          });
          statTotal.textContent = allStudents.length;
          statActive.textContent = active;
          statInactive.textContent = inactive;
        };

        const renderTable = (students) => {
          updateStats();
          tbody.innerHTML = '';
          
          if (students.length === 0) {
            tbody.innerHTML = '<tr><td colspan="13" style="text-align: center; padding: 2rem;">No students found.</td></tr>';
            return;
          }

          students.forEach((data) => {
            
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
              <td style="padding: 1rem 1.5rem;"><input type="checkbox" class="row-checkbox" value="${data.id}"></td>
              <td style="padding: 1rem 1.5rem; color: #475569; font-weight: 500;">${data.studentId || '-'}</td>
              <td style="padding: 1rem 1.5rem; font-weight: 500; color: #0f172a;">${data.name ? String(data.name).toUpperCase() : '-'}</td>
              <td style="padding: 1rem 1.5rem; color: #475569;">${data.parentName || '-'}</td>
              <td style="padding: 1rem 1.5rem; color: #475569;">${data.place || '-'}</td>
              <td style="padding: 1rem 1.5rem; color: #475569;">${contactHtml}</td>
              <td style="padding: 1rem 1.5rem; color: #475569;">${levelStr}</td>
              <td style="padding: 1rem 1.5rem; color: #475569;">${timeStr}</td>
              <td style="padding: 1rem 1.5rem; color: #475569;">${tutorName}</td>
              <td style="padding: 1rem 1.5rem; color: #475569;">${data.admissionDate || '-'}</td>
              <td style="padding: 1rem 1.5rem; color: #475569;">${data.classStartingDate || '-'}</td>
              <td style="padding: 1rem 1.5rem; color: #475569; font-weight: 500;">${data.monthlyFee ? formatter.format(data.monthlyFee) : '-'}</td>
              <td style="padding: 1rem 1.5rem; display: flex; gap: 0.5rem; align-items: center;">
                <a href="student-view.html?id=${data.id}" style="color: #64748b;" title="View"><i data-lucide="eye" style="width: 18px; height: 18px;"></i></a>
                <a href="edit-student.html?id=${data.id}" style="color: #64748b;" title="Edit"><i data-lucide="edit" style="width: 18px; height: 18px;"></i></a>
                <button class="delete-btn" data-id="${data.id}" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 0;" title="Delete"><i data-lucide="trash-2" style="width: 18px; height: 18px;"></i></button>
              </td>
            `;
            tbody.appendChild(tr);
          });
          
          lucide.createIcons();
        };

        const filterData = () => {
          const searchTerm = (searchInput ? searchInput.value : '').toLowerCase();
          const course = courseFilter ? courseFilter.value : '';
          const status = currentStatusFilter;

          const filtered = allStudents.filter(student => {
            const matchesSearch = !searchTerm || 
              (student.name && student.name.toLowerCase().includes(searchTerm)) || 
              (student.studentId && student.studentId.toLowerCase().includes(searchTerm)) || 
              (student.phone && student.phone.toLowerCase().includes(searchTerm));
            
            const matchesCourse = !course || student.courseType === course;
            const matchesStatus = !status || (status === 'inactive' ? !isStudentActive(student) : isStudentActive(student));

            return matchesSearch && matchesCourse && matchesStatus;
          });

          renderTable(filtered);
        };

        if (searchInput) searchInput.addEventListener('input', filterData);
        if (courseFilter) courseFilter.addEventListener('change', filterData);

        renderTable(allStudents);

        // Delete handlers
        tbody.addEventListener('click', async (e) => {
          const deleteBtn = e.target.closest('.delete-btn');
          if (deleteBtn) {
            const id = deleteBtn.getAttribute('data-id');
            if (confirm('Are you sure you want to delete this student and all related data (reports, payments)?')) {
              try {
                const deleteRelated = async (colName) => {
                  const q = query(collection(db, colName), where("studentId", "==", id));
                  const snap = await getDocs(q);
                  const deletePromises = [];
                  snap.forEach(docSnap => {
                    deletePromises.push(deleteDoc(doc(db, colName, docSnap.id)));
                  });
                  await Promise.all(deletePromises);
                };
                await Promise.all([
                  deleteRelated("progress_reports"),
                  deleteRelated("payments"),
                  deleteRelated("transactions")
                ]);

                await deleteDoc(doc(db, "students", id));
                allStudents = allStudents.filter(s => s.id !== id);
                filterData();
              } catch (error) {
                console.error("Error deleting student:", error);
                alert("Failed to delete student.");
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
            
            if (confirm(`Are you sure you want to delete ${checkedBoxes.length} selected students and all their related data?`)) {
              try {
                for (const cb of checkedBoxes) {
                  const id = cb.value;
                  const deleteRelated = async (colName) => {
                    const q = query(collection(db, colName), where("studentId", "==", id));
                    const snap = await getDocs(q);
                    const deletePromises = [];
                    snap.forEach(docSnap => {
                      deletePromises.push(deleteDoc(doc(db, colName, docSnap.id)));
                    });
                    await Promise.all(deletePromises);
                  };
                  await Promise.all([
                    deleteRelated("progress_reports"),
                    deleteRelated("payments"),
                    deleteRelated("transactions")
                  ]);

                  await deleteDoc(doc(db, "students", id));
                  allStudents = allStudents.filter(s => s.id !== id);
                }
                filterData();
                if (selectAllCheckbox) selectAllCheckbox.checked = false;
                updateBulkDeleteBtnVisibility();
              } catch (error) {
                console.error("Error deleting students:", error);
                alert("Failed to delete some students.");
              }
            }
          });
        }

        // Renumber all student IDs sequentially starting from 001 per course code prefix
        const renumberIdsBtn = document.getElementById('renumberIdsBtn');
        if (renumberIdsBtn) {
          renumberIdsBtn.addEventListener('click', async () => {
            const origHtml = renumberIdsBtn.innerHTML;
            renumberIdsBtn.disabled = true;
            renumberIdsBtn.textContent = 'Preparing...';

            try {
              const coursesSnap = await getDocs(collection(db, "managed_courses"));
              const managedCourses = [];
              coursesSnap.forEach(cDoc => managedCourses.push({ id: cDoc.id, ...cDoc.data() }));

              const normalizeCourseKey = (val) => {
                const norm = String(val || '')
                  .trim()
                  .toLowerCase()
                  .replace(/[_-]+/g, ' ')
                  .replace(/\bmadrass+a\b/g, 'madrasa')
                  .replace(/\bshool\b/g, 'school')
                  .replace(/\s+/g, ' ');
                if (norm === 'madrasa individual') return 'madrasa one to one';
                if (norm === 'quran recitation') return 'tarteel';
                return norm;
              };

              const resolvePrefix = (student) => {
                const sCourse = normalizeCourseKey(student.course);
                const sCourseType = normalizeCourseKey(student.courseType);
                const matched = managedCourses.find(c => {
                  const cName = normalizeCourseKey(c.courseName);
                  const cSerial = normalizeCourseKey(c.serialNo);
                  return (sCourse && (sCourse === cName || sCourse === cSerial)) ||
                         (sCourseType && (sCourseType === cName || sCourseType === cSerial)) ||
                         student.courseId === c.id;
                });
                if (matched && matched.serialNo) {
                  const p = String(matched.serialNo).replace(/\d+$/, '').toUpperCase();
                  if (p) return p;
                }
                const ct = String(student.courseType || student.course || '').toLowerCase();
                if (ct.includes('madrasa_individual') || ct.includes('one-to-one') || ct.includes('one to one')) return 'AMO';
                if (ct.includes('madrasa_group') || ct.includes('madrass_group') || ct.includes('madrassa group')) return 'AMG';
                if (ct.includes('quran') || ct.includes('tarteel')) return 'AT';
                const existingPrefix = String(student.studentId || '').replace(/\d+$/, '').toUpperCase();
                return existingPrefix || 'STU';
              };

              const groups = {};
              allStudents.forEach(s => {
                const p = resolvePrefix(s);
                if (!groups[p]) groups[p] = [];
                groups[p].push(s);
              });

              const extractNum = (idStr) => {
                const m = String(idStr || '').match(/(\d+)$/);
                return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
              };

              const updates = [];
              const newCounters = {};
              const summaryLines = [];

              Object.keys(groups).sort().forEach(prefix => {
                const list = groups[prefix];
                list.sort((a, b) => {
                  const nA = extractNum(a.studentId);
                  const nB = extractNum(b.studentId);
                  if (nA !== nB) return nA - nB;
                  const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                  const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                  return tA - tB;
                });

                list.forEach((student, idx) => {
                  const newId = `${prefix}${String(idx + 1).padStart(3, '0')}`;
                  if (student.studentId !== newId) {
                    updates.push({ docId: student.id, newId, student });
                  }
                });
                newCounters[prefix] = list.length;
                summaryLines.push(`${prefix}: ${list.length} student(s) → ${prefix}001 to ${prefix}${String(list.length).padStart(3, '0')}`);
              });

              if (updates.length === 0) {
                alert('All student IDs are already sequentially numbered from 001!');
                return;
              }

              const msg = `Renumber ${updates.length} student ID(s) sequentially from 001?\n\n${summaryLines.join('\n')}`;
              if (!confirm(msg)) return;

              renumberIdsBtn.textContent = 'Renumbering...';

              for (let i = 0; i < updates.length; i += 450) {
                const batch = writeBatch(db);
                updates.slice(i, i + 450).forEach(u => {
                  batch.update(doc(db, "students", u.docId), { studentId: u.newId });
                  u.student.studentId = u.newId;
                });
                await batch.commit();
              }

              await setDoc(doc(db, "counters", "students"), newCounters, { merge: true });

              filterData();
              alert(`Successfully renumbered ${updates.length} student ID(s)!`);
            } catch (err) {
              console.error("Error renumbering student IDs:", err);
              alert("Failed to renumber IDs: " + err.message);
            } finally {
              renumberIdsBtn.disabled = false;
              renumberIdsBtn.innerHTML = origHtml;
              if (window.lucide) lucide.createIcons();
            }
          });
        }

      } catch (error) {
        console.error("Error fetching students: ", error);
        tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 2rem; color: #ef4444;">Error loading students: ${error.message}</td></tr>`;
      }
    }
  });
});
