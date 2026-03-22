import mongoose, { Schema, Model } from 'mongoose'
import type { ICategory } from '@/types/models'

const CategorySchema = new Schema<ICategory>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    isDefault: {
      type: Boolean,
      required: true,
      default: false,
    },
    isArchived: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  { timestamps: true }
)

CategorySchema.index({ isDefault: 1 })
CategorySchema.index({ userId: 1, name: 1 }, { unique: true, sparse: true })

const Category: Model<ICategory> =
  mongoose.models.Category ?? mongoose.model<ICategory>('Category', CategorySchema)

export default Category
