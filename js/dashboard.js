// js/dashboard.js
import { db } from './firebase-config.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
  const activeStudentsEl = document.getElementById('dashActiveStudents');
  const monthCollectionEl = document.getElementById('dashMonthCollection');
  const activeTutorsEl = document.getElementById('dashActiveTutors');
  const pendingFeesEl = document.getElementById('dashPendingFees');
  const pendingTitleEl = document.getElementById('dashPendingTitle');
  const recentActivitiesList = document.getElementById('recentActivitiesList');

  const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
  const auth = getAuth();
  
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        // 1. Fetch Students
        const studentsQ = query(collection(db, "students"), where("status", "==", "active"));
        const studentsSnap = await getDocs(studentsQ);
        const activeStudents = [];
        studentsSnap.forEach(doc => activeStudents.push({ id: doc.id, ...doc.data() }));
        if (activeStudentsEl) activeStudentsEl.textContent = activeStudents.length;

        // 2. Fetch Tutors
        const tutorsQ = query(collection(db, "tutors"), where("status", "==", "active"));
        const tutorsSnap = await getDocs(tutorsQ);
        if (activeTutorsEl) activeTutorsEl.textContent = tutorsSnap.size;

        // 3. Fetch Payments for this month (for pending/overdue calc)
        const paymentsQ = query(collection(db, "payments"), where("billingMonth", "==", currentMonth));
        const paymentsSnap = await getDocs(paymentsQ);
        const currentPayments = [];
        paymentsSnap.forEach(doc => currentPayments.push(doc.data()));

        let totalPending = 0;
        let totalOverdue = 0;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const currMonthIdx = today.getMonth();
        const currYear = today.getFullYear();

        activeStudents.forEach(student => {
          const monthlyFee = student.monthlyFee || 0;
          
          const studentPayments = currentPayments.filter(p => p.studentId === student.id);
          const actualPaid = studentPayments.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
          const waived = studentPayments.reduce((sum, p) => sum + (p.waivedAmount || 0), 0);
          const totalCredited = actualPaid + waived;
          
          const balance = Math.max(0, monthlyFee - totalCredited);
          
          if (balance > 0) {
            totalPending += balance;
            
            // Check if overdue
            const baseDateStr = student.classStartingDate || student.admissionDate;
            if (baseDateStr) {
              const baseDate = new Date(baseDateStr);
              if (!isNaN(baseDate.getTime())) {
                const daysSinceJoined = (today.getTime() - baseDate.getTime()) / (1000 * 3600 * 24);
                if (daysSinceJoined >= 28) {
                  const dueDay = baseDate.getDate();
                  const currentMonthDueDate = new Date(currYear, currMonthIdx, dueDay);
                  const diffTime = currentMonthDueDate.getTime() - today.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  
                  if (diffDays < 0) {
                    totalOverdue += balance;
                  }
                }
              }
            }
          }
        });

        // 4. Update Pending/Overdue UI
        if (pendingFeesEl && pendingTitleEl) {
          if (totalOverdue > 0) {
            pendingTitleEl.textContent = 'Overdue Fees';
            pendingFeesEl.textContent = formatter.format(totalOverdue);
          } else {
            pendingTitleEl.textContent = 'Pending Fees';
            pendingFeesEl.textContent = formatter.format(totalPending);
          }
        }

        // 5. Recent Activities & Month Collection
        const txQ = query(collection(db, "transactions")); 
        const txSnap = await getDocs(txQ);
        let allTx = [];
        let collectedThisMonth = 0;
        
        txSnap.forEach(doc => {
          const t = doc.data();
          allTx.push(t);
          if (t.type === 'income' && t.date && t.date.startsWith(currentMonth)) {
            collectedThisMonth += (t.amount || 0);
          }
        });
        
        if (monthCollectionEl) monthCollectionEl.textContent = formatter.format(collectedThisMonth);
        
        if (recentActivitiesList) {
           allTx.sort((a, b) => {
             const dateA = a.createdAt ? a.createdAt.toMillis() : 0;
             const dateB = b.createdAt ? b.createdAt.toMillis() : 0;
             return dateB - dateA;
           });
           
           const recentTx = allTx.slice(0, 3);
           
           if (recentTx.length === 0) {
             recentActivitiesList.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--color-text-secondary);">No recent activity.</div>';
           } else {
             recentActivitiesList.innerHTML = recentTx.map(tx => {
                const isIncome = tx.type === 'income';
                const icon = isIncome ? 'arrow-down-left' : 'arrow-up-right';
                const color = isIncome ? 'var(--color-success)' : 'var(--color-danger)';
                const prefix = isIncome ? '+' : '-';
                
                return `
                  <div style="display: flex; align-items: center; justify-content: space-between; padding: 1rem; border-bottom: 1px solid var(--color-border);">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                      <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--color-sidebar-active); display: flex; align-items: center; justify-content: center; color: ${color};">
                        <i data-lucide="${icon}"></i>
                      </div>
                      <div>
                        <div style="font-weight: 500;">${tx.description || tx.category}</div>
                        <div style="font-size: 0.875rem; color: var(--color-text-secondary);">${tx.date}</div>
                      </div>
                    </div>
                    <div style="font-weight: 600; color: ${color};">
                      ${prefix}${formatter.format(tx.amount || 0)}
                    </div>
                  </div>
                `;
             }).join('');
             lucide.createIcons();
           }
        }

      } catch (error) {
        console.error("Error loading dashboard data:", error);
        if (activeStudentsEl) activeStudentsEl.textContent = 'Error';
        if (activeTutorsEl) activeTutorsEl.textContent = 'Error';
        if (monthCollectionEl) monthCollectionEl.textContent = 'Error';
        if (pendingFeesEl) pendingFeesEl.textContent = 'Error';
      }
    }
  });
});
