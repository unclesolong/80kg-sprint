import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react'
import { useGrowthMotionEnvironment } from './growthArtworkMotion'
import type { GrowthNode } from './types'
import './growthCompanionSpeech.css'

export interface GrowthCompanionReaction {
  id: string
  utterance: string
  accessibleLabel: string
  mood: 'affectionate' | 'cheerful' | 'delighted' | 'excited' | 'curious' |
    'serene' | 'shy' | 'loving' | 'encouraging' | 'sleepy'
}

export interface GrowthCompanionSpeechProps {
  node: GrowthNode
  companionLabel: string
  paused?: boolean
  children: ReactNode
}

export interface GrowthCompanionHitbox {
  leftPercent: number
  topPercent: number
  widthPercent: number
  heightPercent: number
}

type HitboxStyle = CSSProperties & Record<
  '--growth-speech-left' | '--growth-speech-top' | '--growth-speech-width' | '--growth-speech-height',
  string
>

interface ActiveReaction {
  reactionIndex: number
  serial: number
}

export const GROWTH_COMPANION_SPEECH_VISIBLE_MS = 5_000
export const GROWTH_COMPANION_SPEECH_COOLDOWN_MS = 700

export const GROWTH_COMPANION_REACTIONS: readonly GrowthCompanionReaction[] = [
  {
    id: 'touch_affection',
    utterance: 'vlu·qii~ 💛',
    accessibleLabel: '潤光感到親近，正開心地向你撒嬌。',
    mood: 'affectionate'
  },
  {
    id: 'touch_greeting',
    utterance: 'pwo! nli·vaa 😊',
    accessibleLabel: '潤光很開心，也向你打招呼。',
    mood: 'cheerful'
  },
  {
    id: 'touch_sparkle',
    utterance: 'xii·qlo… ✨',
    accessibleLabel: '潤光因你的觸碰而閃亮起來。',
    mood: 'delighted'
  },
  {
    id: 'touch_bounce',
    utterance: 'mvu~ tli·tli! 💫',
    accessibleLabel: '潤光興奮地彈跳了一下。',
    mood: 'excited'
  },
  {
    id: 'touch_curious',
    utterance: 'qoa? vli! 🫧',
    accessibleLabel: '潤光好奇地靠近，想再感受一次。',
    mood: 'curious'
  },
  {
    id: 'touch_humming',
    utterance: 'nvu·xai~ ♪ 🌙',
    accessibleLabel: '潤光感到安心，輕輕哼唱著。',
    mood: 'serene'
  },
  {
    id: 'touch_shy',
    utterance: 'tlo?! qii… 😳',
    accessibleLabel: '潤光有點害羞，但沒有躲開。',
    mood: 'shy'
  },
  {
    id: 'touch_love',
    utterance: 'vii·pwa~ 💖',
    accessibleLabel: '潤光很喜歡這次互動。',
    mood: 'loving'
  },
  {
    id: 'touch_cheer',
    utterance: 'qru! xii·vaa! 🌟',
    accessibleLabel: '潤光充滿精神，正在為你打氣。',
    mood: 'encouraging'
  },
  {
    id: 'touch_sleepy',
    utterance: 'mlo… vuu… 😴',
    accessibleLabel: '潤光很放鬆，舒服地打了個小呵欠。',
    mood: 'sleepy'
  }
]

const REACTION_ORDER = [0, 3, 6, 9, 2, 5, 8, 1, 4, 7] as const

export const getGrowthCompanionReactionSequence = (): readonly GrowthCompanionReaction[] =>
  REACTION_ORDER.map((reactionIndex) => GROWTH_COMPANION_REACTIONS[reactionIndex])

/**
 * The target follows the authored silhouette rather than turning the habitat
 * into one large button. Every profile remains comfortably above 44×44 px on
 * the narrowest supported phone layout.
 */
export const GROWTH_COMPANION_HITBOXES: Readonly<Record<GrowthNode, GrowthCompanionHitbox>> = {
  1: { leftPercent: 31, topPercent: 6, widthPercent: 38, heightPercent: 86 },
  2: { leftPercent: 30, topPercent: 6, widthPercent: 40, heightPercent: 86 },
  3: { leftPercent: 34, topPercent: 17, widthPercent: 32, heightPercent: 75 },
  4: { leftPercent: 22, topPercent: 10, widthPercent: 56, heightPercent: 82 },
  5: { leftPercent: 22, topPercent: 8, widthPercent: 56, heightPercent: 84 },
  6: { leftPercent: 20, topPercent: 7, widthPercent: 60, heightPercent: 85 },
  7: { leftPercent: 16, topPercent: 6, widthPercent: 68, heightPercent: 87 },
  8: { leftPercent: 14, topPercent: 6, widthPercent: 72, heightPercent: 88 },
  9: { leftPercent: 13, topPercent: 5, widthPercent: 74, heightPercent: 89 },
  10: { leftPercent: 10, topPercent: 4, widthPercent: 80, heightPercent: 91 },
  11: { leftPercent: 8, topPercent: 4, widthPercent: 84, heightPercent: 92 },
  12: { leftPercent: 7, topPercent: 3, widthPercent: 86, heightPercent: 93 }
}

export function GrowthCompanionSpeech({
  node,
  companionLabel,
  paused = false,
  children
}: GrowthCompanionSpeechProps) {
  const descriptionId = useId()
  const trayId = useId()
  const surfaceRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef(0)
  const serialRef = useRef(0)
  const cooldownUntilRef = useRef(0)
  const [active, setActive] = useState<ActiveReaction>()
  const [inViewport, setInViewport] = useState(true)
  const environment = useGrowthMotionEnvironment(paused)
  const interactionUnavailable = paused || environment.documentHidden || !inViewport
  const hitbox = GROWTH_COMPANION_HITBOXES[node]
  const hitboxStyle: HitboxStyle = {
    '--growth-speech-left': `${hitbox.leftPercent}%`,
    '--growth-speech-top': `${hitbox.topPercent}%`,
    '--growth-speech-width': `${hitbox.widthPercent}%`,
    '--growth-speech-height': `${hitbox.heightPercent}%`
  }
  const reaction = active ? GROWTH_COMPANION_REACTIONS[active.reactionIndex] : undefined
  const accessibleReactionLabel = reaction
    ? reaction.accessibleLabel.replace(/^潤光/, companionLabel)
    : ''

  useEffect(() => {
    if (typeof IntersectionObserver !== 'function' || !surfaceRef.current) return
    const observer = new IntersectionObserver(([entry]) => setInViewport(entry.isIntersecting), {
      rootMargin: '0px',
      threshold: 0.05
    })
    observer.observe(surfaceRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    cursorRef.current = 0
    cooldownUntilRef.current = 0
    setActive(undefined)
  }, [node])

  useEffect(() => {
    if (interactionUnavailable) setActive(undefined)
  }, [interactionUnavailable])

  useEffect(() => {
    if (!active) return
    const timeout = window.setTimeout(() => setActive(undefined), GROWTH_COMPANION_SPEECH_VISIBLE_MS)
    return () => window.clearTimeout(timeout)
  }, [active])

  const respond = () => {
    if (interactionUnavailable) return
    const now = Date.now()
    if (now < cooldownUntilRef.current) return
    cooldownUntilRef.current = now + GROWTH_COMPANION_SPEECH_COOLDOWN_MS
    const reactionIndex = REACTION_ORDER[cursorRef.current]
    cursorRef.current = (cursorRef.current + 1) % REACTION_ORDER.length
    serialRef.current += 1
    setActive({ reactionIndex, serial: serialRef.current })
  }

  return <div
    ref={surfaceRef}
    className="growth-companion-interaction"
    data-growth-companion-node={node}
    data-growth-speech-motion={environment.reducedMotion ? 'reduced' : 'full'}
  >
    <div className="growth-companion-interaction__stage">
      {children}
      <button
        className="growth-companion-speech__trigger"
        type="button"
        aria-label={`和${companionLabel}互動`}
        aria-describedby={descriptionId}
        aria-controls={trayId}
        disabled={interactionUnavailable}
        style={hitboxStyle}
        onClick={respond}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return
          setActive(undefined)
        }}
      />
    </div>

    <div className="growth-companion-speech__tray" id={trayId}>
      {reaction
        ? <span
            className="growth-companion-speech__bubble"
            aria-hidden="true"
            data-growth-speech-reaction={reaction.id}
            data-growth-speech-mood={reaction.mood}
            key={`${reaction.id}:${active?.serial ?? 0}`}
          >{reaction.utterance}</span>
        : <span className="growth-companion-speech__hint" aria-hidden="true">
            輕觸{companionLabel}，它會回應你
          </span>}
    </div>

    <span className="sr-only" id={descriptionId}>輕觸{companionLabel}，看看它的神秘語回應。</span>
    <p
      className="sr-only growth-companion-speech__status"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >{accessibleReactionLabel}</p>
  </div>
}
