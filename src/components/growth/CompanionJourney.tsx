import { CircleHelp } from 'lucide-react'
import { useLayoutEffect, useMemo, useReducer } from 'react'
import { GrowthArtworkStack } from './GrowthArtworkStack'
import { GrowthCompanionSpeech } from './GrowthCompanionSpeech'
import { GrowthStageAnimation } from './GrowthStageAnimation'
import type { GrowthArtworkMotion } from './growthArtworkMotion'
import {
  GROWTH_NODE_DEFINITIONS,
  type GrowthArtworkLayer,
  type GrowthMainForm,
  type GrowthCompanionView
} from './types'

export interface CompanionJourneyProps {
  companion: GrowthCompanionView
  fallbackArtworkUrl: string
  animationAtlasUrl?: string
  /** Approved first-frame still that matches the animation's embedded habitat. */
  animationPosterUrl?: string
  onOpenXpHistory?: () => void
  /** Pauses artwork and clears speech while a modal Growth sheet is open. */
  paused?: boolean
}

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value))

interface CompanionVisualSnapshot {
  key: string
  node: GrowthCompanionView['growthNode']
  layers: readonly GrowthArtworkLayer[]
  mainForm: GrowthMainForm
  animationAtlasUrl?: string
  animationPosterUrl?: string
}

interface CompanionMotionState {
  current: CompanionVisualSnapshot
  previous?: CompanionVisualSnapshot
  motion: GrowthArtworkMotion
  motionEventId: string
  revision: number
  failedVisualKey?: string
  xp: number
}

type CompanionMotionAction =
  | { type: 'sync'; visual: CompanionVisualSnapshot; xp: number }
  | { type: 'complete'; eventId: string; result?: 'completed' | 'failed' }

const companionMotionReducer = (
  state: CompanionMotionState,
  action: CompanionMotionAction
): CompanionMotionState => {
  if (action.type === 'complete') {
    if (action.eventId !== state.motionEventId) return state
    if (action.result === 'failed') {
      return {
        ...state,
        current: state.previous ?? state.current,
        previous: undefined,
        motion: 'idle',
        failedVisualKey: state.current.key
      }
    }
    return { ...state, previous: undefined, motion: 'idle', failedVisualKey: undefined }
  }

  if (action.visual.key === state.failedVisualKey && action.visual.key !== state.current.key) {
    if (action.xp > state.xp && state.motion === 'idle') {
      const revision = state.revision + 1
      return {
        ...state,
        motion: 'xp_pulse',
        motionEventId: `xp:${state.xp}->${action.xp}:${state.current.key}:r${revision}`,
        revision,
        xp: action.xp
      }
    }
    return action.xp === state.xp ? state : { ...state, xp: action.xp }
  }

  if (action.visual.key !== state.current.key) {
    const motion: GrowthArtworkMotion = state.current.mainForm === action.visual.mainForm
      ? 'level_transition'
      : 'form_metamorphosis'
    const revision = state.revision + 1
    return {
      current: action.visual,
      previous: state.current,
      motion,
      motionEventId: `${motion}:${state.current.key}->${action.visual.key}:r${revision}`,
      revision,
      failedVisualKey: undefined,
      xp: action.xp
    }
  }

  const clearedState = state.failedVisualKey ? { ...state, failedVisualKey: undefined } : state
  if (action.xp > clearedState.xp && clearedState.motion === 'idle') {
    const revision = state.revision + 1
    return {
      ...clearedState,
      motion: 'xp_pulse',
      motionEventId: `xp:${clearedState.xp}->${action.xp}:${clearedState.current.key}:r${revision}`,
      revision,
      xp: action.xp
    }
  }

  return action.xp === clearedState.xp ? clearedState : { ...clearedState, xp: action.xp }
}

export function CompanionJourney({
  companion,
  fallbackArtworkUrl,
  animationAtlasUrl,
  animationPosterUrl,
  onOpenXpHistory,
  paused = false
}: CompanionJourneyProps) {
  const current = GROWTH_NODE_DEFINITIONS[companion.growthNode - 1]
  const next = GROWTH_NODE_DEFINITIONS[companion.growthNode]
  const companionName = companion.displayName?.trim() || '潤光'
  const progressMaximum = next ? next.minimumXp - current.minimumXp : 1
  const progressValue = next ? clamp(companion.xp - current.minimumXp, 0, progressMaximum) : 1
  const progressText = next
    ? `${companion.xp} XP，距離 ${next.name} 還有 ${Math.max(0, next.minimumXp - companion.xp)} XP`
    : `${companion.xp} XP，已達完全共鳴`
  const providedLayers = companion.artworkLayers?.filter((layer) => layer.url.trim()) ?? []
  const artworkLayers: readonly GrowthArtworkLayer[] = providedLayers.length > 0
    ? providedLayers
    : [{
        id: 'luminous-companion-fallback',
        url: companion.artworkUrl?.trim() || fallbackArtworkUrl,
        slot: 'body',
        loading: 'eager'
      }]
  const artworkLabel = companion.artworkLabel?.trim() || `${companionName}目前型態：${current.name}`
  const artworkSignature = artworkLayers
    .map((layer) => `${layer.id}:${layer.slot}:${layer.url}`)
    .join('|')
  const visualSnapshot = useMemo<CompanionVisualSnapshot>(() => ({
    key: `node-${current.node}:${artworkSignature}:${animationAtlasUrl ?? 'poster'}:${animationPosterUrl ?? 'studio'}`,
    node: current.node,
    layers: artworkLayers,
    mainForm: current.mainForm,
    animationAtlasUrl,
    animationPosterUrl
  // artworkSignature captures the complete frozen layer snapshot.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [animationAtlasUrl, animationPosterUrl, artworkSignature, current.mainForm, current.node])
  const [motionState, dispatchMotion] = useReducer(companionMotionReducer, {
    current: visualSnapshot,
    motion: 'idle',
    motionEventId: `idle:${visualSnapshot.key}`,
    revision: 0,
    xp: companion.xp
  })

  useLayoutEffect(() => {
    dispatchMotion({ type: 'sync', visual: visualSnapshot, xp: companion.xp })
  }, [companion.xp, visualSnapshot])

  return <section className="growth-companion standard-card" aria-labelledby="growth-companion-title">
    <header className="growth-companion__header">
      <div>
        <p className="eyebrow">目前潤光</p>
        <h2 id="growth-companion-title">{companionName}</h2>
        <p>Lv{current.node} · {current.name}</p>
      </div>
      {onOpenXpHistory
        ? <button
            className="growth-companion__xp growth-companion__xp-button growth-touch-target"
            type="button"
            aria-haspopup="dialog"
            onClick={onOpenXpHistory}
          >
            <span><strong>{companion.xp.toLocaleString('zh-TW')} XP</strong><small>查看來源</small></span>
            <CircleHelp aria-hidden="true" />
          </button>
        : <strong className="growth-companion__xp">{companion.xp.toLocaleString('zh-TW')} XP</strong>}
    </header>

    <GrowthCompanionSpeech node={motionState.current.node} companionLabel={companionName} paused={paused}>
      {motionState.motion === 'idle' && motionState.current.animationAtlasUrl && motionState.current.layers.length === 1
        ? <GrowthStageAnimation
            node={motionState.current.node}
            atlasUrl={motionState.current.animationAtlasUrl}
            posterUrl={motionState.current.animationPosterUrl ?? motionState.current.layers[0].url}
            label={artworkLabel}
            className="growth-companion__artwork"
            paused={paused}
          />
        : <GrowthArtworkStack
            layers={motionState.current.layers}
            previousLayers={motionState.previous?.layers}
            label={artworkLabel}
            className="growth-companion__artwork"
            motion={motionState.motion}
            motionEventId={motionState.motionEventId}
            motionPaused={paused}
            onMotionComplete={(_motion, eventId, result) => dispatchMotion({ type: 'complete', eventId, result })}
          />}
    </GrowthCompanionSpeech>

    <div className="growth-companion__progress">
      <div><strong>第 {current.node}／12 階</strong><span>{progressText}</span></div>
      <progress max={progressMaximum} value={progressValue} aria-label={progressText}>{progressValue} / {progressMaximum}</progress>
      <p className="growth-companion__stage-note">完成生活任務會獲得 XP；體重下降、少吃或超額運動不會額外加分。</p>
    </div>
  </section>
}
