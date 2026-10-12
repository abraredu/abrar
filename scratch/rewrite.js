const fs = require('fs');

let html = fs.readFileSync('finance/fees.html', 'utf8');
const pageContentRegex = /<div class="page-content">[\s\S]*?<\/main>/;
const newPageContent = `<div class="page-content">
        <!-- Unified Student Search and Fee/Salary Management -->
        <div class="card" style="margin-bottom: 1.5rem;">
          <h2 style="margin-bottom: 1rem;">Search \u0026 Select Student</h2>
          <div class="form-group" style="margin-bottom: 0;">
            <input type="text" id="unifiedSearchInput" class="form-control" placeholder="Type student name or ID..." list="studentDatalist" autocomplete="off">
            <datalist id="studentDatalist"></datalist>
          </div>
        </div>
        
        <div id="studentDetailsSection" style="display: none;">
          <div class="card" style="margin-bottom: 1.5rem; background: var(--color-background);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
              <div>
                <h3 id="detStudentName" style="margin-bottom: 0.25rem;">-</h3>
                <div id="detStudentId" style="font-size: 0.875rem; color: var(--color-text-secondary);">-</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 0.875rem; color: var(--color-text-secondary);">Monthly Fee</div>
                <div id="detMonthlyFee" style="font-weight: 600; font-size: 1.125rem;">-</div>
              </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
              <div style="background: white; padding: 1rem; border-radius: 8px; border: 1px solid var(--color-border);">
                <div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-bottom: 0.25rem;">Expected</div>
                <div id="detExpected" style="font-weight: 600;">-</div>
              </div>
              <div style="background: white; padding: 1rem; border-radius: 8px; border: 1px solid var(--color-border);">
                <div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-bottom: 0.25rem;">Paid this month</div>
                <div id="detPaid" style="font-weight: 600; color: var(--color-success);">-</div>
              </div>
              <div style="background: white; padding: 1rem; border-radius: 8px; border: 1px solid var(--color-border);">
                <div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-bottom: 0.25rem;">Outstanding</div>
                <div id="detOutstanding" style="font-weight: 600; color: var(--color-danger);">-</div>
              </div>
            </div>
            
            <div style="display: flex; justify-content: flex-end; align-items: center; gap: 1rem;">
               <span id="feeSuccessMsg" style="color: var(--color-success); display: none; font-weight: 500;">Fee Accepted!</span>
              <button id="acceptFeeBtn" class="btn btn-primary">Accept Outstanding Fee</button>
            </div>
          </div>
          
          <h3 style="margin-bottom: 1rem; font-size: 1.125rem;">Tutor Salaries for <span id="detMonthLabel"></span></h3>
          <div class="card" style="overflow-x: auto;">
             <table style="width: 100%; text-align: left; border-collapse: collapse;">
                <thead>
                  <tr style="border-bottom: 1px solid var(--color-border);">
                    <th style="padding: 0.75rem; font-weight: 600; color: var(--color-text-secondary);">Tutor</th>
                    <th style="padding: 0.75rem; font-weight: 600; color: var(--color-text-secondary);">Paid this month</th>
                    <th style="padding: 0.75rem; font-weight: 600; color: var(--color-text-secondary);">Salary to Pay (₹)</th>
                    <th style="padding: 0.75rem; font-weight: 600; color: var(--color-text-secondary);">Action</th>
                  </tr>
                </thead>
                <tbody id="tutorsListBody">
                  <!-- dynamic rows -->
                </tbody>
             </table>
          </div>
        </div>
      </div>`;
html = html.replace(pageContentRegex, newPageContent + '\n    </main>');
const modalRegex = /<!-- Record Payment Modal -->[\s\S]*?<\/div>\s*<\/div>/;
html = html.replace(modalRegex, '');
fs.writeFileSync('finance/fees.html', html, 'utf8');

let jsContent = `import { toast } from './toast.js';
import { db, auth } from './firebase-config.js';
import { collection, getDocs, query, where, doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
  const monthSelector = document.getElementById('monthSelector');
  const searchInput = document.getElementById('unifiedSearchInput');
  const datalist = document.getElementById('studentDatalist');
  const detailsSection = document.getElementById('studentDetailsSection');
  
  let allStudents = [];
  let allTutors = [];
  let currentPayments = [];
  let currentSalaryPayments = [];
  let selectedStudent = null;

  const now = new Date();
  monthSelector.value = \`\${now.getFullYear()}-\${String(now.getMonth() + 1).padStart(2, '0')}\`;

  const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

  async function loadInitialData() {
    try {
      const studentsQ = query(collection(db, "students"), where("status", "==", "active"));
      const snap = await getDocs(studentsQ);
      allStudents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      datalist.innerHTML = '';
      allStudents.forEach(s => {
        const opt = document.createElement('option');
        opt.value = \`\${s.name} (\${s.studentId})\`;
        opt.dataset.id = s.id;
        datalist.appendChild(opt);
      });

      const tutorsQ = query(collection(db, "tutors"), where("status", "==", "active"));
      const tSnap = await getDocs(tutorsQ);
      allTutors = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      await loadMonthData();
    } catch(e) {
      console.error(e);
      toast.error('Failed to load data');
    }
  }

  async function loadMonthData() {
    const selectedMonth = monthSelector.value;
    document.getElementById('detMonthLabel').textContent = selectedMonth;
    
    try {
      const paymentsQ = query(collection(db, "payments"), where("billingMonth", "==", selectedMonth));
      const paymentsSnap = await getDocs(paymentsQ);
      currentPayments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const salariesQ = query(collection(db, "salaryPayments"), where("month", "==", selectedMonth));
      const salariesSnap = await getDocs(salariesQ);
      currentSalaryPayments = salariesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      if(selectedStudent) renderStudentDetails(selectedStudent);
    } catch(e) {
      console.error(e);
    }
  }

  monthSelector.addEventListener('change', loadMonthData);

  searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    const opt = Array.from(datalist.options).find(o => o.value === val);
    if(opt) {
      const studentId = opt.dataset.id;
      selectedStudent = allStudents.find(s => s.id === studentId);
      detailsSection.style.display = 'block';
      renderStudentDetails(selectedStudent);
    } else {
      selectedStudent = null;
      detailsSection.style.display = 'none';
    }
  });

  function renderStudentDetails(student) {
    document.getElementById('detStudentName').textContent = student.name;
    document.getElementById('detStudentId').textContent = student.studentId;
    
    const monthlyFee = student.monthlyFee || 0;
    document.getElementById('detMonthlyFee').textContent = formatter.format(monthlyFee);
    document.getElementById('detExpected').textContent = formatter.format(monthlyFee);

    const studentPayments = currentPayments.filter(p => p.studentId === student.id);
    const actualPaid = studentPayments.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
    const waived = studentPayments.reduce((sum, p) => sum + (p.waivedAmount || 0), 0);
    const totalCredited = actualPaid + waived;
    const outstanding = monthlyFee - totalCredited;

    document.getElementById('detPaid').textContent = formatter.format(totalCredited);
    document.getElementById('detOutstanding').textContent = formatter.format(outstanding);

    const acceptBtn = document.getElementById('acceptFeeBtn');
    if(outstanding <= 0) {
      acceptBtn.disabled = true;
      acceptBtn.textContent = 'Fully Paid';
    } else {
      acceptBtn.disabled = false;
      acceptBtn.textContent = \`Accept Outstanding Fee (\${formatter.format(outstanding)})\`;
      acceptBtn.onclick = () => processFee(student.id, outstanding, monthlyFee);
    }

    const tbody = document.getElementById('tutorsListBody');
    tbody.innerHTML = '';
    
    let studentTutors = [];
    if(student.tutorId) {
       const t = allTutors.find(t => t.id === student.tutorId);
       if(t) studentTutors.push(t);
    }
    
    if(studentTutors.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 1rem;">No tutors assigned to this student.</td></tr>';
      return;
    }

    studentTutors.forEach(tutor => {
       const tutorPayments = currentSalaryPayments.filter(p => p.tutorId === tutor.id);
       const paidSoFar = tutorPayments.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
       
       const tr = document.createElement('tr');
       tr.innerHTML = \`
         <td style="padding: 0.75rem;">\${tutor.name} <br><small style="color:gray;">\${tutor.tutorId}</small></td>
         <td style="padding: 0.75rem; color: var(--color-success);">\${formatter.format(paidSoFar)}</td>
         <td style="padding: 0.75rem;"><input type="number" class="form-control salary-input" data-tutor="\${tutor.id}" value="0" min="0" step="0.01" style="width: 120px;"></td>
         <td style="padding: 0.75rem;"><button class="btn btn-outline set-salary-btn" data-tutor="\${tutor.id}" style="padding: 0.25rem 0.75rem; font-size: 0.875rem;">Set Salary</button></td>
       \`;
       tbody.appendChild(tr);
    });
    
    document.querySelectorAll('.set-salary-btn').forEach(btn => {
       btn.addEventListener('click', (e) => {
          const tutorId = e.target.dataset.tutor;
          const input = document.querySelector(\`.salary-input[data-tutor="\${tutorId}"]\`);
          const amt = parseFloat(input.value) || 0;
          if(amt <= 0) return toast.error("Enter valid amount");
          processSalary(tutorId, amt, e.target);
       });
    });
  }

  async function processFee(studentDocId, payAmount, expected) {
    const btn = document.getElementById('acceptFeeBtn');
    btn.disabled = true;
    btn.textContent = 'Processing...';
    
    const billingMonth = monthSelector.value;
    const payDate = new Date().toISOString().split('T')[0];
    
    try {
      const counterRef = doc(db, 'counters', 'receipts');
      await runTransaction(db, async (tx) => {
        const counterDoc = await tx.get(counterRef);
        let newCount = 1;
        if (counterDoc.exists()) {
          newCount = (counterDoc.data().count || 0) + 1;
          tx.update(counterRef, { count: newCount });
        } else {
          tx.set(counterRef, { count: newCount });
        }
        const receiptNumber = \`ABR-RCP-\${newCount.toString().padStart(6, '0')}\`;
        
        const paymentRef = doc(collection(db, 'payments'));
        tx.set(paymentRef, {
          receiptNumber, studentId: studentDocId, billingMonth,
          expectedAmount: expected, paidAmount: payAmount, waivedAmount: 0,
          isVacationLeave: false, paymentMethod: 'Cash', paymentDate: payDate,
          createdAt: serverTimestamp(), createdBy: auth.currentUser ? auth.currentUser.uid : 'system'
        });

        const transRef = doc(collection(db, 'transactions'));
        tx.set(transRef, {
          date: payDate, type: 'income', category: 'Student Fee',
          description: \`Fee payment (\${billingMonth})\`, amount: payAmount,
          studentId: studentDocId, paymentId: paymentRef.id, referenceNumber: receiptNumber,
          createdBy: auth.currentUser ? auth.currentUser.uid : 'system', createdAt: serverTimestamp()
        });
      });
      toast.success('Fee accepted successfully!');
      await loadMonthData();
    } catch(e) {
      console.error(e);
      toast.error('Failed to accept fee');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Accept Outstanding Fee';
    }
  }

  async function processSalary(tutorDocId, amount, btnEl) {
    btnEl.disabled = true;
    btnEl.textContent = 'Saving...';
    const month = monthSelector.value;
    const payDate = new Date().toISOString().split('T')[0];
    const tutor = allTutors.find(t => t.id === tutorDocId);

    try {
      await runTransaction(db, async (tx) => {
        const salaryPaymentRef = doc(collection(db, 'salaryPayments'));
        tx.set(salaryPaymentRef, {
          tutorId: tutorDocId, month: month, salaryType: tutor.salaryType || 'custom',
          rate: tutor.salaryRate || 0, calculatedAmount: amount, adjustment: 0,
          finalAmount: amount, paidAmount: amount, paymentMethod: 'Cash',
          paymentDate: payDate, status: 'paid',
          createdAt: serverTimestamp(), createdBy: auth.currentUser ? auth.currentUser.uid : 'system'
        });

        const transRef = doc(collection(db, 'transactions'));
        tx.set(transRef, {
          date: payDate, type: 'expense', category: 'Tutor Salary',
          description: \`Salary payment for \${tutor.name} (\${month})\`, amount: amount,
          tutorId: tutorDocId, salaryPaymentId: salaryPaymentRef.id,
          createdBy: auth.currentUser ? auth.currentUser.uid : 'system', createdAt: serverTimestamp()
        });
      });
      toast.success('Salary saved successfully!');
      await loadMonthData();
    } catch(e) {
      console.error(e);
      toast.error('Failed to save salary');
    } finally {
      btnEl.disabled = false;
      btnEl.textContent = 'Set Salary';
    }
  }

  loadInitialData();
});
`;
fs.writeFileSync('js/fees.js', jsContent, 'utf8');
console.log("Rewrote fees.html and fees.js successfully.");
