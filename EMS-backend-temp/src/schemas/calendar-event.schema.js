import { z } from 'zod'

const visibilitySchema = z.enum(['all', 'hr', 'employee'])

export const calendarEventQuerySchema = z.object({
    from: z.string().date(),
    to: z.string().date(),
}).refine((data) => data.from <= data.to, {
    message: 'From date must be before or equal to to date.',
    path: ['to'],
})

export const calendarEventParamsSchema = z.object({
    id: z.string().uuid(),
})

export const createCalendarEventSchema = z.object({
    type: z.string().trim().min(1).max(50),
    date: z.string().date(),
    title: z.string().trim().min(1).max(255),
    visibility: visibilitySchema.default('all'),
})

export const updateCalendarEventSchema = z.object({
    type: z.string().trim().min(1).max(50).optional(),
    date: z.string().date().optional(),
    title: z.string().trim().min(1).max(255).optional(),
    visibility: visibilitySchema.optional(),
}).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required.',
})
