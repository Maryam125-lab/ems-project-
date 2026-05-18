import { z } from 'zod'

export const createLeaveRequestSchema = z.object({
    employee_id: z.string().min(1).max(10),
    leave_type_id: z.string().uuid(),
    start_date: z.string().date(),
    end_date: z.string().date(),
    reason: z.string().optional().nullable(),
})

export const earlyReturnSchema = z.object({
    end_by_force: z.string().date(),
})

export const leaveRequestListQuerySchema = z.object({
    status: z.enum(['pending', 'approved', 'rejected']).optional(),
    employee: z.string().min(1).max(10).optional(),
    department: z.string().uuid().optional(),
})

export const leaveBalanceQuerySchema = z.object({
    department: z.string().uuid().optional(),
    location: z.string().uuid().optional(),
    shift: z.string().uuid().optional(),
    employee: z.string().min(1).max(10).optional(),
})
