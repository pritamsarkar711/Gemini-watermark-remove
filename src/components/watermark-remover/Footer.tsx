'use client'

import { Eraser, Heart, Github } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="mt-auto w-full border-t bg-gradient-to-t from-muted/30 to-transparent">
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-1.5 text-muted-foreground/60">
          <Eraser className="size-3" />
          <span className="text-[11px] font-medium">Zeminai</span>
        </div>

        {/* Center: description */}
        <div className="hidden sm:flex items-center gap-2 text-[11px] text-muted-foreground/50">
          <span>Remove watermarks with no trace</span>
        </div>

        {/* Right: credits */}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
          <Heart className="size-2.5 text-primary/50" />
          <span>Built with care</span>
        </div>
      </div>
    </footer>
  )
}
