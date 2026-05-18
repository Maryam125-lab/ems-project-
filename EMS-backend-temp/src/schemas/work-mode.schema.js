import { z } from 'zod'

export const createWorkModeSchema = z.object({
    mode_name: z.string().min(1).max(50),
    is_active: z.boolean().optional().default(true),
})

export const updateWorkModeSchema = z.object({
    mode_name: z.string().min(1).max(50).optional(),
    is_active: z.boolean().optional(),
})
