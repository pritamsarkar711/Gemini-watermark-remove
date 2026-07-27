'use client'

import { Sparkles } from 'lucide-react'

const TELEGRAM_URL = 'https://t.me/joegoldberg2025'

export default function Footer() {
  return (
    <footer className="mt-auto w-full gradient-border-top bg-gradient-to-t from-primary/[0.06] via-muted/45 to-transparent backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-4 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2.5 text-sm">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/20">
            <Sparkles className="size-3.5 text-primary" />
          </div>
          <span className="font-bold tracking-tight text-foreground">Gemini Watermark</span>
        </div>

        <div className="inline-flex flex-wrap items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-center text-sm font-semibold text-muted-foreground">
          <span>Built with love by</span>
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md text-foreground underline decoration-primary/35 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Contact Joe Goldberg on Telegram"
          >
            Joe Goldberg
          </a>
        </div>
      </div>
    </footer>
  )
}
