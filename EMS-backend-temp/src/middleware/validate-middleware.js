/**
 * validate()
 * Backwards-compatible body validation:
 *   validate(zodSchema)
 *
 * Extended validation (params/query/body):
 *   validate({ body: zodBody, params: zodParams, query: zodQuery })
 */
export const validate = (schemaOrGroup) => {
    const middleware = (req, res, next) => {
        const checks = []

        // Legacy shape: validate(zodSchema) validates req.body only.
        if (schemaOrGroup && typeof schemaOrGroup.safeParse === 'function') {
            checks.push({ source: 'body', schema: schemaOrGroup, value: req.body })
        } else {
            if (schemaOrGroup?.body) checks.push({ source: 'body', schema: schemaOrGroup.body, value: req.body })
            if (schemaOrGroup?.params) checks.push({ source: 'params', schema: schemaOrGroup.params, value: req.params })
            if (schemaOrGroup?.query) checks.push({ source: 'query', schema: schemaOrGroup.query, value: req.query })
        }

        const allIssues = []
        const parsed = {}

        for (const c of checks) {
            const result = c.schema.safeParse(c.value)
            if (!result.success) {
                for (const i of result.error.issues) {
                    const suffix = i.path?.length ? `.${i.path.join('.')}` : ''
                    allIssues.push({
                        field: `${c.source}${suffix}`,
                        message: i.message,
                    })
                }
            } else {
                parsed[c.source] = result.data
            }
        }

        if (allIssues.length) {
            return res.status(422).json({
                error: 'Validation failed',
                issues: allIssues,
            })
        }

        if (parsed.body) req.body = parsed.body
        if (parsed.params) req.params = parsed.params

        // Express's `req.query` is implemented as a getter without a setter (in ESM/strict mode,
        // assigning can throw). Validation already guarantees shape, so we keep `req.query` as-is
        // and expose the parsed version for optional use.
        if (parsed.query) {
            req.validated = req.validated ?? {}
            req.validated.query = parsed.query
        }
        next()
    }

    // Expose metadata so security/audit scripts can verify middleware order.
    middleware.__validate = true
    middleware.__schema = schemaOrGroup
    return middleware
}
