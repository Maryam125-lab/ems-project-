/**
 * Dashboard Data Loader
 * Fetches metrics from /api/dashboard and populates the dashboard UI.
 * Gracefully handles API failures with fallback data.
 */
(async function initDashboard() {
    'use strict';

    const CHART_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#ec4899','#84cc16'];
    const CIRCUMFERENCE = 2 * Math.PI * 38; // ~238.76

    // ── Greeting ───────────────────────────────────────────────────
    function setGreeting() {
        const h = new Date().getHours();
        const user = EmsApi.getUser();
        const role = EmsApi.getRoleName();
        const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
        
        let displayRole = 'Admin';
        if (role === 'super_admin') displayRole = 'Super Admin';
        else if (role.toLowerCase().includes('hr')) displayRole = 'HR Manager';
        else if (role === 'employee') displayRole = 'Team Member';

        const name = user?.employee_name || user?.email?.split('@')[0] || 'User';
        
        const el = document.getElementById('greetingText');
        if (el) {
            el.innerHTML = `${greet}, ${displayRole} <span style="font-size:0.7em; opacity:0.7; font-weight:400;">(${name})</span> <i class="fa-solid fa-fire" aria-hidden="true"></i> <span class="live-dot">LIVE</span>`;
        }
    }
    setGreeting();

    // ── Animate number ─────────────────────────────────────────────
    function animateNum(el, target, duration = 600) {
        if (!el) return;
        const start = 0;
        const startTime = performance.now();
        function tick(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(start + (target - start) * eased);
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    // ── Load HR Metrics ────────────────────────────────────────────
    async function loadMetrics() {
        const res = await EmsApi.dashboard.getHRMetrics('6m');
        const d = res.success ? res.data : null;

        // KPI: Total Payroll
        const totalEl = document.getElementById('kpiTotalNum');
        const totalSub = document.getElementById('kpiTotalSub');
        if (totalEl && d.total_payroll !== undefined) {
            const payrollM = (Number(d.total_payroll) / 1000000).toFixed(1);
            totalEl.textContent = payrollM + 'M';
            if (totalSub) totalSub.textContent = `PKR · May 2026`;
        }

        // KPI: On Leave Today
        const leaveEl = document.getElementById('kpiLeaveNum');
        const leaveSub = document.getElementById('kpiLeaveSub');
        if (leaveEl && d.on_leave_today !== undefined) {
            animateNum(leaveEl, d.on_leave_today);
            if (leaveSub) leaveSub.textContent = `Approved absences`;
        }

        // KPI: Present Today
        const presEl = document.getElementById('kpiPresentNum');
        const presSub = document.getElementById('kpiPresentSub');
        if (presEl && d.present_today !== undefined) {
            animateNum(presEl, d.present_today);
            const rate = d.total_employees ? Math.round((d.present_today / d.total_employees) * 100) : 0;
            if (presSub) presSub.textContent = `${rate}% attendance rate`;
        }

        // Pending Actions Counts
        const penCount = document.getElementById('pendingPenaltyCount');
        if (penCount && d.pending_penalties !== undefined) {
            penCount.textContent = d.pending_penalties;
            penCount.style.display = d.pending_penalties > 0 ? 'inline-flex' : 'none';
        }

        // Performance Metrics
        if (d) {
            const attEl = document.getElementById('metricAttendance');
            const leaveUsedEl = document.getElementById('metricLeaveUsed');
            const onTimeEl = document.getElementById('metricOnTime');
            if (attEl) attEl.textContent = (d.attendance_rate || '—') + '%';
            if (leaveUsedEl) leaveUsedEl.textContent = (d.leave_utilization || '—') + '%';
            if (onTimeEl) onTimeEl.textContent = (d.on_time_rate || '—') + '%';
        }

        // Department Donut
        if (d && d.departments && Array.isArray(d.departments)) {
            renderDeptDonut(d.departments, d.total_employees || 0);
        }

        // Monthly Attendance Bars
        if (d && d.monthly_attendance && Array.isArray(d.monthly_attendance)) {
            renderMonthlyBars(d.monthly_attendance);
        }

        // Workforce Types
        if (d && d.employment_types) renderWorkforceChart(d.employment_types);
        if (d && d.recent_activity) renderActivity(d.recent_activity);

        // Headcount Growth
        if (d && d.headcount_trend) renderGrowthChart(d.headcount_trend);
    }

    function renderGrowthChart(data) {
        const container = document.getElementById('growthChart');
        const labels = document.getElementById('growthLabels');
        if (!container || !data.length) return;

        const maxVal = Math.max(...data.map(d => d.count), 1);
        const points = data.map((d, i) => {
            const x = (i / (data.length - 1)) * 400;
            const y = 80 - (d.count / maxVal) * 60;
            return `${x},${y}`;
        }).join(' L ');

        const pathArea = `M0,90 L 0,${80 - (data[0].count/maxVal)*60} L ${points} L 400,90 Z`;
        const pathLine = `M 0,${80 - (data[0].count/maxVal)*60} L ${points}`;

        container.innerHTML = `
            <svg width="100%" height="90" viewBox="0 0 400 90" preserveAspectRatio="none">
                <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#10b981" stop-opacity="0.3"/><stop offset="100%" stop-color="#10b981" stop-opacity="0"/></linearGradient></defs>
                <path d="${pathArea}" fill="url(#lg)"/>
                <path d="${pathLine}" fill="none" stroke="#10b981" stroke-width="2"/>
            </svg>
        `;

        if (labels) {
            labels.innerHTML = data.map(d => `<span>${d.month}</span>`).join('');
        }
    }

    function renderWorkforceChart(data) {
        const container = document.getElementById('genderChart');
        if (!container) return;
        const total = data.reduce((a, b) => a + b.count, 0);
        container.innerHTML = data.map((t, i) => {
            const pct = total > 0 ? Math.round((t.count / total) * 100) : 0;
            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
            return `<div style="margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;">
                    <span>${t.label || 'Other'}</span><span>${pct}%</span>
                </div>
                <div style="height:6px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;">
                    <div style="width:${pct}%;height:100%;background:${colors[i % colors.length]};"></div>
                </div>
            </div>`;
        }).join('');
    }

    function renderActivity(data) {
        const container = document.getElementById('recentActivity');
        if (!container) return;
        if (!data.length) {
            container.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:12px;padding:20px;">No recent activity</div>';
            return;
        }
        container.innerHTML = data.map(a => `
            <div class="alert-item" style="border:none;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.03);">
                <div class="alert-dot blue"></div>
                <div style="flex:1;">
                    <div style="font-size:12px;"><strong>${a.name}</strong> was promoted</div>
                    <div class="alert-label">${new Date(a.date).toLocaleDateString()}</div>
                </div>
            </div>
        `).join('');
    }

    // ── Department Donut Chart ─────────────────────────────────────
    function renderDeptDonut(departments, total) {
        const donut = document.getElementById('deptDonut');
        const legend = document.getElementById('deptLegend');
        const totalText = document.getElementById('deptDonutTotal');
        if (!donut || !legend) return;

        if (totalText) totalText.textContent = total;

        // Remove old arcs
        donut.querySelectorAll('.dept-arc').forEach(e => e.remove());

        let offset = 0;
        departments.slice(0, 6).forEach((dept, i) => {
            const pct = total > 0 ? dept.count / total : 0;
            const dashLen = pct * CIRCUMFERENCE;
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', '50');
            circle.setAttribute('cy', '50');
            circle.setAttribute('r', '38');
            circle.setAttribute('fill', 'none');
            circle.setAttribute('stroke', CHART_COLORS[i % CHART_COLORS.length]);
            circle.setAttribute('stroke-width', '18');
            circle.setAttribute('stroke-dasharray', `${dashLen} ${CIRCUMFERENCE}`);
            circle.setAttribute('stroke-dashoffset', `${-offset}`);
            circle.setAttribute('transform', 'rotate(-90 50 50)');
            circle.setAttribute('class', 'dept-arc');
            circle.style.transition = 'stroke-dasharray 0.8s ease';
            donut.appendChild(circle);
            offset += dashLen;
        });

        legend.innerHTML = departments.slice(0, 6).map((dept, i) => {
            const pct = total > 0 ? Math.round(dept.count / total * 100) : 0;
            return `<div style="display:flex;align-items:center;gap:7px;font-size:12px;">
                <div style="width:8px;height:8px;border-radius:50%;background:${CHART_COLORS[i % CHART_COLORS.length]};flex-shrink:0;"></div>
                ${dept.name || dept.department_name}
                <span style="margin-left:auto;font-family:'DM Mono',monospace;font-size:11px;color:var(--muted);padding-left:12px;">${dept.count}&nbsp;${pct}%</span>
            </div>`;
        }).join('');
    }

    // ── Monthly Attendance Bars ────────────────────────────────────
    function renderMonthlyBars(data) {
        const container = document.getElementById('monthlyBars');
        if (!container) return;

        const maxVal = Math.max(...data.map(m => (m.present || 0) + (m.late || 0) + (m.absent || 0)), 1);
        container.innerHTML = data.slice(-6).map(m => {
            const presentH = Math.max(4, ((m.present || 0) / maxVal) * 80);
            const otherH = Math.max(4, (((m.late || 0) + (m.absent || 0)) / maxVal) * 80);
            const pct = m.present && m.total ? Math.round(m.present / m.total * 100) : '—';
            return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;">
                <div style="display:flex;gap:2px;align-items:flex-end;height:80px;">
                    <div style="width:16px;height:${presentH}px;background:var(--accent);border-radius:3px 3px 0 0;min-height:4px;transition:height 0.6s ease;"></div>
                    <div style="width:10px;height:${otherH}px;background:var(--accent4);border-radius:3px 3px 0 0;min-height:4px;transition:height 0.6s ease;"></div>
                </div>
                <div style="font-size:9px;color:var(--muted);font-family:'DM Mono',monospace;">${m.month || ''}</div>
                <div style="font-size:8px;color:var(--muted);">${pct}%</div>
            </div>`;
        }).join('');
    }

    // ── Load Pending Actions ───────────────────────────────────────
    async function loadPending() {
        const res = await EmsApi.dashboard.getPendingActions();
        if (res.success && res.data) {
            const d = res.data;
            const leaveCount = document.getElementById('pendingLeaveCount');
            const penaltyCount = document.getElementById('pendingPenaltyCount');
            if (leaveCount && d.pending_leaves !== undefined) leaveCount.textContent = d.pending_leaves;
            if (penaltyCount && d.pending_penalties !== undefined) {
                penaltyCount.textContent = d.pending_penalties;
                penaltyCount.style.display = d.pending_penalties > 0 ? 'inline-flex' : 'none';
            }
        }
    }

    // ── Load Announcements Notice Board ────────────────────────────
    async function loadAnnouncements() {
        const container = document.getElementById('adminAnnouncements');
        if (!container) return;

        const res = await EmsApi.announcements.list({ limit: 4 });
        if (res.success && res.data && res.data.length > 0) {
            container.innerHTML = res.data.map(a => {
                const isPinned = a.is_pinned;
                const borderStyle = isPinned 
                    ? 'border-left: 3px solid var(--accent3); background:rgba(245,158,11,0.04);' 
                    : 'border-left: 3px solid var(--accent); background:rgba(255,255,255,0.01);';
                const pinBadge = isPinned 
                    ? '<span style="color:var(--accent3); font-size:10px; font-weight:600; display:inline-flex; align-items:center; gap:3px;"><i class="fa-solid fa-thumbtack" style="font-size:8px;"></i> Pinned</span>' 
                    : '';
                
                return `<div style="padding:10px; border-radius:8px; display:flex; flex-direction:column; gap:4px; border:1px solid rgba(255,255,255,0.03); ${borderStyle}">
                    <div style="font-size:12px; font-weight:600; display:flex; justify-content:space-between; align-items:center; gap:8px;">
                        <span style="color:var(--foreground);">${a.title}</span>
                        <div style="display:flex; align-items:center; gap:8px;">
                            ${pinBadge}
                            <span style="font-size:9px; color:var(--muted);">${new Date(a.created_at).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
                        </div>
                    </div>
                    <div style="font-size:11px; color:var(--muted); line-height:1.4;">${a.content || ''}</div>
                </div>`;
            }).join('');
        } else if (res.success) {
            container.innerHTML = '<div style="font-size:12px; color:var(--muted); text-align:center; padding:24px 0;"><i class="fa-solid fa-bullhorn" style="color:var(--accent); margin-right:6px; opacity:0.5;"></i>No announcements posted yet.</div>';
        } else {
            container.innerHTML = '<div style="font-size:12px; color:var(--accent4); text-align:center; padding:24px 0;">Could not load announcements Notice Board.</div>';
        }
    }

    // ── Run All ────────────────────────────────────────────────────
    await Promise.allSettled([loadMetrics(), loadPending(), loadAnnouncements()]);
})();
