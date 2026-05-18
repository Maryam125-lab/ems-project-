import { z } from 'zod'

export const createDesignationSchema = z.object({
    title: z.string().min(1).max(50),
    is_active: z.boolean().optional().default(true),
})

// Important: update schemas must NOT inherit defaults from create schemas.
// Otherwise `{}` becomes `{ is_active: true }` and can cause unintended updates.
export const updateDesignationSchema = z.object({
    title: z.string().min(1).max(50).optional(),
    is_active: z.boolean().optional(),
})
