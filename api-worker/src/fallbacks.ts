import type {
  FoodParseItem,
  FoodParseOutput,
  PlanAIOutput,
  PlanGenerateRequest,
  WeeklyReviewAIOutput,
  WeeklyReviewRequest,
} from './contracts'

const AI_UNAVAILABLE_MESSAGE = '「AI 暫時無法連線，已保留本地安全計畫」'

export const buildPlanFallback = (request: PlanGenerateRequest): PlanAIOutput => ({
  schemaVersion: 1,
  status: request.safety.status === 'needs_confirmation' ? 'needs_more_data' : 'ok',
  selectedTargets: { ...request.localRecommendation.selectedTargets },
  energyPlan: { ...request.localRecommendation.energyPlan },
  focusTasks: [...request.localRecommendation.focusTasks].slice(0, 4),
  comment: {
    title: '已保留本地安全計畫',
    summary: AI_UNAVAILABLE_MESSAGE,
    bullets: ['仍以安全邊界內的本地數值為準', '稍後可再嘗試 AI 分析'],
    tone: 'neutral',
  },
  assumptions: [{ code: 'local_fallback', text: '使用者裝置已產生並驗證的本地計畫。' }],
  warnings: [{ code: 'ai_unavailable', text: AI_UNAVAILABLE_MESSAGE }],
})

export const buildWeeklyFallback = (request: WeeklyReviewRequest): WeeklyReviewAIOutput => {
  const painLevel = Math.max(request.safety.painLevel ?? 0, request.summary.painMax ?? 0)
  const incomplete = request.dataCompleteness < 0.6
  const needsConfirmation = request.safety.status === 'needs_confirmation'
  const decision = incomplete || needsConfirmation ? 'improve_data_first' : painLevel >= 3 ? 'recovery_priority' : 'maintain'
  const title = needsConfirmation
    ? '先完成安全確認再調整'
    : incomplete
      ? '先補足紀錄再調整'
    : painLevel >= 3
      ? '本週先把恢復擺在前面'
      : '本週先維持現有計畫'
  return {
    schemaVersion: 1,
    decision,
    calorieAdjustmentKcal: 0,
    activityAdjustment: { aerobicMinutesDelta: 0, strengthDaysDelta: 0 },
    focusTasks: needsConfirmation
      ? ['先確認目前的安全狀態', '在確認前維持現有目標']
      : incomplete
        ? ['補足體重與飲食紀錄', '維持目前安全目標']
      : painLevel >= 3
        ? ['疼痛時不補跑', '優先休息或低衝擊活動']
        : ['維持飲食紀錄', '持續觀察一週趨勢'],
    comment: {
      title,
      summary: AI_UNAVAILABLE_MESSAGE,
      bullets: ['本次沒有自動變更熱量或活動目標', '所有調整仍需你確認後才儲存'],
      tone: painLevel >= 3 ? 'caution' : 'neutral',
    },
    warnings: [AI_UNAVAILABLE_MESSAGE],
  }
}

const TOKEN_PATTERN = /^(.*?)(\d+(?:\.\d+)?)\s*(g|ml|份|顆)?$/i

export const buildFoodParseFallback = (text: string): FoodParseOutput => {
  const tokens = text
    .trim()
    .split(/[\n,，、;；]+|\s+(?=[^\d\s])/u)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 20)

  const items = tokens.map((rawText) => {
    const match = rawText.match(TOKEN_PATTERN)
    const normalizedName = (match?.[1] || rawText).trim() || rawText
    const parsedUnit = match?.[3]?.toLowerCase()
    const unit: FoodParseItem['unit'] = parsedUnit === 'g' || parsedUnit === 'ml' || parsedUnit === '份' || parsedUnit === '顆'
      ? parsedUnit
      : null
    return {
      rawText,
      normalizedName,
      amount: match?.[2] ? Number(match[2]) : null,
      unit,
      preparation: null,
      weightState: 'unknown' as const,
      brand: null,
      searchTerms: [normalizedName],
      needsConfirmation: true,
      confirmationQuestion: unit === 'g' ? '請確認這是生重還是熟重。' : '請確認食物與份量。',
    }
  })

  return { schemaVersion: 1, items, unparsedText: [] }
}

export { AI_UNAVAILABLE_MESSAGE }
