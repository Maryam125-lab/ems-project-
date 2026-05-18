import { sendError } from '../utils/respond.js';

export function validate(zodSchema) {
  const middleware = (req, res, next) => {
    const result = zodSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed.',
          details: result.error.issues,
        },
      });
    }

    req.body = result.data;
    return next();
  };

  middleware.__validate = true;
  middleware.__schema = zodSchema;
  return middleware;
}

export function validateParams(zodSchema) {
  const middleware = (req, res, next) => {
    const result = zodSchema.safeParse(req.params);

    if (!result.success) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Path parameter validation failed.',
          details: result.error.issues,
        },
      });
    }

    req.params = result.data;
    return next();
  };
  return middleware;
}

export function validateQuery(zodSchema) {
  const middleware = (req, res, next) => {
    const result = zodSchema.safeParse(req.query);

    if (!result.success) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Query parameter validation failed.',
          details: result.error.issues,
        },
      });
    }

    req.query = result.data;
    return next();
  };
  return middleware;
}
