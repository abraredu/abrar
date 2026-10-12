import { toast } from './toast.js';
import { db, auth } from './firebase-config.js';
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { uploadToCloudinary } from './cloudinary-config.js';

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const studentId = urlParams.get('id');

  if (!studentId) {
    toast.success("No student ID provided.");
    window.location.href = 'students.html';
    return;
  }

  const form = document.getElementById('editStudentForm');
  const submitBtn = document.getElementById('submitBtn');
  const deleteBtn = document.getElementById('deleteBtn');
  const courseTypeSelect = document.getElementById('courseType');
  const tutorSelect = document.getElementById('tutorId');
  const divisionGroup = document.getElementById('divisionGroup');
  const divisionSelect = document.getElementById('divisionId');

  let allCourses = [];
  let allTutors = [];
  let currentStudentData = null;

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        // Load Tutors
        const tutorsQ = query(collection(db, "tutors"), where("status", "==", "active"));
        // Tutors logic removed from here, integrated into courses

        // Load Courses
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
             const selectedOptions = Array.from(document.querySelectorAll('input[name="courseTypeCb"]:checked')).map(opt => opt.value);
             updateDivisionsDropdown(selectedOptions);
          });
          
          label.appendChild(cb);
          label.appendChild(document.createTextNode(`${course.serialNo} - ${course.courseName}`));
          
          wrapper.appendChild(label);
          wrapper.appendChild(tutorDropdown);
          courseTypeSelect.appendChild(wrapper);
        });

      } catch (err) {
        console.error("Error fetching dependencies:", err);
      }
      loadStudentData();
    }
  });

  const updateDivisionsDropdown = (selectedCourseNames, preselectedDivision = '') => {
    const names = Array.isArray(selectedCourseNames) ? selectedCourseNames : [selectedCourseNames];
    let allDivs = new Set();
    
    names.forEach(name => {
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
        if (d === preselectedDivision) option.selected = true;
        divisionSelect.appendChild(option);
      });
    } else {
      divisionGroup.style.display = 'none';
      divisionSelect.required = false;
      divisionSelect.innerHTML = '<option value="">Select Division</option>';
    }
  };

  // The listener is attached per checkbox now

  async function loadStudentData() {
    try {
      const studentDoc = await getDoc(doc(db, "students", studentId));
      if (!studentDoc.exists()) {
        toast('Student not found.', 'error');
        return;
      }
      currentStudentData = studentDoc.data();
      const data = currentStudentData;

      // Basic Info
      const nameField = document.getElementById('name') || document.getElementById('studentName');
      if (nameField) nameField.value = data.name || '';
      const parentField = document.getElementById('parentName') || document.getElementById('fatherName');
      if (parentField) parentField.value = data.parentName || data.fatherName || '';
      const placeField = document.getElementById('place') || document.getElementById('address');
      if (placeField) placeField.value = data.place || data.address || '';
      if (document.getElementById('dob')) document.getElementById('dob').value = data.dob || '';
      if (document.getElementById('gender')) document.getElementById('gender').value = data.gender || '';
      if (document.getElementById('phone')) document.getElementById('phone').value = data.phone || '';
      if (document.getElementById('whatsapp')) document.getElementById('whatsapp').value = data.whatsapp || '';
      if (document.getElementById('email')) document.getElementById('email').value = data.email || '';
      if (document.getElementById('status')) document.getElementById('status').value = data.status || 'active';

      // Academic Info
      if (data.courses && Array.isArray(data.courses)) {
        Array.from(document.querySelectorAll('input[name="courseTypeCb"]')).forEach(cb => {
          if (data.courses.includes(cb.value)) {
             cb.checked = true;
             const select = document.querySelector(`select[data-course="${cb.value}"]`);
             if(select) {
                select.style.display = 'block';
                if(data.courseTutors && data.courseTutors[cb.value]) {
                   select.value = data.courseTutors[cb.value];
                } else if(data.tutorId) {
                   select.value = data.tutorId; // fallback for legacy data
                }
             }
          }
        });
        updateDivisionsDropdown(data.courses, data.division || data.batch);
      } else if (data.course || data.courseType) {
        const val = data.course || data.courseType;
        const cb = document.querySelector(`input[name="courseTypeCb"][value="${val}"]`);
        if(cb) {
           cb.checked = true;
           const select = document.querySelector(`select[data-course="${val}"]`);
           if(select) {
              select.style.display = 'block';
              if(data.tutorId) select.value = data.tutorId;
           }
        }
        updateDivisionsDropdown([val], data.division || data.batch);
      }
      if (document.getElementById('level')) document.getElementById('level').value = data.level || '';

      if (document.getElementById('admissionDate')) document.getElementById('admissionDate').value = data.admissionDate || '';
      const classStartField = document.getElementById('classStartingDate') || document.getElementById('classStartDate');
      if (classStartField) classStartField.value = data.classStartingDate || data.classStartDate || '';
      if (document.getElementById('monthlyFee')) document.getElementById('monthlyFee').value = data.monthlyFee || '';

    } catch (error) {
      console.error("Error loading student:", error);
      toast('Failed to load student data.', 'error');
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Updating...';

    const selectedCourses = Array.from(document.querySelectorAll('input[name="courseTypeCb"]:checked')).map(cb => cb.value);
    const courseName = selectedCourses.length > 0 ? selectedCourses[0] : '';
    const courseObj = allCourses.find(c => c.courseName === courseName);

    const courseTutors = {};
    selectedCourses.forEach(cName => {
       const select = document.querySelector(`select[data-course="${cName}"]`);
       if(select && select.value) {
          courseTutors[cName] = select.value;
       }
    });

    try {
      const studentNameVal = document.getElementById('name')?.value.trim() || document.getElementById('studentName')?.value.trim() || '';
      const parentNameVal = document.getElementById('parentName')?.value.trim() || document.getElementById('fatherName')?.value.trim() || '';
      const placeVal = document.getElementById('place')?.value.trim() || document.getElementById('address')?.value.trim() || '';
      const admissionDateVal = document.getElementById('admissionDate')?.value || '';
      const classDateVal = document.getElementById('classStartingDate')?.value || document.getElementById('classStartDate')?.value || '';

      const studentData = {
        name: studentNameVal,
        parentName: parentNameVal,
        place: placeVal,
        address: placeVal,
        dob: document.getElementById('dob')?.value || '',
        gender: document.getElementById('gender')?.value || '',
        phone: document.getElementById('phone')?.value.trim() || '',
        whatsapp: document.getElementById('whatsapp')?.value.trim() || '',
        email: document.getElementById('email')?.value || '',
        
        courses: selectedCourses,
        courseTutors: courseTutors,
        course: courseName,
        courseType: courseName,
        courseId: courseObj ? courseObj.id : null,
        division: divisionSelect.value,
        level: document.getElementById('level')?.value.trim() || '',
        
        admissionDate: admissionDateVal,
        admissionStatus: admissionDateVal ? 'accepted' : (currentStudentData?.admissionStatus || 'pending'),
        classStartingDate: classDateVal,
        classStartDate: classDateVal,
        monthlyFee: parseFloat(document.getElementById('monthlyFee')?.value) || 0,
        
        fatherName: parentNameVal,
        fatherOccupation: document.getElementById('fatherOccupation')?.value || '',
        fatherPhone: document.getElementById('fatherPhone')?.value || document.getElementById('phone')?.value || '',
        motherName: document.getElementById('motherName')?.value || '',
        motherPhone: document.getElementById('motherPhone')?.value || '',
        
        status: document.getElementById('status')?.value || 'active',
        updatedAt: serverTimestamp()
      };

      // Optional file uploads logic here if needed
      
      await updateDoc(doc(db, "students", studentId), studentData);
      
      toast('Student updated successfully!', 'success');
      setTimeout(() => {
        window.location.href = 'students.html';
      }, 1500);

    } catch (error) {
      console.error("Error updating student:", error);
      toast('Failed to update student.', 'error');
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });

  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if(confirm('Are you sure you want to delete this student? This action cannot be undone.')) {
        try {
          deleteBtn.disabled = true;
          deleteBtn.textContent = 'Deleting...';
          await deleteDoc(doc(db, "students", studentId));
          toast('Student deleted successfully', 'success');
          setTimeout(() => {
            window.location.href = 'students.html';
          }, 1500);
        } catch(error) {
          console.error("Error deleting student:", error);
          toast('Failed to delete student', 'error');
          deleteBtn.disabled = false;
          deleteBtn.textContent = 'Delete Student';
        }
      }
    });
  }
});
