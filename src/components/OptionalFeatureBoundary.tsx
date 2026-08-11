import { Component, type ErrorInfo, type ReactNode } from 'react'

interface OptionalFeatureBoundaryProps {
  children: ReactNode
  fallback: ReactNode
  resetKey: unknown
}

interface OptionalFeatureBoundaryState {
  hasError: boolean
}

/** Isolates an optional tab so a render failure cannot replace the core app. */
export class OptionalFeatureBoundary extends Component<OptionalFeatureBoundaryProps, OptionalFeatureBoundaryState> {
  state: OptionalFeatureBoundaryState = { hasError: false }

  static getDerivedStateFromError(): OptionalFeatureBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('Optional feature render failed', error, info)
  }

  componentDidUpdate(previousProps: OptionalFeatureBoundaryProps) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}
