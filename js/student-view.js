// js/student-view.js
import { db } from './firebase-config.js';
import { doc, getDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
  // Get ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const studentId = urlParams.get('id');

  if (!studentId) {
    document.getElementById('studentNameTitle').textContent = 'Student Not Found';
    return;
  }

  try {
    const docRef = doc(db, "students", studentId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      
      // Update UI
      document.getElementById('studentNameTitle').textContent = data.name || 'Unknown';
      document.getElementById('studentIdTitle').textContent = data.studentId || '-';
      
      // Photo
      if (data.photoUrl) {
        document.getElementById('profileImage').src = data.photoUrl;
      } else {
        document.getElementById('profileImage').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'Student')}&background=random`;
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
      document.getElementById('studentIdVal').textContent = data.studentId || '-';
      document.getElementById('parentVal').textContent = data.parentName || '-';
      document.getElementById('phoneVal').textContent = data.phone || '-';
      document.getElementById('whatsappVal').textContent = data.whatsapp || '-';
      document.getElementById('placeVal').textContent = data.place || '-';
      
      const courseLabel = data.courseType === 'madrasa_one_to_one' ? 'Madrasa One-to-One' : 
                          data.courseType === 'madrasa_group' ? 'Madrasa Group' : 
                          data.courseType === 'quran_one_to_one' ? 'Qur\'an Recitation' : data.courseType;
                          
      document.getElementById('courseTypeVal').textContent = courseLabel;
      document.getElementById('tutorVal').textContent = data.tutorId || '-'; // In reality, fetch tutor name
      document.getElementById('admissionVal').textContent = data.admissionDate || '-';
      
      const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
      document.getElementById('monthlyFeeVal').textContent = formatter.format(data.monthlyFee || 0);

      // Application Status
      const appPaidVal = document.getElementById('appPaidVal');
      const appDateContainer = document.getElementById('appDateContainer');
      const appDateVal = document.getElementById('appDateVal');
      
      if (data.applicationFeePaid) {
        appPaidVal.textContent = 'Yes';
        appPaidVal.style.color = 'var(--color-success)';
        if (data.applicationFeeDate) {
          appDateContainer.style.display = 'block';
          appDateVal.textContent = data.applicationFeeDate;
        }
      } else {
        appPaidVal.textContent = 'No';
        appPaidVal.style.color = 'var(--color-text)';
        appDateContainer.style.display = 'none';
      }

      const statusBadge = data.status === 'active' 
        ? `<span style="background: var(--color-sidebar-active); color: var(--color-success); padding: 0.25rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 500;">Active</span>`
        : `<span style="background: #FEF2F2; color: var(--color-danger); padding: 0.25rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 500;">${data.status}</span>`;
      document.getElementById('statusVal').innerHTML = statusBadge;

      // Edit Button
      document.getElementById('editBtn').addEventListener('click', () => {
        window.location.href = `edit-student.html?id=${studentId}`;
      });

      // Fetch Payment History
      const paymentsQ = query(collection(db, "payments"), where("studentId", "==", studentId));
      const paymentsSnap = await getDocs(paymentsQ);
      const payments = [];
      paymentsSnap.forEach(doc => payments.push({ id: doc.id, ...doc.data() }));
      
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
          const amountDisplay = p.isVacationLeave ? `<span style="color: #4338CA;">Vacation Leave</span>` : formatter.format(p.paidAmount || 0);
          tableHTML += `
            <tr style="border-bottom: 1px solid var(--color-border);">
              <td style="padding: 0.75rem;">${p.paymentDate || '-'}</td>
              <td style="padding: 0.75rem;">${p.billingMonth || '-'}</td>
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
      document.getElementById('studentNameTitle').textContent = 'Student Not Found';
    }
  } catch (error) {
    console.error("Error fetching student:", error);
    document.getElementById('studentNameTitle').textContent = 'Error Loading Student';
  }
});
