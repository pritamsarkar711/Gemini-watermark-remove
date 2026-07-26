'use client'

import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, ImageIcon, X } from 'lucide-react'
import { useAppStore, type ImageInfo } from '@/lib/store'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 50 * 1024 * 1024

export default function UploadArea() {
  const { setOriginalImage, setStep } = useAppStore()
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
        setStep('preview')
      }
      img.src = dataUrl
    },
    [setOriginalImage, setStep]
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
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex w-full max-w-lg flex-col items-center gap-3"
    >
      {/* Main title */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex flex-col items-center gap-1 mb-4"
      >
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 mb-2">
          <ImageIcon className="size-6 text-primary" />
        </div>
        <span className="text-2xl font-semibold tracking-tight">Zeminai</span>
        <span className="text-xs text-muted-foreground/60">Watermark remover</span>
      </motion.div>

      {/* Upload zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`
          group relative flex cursor-pointer flex-col items-center justify-center
          rounded-2xl border-2 border-dashed transition-all duration-300
          w-full aspect-[4/3]
          ${isDragging
            ? 'border-primary bg-primary/5 scale-[1.02] upload-area-active'
            : 'border-border hover:border-primary/40 hover:bg-muted/30'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleInputChange}
          className="hidden"
        />

        <motion.div
          animate={isDragging ? { scale: 1.15, y: -8 } : { scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="flex flex-col items-center gap-2.5"
        >
          <div className={`
            flex size-12 items-center justify-center rounded-xl transition-colors duration-300
            ${isDragging ? 'bg-primary/15' : 'bg-muted/60'}
          `}>
            <Upload className={`size-5 transition-colors duration-300 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <span className="text-sm font-medium text-foreground/80">
              {isDragging ? 'Release' : 'Drop image'}
            </span>
            <span className="text-[11px] text-muted-foreground/50">
              PNG JPEG WebP
            </span>
          </div>
        </motion.div>
      </div>

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
