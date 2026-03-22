import type { Types } from 'mongoose'

export interface IUser {
  _id: Types.ObjectId
  email: string
  name: string
  passwordHash: string | null
  provider: 'credentials' | 'google'
  currency: string
  createdAt: Date
  updatedAt: Date
}

export interface ICategory {
  _id: Types.ObjectId
  userId: Types.ObjectId | null
  name: string
  isDefault: boolean
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
}

export interface IExpense {
  _id: Types.ObjectId
  userId: Types.ObjectId
  categoryId: Types.ObjectId
  amount: number
  description: string
  notes?: string
  date: Date
  isRecurring: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ICategoryBreakdown {
  categoryId: Types.ObjectId
  total: number
  count: number
}

export interface IMonthlySummary {
  _id: Types.ObjectId
  userId: Types.ObjectId
  year: number
  month: number
  totalSpent: number
  expenseCount: number
  categoryBreakdown: ICategoryBreakdown[]
  updatedAt: Date
}
