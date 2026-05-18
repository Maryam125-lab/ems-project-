// Permission checking middleware - validates user has required permission
import pool from '../config/db.js'

// Factory function that creates middleware for specific permission key
export const requirePermission = (key) => {
    const middleware = async (req, res, next) => {
    // Check if user is authenticated
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required.' })
    }

    // Super admin bypass - has all permissions
    if (req.user.is_super_admin) return next()

    // Fetch permissions from database if not cached on request
    if (!req.permissions) {
        const result = await pool.query(
            `SELECT p.permission_key
             FROM permissions p
             JOIN role_permissions rp ON rp.permission_id = p.id
             WHERE rp.role_id = $1`,
            [req.user.role_id]
        )
        req.permissions = new Set(result.rows.map(r => r.permission_key))
    }

    // Check if user has required permission
    if (!req.permissions.has(key)) {
        return res.status(403).json({ error: 'Insufficient permissions.' })
    }

    next()
    }

    // Expose permission metadata for security test runners / introspection.
    middleware.__perm = { mode: 'all', keys: [key] }
    return middleware
}

// Middleware that allows access if the user has ANY of the provided permission keys.
// Useful during permission transitions (e.g. config:read vs config:manage).
export const requireAnyPermission = (keys = []) => {
    const middleware = async (req, res, next) => {
    if (!Array.isArray(keys) || keys.length === 0) {
        return res.status(500).json({ error: 'Server misconfiguration: no permission keys provided.' })
    }

    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required.' })
    }

    if (req.user.is_super_admin) return next()

    if (!req.permissions) {
        const result = await pool.query(
            `SELECT p.permission_key
             FROM permissions p
             JOIN role_permissions rp ON rp.permission_id = p.id
             WHERE rp.role_id = $1`,
            [req.user.role_id]
        )
        req.permissions = new Set(result.rows.map(r => r.permission_key))
    }

    const ok = keys.some((k) => req.permissions.has(k))
    if (!ok) {
        return res.status(403).json({ error: 'Insufficient permissions.' })
    }

    return next()
    }

    middleware.__perm = { mode: 'any', keys: [...keys] }
    return middleware
}
