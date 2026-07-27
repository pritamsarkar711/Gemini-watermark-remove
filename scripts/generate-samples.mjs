/**
 * Generate demo sample images for the Zeminai Watermark Remover home page.
 *
 * Produces 3 PNG files in /home/z/my-project/public/samples/:
 *   - sample-portrait.png  (600x800, portrait, "Zeminai" watermark bottom-right)
 *   - sample-landscape.png (800x600, landscape, "Sample" watermark top-right)
 *   - sample-text.png      (800x600, tiled "DRAFT" watermark pattern)
 *
 * Uses the `canvas` package (already installed). Run with:
 *   bun run scripts/generate-samples.mjs
 *
 * Design goals:
 *   - Each image has a colorful gradient + simple shapes so the inpainting
 *     algorithm has rich local context to reconstruct from.
 *   - Watermarks are clearly visible but semi-transparent (mimicking real
 *     photo watermarks) so the auto-detect path can pick them up.
 */

import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const OUT_DIR = join(__dirname, '..', 'public', 'samples')

// Ensure output directory exists.
mkdirSync(OUT_DIR, { recursive: true })

/**
 * Draw a vibrant multi-stop diagonal gradient background.
 * @param {import('canvas').CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 * @param {string[]} stops
 */
function drawGradientBg(ctx, w, h, stops) {
  const grad = ctx.createLinearGradient(0, 0, w, h)
  stops.forEach((color, i) => grad.addColorStop(i / (stops.length - 1), color))
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
}

/**
 * Draw scattered translucent circles for visual texture.
 * @param {import('canvas').CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 */
function drawShapes(ctx, w, h) {
  const colors = [
    'rgba(255, 255, 255, 0.18)',
    'rgba(255, 255, 255, 0.10)',
    'rgba(0, 0, 0, 0.10)',
    'rgba(255, 220, 120, 0.20)',
  ]
  // Use a deterministic seed so output is reproducible.
  let seed = 1337
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  for (let i = 0; i < 14; i++) {
    const r = 30 + rand() * Math.min(w, h) * 0.18
    const x = rand() * w
    const y = rand() * h
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = colors[i % colors.length]
    ctx.fill()
  }
}

/**
 * Add a soft drop-shadow stroke around text so it pops on any background.
 * @param {import('canvas').CanvasRenderingContext2D} ctx
 */
function withShadow(ctx) {
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetX = 2
  ctx.shadowOffsetY = 2
}

function clearShadow(ctx) {
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
}

// ─── Sample 1: Portrait with "Zeminai" watermark in bottom-right ────────────

function makePortrait() {
  const W = 600
  const H = 800
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  drawGradientBg(ctx, W, H, ['#f6d365', '#fda085', '#ef5d9c', '#7b2ff7'])
  drawShapes(ctx, W, H)

  // Subtle "subject" silhouette — a stylized sun + horizon to make it feel
  // like a real photo rather than just colored noise.
  ctx.fillStyle = 'rgba(255, 240, 200, 0.85)'
  ctx.beginPath()
  ctx.arc(W / 2, H * 0.42, 90, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(40, 20, 60, 0.55)'
  ctx.fillRect(0, H * 0.62, W, H * 0.38)

  // Watermark — "Zeminai" in bottom-right with semi-translucent white + shadow.
  ctx.globalAlpha = 0.85
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 38px sans-serif'
  ctx.textBaseline = 'bottom'
  ctx.textAlign = 'right'
  withShadow(ctx)
  ctx.fillText('Zeminai', W - 28, H - 28)
  clearShadow(ctx)
  ctx.globalAlpha = 1

  writePng(canvas, 'sample-portrait.png')
}

// ─── Sample 2: Landscape with "Sample" watermark in top-right ───────────────

function makeLandscape() {
  const W = 800
  const H = 600
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  drawGradientBg(ctx, W, H, ['#a1c4fd', '#c2e9fb', '#84fab0', '#8fd3f4'])
  drawShapes(ctx, W, H)

  // Stylized mountain + sun composition.
  ctx.fillStyle = 'rgba(255, 230, 130, 0.9)'
  ctx.beginPath()
  ctx.arc(W * 0.78, H * 0.28, 70, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(60, 80, 110, 0.7)'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(W * 0.25, H * 0.55)
  ctx.lineTo(W * 0.5, H * 0.75)
  ctx.lineTo(W * 0.72, H * 0.45)
  ctx.lineTo(W, H * 0.7)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()

  // Watermark — "Sample" top-right.
  ctx.globalAlpha = 0.85
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 34px sans-serif'
  ctx.textBaseline = 'top'
  ctx.textAlign = 'right'
  withShadow(ctx)
  ctx.fillText('Sample', W - 28, 28)
  clearShadow(ctx)
  ctx.globalAlpha = 1

  writePng(canvas, 'sample-landscape.png')
}

// ─── Sample 3: Tiled "DRAFT" watermark pattern ──────────────────────────────

function makeTextTile() {
  const W = 800
  const H = 600
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  drawGradientBg(ctx, W, H, ['#4facfe', '#00f2fe', '#43e97b', '#38f9d7'])
  drawShapes(ctx, W, H)

  // Tiled diagonal "DRAFT" watermark repeated across the whole image.
  ctx.save()
  ctx.translate(W / 2, H / 2)
  ctx.rotate((-30 * Math.PI) / 180)
  ctx.translate(-W / 2, -H / 2)

  ctx.globalAlpha = 0.35
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 48px sans-serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  withShadow(ctx)

  const stepX = 280
  const stepY = 140
  // Cover a region larger than the canvas so rotation doesn't leave gaps.
  for (let y = -100; y < H + 100; y += stepY) {
    // Offset alternate rows for a classic tiled-watermark look.
    const xOff = (Math.floor(y / stepY) % 2 === 0) ? 0 : stepX / 2
    for (let x = -100; x < W + 100; x += stepX) {
      ctx.fillText('DRAFT', x + xOff, y)
    }
  }
  clearShadow(ctx)
  ctx.globalAlpha = 1
  ctx.restore()

  writePng(canvas, 'sample-text.png')
}

/**
 * Write the canvas to OUT_DIR/<name>.
 * @param {import('canvas').Canvas} canvas
 * @param {string} name
 */
function writePng(canvas, name) {
  const buf = canvas.toBuffer('image/png')
  const path = join(OUT_DIR, name)
  writeFileSync(path, buf)
  console.log(`  ✓ wrote ${path} (${(buf.length / 1024).toFixed(1)} KB, ${canvas.width}x${canvas.height})`)
}

console.log('Generating sample images…')
makePortrait()
makeLandscape()
makeTextTile()
console.log('Done.')
