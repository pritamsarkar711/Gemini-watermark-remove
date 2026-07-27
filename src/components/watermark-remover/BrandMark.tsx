import type { SVGProps } from 'react'

/**
 * BrandMark — the product logo for Gemini Watermark Remover.
 *
 * An image frame whose top-right corner is "opened up" by a sparkle, reading as
 * a photo that has just been cleaned. Drawn as a single-colour line mark on a
 * 24×24 grid with 1.9 stroke weight so it matches the Lucide icons used across
 * the UI and stays crisp down to 16px.
 *
 * Colour is inherited via `currentColor`, so the same component works on light
 * surfaces (primary text colour) and on the solid primary chip (white text).
 */
export default function BrandMark({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {/* Frame — open at the top-right so the sparkle can break out of it */}
      <path d="M20.7 11.9v4.6a3.2 3.2 0 0 1-3.2 3.2H6a3.2 3.2 0 0 1-3.2-3.2v-9A3.2 3.2 0 0 1 6 4.3h4.7" />
      {/* Horizon / mountain line */}
      <path d="M3.5 16.8 8.2 12.1l3.2 3" />
      {/* Sun */}
      <circle cx="8.3" cy="9.2" r="1.2" fill="currentColor" stroke="none" />
      {/* Sparkle — the "cleaned" accent */}
      <path
        d="M18.1 3.1c.4 1.83 1.04 2.47 2.87 2.87-1.83.4-2.47 1.04-2.87 2.87-.4-1.83-1.04-2.47-2.87-2.87 1.83-.4 2.47-1.04 2.87-2.87Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  )
}
