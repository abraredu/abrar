// js/bulk-upload-students.js
import { db, auth } from './firebase-config.js';
import {
  collection, doc, runTransaction, serverTimestamp, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const STUDENT_TEMPLATE_HEADERS = [
  'name', 'parentName', 'phone', 'whatsapp', 'place',
  'courseType', 'tutors', 'level', 'admissionDate', 'classStartingDate', 'monthlyFee', 'status'
];

const COURSE_TYPE_OPTIONS = [
  { value: 'madrasa_group',      label: 'Madrasa Group' },
  { value: 'madrasa_individual', label: 'Madrasa Individual' },
  { value: 'quran_recitation',   label: "Qur'an Recitation" }
];

const STATUS_OPTIONS = [
  { value: 'active',   label: 'Active' },
  { value: 'inactive', label: 'Inactive' }
];

// Required fields for validation
const REQUIRED = ['name', 'phone', 'courseType', 'monthlyFee'];

document.addEventListener('DOMContentLoaded', () => {
  const uploadZone     = document.getElementById('uploadZone');
  const browseLink     = document.getElementById('browseLink');
  const csvInput       = document.getElementById('csvFileInput');
  const fileNameDisplay= document.getElementById('fileNameDisplay');
  const previewSection = document.getElementById('previewSection');
  const previewTbody   = document.getElementById('previewTbody');
  const previewStats   = document.getElementById('previewStats');
  const addRowBtn      = document.getElementById('addRowBtn');
  const clearAllBtn    = document.getElementById('clearAllBtn');
  const submitBulkBtn  = document.getElementById('submitBulkBtn');
  const downloadBtn    = document.getElementById('downloadTemplateBtn');
  const successOverlay = document.getElementById('successOverlay');
  const successMsg     = document.getElementById('successMsg');
  const submitProgress = document.getElementById('submitProgress');
  const progressFill   = document.getElementById('progressFill');
  const progressLabel  = document.getElementById('progressLabel');
  const errorWarning   = document.getElementById('errorWarning');

  let rows = []; // Array of row data objects

  let classesMap = {}; // mapping of lowercase className or level to classId

  // ── Auth guard ──
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = '../index.html';
    } else {
      // Fetch classes for mapping level to classId
      try {
        const classesQ = query(collection(db, "classes"), where("status", "==", "active"));
        const classSnapshot = await getDocs(classesQ);
        classSnapshot.forEach(doc => {
          const d = doc.data();
          if (d.className) classesMap[d.className.toLowerCase().trim()] = doc.id;
          if (d.level) classesMap[d.level.toLowerCase().trim()] = doc.id;
        });
      } catch (err) {
        console.error("Error fetching classes for mapping:", err);
      }
    }
  });

  // ── Step indicator ──
  function setStep(n) {
    for (let i = 1; i <= 4; i++) {
      const el = document.getElementById('step' + i);
      if (!el) continue;
      el.classList.remove('active', 'done');
      if (i < n)  el.classList.add('done');
      if (i === n) el.classList.add('active');
    }
  }
  setStep(1);

  // ── Download CSV Template ──
  downloadBtn.addEventListener('click', () => {
    // Build sample rows with realistic placeholder data
    const sampleRows = [
      ['Ahmad Ali', 'Mohammed Ali', '9876543210', '9876543210', 'Kozhikode', 'madrasa_individual', 'safwan', '3', '2025-01-15', '2025-02-01', '1200', 'active'],
      ['Fathima Noor', 'Ibrahim Noor', '9123456789', '9123456789', 'Calicut', 'madrasa_group,madrasa_individual', 'safwan,ayishad', '', '2025-03-10', '2025-03-20', '800', 'active'],
      ['Zainab Khan', 'Yusuf Khan', '9988776655', '', 'Malappuram', 'quran_recitation', '', '2', '2025-04-01', '2025-04-15', '900', 'active']
    ];
    const header = STUDENT_TEMPLATE_HEADERS.join(',');
    const csvContent = [header, ...sampleRows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'abrar_students_template.csv';
    a.click();
    URL.revokeObjectURL(url);
    setStep(2);
  });

  // ── Drag & Drop ──
  uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  uploadZone.addEventListener('click', () => csvInput.click());
  browseLink.addEventListener('click', (e) => { e.stopPropagation(); csvInput.click(); });
  csvInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });

  function getTodayDateString() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // ── Parse CSV ──
  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const result  = [];
    const todayStr = getTodayDateString();
    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVLine(lines[i]);
      const row  = {};
      STUDENT_TEMPLATE_HEADERS.forEach((key, idx) => {
        // Match by position if headers match our template, else try by header name
        const hIdx = headers.indexOf(key);
        let val = (hIdx !== -1 ? vals[hIdx] : vals[idx] || '').trim();
        // Default empty date inputs to today's date string
        if ((key === 'admissionDate' || key === 'classStartingDate') && !val) {
          val = todayStr;
        }
        row[key] = val;
      });
      result.push(row);
    }
    return result;
  }

  function parseCSVLine(line) {
    const result = [];
    let current  = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }

  function handleFile(file) {
    if (!file.name.endsWith('.csv')) {
      alert('Please upload a .csv file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseCSV(e.target.result);
      rows = parsed.map(r => ({ ...r }));
      fileNameDisplay.textContent = `✓ ${file.name} — ${rows.length} row(s) loaded`;
      fileNameDisplay.style.display = 'block';
      setStep(3);
      renderPreview();
    };
    reader.readAsText(file);
  }

  // ── Validate a row ──
  function validateRow(row) {
    const errors = {};
    REQUIRED.forEach(f => {
      if (!row[f] || row[f].toString().trim() === '') errors[f] = 'Required';
    });
    if (row.phone && !/^\d{7,15}$/.test(row.phone.trim())) errors.phone = 'Invalid phone';
    if (row.monthlyFee && isNaN(parseFloat(row.monthlyFee))) errors.monthlyFee = 'Must be a number';
    return errors; // empty = valid
  }

  // ── Render preview table ──
  function renderPreview() {
    previewTbody.innerHTML = '';
    let validCount = 0;
    let errorCount = 0;

    rows.forEach((row, idx) => {
      const errors = validateRow(row);
      const hasError = Object.keys(errors).length > 0;
      if (hasError) errorCount++; else validCount++;

      const tr = document.createElement('tr');
      if (hasError) tr.classList.add('row-error');

      // Row number + status icon
      const tdNum = document.createElement('td');
      tdNum.style.textAlign = 'center';
      tdNum.style.fontWeight = '600';
      tdNum.style.color = hasError ? '#dc2626' : '#16a34a';
      tdNum.innerHTML = `<span style="font-size:0.75rem;">${idx + 1}</span>`;
      tr.appendChild(tdNum);

      // Editable cells
      const fieldDefs = [
        { key: 'name',             type: 'text' },
        { key: 'parentName',       type: 'text' },
        { key: 'phone',            type: 'text' },
        { key: 'whatsapp',         type: 'text' },
        { key: 'place',            type: 'text' },
        { key: 'courseType',       type: 'text' },
        { key: 'tutors',           type: 'text' },
        { key: 'level',            type: 'text' },
        { key: 'admissionDate',    type: 'text' },
        { key: 'classStartingDate',type: 'text' },
        { key: 'monthlyFee',       type: 'number' },
        { key: 'status',           type: 'select', options: STATUS_OPTIONS }
      ];

      fieldDefs.forEach(({ key, type, options }) => {
        const td = document.createElement('td');
        let input;
        if (type === 'select') {
          input = document.createElement('select');
          const emptyOpt = document.createElement('option');
          emptyOpt.value = '';
          emptyOpt.textContent = '-- Select --';
          input.appendChild(emptyOpt);
          options.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = opt.label;
            if (row[key] === opt.value) o.selected = true;
            input.appendChild(o);
          });
        } else {
          input = document.createElement('input');
          input.type  = type;
          input.value = row[key] || '';
          if (type === 'number') input.min = '0';
        }
        if (errors[key]) input.classList.add('field-error');
        input.title = errors[key] || '';
        input.addEventListener('change', () => {
          rows[idx][key] = input.value;
          // Re-render only the stats (don't re-render full table — too disruptive)
          updateStats();
          // Re-validate this row
          const newErrors = validateRow(rows[idx]);
          const rowHasErr = Object.keys(newErrors).length > 0;
          tr.classList.toggle('row-error', rowHasErr);
          tdNum.style.color = rowHasErr ? '#dc2626' : '#16a34a';
          // Update field error class
          td.querySelectorAll('input, select').forEach(el => el.classList.remove('field-error'));
          Object.keys(newErrors).forEach(errKey => {
            // Handled within field
          });
          input.classList.toggle('field-error', !!newErrors[key]);
        });
        td.appendChild(input);
        tr.appendChild(td);
      });

      // Delete row button
      const tdDel = document.createElement('td');
      const delBtn = document.createElement('button');
      delBtn.className = 'row-delete-btn';
      delBtn.title = 'Remove row';
      delBtn.innerHTML = '<i data-lucide="trash-2" style="width:14px;height:14px;"></i>';
      delBtn.addEventListener('click', () => {
        rows.splice(idx, 1);
        renderPreview();
      });
      tdDel.appendChild(delBtn);
      tr.appendChild(tdDel);

      previewTbody.appendChild(tr);
    });

    lucide.createIcons();
    updateStats(validCount, errorCount);
    previewSection.classList.add('visible');
    // Scroll to preview
    previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function updateStats(validCount, errorCount) {
    if (validCount === undefined) {
      validCount = 0; errorCount = 0;
      rows.forEach(r => {
        const e = validateRow(r);
        if (Object.keys(e).length > 0) errorCount++; else validCount++;
      });
    }
    const total = rows.length;
    previewStats.innerHTML = `
      <div class="preview-stat"><span class="badge badge-total">${total}</span> Total</div>
      <div class="preview-stat"><span class="badge badge-valid">${validCount}</span> Valid</div>
      ${errorCount > 0 ? `<div class="preview-stat"><span class="badge badge-error">${errorCount}</span> Errors</div>` : ''}
    `;
    errorWarning.style.display = errorCount > 0 ? 'inline-flex' : 'none';
  }

  addRowBtn.addEventListener('click', () => {
    const todayStr = getTodayDateString();
    rows.push({ name:'', parentName:'', phone:'', whatsapp:'', place:'', courseType:'', tutors:'', level:'', admissionDate: todayStr, classStartingDate: todayStr, monthlyFee:'', status:'active' });
    renderPreview();
    // Scroll to last row
    setTimeout(() => {
      const lastRow = previewTbody.lastElementChild;
      if (lastRow) lastRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  });

  // ── Clear all ──
  clearAllBtn.addEventListener('click', () => {
    if (!confirm('Clear all rows? This cannot be undone.')) return;
    rows = [];
    previewSection.classList.remove('visible');
    fileNameDisplay.style.display = 'none';
    csvInput.value = '';
    setStep(2);
  });

  // ── Submit ──
  submitBulkBtn.addEventListener('click', async () => {
    // Re-validate
    const errors = rows.map(r => validateRow(r));
    const hasAnyError = errors.some(e => Object.keys(e).length > 0);
    if (hasAnyError) {
      errorWarning.style.display = 'inline-flex';
      renderPreview(); // re-render to show updated errors
      return;
    }
    if (rows.length === 0) {
      alert('No rows to submit.');
      return;
    }

    setStep(4);
    submitBulkBtn.disabled = true;
    addRowBtn.disabled     = true;
    clearAllBtn.disabled   = true;
    submitProgress.classList.add('visible');

    let uploaded = 0;
    const total  = rows.length;

    // Prefix counter cache
    const prefixCounts = {};

    try {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        // Determine prefix
        let prefix = 'ABR';
        if (row.courseType.includes('madrasa_individual')) prefix = 'AMO';
        else if (row.courseType.includes('quran_recitation')) prefix = 'AQO';
        else if (row.courseType.includes('madrasa_group'))  prefix = 'AMG';

        // Try to map level to classId for group tuition
        let matchedClassId = '';
        if (prefix === 'AMG' && row.level) {
          const searchStr = row.level.toLowerCase().trim();
          matchedClassId = classesMap[searchStr] || '';
        }

        const counterRef = doc(db, 'counters', 'students');
        const newId = await runTransaction(db, async (transaction) => {
          const counterDoc = await transaction.get(counterRef);
          let newCount = 1;
          if (counterDoc.exists()) {
            const data = counterDoc.data();
            newCount = (data[prefix] || 0) + 1;
            transaction.update(counterRef, { [prefix]: newCount });
          } else {
            transaction.set(counterRef, { [prefix]: newCount });
          }
          const formattedId = `${prefix}${newCount.toString().padStart(3, '0')}`;
          const studentRef  = doc(collection(db, 'students'));
          const studentData = {
            studentId:        formattedId,
            name:             row.name || '',
            parentName:       row.parentName || '',
            phone:            row.phone || '',
            whatsapp:         row.whatsapp || row.phone || '',
            place:            row.place || '',
            courseType:       row.courseType || '',
            level:            row.level || '',
            tutorId:          row.tutors || '',
            classId:          matchedClassId,
            admissionDate:    row.admissionDate || '',
            classStartingDate:row.classStartingDate || '',
            monthlyFee:       parseFloat(row.monthlyFee) || 0,
            status:           row.status || 'active',
            photoUrl:         null,
            idDocumentUrl:    null,
            createdAt:        serverTimestamp(),
            createdBy:        auth.currentUser ? auth.currentUser.uid : 'system'
          };
          transaction.set(studentRef, studentData);
          return formattedId;
        });

        uploaded++;
        const pct = Math.round((uploaded / total) * 100);
        progressFill.style.width  = pct + '%';
        progressLabel.textContent = `Uploading ${uploaded} / ${total} students...`;
      }

      // Done!
      successMsg.textContent = `${uploaded} student${uploaded !== 1 ? 's' : ''} have been added to the system successfully.`;
      successOverlay.classList.add('visible');
      lucide.createIcons();

    } catch (err) {
      console.error('Bulk upload error:', err);
      alert('Error during upload: ' + err.message);
      submitBulkBtn.disabled = false;
      addRowBtn.disabled     = false;
      clearAllBtn.disabled   = false;
      submitProgress.classList.remove('visible');
      setStep(3);
    }
  });
});
