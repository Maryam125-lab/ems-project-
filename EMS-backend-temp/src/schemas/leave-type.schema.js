import { z } from 'zod'

export const createLeaveTypeSchema = z.object({
    name: z.string().min(1).max(50),
    is_active: z.boolean().optional().default(true),
})

// No defaults on update (avoid `{}` -> `{ is_active: true }`).
export const updateLeaveTypeSchema = z.object({
    name: z.string().min(1).max(50).optional(),
    is_active: z.boolean().optional(),
})
