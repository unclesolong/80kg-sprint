const integer = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 })

const finiteNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

export const formatChartValue = (key: string, value: unknown): string | undefined => {
  if (key === 'targetRange') {
    if (!Array.isArray(value) || value.length !== 2) return undefined
    const lower = finiteNumber(value[0])
    const upper = finiteNumber(value[1])
    return lower == null || upper == null ? undefined : `${lower.toFixed(1)}–${upper.toFixed(1)} kg`
  }
  const number = finiteNumber(value)
  if (number == null) return undefined
  if (['morning', 'other', 'ma3', 'ma7', 'target'].includes(key)) return `${number.toFixed(1)} kg`
  if (['intake', 'tdee', 'deficit', 'active'].includes(key)) return `${integer.format(Math.round(number))} kcal`
  if (key === 'exercise') return `${integer.format(Math.round(number))} 分鐘`
  if (key === 'steps') return `${integer.format(Math.round(number))} 步`
  if (key === 'sleep') return `${number.toFixed(1)} 小時`
  if (['fatigue', 'hunger', 'leg'].includes(key)) return `${Math.round(number)}/5`
  return Number(number.toFixed(2)).toLocaleString('zh-TW', { maximumFractionDigits: 2 })
}

export const formatChartDate = (value: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match ? `${Number(match[2])}月${Number(match[3])}日` : value
}
