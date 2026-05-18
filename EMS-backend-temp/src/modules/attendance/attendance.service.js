import pool from '../../config/db.js';
import { AppError } from '../../utils/errors.js';

async function userHasPermissionByUserId(userId, permissionKey) {
  const result = await pool.query(
    `
      SELECT 1
      FROM public.users u
      JOIN public.role_permissions rp ON rp.role_id = u.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE u.id = $1 AND p.permission_key = $2
      LIMIT 1
    `,
    [userId, permissionKey]
  );

  return result.rowCount > 0;
}

async function isSuperAdmin(roleId) {
  const result = await pool.query(
    `SELECT role_name FROM public.roles WHERE id = $1 LIMIT 1`,
    [roleId]
  );

  const roleName = result.rows[0]?.role_name;
  return roleName === 'super_admin' || roleName === 'hr_manager' || roleName === 'hr_executive';
}

function computeLateMinutes(checkIn, shiftStart, lateAfterMinutes) {
  if (!checkIn || !shiftStart) {
    return 0;
  }

  const checkInDate = new Date(`1970-01-01T${checkIn}Z`);
  const shiftStartDate = new Date(`1970-01-01T${shiftStart}Z`);
  const lateThreshold = new Date(shiftStartDate.getTime() + Number(lateAfterMinutes || 0) * 60000);

  if (checkInDate <= lateThreshold) {
    return 0;
  }

  return Math.floor((checkInDate.getTime() - lateThreshold.getTime()) / 60000);
}

export async function getAttendanceSheet(date, locationId, callerEmployeeId, roleId) {
  const superAdmin = await isSuperAdmin(roleId);

  if (!superAdmin) {
    const callerLocation = await pool.query(
      `SELECT work_location_id FROM public.job_info WHERE employee_id = $1 LIMIT 1`,
      [callerEmployeeId]
    );

    if (callerLocation.rowCount === 0 || callerLocation.rows[0].work_location_id !== locationId) {
      throw new AppError(403, 'FORBIDDEN', 'Cannot access attendance for another location.');
    }
  }

  let queryStr = `
      SELECT
        ei.employee_id,
        ei.name,
        d.title AS designation,
        ji.shift_id,
        s.name AS shift_name,
        s.start_time,
        s.end_time,
        s.late_after_minutes,
        a.id AS attendance_id,
        a.date,
        a.check_in,
        a.check_out,
        a.status,
        a.notes,
        a.ack,
        a.state,
        lr.id AS leave_id
      FROM public.job_info ji
      JOIN public.employee_info ei ON ei.employee_id = ji.employee_id
      LEFT JOIN public.designations d ON d.id = ji.designation_id
      LEFT JOIN public.shifts s ON s.id = ji.shift_id
      LEFT JOIN public.attendance a
        ON a.employee_id = ji.employee_id
       AND a.date = $1
      LEFT JOIN public.leave_requests lr
        ON lr.employee_id = ji.employee_id
       AND lr.status = 'approved'
       AND $1::date BETWEEN lr.start_date AND COALESCE(lr.end_by_force, lr.end_date)
      WHERE 1=1
  `;
  const params = [date];
  if (locationId) {
      params.push(locationId);
      queryStr += ` AND ji.work_location_id = $2`;
  }
  queryStr += ` ORDER BY ei.employee_id ASC`;

  const employeesResult = await pool.query(queryStr, params);

  const rows = employeesResult.rows.map((row) => {
    const synthetic = !row.attendance_id;
    const isOnLeave = Boolean(row.leave_id);

    const status = isOnLeave
      ? 'on_leave'
      : row.status || 'absent';

    const notes = isOnLeave ? 'On approved leave' : row.notes;

    return {
      attendance_id: row.attendance_id,
      employee_id: row.employee_id,
      name: row.name,
      designation: row.designation,
      shift: {
        id: row.shift_id,
        name: row.shift_name,
        expected_in: row.start_time,
        expected_out: row.end_time,
        late_after_minutes: row.late_after_minutes,
      },
      date: row.date || date,
      check_in: row.check_in,
      check_out: row.check_out,
      status,
      notes,
      ack: row.ack || false,
      state: row.state || 'draft',
      late_by_minutes: computeLateMinutes(row.check_in, row.start_time, row.late_after_minutes),
      read_only_notes: isOnLeave,
      synthetic,
    };
  });

  return {
    date,
    location_id: locationId,
    rows,
  };
}

export async function saveAttendanceSheet(date, locationId, rows, markedByUserId) {
  const lockCheck = await pool.query(
    `
      SELECT 1
      FROM public.attendance a
      JOIN public.job_info ji ON ji.employee_id = a.employee_id
      WHERE a.date = $1
        AND ji.work_location_id = $2
        AND a.state IN ('submitted', 'locked')
      LIMIT 1
    `,
    [date, locationId]
  );

  if (lockCheck.rowCount > 0) {
    throw new AppError(409, 'SHEET_LOCKED', 'Attendance sheet is locked for editing.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const row of rows) {
      const shiftResult = await client.query(
        `SELECT shift_id FROM public.job_info WHERE employee_id = $1 AND work_location_id = $2 LIMIT 1`,
        [row.employee_id, locationId]
      );

      if (shiftResult.rowCount === 0) {
        throw new AppError(404, 'NOT_FOUND', `Employee ${row.employee_id} not found in location.`);
      }

      const shiftId = shiftResult.rows[0].shift_id;

      await client.query(
        `
          INSERT INTO public.attendance (
            employee_id,
            shift_id,
            date,
            check_in,
            check_out,
            status,
            notes,
            marked_by,
            state,
            ack
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'saved', COALESCE($9, false))
          ON CONFLICT (employee_id, date)
          DO UPDATE SET
            shift_id = EXCLUDED.shift_id,
            check_in = EXCLUDED.check_in,
            check_out = EXCLUDED.check_out,
            status = EXCLUDED.status,
            notes = EXCLUDED.notes,
            marked_by = EXCLUDED.marked_by,
            state = 'saved',
            updated_at = now()
        `,
        [
          row.employee_id,
          shiftId,
          date,
          row.check_in || null,
          row.check_out || null,
          row.status,
          row.notes || null,
          markedByUserId,
          row.ack,
        ]
      );

      await client.query(
        `
          INSERT INTO public.notifications (user_id, role, type, message, created_by)
          SELECT u.id, NULL, 'attendance_marked', $2, $3
          FROM public.users u
          WHERE u.employee_id = $1
        `,
        [
          row.employee_id,
          `Your attendance for ${date} has been recorded. Status: ${row.status}. Please acknowledge.`,
          markedByUserId,
        ]
      );
    }

    await client.query('COMMIT');

    return {
      saved_count: rows.length,
      date,
      state: 'saved',
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function acknowledgeAttendance(attendanceId, employeeId) {
  const attendanceResult = await pool.query(
    `SELECT * FROM public.attendance WHERE id = $1 LIMIT 1`,
    [attendanceId]
  );

  if (attendanceResult.rowCount === 0) {
    throw new AppError(404, 'NOT_FOUND', 'Attendance record not found.');
  }

  const attendance = attendanceResult.rows[0];

  if (attendance.employee_id !== employeeId) {
    throw new AppError(403, 'FORBIDDEN', 'You can acknowledge only your own attendance.');
  }

  if (attendance.state === 'submitted' || attendance.state === 'locked') {
    throw new AppError(409, 'SHEET_LOCKED', 'Attendance sheet is locked.');
  }

  const updated = await pool.query(
    `
      UPDATE public.attendance
      SET ack = true,
          updated_at = now()
      WHERE id = $1
      RETURNING id, employee_id, shift_id, date, check_in, check_out, status, notes, marked_by, state, ack
    `,
    [attendanceId]
  );

  return updated.rows[0];
}

export async function submitSheetToHO(date, locationId, submittedByUserId) {
  const hasPermission = await userHasPermissionByUserId(submittedByUserId, 'attendance:submit_ho');
  if (!hasPermission) {
    throw new AppError(403, 'FORBIDDEN', 'Insufficient permission to submit attendance sheet.');
  }

  const notSavedCheck = await pool.query(
    `
      SELECT ji.employee_id, a.state
      FROM public.job_info ji
      LEFT JOIN public.attendance a
        ON a.employee_id = ji.employee_id
       AND a.date = $1
      WHERE ji.work_location_id = $2
        AND COALESCE(a.state, 'draft') <> 'saved'
      LIMIT 1
    `,
    [date, locationId]
  );

  if (notSavedCheck.rowCount > 0) {
    throw new AppError(409, 'SHEET_NOT_SAVED', 'All rows must be saved before submission.');
  }

  const updateResult = await pool.query(
    `
      UPDATE public.attendance a
      SET state = 'submitted',
          submitted_by = $3,
          submitted_at = now(),
          updated_at = now()
      FROM public.job_info ji
      WHERE a.employee_id = ji.employee_id
        AND a.date = $1
        AND ji.work_location_id = $2
      RETURNING a.id
    `,
    [date, locationId, submittedByUserId]
  );

  return {
    submitted_count: updateResult.rowCount,
    date,
    state: 'submitted',
  };
}

export async function requestUnlock(date, locationId, reason, requestedByUserId) {
  await pool.query(
    `
      INSERT INTO public.notifications (user_id, role, type, message, created_by)
      VALUES
      (NULL, 'super_admin', 'unlock_request', $1, $2),
      (NULL, 'hr', 'unlock_request', $1, $2)
    `,
    [
      `Unlock requested for attendance sheet ${date} at location ${locationId}. Reason: ${reason}`,
      requestedByUserId,
    ]
  );

  return { status: 'unlock_requested' };
}

export async function approveUnlock(date, locationId, unlockedByUserId, unlockReason) {
  const hasPermission = await userHasPermissionByUserId(unlockedByUserId, 'attendance:unlock');
  if (!hasPermission) {
    throw new AppError(403, 'FORBIDDEN', 'Insufficient permission to unlock attendance sheet.');
  }

  const result = await pool.query(
    `
      UPDATE public.attendance a
      SET state = 'ho_unlocked',
          unlocked_by = $3,
          unlock_reason = $4,
          unlocked_at = now(),
          updated_at = now()
      FROM public.job_info ji
      WHERE a.employee_id = ji.employee_id
        AND a.date = $1
        AND ji.work_location_id = $2
      RETURNING a.id
    `,
    [date, locationId, unlockedByUserId, unlockReason]
  );

  return { unlocked_count: result.rowCount };
}

export async function getMonthlyReport(year, month, locationId, filters = {}) {
  const params = [year, month, locationId];
  const whereExtra = [];

  if (filters.employee_id) {
    params.push(filters.employee_id);
    whereExtra.push(`ei.employee_id = $${params.length}`);
  }

  if (filters.department_id) {
    params.push(filters.department_id);
    whereExtra.push(`ji.department_id = $${params.length}`);
  }

  const report = await pool.query(
    `
      SELECT
        ei.employee_id,
        ei.name,
        d.title AS designation,
        COUNT(*) FILTER (WHERE a.status = 'present')::int AS presents,
        COUNT(*) FILTER (WHERE a.status = 'absent')::int AS absents,
        COUNT(*) FILTER (WHERE a.status = 'late')::int AS lates,
        COUNT(*) FILTER (WHERE a.status = 'half_day')::int AS half_days,
        COUNT(*) FILTER (WHERE a.status = 'on_leave')::int AS on_leaves
      FROM public.job_info ji
      JOIN public.employee_info ei ON ei.employee_id = ji.employee_id
      LEFT JOIN public.designations d ON d.id = ji.designation_id
      LEFT JOIN public.attendance a
        ON a.employee_id = ji.employee_id
       AND EXTRACT(YEAR FROM a.date) = $1
       AND EXTRACT(MONTH FROM a.date) = $2
      WHERE ji.work_location_id = $3
      ${whereExtra.length ? `AND ${whereExtra.join(' AND ')}` : ''}
      GROUP BY ei.employee_id, ei.name, d.title
      ORDER BY ei.employee_id ASC
    `,
    params
  );

  const totalWorkingDaysResult = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM generate_series(
        make_date($1::int, $2::int, 1),
        (make_date($1::int, $2::int, 1) + INTERVAL '1 month - 1 day')::date,
        INTERVAL '1 day'
      ) AS d(day)
      WHERE EXTRACT(ISODOW FROM d.day) <= 6
    `,
    [year, month]
  );

  const totalWorkingDays = totalWorkingDaysResult.rows[0]?.total || 0;

  return report.rows.map((row) => {
    const weightedPresent =
      Number(row.presents || 0) + Number(row.lates || 0) + Number(row.half_days || 0) * 0.5;
    const attendancePercent =
      totalWorkingDays > 0 ? Number(((weightedPresent / totalWorkingDays) * 100).toFixed(1)) : 0;

    return {
      employee_id: row.employee_id,
      name: row.name,
      designation: row.designation,
      presents: Number(row.presents || 0),
      absents: Number(row.absents || 0),
      lates: Number(row.lates || 0),
      half_days: Number(row.half_days || 0),
      on_leaves: Number(row.on_leaves || 0),
      total_working_days: totalWorkingDays,
      attendance_percent: attendancePercent,
    };
  });
}

export async function getEmployeeAttendanceLog(employeeId) {
  const result = await pool.query(
    `
      SELECT 
        date, 
        check_in, 
        check_out, 
        status, 
        notes
      FROM public.attendance
      WHERE employee_id = $1
      ORDER BY date DESC
      LIMIT 30
    `,
    [employeeId]
  );

  return result.rows;
}
