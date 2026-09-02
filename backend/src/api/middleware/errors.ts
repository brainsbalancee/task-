import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';

/** An error that carries the HTTP status the client should see. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string = 'error',
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static notFound(message = 'Resource not found'): HttpError {
    return new HttpError(404, message, 'not_found');
  }

  static badRequest(message: string, details?: unknown): HttpError {
    return new HttpError(400, message, 'bad_request', details);
  }
}

/**
 * Wraps an async handler so a rejected promise reaches the error middleware.
 * Without this, Express 4 silently hangs the request on an async throw.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    void fn(req, res, next).catch(next);
  };

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: 'not_found', message: `No route for ${req.method} ${req.path}` },
  });
};

/**
 * Single error shape for the whole API:
 *   { "error": { "code": "...", "message": "...", "details": [...] } }
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'validation_failed',
        message: 'Invalid query parameters',
        details: err.issues.map((i) => ({ field: i.path.join('.') || '(root)', message: i.message })),
      },
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
    return;
  }

  // Unexpected: log the real error server-side, return an opaque message.
  console.error('[unhandled]', err);
  res.status(500).json({
    error: { code: 'internal_error', message: 'Something went wrong handling this request' },
  });
}
