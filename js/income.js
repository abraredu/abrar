import { toast } from './toast.js';
// js/income.js
import { db, auth } from './firebase-config.js';
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('incomeForm');
  const submitBtn = document.getElementById('submitBtn');
  const categorySelect = document.getElementById('category');
  
  // Admission specific fields
  const admissionFields = document.getElementById('admissionFields');
  const studentIdInput = document.getElementById('studentId');
  const isHomeMemberCheckbox = document.getElementById('isHomeMember');
  const additionalStudentsGroup = document.getElementById('additionalStudentsGroup');
  const additionalStudentsList = document.getElementById('additionalStudentsList');
  const addStudentBtn = document.getElementById('addStudentBtn');

  // Default to today
  document.getElementById('date').value = new Date().toISOString().split('T')[0];

  if (!form) return;

  // Toggle Admission Fields based on Category
  categorySelect.addEventListener('change', (e) => {
    if (e.target.value === 'Admission Fee') {
      admissionFields.style.display = 'block';
      studentIdInput.required = true;
    } else {
      admissionFields.style.display = 'none';
      studentIdInput.required = false;
    }
  });

  // Toggle Additional Student IDs based on Home Member checkbox
  isHomeMemberCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
      additionalStudentsGroup.style.display = 'block';
    } else {
      additionalStudentsGroup.style.display = 'none';
      // Reset additional inputs
      additionalStudentsList.innerHTML = `
        <div style="display: flex; gap: 0.5rem;">
          <input type="text" class="form-control additional-student-id" placeholder="e.g. ABR002">
        </div>
      `;
    }
  });

  // Add more student ID inputs
  addStudentBtn.addEventListener('click', () => {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.gap = '0.5rem';
    div.innerHTML = `
      <input type="text" class="form-control additional-student-id" placeholder="e.g. ABR003">
      <button type="button" class="btn btn-outline remove-btn" style="padding: 0 0.75rem; color: var(--color-danger); border-color: var(--color-danger);"><i data-lucide="x" style="width: 16px; height: 16px;"></i></button>
    `;
    
    div.querySelector('.remove-btn').addEventListener('click', () => {
      div.remove();
    });
    
    additionalStudentsList.appendChild(div);
    if (window.lucide) lucide.createIcons();
  });

  // Helper to update student application status
  const updateStudentApplicationStatus = async (sId, dateVal) => {
    if (!sId) return;
    try {
      const q = query(collection(db, 'students'), where('studentId', '==', sId.trim()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const studentDoc = snap.docs[0];
        await updateDoc(doc(db, 'students', studentDoc.id), {
          applicationFeePaid: true,
          applicationFeeDate: dateVal
        });
      }
    } catch (e) {
      console.error(`Failed to update application status for ${sId}`, e);
    }
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
    
    const categoryVal = categorySelect.value;
    const dateVal = document.getElementById('date').value;

    try {
      const transactionData = {
        date: dateVal,
        type: 'income',
        category: categoryVal,
        description: document.getElementById('description').value,
        amount: parseFloat(document.getElementById('amount').value),
        paymentMethod: document.getElementById('paymentMethod').value,
        referenceNumber: document.getElementById('reference').value,
        createdBy: auth.currentUser ? auth.currentUser.uid : 'system',
        createdAt: serverTimestamp(),
        isManual: true
      };

      // Add admission-specific data
      if (categoryVal === 'Admission Fee') {
        transactionData.studentId = studentIdInput.value.trim();
        transactionData.isHomeMember = isHomeMemberCheckbox.checked;
        
        if (isHomeMemberCheckbox.checked) {
          const idInputs = document.querySelectorAll('.additional-student-id');
          transactionData.additionalStudentIds = Array.from(idInputs)
            .map(input => input.value.trim())
            .filter(id => id !== '');
        }
      }

      await addDoc(collection(db, 'transactions'), transactionData);
      
      // Update student documents if this is an admission fee
      if (categoryVal === 'Admission Fee') {
        await updateStudentApplicationStatus(transactionData.studentId, dateVal);
        
        if (transactionData.isHomeMember && transactionData.additionalStudentIds) {
          for (const sId of transactionData.additionalStudentIds) {
            await updateStudentApplicationStatus(sId, dateVal);
          }
        }
      }
      
      toast.success('Manual income recorded successfully!');
      window.location.href = 'accounts.html';
      
    } catch (error) {
      console.error("Error saving income: ", error);
      toast.error('Error saving income: ' + error.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Income';
    }
  });
});
