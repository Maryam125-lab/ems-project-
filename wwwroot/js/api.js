/**
 * EMS API Service Layer
 * Centralized client for communicating with the Node.js/Express backend.
 * All API calls go through this module.
 */
const EmsApi = (function () {
    'use strict';

    // ── Configuration ──────────────────────────────────────────────
    const API_BASE = window.__EMS_API_BASE || 'http://localhost:3001';
    const TOKEN_KEY = 'ems_jwt_token';
    const USER_KEY = 'ems_user_data';

    // ── Token helpers ──────────────────────────────────────────────
    function getToken() { return localStorage.getItem(TOKEN_KEY); }
    function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
    function clearToken() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }

    function getUser() {
        try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
    }
    function setUser(u) { localStorage.setItem(USER_KEY, JSON.stringify(u)); }

    function isLoggedIn() { return !!getToken(); }

    // Parse JWT payload (no validation, just decode)
    function parseJwt(token) {
        try {
            const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            return JSON.parse(atob(base64));
        } catch { return null; }
    }

    function getTokenPayload() {
        const t = getToken();
        return t ? parseJwt(t) : null;
    }

    // ── Core HTTP ──────────────────────────────────────────────────
    async function request(method, path, body, opts = {}) {
        const url = `${API_BASE}${path}`;
        const headers = { 'Content-Type': 'application/json' };
        const token = getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const config = { method, headers, credentials: 'include' };
        if (body && method !== 'GET') config.body = JSON.stringify(body);

        try {
            const res = await fetch(url, config);

            // Auto-redirect on 401 (token expired / not logged in)
            if (res.status === 401 && !opts.skipAuthRedirect) {
                clearToken();
                window.location.href = '/';
                return { success: false, error: 'Session expired. Please log in again.' };
            }

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                let errorMsg = data.error || data.message || `Request failed (${res.status})`;
                if (typeof errorMsg === 'object') errorMsg = JSON.stringify(errorMsg);
                return {
                    success: false,
                    status: res.status,
                    error: errorMsg,
                    issues: data.issues || [],
                    data: null
                };
            }

            return { success: true, status: res.status, data: data.data ?? data, error: null };
        } catch (err) {
            console.error('[EmsApi] Network error:', err);
            return {
                success: false,
                status: 0,
                error: 'Cannot connect to server. Please check if the backend is running.',
                data: null
            };
        }
    }

    const get    = (path, opts) => request('GET', path, null, opts);
    const post   = (path, body, opts) => request('POST', path, body, opts);
    const put    = (path, body, opts) => request('PUT', path, body, opts);
    const patch  = (path, body, opts) => request('PATCH', path, body, opts);
    const del    = (path, opts) => request('DELETE', path, null, opts);

    // ── Auth ───────────────────────────────────────────────────────
    async function login(email, password) {
        const res = await post('/api/auth/login', { email, password }, { skipAuthRedirect: true });
        if (res.success && res.data) {
            const token = res.data.token;
            if (token) setToken(token);
            if (res.data.user) setUser(res.data.user);
        }
        return res;
    }

    async function logout() {
        await post('/api/auth/logout').catch(() => {});
        clearToken();
        sessionStorage.clear();
        window.location.href = '/';
    }

    async function getSession() {
        return get('/api/auth/session');
    }

    async function changePassword(currentPassword, newPassword) {
        return post('/api/auth/change-password', {
            current_password: currentPassword,
            new_password: newPassword
        });
    }

    // ── Dashboard ──────────────────────────────────────────────────
    const dashboard = {
        getHRMetrics: (range) => get(`/api/dashboard/metrics${range ? '?range=' + range : ''}`),
        getMyMetrics: () => get('/api/dashboard/me'),
        getPendingActions: () => get('/api/dashboard/pending-actions'),
        getUrgentAlerts: (days) => get(`/api/dashboard/urgent-alerts${days ? '?days=' + days : ''}`)
    };

    // ── Employees ──────────────────────────────────────────────────
    const employees = {
        list: (search) => get(`/api/employees${search ? '?search=' + encodeURIComponent(search) : ''}`),
        getById: (id) => get(`/api/employees/${id}`),
        get: (id) => get(`/api/employees/${id}`), // Alias for Details view
        create: (data) => post('/api/employees', data),
        updatePersonal: (id, data) => patch(`/api/employees/${id}/personal`, data),
        updateJob: (id, data) => patch(`/api/employees/${id}/job`, data),
        updateExtra: (id, data) => patch(`/api/employees/${id}/extra`, data),
        resendCredentials: (id) => post(`/api/employees/${id}/resend-credentials`)
    };

    // ── Attendance ─────────────────────────────────────────────────
    const attendance = {
        getSheet: (params) => {
            const qs = new URLSearchParams(params).toString();
            return get(`/api/attendance${qs ? '?' + qs : ''}`);
        },
        getLog: (id) => get(`/api/attendance/employee/${id}`),
        save: (data) => put('/api/attendance/save', data),
        submit: (data) => post('/api/attendance/submit', data),
        acknowledge: (id) => patch(`/api/attendance/${id}/ack`, {}),
        getReport: (params) => {
            const qs = new URLSearchParams(params).toString();
            return get(`/api/attendance/report${qs ? '?' + qs : ''}`);
        },
        requestUnlock: (data) => post('/api/attendance/unlock-request', data),
        approveUnlock: (data) => post('/api/attendance/unlock-approve', data)
    };

    // ── Leave ──────────────────────────────────────────────────────
    const leave = {
        list: (params) => {
            const qs = params ? new URLSearchParams(params).toString() : '';
            return get(`/api/leave-requests${qs ? '?' + qs : ''}`);
        },
        getMine: () => get('/api/leave-requests/mine'),
        submit: (data) => post('/api/leave-requests', data),
        approve: (id) => patch(`/api/leave-requests/${id}/approve`, {}),
        reject: (id, reason) => patch(`/api/leave-requests/${id}/reject`, { reason }),
        earlyReturn: (id, endByForce) => patch(`/api/leave-requests/${id}/early-return`, { end_by_force: endByForce }),
        getBalances: (params) => {
            const qs = params ? new URLSearchParams(params).toString() : '';
            return get(`/api/leave-requests/balances${qs ? '?' + qs : ''}`);
        },
        getMyBalances: () => get('/api/leave-requests/balances/mine'),
        getCalendar: (params) => {
            const qs = params ? new URLSearchParams(params).toString() : '';
            return get(`/api/leave-requests/calendar${qs ? '?' + qs : ''}`);
        }
    };

    // ── Config (Departments, Designations, Shifts, etc.) ──────────
    const config = {
        get: (entity) => get(`/api/config/${entity}`),
        create: (entity, data) => post(`/api/config/${entity}`, data),
        update: (entity, id, data) => patch(`/api/config/${entity}/${id}`, data)
    };

    // ── Penalties ──────────────────────────────────────────────────
    const penalties = {
        getRules: () => get('/api/penalty-rules'),
        createRule: (data) => post('/api/penalty-rules', data),
        updateRule: (id, data) => patch(`/api/penalty-rules/${id}`, data),
        list: () => get('/api/penalties'),
        getMine: () => get('/api/penalties/mine'),
        propose: (data) => post('/api/penalties', data),
        approve: (id) => patch(`/api/penalties/${id}/approve`, {}),
        reject: (id) => patch(`/api/penalties/${id}/reject`, {}),
        acknowledge: (id) => patch(`/api/penalties/${id}/ack`, {})
    };

    // ── Announcements ──────────────────────────────────────────────
    const announcements = {
        list: (params) => {
            const qs = params ? new URLSearchParams(params).toString() : '';
            return get(`/api/announcements${qs ? '?' + qs : ''}`);
        },
        getById: (id) => get(`/api/announcements/${id}`),
        create: (data) => post('/api/announcements', data),
        update: (id, data) => patch(`/api/announcements/${id}`, data),
        delete: (id) => del(`/api/announcements/${id}`),
        pin: (id) => patch(`/api/announcements/${id}/pin`, {}),
        unpin: (id) => patch(`/api/announcements/${id}/unpin`, {})
    };

    // ── Promotions ─────────────────────────────────────────────────
    const promotions = {
        list: (params) => {
            const qs = params ? new URLSearchParams(params).toString() : '';
            return get(`/api/promotions${qs ? '?' + qs : ''}`);
        },
        create: (data) => post('/api/promotions', data),
        update: (id, data) => patch(`/api/promotions/${id}`, data),
        approve: (id) => patch(`/api/promotions/${id}/approve`, {}),
        reject: (id) => patch(`/api/promotions/${id}/reject`, {})
    };

    // ── Payroll ────────────────────────────────────────────────────
    const payroll = {
        list: (params) => {
            const qs = params ? new URLSearchParams(params).toString() : '';
            return get(`/api/payroll${qs ? '?' + qs : ''}`);
        },
        getMine: (params) => {
            const qs = params ? new URLSearchParams(params).toString() : '';
            return get(`/api/payroll/mine${qs ? '?' + qs : ''}`);
        },
        generate: (data) => post('/api/payroll/generate', data),
        process: (id) => patch(`/api/payroll/${id}/process`, {}),
        getPayslip: (id) => get(`/api/payroll/${id}/payslip`),
        getSummary: (params) => {
            const qs = params ? new URLSearchParams(params).toString() : '';
            return get(`/api/payroll/summary${qs ? '?' + qs : ''}`);
        }
    };

    // ── Directory ──────────────────────────────────────────────────
    const directory = {
        list: () => get('/api/directory'),
        create: (data) => post('/api/directory', data),
        update: (id, data) => patch(`/api/directory/${id}`, data)
    };

    // ── Notifications ──────────────────────────────────────────────
    const notifications = {
        list: () => get('/api/notifications'),
        markRead: (id) => patch(`/api/notifications/${id}/read`, {}),
        create: (data) => post('/api/notifications', data)
    };

    // ── Calendar Events ────────────────────────────────────────────
    const calendar = {
        list: () => get('/api/calendar-events'),
        create: (data) => post('/api/calendar-events', data)
    };

    // ── Audit Logs ──────────────────────────────────────────────────
    const audit = {
        list: () => get('/api/audit-logs')
    };

    // ── UI Helpers ─────────────────────────────────────────────────
    function getRoleName() {
        const payload = getTokenPayload();
        if (!payload) return 'guest';
        const user = getUser();
        // role_id mapping will come from session
        return user?.role_name || payload.role_id || 'employee';
    }

    function getUserInitials() {
        const user = getUser();
        if (!user || !user.email) return 'U';
        return user.email.substring(0, 2).toUpperCase();
    }

    function getEmployeeId() {
        const payload = getTokenPayload();
        return payload?.employee_id || getUser()?.employee_id || null;
    }

    // Auth guard — call on pages that require login
    function requireAuth() {
        if (!isLoggedIn()) {
            window.location.href = '/';
            return false;
        }
        return true;
    }

    // ── Public API ─────────────────────────────────────────────────
    return {
        API_BASE,
        // Auth
        login, logout, getSession, changePassword,
        isLoggedIn, requireAuth,
        getToken, getUser, getTokenPayload,
        getRoleName, getUserInitials, getEmployeeId,
        // HTTP
        get, post, put, patch, del,
        // Modules
        dashboard, employees, attendance, leave,
        config, penalties, announcements, promotions, payroll,
        directory, notifications, calendar, audit
    };
})();
