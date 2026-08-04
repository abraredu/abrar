// js/messages.js
import { db } from './firebase-config.js';
import { 
  collection, query, orderBy, getDocs, doc, updateDoc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { toast } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
  let allMessages = [];
  let currentFilter = 'all';
  
  const messagesTbody = document.getElementById('messagesTbody');
  const messageModal = document.getElementById('messageModal');
  const modalBody = document.getElementById('modalBody');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalReadBtn = document.getElementById('modalReadBtn');
  
  let activeMsg = null;

  // ── Load Messages from Firestore ──
  async function loadMessages() {
    try {
      messagesTbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 3rem; color: #64748b;">
            <div style="display:flex; flex-direction:column; align-items:center; gap:0.5rem;">
              <i data-lucide="loader" class="spin" style="width: 24px; height: 24px;"></i>
              <span>Loading messages...</span>
            </div>
          </td>
        </tr>
      `;
      lucide.createIcons();

      const messagesRef = collection(db, 'contact_messages');
      const q = query(messagesRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);

      allMessages = [];
      querySnapshot.forEach(docSnap => {
        allMessages.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });

      renderMessages();
    } catch (error) {
      console.error("Error loading messages:", error);
      messagesTbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2rem; color: #ef4444; font-weight: 500;">
            Failed to load messages from database.
          </td>
        </tr>
      `;
    }
  }

  // ── Render Message Table Rows ──
  function renderMessages() {
    const filtered = allMessages.filter(msg => {
      if (currentFilter === 'all') return true;
      return msg.status === currentFilter;
    });

    if (filtered.length === 0) {
      messagesTbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 4rem; color: #94a3b8;">
            <div style="display:flex; flex-direction:column; align-items:center; gap:0.5rem;">
              <i data-lucide="mail-open" style="width: 32px; height: 32px; color: #cbd5e1;"></i>
              <span style="font-weight: 500; font-size: 0.95rem;">No messages found.</span>
            </div>
          </td>
        </tr>
      `;
      lucide.createIcons();
      return;
    }

    messagesTbody.innerHTML = '';
    filtered.forEach(msg => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.className = msg.status === 'unread' ? 'unread-row' : '';
      if (msg.status === 'unread') {
        tr.style.fontWeight = '600';
        tr.style.background = '#f8fafc';
      }

      // Date Formatting
      let dateStr = '-';
      if (msg.createdAt) {
        const dateObj = msg.createdAt.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt);
        dateStr = dateObj.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }

      tr.innerHTML = `
        <td style="padding-left: 1.5rem; color: #1e293b;">${escapeHtml(msg.name)}</td>
        <td style="color: #475569;">${escapeHtml(msg.subject || 'No Subject')}</td>
        <td style="color: #64748b;">${escapeHtml(msg.phone || '-')}</td>
        <td style="color: #64748b;">${dateStr}</td>
        <td>
          <span class="message-status-badge status-${msg.status === 'unread' ? 'unread' : 'read'}">
            ${msg.status === 'unread' ? 'Unread' : 'Read'}
          </span>
        </td>
        <td style="text-align: right; padding-right: 1.5rem;">
          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.5rem;">
            <button class="btn btn-outline btn-sm view-btn" style="padding: 0.35rem 0.75rem; font-size: 0.75rem; border-color: #cbd5e1; color: #475569;">
              <i data-lucide="eye" style="width: 14px; height: 14px; margin-right: 4px;"></i> View
            </button>
            <button class="btn btn-danger btn-sm delete-btn" style="padding: 0.35rem; font-size: 0.75rem; background: #fee2e2; border-color: #fee2e2; color: #ef4444;">
              <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
            </button>
          </div>
        </td>
      `;

      // Click row to view
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.delete-btn')) {
          deleteMessage(msg.id);
        } else {
          viewMessage(msg);
        }
      });

      messagesTbody.appendChild(tr);
    });

    lucide.createIcons();
  }

  // ── Show Message Detail Modal ──
  async function viewMessage(msg) {
    activeMsg = msg;
    
    let dateStr = '-';
    if (msg.createdAt) {
      const dateObj = msg.createdAt.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt);
      dateStr = dateObj.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    modalBody.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 1.25rem;">
        <div class="modal-field">
          <span class="modal-label">Sender</span>
          <span class="modal-value" style="font-weight:600;">${escapeHtml(msg.name)}</span>
        </div>
        <div class="modal-field">
          <span class="modal-label">Date Submitted</span>
          <span class="modal-value">${dateStr}</span>
        </div>
        <div class="modal-field">
          <span class="modal-label">Email Address</span>
          <span class="modal-value"><a href="mailto:${escapeHtml(msg.email)}" style="color:#0284c7; text-decoration:none;">${escapeHtml(msg.email)}</a></span>
        </div>
        <div class="modal-field">
          <span class="modal-label">Phone Number</span>
          <span class="modal-value">${escapeHtml(msg.phone || '-')}</span>
        </div>
      </div>
      <div class="modal-field" style="border-bottom: 1px solid #f1f5f9; padding-bottom: 1.25rem;">
        <span class="modal-label">Subject</span>
        <span class="modal-value" style="font-weight:600; color:#0f172a;">${escapeHtml(msg.subject || 'No Subject')}</span>
      </div>
      <div class="modal-field">
        <span class="modal-label">Message Content</span>
        <span class="modal-value" style="white-space: pre-wrap; background: #f8fafc; padding: 1rem; border-radius: 0.5rem; border: 1px solid #f1f5f9; color: #334155;">${escapeHtml(msg.message)}</span>
      </div>
    `;

    // Configure Mark as Read button
    if (msg.status === 'unread') {
      modalReadBtn.style.display = 'block';
      modalReadBtn.textContent = 'Mark as Read';
    } else {
      modalReadBtn.style.display = 'none';
    }

    messageModal.classList.add('open');
    lucide.createIcons();

    // Mark as read automatically in database if unread
    if (msg.status === 'unread') {
      await markAsRead(msg.id);
    }
  }

  // ── Mark Message as Read ──
  async function markAsRead(msgId) {
    try {
      const docRef = doc(db, 'contact_messages', msgId);
      await updateDoc(docRef, { status: 'read' });
      
      // Update local array
      const localMsg = allMessages.find(m => m.id === msgId);
      if (localMsg) localMsg.status = 'read';
      
      renderMessages();
    } catch (error) {
      console.error("Error marking message as read:", error);
    }
  }

  // ── Delete Message ──
  async function deleteMessage(msgId) {
    if (!confirm("Are you sure you want to delete this message?")) return;
    try {
      const docRef = doc(db, 'contact_messages', msgId);
      await deleteDoc(docRef);
      
      // Update local array
      allMessages = allMessages.filter(m => m.id !== msgId);
      
      toast.success("Message deleted successfully.");
      renderMessages();
      
      if (activeMsg && activeMsg.id === msgId) {
        closeModal();
      }
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Failed to delete message.");
    }
  }

  // ── Close Modal ──
  function closeModal() {
    messageModal.classList.remove('open');
    activeMsg = null;
  }

  // ── Setup Listeners ──
  closeModalBtn.addEventListener('click', closeModal);
  modalCloseBtn.addEventListener('click', closeModal);
  
  modalReadBtn.addEventListener('click', async () => {
    if (activeMsg) {
      await markAsRead(activeMsg.id);
      closeModal();
    }
  });

  // Filter Buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.filter-btn').forEach(b => {
        b.style.background = 'transparent';
        b.style.color = 'var(--color-text-secondary)';
      });

      btn.classList.add('active');
      btn.style.background = 'var(--color-sidebar-active)';
      btn.style.color = 'var(--color-primary)';

      currentFilter = btn.dataset.filter;
      renderMessages();
    });
  });

  // Utility to escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Initialize
  loadMessages();
});
