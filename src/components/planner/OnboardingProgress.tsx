export function OnboardingProgress({ step, labels }: { step: number; labels: string[] }) {
  return <div className="planner-progress" aria-label={`建立計畫，第 ${step} 步，共 ${labels.length} 步`}>
    <div className="planner-progress__track"><i style={{ width: `${step / labels.length * 100}%` }} /></div>
    <ol>{labels.map((label, index) => <li className={index + 1 <= step ? 'active' : ''} key={label}><span>{index + 1}</span>{label}</li>)}</ol>
  </div>
}
