import { z } from 'zod'

export const createDepartmentSchema = z.object({
    department_code: z.string().min(1),
    department_name: z.string().min(1),
    parent_department_id: z.string().uuid().optional().nullable(),
})

export const updateDepartmentSchema = createDepartmentSchema.partial()
