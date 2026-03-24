import { describe, it, expect } from 'vitest'
import { AppError, Errors } from '../errors'

// ---------------------------------------------------------------------------
// AppError
// ---------------------------------------------------------------------------

describe('AppError', () => {
  describe('construction', () => {
    it('sets message, statusCode, and code from constructor arguments', () => {
      const err = new AppError('Something broke', 500, 'INTERNAL_ERROR')
      expect(err.message).toBe('Something broke')
      expect(err.statusCode).toBe(500)
      expect(err.code).toBe('INTERNAL_ERROR')
    })

    it('sets the name property to "AppError"', () => {
      const err = new AppError('test', 400)
      expect(err.name).toBe('AppError')
    })

    it('is an instance of Error', () => {
      const err = new AppError('test', 400)
      expect(err).toBeInstanceOf(Error)
    })

    it('is an instance of AppError', () => {
      const err = new AppError('test', 400)
      expect(err).toBeInstanceOf(AppError)
    })

    it('allows code to be undefined when omitted', () => {
      const err = new AppError('test', 400)
      expect(err.code).toBeUndefined()
    })

    it('exposes message via the standard Error.message property', () => {
      const err = new AppError('exposed message', 422)
      // Verify the Error super-class message is also set correctly
      expect(String(err.message)).toBe('exposed message')
    })
  })
})

// ---------------------------------------------------------------------------
// Errors factory
// ---------------------------------------------------------------------------

describe('Errors.notFound', () => {
  it('returns an AppError with status 404 and code NOT_FOUND', () => {
    const err = Errors.notFound()
    expect(err).toBeInstanceOf(AppError)
    expect(err.statusCode).toBe(404)
    expect(err.code).toBe('NOT_FOUND')
  })

  it('uses the default message when none is provided', () => {
    const err = Errors.notFound()
    expect(err.message).toBe('Resource not found.')
  })

  it('uses a custom message when one is provided', () => {
    const err = Errors.notFound('This expense could not be found.')
    expect(err.message).toBe('This expense could not be found.')
  })
})

describe('Errors.forbidden', () => {
  it('returns an AppError with status 403 and code FORBIDDEN', () => {
    const err = Errors.forbidden()
    expect(err).toBeInstanceOf(AppError)
    expect(err.statusCode).toBe(403)
    expect(err.code).toBe('FORBIDDEN')
  })

  it('uses the default message when none is provided', () => {
    const err = Errors.forbidden()
    expect(err.message).toBe('You do not have permission to do this.')
  })

  it('uses a custom message when one is provided', () => {
    const err = Errors.forbidden('Custom forbidden message.')
    expect(err.message).toBe('Custom forbidden message.')
  })
})

describe('Errors.conflict', () => {
  it('returns an AppError with status 409', () => {
    const err = Errors.conflict('Duplicate entry.')
    expect(err).toBeInstanceOf(AppError)
    expect(err.statusCode).toBe(409)
  })

  it('uses the default code CONFLICT when no code is provided', () => {
    const err = Errors.conflict('Duplicate entry.')
    expect(err.code).toBe('CONFLICT')
  })

  it('uses a custom code when one is provided', () => {
    const err = Errors.conflict('Email taken.', 'EMAIL_TAKEN')
    expect(err.code).toBe('EMAIL_TAKEN')
  })

  it('uses the provided message', () => {
    const err = Errors.conflict('A category with that name already exists.')
    expect(err.message).toBe('A category with that name already exists.')
  })
})

describe('Errors.unauthenticated', () => {
  it('returns an AppError with status 401 and code UNAUTHENTICATED', () => {
    const err = Errors.unauthenticated()
    expect(err).toBeInstanceOf(AppError)
    expect(err.statusCode).toBe(401)
    expect(err.code).toBe('UNAUTHENTICATED')
  })

  it('uses the fixed human-readable message', () => {
    const err = Errors.unauthenticated()
    expect(err.message).toBe('You must be signed in to do this.')
  })
})

describe('Errors.internal', () => {
  it('returns an AppError with status 500 and code INTERNAL_ERROR', () => {
    const err = Errors.internal()
    expect(err).toBeInstanceOf(AppError)
    expect(err.statusCode).toBe(500)
    expect(err.code).toBe('INTERNAL_ERROR')
  })

  it('uses the fixed safe message that contains no technical detail', () => {
    const err = Errors.internal()
    expect(err.message).toBe('Something went wrong. Please try again.')
  })
})
