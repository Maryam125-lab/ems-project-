// JWT authentication middleware - verifies Bearer tokens
import jwt from 'jsonwebtoken'

// Helper to send standardized error responses
const sendError = (res, statusCode, message) => res.status(statusCode).json({ error: message })

// Extract and validate Bearer token from Authorization header
const extractBearerToken = (authorizationHeader) => {
    if (typeof authorizationHeader !== 'string') {
        return { token: null, statusCode: 401 }
    }
    const [scheme, token] = authorizationHeader.split(' ')
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
        return { token: null, statusCode: 400 }
    }
    return { token, statusCode: null }
}

// Verify JWT token and attach user data to request
export const verifyToken = (req, res, next) => {
    const { token, statusCode } = extractBearerToken(req.headers.authorization)

    if (!token) {
        return sendError(
            res,
            statusCode,
            statusCode === 400
                ? 'Authorization header must use Bearer token format.'
                : 'Authentication token is required.'
        )
    }

    if (!process.env.JWT_SECRET) {
        return sendError(res, 500, 'Authentication service is not configured.')
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET)
        return next()
    } catch (error) {
        if (['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'].includes(error.name)) {
            return sendError(res, 401, 'Invalid or expired authentication token.')
        }
        return sendError(res, 500, 'Unable to authenticate the request.')
    }
}

// Expose metadata so security/audit scripts can verify middleware order.
verifyToken.__auth = true
