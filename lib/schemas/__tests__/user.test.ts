import { describe, it, expect } from 'vitest'
import { LoginSchema, RegisterSchema, UpdateUserSchema } from '../user'

// ---------------------------------------------------------------------------
// LoginSchema
// ---------------------------------------------------------------------------

describe('LoginSchema', () => {
  describe('happy path', () => {
    it('accepts a valid email and password', () => {
      const result = LoginSchema.safeParse({
        email: 'user@example.com',
        password: 'secret',
      })
      expect(result.success).toBe(true)
    })

    it('lowercases the email before returning it', () => {
      const result = LoginSchema.safeParse({
        email: 'User@EXAMPLE.COM',
        password: 'secret',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.email).toBe('user@example.com')
      }
    })

    it('rejects an email with leading/trailing whitespace (trim runs after email validation)', () => {
      // Zod evaluates .email() before applying the .trim() transform.
      // A padded email like '  user@example.com  ' fails the email regex and
      // is therefore rejected. Callers must trim input before parsing.
      const result = LoginSchema.safeParse({
        email: '  user@example.com  ',
        password: 'secret',
      })
      expect(result.success).toBe(false)
    })

    it('accepts a single-character password (minimum is 1)', () => {
      const result = LoginSchema.safeParse({
        email: 'user@example.com',
        password: 'x',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('email field validation', () => {
    it('rejects a missing email field', () => {
      const result = LoginSchema.safeParse({ password: 'secret' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map(i => i.path[0])
        expect(paths).toContain('email')
      }
    })

    it('rejects an email that is not a valid address', () => {
      const result = LoginSchema.safeParse({
        email: 'not-an-email',
        password: 'secret',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const emailIssue = result.error.issues.find(i => i.path[0] === 'email')
        expect(emailIssue?.message).toBe('Please enter a valid email address.')
      }
    })

    it('rejects an empty string as an email', () => {
      const result = LoginSchema.safeParse({ email: '', password: 'secret' })
      expect(result.success).toBe(false)
    })

    it('rejects a null email', () => {
      const result = LoginSchema.safeParse({ email: null, password: 'secret' })
      expect(result.success).toBe(false)
    })
  })

  describe('password field validation', () => {
    it('rejects a missing password field', () => {
      const result = LoginSchema.safeParse({ email: 'user@example.com' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map(i => i.path[0])
        expect(paths).toContain('password')
      }
    })

    it('rejects an empty string as a password', () => {
      const result = LoginSchema.safeParse({
        email: 'user@example.com',
        password: '',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const pwIssue = result.error.issues.find(i => i.path[0] === 'password')
        expect(pwIssue?.message).toBe('Password is required.')
      }
    })
  })
})

// ---------------------------------------------------------------------------
// RegisterSchema
// ---------------------------------------------------------------------------

describe('RegisterSchema', () => {
  const validPayload = {
    name: 'Alice',
    email: 'alice@example.com',
    password: 'password123',
    confirmPassword: 'password123',
  }

  describe('happy path', () => {
    it('accepts a fully valid registration payload', () => {
      const result = RegisterSchema.safeParse(validPayload)
      expect(result.success).toBe(true)
    })

    it('rejects an email with leading/trailing whitespace (trim runs after email validation)', () => {
      // Same Zod evaluation order applies here: .email() runs before .trim().
      // A padded email is rejected. Input must be trimmed before parsing.
      const result = RegisterSchema.safeParse({
        ...validPayload,
        email: '  ALICE@EXAMPLE.COM  ',
      })
      expect(result.success).toBe(false)
    })

    it('trims whitespace from the name', () => {
      const result = RegisterSchema.safeParse({
        ...validPayload,
        name: '  Alice  ',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Alice')
      }
    })

    it('accepts a password of exactly 8 characters (minimum boundary)', () => {
      const result = RegisterSchema.safeParse({
        ...validPayload,
        password: '12345678',
        confirmPassword: '12345678',
      })
      expect(result.success).toBe(true)
    })

    it('accepts a password of exactly 72 characters (maximum boundary)', () => {
      const maxPassword = 'a'.repeat(72)
      const result = RegisterSchema.safeParse({
        ...validPayload,
        password: maxPassword,
        confirmPassword: maxPassword,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('name field validation', () => {
    it('rejects a missing name', () => {
      const result = RegisterSchema.safeParse({
        ...validPayload,
        name: undefined,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map(i => i.path[0])
        expect(paths).toContain('name')
      }
    })

    it('rejects an empty string as a name', () => {
      const result = RegisterSchema.safeParse({ ...validPayload, name: '' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const nameIssue = result.error.issues.find(i => i.path[0] === 'name')
        expect(nameIssue?.message).toBe('Name is required.')
      }
    })

    it('rejects a name that exceeds 100 characters', () => {
      const result = RegisterSchema.safeParse({
        ...validPayload,
        name: 'a'.repeat(101),
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const nameIssue = result.error.issues.find(i => i.path[0] === 'name')
        expect(nameIssue?.message).toBe('Name cannot exceed 100 characters.')
      }
    })

    it('accepts a name of exactly 100 characters (maximum boundary)', () => {
      const result = RegisterSchema.safeParse({
        ...validPayload,
        name: 'a'.repeat(100),
      })
      expect(result.success).toBe(true)
    })
  })

  describe('email field validation', () => {
    it('rejects a missing email', () => {
      const { email: _email, ...rest } = validPayload
      const result = RegisterSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it('rejects an invalid email format', () => {
      const result = RegisterSchema.safeParse({
        ...validPayload,
        email: 'not-an-email',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const emailIssue = result.error.issues.find(i => i.path[0] === 'email')
        expect(emailIssue?.message).toBe('Please enter a valid email address.')
      }
    })
  })

  describe('password field validation', () => {
    it('rejects a password shorter than 8 characters', () => {
      const result = RegisterSchema.safeParse({
        ...validPayload,
        password: '1234567',
        confirmPassword: '1234567',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const pwIssue = result.error.issues.find(i => i.path[0] === 'password')
        expect(pwIssue?.message).toBe('Password must be at least 8 characters.')
      }
    })

    it('rejects a password longer than 72 characters', () => {
      const longPassword = 'a'.repeat(73)
      const result = RegisterSchema.safeParse({
        ...validPayload,
        password: longPassword,
        confirmPassword: longPassword,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const pwIssue = result.error.issues.find(i => i.path[0] === 'password')
        expect(pwIssue?.message).toBe('Password cannot exceed 72 characters.')
      }
    })

    it('rejects when password and confirmPassword do not match', () => {
      const result = RegisterSchema.safeParse({
        ...validPayload,
        password: 'password123',
        confirmPassword: 'different123',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const mismatchIssue = result.error.issues.find(
          i => i.path[0] === 'confirmPassword',
        )
        expect(mismatchIssue?.message).toBe('Passwords do not match.')
      }
    })

    it('rejects a missing confirmPassword', () => {
      const result = RegisterSchema.safeParse({
        ...validPayload,
        confirmPassword: undefined,
      })
      expect(result.success).toBe(false)
    })

    it('rejects a missing password', () => {
      const result = RegisterSchema.safeParse({
        ...validPayload,
        password: undefined,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('rejects an entirely empty object', () => {
      const result = RegisterSchema.safeParse({})
      expect(result.success).toBe(false)
      if (!result.success) {
        // All four fields should have issues
        const paths = result.error.issues.map(i => i.path[0])
        expect(paths).toContain('name')
        expect(paths).toContain('email')
        expect(paths).toContain('password')
      }
    })

    it('accepts a whitespace-only name (Zod validates min(1) before applying trim)', () => {
      // Zod evaluates .min(1) against the original value before applying .trim().
      // '   ' has length 3, so it passes .min(1), and is then trimmed to ''.
      // This is a known Zod v3 evaluation-order characteristic: transforms run
      // after validators. The result is a parsed name of ''.
      // If this behaviour is undesirable, the schema should use .trim().min(1)
      // (i.e. swap the order) or add a .refine() check.
      const result = RegisterSchema.safeParse({
        ...validPayload,
        name: '   ',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        // After parsing, the name has been trimmed to an empty string
        expect(result.data.name).toBe('')
      }
    })
  })
})

// ---------------------------------------------------------------------------
// UpdateUserSchema
// ---------------------------------------------------------------------------

describe('UpdateUserSchema', () => {
  describe('happy path', () => {
    it('accepts an empty object (all fields are optional)', () => {
      const result = UpdateUserSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('accepts a valid name update', () => {
      const result = UpdateUserSchema.safeParse({ name: 'Bob' })
      expect(result.success).toBe(true)
    })

    it('accepts a 3-letter currency code and uppercases it', () => {
      const result = UpdateUserSchema.safeParse({ currency: 'usd' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.currency).toBe('USD')
      }
    })

    it('accepts both name and currency together', () => {
      const result = UpdateUserSchema.safeParse({ name: 'Bob', currency: 'EUR' })
      expect(result.success).toBe(true)
    })
  })

  describe('name field validation', () => {
    it('rejects an empty string as a name', () => {
      const result = UpdateUserSchema.safeParse({ name: '' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const nameIssue = result.error.issues.find(i => i.path[0] === 'name')
        expect(nameIssue?.message).toBe('Name is required.')
      }
    })

    it('rejects a name that exceeds 100 characters', () => {
      const result = UpdateUserSchema.safeParse({ name: 'a'.repeat(101) })
      expect(result.success).toBe(false)
      if (!result.success) {
        const nameIssue = result.error.issues.find(i => i.path[0] === 'name')
        expect(nameIssue?.message).toBe('Name cannot exceed 100 characters.')
      }
    })

    it('trims the name value', () => {
      const result = UpdateUserSchema.safeParse({ name: '  Bob  ' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Bob')
      }
    })
  })

  describe('currency field validation', () => {
    it('rejects a currency code shorter than 3 characters', () => {
      const result = UpdateUserSchema.safeParse({ currency: 'US' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const currencyIssue = result.error.issues.find(
          i => i.path[0] === 'currency',
        )
        expect(currencyIssue?.message).toBe(
          'Currency must be a 3-letter code (e.g. USD).',
        )
      }
    })

    it('rejects a currency code longer than 3 characters', () => {
      const result = UpdateUserSchema.safeParse({ currency: 'USDD' })
      expect(result.success).toBe(false)
    })

    it('rejects an empty string as a currency code', () => {
      const result = UpdateUserSchema.safeParse({ currency: '' })
      expect(result.success).toBe(false)
    })
  })
})
