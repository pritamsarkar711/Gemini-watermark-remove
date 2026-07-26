'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
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

// ─── Crop overlay types ──────────────────────────────────────────────────────
type DragMode =
  | 'move'
  | 'resize-nw'
  | 'resize-n'
  | 'resize-ne'
  | 'resize-e'
  | 'resize-se'
  | 'resize-s'
  | 'resize-sw'
  | 'resize-w'

interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

interface DragState {
  mode: DragMode
  startPointerX: number // image-space coords at drag start
  startPointerY: number
  startRect: CropRect
}

const HANDLE_CURSORS: Record<DragMode, string> = {
  move: 'cursor-move',
  'resize-nw': 'cursor-nwse-resize',
  'resize-se': 'cursor-nwse-resize',
  'resize-ne': 'cursor-nesw-resize',
  'resize-sw': 'cursor-nesw-resize',
  'resize-n': 'cursor-ns-resize',
  'resize-s': 'cursor-ns-resize',
  'resize-e': 'cursor-ew-resize',
  'resize-w': 'cursor-ew-resize',
}

const MIN_CROP_SIZE = 8 // minimum crop dimension in image pixels

export default function ImagePreview() {
  const {
    originalImage,
    setOriginalImage,
    cropRect,
    setCropRect,
    isCropOverlayActive,
    isProcessing,
  } = useAppStore()
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const offsetStart = useRef({ x: 0, y: 0 })

  // ─── Image measurement (for crop overlay positioning) ─────────────────────
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [renderedSize, setRenderedSize] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    const img = imgRef.current
    if (!img) return
    const measure = () => {
      const r = img.getBoundingClientRect()
      setRenderedSize({ w: r.width, h: r.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(img)
    // Re-measure when the image finishes loading (natural size known)
    const onLoad = () => measure()
    img.addEventListener('load', onLoad)
    return () => {
      ro.disconnect()
      img.removeEventListener('load', onLoad)
    }
  }, [originalImage])

  // ─── Crop overlay drag state ───────────────────────────────────────────────
  // While dragging, `dragRect` holds the live in-progress rect (image coords);
  // the overlay shows `dragRect ?? cropRect`. On pointer up, dragRect is
  // committed to the store via setCropRect and cleared.
  const [dragRect, setDragRect] = useState<CropRect | null>(null)
  const [isCropDragging, setIsCropDragging] = useState(false)
  const dragStateRef = useRef<DragState | null>(null)

  /** Convert screen pointer coords to image-space pixel coords. */
  const screenToImage = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const img = imgRef.current
      if (!img || !originalImage) return null
      const r = img.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return null
      const x = ((clientX - r.left) / r.width) * originalImage.width
      const y = ((clientY - r.top) / r.height) * originalImage.height
      return { x, y }
    },
    [originalImage]
  )

  /** Compute the next crop rect given the current pointer position. */
  const computeNextRect = useCallback(
    (pointerImgX: number, pointerImgY: number): CropRect | null => {
      const ds = dragStateRef.current
      if (!ds || !originalImage) return null
      const imgW = originalImage.width
      const imgH = originalImage.height
      const start = ds.startRect
      // Delta in image-space pixels since drag start
      const dx = pointerImgX - ds.startPointerX
      const dy = pointerImgY - ds.startPointerY

      let { x, y, width, height } = start

      if (ds.mode === 'move') {
        x = Math.max(0, Math.min(imgW - start.width, start.x + dx))
        y = Math.max(0, Math.min(imgH - start.height, start.y + dy))
      } else {
        // Resize: adjust edges independently, then enforce min size & bounds
        let left = start.x
        let top = start.y
        let right = start.x + start.width
        let bottom = start.y + start.height

        if (ds.mode.includes('w')) left = start.x + dx
        if (ds.mode.includes('e')) right = start.x + start.width + dx
        if (ds.mode.includes('n')) top = start.y + dy
        if (ds.mode.includes('s')) bottom = start.y + start.height + dy

        // Clamp to image bounds
        left = Math.max(0, Math.min(left, imgW - MIN_CROP_SIZE))
        right = Math.max(MIN_CROP_SIZE, Math.min(right, imgW))
        top = Math.max(0, Math.min(top, imgH - MIN_CROP_SIZE))
        bottom = Math.max(MIN_CROP_SIZE, Math.min(bottom, imgH))

        // Enforce min size (swap if user dragged past the opposite edge)
        if (right - left < MIN_CROP_SIZE) {
          // Pin to whichever edge is being dragged
          if (ds.mode.includes('w')) left = right - MIN_CROP_SIZE
          else right = left + MIN_CROP_SIZE
        }
        if (bottom - top < MIN_CROP_SIZE) {
          if (ds.mode.includes('n')) top = bottom - MIN_CROP_SIZE
          else bottom = top + MIN_CROP_SIZE
        }

        x = left
        y = top
        width = right - left
        height = bottom - top
      }

      return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) }
    },
    [originalImage]
  )

  // Unified pointer move/up handlers (work for both mouse and touch).
  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      const next = computeNextRect(clientX, clientY)
      if (next) setDragRect(next)
    },
    [computeNextRect]
  )

  const handlePointerUp = useCallback(() => {
    // Commit the final rect (if any) to the store, then clear local drag state
    setDragRect((dr) => {
      if (dr) setCropRect(dr)
      return null
    })
    dragStateRef.current = null
    setIsCropDragging(false)
    if (typeof window !== 'undefined') {
      document.body.style.userSelect = ''
    }
  }, [setCropRect])

  // Attach global listeners during an active drag (so we keep tracking even
  // when the pointer leaves the overlay element).
  useEffect(() => {
    if (!isCropDragging) return

    const onMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      handlePointerMove(e.clientX, e.clientY)
    }
    const onMouseUp = () => handlePointerUp()
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return
      e.preventDefault()
      const t = e.touches[0]
      handlePointerMove(t.clientX, t.clientY)
    }
    const onTouchEnd = () => handlePointerUp()

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
    window.addEventListener('touchcancel', onTouchEnd)
    document.body.style.userSelect = 'none'

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [isCropDragging, handlePointerMove, handlePointerUp])

  /** Begin a drag (move or resize). */
  const beginDrag = useCallback(
    (mode: DragMode, clientX: number, clientY: number) => {
      if (!originalImage) return
      const imgPos = screenToImage(clientX, clientY)
      if (!imgPos) return
      const baseRect = dragRect ?? cropRect
      dragStateRef.current = {
        mode,
        startPointerX: imgPos.x,
        startPointerY: imgPos.y,
        startRect: { ...baseRect },
      }
      // Seed the local drag rect so the overlay snaps to it immediately and so
      // subsequent pointermove events always have a non-null value to update.
      setDragRect({ ...baseRect })
      setIsCropDragging(true)
    },
    [originalImage, screenToImage, dragRect, cropRect]
  )

  // Mouse + touch handlers for the rect body and each handle.
  const onRectPointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (zoom > 1) return
      e.stopPropagation()
      const pt = 'touches' in e ? e.touches[0] : (e as React.MouseEvent)
      if (!pt) return
      beginDrag('move', pt.clientX, pt.clientY)
    },
    [beginDrag, zoom]
  )

  const makeHandlePointerDown = useCallback(
    (mode: DragMode) => (e: React.MouseEvent | React.TouchEvent) => {
      if (zoom > 1) return
      e.stopPropagation()
      e.preventDefault()
      const pt = 'touches' in e ? e.touches[0] : (e as React.MouseEvent)
      if (!pt) return
      beginDrag(mode, pt.clientX, pt.clientY)
    },
    [beginDrag, zoom]
  )

  // ─── Existing zoom / pan / drag-drop handlers ──────────────────────────────
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
          className="dot-grid-bg flex items-center justify-center rounded-xl border border-dashed bg-muted/20"
          style={{ minHeight: '240px', maxHeight: '55vh' }}
        >
          <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
            <ImageIcon className="size-8" />
            <span className="text-xs font-medium">No image loaded</span>
            <span className="text-[10px] text-muted-foreground/40">Drag and drop or use the upload area</span>
          </div>
        </div>
      </motion.div>
    )
  }

  // Compute the displayed crop rect (dragRect takes priority while dragging)
  const displayRect = dragRect ?? cropRect
  const hasValidRect = displayRect.width > 0 && displayRect.height > 0

  // Convert image-space crop rect to screen-space overlay coordinates (as %).
  const overlayPct =
    renderedSize && originalImage && hasValidRect
      ? {
          left: (displayRect.x / originalImage.width) * 100,
          top: (displayRect.y / originalImage.height) * 100,
          width: (displayRect.width / originalImage.width) * 100,
          height: (displayRect.height / originalImage.height) * 100,
        }
      : null

  const showOverlay =
    isCropOverlayActive && originalImage && overlayPct && zoom <= 1

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex w-full flex-col gap-2"
    >
      {/* Image info bar */}
      <div className="gradient-border-left flex items-center gap-2 rounded-lg border bg-card/80 px-3 py-1.5 shadow-sm transition-all duration-200 hover:bg-card hover:shadow-md">
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
        className="relative overflow-hidden rounded-xl border bg-muted/20 shadow-sm transition-shadow duration-300 hover:shadow-md"
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
            ref={imgRef}
            src={originalImage.dataUrl}
            alt="Preview"
            onLoad={() => {/* shimmer fades naturally after load */}}
            className="image-shimmer-loading max-h-[55vh] w-auto object-contain transition-transform duration-100 select-none"
            style={{
              transform: `scale(${zoom}) translate(${offset.x / zoom}px, ${offset.y / zoom}px)`,
            }}
            draggable={false}
          />
        </div>

        {/* Crop overlay: positioned absolutely over the rendered <img>. */}
        {/* The container is centered (flex justify-center items-center), so the
            image bounding box equals the rendered img's box. We position the
            overlay using absolute + inset-0 + flex centering to match. */}
        {showOverlay && overlayPct && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div
              className="relative"
              style={{
                width: renderedSize ? `${renderedSize.w}px` : 'auto',
                height: renderedSize ? `${renderedSize.h}px` : 'auto',
                maxWidth: '100%',
                maxHeight: '100%',
              }}
            >
              {/* Crop rectangle with mask via box-shadow */}
              <div
                role="button"
                aria-label="Crop rectangle — drag to move"
                tabIndex={0}
                onMouseDown={onRectPointerDown}
                onTouchStart={onRectPointerDown}
                className={`absolute border-2 border-primary ${HANDLE_CURSORS.move} pointer-events-auto`}
                style={{
                  left: `${overlayPct.left}%`,
                  top: `${overlayPct.top}%`,
                  width: `${overlayPct.width}%`,
                  height: `${overlayPct.height}%`,
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                  // Subtle inner outline for contrast on bright images
                  outline: '1px solid rgba(255, 255, 255, 0.4)',
                  outlineOffset: '-1px',
                  background: 'transparent',
                  // Make the body clickable for move but not block handles
                  touchAction: 'none',
                }}
              >
                {/* Rule-of-thirds grid lines for visual guidance */}
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute top-0 bottom-0 left-1/3 w-px bg-white/20" />
                  <div className="absolute top-0 bottom-0 left-2/3 w-px bg-white/20" />
                  <div className="absolute left-0 right-0 top-1/3 h-px bg-white/20" />
                  <div className="absolute left-0 right-0 top-2/3 h-px bg-white/20" />
                </div>

                {/* Dimension badge (top-left, just inside the rect so it stays
                    visible even when the rect fills the container — avoids
                    being clipped by the container's overflow-hidden). */}
                <div className="pointer-events-none absolute left-1 top-1 z-10 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-md">
                  {displayRect.width}×{displayRect.height}
                </div>

                {/* 8 resize handles */}
                {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as unknown as DragMode[]).map(
                  (h) => {
                    // Position each handle at its corner / edge midpoint
                    const posCls: Record<string, string> = {
                      nw: 'left-0 top-0',
                      n: 'left-1/2 top-0 -translate-x-1/2',
                      ne: 'right-0 top-0',
                      e: 'right-0 top-1/2 -translate-y-1/2',
                      se: 'right-0 bottom-0',
                      s: 'left-1/2 bottom-0 -translate-x-1/2',
                      sw: 'left-0 bottom-0',
                      w: 'left-0 top-1/2 -translate-y-1/2',
                    }
                    return (
                      <div
                        key={h}
                        role="button"
                        aria-label={`Resize ${h}`}
                        tabIndex={0}
                        onMouseDown={makeHandlePointerDown(h)}
                        onTouchStart={makeHandlePointerDown(h)}
                        className={`absolute size-3 rounded-sm border-2 border-primary bg-white shadow-sm pointer-events-auto ${HANDLE_CURSORS[h]} ${posCls[h]} hover:bg-primary/10`}
                        style={{ touchAction: 'none' }}
                      />
                    )
                  }
                )}
              </div>
            </div>
          </div>
        )}

        {/* Processing overlay — semi-transparent with spinner and text */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-sm"
            >
              <div className="flex flex-col items-center gap-3 rounded-xl bg-card/90 border shadow-lg px-6 py-4 backdrop-blur-md">
                <div className="relative size-10">
                  <div className="absolute inset-0 rounded-full border-2 border-muted-foreground/20" />
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                </div>
                <span className="text-sm font-semibold text-foreground">Processing</span>
                <span className="text-[10px] text-muted-foreground/70">Your image is being processed...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hint badge: overlay is active but zoom > 1 (overlay hidden) */}
        {isCropOverlayActive && zoom > 1 && (
          <div className="pointer-events-none absolute left-2 top-2 z-20 rounded-md bg-black/70 px-2 py-1 text-[10px] font-medium text-white/90 shadow-md backdrop-blur-sm">
            Reset zoom to edit crop
          </div>
        )}

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
              className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-primary/15 backdrop-blur-sm"
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
