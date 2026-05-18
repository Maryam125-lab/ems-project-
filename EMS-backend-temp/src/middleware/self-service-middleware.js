// Self-service middleware - restricts employee role to only their own data
export const enforceSelfService = (options = {}) => {
    const { paramKey = 'id', bodyKey = 'employee_id', queryKey = 'employee', allowHR = true } = options

    // Return middleware function that checks data ownership
    return (req, res, next) => {
        // Super admin bypass
        if (req.user?.is_super_admin) return next()

        // HR bypass (if allowHR is true)
        if (allowHR && (req.user?.role === 'hr_manager' || req.user?.role === 'hr_executive')) {
            return next()
        }

        // Employee role - enforce self-service
        const targetId = req.params[paramKey] || req.body[bodyKey] || req.query[queryKey]

        // Check if accessing another employee's data
        if (targetId && targetId !== req.user?.employee_id) {
            return res.status(403).json({
                error: 'Access denied. You can only access your own data.'
            })
        }

        // Force employee_id in body to match current user
        if (req.body && bodyKey in req.body) {
            req.body[bodyKey] = req.user?.employee_id
        }

        // Force employee filter in query to current user
        if (req.query && queryKey in req.query) {
            req.query[queryKey] = req.user?.employee_id
        }

        next()
    }
}

// Middleware to ensure employee can only access their own data by ID
export const enforceEmployeeOwner = (req, res, next) => {
    // Super admin bypass
    if (req.user?.is_super_admin) return next()

    // HR bypass
    if (req.user?.role === 'hr_manager' || req.user?.role === 'hr_executive') {
        return next()
    }

    // Employee role - check ownership
    if (req.params.id !== req.user?.employee_id) {
        return res.status(403).json({
            error: 'Access denied. You can only access your own data.'
        })
    }

    next()
}
