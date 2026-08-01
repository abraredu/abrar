// js/reports.js
import { db } from './firebase-config.js';
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('reportForm');
  const typeSelect = document.getElementById('reportType');
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');
  const thead = document.getElementById('reportThead');
  const tbody = document.getElementById('reportTbody');
  const title = document.getElementById('reportTitle');
  const summary = document.getElementById('reportSummary');
  const exportBtn = document.getElementById('exportCsvBtn');

  // Set default dates (first day of current month to today)
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  startDateInput.value = firstDay.toISOString().split('T')[0];
  endDateInput.value = now.toISOString().split('T')[0];

  let currentReportData = [];
  let currentColumns = [];

  const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    exportBtn.disabled = true;
    tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem;">Generating report...</td></tr>';
    summary.textContent = '';
    
    const type = typeSelect.value;
    const start = startDateInput.value;
    const end = endDateInput.value;
    
    try {
      if (type === 'financial') {
        await generateFinancialReport(start, end);
      } else if (type === 'fees') {
        await generateFeesReport(start, end);
      } else if (type === 'salaries') {
        await generateSalariesReport(start, end);
      } else if (type === 'students') {
        await generateStudentsReport(); // Date mostly irrelevant for active roster
      }
      
      if (currentReportData.length > 0) {
        exportBtn.disabled = false;
      }
    } catch (error) {
      console.error("Error generating report:", error);
      tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 2rem; color: var(--color-danger);">Error: ${error.message}</td></tr>`;
    }
  });

  async function generateFinancialReport(start, end) {
    title.textContent = `Financial Transactions (${start} to ${end})`;
    currentColumns = ['Date', 'Type', 'Category', 'Description', 'Reference', 'Amount'];
    
    const q = query(collection(db, "transactions"), orderBy("date", "desc"));
    const snap = await getDocs(q);
    
    currentReportData = [];
    let net = 0;
    
    snap.forEach(doc => {
      const data = doc.data();
      if ((!start || data.date >= start) && (!end || data.date <= end)) {
        currentReportData.push([
          data.date, 
          data.type, 
          data.category || '', 
          data.description || '', 
          data.referenceNumber || '', 
          data.amount || 0
        ]);
        net += (data.type === 'income' ? data.amount : -data.amount);
      }
    });
    
    renderTable();
    summary.textContent = `Net Surplus: ${formatter.format(net)}`;
  }

  async function generateFeesReport(start, end) {
    title.textContent = `Fee Collections (${start} to ${end})`;
    currentColumns = ['Payment Date', 'Billing Month', 'Receipt', 'Student ID', 'Method', 'Amount Paid'];
    
    const q = query(collection(db, "payments"), orderBy("paymentDate", "desc"));
    const snap = await getDocs(q);
    
    currentReportData = [];
    let total = 0;
    
    snap.forEach(doc => {
      const data = doc.data();
      if ((!start || data.paymentDate >= start) && (!end || data.paymentDate <= end)) {
        currentReportData.push([
          data.paymentDate,
          data.billingMonth || '',
          data.receiptNumber || '',
          data.studentId || '',
          data.paymentMethod || '',
          data.paidAmount || 0
        ]);
        total += (data.paidAmount || 0);
      }
    });
    
    renderTable();
    summary.textContent = `Total Collected: ${formatter.format(total)}`;
  }

  async function generateSalariesReport(start, end) {
    title.textContent = `Salary Payouts (${start} to ${end})`;
    currentColumns = ['Payment Date', 'Month', 'Tutor ID', 'Method', 'Base Calc', 'Adjustment', 'Paid'];
    
    const q = query(collection(db, "salaryPayments"), orderBy("paymentDate", "desc"));
    const snap = await getDocs(q);
    
    currentReportData = [];
    let total = 0;
    
    snap.forEach(doc => {
      const data = doc.data();
      if ((!start || data.paymentDate >= start) && (!end || data.paymentDate <= end)) {
        currentReportData.push([
          data.paymentDate,
          data.month || '',
          data.tutorId || '',
          data.paymentMethod || '',
          data.calculatedAmount || 0,
          data.adjustment || 0,
          data.paidAmount || 0
        ]);
        total += (data.paidAmount || 0);
      }
    });
    
    renderTable();
    summary.textContent = `Total Paid: ${formatter.format(total)}`;
  }

  async function generateStudentsReport() {
    title.textContent = `Active Students Roster`;
    currentColumns = ['Student ID', 'Name', 'Course Type', 'Class Level', 'Tutor', 'Monthly Fee', 'Admission Date'];
    
    const q = query(collection(db, "students"), where("status", "==", "active"));
    const snap = await getDocs(q);
    
    currentReportData = [];
    
    snap.forEach(doc => {
      const data = doc.data();
      currentReportData.push([
        data.studentId,
        data.name,
        data.courseType ? data.courseType.replace(/_/g, ' ') : '',
        data.level || data.classId || '',
        data.tutorId || '',
        data.monthlyFee || 0,
        data.admissionDate || ''
      ]);
    });
    
    renderTable();
    summary.textContent = `Total Active Students: ${currentReportData.length}`;
  }

  function renderTable() {
    if (currentReportData.length === 0) {
      thead.innerHTML = '';
      tbody.innerHTML = '<tr><td style="text-align: center; padding: 2rem;">No data found for this range.</td></tr>';
      return;
    }

    // Render Headers
    thead.innerHTML = `<tr style="border-bottom: 1px solid var(--color-border);">
      ${currentColumns.map(col => `<th style="padding: 0.75rem; font-weight: 600; color: var(--color-text-secondary);">${col}</th>`).join('')}
    </tr>`;

    // Render Rows
    tbody.innerHTML = currentReportData.map(row => {
      return `<tr style="border-bottom: 1px solid var(--color-border);">
        ${row.map(cell => `<td style="padding: 0.75rem;">${cell}</td>`).join('')}
      </tr>`;
    }).join('');
  }

  // CSV Export Logic
  exportBtn.addEventListener('click', () => {
    if (currentReportData.length === 0) return;
    
    // Build CSV String
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Header
    csvContent += currentColumns.join(",") + "\n";
    
    // Data
    currentReportData.forEach(rowArray => {
      let row = rowArray.map(cell => {
        // Escape quotes and wrap in quotes if necessary
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      });
      csvContent += row.join(",") + "\n";
    });
    
    // Download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const safeTitle = title.textContent.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.setAttribute("download", `abrar_report_${safeTitle}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
});
