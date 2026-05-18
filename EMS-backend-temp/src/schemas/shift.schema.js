import { z } from 'zod'

const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/

export const createShiftSchema = z.object({
    name: z.string().min(1).max(100),
    start_time: z.string().regex(timeRegex, 'Must be HH:MM or HH:MM:SS'),
    end_time: z.string().regex(timeRegex, 'Must be HH:MM or HH:MM:SS'),
    late_after_minutes: z.number().int().min(0).optional().default(15),
    is_active: z.boolean().optional().default(true),
})

export const updateShiftSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    start_time: z.string().regex(timeRegex, 'Must be HH:MM or HH:MM:SS').optional(),
    end_time: z.string().regex(timeRegex, 'Must be HH:MM or HH:MM:SS').optional(),
    late_after_minutes: z.number().int().min(0).optional(),
    is_active: z.boolean().optional(),
})
