// js/bulk-upload-tutors.js
import { db, auth } from './firebase-config.js';
import {
  collection, doc, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ── CSV Template columns ──
const TUTOR_TEMPLATE_HEADERS = [
  'tutorId', 'name', 'phone', 'whatsapp', 'email', 'address',
  'tutorType', 'joiningDate', 'loginUsername', 'status'
];

// tutorType valid values (comma-separated in CSV)
const VALID_TUTOR_TYPES = ['madrasa_individual', 'madrasa_group', 'quran_recitation'];

const STATUS_OPTIONS = [
  { value: 'active',   label: 'Active' },
  { value: 'inactive', label: 'Inactive' }
];

const REQUIRED_FIELDS = ['name', 'phone', 'tutorType'];

document.addEventListener('DOMContentLoaded', () => {
  const uploadZone      = document.getElementById('uploadZone');
  const browseLink      = document.getElementById('browseLink');
  const csvInput        = document.getElementById('csvFileInput');
  const fileNameDisplay = document.getElementById('fileNameDisplay');
  const previewSection  = document.getElementById('previewSection');
  const previewTbody    = document.getElementById('previewTbody');
  const previewStats    = document.getElementById('previewStats');
  const addRowBtn       = document.getElementById('addRowBtn');
  const clearAllBtn     = document.getElementById('clearAllBtn');
  const submitBulkBtn   = document.getElementById('submitBulkBtn');
  const downloadBtn     = document.getElementById('downloadTemplateBtn');
  const successOverlay  = document.getElementById('successOverlay');
  const successMsg      = document.getElementById('successMsg');
  const submitProgress  = document.getElementById('submitProgress');
  const progressFill    = document.getElementById('progressFill');
  const progressLabel   = document.getElementById('progressLabel');
  const errorWarning    = document.getElementById('errorWarning');

  let rows = [];

  // ── Auth guard ──
  onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = '../index.html';
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
    const sampleRows = [
      ['AM025', 'Umar Farouq', '9876543210', '9876543210', 'umar@example.com', 'Kozhikode', 'madrasa_individual', '2025-01-10', 'umar.farouq', 'active'],
      ['MG007', 'Fatima Hassan', '9123456789', '', 'fatima@example.com', 'Calicut', 'madrasa_group,quran_recitation', '2025-03-01', 'fatima.h', 'active'],
      ['AQR021', 'Ibrahim Saad', '9988776655', '9988776655', '', 'Malappuram', 'quran_recitation', '2025-05-15', 'ibrahim.s', 'active']
    ];
    const header = TUTOR_TEMPLATE_HEADERS.join(',');
    const csvContent = [header, ...sampleRows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'abrar_tutors_template.csv';
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

  function normalizeTutorType(val) {
    if (!val) return '';
    return val.split(',').map(t => {
      const cleanType = t.trim().toLowerCase();
      if (cleanType === 'madrasa_grc' || cleanType === 'madrasa_group' || cleanType === 'group' || cleanType === 'madrasagroup') {
        return 'madrasa_group';
      }
      if (cleanType === 'madrasa_ind' || cleanType === 'madrasa_individual' || cleanType === 'individual' || cleanType === 'one_to_one' || cleanType === 'madrasa_one_to_one' || cleanType === 'madrasaindividual') {
        return 'madrasa_individual';
      }
      if (cleanType === 'quran' || cleanType === 'quran_recitation' || cleanType === 'recitation' || cleanType === 'quranrecitation') {
        return 'quran_recitation';
      }
      return t.trim();
    }).join(', ');
  }

  // ── Parse CSV ──
  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    
    // Normalize header values to lowercase alphanumeric (e.g. 'Tutor ID' -> 'tutorid')
    const rawHeaders = parseCSVLine(lines[0]);
    const headers = rawHeaders.map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
    
    const result  = [];
    const todayStr = getTodayDateString();
    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVLine(lines[i]);
      const row  = {};
      TUTOR_TEMPLATE_HEADERS.forEach((key, idx) => {
        const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        let hIdx = headers.indexOf(normKey);
        
        // Also support 'userid' mapping to 'loginusername'
        if (hIdx === -1 && normKey === 'loginusername') {
          hIdx = headers.indexOf('userid');
        }
        
        let val = (hIdx !== -1 ? vals[hIdx] : vals[idx] || '').trim();
        // Default empty joiningDate to today's date
        if (key === 'joiningDate' && !val) {
          val = todayStr;
        }
        // Normalize tutorType abbreviation/aliases
        if (key === 'tutorType') {
          val = normalizeTutorType(val);
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
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
      else { current += ch; }
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

  // ── Validate row ──
  function validateRow(row) {
    const errors = {};
    REQUIRED_FIELDS.forEach(f => {
      if (!row[f] || row[f].toString().trim() === '') errors[f] = 'Required';
    });
    if (row.phone && !/^\d{7,15}$/.test(row.phone.trim())) errors.phone = 'Invalid phone';
    if (row.tutorType) {
      const types = row.tutorType.split(',').map(t => t.trim());
      const invalid = types.filter(t => t && !VALID_TUTOR_TYPES.includes(t));
      if (invalid.length > 0) errors.tutorType = 'Invalid type(s): ' + invalid.join(', ');
    }
    return errors;
  }

  // ── Render preview ──
  function renderPreview() {
    previewTbody.innerHTML = '';
    let validCount = 0;
    let errorCount = 0;

    rows.forEach((row, idx) => {
      const errors   = validateRow(row);
      const hasError = Object.keys(errors).length > 0;
      if (hasError) errorCount++; else validCount++;

      const tr = document.createElement('tr');
      if (hasError) tr.classList.add('row-error');

      // Row number
      const tdNum = document.createElement('td');
      tdNum.style.textAlign = 'center';
      tdNum.style.fontWeight = '600';
      tdNum.style.color = hasError ? '#dc2626' : '#1d4ed8';
      tdNum.innerHTML = `<span style="font-size:0.75rem;">${idx + 1}</span>`;
      tr.appendChild(tdNum);

      // Field definitions
      const fieldDefs = [
        { key: 'tutorId',       type: 'text', placeholder: 'Auto-generated' },
        { key: 'name',          type: 'text' },
        { key: 'phone',         type: 'text' },
        { key: 'whatsapp',      type: 'text' },
        { key: 'email',         type: 'email' },
        { key: 'address',       type: 'text' },
        { key: 'tutorType',     type: 'tutortype' }, // special multi-type
        { key: 'joiningDate',   type: 'text', placeholder: 'YYYY-MM-DD' },
        { key: 'loginUsername', type: 'text', placeholder: 'Defaults to ID' },
        { key: 'status',        type: 'select', options: STATUS_OPTIONS }
      ];

      fieldDefs.forEach(({ key, type, options, placeholder }) => {
        const td = document.createElement('td');

        if (type === 'tutortype') {
          // Render as a compact text field showing comma-separated values
          // (simpler than 3 checkboxes in a tiny table cell — user can type directly)
          const input = document.createElement('input');
          input.type  = 'text';
          input.value = row[key] || '';
          input.placeholder = 'madrasa_individual';
          input.title = errors[key] || 'Comma-separated: madrasa_individual, madrasa_group, quran_recitation';
          if (errors[key]) input.classList.add('field-error');
          input.addEventListener('change', () => {
            rows[idx][key] = normalizeTutorType(input.value);
            input.value = rows[idx][key];
            updateAndRevalidateRow(idx, tr, tdNum);
            const newErrors = validateRow(rows[idx]);
            input.classList.toggle('field-error', !!newErrors[key]);
          });
          td.appendChild(input);
        } else if (type === 'select') {
          const input = document.createElement('select');
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
          if (errors[key]) input.classList.add('field-error');
          input.title = errors[key] || '';
          input.addEventListener('change', () => {
            rows[idx][key] = input.value;
            updateAndRevalidateRow(idx, tr, tdNum);
            const newErrors = validateRow(rows[idx]);
            input.classList.toggle('field-error', !!newErrors[key]);
          });
          td.appendChild(input);
        } else {
          const input = document.createElement('input');
          input.type  = type;
          input.value = row[key] || '';
          if (placeholder) input.placeholder = placeholder;
          if (errors[key]) input.classList.add('field-error');
          input.title = errors[key] || '';
          input.addEventListener('change', () => {
            rows[idx][key] = input.value;
            updateAndRevalidateRow(idx, tr, tdNum);
            const newErrors = validateRow(rows[idx]);
            input.classList.toggle('field-error', !!newErrors[key]);
          });
          td.appendChild(input);
        }

        tr.appendChild(td);
      });

      // Delete row
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
    previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function updateAndRevalidateRow(idx, tr, tdNum) {
    const newErrors = validateRow(rows[idx]);
    const hasErr    = Object.keys(newErrors).length > 0;
    tr.classList.toggle('row-error', hasErr);
    tdNum.style.color = hasErr ? '#dc2626' : '#1d4ed8';
    updateStats();
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

  // ── Add blank row ──
  addRowBtn.addEventListener('click', () => {
    const todayStr = getTodayDateString();
    rows.push({ tutorId:'', name:'', phone:'', whatsapp:'', email:'', address:'', tutorType:'', joiningDate: todayStr, loginUsername:'', status:'active' });
    renderPreview();
    setTimeout(() => {
      const lastRow = previewTbody.lastElementChild;
      if (lastRow) lastRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  });

  // ── Clear all ──
  clearAllBtn.addEventListener('click', () => {
    if (!confirm('Clear all rows?')) return;
    rows = [];
    previewSection.classList.remove('visible');
    fileNameDisplay.style.display = 'none';
    csvInput.value = '';
    setStep(2);
  });

  // ── Submit ──
  submitBulkBtn.addEventListener('click', async () => {
    const errors = rows.map(r => validateRow(r));
    const hasAnyError = errors.some(e => Object.keys(e).length > 0);
    if (hasAnyError) {
      errorWarning.style.display = 'inline-flex';
      renderPreview();
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

    try {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        // Parse tutorType (comma-separated string → array)
        const tutorTypeArr = (row.tutorType || '')
          .split(',')
          .map(t => t.trim())
          .filter(t => VALID_TUTOR_TYPES.includes(t));

        // Determine prefix
        let prefix = 'MO';
        if (tutorTypeArr.includes('madrasa_individual')) prefix = 'MO';
        if (tutorTypeArr.includes('madrasa_group'))      prefix = 'MG';
        if (tutorTypeArr.includes('quran_recitation'))   prefix = 'AQR';

        const counterRef = doc(db, 'counters', 'tutors');
        const newId = await runTransaction(db, async (transaction) => {
          let formattedId = (row.tutorId || '').trim();

          if (!formattedId) {
            const counterDoc = await transaction.get(counterRef);
            let newCount = 1;
            if (counterDoc.exists()) {
              const data = counterDoc.data();
              newCount = (data[prefix] || 0) + 1;
              transaction.update(counterRef, { [prefix]: newCount });
            } else {
              transaction.set(counterRef, { [prefix]: newCount });
            }
            formattedId = `${prefix}${newCount}`;
          }

          const tutorRef    = doc(collection(db, 'tutors'));
          const tutorData   = {
            tutorId:       formattedId,
            name:          row.name || '',
            phone:         row.phone || '',
            whatsapp:      row.whatsapp || row.phone || '',
            email:         row.email || '',
            address:       row.address || '',
            tutorType:     tutorTypeArr,
            joiningDate:   row.joiningDate || '',
            loginUsername: (row.loginUsername && row.loginUsername.trim()) ? row.loginUsername.trim() : formattedId,
            loginPassword: '',
            status:        row.status || 'active',
            photoUrl:      null,
            idDocumentUrl: null,
            createdAt:     serverTimestamp(),
            createdBy:     auth.currentUser ? auth.currentUser.uid : 'system'
          };
          transaction.set(tutorRef, tutorData);
          return formattedId;
        });

        uploaded++;
        const pct = Math.round((uploaded / total) * 100);
        progressFill.style.width  = pct + '%';
        progressLabel.textContent = `Uploading ${uploaded} / ${total} tutors...`;
      }

      successMsg.textContent = `${uploaded} tutor${uploaded !== 1 ? 's' : ''} have been added to the system successfully.`;
      successOverlay.classList.add('visible');
      lucide.createIcons();

    } catch (err) {
      console.error('Bulk tutor upload error:', err);
      alert('Error during upload: ' + err.message);
      submitBulkBtn.disabled = false;
      addRowBtn.disabled     = false;
      clearAllBtn.disabled   = false;
      submitProgress.classList.remove('visible');
      setStep(3);
    }
  });
});
