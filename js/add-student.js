import { toast } from './toast.js';
import { db, auth } from './firebase-config.js';
import { collection, getDocs, addDoc, query, where, serverTimestamp, doc, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { uploadToCloudinary } from './cloudinary-config.js';

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('addStudentForm');
  const submitBtn = document.getElementById('submitBtn');
  const courseTypeSelect = document.getElementById('courseType');
  const tutorSelect = document.getElementById('tutorId');
  const divisionGroup = document.getElementById('divisionGroup');
  const divisionSelect = document.getElementById('divisionId');

  if (!form) return;

  let allCourses = [];
  let allTutors = [];

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        // Load Tutors
        // Tutors logic removed from here, integrated into courses

        // Load Courses
        const tutorsQ = query(collection(db, "tutors"), where("status", "==", "active"));
        const tutorSnap = await getDocs(tutorsQ);
        tutorSnap.forEach(doc => allTutors.push({ id: doc.id, ...doc.data() }));

        const coursesQ = query(collection(db, "managed_courses"));
        const courseSnap = await getDocs(coursesQ);
        courseSnap.forEach(doc => allCourses.push({ id: doc.id, ...doc.data() }));

        courseTypeSelect.innerHTML = '';
        allCourses.forEach(course => {
          const wrapper = document.createElement('div');
          wrapper.style.display = 'flex';
          wrapper.style.alignItems = 'center';
          wrapper.style.justifyContent = 'space-between';
          wrapper.style.gap = '1rem';
          
          const label = document.createElement('label');
          label.style.display = 'flex';
          label.style.alignItems = 'center';
          label.style.gap = '0.5rem';
          label.style.cursor = 'pointer';
          label.style.flex = '1';
          
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.value = course.courseName;
          cb.name = 'courseTypeCb';
          
          const tutorDropdown = document.createElement('select');
          tutorDropdown.className = 'form-control';
          tutorDropdown.name = 'tutorForCourse';
          tutorDropdown.dataset.course = course.courseName;
          tutorDropdown.style.width = '200px';
          tutorDropdown.style.padding = '0.25rem 0.5rem';
          tutorDropdown.style.display = 'none';
          
          tutorDropdown.innerHTML = '<option value="">Select Tutor (Optional)</option>';
          allTutors.forEach(t => {
             const opt = document.createElement('option');
             opt.value = t.id;
             opt.textContent = `${t.name} (${t.tutorId})`;
             tutorDropdown.appendChild(opt);
          });
          
          cb.addEventListener('change', () => {
             tutorDropdown.style.display = cb.checked ? 'block' : 'none';
             if(!cb.checked) tutorDropdown.value = '';
             updateDivisionsForCheckboxes();
          });
          
          label.appendChild(cb);
          label.appendChild(document.createTextNode(`${course.serialNo} - ${course.courseName}`));
          
          wrapper.appendChild(label);
          wrapper.appendChild(tutorDropdown);
          courseTypeSelect.appendChild(wrapper);
        });

      } catch (err) {
        console.error("Error fetching data:", err);
      }
    }
  });

  // Handle course change to show/hide divisions
  function updateDivisionsForCheckboxes() {
    const selectedCourseNames = Array.from(document.querySelectorAll('input[name="courseTypeCb"]:checked')).map(cb => cb.value);
    let allDivs = new Set();
    selectedCourseNames.forEach(name => {
       const course = allCourses.find(c => c.courseName === name);
       if (course && course.divisions && course.divisions.trim() !== '') {
          course.divisions.split(',').map(d => d.trim()).filter(d => d).forEach(d => allDivs.add(d));
       }
    });

    if (allDivs.size > 0) {
      divisionGroup.style.display = 'block';
      divisionSelect.required = true;
      divisionSelect.innerHTML = '<option value="">Select Division</option>';
      allDivs.forEach(d => {
        const option = document.createElement('option');
        option.value = d;
        option.textContent = d;
        divisionSelect.appendChild(option);
      });
    } else {
      divisionGroup.style.display = 'none';
      divisionSelect.required = false;
      divisionSelect.innerHTML = '<option value="">Select Division</option>';
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Saving...';

    const selectedCourses = Array.from(document.querySelectorAll('input[name="courseTypeCb"]:checked')).map(cb => cb.value);
    const courseName = selectedCourses.length > 0 ? selectedCourses[0] : ''; // fallback
    const courseObj = allCourses.find(c => c.courseName === courseName);
    // Base prefix = course serial without trailing digits (e.g. "AMO001" -> "AMO")
    const rawSerial = courseObj ? (courseObj.serialNo || '').trim().toUpperCase() : '';
    const prefix = rawSerial.replace(/\d+$/, '') || 'STU';

    try {
      // Create studentId: per-prefix sequence -> AMO001, AMO002, ...
      const snapshot = await getDocs(query(collection(db, "students")));
      const idPattern = new RegExp(`^${prefix}(\\d{1,4})$`, 'i');
      let maxExisting = 0;
      snapshot.forEach(d => {
        const m = String(d.data().studentId || '').trim().match(idPattern);
        if (m) maxExisting = Math.max(maxExisting, parseInt(m[1], 10));
      });

      // Keep in sync with the shared counter used by bulk upload
      const counterRef = doc(db, 'counters', 'students');
      const nextNum = await runTransaction(db, async (tx) => {
        const counterSnap = await tx.get(counterRef);
        const counterVal = counterSnap.exists() ? (counterSnap.data()[prefix] || 0) : 0;
        const next = Math.max(counterVal, maxExisting) + 1;
        if (counterSnap.exists()) tx.update(counterRef, { [prefix]: next });
        else tx.set(counterRef, { [prefix]: next });
        return next;
      });
      const studentId = `${prefix}${String(nextNum).padStart(3, '0')}`;

      // Handle file uploads (Placeholder logic to match existing)
      const photoFile = document.getElementById('photo')?.files[0];
      const idDocFile = document.getElementById('idDocument')?.files[0];
      
      let photoUrl = "";
      let idDocUrl = "";

      if (photoFile) {
        photoUrl = await uploadToCloudinary(photoFile, 'image');
      }
      
      if (idDocFile) {
        idDocUrl = await uploadToCloudinary(idDocFile, 'auto');
      }

      const courseTutors = {};
      selectedCourses.forEach(cName => {
         const select = document.querySelector(`select[data-course="${cName}"]`);
         if(select && select.value) {
            courseTutors[cName] = select.value;
         }
      });
      const studentNameVal = document.getElementById('name')?.value.trim() || document.getElementById('studentName')?.value.trim() || '';
      const parentNameVal = document.getElementById('parentName')?.value.trim() || document.getElementById('fatherName')?.value.trim() || '';
      const placeVal = document.getElementById('place')?.value.trim() || document.getElementById('address')?.value.trim() || '';
      const admissionDateVal = document.getElementById('admissionDate')?.value || '';
      const classDateVal = document.getElementById('classStartingDate')?.value || document.getElementById('classStartDate')?.value || '';

      const studentData = {
        studentId: studentId,
        admNo: studentId,
        name: studentNameVal,
        parentName: parentNameVal,
        phone: document.getElementById('phone')?.value.trim() || '',
        whatsapp: document.getElementById('whatsapp')?.value.trim() || '',
        place: placeVal,
        address: placeVal,
        dob: document.getElementById('dob')?.value || '',
        gender: document.getElementById('gender')?.value || '',
        email: document.getElementById('email')?.value || '',
        
        courses: selectedCourses,
        courseTutors: courseTutors,
        course: courseName,
        courseType: courseName,
        courseId: courseObj ? courseObj.id : null,
        division: divisionSelect.value,
        level: document.getElementById('level')?.value.trim() || '',
        
        admissionDate: admissionDateVal,
        admissionStatus: admissionDateVal ? 'accepted' : 'pending',
        classStartingDate: classDateVal,
        classStartDate: classDateVal,
        monthlyFee: parseFloat(document.getElementById('monthlyFee')?.value) || 0,
        
        fatherName: parentNameVal,
        fatherOccupation: document.getElementById('fatherOccupation')?.value || '',
        fatherPhone: document.getElementById('fatherPhone')?.value || document.getElementById('phone')?.value || '',
        motherName: document.getElementById('motherName')?.value || '',
        motherPhone: document.getElementById('motherPhone')?.value || '',
        
        status: 'active',
        createdAt: serverTimestamp(),
        photoUrl: photoUrl,
        idDocumentUrl: idDocUrl
      };

      await addDoc(collection(db, "students"), studentData);

      toast.success('Student added successfully!');
      setTimeout(() => {
        window.location.href = 'students.html';
      }, 1500);

    } catch (error) {
      console.error("Error adding student:", error);
      toast.error('Failed to add student: ' + error.message);
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
});
