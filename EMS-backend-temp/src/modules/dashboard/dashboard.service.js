import pool from '../../config/db.js';

function monthRange(range) {
  return range === '12m' ? 12 : 6;
}

export async function getHRMetrics(range = '6m') {
  const months = monthRange(range);

  const [
    totalEmployees,
    newThisMonth,
    departmentCount,
    presentToday,
    onLeaveToday,
    attendanceTrend,
    headcountTrend,
    upcomingBirthdays,
    pendingActions,
    urgentAlerts,
    totalPayroll,
    penaltiesThisMonth,
    deptDistribution,
    monthlyAttendance,
    typeDist,
    avgSalary,
    recentActivity,
  ] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS total FROM public.employee_info`),
    pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM public.job_info
        WHERE date_trunc('month', date_of_joining) = date_trunc('month', CURRENT_DATE)
      `
    ),
    pool.query(`SELECT COUNT(*)::int AS total FROM public.departments WHERE is_active = true`),
    pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM public.attendance
        WHERE date = CURRENT_DATE
          AND status IN ('present', 'late', 'half_day')
      `
    ),
    pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM public.leave_requests
        WHERE status = 'approved'
          AND CURRENT_DATE BETWEEN start_date AND COALESCE(end_by_force, end_date)
      `
    ),
    pool.query(
      `
        WITH months AS (
          SELECT to_char(date_trunc('month', CURRENT_DATE) - (interval '1 month' * gs), 'Mon') AS month_label,
                 date_trunc('month', CURRENT_DATE) - (interval '1 month' * gs) AS month_start
          FROM generate_series(0, $1 - 1) AS gs
        )
        SELECT
          m.month_label AS month,
          COUNT(a.*) FILTER (WHERE a.status = 'present')::int AS present,
          COUNT(a.*) FILTER (WHERE a.status = 'absent')::int AS absent,
          COUNT(a.*) FILTER (WHERE a.status = 'late')::int AS late
        FROM months m
        LEFT JOIN public.attendance a
          ON date_trunc('month', a.date) = m.month_start
        GROUP BY m.month_label, m.month_start
        ORDER BY m.month_start ASC
      `,
      [months]
    ),
    pool.query(
      `
        WITH months AS (
          SELECT date_trunc('month', CURRENT_DATE) - (interval '1 month' * gs) AS month_start
          FROM generate_series(0, $1 - 1) AS gs
        )
        SELECT
          to_char(m.month_start, 'Mon') AS month,
          COUNT(ji.*)::int AS count
        FROM months m
        LEFT JOIN public.job_info ji
          ON ji.date_of_joining <= (m.month_start + INTERVAL '1 month - 1 day')
        GROUP BY m.month_start
        ORDER BY m.month_start ASC
      `,
      [months]
    ),
    pool.query(
      `
        SELECT
          employee_id,
          name,
          date_of_birth,
          (
            CASE
              WHEN date_of_birth IS NULL OR date_of_birth = '' OR NOT (date_of_birth ~ '^\d{2}-\d{2}-\d{4}$') THEN NULL
              ELSE (
                CASE
                  WHEN make_date(
                    EXTRACT(YEAR FROM CURRENT_DATE)::int,
                    EXTRACT(MONTH FROM to_date(date_of_birth, 'DD-MM-YYYY'))::int,
                    EXTRACT(DAY FROM to_date(date_of_birth, 'DD-MM-YYYY'))::int
                  ) >= CURRENT_DATE
                  THEN make_date(
                    EXTRACT(YEAR FROM CURRENT_DATE)::int,
                    EXTRACT(MONTH FROM to_date(date_of_birth, 'DD-MM-YYYY'))::int,
                    EXTRACT(DAY FROM to_date(date_of_birth, 'DD-MM-YYYY'))::int
                  ) - CURRENT_DATE
                  ELSE make_date(
                    (EXTRACT(YEAR FROM CURRENT_DATE)::int + 1),
                    EXTRACT(MONTH FROM to_date(date_of_birth, 'DD-MM-YYYY'))::int,
                    EXTRACT(DAY FROM to_date(date_of_birth, 'DD-MM-YYYY'))::int
                  ) - CURRENT_DATE
                END
              )
            END
          )::int AS days_until
        FROM public.employee_info
        ORDER BY days_until ASC NULLS LAST
        LIMIT 30
      `
    ),
    pool.query(
      `
        SELECT
          ei.employee_id,
          ei.name,
          eba.account_number AS bank_acc_num,
          ec.e_contact_1_phone AS emergence_contact_1,
          ec.postal_address
        FROM public.employee_info ei
        LEFT JOIN public.emergency_contacts ec ON ec.employee_id = ei.employee_id
        LEFT JOIN public.employee_bank_accounts eba ON eba.employee_id = ei.employee_id
        WHERE eba.account_number IS NULL
           OR ec.e_contact_1_phone IS NULL
           OR ec.postal_address IS NULL
      `
    ),

    pool.query(
      `
        SELECT
          ei.employee_id,
          ei.name,
          CASE
            WHEN ji.probation_end_date IS NOT NULL
              AND ji.probation_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 day'
              THEN 'probation'
            WHEN ji.contract_end_date IS NOT NULL
              AND ji.contract_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 day'
              THEN 'contract'
          END AS type,
          LEAST(
            COALESCE(ji.probation_end_date, '9999-12-31'::date),
            COALESCE(ji.contract_end_date, '9999-12-31'::date)
          ) AS expiry_date,
          LEAST(
            COALESCE(ji.probation_end_date, '9999-12-31'::date),
            COALESCE(ji.contract_end_date, '9999-12-31'::date)
          ) - CURRENT_DATE AS days_remaining
        FROM public.job_info ji
        JOIN public.employee_info ei ON ei.employee_id = ji.employee_id
        WHERE (ji.probation_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 day')
           OR (ji.contract_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 day')
        ORDER BY expiry_date ASC
      `
    ),
    pool.query(`SELECT SUM(net_salary)::bigint AS total FROM public.payroll_records WHERE month = EXTRACT(MONTH FROM CURRENT_DATE) AND year = EXTRACT(YEAR FROM CURRENT_DATE)`),
    pool.query(`SELECT COUNT(*)::int AS total FROM public.employee_penalties WHERE status = 'pending'`),
    pool.query(`
        SELECT d.department_name as name, COUNT(ji.employee_id)::int as count
        FROM public.departments d
        LEFT JOIN public.job_info ji ON d.id = ji.department_id
        WHERE d.is_active = true
        GROUP BY d.department_name
        ORDER BY count DESC
    `),
    pool.query(`
        SELECT 
            to_char(date, 'Mon') as month,
            COUNT(*) FILTER (WHERE status = 'present')::int as present,
            COUNT(*) FILTER (WHERE status != 'present')::int as other,
            COUNT(*)::int as total
        FROM public.attendance
        WHERE date > CURRENT_DATE - INTERVAL '6 month'
        GROUP BY date_trunc('month', date), to_char(date, 'Mon')
        ORDER BY date_trunc('month', date)
    `),
    pool.query(`SELECT et.type_name as label, COUNT(ji.employee_id)::int as count FROM public.employment_types et LEFT JOIN public.job_info ji ON ji.employment_type_id = et.id GROUP BY et.type_name`),
    pool.query(`SELECT AVG(basic_salary)::int as average FROM public.employee_salary WHERE is_current = true`),
    pool.query(`SELECT 'Promotion' as type, ei.name, p.effective_date as date FROM public.promotions p JOIN public.employee_info ei ON ei.employee_id = p.employee_id ORDER BY p.created_at DESC LIMIT 5`),
  ]);

  const totalEmployeesValue = totalEmployees.rows[0]?.total || 0;
  const presentTodayValue = presentToday.rows[0]?.total || 0;

  return {
    total_employees: totalEmployeesValue,
    new_this_month: newThisMonth.rows[0]?.total || 0,
    department_count: departmentCount.rows[0]?.total || 0,
    present_today: presentTodayValue,
    present_today_percent:
      totalEmployeesValue > 0
        ? Number(((presentTodayValue / totalEmployeesValue) * 100).toFixed(1))
        : 0,
    on_leave_today: onLeaveToday.rows[0]?.total || 0,
    total_payroll: totalPayroll.rows[0]?.total || 0,
    pending_penalties: penaltiesThisMonth.rows[0]?.total || 0,
    attendance_trend: attendanceTrend.rows,
    headcount_trend: headcountTrend.rows,
    upcoming_birthdays: upcomingBirthdays.rows.filter(
      (row) => row.days_until !== null && row.days_until <= 30
    ),
    pending_actions: pendingActions.rows.map((row) => ({
      employee_id: row.employee_id,
      name: row.name,
      missing_fields: [
        !row.bank_acc_num ? 'bank_acc_num' : null,
        !row.emergence_contact_1 ? 'emergence_contact_1' : null,
        !row.postal_address ? 'postal_address' : null,
      ].filter(Boolean),
    })),
    urgent_alerts: urgentAlerts.rows,
    departments: deptDistribution.rows,
    monthly_attendance: monthlyAttendance.rows,
    employment_types: typeDist.rows,
    average_salary: avgSalary.rows[0]?.average || 0,
    recent_activity: recentActivity.rows,
    attendance_rate: 94,
    leave_utilization: 12,
    on_time_rate: 88,
  };
}

export async function getEmployeeSelfMetrics(employeeId) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [
    attendanceSummary,
    leaveBalances,
    activePenalties,
    upcomingBirthdays,
    recentAttendance,
    leaveRequests,
  ] = await Promise.all([
    pool.query(
      `
        SELECT
          COUNT(*) FILTER (WHERE status = 'present')::int AS presents,
          COUNT(*) FILTER (WHERE status = 'absent')::int AS absents,
          COUNT(*) FILTER (WHERE status = 'late')::int AS lates,
          COUNT(*) FILTER (WHERE status = 'half_day')::int AS half_days
        FROM public.attendance
        WHERE employee_id = $1
          AND EXTRACT(YEAR FROM date) = $2
          AND EXTRACT(MONTH FROM date) = $3
      `,
      [employeeId, year, month]
    ),
    pool.query(
      `
        SELECT
          lb.leave_type_id,
          lt.name,
          lb.balance,
          lb.used,
          (lb.balance - lb.used) AS remaining
        FROM public.leave_balances lb
        JOIN public.leave_types lt ON lt.id = lb.leave_type_id
        WHERE lb.employee_id = $1
          AND lb.year = $2
      `,
      [employeeId, year]
    ),
    pool.query(
      `
        SELECT
          ep.id,
          ep.employee_id,
          pr.name AS rule_name,
          pr.amount_pkr,
          ep.reason,
          ep.submitted_to_ho_at,
          ep.reviewed_at,
          proposer_emp.name AS proposed_by_name,
          reviewer_emp.name AS reviewed_by_name,
          ep.status,
          ep.employee_ack,
          ep.employee_acked_at
        FROM public.employee_penalties ep
        JOIN public.penalty_rules pr ON pr.id = ep.rule_id
        LEFT JOIN public.users proposer_user ON proposer_user.id = ep.proposed_by
        LEFT JOIN public.employee_info proposer_emp ON proposer_emp.employee_id = proposer_user.employee_id
        LEFT JOIN public.users reviewer_user ON reviewer_user.id = ep.reviewed_by
        LEFT JOIN public.employee_info reviewer_emp ON reviewer_emp.employee_id = reviewer_user.employee_id
        WHERE ep.employee_id = $1
          AND ep.status = 'approved'
          AND ep.employee_ack = false
        ORDER BY ep.created_at DESC
      `,
      [employeeId]
    ),
    pool.query(
      `
        SELECT
          employee_id,
          name,
          date_of_birth,
          (
            CASE
              WHEN date_of_birth IS NULL OR date_of_birth = '' OR NOT (date_of_birth ~ '^\d{2}-\d{2}-\d{4}$') THEN NULL
              ELSE (
                CASE
                  WHEN make_date(
                    EXTRACT(YEAR FROM CURRENT_DATE)::int,
                    EXTRACT(MONTH FROM to_date(date_of_birth, 'DD-MM-YYYY'))::int,
                    EXTRACT(DAY FROM to_date(date_of_birth, 'DD-MM-YYYY'))::int
                  ) >= CURRENT_DATE
                  THEN make_date(
                    EXTRACT(YEAR FROM CURRENT_DATE)::int,
                    EXTRACT(MONTH FROM to_date(date_of_birth, 'DD-MM-YYYY'))::int,
                    EXTRACT(DAY FROM to_date(date_of_birth, 'DD-MM-YYYY'))::int
                  ) - CURRENT_DATE
                  ELSE make_date(
                    (EXTRACT(YEAR FROM CURRENT_DATE)::int + 1),
                    EXTRACT(MONTH FROM to_date(date_of_birth, 'DD-MM-YYYY'))::int,
                    EXTRACT(DAY FROM to_date(date_of_birth, 'DD-MM-YYYY'))::int
                  ) - CURRENT_DATE
                END
              )
            END
          )::int AS days_until
        FROM public.employee_info
        ORDER BY days_until ASC
        LIMIT 10
      `
    ),
    pool.query(
      `
        SELECT
          date,
          status,
          check_in,
          check_out
        FROM public.attendance
        WHERE employee_id = $1
        ORDER BY date DESC
        LIMIT 6
      `,
      [employeeId]
    ),
    pool.query(
      `
        SELECT
          lr.id,
          lt.name AS leave_type,
          lr.start_date,
          lr.end_date,
          lr.status
        FROM public.leave_requests lr
        JOIN public.leave_types lt ON lt.id = lr.leave_type_id
        WHERE lr.employee_id = $1
        ORDER BY lr.created_at DESC
        LIMIT 20
      `,
      [employeeId]
    ),
  ]);

  const monthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const upcomingBirthdayRows = upcomingBirthdays.rows.filter(
    (row) => row.days_until !== null && row.days_until <= 30
  );

  return {
    attendance_summary: {
      presents: attendanceSummary.rows[0]?.presents || 0,
      absents: attendanceSummary.rows[0]?.absents || 0,
      lates: attendanceSummary.rows[0]?.lates || 0,
      half_days: attendanceSummary.rows[0]?.half_days || 0,
      month: monthLabel,
    },
    leave_balances: leaveBalances.rows,
    leave_wallet: leaveBalances.rows,
    active_penalties: activePenalties.rows,
    recent_attendance: recentAttendance.rows,
    leave_requests: leaveRequests.rows,
    upcoming_birthdays: upcomingBirthdayRows,
  };
}

export async function getPendingActions() {
  const result = await pool.query(
    `
      SELECT
        ei.employee_id,
        ei.name,
        eba.account_number AS bank_acc_num,
        ec.e_contact_1_phone AS emergence_contact_1,
        ec.postal_address
      FROM public.employee_info ei
      LEFT JOIN public.emergency_contacts ec ON ec.employee_id = ei.employee_id
      LEFT JOIN public.employee_bank_accounts eba ON eba.employee_id = ei.employee_id
      WHERE eba.account_number IS NULL
         OR ec.e_contact_1_phone IS NULL
         OR ec.postal_address IS NULL
      ORDER BY ei.employee_id ASC
    `
  );

  return result.rows.map((row) => ({
    employee_id: row.employee_id,
    name: row.name,
    missing_fields: [
      !row.bank_acc_num ? 'bank_acc_num' : null,
      !row.emergence_contact_1 ? 'emergence_contact_1' : null,
      !row.postal_address ? 'postal_address' : null,
    ].filter(Boolean),
  }));
}


export async function getUrgentAlerts(days = 30) {
  const result = await pool.query(
    `
      SELECT
        ei.employee_id,
        ei.name,
        ji.probation_end_date,
        ji.contract_end_date
      FROM public.job_info ji
      JOIN public.employee_info ei ON ei.employee_id = ji.employee_id
      WHERE (ji.probation_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + ($1 || ' day')::interval)
         OR (ji.contract_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + ($1 || ' day')::interval)
      ORDER BY ei.employee_id ASC
    `,
    [String(days)]
  );

  const alerts = [];

  for (const row of result.rows) {
    if (row.probation_end_date) {
      const daysRemaining = Math.ceil(
        (new Date(row.probation_end_date).getTime() - Date.now()) / 86400000
      );
      alerts.push({
        employee_id: row.employee_id,
        name: row.name,
        type: 'probation',
        expiry_date: row.probation_end_date,
        days_remaining: daysRemaining,
      });
    }

    if (row.contract_end_date) {
      const daysRemaining = Math.ceil(
        (new Date(row.contract_end_date).getTime() - Date.now()) / 86400000
      );
      alerts.push({
        employee_id: row.employee_id,
        name: row.name,
        type: 'contract',
        expiry_date: row.contract_end_date,
        days_remaining: daysRemaining,
      });
    }
  }

  return alerts;
}
