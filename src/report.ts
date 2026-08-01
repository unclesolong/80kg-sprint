import { average, dailyDeficit, effectiveActiveKcal, finalizedCumulativeDeficit, localDateString } from './calculations'
import type { ChallengeSettings, DailyLog } from './types'

const REPORT_WIDTH = 1240
const REPORT_HEIGHT = 1754
const REPORT_FIELDS = ['weightKg', 'intakeKcal', 'proteinG', 'activeKcal', 'waterMl', 'sleepHours', 'steps'] as const

type ReportField = (typeof REPORT_FIELDS)[number]

export type ReportDelivery = 'shared' | 'downloaded' | 'cancelled'

export interface ReportDay {
  date: string
  log?: DailyLog
  completedFields: number
  completenessRate: number
}

export interface ReportSummary {
  startDate: string
  endDate: string
  generatedDate: string
  days: ReportDay[]
  recordedDays: number
  completeDays: number
  finalizedDays: number
  completenessRate: number
  firstWeightKg?: number
  latestWeightKg?: number
  weightChangeKg?: number
  averageIntakeKcal?: number
  averageProteinG?: number
  averageActiveKcal?: number
  averageWaterMl?: number
  averageSleepHours?: number
  averageSteps?: number
  averageFinalDeficitKcal?: number
  cumulativeFinalDeficitKcal: number
}

const minDate = (a: string, b: string) => (a < b ? a : b)

const enumerateDates = (startDate: string, endDate: string): string[] => {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number)
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number)
  const cursor = new Date(Date.UTC(startYear, startMonth - 1, startDay))
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay))
  const dates: string[] = []
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

const hasValue = (log: DailyLog | undefined, field: ReportField): boolean => {
  if (!log) return false
  if (field === 'activeKcal') return effectiveActiveKcal(log) != null
  const value = log[field]
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Builds a challenge-to-date summary. Future challenge days are intentionally
 * excluded so they do not lower today's data-completeness score.
 */
export const buildReportSummary = (
  settings: ChallengeSettings,
  logs: DailyLog[],
  asOfDate = localDateString()
): ReportSummary => {
  const endDate = minDate(settings.finalWeighInDate, asOfDate) < settings.startDate
    ? settings.startDate
    : minDate(settings.finalWeighInDate, asOfDate)
  const logsByDate = new Map(
    logs
      .filter((log) => log.date >= settings.startDate && log.date <= endDate)
      .map((log) => [log.date, log])
  )
  const days = enumerateDates(settings.startDate, endDate).map<ReportDay>((date) => {
    const log = logsByDate.get(date)
    const completedFields = REPORT_FIELDS.filter((field) => hasValue(log, field)).length
    return {
      date,
      log,
      completedFields,
      completenessRate: Math.round(completedFields / REPORT_FIELDS.length * 100)
    }
  })
  const periodLogs = days.flatMap((day) => day.log ? [day.log] : [])
  const weights = periodLogs
    .filter((log): log is DailyLog & { weightKg: number } => hasValue(log, 'weightKg'))
    .sort((a, b) => a.date.localeCompare(b.date))
  const firstWeightKg = weights[0]?.weightKg
  const latestWeightKg = weights.at(-1)?.weightKg
  const completedFields = days.reduce((sum, day) => sum + day.completedFields, 0)
  const totalFields = days.length * REPORT_FIELDS.length
  const finalizedLogs = periodLogs.filter((log) => log.dayFinalized)

  return {
    startDate: settings.startDate,
    endDate,
    generatedDate: asOfDate,
    days,
    recordedDays: days.filter((day) => day.log != null).length,
    completeDays: days.filter((day) => day.completedFields === REPORT_FIELDS.length).length,
    finalizedDays: finalizedLogs.length,
    completenessRate: totalFields ? Math.round(completedFields / totalFields * 100) : 0,
    firstWeightKg,
    latestWeightKg,
    weightChangeKg: firstWeightKg != null && latestWeightKg != null ? latestWeightKg - firstWeightKg : undefined,
    averageIntakeKcal: average(periodLogs.map((log) => log.intakeKcal)),
    averageProteinG: average(periodLogs.map((log) => log.proteinG)),
    averageActiveKcal: average(periodLogs.map(effectiveActiveKcal)),
    averageWaterMl: average(periodLogs.map((log) => log.waterMl)),
    averageSleepHours: average(periodLogs.map((log) => log.sleepHours)),
    averageSteps: average(periodLogs.map((log) => log.steps)),
    averageFinalDeficitKcal: average(finalizedLogs.map(dailyDeficit)),
    cumulativeFinalDeficitKcal: finalizedCumulativeDeficit(periodLogs, settings)
  }
}

const colors = {
  paper: '#f5f6f1',
  panel: '#ffffff',
  ink: '#18231e',
  muted: '#66736d',
  faint: '#dfe5df',
  forest: '#183c30',
  green: '#47c486',
  paleGreen: '#dff4e8',
  amber: '#d88b2b',
  paleAmber: '#fff0d8',
  white: '#ffffff'
} as const

const fontStack = 'system-ui, -apple-system, BlinkMacSystemFont, "PingFang TC", "Microsoft JhengHei", sans-serif'

const setFont = (ctx: CanvasRenderingContext2D, size: number, weight: 400 | 500 | 600 | 700 | 800 = 400) => {
  ctx.font = `${weight} ${size}px ${fontStack}`
}

const roundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

const fillRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string
) => {
  roundedRect(ctx, x, y, width, height, radius)
  ctx.fillStyle = fill
  ctx.fill()
}

const formatDate = (date: string) => {
  const [year, month, day] = date.split('-').map(Number)
  return `${year}/${month}/${day}`
}

const shortDate = (date: string) => {
  const [, month, day] = date.split('-').map(Number)
  return `${month}/${day}`
}

const rounded = (value: number | undefined, digits = 0): string => {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString('zh-TW', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}

const drawMetricCard = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  unit: string,
  target: string
) => {
  fillRoundedRect(ctx, x, y, width, 150, 24, colors.panel)
  ctx.fillStyle = colors.muted
  setFont(ctx, 22, 600)
  ctx.fillText(label, x + 28, y + 39)
  ctx.fillStyle = colors.ink
  setFont(ctx, value === '—' ? 42 : 38, 800)
  ctx.fillText(value, x + 28, y + 91)
  if (value !== '—') {
    const valueWidth = ctx.measureText(value).width
    ctx.fillStyle = colors.muted
    setFont(ctx, 18, 600)
    ctx.fillText(unit, x + 36 + valueWidth, y + 89)
  }
  ctx.fillStyle = colors.muted
  setFont(ctx, 17, 500)
  ctx.fillText(target, x + 28, y + 127)
}

const drawWeightProgress = (
  ctx: CanvasRenderingContext2D,
  settings: ChallengeSettings,
  latestWeightKg: number | undefined,
  x: number,
  y: number,
  width: number
) => {
  const totalChange = settings.targetWeightKg - settings.baselineWeightKg
  const currentChange = latestWeightKg == null ? 0 : latestWeightKg - settings.baselineWeightKg
  const progress = totalChange === 0 ? 1 : Math.max(0, Math.min(1, currentChange / totalChange))
  fillRoundedRect(ctx, x, y, width, 12, 6, 'rgba(255,255,255,0.18)')
  if (progress > 0) fillRoundedRect(ctx, x, y, Math.max(12, width * progress), 12, 6, colors.green)
  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  setFont(ctx, 17, 500)
  ctx.fillText(`${rounded(settings.baselineWeightKg, 1)} kg`, x, y + 38)
  ctx.textAlign = 'right'
  ctx.fillText(`目標 ${rounded(settings.targetWeightKg, 1)} kg`, x + width, y + 38)
  ctx.textAlign = 'left'
}

const fitText = (ctx: CanvasRenderingContext2D, value: string, maxWidth: number): string => {
  if (ctx.measureText(value).width <= maxWidth) return value
  let output = value
  while (output.length > 1 && ctx.measureText(`${output}…`).width > maxWidth) output = output.slice(0, -1)
  return `${output}…`
}

const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number => {
  let line = ''
  let cursorY = y
  for (const character of text) {
    const candidate = line + character
    if (line && ctx.measureText(candidate).width > maxWidth) {
      ctx.fillText(line, x, cursorY)
      line = character
      cursorY += lineHeight
    } else {
      line = candidate
    }
  }
  if (line) ctx.fillText(line, x, cursorY)
  return cursorY + lineHeight
}

const drawDailyTable = (
  ctx: CanvasRenderingContext2D,
  summary: ReportSummary,
  x: number,
  y: number,
  width: number
) => {
  const displayedDays = summary.days.slice(-8)
  const heading = summary.days.length > displayedDays.length
    ? `每日精簡紀錄（最近 ${displayedDays.length} 天）`
    : '每日精簡紀錄'
  ctx.fillStyle = colors.ink
  setFont(ctx, 27, 800)
  ctx.fillText(heading, x, y)
  ctx.fillStyle = colors.muted
  setFont(ctx, 17, 500)
  ctx.textAlign = 'right'
  ctx.fillText('綠點＝7 項齊全　橘點＝仍有缺漏', x + width, y)
  ctx.textAlign = 'left'

  const tableY = y + 27
  const headerHeight = 54
  const rowHeight = 73
  const columnWidths = [120, 120, 140, 125, 135, 140, 110, 122]
  const headers = ['日期', '體重 kg', '攝取 kcal', '蛋白 g', '活動 kcal', '水 ml', '睡眠 h', '步數']
  fillRoundedRect(ctx, x, tableY, width, headerHeight + rowHeight * displayedDays.length, 24, colors.panel)

  ctx.save()
  roundedRect(ctx, x, tableY, width, headerHeight + rowHeight * displayedDays.length, 24)
  ctx.clip()
  ctx.fillStyle = colors.forest
  ctx.fillRect(x, tableY, width, headerHeight)
  ctx.fillStyle = colors.white
  setFont(ctx, 17, 700)
  let cursorX = x
  headers.forEach((header, index) => {
    ctx.textAlign = index === 0 ? 'left' : 'right'
    const inset = index === 0 ? 26 : 18
    const textX = index === 0 ? cursorX + inset : cursorX + columnWidths[index] - inset
    ctx.fillText(header, textX, tableY + 35)
    cursorX += columnWidths[index]
  })

  displayedDays.forEach((day, index) => {
    const rowY = tableY + headerHeight + index * rowHeight
    if (index % 2 === 1) {
      ctx.fillStyle = '#f8faf7'
      ctx.fillRect(x, rowY, width, rowHeight)
    }
    if (index > 0) {
      ctx.strokeStyle = colors.faint
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x + 22, rowY)
      ctx.lineTo(x + width - 22, rowY)
      ctx.stroke()
    }
    const log = day.log
    const values = [
      shortDate(day.date),
      rounded(log?.weightKg, 1),
      rounded(log?.intakeKcal),
      rounded(log?.proteinG),
      rounded(log ? effectiveActiveKcal(log) : undefined),
      rounded(log?.waterMl),
      rounded(log?.sleepHours, 1),
      rounded(log?.steps)
    ]
    cursorX = x
    values.forEach((value, valueIndex) => {
      ctx.textAlign = valueIndex === 0 ? 'left' : 'right'
      ctx.fillStyle = value === '—' ? '#9aa49f' : colors.ink
      setFont(ctx, 19, valueIndex === 0 ? 700 : 600)
      const inset = valueIndex === 0 ? 50 : 18
      const textX = valueIndex === 0 ? cursorX + inset : cursorX + columnWidths[valueIndex] - inset
      ctx.fillText(fitText(ctx, value, columnWidths[valueIndex] - 32), textX, rowY + 44)
      cursorX += columnWidths[valueIndex]
    })
    ctx.fillStyle = day.completedFields === REPORT_FIELDS.length ? colors.green : colors.amber
    ctx.beginPath()
    ctx.arc(x + 27, rowY + 37, 8, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.restore()
  ctx.textAlign = 'left'

  return tableY + headerHeight + rowHeight * displayedDays.length
}

/** Creates the complete report as a high-resolution, A4-ratio Canvas. */
export const createReportCanvas = async (
  settings: ChallengeSettings,
  logs: DailyLog[],
  asOfDate = localDateString()
): Promise<HTMLCanvasElement> => {
  if (typeof document === 'undefined') throw new Error('報告只能在瀏覽器中產生')
  await document.fonts?.ready
  const summary = buildReportSummary(settings, logs, asOfDate)
  const canvas = document.createElement('canvas')
  canvas.width = REPORT_WIDTH
  canvas.height = REPORT_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('此瀏覽器無法建立報告畫布')

  ctx.fillStyle = colors.paper
  ctx.fillRect(0, 0, REPORT_WIDTH, REPORT_HEIGHT)

  const margin = 64
  const contentWidth = REPORT_WIDTH - margin * 2
  fillRoundedRect(ctx, margin, 48, contentWidth, 305, 36, colors.forest)

  fillRoundedRect(ctx, margin + 34, 80, 206, 42, 21, 'rgba(255,255,255,0.12)')
  ctx.fillStyle = colors.green
  ctx.beginPath()
  ctx.arc(margin + 57, 101, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = colors.white
  setFont(ctx, 18, 700)
  ctx.fillText('80KG SPRINT', margin + 77, 108)

  ctx.fillStyle = colors.white
  setFont(ctx, 48, 800)
  ctx.fillText('挑戰期分析報告', margin + 34, 184)
  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  setFont(ctx, 22, 500)
  ctx.fillText(`${formatDate(summary.startDate)} — ${formatDate(summary.endDate)}`, margin + 36, 224)
  ctx.fillText(`已記錄 ${summary.recordedDays}/${summary.days.length} 天 · 已結算 ${summary.finalizedDays} 天`, margin + 36, 260)

  const weightX = margin + 704
  fillRoundedRect(ctx, weightX, 78, 372, 235, 28, 'rgba(255,255,255,0.09)')
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  setFont(ctx, 19, 600)
  ctx.fillText('最近體重', weightX + 30, 119)
  ctx.fillStyle = colors.white
  setFont(ctx, 53, 800)
  const latestWeightText = rounded(summary.latestWeightKg, 1)
  ctx.fillText(latestWeightText, weightX + 30, 181)
  if (summary.latestWeightKg != null) {
    const textWidth = ctx.measureText(latestWeightText).width
    ctx.fillStyle = 'rgba(255,255,255,0.72)'
    setFont(ctx, 20, 600)
    ctx.fillText('kg', weightX + 42 + textWidth, 178)
  }
  const change = summary.weightChangeKg
  const changeLabel = change == null
    ? '需要至少 1 筆體重'
    : `期間變化 ${change > 0 ? '+' : ''}${rounded(change, 1)} kg`
  ctx.fillStyle = change != null && change <= 0 ? colors.green : 'rgba(255,255,255,0.72)'
  setFont(ctx, 18, 700)
  ctx.fillText(changeLabel, weightX + 30, 217)
  drawWeightProgress(ctx, settings, summary.latestWeightKg, weightX + 30, 247, 312)

  const metricGap = 18
  const metricWidth = (contentWidth - metricGap * 2) / 3
  const metrics = [
    ['平均攝取', rounded(summary.averageIntakeKcal), 'kcal', `目標 ${settings.intakeKcalMinimum}–${settings.intakeKcalMaximum}`],
    ['平均蛋白質', rounded(summary.averageProteinG), 'g', `目標 ${settings.proteinMinimumG}–${settings.proteinMaximumG}`],
    ['平均活動', rounded(summary.averageActiveKcal), 'kcal', `每日活動總值 · 目標 ${settings.activeKcalTarget}`],
    ['平均飲水', rounded(summary.averageWaterMl), 'ml', `目標 ${settings.waterMinimumMl}–${settings.waterMaximumMl}`],
    ['平均睡眠', rounded(summary.averageSleepHours, 1), '小時', `前一晚睡眠 · 目標 ≥ ${settings.sleepMinimumHours}`],
    ['平均步數', rounded(summary.averageSteps), '步', `目標 ${settings.stepsMinimum.toLocaleString('zh-TW')}–${settings.stepsMaximum.toLocaleString('zh-TW')}`]
  ] as const
  metrics.forEach((metric, index) => {
    const column = index % 3
    const row = Math.floor(index / 3)
    drawMetricCard(
      ctx,
      margin + column * (metricWidth + metricGap),
      383 + row * 168,
      metricWidth,
      metric[0], metric[1], metric[2], metric[3]
    )
  })

  const qualityY = 730
  fillRoundedRect(ctx, margin, qualityY, contentWidth, 82, 24, summary.completenessRate === 100 ? colors.paleGreen : colors.paleAmber)
  ctx.fillStyle = summary.completenessRate === 100 ? colors.forest : '#704818'
  setFont(ctx, 22, 800)
  ctx.fillText(`資料完整率 ${summary.completenessRate}%`, margin + 28, qualityY + 35)
  ctx.fillStyle = summary.completenessRate === 100 ? '#486458' : '#805d31'
  setFont(ctx, 17, 600)
  ctx.fillText('依體重、攝取、蛋白、活動、飲水、睡眠與步數 7 項計算；空白不當作 0。', margin + 28, qualityY + 63)
  const trackX = margin + 856
  fillRoundedRect(ctx, trackX, qualityY + 33, 220, 14, 7, 'rgba(24,60,48,0.12)')
  if (summary.completenessRate > 0) {
    fillRoundedRect(ctx, trackX, qualityY + 33, Math.max(14, 220 * summary.completenessRate / 100), 14, 7, summary.completenessRate === 100 ? colors.green : colors.amber)
  }

  const tableBottom = drawDailyTable(ctx, summary, margin, 856, contentWidth)
  const footerTop = Math.max(1520, tableBottom + 32)
  ctx.strokeStyle = colors.faint
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(margin, footerTop)
  ctx.lineTo(REPORT_WIDTH - margin, footerTop)
  ctx.stroke()

  ctx.fillStyle = colors.ink
  setFont(ctx, 18, 700)
  ctx.fillText('閱讀說明', margin, footerTop + 38)
  ctx.fillStyle = colors.muted
  setFont(ctx, 16, 500)
  let noteY = wrapText(ctx, `活動熱量使用每日摘要，加上僅標記為「尚未包含」的運動；已包含於 Watch 的明細不重複計算。`, margin, footerTop + 68, contentWidth, 25)
  noteY = wrapText(ctx, `赤字只統計已完成日結的 ${summary.finalizedDays} 天；平均 ${rounded(summary.averageFinalDeficitKcal)} kcal，累積 ${rounded(summary.cumulativeFinalDeficitKcal)} kcal。`, margin, noteY, contentWidth, 25)
  noteY = wrapText(ctx, '熱量、營養與體重變化依輸入資料與估算值整理，僅供自我追蹤，不是醫療診斷。', margin, noteY, contentWidth, 25)
  wrapText(ctx, '隱私：本報告完全在此裝置產生，不會自動上傳；分享後請只交給你信任的對象。', margin, noteY, contentWidth, 25)
  ctx.fillStyle = '#89938e'
  setFont(ctx, 14, 500)
  ctx.textAlign = 'right'
  ctx.fillText(`產生日期 ${formatDate(summary.generatedDate)} · 80KG Sprint`, REPORT_WIDTH - margin, REPORT_HEIGHT - 38)
  ctx.textAlign = 'left'

  return canvas
}

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('無法產生報告檔案')), type, quality)
  })

export const createReportPngBlob = async (
  settings: ChallengeSettings,
  logs: DailyLog[],
  asOfDate = localDateString()
): Promise<Blob> => canvasToBlob(await createReportCanvas(settings, logs, asOfDate), 'image/png')

export const createReportPdfBlob = async (
  settings: ChallengeSettings,
  logs: DailyLog[],
  asOfDate = localDateString()
): Promise<Blob> => {
  const canvas = await createReportCanvas(settings, logs, asOfDate)
  const image = canvas.toDataURL('image/jpeg', 0.94)
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  // Rasterizing the Canvas preserves Traditional Chinese without downloading or
  // embedding an external font. The Canvas already matches the A4 aspect ratio.
  pdf.addImage(image, 'JPEG', 0, 0, 210, 297, undefined, 'FAST')
  return pdf.output('blob')
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // A delayed revoke is important on iOS Safari, which may consume the Blob URL
  // only after the synthetic click has returned.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

const deliverFile = async (file: File, text: string): Promise<ReportDelivery> => {
  const canShareFiles = typeof navigator !== 'undefined'
    && typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [file] })

  if (canShareFiles) {
    try {
      await navigator.share({ title: '80KG Sprint 挑戰期分析', text, files: [file] })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      // Browser share targets occasionally reject a file type; downloading still
      // gives the user a local, recoverable copy.
    }
  }
  downloadBlob(file, file.name)
  return 'downloaded'
}

export const shareReportPng = async (
  settings: ChallengeSettings,
  logs: DailyLog[],
  asOfDate = localDateString()
): Promise<ReportDelivery> => {
  const blob = await createReportPngBlob(settings, logs, asOfDate)
  const file = new File([blob], `80kg-sprint-report-${settings.startDate}-${minDate(settings.finalWeighInDate, asOfDate)}.png`, { type: 'image/png' })
  return deliverFile(file, '這份圖卡含個人健康紀錄，請只分享給你信任的對象。')
}

export const shareReportPdf = async (
  settings: ChallengeSettings,
  logs: DailyLog[],
  asOfDate = localDateString()
): Promise<ReportDelivery> => {
  const blob = await createReportPdfBlob(settings, logs, asOfDate)
  const file = new File([blob], `80kg-sprint-report-${settings.startDate}-${minDate(settings.finalWeighInDate, asOfDate)}.pdf`, { type: 'application/pdf' })
  return deliverFile(file, '80KG Sprint 挑戰期分析 PDF；含個人健康紀錄。')
}
