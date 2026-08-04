import { toast } from './toast.js';
import { db, auth } from './firebase-config.js';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
  if (!localStorage.getItem('tutorLoggedIn')) {
    window.location.href = '../index.html';
    return;
  }

  const tutorId = localStorage.getItem('tutorId');
  const tutorName = localStorage.getItem('tutorName');

  const selectionContainer = document.getElementById('selectionContainer');
  const reportContainer = document.getElementById('reportContainer');
  const tableBody = document.getElementById('tutorStudentsTableBody');
  const monthSelect = document.getElementById('reportMonthSelect');
  const backBtn = document.getElementById('backToTableBtn');
  const progressForm = document.getElementById('progressForm');

  // Set default month to current month
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  monthSelect.value = currentMonth;

  let myStudents = [];
  let realTutorDocId = tutorId;

  let currentReports = {};
  let editingReportId = null;

  const loadTableData = async () => {
    tableBody.innerHTML = '<tr><td colspan="3" style="padding: 2rem; text-align: center; color: var(--color-text-secondary);">Loading...</td></tr>';

    if (myStudents.length === 0) {
      try {
        let tutorRef = doc(db, "tutors", tutorId);
        let tutorSnap = await getDoc(tutorRef);
        if (!tutorSnap.exists()) {
          const fallbackQ = query(collection(db, "tutors"), where("tutorId", "==", tutorId));
          const fallbackSnap = await getDocs(fallbackQ);
          if (!fallbackSnap.empty) {
            realTutorDocId = fallbackSnap.docs[0].id;
          }
        }

        const studentsQ = query(collection(db, "students"), where("tutorId", "==", realTutorDocId));
        const studentsSnap = await getDocs(studentsQ);
        studentsSnap.forEach(docSnap => {
          const student = docSnap.data();
          if (student.status === 'active') {
            myStudents.push({ id: docSnap.id, ...student });
          }
        });
      } catch (error) {
        console.error("Error fetching students:", error);
        toast.error("Failed to load students.");
        tableBody.innerHTML = '<tr><td colspan="3" style="padding: 2rem; text-align: center; color: #ef4444;">Error loading students. Please refresh the page.</td></tr>';
        return;
      }
    }

    if (myStudents.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="3" style="padding: 2rem; text-align: center; color: var(--color-text-secondary);">No active students found.</td></tr>';
      return;
    }

    const selectedMonth = monthSelect.value;
    currentReports = {};

    try {
      const reportsQ = query(collection(db, "progress_reports"),
        where("tutorId", "==", realTutorDocId || tutorId),
        where("reportMonth", "==", selectedMonth)
      );
      const reportsSnap = await getDocs(reportsQ);
      reportsSnap.forEach(docSnap => {
        const rep = docSnap.data();
        currentReports[rep.studentId] = { id: docSnap.id, ...rep };
      });
    } catch (error) {
      console.error("Error fetching reports", error);
      toast.error("Failed to fetch reports. Please check your connection.");
    }

    let html = '';
    myStudents.forEach(student => {
      const report = currentReports[student.id];
      let actionHtml = '';
      if (report) {
        actionHtml = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="color: #10b981; font-weight: 500; font-size: 0.85rem; background: #d1fae5; padding: 0.2rem 0.5rem; border-radius: 4px;">Submitted</span>
            <button type="button" class="btn btn-icon btn-edit" data-id="${student.id}" data-name="${student.name}" title="Edit Report" style="padding: 0.3rem; cursor: pointer; border: none; background: transparent; color: var(--color-primary); display: flex; align-items: center; justify-content: center;">
              <i data-lucide="edit" style="width: 18px; height: 18px;"></i>
            </button>
            <button type="button" class="btn btn-icon btn-delete" data-report-id="${report.id}" title="Delete Report" style="padding: 0.3rem; cursor: pointer; border: none; background: transparent; color: #ef4444; display: flex; align-items: center; justify-content: center;">
              <i data-lucide="trash-2" style="width: 18px; height: 18px;"></i>
            </button>
          </div>
        `;
      } else {
        actionHtml = `
          <button class="btn btn-primary btn-register" data-id="${student.id}" data-name="${student.name}" style="padding: 0.35rem 0.75rem; font-size: 0.75rem;">
            Register Report
          </button>
        `;
      }

      html += `
        <tr style="border-bottom: 1px solid var(--color-border);">
          <td style="padding: 1rem; font-weight: 500;">${student.name}</td>
          <td style="padding: 1rem; color: var(--color-text-secondary);">${student.studentId || student.regNo || '-'}</td>
          <td style="padding: 1rem;">
            ${actionHtml}
          </td>
        </tr>
      `;
    });
    tableBody.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  };

  await loadTableData();

  monthSelect.addEventListener('change', async () => {
    await loadTableData();
  });

  // Handle Register, Edit and Delete click
  tableBody.addEventListener('click', async (e) => {
    const btnDelete = e.target.closest('.btn-delete');
    if (btnDelete) {
      const reportId = btnDelete.getAttribute('data-report-id');
      if (confirm("Are you sure you want to delete this report?")) {
        try {
          await deleteDoc(doc(db, "progress_reports", reportId));
          toast.success("Report deleted successfully!");
          await loadTableData();
        } catch (error) {
          console.error("Error deleting report:", error);
          toast.error("Failed to delete report.");
        }
      }
      return;
    }

    const btnReg = e.target.closest('.btn-register');
    const btnEdit = e.target.closest('.btn-edit');

    if (btnReg || btnEdit) {
      const btn = btnReg || btnEdit;
      const studentId = btn.getAttribute('data-id');
      const studentName = btn.getAttribute('data-name');
      const selectedMonth = monthSelect.value;

      if (!selectedMonth) {
        toast.error("Please select a month first!");
        return;
      }

      progressForm.reset();

      document.getElementById('studentIdHidden').value = studentId;
      document.getElementById('studentName').value = studentName;
      document.getElementById('reportMonth').value = selectedMonth;

      if (btnEdit) {
        const report = currentReports[studentId];
        if (report) {
          editingReportId = report.id;
          document.getElementById('classesConducted').value = report.attendance?.conducted || '';
          document.getElementById('classesAttended').value = report.attendance?.attended || '';
          const setRadio = (name, val) => {
            if (!val) return;
            const r = document.querySelector(`input[name="${name}"][value="${val}"]`);
            if (r) r.checked = true;
          };
          setRadio('liveClassPerf', report.ratings?.liveClassPerformance);
          setRadio('lessonProgress', report.ratings?.lessonProgress);
          setRadio('revisionHomework', report.ratings?.revisionHomework);
          setRadio('classActivities', report.ratings?.classActivities);
          document.getElementById('topicsCovered').value = report.remarks?.topicsCovered || '';
          document.getElementById('mentorRemarks').value = report.remarks?.mentorRemarks || '';
          document.getElementById('recommendations').value = report.remarks?.recommendations || '';
        }
      } else {
        editingReportId = null;
      }

      selectionContainer.style.display = 'none';
      reportContainer.style.display = 'block';
    }
  });

  // Handle Back
  backBtn.addEventListener('click', () => {
    reportContainer.style.display = 'none';
    selectionContainer.style.display = 'block';
  });

  // Also check if we came from dashboard with a pre-filled student
  const urlParams = new URLSearchParams(window.location.search);
  const studentParam = urlParams.get('student');
  if (studentParam && myStudents.length > 0) {
    // If they clicked 'Report Due' from dashboard, we might want to automatically open the form.
    // For now, they can just use the table, or we can auto-trigger it.
    // Let's keep it simple: the table is easy enough.
  }

  // Handle Form Submit
  progressForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('saveBtn');
    submitBtn.innerHTML = '<i data-lucide="loader" class="animate-spin"></i> Saving...';
    submitBtn.disabled = true;

    try {
      const reportData = {
        studentId: document.getElementById('studentIdHidden').value,
        studentName: document.getElementById('studentName').value,
        reportMonth: document.getElementById('reportMonth').value,
        tutorId: realTutorDocId || tutorId,
        tutorName: tutorName,
        updatedAt: serverTimestamp(),

        attendance: {
          conducted: parseInt(document.getElementById('classesConducted').value),
          attended: parseInt(document.getElementById('classesAttended').value)
        },
        ratings: {
          liveClassPerformance: document.querySelector('input[name="liveClassPerf"]:checked')?.value || '',
          lessonProgress: document.querySelector('input[name="lessonProgress"]:checked')?.value || '',
          revisionHomework: document.querySelector('input[name="revisionHomework"]:checked')?.value || '',
          classActivities: document.querySelector('input[name="classActivities"]:checked')?.value || ''
        },
        remarks: {
          topicsCovered: document.getElementById('topicsCovered').value,
          mentorRemarks: document.getElementById('mentorRemarks').value,
          recommendations: document.getElementById('recommendations').value
        }
      };

      if (editingReportId) {
        await updateDoc(doc(db, "progress_reports", editingReportId), reportData);
        toast.success("Progress Report updated successfully!");
      } else {
        reportData.createdAt = serverTimestamp();
        await addDoc(collection(db, "progress_reports"), reportData);
        toast.success("Progress Report saved successfully!");
      }

      reportContainer.style.display = 'none';
      selectionContainer.style.display = 'block';
      submitBtn.innerHTML = '<i data-lucide="save"></i> Submit & Save Report';
      submitBtn.disabled = false;
      progressForm.reset();
      await loadTableData();

    } catch (error) {
      console.error("Error saving report:", error);
      toast.error("Failed to save report. Try again.");
      submitBtn.innerHTML = '<i data-lucide="save"></i> Submit & Save Report';
      submitBtn.disabled = false;
    }
  });
});
