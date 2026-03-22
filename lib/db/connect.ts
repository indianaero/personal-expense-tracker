import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined in environment variables')
}

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  // eslint-disable-next-line no-var
  var __mongoose: MongooseCache | undefined
}

const cache: MongooseCache = global.__mongoose ?? { conn: null, promise: null }
global.__mongoose = cache

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) {
    return cache.conn
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI!, {
      bufferCommands: false,
    })
  }

  cache.conn = await cache.promise
  return cache.conn
}
