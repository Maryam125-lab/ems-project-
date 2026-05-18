import { z } from 'zod'

export const dashboardMetricsQuerySchema = z.object({
    range: z.enum(['6m', '12m']).default('6m'),
})
