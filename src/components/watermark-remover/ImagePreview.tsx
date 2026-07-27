'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ZoomIn, ZoomOut, RotateCcw, ImageIcon, UploadCloud, Paintbrush, Eraser, Check, X } from 'lucide-react'
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

const PROCESSING_STAGES = [
  { label: 'Detecting', description: 'Detecting watermark...', progress: 33 },
  { label: 'Removing', description: 'Removing watermark...', progress: 66 },
  { label: 'Finishing', description: 'Applying final touches...', progress: 100 },
] as const

export default function ImagePreview() {
  const {
    originalImage,
    setOriginalImage,
    cropRect,
    setCropRect,
    isCropOverlayActive,
    isProcessing,
    mode,
    autoDetect,
    setAutoDetect,
    setMaskData,
    setInlineBrushActive,
  } = useAppStore()
  const [zoom, setZoom] = useState(1)
  const [processingStage, setProcessingStage] = useState(0)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const offsetStart = useRef({ x: 0, y: 0 })

  // ─── Inline Magic Brush state ──────────────────────────────────────────────
  // `isBrushMode` toggles the brushable canvas overlay on the main image preview.
  // `brushSize` is in CSS pixels (what the user sees); it is scaled to canvas
  // pixels at draw time using the canvas-to-display ratio.
  // `brushCanvasRef` is the visible canvas (semi-transparent red strokes).
  // `brushDataCanvasRef` is a hidden offscreen canvas that holds opaque white
  // strokes — this is what gets exported as the mask PNG, because the
  // remove-watermark API thresholds on RGB brightness (maskVal > 128) and pure
  // red (255,60,60) averages to 125 which would be incorrectly skipped.
  const [isBrushMode, setIsBrushMode] = useState(false)
  const [brushSize, setBrushSize] = useState(20)
  const [isBrushDrawing, setIsBrushDrawing] = useState(false)
  const brushCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const brushDataCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastBrushPosRef = useRef<{ x: number; y: number } | null>(null)
  const prevAutoDetectRef = useRef<boolean | null>(null)

  // ─── Processing stage timer ────────────────────────────────────────────────
  useEffect(() => {
    if (!isProcessing) return
    // Reset stage when processing begins (async callback avoids synchronous setState in effect)
    const resetTimer = setTimeout(() => setProcessingStage(0), 0)
    // Stage 0 (Detecting): 2 seconds
    const timer1 = setTimeout(() => setProcessingStage(1), 2000)
    // Stage 1 (Removing): 3 seconds
    const timer2 = setTimeout(() => setProcessingStage(2), 5000)
    return () => {
      clearTimeout(resetTimer)
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [isProcessing])

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
    if (isBrushMode) return // disable zoom while painting
    e.preventDefault()
    setZoom((z) => {
      const newZoom = Math.max(1, Math.min(5, z - e.deltaY * 0.002))
      if (newZoom === 1) setOffset({ x: 0, y: 0 })
      return newZoom
    })
  }, [isBrushMode])

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

  // ─── Inline Magic Brush handlers ───────────────────────────────────────────
  // The brush overlay mirrors the crop overlay's positioning strategy: a
  // relative wrapper sized to the rendered image bounds (renderedSize), with
  // the canvas absolutely filling that wrapper. The canvas's internal
  // resolution is set to the original image's natural dimensions so the mask
  // matches the input image 1:1 (the API also resizes the mask to fit, but
  // starting at native resolution avoids blur).

  /** Initialize both brush canvases (visible + hidden data) when entering brush mode. */
  useEffect(() => {
    if (!isBrushMode || !originalImage) return
    const dispCanvas = brushCanvasRef.current
    const dataCanvas = brushDataCanvasRef.current
    if (!dispCanvas || !dataCanvas) return
    // Use the original image's natural dimensions for a high-quality mask
    dispCanvas.width = originalImage.width
    dispCanvas.height = originalImage.height
    dataCanvas.width = originalImage.width
    dataCanvas.height = originalImage.height
    const dispCtx = dispCanvas.getContext('2d')
    const dataCtx = dataCanvas.getContext('2d')
    if (dispCtx) dispCtx.clearRect(0, 0, dispCanvas.width, dispCanvas.height)
    if (dataCtx) dataCtx.clearRect(0, 0, dataCanvas.width, dataCanvas.height)
    lastBrushPosRef.current = null
  }, [isBrushMode, originalImage])

  /** Exit brush mode automatically when leaving remove mode or losing the image.
   *  Uses setTimeout(0) to defer the setState calls (matching the existing
   *  processing-stage timer pattern in this file) and satisfy the
   *  react-hooks/set-state-in-effect lint rule. */
  useEffect(() => {
    if (!isBrushMode) return
    if (mode === 'remove' && originalImage) return
    const timer = setTimeout(() => {
      setIsBrushMode(false)
      setInlineBrushActive(false)
      // Restore autoDetect if it was on before entering brush mode
      if (prevAutoDetectRef.current === true) setAutoDetect(true)
      prevAutoDetectRef.current = null
    }, 0)
    return () => clearTimeout(timer)
  }, [isBrushMode, mode, originalImage, setAutoDetect, setInlineBrushActive])

  /** Convert a pointer's client coords to canvas-internal pixel coords. */
  const getBrushPos = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const canvas = brushCanvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return null
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      }
    },
    []
  )

  /** Paint a filled circle (and a line from the last position) at canvas coords. */
  const paintBrush = useCallback(
    (pos: { x: number; y: number }) => {
      const dispCanvas = brushCanvasRef.current
      const dataCanvas = brushDataCanvasRef.current
      if (!dispCanvas || !dataCanvas) return
      const dispCtx = dispCanvas.getContext('2d')
      const dataCtx = dataCanvas.getContext('2d')
      if (!dispCtx || !dataCtx) return

      const rect = dispCanvas.getBoundingClientRect()
      if (rect.width === 0) return
      // Scale brush size from CSS pixels to canvas pixels
      const scale = dispCanvas.width / rect.width
      const radius = (brushSize * scale) / 2
      const lineWidth = brushSize * scale

      // Visible canvas: semi-transparent red (per spec)
      dispCtx.fillStyle = 'rgba(255, 60, 60, 0.4)'
      dispCtx.strokeStyle = 'rgba(255, 60, 60, 0.4)'
      dispCtx.lineWidth = lineWidth
      dispCtx.lineCap = 'round'
      dispCtx.lineJoin = 'round'

      // Hidden data canvas: opaque white so the API's maskVal > 128 check passes
      dataCtx.fillStyle = 'rgba(255, 255, 255, 1)'
      dataCtx.strokeStyle = 'rgba(255, 255, 255, 1)'
      dataCtx.lineWidth = lineWidth
      dataCtx.lineCap = 'round'
      dataCtx.lineJoin = 'round'

      // Filled circle at the cursor
      dispCtx.beginPath()
      dispCtx.arc(pos.x, pos.y, radius, 0, Math.PI * 2)
      dispCtx.fill()

      dataCtx.beginPath()
      dataCtx.arc(pos.x, pos.y, radius, 0, Math.PI * 2)
      dataCtx.fill()

      // Smooth line from last position to current
      const last = lastBrushPosRef.current
      if (last) {
        dispCtx.beginPath()
        dispCtx.moveTo(last.x, last.y)
        dispCtx.lineTo(pos.x, pos.y)
        dispCtx.stroke()

        dataCtx.beginPath()
        dataCtx.moveTo(last.x, last.y)
        dataCtx.lineTo(pos.x, pos.y)
        dataCtx.stroke()
      }

      lastBrushPosRef.current = pos
    },
    [brushSize]
  )

  /** Mouse: start drawing. */
  const handleBrushMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      e.stopPropagation()
      const pos = getBrushPos(e.clientX, e.clientY)
      if (!pos) return
      setIsBrushDrawing(true)
      lastBrushPosRef.current = null
      paintBrush(pos)
    },
    [getBrushPos, paintBrush]
  )

  /** Mouse: continue drawing while button is held. */
  const handleBrushMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isBrushDrawing) return
      const pos = getBrushPos(e.clientX, e.clientY)
      if (!pos) return
      paintBrush(pos)
    },
    [isBrushDrawing, getBrushPos, paintBrush]
  )

  /** Mouse: stop drawing. */
  const handleBrushMouseUp = useCallback(() => {
    setIsBrushDrawing(false)
    lastBrushPosRef.current = null
  }, [])

  /** Touch: start drawing (mobile). */
  const handleBrushTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.touches.length === 0) return
      const t = e.touches[0]
      const pos = getBrushPos(t.clientX, t.clientY)
      if (!pos) return
      setIsBrushDrawing(true)
      lastBrushPosRef.current = null
      paintBrush(pos)
    },
    [getBrushPos, paintBrush]
  )

  /** Touch: continue drawing (mobile). */
  const handleBrushTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (!isBrushDrawing) return
      e.preventDefault()
      if (e.touches.length === 0) return
      const t = e.touches[0]
      const pos = getBrushPos(t.clientX, t.clientY)
      if (!pos) return
      paintBrush(pos)
    },
    [isBrushDrawing, getBrushPos, paintBrush]
  )

  /** Touch: stop drawing (mobile). */
  const handleBrushTouchEnd = useCallback(() => {
    setIsBrushDrawing(false)
    lastBrushPosRef.current = null
  }, [])

  /** Enter brush mode: remember autoDetect so we can restore it on cancel. */
  const enterBrushMode = useCallback(() => {
    if (!originalImage || isProcessing) return
    prevAutoDetectRef.current = autoDetect
    setAutoDetect(false)
    // Reset zoom/pan so the canvas overlay aligns exactly with the image
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setIsBrushMode(true)
    setInlineBrushActive(true)
  }, [originalImage, isProcessing, autoDetect, setAutoDetect, setInlineBrushActive])

  /** Clear both canvases. */
  const clearBrushCanvas = useCallback(() => {
    const dispCanvas = brushCanvasRef.current
    const dataCanvas = brushDataCanvasRef.current
    if (dispCanvas) {
      const ctx = dispCanvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, dispCanvas.width, dispCanvas.height)
    }
    if (dataCanvas) {
      const ctx = dataCanvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, dataCanvas.width, dataCanvas.height)
    }
    lastBrushPosRef.current = null
  }, [])

  /** Apply: export the data canvas as a PNG mask and trigger the remove API. */
  const applyBrushMask = useCallback(() => {
    const dataCanvas = brushDataCanvasRef.current
    if (!dataCanvas) return
    const dataUrl = dataCanvas.toDataURL('image/png')
    setMaskData(dataUrl)
    setIsBrushMode(false)
    setInlineBrushActive(false)
    // The autoDetect was already set to false on enter; leave it false so the
    // API uses the mask. (prevAutoDetectRef is intentionally NOT restored here.)
    prevAutoDetectRef.current = null
    // Trigger the global process handler exposed by ControlPanel
    if (typeof window !== 'undefined') {
      const w = window as unknown as { __geminiProcess?: () => void }
      w.__geminiProcess?.()
    }
  }, [setMaskData, setInlineBrushActive])

  /** Cancel: exit brush mode and restore autoDetect if it was on before. */
  const cancelBrushMode = useCallback(() => {
    setIsBrushMode(false)
    setInlineBrushActive(false)
    if (prevAutoDetectRef.current === true) setAutoDetect(true)
    prevAutoDetectRef.current = null
  }, [setAutoDetect, setInlineBrushActive])

  if (!originalImage) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex w-full flex-col gap-2"
      >
        <div
          className="dot-grid-bg flex items-center justify-center rounded-lg border border-dashed bg-muted/20"
          style={{ minHeight: '240px', maxHeight: '55vh' }}
        >
          <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
            <ImageIcon className="size-8" />
            <span className="text-xs font-medium">No image loaded</span>
            <span className="text-xs text-muted-foreground/40">Drag and drop or use the upload area</span>
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
    isCropOverlayActive && originalImage && overlayPct && zoom <= 1 && !isBrushMode

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
        <div className="flex items-center gap-2 ml-auto text-sm text-muted-foreground/60">
          <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{originalImage.width} x {originalImage.height}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{formatType(originalImage.type)}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{formatSize(originalImage.size)}</span>
        </div>
      </div>

      {/* Image container */}
      <div
        className="relative overflow-hidden rounded-lg border bg-muted/20 shadow-sm transition-shadow duration-300 hover:shadow-md"
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
                <div className="pointer-events-none absolute left-1 top-1 z-10 rounded-md bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground shadow-md">
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

        {/* Inline Magic Brush canvas overlay — covers the rendered image bounds.
            A wrapper div is sized to the rendered image dimensions (mirroring
            the crop overlay strategy) so the canvas only covers the image,
            not the empty padding around it. */}
        {isBrushMode && renderedSize && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div
              className="relative"
              style={{
                width: `${renderedSize.w}px`,
                height: `${renderedSize.h}px`,
                maxWidth: '100%',
                maxHeight: '100%',
              }}
            >
              <canvas
                ref={brushCanvasRef}
                className="brush-canvas pointer-events-auto absolute inset-0 h-full w-full"
                onMouseDown={handleBrushMouseDown}
                onMouseMove={handleBrushMouseMove}
                onMouseUp={handleBrushMouseUp}
                onMouseLeave={handleBrushMouseUp}
                onTouchStart={handleBrushTouchStart}
                onTouchMove={handleBrushTouchMove}
                onTouchEnd={handleBrushTouchEnd}
              />
            </div>
          </div>
        )}

        {/* Hidden offscreen data canvas — holds opaque white strokes that get
            exported as the mask PNG on Apply. Kept in the DOM (display:none) so
            its 2D context is always available. */}
        <canvas ref={brushDataCanvasRef} style={{ display: 'none' }} aria-hidden="true" />

        {/* Brush mode hint badge (top-left, above the canvas) */}
        {isBrushMode && (
          <div className="pointer-events-none absolute left-2 top-2 z-20 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white/90 shadow-md backdrop-blur-sm">
            Paint over the watermark to remove
          </div>
        )}

        {/* Processing overlay — semi-transparent with spinner and progress bar */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-sm"
            >
              <div className="flex flex-col items-center gap-3 rounded-lg bg-card/90 border shadow-lg px-6 py-4 backdrop-blur-md">
                <div className="relative size-10">
                  <div className="absolute inset-0 rounded-full border-2 border-muted-foreground/20" />
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                </div>
                <span className="text-sm font-semibold text-foreground">Processing</span>
                {/* Progress bar */}
                <div className="w-full">
                  <div className="quality-bar relative h-2 w-full rounded-full bg-muted/30 overflow-hidden">
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ background: 'linear-gradient(to right, #ef4444, #f97316, #eab308, #22c55e)' }}
                      initial={{ width: '0%' }}
                      animate={{ width: `${PROCESSING_STAGES[processingStage].progress}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                  {/* Stage indicators */}
                  <div className="flex items-center justify-between mt-1.5">
                    {PROCESSING_STAGES.map((stage, idx) => (
                      <div
                        key={stage.label}
                        className={`flex items-center gap-1 text-xs font-medium transition-all duration-300 ${
                          idx <= processingStage
                            ? 'text-primary'
                            : 'text-muted-foreground/40'
                        }`}
                      >
                        <div
                          className={`size-1.5 rounded-full transition-all duration-300 ${
                            idx <= processingStage
                              ? 'bg-primary'
                              : 'bg-muted-foreground/30'
                          }`}
                        />
                        {stage.label}
                      </div>
                    ))}
                  </div>
                  {/* Stage description */}
                  <div className="text-xs text-muted-foreground/70 mt-1 text-center">
                    {PROCESSING_STAGES[processingStage].description}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hint badge: overlay is active but zoom > 1 (overlay hidden) */}
        {isCropOverlayActive && zoom > 1 && (
          <div className="pointer-events-none absolute left-2 top-2 z-20 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white/90 shadow-md backdrop-blur-sm">
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
              <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-primary bg-card/90 px-6 py-5 shadow-lg">
                <UploadCloud className="size-7 text-primary" />
                <span className="text-sm font-semibold text-foreground">Drop to replace</span>
                <span className="text-xs text-muted-foreground/70">PNG JPEG WebP up to 50MB</span>
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
          <span className="min-w-[2.5rem] text-center text-xs font-medium text-white/60">
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

      {/* Inline Magic Brush toggle / toolbar — only shown in remove mode with an
          image loaded and not during processing. When not in brush mode, shows a
          single "Manual brush" button. When in brush mode, shows the full toolbar
          (brush size slider, Clear, Apply, Cancel). */}
      {mode === 'remove' && originalImage && !isProcessing && (
        isBrushMode ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card/80 px-2.5 py-1.5 shadow-sm backdrop-blur-sm">
            <Paintbrush className="size-3.5 shrink-0 text-primary/70" />
            <span className="hidden text-xs text-muted-foreground/70 sm:inline">
              Paint over the watermark to remove
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="tabular-nums text-xs font-medium text-muted-foreground/60">
                {brushSize}px
              </span>
              <input
                type="range"
                min="5"
                max="80"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="h-1 w-20 accent-primary sm:w-24"
                aria-label="Brush size"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={clearBrushCanvas}
              className="h-7 gap-1 rounded-md px-2 text-sm"
              title="Clear mask"
              aria-label="Clear mask"
            >
              <Eraser className="size-3" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={applyBrushMask}
              className="h-7 gap-1 rounded-md px-2 text-sm"
              title="Apply mask and remove watermark"
              aria-label="Apply mask and remove watermark"
            >
              <Check className="size-3" />
              Apply
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={cancelBrushMode}
              className="h-7 gap-1 rounded-md px-2 text-sm"
              title="Cancel brush mode"
              aria-label="Cancel brush mode"
            >
              <X className="size-3" />
              <span className="hidden sm:inline">Cancel</span>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={enterBrushMode}
              className="h-7 gap-1.5 rounded-lg text-xs"
              title="Manually paint over the watermark"
              aria-label="Manually paint over the watermark"
            >
              <Paintbrush className="size-3.5" />
              Manual brush
            </Button>
            <span className="hidden text-xs text-muted-foreground/50 sm:inline">
              Paint over the watermark to remove it manually
            </span>
          </div>
        )
      )}
    </motion.div>
  )
}
