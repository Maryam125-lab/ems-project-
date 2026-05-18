import { z } from 'zod'

export const createEmployeeSchema = z.object({
    employee_id: z.string().min(1).max(10),
    name: z.string().min(1).max(100),
    father_name: z.string().min(1).max(100),
    cnic: z.string().min(1).max(20),
    date_of_birth: z.string().min(1).max(15),
})

export const updateEmployeeSchema = z.object({
    employee_id: z.string().min(1).max(10).optional(),
    name: z.string().min(1).max(100).optional(),
    father_name: z.string().min(1).max(100).optional(),
    cnic: z.string().min(1).max(20).optional(),
    date_of_birth: z.string().min(1).max(15).optional(),
})
