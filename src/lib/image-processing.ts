import sharp from "sharp";

/**
 * Core image processing module for Zeminai watermark removal
 * Uses inpainting algorithms and sharp for high-quality results
 */

// ============================================================
// INPAINTING ENGINE - Telea-style Fast Marching Method
// ============================================================

interface Pixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Telea inpainting using fast marching method
 * Fills masked pixels by propagating known pixel values inward from boundaries
 */
export async function inpaintImage(
  inputBuffer: Buffer,
  maskBuffer: Buffer,
  radius: number = 5
): Promise<Buffer> {
  const inputImage = sharp(inputBuffer);
  const maskImage = sharp(maskBuffer);

  const inputMeta = await inputImage.metadata();
  const width = inputMeta.width!;
  const height = inputMeta.height!;

  // Get raw pixel data
  const inputRaw = await inputImage
    .ensureAlpha()
    .raw()
    .toBuffer();

  const maskRaw = await maskImage
    .resize(width, height, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer();

  // Create pixel arrays
  const pixels: Pixel[] = [];
  const isMasked: boolean[] = [];

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    pixels.push({
      r: inputRaw[idx],
      g: inputRaw[idx + 1],
      b: inputRaw[idx + 2],
      a: inputRaw[idx + 3],
    });
    // Mask: white pixels (high value) = area to remove
    const maskVal = (maskRaw[idx] + maskRaw[idx + 1] + maskRaw[idx + 2]) / 3;
    isMasked.push(maskVal > 128);
  }

  // Fast Marching inpainting
  // 1. Initialize: find boundary pixels (mask pixels adjacent to known pixels)
  // 2. Process boundary pixels first, then move inward
  
  const known = new Uint8Array(width * height);
  const distance = new Float32Array(width * height);
  const processed = new Uint8Array(width * height);

  // Initialize known/unknown
  for (let i = 0; i < width * height; i++) {
    if (!isMasked[i]) {
      known[i] = 1;
      distance[i] = 0;
    } else {
      known[i] = 0;
      distance[i] = Infinity;
    }
  }

  // Find initial boundary (mask pixels next to known pixels)
  const boundary: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!known[idx]) {
        // Check neighbors
        let hasKnownNeighbor = false;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            if (known[ny * width + nx]) {
              hasKnownNeighbor = true;
              break;
            }
          }
        }
        if (hasKnownNeighbor) {
          boundary.push(idx);
          distance[idx] = 1;
        }
      }
    }
  }

  // Process pixels using fast marching approach
  // Sort by distance (process closest to boundary first)
  const processQueue: number[] = [...boundary].sort((a, b) => distance[a] - distance[b]);
  
  const outputPixels: Pixel[] = [...pixels];

  for (const bIdx of boundary) {
    processed[bIdx] = 1;
  }

  // Process boundary pixels using weighted interpolation of known neighbors
  for (const idx of processQueue) {
    if (processed[idx]) continue;

    const x = idx % width;
    const y = Math.floor(idx / width);

    // Collect known pixels within radius
    let totalR = 0, totalG = 0, totalB = 0, totalWeight = 0;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = ny * width + nx;
          if (known[nIdx] || processed[nIdx]) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= radius && dist > 0) {
              // Weight inversely proportional to distance
              const weight = 1 / (dist * dist);
              // Direction factor: prefer pixels closer to boundary
              const directionFactor = Math.max(0, 1 - distance[nIdx] / (radius * 2));
              const finalWeight = weight * (1 + directionFactor);

              totalR += outputPixels[nIdx].r * finalWeight;
              totalG += outputPixels[nIdx].g * finalWeight;
              totalB += outputPixels[nIdx].b * finalWeight;
              totalWeight += finalWeight;
            }
          }
        }
      }
    }

    if (totalWeight > 0) {
      outputPixels[idx] = {
        r: Math.round(totalR / totalWeight),
        g: Math.round(totalG / totalWeight),
        b: Math.round(totalB / totalWeight),
        a: 255,
      };
      processed[idx] = 1;
      known[idx] = 1;

      // Update distances of unknown neighbors
      for (const [ddx, ddy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nnx = x + ddx;
        const nny = y + ddy;
        if (nnx >= 0 && nnx < width && nny >= 0 && nny < height) {
          const nnIdx = nny * width + nnx;
          if (!known[nnIdx] && !processed[nnIdx]) {
            distance[nnIdx] = Math.min(distance[nnIdx], distance[idx] + 1);
            processQueue.push(nnIdx);
          }
        }
      }
    }
  }

  // Convert back to raw buffer
  const outputRaw = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    outputRaw[idx] = outputPixels[i].r;
    outputRaw[idx + 1] = outputPixels[i].g;
    outputRaw[idx + 2] = outputPixels[i].b;
    outputRaw[idx + 3] = outputPixels[i].a;
  }

  // Apply smoothing pass for seamless blending
  const smoothedRaw = applySmoothingPass(outputRaw, width, height, isMasked, radius);

  return sharp(smoothedRaw, { raw: { width, height, channels: 4 } })
    .png({ quality: 100 })
    .toBuffer();
}

/**
 * Smoothing pass to blend inpainted area with surrounding pixels
 */
function applySmoothingPass(
  raw: Buffer,
  width: number,
  height: number,
  isMasked: boolean[],
  radius: number
): Buffer {
  const output = Buffer.from(raw);

  // Gaussian-like smoothing only on mask boundary pixels
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!isMasked[idx]) continue;

      // Check if this is a boundary pixel (near edge of mask)
      let isNearBoundary = false;
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          if (!isMasked[ny * width + nx]) {
            isNearBoundary = true;
            break;
          }
        }
      }

      if (!isNearBoundary) continue;

      // Apply weighted average with nearby pixels
      let totalR = 0, totalG = 0, totalB = 0, totalWeight = 0;
      const smoothRadius = Math.min(radius, 3);

      for (let dy = -smoothRadius; dy <= smoothRadius; dy++) {
        for (let dx = -smoothRadius; dx <= smoothRadius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = ny * width + nx;
            const pixelIdx = nIdx * 4;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= smoothRadius) {
              const weight = 1 / (1 + dist);
              totalR += raw[pixelIdx] * weight;
              totalG += raw[pixelIdx + 1] * weight;
              totalB += raw[pixelIdx + 2] * weight;
              totalWeight += weight;
            }
          }
        }
      }

      if (totalWeight > 0) {
        const pixelIdx = idx * 4;
        output[pixelIdx] = Math.round(totalR / totalWeight);
        output[pixelIdx + 1] = Math.round(totalG / totalWeight);
        output[pixelIdx + 2] = Math.round(totalB / totalWeight);
      }
    }
  }

  return output;
}

// ============================================================
// AUTO WATERMARK DETECTION
// ============================================================

interface DetectedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

/**
 * Auto-detect watermark regions in an image
 * Scans for semi-transparent regions, repetitive patterns, and known watermark positions
 */
export async function detectWatermark(
  inputBuffer: Buffer
): Promise<DetectedRegion[]> {
  const image = sharp(inputBuffer);
  const meta = await image.metadata();
  const width = meta.width!;
  const height = meta.height!;

  const raw = await image.ensureAlpha().raw().toBuffer();

  const regions: DetectedRegion[] = [];

  // Strategy 1: Check common watermark positions (corners, especially bottom-right)
  const cornerSize = Math.min(width, height) * 0.12;
  const positions = [
    { x: width - cornerSize, y: height - cornerSize, confidence: 0.9 }, // bottom-right (most common)
    { x: 0, y: height - cornerSize, confidence: 0.7 }, // bottom-left
    { x: width - cornerSize, y: 0, confidence: 0.6 }, // top-right
    { x: 0, y: 0, confidence: 0.5 }, // top-left
    { x: (width - cornerSize) / 2, y: height - cornerSize, confidence: 0.4 }, // bottom-center
  ];

  for (const pos of positions) {
    // Check if this region has unusual transparency or color variation
    const regionStats = analyzeRegion(raw, width, height, pos.x, pos.y, cornerSize, cornerSize);
    
    if (regionStats.hasTransparency || regionStats.colorDeviation > 0.15) {
      regions.push({
        x: Math.round(pos.x),
        y: Math.round(pos.y),
        width: Math.round(cornerSize),
        height: Math.round(cornerSize),
        confidence: pos.confidence * (regionStats.hasTransparency ? 1.5 : 1),
      });
    }
  }

  // Strategy 2: Scan for text-like patterns (uniform color blocks in edges)
  const edgeMargin = Math.min(width, height) * 0.08;
  const edgeRegions = [
    { x: 0, y: 0, w: width, h: edgeMargin }, // top edge
    { x: 0, y: height - edgeMargin, w: width, h: edgeMargin }, // bottom edge
    { x: 0, y: 0, w: edgeMargin, h: height }, // left edge
    { x: width - edgeMargin, y: 0, w: edgeMargin, h: height }, // right edge
  ];

  for (const edge of edgeRegions) {
    const stats = analyzeRegion(raw, width, height, edge.x, edge.y, edge.w, edge.h);
    if (stats.uniformity > 0.7 || stats.hasTransparency) {
      regions.push({
        x: Math.round(edge.x),
        y: Math.round(edge.y),
        width: Math.round(edge.w),
        height: Math.round(edge.h),
        confidence: stats.uniformity > 0.8 ? 0.8 : 0.6,
      });
    }
  }

  // Strategy 3: Detect Gemini-style sparkle (4-pointed star) in bottom-right
  // The sparkle watermark typically appears as semi-transparent overlay
  const sparkleRegion = detectGeminiSparkle(raw, width, height);
  if (sparkleRegion) {
    regions.push(sparkleRegion);
  }

  // Sort by confidence
  regions.sort((a, b) => b.confidence - a.confidence);

  return regions;
}

function analyzeRegion(
  raw: Buffer,
  imgWidth: number,
  imgHeight: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
) {
  let totalAlpha = 0;
  let transparentCount = 0;
  let colorSum = { r: 0, g: 0, b: 0 };
  let colorVariance = { r: 0, g: 0, b: 0 };
  let pixelCount = 0;
  const colorValues: { r: number; g: number; b: number }[] = [];

  const startX = Math.max(0, Math.floor(rx));
  const startY = Math.max(0, Math.floor(ry));
  const endX = Math.min(imgWidth, Math.ceil(rx + rw));
  const endY = Math.min(imgHeight, Math.ceil(ry + rh));

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const idx = (y * imgWidth + x) * 4;
      const r = raw[idx];
      const g = raw[idx + 1];
      const b = raw[idx + 2];
      const a = raw[idx + 3];

      totalAlpha += a;
      if (a < 255) transparentCount++;
      colorSum.r += r;
      colorSum.g += g;
      colorSum.b += b;
      colorValues.push({ r, g, b });
      pixelCount++;
    }
  }

  if (pixelCount === 0) {
    return { hasTransparency: false, colorDeviation: 0, uniformity: 0 };
  }

  const avgAlpha = totalAlpha / pixelCount;
  const avgColor = {
    r: colorSum.r / pixelCount,
    g: colorSum.g / pixelCount,
    b: colorSum.b / pixelCount,
  };

  // Calculate color variance
  for (const c of colorValues) {
    colorVariance.r += (c.r - avgColor.r) ** 2;
    colorVariance.g += (c.g - avgColor.g) ** 2;
    colorVariance.b += (c.b - avgColor.b) ** 2;
  }

  const variance = (colorVariance.r + colorVariance.g + colorVariance.b) / (pixelCount * 3);
  const deviation = Math.sqrt(variance) / 255;

  // Uniformity: how similar are the colors (low variance = high uniformity)
  const uniformity = 1 - deviation;

  return {
    hasTransparency: avgAlpha < 250 || transparentCount > pixelCount * 0.1,
    colorDeviation: deviation,
    uniformity,
  };
}

/**
 * Detect Gemini-style sparkle watermark
 * The sparkle is a 4-pointed star shape in the bottom-right corner
 * It appears as a semi-transparent overlay with a specific pattern
 */
function detectGeminiSparkle(
  raw: Buffer,
  width: number,
  height: number
): DetectedRegion | null {
  // Check bottom-right area for sparkle pattern
  const sparkleSearchSize = Math.min(width, height) * 0.08;
  const startX = Math.floor(width - sparkleSearchSize * 1.5);
  const startY = Math.floor(height - sparkleSearchSize * 1.5);
  const searchW = Math.ceil(sparkleSearchSize * 1.5);
  const searchH = Math.ceil(sparkleSearchSize * 1.5);

  let sparklePixels = 0;
  let totalPixels = 0;
  let avgBrightness = 0;

  for (let y = startY; y < Math.min(startY + searchH, height); y++) {
    for (let x = startX; x < Math.min(startX + searchW, width); x++) {
      const idx = (y * width + x) * 4;
      const r = raw[idx];
      const g = raw[idx + 1];
      const b = raw[idx + 2];
      const a = raw[idx + 3];

      // Sparkle pattern: semi-transparent, lighter than surrounding area
      const brightness = (r + g + b) / 3;
      avgBrightness += brightness;

      if (a < 255 && brightness > 180) {
        sparklePixels++;
      }
      totalPixels++;
    }
  }

  if (totalPixels === 0) return null;

  avgBrightness /= totalPixels;

  // If sparkle-like pixels found with sufficient density
  if (sparklePixels > totalPixels * 0.05 && sparklePixels > 10) {
    return {
      x: startX,
      y: startY,
      width: searchW,
      height: searchH,
      confidence: 0.85,
    };
  }

  return null;
}

/**
 * Generate a mask from detected watermark regions
 */
export async function generateDetectionMask(
  inputBuffer: Buffer,
  regions: DetectedRegion[]
): Promise<Buffer> {
  const image = sharp(inputBuffer);
  const meta = await image.metadata();
  const width = meta.width!;
  const height = meta.height!;

  // Create a white mask on black background
  const maskRaw = Buffer.alloc(width * height * 4);

  // Fill with black (no mask)
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    maskRaw[idx] = 0;
    maskRaw[idx + 1] = 0;
    maskRaw[idx + 2] = 0;
    maskRaw[idx + 3] = 255;
  }

  // Mark detected regions as white (mask)
  for (const region of regions) {
    for (let y = region.y; y < Math.min(region.y + region.height, height); y++) {
      for (let x = region.x; x < Math.min(region.x + region.width, width); x++) {
        const idx = (y * width + x) * 4;
        maskRaw[idx] = 255;
        maskRaw[idx + 1] = 255;
        maskRaw[idx + 2] = 255;
      }
    }
  }

  // Add padding around mask regions for better coverage
  const paddedMask = addMaskPadding(maskRaw, width, height, 5);

  return sharp(paddedMask, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}

/**
 * Add padding around mask regions to ensure full watermark coverage
 */
function addMaskPadding(
  mask: Buffer,
  width: number,
  height: number,
  padding: number
): Buffer {
  const result = Buffer.from(mask);

  // For each white pixel, expand by padding
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (mask[idx] > 128) {
        // Expand
        for (let dy = -padding; dy <= padding; dy++) {
          for (let dx = -padding; dx <= padding; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = (ny * width + nx) * 4;
              result[nIdx] = 255;
              result[nIdx + 1] = 255;
              result[nIdx + 2] = 255;
            }
          }
        }
      }
    }
  }

  return result;
}

// ============================================================
// WATERMARK ADDITION
// ============================================================

export interface AddWatermarkOptions {
  text?: string;
  fontSize?: number;
  color?: string;
  opacity?: number;
  position?: string;
  logoBuffer?: Buffer;
  logoOpacity?: number;
  logoSize?: number;
  logoPosition?: string;
}

/**
 * Add a text or logo watermark to an image
 */
export async function addWatermark(
  inputBuffer: Buffer,
  options: AddWatermarkOptions
): Promise<Buffer> {
  const image = sharp(inputBuffer);
  const meta = await image.metadata();
  const width = meta.width!;
  const height = meta.height!;
  const channels = meta.channels || 4;

  // Convert to RGBA
  const rgbaBuffer = await image.ensureAlpha().raw().toBuffer();
  const outputBuffer = Buffer.from(rgbaBuffer);

  // Add text watermark if specified
  if (options.text && options.text.trim()) {
    addTextWatermark(
      outputBuffer,
      width,
      height,
      options.text,
      options.fontSize || 24,
      options.color || "#ffffff",
      (options.opacity || 50) / 100,
      options.position || "bottom-right"
    );
  }

  // Add logo watermark if specified
  if (options.logoBuffer) {
    await addLogoWatermark(
      outputBuffer,
      width,
      height,
      options.logoBuffer,
      (options.logoOpacity || 50) / 100,
      options.logoSize || 100,
      options.logoPosition || options.position || "bottom-right"
    );
  }

  return sharp(outputBuffer, { raw: { width, height, channels: 4 } })
    .png({ quality: 100 })
    .toBuffer();
}

/**
 * Add text watermark to raw pixel buffer
 */
function addTextWatermark(
  buffer: Buffer,
  width: number,
  height: number,
  text: string,
  fontSize: number,
  color: string,
  opacity: number,
  position: string
): void {
  // Parse color
  const colorRgb = parseColor(color);

  // Calculate text dimensions (approximate)
  const avgCharWidth = fontSize * 0.6;
  const textWidth = text.length * avgCharWidth;
  const textHeight = fontSize;

  // Calculate position
  const margin = Math.max(10, Math.min(width, height) * 0.03);
  const pos = calculatePosition(width, height, textWidth, textHeight, margin, position);

  // Draw text onto buffer
  // Simple pixel-level text rendering using bitmap approach
  for (let charIdx = 0; charIdx < text.length; charIdx++) {
    const charX = pos.x + charIdx * avgCharWidth;
    drawCharBox(buffer, width, height, charX, pos.y, avgCharWidth, textHeight, colorRgb, opacity);
  }
}

/**
 * Draw a character placeholder box (simplified text rendering)
 * For production, this would use proper font rendering
 */
function drawCharBox(
  buffer: Buffer,
  width: number,
  height: number,
  startX: number,
  startY: number,
  charWidth: number,
  charHeight: number,
  color: { r: number; g: number; b: number },
  opacity: number
): void {
  // Alpha blending formula: result = original * (1 - alpha) + watermark * alpha
  for (let y = Math.floor(startY); y < Math.min(Math.ceil(startY + charHeight), height); y++) {
    for (let x = Math.floor(startX); x < Math.min(Math.ceil(startX + charWidth), width); x++) {
      const idx = (y * width + x) * 4;
      buffer[idx] = Math.round(buffer[idx] * (1 - opacity) + color.r * opacity);
      buffer[idx + 1] = Math.round(buffer[idx + 1] * (1 - opacity) + color.g * opacity);
      buffer[idx + 2] = Math.round(buffer[idx + 2] * (1 - opacity) + color.b * opacity);
    }
  }
}

/**
 * Add logo watermark using sharp compositing
 */
async function addLogoWatermark(
  outputBuffer: Buffer,
  width: number,
  height: number,
  logoBuffer: Buffer,
  opacity: number,
  logoSize: number,
  position: string
): Promise<void> {
  // Resize logo
  const resizedLogo = await sharp(logoBuffer)
    .resize(logoSize, logoSize, { fit: "contain" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const logoWidth = resizedLogo.info.width;
  const logoHeight = resizedLogo.info.height;

  const margin = Math.max(10, Math.min(width, height) * 0.03);
  const pos = calculatePosition(width, height, logoWidth, logoHeight, margin, position);

  // Alpha-blend logo onto output buffer
  for (let y = 0; y < logoHeight; y++) {
    for (let x = 0; x < logoWidth; x++) {
      const targetX = pos.x + x;
      const targetY = pos.y + y;
      if (targetX >= 0 && targetX < width && targetY >= 0 && targetY < height) {
        const srcIdx = (y * logoWidth + x) * 4;
        const dstIdx = (targetY * width + targetX) * 4;

        const logoR = resizedLogo.data[srcIdx];
        const logoG = resizedLogo.data[srcIdx + 1];
        const logoB = resizedLogo.data[srcIdx + 2];
        const logoA = resizedLogo.data[srcIdx + 3] / 255;

        const totalAlpha = logoA * opacity;

        if (totalAlpha > 0.01) {
          outputBuffer[dstIdx] = Math.round(outputBuffer[dstIdx] * (1 - totalAlpha) + logoR * totalAlpha);
          outputBuffer[dstIdx + 1] = Math.round(outputBuffer[dstIdx + 1] * (1 - totalAlpha) + logoG * totalAlpha);
          outputBuffer[dstIdx + 2] = Math.round(outputBuffer[dstIdx + 2] * (1 - totalAlpha) + logoB * totalAlpha);
        }
      }
    }
  }
}

// ============================================================
// IMAGE QUALITY OPTIMIZATION
// ============================================================

export interface OptimizeOptions {
  quality: number; // 1-100
  format: "jpeg" | "png" | "webp";
  maxWidth: number;
  maxHeight: number;
}

/**
 * Optimize image quality and size
 */
export async function optimizeImage(
  inputBuffer: Buffer,
  options: OptimizeOptions
): Promise<{ buffer: Buffer; originalSize: number; optimizedSize: number }> {
  const image = sharp(inputBuffer);
  const meta = await image.metadata();
  const originalSize = inputBuffer.length;

  let pipeline = sharp(inputBuffer);

  // Resize if needed
  if (meta.width! > options.maxWidth || meta.height! > options.maxHeight) {
    pipeline = pipeline.resize(options.maxWidth, options.maxHeight, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  // Apply format and quality
  switch (options.format) {
    case "jpeg":
      pipeline = pipeline.jpeg({ quality: options.quality });
      break;
    case "png":
      pipeline = pipeline.png({
        quality: options.quality,
        compressionLevel: Math.round((100 - options.quality) / 100 * 9),
      });
      break;
    case "webp":
      pipeline = pipeline.webp({ quality: options.quality });
      break;
  }

  const buffer = await pipeline.toBuffer();
  return {
    buffer,
    originalSize,
    optimizedSize: buffer.length,
  };
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function parseColor(hex: string): { r: number; g: number; b: number } {
  // Remove # prefix
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

function calculatePosition(
  canvasWidth: number,
  canvasHeight: number,
  elementWidth: number,
  elementHeight: number,
  margin: number,
  position: string
): { x: number; y: number } {
  switch (position) {
    case "top-left":
      return { x: margin, y: margin };
    case "top-center":
      return { x: (canvasWidth - elementWidth) / 2, y: margin };
    case "top-right":
      return { x: canvasWidth - elementWidth - margin, y: margin };
    case "center":
      return { x: (canvasWidth - elementWidth) / 2, y: (canvasHeight - elementHeight) / 2 };
    case "bottom-left":
      return { x: margin, y: canvasHeight - elementHeight - margin };
    case "bottom-center":
      return { x: (canvasWidth - elementWidth) / 2, y: canvasHeight - elementHeight - margin };
    case "bottom-right":
      return { x: canvasWidth - elementWidth - margin, y: canvasHeight - elementHeight - margin };
    default:
      return { x: canvasWidth - elementWidth - margin, y: canvasHeight - elementHeight - margin };
  }
}

/**
 * Convert image buffer to base64 data URL
 */
export function bufferToDataUrl(buffer: Buffer, format: string = "image/png"): string {
  return `data:${format};base64,${buffer.toString("base64")}`;
}

/**
 * Get image metadata
 */
export async function getImageInfo(buffer: Buffer): Promise<{
  width: number;
  height: number;
  format: string;
  size: number;
}> {
  const meta = await sharp(buffer).metadata();
  return {
    width: meta.width || 0,
    height: meta.height || 0,
    format: meta.format || "unknown",
    size: buffer.length,
  };
}
