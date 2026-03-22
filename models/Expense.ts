import mongoose, { Schema, Model } from 'mongoose'
import type { IExpense } from '@/types/models'

const ExpenseSchema = new Schema<IExpense>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
    },
    isRecurring: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  { timestamps: true }
)

ExpenseSchema.index({ userId: 1, date: -1 })
ExpenseSchema.index({ userId: 1, categoryId: 1 })
ExpenseSchema.index({ userId: 1, date: -1, categoryId: 1 })

const Expense: Model<IExpense> =
  mongoose.models.Expense ?? mongoose.model<IExpense>('Expense', ExpenseSchema)

export default Expense
