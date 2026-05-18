// src/schemas/user.schema.js
import { z } from 'zod'

export const createUserSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    employee_id: z.string().min(1).max(10),
    role_id: z.string().uuid(),
})

export const updateUserRoleSchema = z.object({
    role_id: z.string().uuid(),
})
