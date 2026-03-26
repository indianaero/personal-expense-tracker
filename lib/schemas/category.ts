import { z } from 'zod'

export const CreateCategorySchema = z.object({
  name: z
    .string({ required_error: 'Category name is required.' })
    .min(1, { message: 'Category name is required.' })
    .max(50, { message: 'Category name cannot exceed 50 characters.' })
    .trim(),
  is_default: z.boolean().optional().default(false),
})

export const UpdateCategorySchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Category name is required.' })
    .max(50, { message: 'Category name cannot exceed 50 characters.' })
    .trim()
    .optional(),
  is_archived: z.boolean().optional(),
})

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>
