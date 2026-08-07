import { Info, ShieldCheck } from 'lucide-react'
import type { AIComment } from '../../planner/types'

export function AICommentCard({ comment, source = '本地規則提醒' }: { comment: AIComment; source?: '本地規則提醒' | 'AI 每週建議' }) {
  const Icon = source === '本地規則提醒' ? ShieldCheck : Info
  return <article className={`ai-comment-card health-card tone-${comment.tone}`}><header><Icon aria-hidden="true" /><span>{source}</span></header><strong>{comment.title}</strong><p>{comment.summary}</p>{comment.bullets.length > 0 && <ul>{comment.bullets.slice(0, 4).map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}</article>
}
