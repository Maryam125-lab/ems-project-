import { z } from 'zod'

const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/

const attendanceRowSchema = z.object({
    employee_id: z.string().min(1).max(10),
    shift_id: z.string().uuid(),
    check_in: z.string().regex(timeRegex, 'Must be HH:MM or HH:MM:SS').optional().nullable(),
    check_out: z.string().regex(timeRegex, 'Must be HH:MM or HH:MM:SS').optional().nullable(),
    status: z.enum(['present', 'absent', 'late', 'half_day', 'on_leave']),
    notes: z.string().optional().nullable(),
})

export const batchAttendanceSchema = z.object({
    date: z.string().date(),
    rows: z.array(attendanceRowSchema).min(1, 'At least one row is required'),
})
