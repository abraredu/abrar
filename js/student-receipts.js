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
    let studentData = {};

    if (docSnap.exists()) {
      studentData = docSnap.data();
      // Update UI Header
      document.getElementById('headerName').textContent = studentData.name || 'Student';
      if (studentData.photoUrl) {
        document.getElementById('headerAvatar').src = studentData.photoUrl;
      } else {
        document.getElementById('headerAvatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(studentData.name || 'Student')}&background=random`;
      }
    } else {
      document.getElementById('receiptsContainer').innerHTML = '<p class="text-danger">Error: Student data not found.</p>';
      return;
    }

    // Helper to convert numbers to words
    function numberToWords(num) {
      if (!num || num === 0) return 'ZERO';
      const a = ['','ONE ','TWO ','THREE ','FOUR ', 'FIVE ','SIX ','SEVEN ','EIGHT ','NINE ','TEN ','ELEVEN ','TWELVE ','THIRTEEN ','FOURTEEN ','FIFTEEN ','SIXTEEN ','SEVENTEEN ','EIGHTEEN ','NINETEEN '];
      const b = ['', '', 'TWENTY','THIRTY','FORTY','FIFTY', 'SIXTY','SEVENTY','EIGHTY','NINETY'];
      if ((num = num.toString()).length > 9) return 'OVERFLOW';
      let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
      if (!n) return; let str = '';
      str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'CRORE ' : '';
      str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'LAKH ' : '';
      str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'THOUSAND ' : '';
      str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'HUNDRED ' : '';
      str += (n[5] != 0) ? ((str != '') ? 'AND ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
      return str.trim();
    }

    // Fetch Payment History
    const paymentsQ = query(collection(db, "payments"), where("studentId", "==", studentId));
    const paymentsSnap = await getDocs(paymentsQ);
    const payments = [];
    paymentsSnap.forEach(pDoc => payments.push({ id: pDoc.id, ...pDoc.data() }));
    
    const container = document.getElementById('receiptsContainer');
    if (payments.length === 0) {
      container.innerHTML = '<p class="text-muted" style="padding: 1rem;">No payment records found.</p>';
    } else {
      // Sort newest first
      payments.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
      container.innerHTML = '';
      
      const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

      payments.forEach(p => {
        const amountDisplay = formatter.format(p.paidAmount || 0);
        const wordsAmount = numberToWords(p.paidAmount || 0);
        
        const receiptCard = document.createElement('div');
        receiptCard.className = 'receipt-card';
        receiptCard.id = `receipt-${p.id}`;
        receiptCard.innerHTML = `
          <!-- Top Header Section -->
          <div style="background-color: var(--color-primary); color: white; padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <img src="logo.png" alt="Abrar" style="height: 40px; background: white; padding: 0.25rem; border-radius: 6px;"> 
              <div>
                <h1 style="margin: 0; font-size: 1.75rem; font-weight: bold; line-height: 1;">Abrar</h1>
                <span style="font-size: 0.65rem; letter-spacing: 0.05em;">Online Islamic School</span>
              </div>
            </div>
            <div style="font-size: 0.75rem; line-height: 1.4; text-align: right;">
              <div><i data-lucide="phone" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-right: 0.25rem;"></i> 7907 517 463</div>
              <div><i data-lucide="hash" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-right: 0.25rem;"></i> abraredu</div>
              <div><i data-lucide="mail" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-right: 0.25rem;"></i> abrareduu@gmail.com</div>
            </div>
          </div>

          <!-- Body Section -->
          <div style="padding: 1.5rem 1.5rem;">
            <div style="text-align: center; margin-bottom: 1.5rem;">
              <span style="color: var(--color-success); font-size: 1rem; letter-spacing: 0.1em; font-weight: bold; text-decoration: underline; text-decoration-style: solid; text-underline-offset: 4px;">RECEIPT</span>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 1.5rem; font-weight: 600; font-size: 0.9rem;">
              <div>No. <span style="color: #dc2626; margin-left: 0.5rem;">${(p.receiptNumber || '0000').replace('ABR-RCP-', '')}</span></div>
              <div>Date: <span style="border-bottom: 1px dotted #000; padding: 0 0.5rem; font-weight: normal; margin-left: 0.5rem;">${p.paymentDate || ''}</span></div>
            </div>

            <div style="margin-bottom: 1.25rem; line-height: 1.6; font-size: 0.9rem;">
              <div style="display: flex; align-items: baseline;">
                <span style="font-weight: 600; white-space: nowrap;">Received with thanks from</span>
                <span style="flex: 1; border-bottom: 1px dotted #000; margin-left: 0.5rem; padding: 0 0.5rem; text-transform: uppercase;">${studentData.name || ''}</span>
              </div>
            </div>

            <div style="margin-bottom: 1.25rem; line-height: 1.6; display: flex; align-items: baseline; font-size: 0.9rem;">
              <span style="flex: 1; border-bottom: 1px dotted #000;"></span>
              <span style="font-weight: 600; white-space: nowrap; margin: 0 0.75rem;">Student id</span>
              <span style="flex: 1; border-bottom: 1px dotted #000; padding: 0 0.5rem; text-transform: uppercase;">${studentData.studentId || ''}</span>
            </div>

            <div style="margin-bottom: 1.25rem; line-height: 1.6; display: flex; align-items: baseline; font-size: 0.9rem;">
              <span style="font-weight: 600; white-space: nowrap;">A sum of Rs</span>
              <span style="flex: 1; border-bottom: 1px dotted #000; margin-left: 0.5rem; padding: 0 0.5rem; font-weight: 700; text-transform: uppercase;">${wordsAmount}</span>
            </div>

            <div style="margin-bottom: 2rem; line-height: 1.6; display: flex; align-items: baseline; font-size: 0.9rem;">
              <span style="font-weight: 600; white-space: nowrap;">Cash/Gpay/Bank Transfer</span>
              <span style="flex: 1; border-bottom: 1px dotted #000; margin: 0 0.75rem; padding: 0 0.5rem; font-weight: 700; text-transform: uppercase;">${(p.paymentMethod === 'Vacation Leave' ? '-' : p.paymentMethod) || ''}</span>
              <span style="font-weight: 600; white-space: nowrap;">Reference Id</span>
              <span style="flex: 1; border-bottom: 1px dotted #000; margin-left: 0.5rem; padding: 0 0.5rem;">${p.referenceNumber || ''}</span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
              <div>
                <div style="display: inline-flex; border: 2px solid var(--color-success); overflow: hidden; align-items: stretch; border-radius: 4px;">
                  <div style="background-color: var(--color-success); color: white; padding: 0.35rem 0.75rem; font-size: 1.25rem; font-weight: bold; display: flex; align-items: center;">₹</div>
                  <div style="padding: 0.35rem 1rem; font-size: 1.25rem; font-weight: 900; color: #000;">${p.paidAmount || 0}/-</div>
                </div>
                <div style="font-size: 0.75rem; font-weight: 700; margin-top: 0.5rem;">Fees once received will not be refunded</div>
              </div>
              <div style="text-align: right; font-size: 0.75rem; font-style: italic; color: #374151;">
                <div>Sign here</div>
                <div style="margin-top: 0.25rem;">Prepared by cashier/Authorised</div>
              </div>
            </div>
          </div>
          
          <div style="padding: 1rem; border-top: 1px solid var(--color-border); text-align: center; background: #F9FAFB;" class="download-section">
            <button class="btn btn-outline download-btn" onclick="downloadReceipt('${p.id}', '${p.receiptNumber || 'receipt'}')" style="margin: 0 auto;">
              <i data-lucide="download" style="width: 16px; height: 16px;"></i> Download
            </button>
          </div>
        `;
        
        container.appendChild(receiptCard);
      });
      
      lucide.createIcons();
    }
  } catch (error) {
    console.error("Error fetching receipts:", error);
    document.getElementById('receiptsContainer').innerHTML = '<p class="text-danger" style="padding: 1rem;">Error loading receipts.</p>';
  }
});

// Expose download function globally
window.downloadReceipt = async function(id, receiptNum) {
  const receiptEl = document.getElementById(`receipt-${id}`);
  if (!receiptEl) return;

  // Hide the download button inside this receipt during capture
  const downloadSection = receiptEl.querySelector('.download-section');
  if (downloadSection) downloadSection.style.display = 'none';

  try {
    const canvas = await html2canvas(receiptEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false
    });

    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;

    // Calculate dimensions to fit receipt on a PDF page
    const imgWidthMm = 190; // fit in A4 width with margins
    const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;

    const pdf = new jsPDF({
      orientation: imgHeightMm > imgWidthMm ? 'portrait' : 'landscape',
      unit: 'mm',
      format: [imgWidthMm + 20, imgHeightMm + 20]
    });

    pdf.addImage(imgData, 'PNG', 10, 10, imgWidthMm, imgHeightMm);
    pdf.save(`Receipt_${receiptNum || id}.pdf`);
  } catch (error) {
    console.error('PDF generation failed:', error);
    alert('Failed to generate PDF. Please try again.');
  } finally {
    if (downloadSection) downloadSection.style.display = '';
  }
};

