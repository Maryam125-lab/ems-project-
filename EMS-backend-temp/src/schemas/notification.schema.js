import { z } from 'zod'

export const notificationQuerySchema = z.object({
    scope: z.literal('me'),
})

export const notificationParamsSchema = z.object({
    id: z.string().uuid(),
})

export const createNotificationSchema = z.object({
    user_id: z.string().uuid().optional().nullable(),
    role: z.string().trim().min(1).max(100).optional().nullable(),
    type: z.string().trim().min(1).max(50),
    message: z.string().trim().min(1),
}).refine((data) => Boolean(data.user_id || data.role), {
    message: 'Either user_id or role is required.',
    path: ['user_id'],
})
