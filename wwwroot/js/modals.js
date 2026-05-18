/* ═══════════════════════════════════════════
   TRACK360 ERP - Modal Management
   ═══════════════════════════════════════════ */

// ─── OPEN MODAL ───
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Focus first input
        setTimeout(function () {
            const firstInput = modal.querySelector('input:not([type="hidden"]), select, textarea');
            if (firstInput) firstInput.focus();
        }, 200);
    }
}

// ─── CLOSE MODAL ───
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';

        // Reset form if present
        const form = modal.querySelector('form');
        if (form) form.reset();
    }
}

// ─── CLOSE ON BACKDROP CLICK ───
document.addEventListener('click', function (e) {
    if (e.target.classList.contains('modal-backdrop') && e.target.classList.contains('active')) {
        e.target.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// ─── CLOSE ON ESC KEY ───
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        const openModals = document.querySelectorAll('.modal-backdrop.active');
        openModals.forEach(function (modal) {
            modal.classList.remove('active');
        });
        document.body.style.overflow = '';
    }
});

// ─── CONFIRM DIALOG ───
function showConfirm(options) {
    // options: { title, message, type: 'danger'|'warning', confirmText, onConfirm }
    var html = '<div class="modal-backdrop active" id="confirmModal">' +
        '<div class="modal-dialog" style="max-width:400px;">' +
        '<div class="modal-body">' +
        '<div class="confirm-dialog">' +
        '<div class="confirm-icon ' + (options.type || 'danger') + '">' +
        (options.type === 'warning'
            ? '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
            : '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>') +
        '</div>' +
        '<div class="confirm-title">' + (options.title || 'Are you sure?') + '</div>' +
        '<div class="confirm-desc">' + (options.message || 'This action cannot be undone.') + '</div>' +
        '</div></div>' +
        '<div class="modal-footer">' +
        '<button class="btn btn-ghost" onclick="closeConfirm()">Cancel</button>' +
        '<button class="btn btn-' + (options.type === 'warning' ? 'warning' : 'danger') + '" onclick="confirmAction()" id="confirmActionBtn">' + (options.confirmText || 'Delete') + '</button>' +
        '</div></div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    document.body.style.overflow = 'hidden';

    // Store callback
    window._confirmCallback = options.onConfirm;
}

function confirmAction() {
    if (window._confirmCallback) {
        window._confirmCallback();
    }
    closeConfirm();
}

function closeConfirm() {
    const modal = document.getElementById('confirmModal');
    if (modal) {
        modal.remove();
    }
    document.body.style.overflow = '';
    window._confirmCallback = null;
}

// ─── TOAST NOTIFICATION ───
function showToast(message, type) {
    type = type || 'info';
    var icons = {
        success: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
        error: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
        warning: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    };

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = (icons[type] || '') + '<span>' + message + '</span>';
    document.body.appendChild(toast);

    setTimeout(function () {
        toast.remove();
    }, 4200);
}

// ─── TAB SWITCHING ───
function switchTab(tabGroup, tabName) {
    // Deactivate all tabs and panels in this group
    var group = document.getElementById(tabGroup);
    if (!group) return;

    var tabs = group.querySelectorAll('.tab-btn');
    var panels = group.querySelectorAll('.tab-content');

    tabs.forEach(function (tab) {
        tab.classList.remove('active');
        if (tab.dataset.tab === tabName) tab.classList.add('active');
    });

    panels.forEach(function (panel) {
        panel.classList.remove('active');
        if (panel.id === 'tab-' + tabName) panel.classList.add('active');
    });
}
