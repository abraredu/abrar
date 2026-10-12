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
  const logoutBtn = document.getElementById('tutorLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('tutorLoggedIn');
      localStorage.removeItem('tutorId');
      localStorage.removeItem('tutorName');
      window.location.href = 'index.html';
    });
  }

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
    const headerAvatar = document.getElementById('headerAvatar');
    if (headerAvatar) {
      headerAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(tutorData.name)}&background=random`;
    }
    document.getElementById('profileName').textContent = tutorData.name;
    document.getElementById('profileId').textContent = tutorData.tutorId;
    document.getElementById('profilePhone').textContent = tutorData.phone || '-';
    
    // Format Join Date
    const joinDate = tutorData.joiningDate ? new Date(tutorData.joiningDate).toLocaleDateString() : '-';
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
    // Fetch all students and filter locally to handle comma-separated names/IDs from bulk uploads
    const allStudentsSnap = await getDocs(collection(db, "students"));
    const assignedStudents = [];
    
    allStudentsSnap.forEach(docSnap => {
      const student = docSnap.data();
      const sTutorId = student.tutorId || '';
      
      const isLegacyMatch = sTutorId.includes(realTutorDocId) || 
                            sTutorId.includes(tutorData.tutorId) || 
                            (tutorData.name && sTutorId.toLowerCase().includes(tutorData.name.toLowerCase()));
                            
      const inCourseTutors = student.courseTutors && Object.values(student.courseTutors).some(tId => 
        tId === realTutorDocId || tId === tutorData.tutorId || (tutorData.name && tId.toLowerCase().includes(tutorData.name.toLowerCase()))
      );
      
      if (isLegacyMatch || inCourseTutors) {
        assignedStudents.push(student);
      }
    });
    
    let activeStudentsCount = 0;
    let studentsHtml = '';
    
    if (assignedStudents.length === 0) {
      studentsHtml = '<tr><td colspan="4" style="padding: 1.5rem; text-align: center; color: var(--color-text-secondary);">No students assigned to you yet.</td></tr>';
    } else {
      
      const today = new Date();
      // Set to start of day for accurate day-only comparisons
      today.setHours(0, 0, 0, 0);

      assignedStudents.forEach(student => {
        if (student.status === 'active') activeStudentsCount++;
        
        const statusColor = student.status === 'active' ? 'var(--color-primary)' : 'var(--color-text-secondary)';
        
        let actionHtml = '-';
        if (student.status === 'active' && (student.classStartingDate || student.admissionDate)) {
          const startDateStr = student.classStartingDate || student.admissionDate;
          const startDate = new Date(startDateStr);
          
          if (!isNaN(startDate.getTime())) {
            const startDay = startDate.getDate();
            const currentMonthIdx = today.getMonth();
            const currentYear = today.getFullYear();
            
            // Calculate anniversary for this current month
            let anniversaryDate = new Date(currentYear, currentMonthIdx, startDay);
            
            // Difference in days between today and the anniversary (positive means anniversary is in the future)
            const diffTime = anniversaryDate.getTime() - today.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            
            // Calculate how many days the student has been enrolled
            const daysSinceStart = Math.round((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

            // Show report due button starting 2 days before the anniversary (diffDays <= 2)
            // It will remain visible after the anniversary (diffDays < 0) for the rest of the month.
            // AND only if the student has been enrolled for at least 20 days
            if (diffDays <= 2 && daysSinceStart >= 20) {
              actionHtml = `<button onclick="document.getElementById('navProgress').click(); setTimeout(() => { const buttons = document.querySelectorAll('#tutorStudentsTableBody button.btn-register'); for(let b of buttons) { if(b.getAttribute('data-name') === '${student.name}') { b.click(); break; } } }, 100);" style="background: var(--color-primary); color: white; padding: 0.35rem 0.75rem; border-radius: 4px; font-size: 0.75rem; border: none; cursor: pointer; font-weight: 500; display: inline-flex; align-items: center; gap: 0.25rem;"><i data-lucide="file-text" style="width: 14px; height: 14px;"></i> Report Due</button>`;
            }
          }
        }
        
        studentsHtml += `
          <tr style="border-bottom: 1px solid var(--color-border);">
            <td style="padding: 1rem; font-weight: 500;">${student.name}</td>
            <td style="padding: 1rem; color: var(--color-text-secondary);">${student.studentId || student.regNo || '-'}</td>
            <td style="padding: 1rem;">${student.courseType || student.course || '-'}</td>
            <td style="padding: 1rem; color: ${statusColor}; font-weight: 500;">
              ${student.status ? student.status.charAt(0).toUpperCase() + student.status.slice(1) : '-'}
            </td>
            <td style="padding: 1rem;">${actionHtml}</td>
          </tr>
        `;
      });
    }
    document.getElementById('studentsTableBody').innerHTML = studentsHtml;

    // Wait for DOM then attach tab toggle listeners
    setTimeout(() => {
      const navDashboard = document.getElementById('navDashboard');
      const navProgress = document.getElementById('navProgress');
      const dashboardSection = document.getElementById('dashboardSection');
      const progressSection = document.getElementById('progressSection');
      const pageTitle = document.querySelector('.page-title');

      if (navDashboard && navProgress) {
        navDashboard.addEventListener('click', (e) => {
          e.preventDefault();
          navDashboard.classList.add('active');
          navProgress.classList.remove('active');
          dashboardSection.style.display = 'block';
          progressSection.style.display = 'none';
          if(pageTitle) pageTitle.textContent = 'Tutor Portal';
        });

        navProgress.addEventListener('click', (e) => {
          e.preventDefault();
          navProgress.classList.add('active');
          navDashboard.classList.remove('active');
          dashboardSection.style.display = 'none';
          progressSection.style.display = 'block';
          if(pageTitle) pageTitle.textContent = 'Progress Reports';
        });
      }
    }, 100);
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
              <span class="role-badge">${
                payment.tutorRole 
                  ? (TUTOR_TYPE_LABELS[payment.tutorRole] || payment.tutorRole) 
                  : (tutorData.tutorType && tutorData.tutorType.length > 0
                      ? (Array.isArray(tutorData.tutorType) ? tutorData.tutorType : [tutorData.tutorType]).map(r => TUTOR_TYPE_LABELS[r] || r).join(', ')
                      : (TUTOR_TYPE_LABELS[payment.salaryType] || payment.salaryType || '-'))
              }</span>
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
