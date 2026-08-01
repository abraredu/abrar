import { toast } from './toast.js';
import { db, auth } from './firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const TUTOR_TYPE_LABELS = {
  'madrasa_group': 'Madrasa (Group)',
  'madrasa_individual': 'Madrasa (One-to-One)',
  'quran_recitation': 'Quran Recitation',
  'hifz': 'Hifz'
};

const formatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2
});

document.addEventListener('DOMContentLoaded', async () => {
  // Authentication Check
  if (!localStorage.getItem('tutorLoggedIn')) {
    window.location.href = 'index.html';
    return;
  }
  
  const tutorDocId = localStorage.getItem('tutorId'); // This is the Firestore document ID
  
  // Logout handler
  document.getElementById('tutorLogoutBtn').addEventListener('click', () => {
    localStorage.removeItem('tutorLoggedIn');
    localStorage.removeItem('tutorId');
    localStorage.removeItem('tutorName');
    window.location.href = 'index.html';
  });

  try {
    // 1. Fetch Tutor Profile
    let tutorRef = doc(db, "tutors", tutorDocId);
    let tutorSnap = await getDoc(tutorRef);
    let realTutorDocId = tutorDocId;
    
    // Fallback: If not found, it might be the display ID (e.g., 'MO1') stored in legacy sessions
    if (!tutorSnap.exists()) {
      const fallbackQ = query(collection(db, "tutors"), where("tutorId", "==", tutorDocId));
      const fallbackSnap = await getDocs(fallbackQ);
      if (!fallbackSnap.empty) {
        tutorSnap = fallbackSnap.docs[0];
        realTutorDocId = tutorSnap.id;
        // Fix it in local storage for the future
        localStorage.setItem('tutorId', realTutorDocId);
      } else {
        toast.error("Tutor record not found.");
        return;
      }
    }
    
    const tutorData = tutorSnap.data();
    
    // Update Profile UI
    document.getElementById('navTutorName').textContent = tutorData.name;
    document.getElementById('profileName').textContent = tutorData.name;
    document.getElementById('profileId').textContent = tutorData.tutorId;
    document.getElementById('profilePhone').textContent = tutorData.phone || '-';
    
    // Format Join Date
    const joinDate = tutorData.joinDate ? new Date(tutorData.joinDate).toLocaleDateString() : '-';
    document.getElementById('profileJoinDate').textContent = joinDate;
    
    // Status Badge
    const statusSpan = document.getElementById('profileStatus');
    statusSpan.textContent = tutorData.status.charAt(0).toUpperCase() + tutorData.status.slice(1);
    statusSpan.style.color = tutorData.status === 'active' ? 'var(--color-primary)' : 'var(--color-danger)';
    
    // Roles Badges
    const rolesContainer = document.getElementById('profileRoles');
    const roles = tutorData.tutorType || [];
    if (roles.length > 0) {
      rolesContainer.innerHTML = roles.map(r => `<span class="role-badge">${TUTOR_TYPE_LABELS[r] || r}</span>`).join('');
    } else {
      rolesContainer.innerHTML = '<span style="color: var(--color-text-secondary); font-size: 0.875rem;">No roles assigned</span>';
    }

    // 2. Fetch Assigned Students
    const studentsQ = query(collection(db, "students"), where("tutorId", "==", realTutorDocId));
    const studentsSnap = await getDocs(studentsQ);
    
    let activeStudentsCount = 0;
    let studentsHtml = '';
    
    if (studentsSnap.empty) {
      studentsHtml = '<tr><td colspan="4" style="padding: 1.5rem; text-align: center; color: var(--color-text-secondary);">No students assigned to you yet.</td></tr>';
    } else {
      studentsSnap.forEach(docSnap => {
        const student = docSnap.data();
        if (student.status === 'active') activeStudentsCount++;
        
        const statusColor = student.status === 'active' ? 'var(--color-primary)' : 'var(--color-text-secondary)';
        
        studentsHtml += `
          <tr style="border-bottom: 1px solid var(--color-border);">
            <td style="padding: 1rem; font-weight: 500;">${student.name}</td>
            <td style="padding: 1rem; color: var(--color-text-secondary);">${student.regNo || '-'}</td>
            <td style="padding: 1rem;">${student.course || '-'}</td>
            <td style="padding: 1rem; color: ${statusColor}; font-weight: 500;">
              ${student.status ? student.status.charAt(0).toUpperCase() + student.status.slice(1) : '-'}
            </td>
          </tr>
        `;
      });
    }
    
    document.getElementById('studentsTableBody').innerHTML = studentsHtml;
    document.getElementById('statStudentsCount').textContent = activeStudentsCount;

    // 3. Fetch Payment History
    const currentYear = new Date().getFullYear();
    const paymentsQ = query(collection(db, "salaryPayments"), where("tutorId", "==", realTutorDocId));
    const paymentsSnap = await getDocs(paymentsQ);
    
    let totalEarnings = 0;
    let paymentsHtml = '';
    
    // Convert to array so we can sort by date descending
    const paymentsList = [];
    paymentsSnap.forEach(p => paymentsList.push({ id: p.id, ...p.data() }));
    
    paymentsList.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
    
    if (paymentsList.length === 0) {
      paymentsHtml = '<tr><td colspan="5" style="padding: 1.5rem; text-align: center; color: var(--color-text-secondary);">No payment history found.</td></tr>';
    } else {
      paymentsList.forEach(payment => {
        // Calculate earnings for the current year
        if (payment.paymentDate && payment.paymentDate.startsWith(currentYear.toString())) {
          totalEarnings += (payment.paidAmount || 0);
        }
        
        paymentsHtml += `
          <tr style="border-bottom: 1px solid var(--color-border);">
            <td style="padding: 1rem;">${payment.paymentDate || '-'}</td>
            <td style="padding: 1rem; font-weight: 500;">${payment.month || '-'}</td>
            <td style="padding: 1rem;">
              <span class="role-badge">${TUTOR_TYPE_LABELS[payment.tutorRole] || payment.tutorRole}</span>
            </td>
            <td style="padding: 1rem; font-weight: 600; color: var(--color-text);">
              ${formatter.format(payment.paidAmount || 0)}
            </td>
            <td style="padding: 1rem; color: var(--color-text-secondary);">
              ${payment.paymentMethod || 'Bank Transfer'}
            </td>
          </tr>
        `;
      });
    }
    
    document.getElementById('paymentsTableBody').innerHTML = paymentsHtml;
    document.getElementById('statTotalEarnings').textContent = formatter.format(totalEarnings);

  } catch (error) {
    console.error("Error loading dashboard data:", error);
    toast.error("Error loading dashboard data. Please try again.");
  }
});
