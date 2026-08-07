import type { SafetyScreen } from '../../planner/types'

export type SafetyQuestionKey = Exclude<keyof SafetyScreen, 'id' | 'answeredAt'>

export const safetyQuestions: Array<{ key: SafetyQuestionKey; label: string; note?: string }> = [
  { key: 'under18', label: '未滿 18 歲' },
  { key: 'pregnantOrBreastfeeding', label: '懷孕或哺乳' },
  { key: 'eatingDisorderHistory', label: '目前或過去有飲食失調' },
  { key: 'diabetesOrGlucoseMedication', label: '糖尿病或血糖相關用藥' },
  { key: 'kidneyDisease', label: '腎臟疾病' },
  { key: 'seriousCardiovascularDisease', label: '嚴重心血管疾病' },
  { key: 'weightLossMedication', label: '正在使用減重藥物' },
  { key: 'currentInjuryOrPain', label: '目前有傷勢或疼痛' },
  { key: 'faintingChestPainOrSevereDizziness', label: '近期胸痛、昏厥或嚴重頭暈' },
  { key: 'purgingLaxativesDiureticsOrForcedExercise', label: '催吐、瀉藥、利尿或強迫運動行為' }
]

export function SafetyStep({ screen, answered, onAnswer }: { screen: SafetyScreen; answered: Set<SafetyQuestionKey>; onAnswer: (key: SafetyQuestionKey, value: boolean) => void }) {
  return <div className="safety-question-list">{safetyQuestions.map((question) => <div className="safety-question" key={question.key}><div><strong>{question.label}</strong>{question.note && <small>{question.note}</small>}</div><div className="segmented" aria-label={question.label}><button type="button" className={answered.has(question.key) && !screen[question.key] ? 'selected' : ''} aria-pressed={answered.has(question.key) && !screen[question.key]} onClick={() => onAnswer(question.key, false)}>否</button><button type="button" className={answered.has(question.key) && screen[question.key] ? 'selected caution' : ''} aria-pressed={answered.has(question.key) && screen[question.key]} onClick={() => onAnswer(question.key, true)}>是</button></div></div>)}</div>
}
