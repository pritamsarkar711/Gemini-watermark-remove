'use client'

import { Eraser, Heart } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="mt-auto w-full gradient-border-top bg-gradient-to-t from-muted/40 via-muted/20 to-transparent backdrop-blur-sm">
      <div className="mx-auto max-w-4xl flex flex-col items-center sm:flex-row sm:justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4">
        {/* Brand cluster */}
        <div className="flex items-center gap-2">
          <div className="flex size-5 items-center justify-center rounded-md bg-primary/15">
            <Eraser className="size-3 text-primary" />
          </div>
          <span className="text-xs font-bold text-foreground/80">Gemini Watermark</span>
        </div>

        {/* Credits */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium">Built with <Heart className="size-2.5 text-primary inline" /> by Jogulberg</span>
          <span className="text-muted-foreground/40 hidden sm:inline">·</span>
          <a
            href="https://t.me/joegoldberg2025"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary transition-colors font-medium"
          >
            @joegoldberg2025
          </a>
          <span className="text-muted-foreground/30 hidden sm:inline">·</span>
          <span className="rounded-md border border-border/60 bg-card/60 px-2 py-0.5 text-xs font-bold tabular-nums text-muted-foreground shadow-sm hidden sm:inline">v1.2</span>
        </div>
      </div>
    </footer>
  )
}
