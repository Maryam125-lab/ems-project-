import { z } from 'zod'

export const createWorkLocationSchema = z.object({
    location_name: z.string().min(1).max(100),
    is_active: z.boolean().optional().default(true),
})

export const updateWorkLocationSchema = z.object({
    location_name: z.string().min(1).max(100).optional(),
    is_active: z.boolean().optional(),
})
