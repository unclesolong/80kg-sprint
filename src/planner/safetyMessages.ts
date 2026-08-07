export const SELF_SERVE_BLOCKED_MESSAGE = '這個狀況不適合由一般自助減脂功能產生熱量赤字。你仍可使用紀錄功能，減脂設定建議先與醫療專業人員確認。'

export const safetyReasonMessages: Record<string, string> = {
  under_18: '未滿 18 歲不使用一般成人自助減脂計畫。',
  pregnant_or_breastfeeding: '懷孕或哺乳期間的營養與體重目標需由專業人員評估。',
  eating_disorder_history: '飲食失調相關狀況需要專業支持，不由自助功能建立熱量赤字。',
  acute_symptoms: '胸痛、昏厥或嚴重頭暈需先由醫療專業人員評估。',
  compensatory_behaviour: '催吐、瀉藥、利尿或強迫運動不屬於安全的減脂方法。',
  goal_bmi_low: '目標體重會低於健康 BMI 保護線。',
  currently_underweight: '目前體重已在過輕範圍，不建立減重計畫。',
  high_risk_condition: '疾病或用藥狀況需要專業評估後再設定減脂目標。',
  current_injury: '目前有疼痛或傷勢，活動建議不會提高跑步量。'
}
