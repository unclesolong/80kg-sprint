export interface AppMarkProps {
  size?: number
  label?: string
  decorative?: boolean
}

/** Neutral journal mark: three observations connected by a downward trend. */
export function AppMark({ size = 64, label = '減脂追蹤', decorative = false }: AppMarkProps) {
  const accessibility = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'img', 'aria-label': label }

  return <svg
    className="app-mark"
    viewBox="0 0 64 64"
    width={size}
    height={size}
    focusable="false"
    {...accessibility}
  >
    <rect className="app-mark__background" width="64" height="64" rx="17" fill="#0a0d0c" />
    <path className="app-mark__trend" d="M14 18 C22 18 23 29 32 30 C39 31 42 42 50 43" fill="none" stroke="#65d38e" strokeWidth="5" strokeLinecap="round" />
    <circle className="app-mark__node" cx="14" cy="18" r="4" fill="#65d38e" />
    <circle className="app-mark__node" cx="32" cy="30" r="4" fill="#65d38e" />
    <circle className="app-mark__node app-mark__node--confirmed" cx="50" cy="43" r="7" fill="#0a0d0c" stroke="#65d38e" strokeWidth="4" />
    <path className="app-mark__check" d="m47 43 2 2 4-5" fill="none" stroke="#65d38e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}
