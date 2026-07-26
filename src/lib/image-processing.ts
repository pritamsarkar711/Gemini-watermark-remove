import sharp from "sharp";
import { createCanvas, loadImage, registerFont } from "canvas";
import path from "path";
import fs from "fs";

/**
 * Core image processing module for Zeminai watermark removal
 * Uses inpainting algorithms and sharp for high-quality results
 * Enhanced with proper text rendering via canvas, better detection,
 * and SVG-based Gemini sparkle template
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
 * Inpaint image using fast marching method with multi-pass approach
 * for higher quality reconstruction
 */
export async function inpaintImage(
  inputBuffer: Buffer,
  maskBuffer: Buffer,
  radius: number = 8
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

  // Multi-pass inpainting for better quality
  // Pass 1: Initial reconstruction with larger radius for context
  let outputPixels = await inpaintPass(pixels, isMasked, width, height, radius * 2);

  // Pass 2: Refinement with smaller radius for detail
  outputPixels = await inpaintPass(outputPixels, isMasked, width, height, radius);

  // Pass 3: Smoothing on boundary for seamless blending
  const smoothedPixels = applyBoundarySmoothing(outputPixels, isMasked, width, height, 3);

  // Convert back to raw buffer
  const outputRaw = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    outputRaw[idx] = smoothedPixels[i].r;
    outputRaw[idx + 1] = smoothedPixels[i].g;
    outputRaw[idx + 2] = smoothedPixels[i].b;
    outputRaw[idx + 3] = smoothedPixels[i].a;
  }

  return sharp(outputRaw, { raw: { width, height, channels: 4 } })
    .png({ quality: 100 })
    .toBuffer();
}

/**
 * Single inpainting pass using fast marching with binary min-heap
 * Optimized from O(n²) to O(n log n) using a proper priority queue
 */

// ─── Min-Heap Priority Queue ──────────────────────────────────────────────────
// Stores entries as [pixelIndex, distance] pairs, ordered by distance (min first).

class MinHeap {
  private heap: [number, number][] = []; // [pixelIndex, distance]
  private inHeap: Set<number> = new Set(); // fast membership check

  get size(): number {
    return this.heap.length;
  }

  has(pixelIndex: number): boolean {
    return this.inHeap.has(pixelIndex);
  }

  push(pixelIndex: number, dist: number): void {
    this.heap.push([pixelIndex, dist]);
    this.inHeap.add(pixelIndex);
    this._bubbleUp(this.heap.length - 1);
  }

  pop(): [number, number] | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    this.inHeap.delete(top[0]);
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  private _bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.heap[parent][1] <= this.heap[i][1]) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  private _sinkDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.heap[left][1] < this.heap[smallest][1]) smallest = left;
      if (right < n && this.heap[right][1] < this.heap[smallest][1]) smallest = right;
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}

async function inpaintPass(
  pixels: Pixel[],
  isMasked: boolean[],
  width: number,
  height: number,
  radius: number
): Promise<Pixel[]> {
  const totalPixels = width * height;
  const known = new Uint8Array(totalPixels);
  const distance = new Float32Array(totalPixels);
  const processed = new Uint8Array(totalPixels);
  const outputPixels: Pixel[] = [...pixels];

  // Initialize known/unknown
  for (let i = 0; i < totalPixels; i++) {
    if (!isMasked[i]) {
      known[i] = 1;
      distance[i] = 0;
    } else {
      known[i] = 0;
      distance[i] = Infinity;
    }
  }

  // Find initial boundary and push into min-heap
  const heap = new MinHeap();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!known[idx]) {
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
          distance[idx] = 1;
          heap.push(idx, 1);
        }
      }
    }
  }

  // Process using fast marching with min-heap (O(n log n) instead of O(n²))
  while (heap.size > 0) {
    const entry = heap.pop();
    if (!entry) break;
    const idx = entry[0];

    // Skip if already processed (can happen if pixel was added multiple times)
    if (processed[idx]) continue;

    const x = idx % width;
    const y = Math.floor(idx / width);

    // Collect known pixels within radius using weighted interpolation
    let totalR = 0, totalG = 0, totalB = 0, totalWeight = 0;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = ny * width + nx;
          // Use known pixels OR already-processed (reconstructed) pixels
          if (known[nIdx] || processed[nIdx]) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= radius && dist > 0) {
              // Inverse distance weighting
              const weight = 1 / Math.pow(dist, 2);
              // Direction preference: pixels closer to boundary get extra weight
              const directionFactor = Math.max(0.1, 1 - distance[nIdx] / (radius * 2));
              const finalWeight = weight * directionFactor;

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

      // Update distances of unknown neighbors and push into heap
      for (const [ddx, ddy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nnx = x + ddx;
        const nny = y + ddy;
        if (nnx >= 0 && nnx < width && nny >= 0 && nny < height) {
          const nnIdx = nny * width + nnx;
          if (!known[nnIdx] && !processed[nnIdx] && !heap.has(nnIdx)) {
            distance[nnIdx] = Math.min(distance[nnIdx], distance[idx] + 1);
            heap.push(nnIdx, distance[nnIdx]);
          }
        }
      }
    }
  }

  return outputPixels;
}

/**
 * Apply boundary smoothing for seamless blending
 * Only smooths pixels at the boundary of mask regions
 */
function applyBoundarySmoothing(
  pixels: Pixel[],
  isMasked: boolean[],
  width: number,
  height: number,
  radius: number
): Pixel[] {
  const output: Pixel[] = [...pixels];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!isMasked[idx]) continue;

      // Check if this is a boundary pixel
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

      // Apply Gaussian-like smoothing
      let totalR = 0, totalG = 0, totalB = 0, totalWeight = 0;

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = ny * width + nx;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= radius) {
              // Gaussian weight
              const sigma = radius / 2;
              const weight = Math.exp(-(dist * dist) / (2 * sigma * sigma));
              totalR += pixels[nIdx].r * weight;
              totalG += pixels[nIdx].g * weight;
              totalB += pixels[nIdx].b * weight;
              totalWeight += weight;
            }
          }
        }
      }

      if (totalWeight > 0) {
        output[idx] = {
          r: Math.round(totalR / totalWeight),
          g: Math.round(totalG / totalWeight),
          b: Math.round(totalB / totalWeight),
          a: 255,
        };
      }
    }
  }

  return output;
}

// ============================================================
// AUTO WATERMARK DETECTION (IMPROVED)
// ============================================================

interface DetectedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

/**
 * Improved watermark detection
 * Scans for semi-transparent regions, brightness anomalies in corners,
 * and known watermark patterns (Gemini sparkle, text logos)
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

  // Strategy 1: Corner-based detection with brightness anomaly analysis
  // Watermarks typically appear in corners as brighter or different-colored patches
  // Use large search area (30% of min dimension) to ensure we catch the full watermark
  const cornerSize = Math.min(width, height) * 0.30;
  const corners = [
    { x: width - cornerSize, y: height - cornerSize, name: 'bottom-right', confidence: 0.95 },
    { x: 0, y: height - cornerSize, name: 'bottom-left', confidence: 0.7 },
    { x: width - cornerSize, y: 0, name: 'top-right', confidence: 0.65 },
    { x: 0, y: 0, name: 'top-left', confidence: 0.55 },
  ];

  for (const corner of corners) {
    const regionStats = analyzeRegionDetailed(raw, width, height, corner.x, corner.y, cornerSize, cornerSize);

    // Detect watermark if region has high brightness variation or transparency
    if (regionStats.hasTransparency || regionStats.brightnessAnomaly > 0.12 || regionStats.colorDeviation > 0.18) {
      // Use the full corner region as the mask (more reliable than refining)
      // The inpainting algorithm will handle the non-watermark pixels gracefully
      regions.push({
        x: Math.round(corner.x),
        y: Math.round(corner.y),
        width: Math.round(cornerSize),
        height: Math.round(cornerSize),
        confidence: corner.confidence * (regionStats.hasTransparency ? 1.3 : 1),
      });
    }
  }

  // Strategy 2: Bottom edge scan (common for watermarks)
  const bottomStripHeight = Math.min(height * 0.12, 80);
  const bottomStripStats = analyzeRegionDetailed(raw, width, height, 0, height - bottomStripHeight, width, bottomStripHeight);
  if (bottomStripStats.brightnessAnomaly > 0.1) {
    // Use the full bottom strip as the mask region
    regions.push({
      x: 0,
      y: Math.round(height - bottomStripHeight),
      width: width,
      height: Math.round(bottomStripHeight),
      confidence: 0.75,
    });
  }

  // Strategy 3: Detect Gemini-style sparkle (4-pointed star)
  const sparkleRegion = detectGeminiSparkle(raw, width, height);
  if (sparkleRegion) {
    regions.push(sparkleRegion);
  }

  // Strategy 4: Detect text-like patterns (high contrast regions in corners)
  const textRegions = detectTextPatterns(raw, width, height);
  regions.push(...textRegions);

  // Deduplicate and merge overlapping regions
  let mergedRegions = mergeOverlappingRegions(regions);

  // Fallback: Always ensure the bottom-right corner is covered
  // This is the most common watermark position
  const hasBottomRightCoverage = mergedRegions.some(r =>
    r.x + r.width >= width * 0.85 && r.y + r.height >= height * 0.85
  );
  if (!hasBottomRightCoverage) {
    const fallbackSize = Math.min(width, height) * 0.20;
    mergedRegions.push({
      x: Math.round(width - fallbackSize),
      y: Math.round(height - fallbackSize),
      width: Math.round(fallbackSize),
      height: Math.round(fallbackSize),
      confidence: 0.5,
    });
  }

  // Sort by confidence
  mergedRegions.sort((a, b) => b.confidence - a.confidence);

  return mergedRegions;
}

/**
 * Detailed region analysis
 */
function analyzeRegionDetailed(
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
  let brightnessSum = 0;
  const colorValues: { r: number; g: number; b: number; brightness: number }[] = [];

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
      const brightness = (r + g + b) / 3;
      brightnessSum += brightness;
      colorValues.push({ r, g, b, brightness });
      pixelCount++;
    }
  }

  if (pixelCount === 0) {
    return { hasTransparency: false, colorDeviation: 0, uniformity: 0, brightnessAnomaly: 0 };
  }

  const avgAlpha = totalAlpha / pixelCount;
  const avgColor = {
    r: colorSum.r / pixelCount,
    g: colorSum.g / pixelCount,
    b: colorSum.b / pixelCount,
  };
  const avgBrightness = brightnessSum / pixelCount;

  // Calculate color variance
  let brightnessVarianceSum = 0;
  for (const c of colorValues) {
    colorVariance.r += (c.r - avgColor.r) ** 2;
    colorVariance.g += (c.g - avgColor.g) ** 2;
    colorVariance.b += (c.b - avgColor.b) ** 2;
    brightnessVarianceSum += (c.brightness - avgBrightness) ** 2;
  }

  const variance = (colorVariance.r + colorVariance.g + colorVariance.b) / (pixelCount * 3);
  const deviation = Math.sqrt(variance) / 255;
  const brightnessVariance = Math.sqrt(brightnessVarianceSum / pixelCount) / 255;
  const uniformity = 1 - deviation;

  return {
    hasTransparency: avgAlpha < 250 || transparentCount > pixelCount * 0.05,
    colorDeviation: deviation,
    uniformity,
    brightnessAnomaly: brightnessVariance,
    avgBrightness,
  };
}

/**
 * Refine the watermark region by finding the actual bounding box of anomalous pixels
 * Uses robust background sampling from OUTSIDE the search region
 */
function refineWatermarkRegion(
  raw: Buffer,
  imgWidth: number,
  imgHeight: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): { x: number; y: number; width: number; height: number } {
  // Sample background from OUTSIDE the search region to avoid contamination
  // Use a band around the search region
  const bandSize = Math.max(10, Math.min(imgWidth, imgHeight) * 0.03);
  const samplePoints: { x: number; y: number }[] = [];

  // Sample from left of region
  for (let y = Math.floor(ry); y < Math.min(ry + rh, imgHeight); y += Math.max(1, Math.floor(rh / 5))) {
    for (let x = Math.max(0, Math.floor(rx - bandSize)); x < Math.floor(rx); x += 3) {
      samplePoints.push({ x, y });
    }
  }
  // Sample from above region
  for (let x = Math.floor(rx); x < Math.min(rx + rw, imgWidth); x += Math.max(1, Math.floor(rw / 5))) {
    for (let y = Math.max(0, Math.floor(ry - bandSize)); y < Math.floor(ry); y += 3) {
      samplePoints.push({ x, y });
    }
  }
  // Sample from right of region
  for (let y = Math.floor(ry); y < Math.min(ry + rh, imgHeight); y += Math.max(1, Math.floor(rh / 5))) {
    for (let x = Math.min(imgWidth - 1, Math.floor(rx + rw)); x < Math.min(imgWidth, Math.floor(rx + rw + bandSize)); x += 3) {
      samplePoints.push({ x, y });
    }
  }

  let bgR = 0, bgG = 0, bgB = 0, validSamples = 0;
  for (const p of samplePoints) {
    if (p.x >= 0 && p.x < imgWidth && p.y >= 0 && p.y < imgHeight) {
      const idx = (p.y * imgWidth + p.x) * 4;
      bgR += raw[idx];
      bgG += raw[idx + 1];
      bgB += raw[idx + 2];
      validSamples++;
    }
  }

  if (validSamples === 0) {
    // Fallback: use center of image as background
    const cx = Math.floor(imgWidth / 2);
    const cy = Math.floor(imgHeight / 2);
    const idx = (cy * imgWidth + cx) * 4;
    bgR = raw[idx];
    bgG = raw[idx + 1];
    bgB = raw[idx + 2];
  } else {
    bgR /= validSamples;
    bgG /= validSamples;
    bgB /= validSamples;
  }

  // Find pixels that differ significantly from background
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let anomalousCount = 0;
  const threshold = 20; // color difference threshold (lowered for sensitivity)

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

      const colorDiff = Math.sqrt(
        (r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2
      );

      // Detect anomalies: pixels that differ from background OR have transparency
      if (colorDiff > threshold || a < 250) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        anomalousCount++;
      }
    }
  }

  if (anomalousCount === 0 || maxX < 0) {
    return { x: Math.floor(rx), y: Math.floor(ry), width: Math.floor(rw), height: Math.floor(rh) };
  }

  // Add generous padding to ensure full watermark coverage
  const padding = Math.max(8, Math.min(imgWidth, imgHeight) * 0.02);
  return {
    x: Math.max(0, Math.floor(minX - padding)),
    y: Math.max(0, Math.floor(minY - padding)),
    width: Math.min(imgWidth, Math.ceil(maxX - minX + padding * 2)),
    height: Math.min(imgHeight, Math.ceil(maxY - minY + padding * 2)),
  };
}

/**
 * Detect Gemini-style sparkle watermark (4-pointed star)
 */
function detectGeminiSparkle(
  raw: Buffer,
  width: number,
  height: number
): DetectedRegion | null {
  // Search bottom-right area for sparkle pattern
  // Use large search area (25% of min dimension) to ensure full watermark coverage
  const sparkleSearchSize = Math.min(width, height) * 0.25;
  const startX = Math.floor(width - sparkleSearchSize);
  const startY = Math.floor(height - sparkleSearchSize);
  const searchW = Math.ceil(sparkleSearchSize);
  const searchH = Math.ceil(sparkleSearchSize);

  let sparklePixels = 0;
  let totalPixels = 0;

  for (let y = startY; y < Math.min(startY + searchH, height); y++) {
    for (let x = startX; x < Math.min(startX + searchW, width); x++) {
      const idx = (y * width + x) * 4;
      const r = raw[idx];
      const g = raw[idx + 1];
      const b = raw[idx + 2];
      const a = raw[idx + 3];

      const brightness = (r + g + b) / 3;

      // Sparkle pattern: semi-transparent, lighter than surrounding area
      if ((a < 255 || brightness > 200) && brightness > 180) {
        sparklePixels++;
      }
      totalPixels++;
    }
  }

  if (totalPixels === 0) return null;

  // If sparkle-like pixels found with sufficient density
  if (sparklePixels > totalPixels * 0.03 && sparklePixels > 5) {
    // Use the full search region as the mask (more reliable)
    return {
      x: startX,
      y: startY,
      width: searchW,
      height: searchH,
      confidence: 0.9,
    };
  }

  return null;
}

/**
 * Detect text-like patterns in image corners
 * Looks for high-contrast regions that could be text watermarks
 */
function detectTextPatterns(
  raw: Buffer,
  width: number,
  height: number
): DetectedRegion[] {
  const regions: DetectedRegion[] = [];
  const cornerSize = Math.min(width, height) * 0.15;

  const corners = [
    { x: width - cornerSize, y: height - cornerSize, name: 'br' },
    { x: 0, y: height - cornerSize, name: 'bl' },
    { x: width - cornerSize, y: 0, name: 'tr' },
  ];

  for (const corner of corners) {
    // Compute local contrast in this region
    let contrastSum = 0;
    let pixelCount = 0;
    const blockX = Math.floor(corner.x);
    const blockY = Math.floor(corner.y);
    const blockW = Math.min(cornerSize, width - blockX);
    const blockH = Math.min(cornerSize, height - blockY);

    for (let y = blockY; y < blockY + blockH - 1; y++) {
      for (let x = blockX; x < blockX + blockW - 1; x++) {
        const idx = (y * width + x) * 4;
        const idxRight = (y * width + x + 1) * 4;
        const idxDown = ((y + 1) * width + x) * 4;

        const b1 = (raw[idx] + raw[idx + 1] + raw[idx + 2]) / 3;
        const b2 = (raw[idxRight] + raw[idxRight + 1] + raw[idxRight + 2]) / 3;
        const b3 = (raw[idxDown] + raw[idxDown + 1] + raw[idxDown + 2]) / 3;

        contrastSum += Math.abs(b1 - b2) + Math.abs(b1 - b3);
        pixelCount++;
      }
    }

    if (pixelCount === 0) continue;
    const avgContrast = contrastSum / pixelCount;

    // High contrast suggests text presence
    if (avgContrast > 20) {
      const refined = refineWatermarkRegion(raw, width, height, blockX, blockY, blockW, blockH);
      regions.push({
        x: refined.x,
        y: refined.y,
        width: refined.width,
        height: refined.height,
        confidence: 0.7,
      });
    }
  }

  return regions;
}

/**
 * Merge overlapping regions to avoid duplicate processing
 */
function mergeOverlappingRegions(regions: DetectedRegion[]): DetectedRegion[] {
  if (regions.length === 0) return regions;

  const merged: DetectedRegion[] = [];
  const used = new Array(regions.length).fill(false);

  for (let i = 0; i < regions.length; i++) {
    if (used[i]) continue;
    let current = { ...regions[i] };
    used[i] = true;

    for (let j = i + 1; j < regions.length; j++) {
      if (used[j]) continue;
      if (regionsOverlap(current, regions[j])) {
        current = mergeRegions(current, regions[j]);
        used[j] = true;
      }
    }

    merged.push(current);
  }

  return merged;
}

function regionsOverlap(a: DetectedRegion, b: DetectedRegion): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

function mergeRegions(a: DetectedRegion, b: DetectedRegion): DetectedRegion {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
    confidence: Math.max(a.confidence, b.confidence),
  };
}

/**
 * Generate a mask from detected watermark regions
 * Adds generous padding for full coverage
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

  // Add generous padding around mask regions for better coverage
  const padding = Math.max(8, Math.min(width, height) * 0.015);
  const paddedMask = addMaskPadding(maskRaw, width, height, Math.floor(padding));

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
// WATERMARK ADDITION (with proper text rendering via canvas)
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
  rotation?: number;
  shadow?: boolean;
  repeat?: boolean;
}

// Try to register fonts (will silently fail if not available)
let fontsRegistered = false;
function ensureFontsRegistered() {
  if (fontsRegistered) return;
  fontsRegistered = true;
  try {
    // Try common system font paths
    const fontPaths = [
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
      '/usr/share/fonts/TTF/DejaVuSans.ttf',
      '/System/Library/Fonts/Helvetica.ttc',
    ];
    for (const p of fontPaths) {
      if (fs.existsSync(p)) {
        try {
          registerFont(p, { family: 'ZeminaiSans', weight: 'normal' });
        } catch (e) {
          // ignore font registration errors
        }
      }
    }
  } catch (e) {
    // ignore
  }
}

/**
 * Add a text or logo watermark to an image using canvas for proper text rendering
 */
export async function addWatermark(
  inputBuffer: Buffer,
  options: AddWatermarkOptions
): Promise<Buffer> {
  ensureFontsRegistered();

  const image = sharp(inputBuffer);
  const meta = await image.metadata();
  const width = meta.width!;
  const height = meta.height!;

  // Convert to PNG buffer for canvas
  const pngBuffer = await image.png().toBuffer();
  const canvasImg = await loadImage(pngBuffer);

  // Create canvas with same dimensions
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Draw original image
  ctx.drawImage(canvasImg, 0, 0, width, height);

  // Add text watermark
  if (options.text && options.text.trim()) {
    drawTextWatermark(ctx, width, height, {
      text: options.text,
      fontSize: options.fontSize || 24,
      color: options.color || '#ffffff',
      opacity: (options.opacity || 50) / 100,
      position: options.position || 'bottom-right',
      rotation: options.rotation || 0,
      shadow: options.shadow ?? true,
      repeat: options.repeat || false,
    });
  }

  // Add logo watermark
  if (options.logoBuffer) {
    await drawLogoWatermark(ctx, width, height, {
      logoBuffer: options.logoBuffer,
      opacity: (options.logoOpacity || 50) / 100,
      size: options.logoSize || 100,
      position: options.logoPosition || options.position || 'bottom-right',
      rotation: options.rotation || 0,
    });
  }

  // Convert canvas back to buffer
  const outputBuffer = canvas.toBuffer('image/png');
  return outputBuffer;
}

interface TextWatermarkOptions {
  text: string;
  fontSize: number;
  color: string;
  opacity: number;
  position: string;
  rotation: number;
  shadow: boolean;
  repeat: boolean;
}

/**
 * Draw text watermark on canvas with proper font rendering
 */
function drawTextWatermark(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  canvasWidth: number,
  canvasHeight: number,
  options: TextWatermarkOptions
): void {
  ctx.save();

  // Set font - use canvas's default font with proper sizing
  const fontFamily = '"ZeminaiSans", "Arial", "Helvetica", sans-serif';
  ctx.font = `${options.fontSize}px ${fontFamily}`;
  ctx.textBaseline = 'top';

  // Measure text
  const metrics = ctx.measureText(options.text);
  const textWidth = metrics.width;
  const textHeight = options.fontSize * 1.2;

  // Set opacity
  ctx.globalAlpha = options.opacity;

  // Set shadow for better visibility
  if (options.shadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = Math.max(2, options.fontSize * 0.1);
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
  }

  // Set color
  ctx.fillStyle = options.color;

  if (options.repeat) {
    // Repeat watermark across entire image
    const spacingX = Math.max(textWidth * 2, 200);
    const spacingY = Math.max(textHeight * 3, 100);
    const rotationRad = (options.rotation || -30) * Math.PI / 180;

    for (let y = -spacingY; y < canvasHeight + spacingY; y += spacingY) {
      for (let x = -spacingX; x < canvasWidth + spacingX; x += spacingX) {
        ctx.save();
        ctx.translate(x + textWidth / 2, y + textHeight / 2);
        ctx.rotate(rotationRad);
        ctx.fillText(options.text, -textWidth / 2, -textHeight / 2);
        ctx.restore();
      }
    }
  } else {
    // Single watermark at specified position
    const margin = Math.max(10, Math.min(canvasWidth, canvasHeight) * 0.03);
    const pos = calculatePosition(canvasWidth, canvasHeight, textWidth, textHeight, margin, options.position);

    if (options.rotation !== 0) {
      ctx.translate(pos.x + textWidth / 2, pos.y + textHeight / 2);
      ctx.rotate(options.rotation * Math.PI / 180);
      ctx.fillText(options.text, -textWidth / 2, -textHeight / 2);
    } else {
      ctx.fillText(options.text, pos.x, pos.y);
    }
  }

  ctx.restore();
}

interface LogoWatermarkOptions {
  logoBuffer: Buffer;
  opacity: number;
  size: number;
  position: string;
  rotation: number;
}

/**
 * Draw logo watermark on canvas
 */
async function drawLogoWatermark(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  canvasWidth: number,
  canvasHeight: number,
  options: LogoWatermarkOptions
): Promise<void> {
  try {
    const logoImg = await loadImage(options.logoBuffer);

    // Calculate logo dimensions while maintaining aspect ratio
    const logoAspect = logoImg.width / logoImg.height;
    let logoW = options.size;
    let logoH = options.size / logoAspect;
    if (logoH > options.size) {
      logoH = options.size;
      logoW = options.size * logoAspect;
    }

    const margin = Math.max(10, Math.min(canvasWidth, canvasHeight) * 0.03);
    const pos = calculatePosition(canvasWidth, canvasHeight, logoW, logoH, margin, options.position);

    ctx.save();
    ctx.globalAlpha = options.opacity;

    if (options.rotation !== 0) {
      ctx.translate(pos.x + logoW / 2, pos.y + logoH / 2);
      ctx.rotate(options.rotation * Math.PI / 180);
      ctx.drawImage(logoImg, -logoW / 2, -logoH / 2, logoW, logoH);
    } else {
      ctx.drawImage(logoImg, pos.x, pos.y, logoW, logoH);
    }

    ctx.restore();
  } catch (e) {
    console.error('Logo watermark error:', e);
  }
}

// ============================================================
// IMAGE QUALITY OPTIMIZATION
// ============================================================

export interface OptimizeOptions {
  quality: number;
  format: "jpeg" | "png" | "webp" | "avif";
  maxWidth: number;
  maxHeight: number;
}

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
      pipeline = pipeline.jpeg({
        quality: options.quality,
        mozjpeg: true,
      });
      break;
    case "png":
      pipeline = pipeline.png({
        quality: options.quality,
        compressionLevel: Math.round((100 - options.quality) / 100 * 9),
        palette: options.quality < 80,
      });
      break;
    case "webp":
      pipeline = pipeline.webp({ quality: options.quality });
      break;
    case "avif":
      pipeline = pipeline.avif({ quality: options.quality });
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
// IMAGE TRANSFORMATIONS (NEW)
// ============================================================

export interface TransformOptions {
  rotation?: number; // 0, 90, 180, 270
  flipH?: boolean;
  flipV?: boolean;
  crop?: { x: number; y: number; width: number; height: number };
}

/**
 * Apply image transformations (rotation, flip, crop)
 */
export async function transformImage(
  inputBuffer: Buffer,
  options: TransformOptions
): Promise<Buffer> {
  let pipeline = sharp(inputBuffer);

  if (options.crop) {
    pipeline = pipeline.extract({
      left: Math.floor(options.crop.x),
      top: Math.floor(options.crop.y),
      width: Math.floor(options.crop.width),
      height: Math.floor(options.crop.height),
    });
  }

  if (options.flipH) {
    pipeline = pipeline.flip();
  }

  if (options.flipV) {
    pipeline = pipeline.flop();
  }

  if (options.rotation && options.rotation !== 0) {
    pipeline = pipeline.rotate(options.rotation);
  }

  return pipeline.png({ quality: 100 }).toBuffer();
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function parseColor(hex: string): { r: number; g: number; b: number } {
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
