import { toast } from './toast.js';
// js/add-tutor.js
import { db, auth } from './firebase-config.js';
import { collection, doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { uploadToCloudinary } from './cloudinary-config.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('addTutorForm');
  const submitBtn = document.getElementById('submitBtn');


  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Uploading files (if any)...';
    
    let photoUrl = null;
    let idDocumentUrl = null;
    
    const photoFile = document.getElementById('photo').files[0];
    const idDocFile = document.getElementById('idDocument').files[0];
    
    if (photoFile) {
      photoUrl = await uploadToCloudinary(photoFile);
    }
    if (idDocFile) {
      idDocumentUrl = await uploadToCloudinary(idDocFile);
    }
    
    submitBtn.textContent = 'Saving Record...';

    const tutorTypeCheckboxes = document.querySelectorAll('.tutor-type-checkbox:checked');
    const tutorType = Array.from(tutorTypeCheckboxes).map(cb => cb.value);
    
    if (tutorType.length === 0) {
      toast.success('Please select at least one Tutor Type.');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }
    
    // Determine prefix based on the primary tutorType
    let prefix = 'MO'; // Madrasa One-to-One
    if (tutorType.includes('madrasa_group')) prefix = 'MG';
    else if (tutorType.includes('quran_recitation')) prefix = 'AQR';
    if (tutorType.includes('madrasa_individual')) prefix = 'MO';

    try {
      const counterRef = doc(db, 'counters', 'tutors');
      
      const newTutorId = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        
        let newCount = 1;
        if (counterDoc.exists()) {
          const data = counterDoc.data();
          newCount = (data[prefix] || 0) + 1;
          transaction.update(counterRef, { [prefix]: newCount });
        } else {
          transaction.set(counterRef, { [prefix]: newCount });
        }

        // Format ID, e.g., MO1, AQR2
        const formattedId = `${prefix}${newCount}`;
        
        const tutorRef = doc(collection(db, 'tutors'));
        const tutorData = {
          tutorId: formattedId,
          name: document.getElementById('name').value,
          phone: document.getElementById('phone').value,
          whatsapp: document.getElementById('whatsapp').value,
          email: document.getElementById('email').value,
          address: document.getElementById('address').value,
          tutorType: tutorType,
          joiningDate: document.getElementById('joiningDate').value,
          loginUsername: document.getElementById('loginUsername') ? document.getElementById('loginUsername').value : '',
          loginPassword: document.getElementById('loginPassword') ? document.getElementById('loginPassword').value : '',
          status: 'active',
          photoUrl: photoUrl,
          idDocumentUrl: idDocumentUrl,
          createdAt: serverTimestamp(),
          createdBy: auth.currentUser ? auth.currentUser.uid : 'system'
        };

        transaction.set(tutorRef, tutorData);
        return formattedId;
      });

      toast.success(`Tutor saved successfully! ID: ${newTutorId}`);
      window.location.href = 'tutors.html';
      
    } catch (error) {
      console.error("Error adding tutor: ", error);
      toast.error('Error saving tutor: ' + error.message);
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
});
