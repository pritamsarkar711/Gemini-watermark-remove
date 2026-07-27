'use client'

import { Eraser, Heart } from 'lucide-react'

const TELEGRAM_URL = 'https://t.me/joegoldberg2025'

export default function Footer() {
  return (
    <footer className="mt-auto w-full gradient-border-top bg-gradient-to-t from-primary/[0.06] via-muted/45 to-transparent backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-4 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2.5 text-sm">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/20">
            <Eraser className="size-3.5 text-primary" />
          </div>
          <span className="font-bold tracking-tight text-foreground">Gemini Watermark</span>
        </div>

        <a
          href={TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex flex-wrap items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-center text-sm font-semibold text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Contact Joe Goldberg on Telegram at @joegoldberg2025"
        >
          <span>Built with</span>
          <Heart className="size-3.5 fill-primary text-primary transition-transform group-hover:scale-110" aria-hidden="true" />
          <span>by Joe Goldberg</span>
          <span className="text-muted-foreground/65 transition-colors group-hover:text-primary">@joegoldberg2025</span>
        </a>
      </div>
    </footer>
  )
}
