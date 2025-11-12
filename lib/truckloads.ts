export function isValidDimension(x: unknown): boolean {
  const n = Number(x)
  return Number.isFinite(n) && n > 0 && n < 100000
}

