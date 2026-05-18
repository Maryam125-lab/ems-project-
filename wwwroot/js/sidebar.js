/* ═══════════════════════════════════════════
   TRACK360 ERP - Sidebar & Navigation Logic
   ═══════════════════════════════════════════ */

// ─── COLLAPSIBLE SECTIONS ───
function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    const toggle = document.getElementById(sectionId.replace('-items', '-toggle'));

    if (section) {
        section.classList.toggle('collapsed');
    }
    if (toggle) {
        toggle.classList.toggle('collapsed');
    }

    // Save state
    const collapsed = section?.classList.contains('collapsed');
    localStorage.setItem('ems_' + sectionId, collapsed ? '1' : '0');
}

// Restore collapsed states on load
document.addEventListener('DOMContentLoaded', function () {
    const sections = ['config-items'];
    sections.forEach(function (id) {
        const saved = localStorage.getItem('ems_' + id);
        const section = document.getElementById(id);
        const toggle = document.getElementById(id.replace('-items', '-toggle'));
        if (saved === '0' && section) {
            section.classList.remove('collapsed');
            if (toggle) toggle.classList.remove('collapsed');
        }
    });

    // Restore user info from EmsApi
    let user = 'Super Admin';
    let role = 'super_admin';

    if (typeof EmsApi !== 'undefined' && EmsApi.getUser) {
        const userObj = EmsApi.getUser();
        if (userObj) {
            user = userObj.name || userObj.email || user;
            role = userObj.role_name || EmsApi.getRoleName() || role;
        }
    }

    const userName = document.getElementById('sidebarUserName');
    if (userName) userName.textContent = user.trim();

    const roleLabel = document.getElementById('sidebarUserRole');
    if (roleLabel) {
        const formattedRole = role ? role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Super Admin';
        roleLabel.textContent = formattedRole;
    }
});

// ─── ROLE SWITCHING ───
function switchRole(role) {
    // Update toggle buttons
    const btns = document.querySelectorAll('.role-btn');
    btns.forEach(function (btn) {
        btn.classList.remove('active');
        if (btn.dataset.role === role) {
            btn.classList.add('active');
        }
    });

    sessionStorage.setItem('ems_role', role);
    updateRoleUI(role);

    // Redirect based on role
    if (role === 'employee') {
        window.location.href = '/MyPortal/Dashboard';
    } else {
        window.location.href = '/Dashboard';
    }
}

function updateRoleUI(role) {
    const roleLabel = document.getElementById('sidebarUserRole');
    if (roleLabel) {
        const labels = {
            'superadmin': 'super_admin',
            'hr': 'hr_admin',
            'employee': 'employee'
        };
        roleLabel.textContent = labels[role] || role;
    }

    // Highlight active role button
    const btns = document.querySelectorAll('.role-btn');
    btns.forEach(function (btn) {
        btn.classList.remove('active');
        if (btn.dataset.role === role) {
            btn.classList.add('active');
        }
    });
}

// ─── MOBILE MENU ───
function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
}

// Close sidebar on outside click (mobile)
document.addEventListener('click', function (e) {
    const sidebar = document.getElementById('sidebar');
    const mobileBtn = document.getElementById('mobileMenuBtn');
    if (sidebar && sidebar.classList.contains('open') &&
        !sidebar.contains(e.target) && !mobileBtn.contains(e.target)) {
        sidebar.classList.remove('open');
    }
});

// ─── NOTIFICATIONS ───
function toggleNotifications() {
    const panel = document.getElementById('notifPanel');
    if (panel) {
        panel.classList.toggle('show');
    }
}

function markAllRead() {
    const items = document.querySelectorAll('.notif-item.unread');
    items.forEach(function (item) {
        item.classList.remove('unread');
    });
    const dot = document.querySelector('.notif-dot');
    if (dot) dot.style.display = 'none';
}

// Close notification panel on outside click
document.addEventListener('click', function (e) {
    const panel = document.getElementById('notifPanel');
    const bell = document.getElementById('notifBell');
    if (panel && panel.classList.contains('show') &&
        !panel.contains(e.target) && !bell.contains(e.target)) {
        panel.classList.remove('show');
    }
});

// ─── GLOBAL SEARCH (Keyboard shortcut) ───
document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        var search = document.getElementById('globalSearch');
        if (search) search.focus();
    }
});
