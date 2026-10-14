import { useId } from 'react'

/** App mark: descending trend arrow on an emerald tile (same art as the PWA icons). */
export function Logo({ className = 'size-16', title }: { className?: string; title?: string }) {
  const gradientId = useId()
  return (
    <svg viewBox="0 0 512 512" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#10b981" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill={`url(#${gradientId})`} />
      <path d="M128 168 212 252 284 212 372 312" fill="none" stroke="#fff" strokeWidth="40" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M308 312h64v-64" fill="none" stroke="#fff" strokeWidth="40" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="120" y="364" width="272" height="28" rx="14" fill="#fff" fillOpacity="0.35" />
    </svg>
  )
}
