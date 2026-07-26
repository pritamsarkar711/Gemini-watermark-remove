'use client'

import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, X, Sparkles, Shield, Zap, Eye, Lock } from 'lucide-react'
import { useAppStore, type ImageInfo } from '@/lib/store'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 50 * 1024 * 1024

const TRUST_ITEMS = [
  { icon: Shield, label: '256-bit SSL' },
  { icon: Zap, label: 'Under 5s' },
  { icon: Eye, label: 'Zero residue' },
  { icon: Lock, label: 'Private' },
]

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
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20 animated-border">
            <Sparkles className="size-8 text-primary" />
          </div>
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-2xl bg-primary/5"
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
        <div className="flex flex-col items-center gap-0.5">
          <h1 className="gradient-text text-3xl font-bold tracking-tight">Zeminai</h1>
          <p className="text-sm text-muted-foreground/70">Watermark remover</p>
          <span className="text-[10px] font-medium text-primary/50">Powered by AI</span>
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
            rounded-2xl border-2 border-dashed transition-all duration-300
            w-full aspect-[4/3]
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
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.03] via-transparent to-primary/[0.04] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          {/* Dot grid pattern behind the upload zone */}
          <div className="absolute inset-0 rounded-2xl dot-grid-bg opacity-30" />

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
                <span className="text-xs font-medium text-muted-foreground/70">Reading image...</span>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                animate={isDragging ? { scale: 1.15, y: -6 } : { scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="flex flex-col items-center gap-3"
              >
                <div className={`
                  flex size-12 items-center justify-center rounded-xl transition-all duration-300
                  ${isDragging
                    ? 'bg-primary/15 shadow-md shadow-primary/20'
                    : 'bg-muted/60 group-hover:bg-muted'
                  }
                `}>
                  <Upload className={`size-5 transition-colors duration-300 ${isDragging ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground/60'}`} />
                </div>

                <div className="flex flex-col items-center gap-1">
                  <span className="text-base font-semibold text-foreground">
                    {isDragging ? 'Release' : 'Drop image'}
                  </span>
                  {!isDragging && (
                    <span className="text-[11px] text-muted-foreground/60">
                      or click to browse
                    </span>
                  )}
                  <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary/70">PNG</span>
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary/70">JPEG</span>
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary/70">WebP</span>
                    <span className="text-[10px] text-muted-foreground/70">up to 50MB</span>
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
            className="flex items-center justify-center gap-1.5 rounded-full border bg-primary/5 px-2.5 py-1.5 shadow-sm hover:bg-primary/10 transition-colors"
          >
            <item.icon className="size-3 text-primary/80" />
            <span className="text-[11px] font-semibold text-muted-foreground/80">{item.label}</span>
          </motion.div>
        ))}
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
