// Input sanitization middleware to prevent XSS attacks
export const sanitizeInput = (req, res, next) => {
    if (!req.body || typeof req.body !== 'object') {
        return next()
    }

    const sanitize = (value) => {
        if (typeof value === 'string') {
            // Remove script tags and event handlers
            return value
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<script>/gi, '')
                .replace(/<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '')
                .replace(/<iframe/gi, '<iframe')
                .replace(/<object/gi, '<object')
                .replace(/<embed/gi, '<embed')
                .replace(/<form/gi, '<form')
                .trim()
        }
        if (typeof value === 'object' && value !== null) {
            if (Array.isArray(value)) {
                return value.map(sanitize)
            }
            const sanitized = {}
            for (const key in value) {
                if (Object.prototype.hasOwnProperty.call(value, key)) {
                    sanitized[key] = sanitize(value[key])
                }
            }
            return sanitized
        }
        return value
    }

    req.body = sanitize(req.body)
    next()
}

// Strip HTML tags completely (for fields that shouldn't have any HTML)
export const stripHtml = (req, res, next) => {
    if (!req.body || typeof req.body !== 'object') {
        return next()
    }

    const strip = (value) => {
        if (typeof value === 'string') {
            return value.replace(/<[^>]*>/g, '').trim()
        }
        if (typeof value === 'object' && value !== null) {
            if (Array.isArray(value)) {
                return value.map(strip)
            }
            const stripped = {}
            for (const key in value) {
                if (Object.prototype.hasOwnProperty.call(value, key)) {
                    stripped[key] = strip(value[key])
                }
            }
            return stripped
        }
        return value
    }

    req.body = strip(req.body)
    next()
}
