'use client'

import { useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ZoomIn, ZoomOut, RotateCcw, ImageIcon, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore, type ImageInfo } from '@/lib/store'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 50 * 1024 * 1024

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function formatType(type: string): string {
  return type.replace('image/', '').toUpperCase()
}

export default function ImagePreview() {
  const { originalImage, setOriginalImage } = useAppStore()
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const offsetStart = useRef({ x: 0, y: 0 })

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + 0.5, 5))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((z) => {
      const newZoom = Math.max(z - 0.5, 1)
      if (newZoom === 1) setOffset({ x: 0, y: 0 })
      return newZoom
    })
  }, [])

  const handleResetZoom = useCallback(() => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom((z) => {
      const newZoom = Math.max(1, Math.min(5, z - e.deltaY * 0.002))
      if (newZoom === 1) setOffset({ x: 0, y: 0 })
      return newZoom
    })
  }, [])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoom <= 1) return
      setIsDragging(true)
      dragStart.current = { x: e.clientX, y: e.clientY }
      offsetStart.current = { ...offset }
    },
    [zoom, offset]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      setOffset({
        x: offsetStart.current.x + dx,
        y: offsetStart.current.y + dy,
      })
    },
    [isDragging]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // ─── Drag-and-drop re-upload ────────────────────────────────────────────────
  // Allows the user to drop a new image onto the preview to replace the
  // current one (avoids having to click "New Image" first).
  const processFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) return
      if (file.size > MAX_SIZE) return

      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })

      const img = new Image()
      img.onload = () => {
        const imageInfo: ImageInfo = {
          file,
          name: file.name,
          originalName: file.name,
          width: img.naturalWidth,
          height: img.naturalHeight,
          size: file.size,
          type: file.type,
          dataUrl,
        }
        setOriginalImage(imageInfo)
        // Reset zoom/pan when a new image is loaded
        setZoom(1)
        setOffset({ x: 0, y: 0 })
      }
      img.src = dataUrl
    },
    [setOriginalImage]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only clear if leaving the container (not entering a child)
    if (e.currentTarget === e.target) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
      const file = e.dataTransfer.files?.[0]
      if (file) void processFile(file)
    },
    [processFile]
  )

  if (!originalImage) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex w-full flex-col gap-2"
      >
        <div
          className="flex items-center justify-center rounded-xl border border-dashed bg-muted/20"
          style={{ minHeight: '240px', maxHeight: '55vh' }}
        >
          <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
            <ImageIcon className="size-8" />
            <span className="text-xs font-medium">No image loaded</span>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex w-full flex-col gap-2"
    >
      {/* Image info bar */}
      <div className="flex items-center gap-2 rounded-lg border bg-card/80 px-3 py-1.5 shadow-sm transition-colors duration-200 hover:bg-card">
        <ImageIcon className="size-3.5 text-primary/70" />
        <span className="text-xs font-semibold">{originalImage.name}</span>
        <div className="flex items-center gap-2 ml-auto text-[11px] text-muted-foreground/60">
          <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{originalImage.width} x {originalImage.height}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{formatType(originalImage.type)}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{formatSize(originalImage.size)}</span>
        </div>
      </div>

      {/* Image container */}
      <div
        className="relative overflow-hidden rounded-xl border bg-muted/20 shadow-sm"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        <div className="flex items-center justify-center" style={{ minHeight: '240px', maxHeight: '55vh' }}>
          <img
            src={originalImage.dataUrl}
            alt="Preview"
            className="max-h-[55vh] w-auto object-contain transition-transform duration-100 select-none"
            style={{
              transform: `scale(${zoom}) translate(${offset.x / zoom}px, ${offset.y / zoom}px)`,
            }}
            draggable={false}
          />
        </div>

        {/* Subtle gradient overlay at bottom for zoom control visibility */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />

        {/* Drag-and-drop re-upload overlay */}
        <AnimatePresence>
          {isDragOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-primary/15 backdrop-blur-sm"
            >
              <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-primary bg-card/90 px-6 py-5 shadow-lg">
                <UploadCloud className="size-7 text-primary" />
                <span className="text-sm font-semibold text-foreground">Drop to replace</span>
                <span className="text-[10px] text-muted-foreground/70">PNG JPEG WebP up to 50MB</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Zoom controls - pill shaped */}
        <div className="absolute bottom-2 right-2 flex items-center gap-0.5 rounded-lg bg-black/40 px-1 py-0.5 backdrop-blur-sm shadow-md">
          <Button
            variant="ghost"
            size="icon"
            className="size-6 rounded-md text-white/70 hover:text-white hover:bg-white/10"
            onClick={handleZoomOut}
            disabled={zoom <= 1}
          >
            <ZoomOut className="size-3" />
          </Button>
          <span className="min-w-[2.5rem] text-center text-[10px] font-medium text-white/60">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 rounded-md text-white/70 hover:text-white hover:bg-white/10"
            onClick={handleZoomIn}
            disabled={zoom >= 5}
          >
            <ZoomIn className="size-3" />
          </Button>
          {zoom > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6 rounded-md text-white/70 hover:text-white hover:bg-white/10"
              onClick={handleResetZoom}
            >
              <RotateCcw className="size-3" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
