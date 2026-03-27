export const CATEGORY_PALETTE = [
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#10b981', // emerald
  '#f43f5e', // rose
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#f97316', // orange
  '#84cc16', // lime
  '#ec4899', // pink
]

export function paletteColor(index: number): string {
  return CATEGORY_PALETTE[index % CATEGORY_PALETTE.length]
}
