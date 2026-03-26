export function currencyTickFormatter(value: number | string): string {
  const n = Number(value)
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'k'
  return '$' + n
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}
