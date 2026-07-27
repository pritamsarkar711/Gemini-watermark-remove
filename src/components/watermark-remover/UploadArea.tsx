'use client'

import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, X, Eraser, Shield, Zap, Eye, Lock, Scan, Paintbrush, Image as ImageIcon } from 'lucide-react'
import { useAppStore, type ImageInfo } from '@/lib/store'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 50 * 1024 * 1024

const TRUST_ITEMS = [
  { icon: Shield, label: '256-bit SSL' },
  { icon: Zap, label: 'Under 5s' },
  { icon: Eye, label: 'Zero residue' },
  { icon: Lock, label: 'Private' },
]

/**
 * Built-in demo samples shown on the upload screen. Clicking a chip fetches
 * the corresponding static PNG from /samples/ and loads it into the store as
 * if the user had uploaded it themselves — letting new visitors try the
 * watermark-removal flow without having their own image handy.
 */
const SAMPLES = [
  { name: 'portrait', label: 'Portrait', src: '/samples/sample-portrait.png' },
  { name: 'landscape', label: 'Landscape', src: '/samples/sample-landscape.png' },
  { name: 'text', label: 'Tiled Text', src: '/samples/sample-text.png' },
] as const

export default function UploadArea() {
  const { setOriginalImage } = useAppStore()
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isReading, setIsReading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(
    async (file: File) => {
      setError(null)

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError('JPEG PNG WebP only')
        return
      }

      if (file.size > MAX_SIZE) {
        setError('Max 50MB')
        return
      }

      setIsReading(true)
      try {
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
          setIsReading(false)
        }
        img.onerror = () => setIsReading(false)
        img.src = dataUrl
      } catch (err) {
        console.error('Failed to read file:', err)
        setIsReading(false)
      }
    },
    [setOriginalImage]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    [processFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
    },
    [processFile]
  )

  /**
   * Fetch a built-in demo sample from /samples/, wrap it in a File, and load
   * it into the store via setOriginalImage — exactly the same path as a normal
   * upload. Reuses the isReading spinner state for consistent UX.
   */
  const loadSample = useCallback(
    async (sampleName: string) => {
      setError(null)
      setIsReading(true)
      try {
        const response = await fetch(`/samples/sample-${sampleName}.png`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const blob = await response.blob()
        const file = new File([blob], `sample-${sampleName}.png`, { type: 'image/png' })
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(file)
        })
        const img = new Image()
        img.onload = () => {
          const imageInfo: ImageInfo = {
            file,
            name: `sample-${sampleName}.png`,
            originalName: `sample-${sampleName}.png`,
            width: img.naturalWidth,
            height: img.naturalHeight,
            size: file.size,
            type: 'image/png',
            dataUrl,
          }
          setOriginalImage(imageInfo)
          setIsReading(false)
        }
        img.onerror = () => {
          console.error('Failed to decode sample image')
          setIsReading(false)
        }
        img.src = dataUrl
      } catch (err) {
        console.error('Failed to load sample:', err)
        setError('Could not load sample')
        setIsReading(false)
      }
    },
    [setOriginalImage]
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex w-full max-w-md flex-col items-center gap-5"
    >
      {/* Hero section */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex flex-col items-center gap-3"
      >
        <div className="relative">
          <div className="flex size-20 items-center justify-center rounded-lg bg-primary/10 ring-2 ring-primary/10 animated-border">
            <Eraser className="size-9 text-primary" />
          </div>
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-lg bg-primary/5"
          />
          {/* Magic sparkle floating particles */}
          {[0, 1, 2, 3].map((i) => (
            <motion.span
              key={i}
              className={`float-particle absolute size-1.5 rounded-full bg-primary/60 ${[
                'left-0 top-0',
                'right-0 top-0',
                'left-0 bottom-0',
                'right-0 bottom-0',
              ][i]}`}
              style={{ animationDelay: `${i * 0.6}s` }}
            />
          ))}
        </div>
        <div className="flex flex-col items-center gap-1">
          <h1 className="gradient-text text-4xl font-extrabold tracking-tight">Gemini Watermark</h1>
          <p className="text-sm font-semibold text-foreground/80">Remover</p>
        </div>
      </motion.div>

      {/* Upload zone */}
      <motion.div
        whileHover={{ scale: 1.01 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="w-full"
      >
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !isReading && inputRef.current?.click()}
          className={`
            group relative flex cursor-pointer flex-col items-center justify-center
            rounded-lg border-2 border-dashed border-primary/30 transition-all duration-300
            w-full aspect-[4/3] shadow-inner upload-inner-glow
            ${isDragging
              ? 'border-primary bg-primary/5 scale-[1.02] upload-area-active shadow-lg shadow-primary/10'
              : 'animated-border hover:bg-muted/30 hover:shadow-sm'
            }
            ${isReading ? 'pointer-events-none' : ''}
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleInputChange}
            className="hidden"
          />

          {/* Subtle background gradient pattern */}
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/[0.03] via-transparent to-primary/[0.04] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          {/* Dot grid pattern behind the upload zone */}
          <div className="absolute inset-0 rounded-lg dot-grid-bg opacity-30" />

          <AnimatePresence mode="wait">
            {isReading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3"
              >
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="size-2 rounded-full bg-primary"
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.1, 0.85] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
                    />
                  ))}
                </div>
                <span className="text-xs font-medium text-muted-foreground">Reading image...</span>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                animate={isDragging ? { scale: 1.15, y: -6 } : { scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="flex flex-col items-center gap-3"
              >
                <div className={`
                  flex size-12 items-center justify-center rounded-lg transition-all duration-300
                  ${isDragging
                    ? 'bg-primary/15 shadow-md shadow-primary/20'
                    : 'bg-muted/60 group-hover:bg-muted'
                  }
                `}>
                  <Upload className={`size-5 transition-colors duration-300 ${isDragging ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground/60'}`} />
                </div>

                <div className="flex flex-col items-center gap-1">
                  <span className="text-base font-bold text-foreground">
                    {isDragging ? 'Release to upload' : 'Drop image'}
                  </span>
                  {!isDragging && (
                    <span className="text-sm font-medium text-muted-foreground">
                      or click to browse
                    </span>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
                    <span className="rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary">PNG</span>
                    <span className="rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary">JPEG</span>
                    <span className="rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary">WebP</span>
                    <span className="text-xs font-medium text-muted-foreground">· up to 50MB</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Trust badges — 2x2 grid on mobile, single row on sm+ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="grid grid-cols-2 gap-2 w-full sm:flex sm:flex-wrap sm:items-center sm:justify-center"
      >
        {TRUST_ITEMS.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.5 + i * 0.1 }}
            whileHover={{ y: -2 }}
            className="flex items-center justify-center gap-1.5 rounded-full border border-border/60 bg-card/80 px-2.5 py-2 shadow-sm hover:shadow-md hover:border-primary/30 hover:bg-primary/5 transition-all"
          >
            <item.icon className="size-3.5 text-primary" />
            <span className="text-sm font-semibold text-foreground/80">{item.label}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* How It Works — 3-step visual guide */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="grid grid-cols-3 gap-3 w-full max-w-md"
      >
        {[
          { step: 1, icon: Upload, title: 'Upload', desc: 'Drop your image' },
          { step: 2, icon: Scan, title: 'Detect', desc: 'AI finds watermark' },
          { step: 3, icon: Paintbrush, title: 'Remove', desc: 'Seamless cleanup' },
        ].map((item, idx) => (
          <motion.div
            key={item.step}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.7 + item.step * 0.1 }}
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-card/70 p-3 shadow-sm hover:shadow-lg hover:bg-card hover:border-primary/40 transition-all group relative overflow-hidden"
          >
            {/* Subtle gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            <span className="step-badge absolute -top-2.5 -left-2.5 z-10">{item.step}</span>
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/15 group-hover:bg-primary/20 group-hover:ring-primary/40 group-hover:scale-110 transition-all">
              <item.icon className="size-4 text-primary group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-xs font-bold text-foreground/90 group-hover:text-foreground transition-colors">{item.title}</span>
            <span className="text-xs font-medium text-muted-foreground">{item.desc}</span>
            {/* Hidden arrow connector showing progression */}
            {idx < 2 && (
              <div className="hidden sm:block absolute -right-2.5 top-1/2 -translate-y-1/2 z-20 size-3 rounded-full bg-border/80 ring-2 ring-background" />
            )}
          </motion.div>
        ))}
      </motion.div>

      {/* Try with a sample — lets new visitors experience the flow without uploading */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.8 }}
        className="flex w-full max-w-md flex-col items-center gap-3"
      >
        <span className="flex w-full items-center gap-3 text-xs font-bold uppercase tracking-wider text-muted-foreground
          before:content-[''] before:h-px before:flex-1 before:bg-gradient-to-r before:from-transparent before:to-border/80
          after:content-[''] after:h-px after:flex-1 after:bg-gradient-to-l after:from-transparent after:to-border/80">
          or try with a sample
        </span>
        <div className="grid w-full grid-cols-3 gap-2">
          {SAMPLES.map((sample, i) => (
            <motion.button
              key={sample.name}
              type="button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.9 + i * 0.08 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              disabled={isReading}
              onClick={() => loadSample(sample.name)}
              aria-label={`Try the ${sample.label.toLowerCase()} sample image`}
              className="group flex cursor-pointer flex-col rounded-lg border border-border/60 bg-card/70 p-2 shadow-sm transition-all hover:shadow-md hover:border-primary/30 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
                <img
                  src={sample.src}
                  alt={`${sample.label} sample preview`}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/0 opacity-0 transition-opacity duration-200 group-hover:bg-background/30 group-hover:opacity-100">
                  <ImageIcon className="size-4 text-foreground/80 drop-shadow" />
                </div>
              </div>
              <span className="mt-1.5 text-center text-xs font-semibold text-foreground/80">{sample.label}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-1.5 text-xs text-destructive"
          >
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-destructive/70 hover:text-destructive">
              <X className="size-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
