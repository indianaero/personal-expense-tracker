import { z } from 'zod'

export const LoginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required.' })
    .email({ message: 'Please enter a valid email address.' })
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: 'Password is required.' })
    .min(1, { message: 'Password is required.' }),
})

export const RegisterSchema = z
  .object({
    name: z
      .string({ required_error: 'Name is required.' })
      .min(1,   { message: 'Name is required.' })
      .max(100, { message: 'Name cannot exceed 100 characters.' })
      .trim(),
    email: z
      .string({ required_error: 'Email is required.' })
      .email({ message: 'Please enter a valid email address.' })
      .toLowerCase()
      .trim(),
    password: z
      .string({ required_error: 'Password is required.' })
      .min(8,  { message: 'Password must be at least 8 characters.' })
      .max(72, { message: 'Password cannot exceed 72 characters.' }),
    confirmPassword: z
      .string({ required_error: 'Please confirm your password.' }),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path:    ['confirmPassword'],
  })

export const UpdateUserSchema = z.object({
  name: z
    .string()
    .min(1,   { message: 'Name is required.' })
    .max(100, { message: 'Name cannot exceed 100 characters.' })
    .trim()
    .optional(),
  currency: z
    .string()
    .length(3, { message: 'Currency must be a 3-letter code (e.g. USD).' })
    .toUpperCase()
    .optional(),
})

export type LoginInput     = z.infer<typeof LoginSchema>
export type RegisterInput  = z.infer<typeof RegisterSchema>
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>
