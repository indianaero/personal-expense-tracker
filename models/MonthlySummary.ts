import mongoose, { Schema, Model } from 'mongoose'
import type { IMonthlySummary } from '@/types/models'

const CategoryBreakdownSchema = new Schema(
  {
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    count: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
)

const MonthlySummarySchema = new Schema<IMonthlySummary>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    totalSpent: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    expenseCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    categoryBreakdown: {
      type: [CategoryBreakdownSchema],
      default: [],
    },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
)

MonthlySummarySchema.index({ userId: 1, year: 1, month: 1 }, { unique: true })

const MonthlySummary: Model<IMonthlySummary> =
  mongoose.models.MonthlySummary ??
  mongoose.model<IMonthlySummary>('MonthlySummary', MonthlySummarySchema)

export default MonthlySummary
