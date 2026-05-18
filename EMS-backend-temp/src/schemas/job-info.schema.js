import { z } from 'zod'

export const createJobInfoSchema = z.object({
    employee_id: z.string().min(1).max(10),
    department_id: z.string().uuid(),
    designation_id: z.string().uuid(),
    employment_type_id: z.string().uuid(),
    job_status_id: z.string().uuid(),
    work_mode_id: z.string().uuid(),
    work_location_id: z.string().uuid(),
    shift_id: z.string().uuid(),
    date_of_joining: z.string().date(),
    date_of_exit: z.string().date().optional().nullable(),
})

export const updateJobInfoSchema = createJobInfoSchema.partial()

export const jobInfoQuerySchema = z.object({
    employee: z.string().min(1).max(10).optional(),
})
