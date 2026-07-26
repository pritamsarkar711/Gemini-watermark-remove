'use client'

import { Eraser } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="mt-auto w-full border-t bg-background">
      <div className="mx-auto flex h-9 max-w-7xl items-center justify-center px-4 sm:px-6">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/40">
          <Eraser className="size-3" />
          <span>Zeminai</span>
        </div>
      </div>
    </footer>
  )
}
