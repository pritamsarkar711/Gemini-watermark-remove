'use client'

import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { Download, FileText, Loader2, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/lib/store'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export default function DownloadPanel() {
  const { processedImage, originalImage, outputFileName, setOutputFileName, qualityConfig } = useAppStore()
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [optimizedDataUrl, setOptimizedDataUrl] = useState<string | null>(null)
  const [optimizedSize, setOptimizedSize] = useState<number | null>(null)
  const [compressionRatio, setCompressionRatio] = useState<string | null>(null)

  const handleDownload = useCallback(() => {
    const dataUrl = optimizedDataUrl || processedImage?.dataUrl
    if (!dataUrl) return

    const format = qualityConfig.format
    const ext = format === 'jpeg' ? 'jpg' : format === 'webp' ? 'webp' : 'png'

    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `${outputFileName || 'processed'}.${ext}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [optimizedDataUrl, processedImage, outputFileName, qualityConfig.format])

  const handleOptimize = useCallback(async () => {
    if (!originalImage) return

    setIsOptimizing(true)
    try {
      const formData = new FormData()
      formData.append('image', originalImage.file)
      formData.append('format', qualityConfig.format)
      formData.append('quality', String(qualityConfig.quality))
      formData.append('maxWidth', String(qualityConfig.maxWidth))
      formData.append('maxHeight', String(qualityConfig.maxHeight))

      const res = await fetch('/api/optimize', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (data.success) {
        setOptimizedDataUrl(data.result.dataUrl)
        setOptimizedSize(data.result.optimizedSize)
        setCompressionRatio(data.result.compressionRatio)
      }
    } catch (err) {
      console.error('Optimization failed:', err)
    } finally {
      setIsOptimizing(false)
    }
  }, [originalImage, qualityConfig])

  if (!processedImage) return null

  const downloadSize = optimizedSize || processedImage.size

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-2.5"
    >
      {/* Filename */}
      <div className="flex items-center gap-2 rounded-md border bg-card p-2.5">
        <FileText className="size-3.5 text-muted-foreground" />
        <Input
          value={outputFileName}
          onChange={(e) => setOutputFileName(e.target.value)}
          className="h-6 text-xs flex-1"
        />
      </div>

      {/* Optimize */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleOptimize}
        disabled={isOptimizing}
        className="gap-1.5 h-7 text-xs self-start"
      >
        {isOptimizing ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Minimize2 className="size-3" />
        )}
        {isOptimizing ? 'Optimizing' : 'Optimize'}
      </Button>

      {compressionRatio && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[10px] text-muted-foreground/50"
        >
          {Number(compressionRatio) > 0 ? `${compressionRatio}% smaller` : `Original quality preserved`}
        </motion.div>
      )}

      {/* Download */}
      <Button
        size="default"
        onClick={handleDownload}
        className="w-full gap-1.5 rounded-lg font-semibold h-9"
      >
        <Download className="size-3.5" />
        Download
        <span className="text-[10px] opacity-60">{formatBytes(downloadSize)}</span>
      </Button>
    </motion.div>
  )
}
