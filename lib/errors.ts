export class AppError extends Error {
  constructor(
    public readonly message:    string,
    public readonly statusCode: number,
    public readonly code?:      string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const Errors = {
  notFound: (msg = 'Resource not found.') =>
    new AppError(msg, 404, 'NOT_FOUND'),

  forbidden: (msg = 'You do not have permission to do this.') =>
    new AppError(msg, 403, 'FORBIDDEN'),

  conflict: (msg: string, code?: string) =>
    new AppError(msg, 409, code ?? 'CONFLICT'),

  unauthenticated: () =>
    new AppError('You must be signed in to do this.', 401, 'UNAUTHENTICATED'),

  internal: () =>
    new AppError('Something went wrong. Please try again.', 500, 'INTERNAL_ERROR'),
}
