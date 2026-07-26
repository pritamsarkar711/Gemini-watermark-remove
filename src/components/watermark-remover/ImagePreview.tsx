'use client'

import { useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export default function ImagePreview() {
  const { originalImage } = useAppStore()
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
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

  if (!originalImage) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex w-full flex-col gap-1"
    >
      <div
        className="relative overflow-hidden rounded-lg border bg-muted/20"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
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

        {/* Zoom controls */}
        <div className="absolute bottom-2 right-2 flex items-center gap-0.5">
          <Button
            variant="secondary"
            size="icon"
            className="size-7 rounded-md shadow-sm text-xs"
            onClick={handleZoomOut}
            disabled={zoom <= 1}
          >
            <ZoomOut className="size-3" />
          </Button>
          <span className="min-w-[2.5rem] text-center text-[10px] font-medium text-muted-foreground/60">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="secondary"
            size="icon"
            className="size-7 rounded-md shadow-sm text-xs"
            onClick={handleZoomIn}
            disabled={zoom >= 5}
          >
            <ZoomIn className="size-3" />
          </Button>
          {zoom > 1 && (
            <Button
              variant="secondary"
              size="icon"
              className="size-7 rounded-md shadow-sm text-xs"
              onClick={handleResetZoom}
            >
              <RotateCcw className="size-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Image info - very minimal */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/40 px-1">
        <span>{originalImage.width} x {originalImage.height}</span>
        <span>{formatSize(originalImage.size)}</span>
      </div>
    </motion.div>
  )
}
