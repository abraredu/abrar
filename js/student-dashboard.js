import { db } from './firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
  // Check if logged in
  const studentId = sessionStorage.getItem('currentStudentId');
  if (!studentId) {
    window.location.href = 'student-login.html';
    return;
  }

  // Handle Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('currentStudentId');
      window.location.href = 'student-login.html';
    });
  }

  try {
    const docRef = doc(db, "students", studentId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();

      // Guard: Admission must be accepted to access the portal
      const admissionStatus = (data.admissionStatus || '').toLowerCase();
      const hasAdmissionDate = data.admissionDate && data.admissionDate.trim() !== '' && data.admissionDate !== '-';
      const isAccepted = admissionStatus === 'accepted' || (!data.admissionStatus && hasAdmissionDate);

      if (!isAccepted) {
        alert("Access Denied: Your admission has not been accepted yet. You can only enter the portal once approved by administration.");
        sessionStorage.removeItem('currentStudentId');
        window.location.href = 'student-login.html';
        return;
      }

      if (data.status === 'inactive' || data.status === 'suspended') {
        alert("Your account is currently inactive. Please contact administration.");
        sessionStorage.removeItem('currentStudentId');
        window.location.href = 'student-login.html';
        return;
      }

      // Update UI Header
      document.getElementById('headerName').textContent = data.name || 'Student';
      if (data.photoUrl) {
        document.getElementById('headerAvatar').src = data.photoUrl;
      } else {
        document.getElementById('headerAvatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'Student')}&background=random`;
      }

      // Update Dashboard Stats
      document.getElementById('dashAbrarId').textContent = data.studentId || '-';

      const courseLabel = data.courseType === 'madrasa_individual' ? 'Madrasa One-to-One' :
        data.courseType === 'madrasa_group' ? 'Madrasa Group' :
          data.courseType === 'quran_one_to_one' ? 'Qur\'an Recitation' : (data.courseType || '-');
      document.getElementById('dashCourse').textContent = courseLabel;

      const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
      document.getElementById('dashFee').textContent = formatter.format(data.monthlyFee || 0);

      const statusBadge = data.status === 'active'
        ? `<span style="background: var(--color-sidebar-active); color: var(--color-success); padding: 0.25rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 500;">Active</span>`
        : `<span style="background: #FEF2F2; color: var(--color-danger); padding: 0.25rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 500;">${data.status}</span>`;
      document.getElementById('dashStatus').innerHTML = statusBadge;

      // Update Details
      document.getElementById('detailName').textContent = data.name || '-';
      document.getElementById('detailParent').textContent = data.parentName || '-';
      document.getElementById('detailPhone').textContent = data.phone || '-';
      document.getElementById('detailWhatsapp').textContent = data.whatsapp || '-';
      document.getElementById('detailAdmission').textContent = data.admissionDate || '-';
      document.getElementById('detailPlace').textContent = data.place || '-';

      // Fetch Payment History
      const paymentsQ = query(collection(db, "payments"), where("studentId", "==", studentId));
      const paymentsSnap = await getDocs(paymentsQ);
      const payments = [];
      paymentsSnap.forEach(pDoc => payments.push({ id: pDoc.id, ...pDoc.data() }));

      const historyContainer = document.getElementById('paymentHistoryContainer');
      if (payments.length === 0) {
        historyContainer.innerHTML = '<p class="text-muted" style="font-size: 0.875rem;">No payment records found.</p>';
      } else {
        payments.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

        let tableHTML = `
          <table class="data-table" style="width: 100%; text-align: left; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 1px solid var(--color-border); color: var(--color-text-secondary); font-size: 0.75rem; text-transform: uppercase;">
                <th style="padding: 0.75rem;">Date</th>
                <th style="padding: 0.75rem;">Month</th>
                <th style="padding: 0.75rem;">Amount</th>
                <th style="padding: 0.75rem;">Method</th>
                <th style="padding: 0.75rem;">Receipt</th>
              </tr>
            </thead>
            <tbody>
        `;
        payments.forEach(p => {
          const amountDisplay = formatter.format(p.paidAmount || 0);
          tableHTML += `
            <tr style="border-bottom: 1px solid var(--color-border);">
              <td style="padding: 0.75rem;">${p.paymentDate || '-'}</td>
              <td style="padding: 0.75rem;">${p.billingMonth ? new Date(p.billingMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' }) : '-'}</td>
              <td style="padding: 0.75rem; font-weight: 500;">${amountDisplay}</td>
              <td style="padding: 0.75rem;">${p.paymentMethod || '-'}</td>
              <td style="padding: 0.75rem; color: var(--color-text-secondary); font-size: 0.875rem;">${p.receiptNumber || '-'}</td>
            </tr>
          `;
        });
        tableHTML += `</tbody></table>`;
        historyContainer.innerHTML = tableHTML;
      }
    } else {
      document.getElementById('headerName').textContent = 'Student Not Found';
      document.getElementById('paymentHistoryContainer').innerHTML = '<p class="text-danger" style="font-size: 0.875rem;">Error: Student data not found.</p>';
    }
  } catch (error) {
    console.error("Error fetching student data:", error);
    document.getElementById('paymentHistoryContainer').innerHTML = '<p class="text-danger" style="font-size: 0.875rem;">Error loading data.</p>';
  }

  lucide.createIcons();
});
