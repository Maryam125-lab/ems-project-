import { z } from 'zod'

export const createEmploymentTypeSchema = z.object({
    type_name: z.string().min(1).max(50),
    is_active: z.boolean().optional().default(true),
})

export const updateEmploymentTypeSchema = z.object({
    type_name: z.string().min(1).max(50).optional(),
    is_active: z.boolean().optional(),
})
