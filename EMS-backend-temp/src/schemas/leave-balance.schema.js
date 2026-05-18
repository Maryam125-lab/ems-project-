import { z } from 'zod'

export const createLeaveBalanceSchema = z.object({
    employee_id: z.string().min(1).max(10),
    leave_type_id: z.string().uuid(),
    year: z.number().int().min(2020).max(2100),
    balance: z.number().int().min(0).optional().default(0),
    used: z.number().int().min(0).optional().default(0),
})

export const updateLeaveBalanceSchema = createLeaveBalanceSchema.partial()

// Used by: POST /leave-balances/employee/:employeeId/initialize
export const initializeLeaveBalancesSchema = z.object({
    year: z.number().int().min(2020).max(2100),
})

// Used by: PATCH /leave-balances/:id/adjust
export const adjustLeaveBalanceSchema = z.object({
    adjustment: z.number().int(),
})
