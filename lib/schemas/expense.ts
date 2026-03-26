import { z } from 'zod'

export const CreateExpenseSchema = z.object({
  category_id: z.string().uuid({ message: 'Please select a valid category.' }),
  amount: z
    .number({ invalid_type_error: 'Amount must be a number.' })
    .positive({ message: 'Amount must be greater than 0.' })
    .max(1_000_000, { message: 'Amount cannot exceed 1,000,000.' }),
  description: z
    .string({ required_error: 'Description is required.' })
    .min(1, { message: 'Description is required.' })
    .max(255, { message: 'Description cannot exceed 255 characters.' })
    .trim(),
  notes: z
    .string()
    .max(1000, { message: 'Notes cannot exceed 1,000 characters.' })
    .trim()
    .nullable()
    .optional(),
  date: z
    .string({ required_error: 'Date is required.' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format.' }),
  is_recurring: z.boolean().optional().default(false),
})

export const UpdateExpenseSchema = CreateExpenseSchema.partial()

export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseSchema>
