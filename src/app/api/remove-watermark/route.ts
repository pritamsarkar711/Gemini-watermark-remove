import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;
    const maskFile = formData.get("mask") as File | null;
    const autoDetect = formData.get("autoDetect") === "true";

    if (!imageFile) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());

    // Dynamic import to avoid bundling issues
    const {
      inpaintImage,
      detectWatermark,
      generateDetectionMask,
      bufferToDataUrl,
      getImageInfo,
      computeDetectionConfidence,
      computeDetectionBoundingRegion,
    } = await import("@/lib/image-processing");

    let maskBuffer: Buffer;
    // Only populated when autoDetect ran (i.e. autoDetect=true AND no manual
    // mask was supplied). When undefined, the field is omitted from the JSON
    // response entirely (JSON.stringify drops undefined values).
    let detectionConfidence: number | undefined;
    // Bounding box of the detected region(s). null when autoDetect did not
    // run (manual mask path) — per task spec cron9-feat-B.
    let detectionRegion: { x: number; y: number; width: number; height: number } | null = null;

    if (autoDetect && !maskFile) {
      // Auto-detect watermark regions
      const regions = await detectWatermark(imageBuffer);
      const imageInfo = await getImageInfo(imageBuffer);

      // Regions used for mask generation (fallback to a bottom-right scan
      // when nothing was detected so the inpainter still has something to
      // work with).
      const effectiveRegions = regions.length === 0
        ? [{
            x: Math.floor(imageInfo.width * 0.78),
            y: Math.floor(imageInfo.height * 0.78),
            width: Math.floor(imageInfo.width * 0.22),
            height: Math.floor(imageInfo.height * 0.22),
            confidence: 0.5,
          }]
        : regions;

      maskBuffer = await generateDetectionMask(imageBuffer, effectiveRegions);

      // Compute confidence + bounding box from the regions we actually
      // used (fallback regions count too — they represent our best guess).
      detectionConfidence = computeDetectionConfidence(
        effectiveRegions,
        imageInfo.width,
        imageInfo.height
      );
      detectionRegion = computeDetectionBoundingRegion(
        effectiveRegions,
        imageInfo.width,
        imageInfo.height
      );
    } else if (maskFile) {
      maskBuffer = Buffer.from(await maskFile.arrayBuffer());
    } else {
      return NextResponse.json({ error: "No mask provided and auto-detect is disabled" }, { status: 400 });
    }

    // Inpaint the watermark with larger radius for better reconstruction
    const inpaintingRadius = 12;
    const resultBuffer = await inpaintImage(imageBuffer, maskBuffer, inpaintingRadius);

    const dataUrl = bufferToDataUrl(resultBuffer);
    const info = await getImageInfo(resultBuffer);

    // ─── Pixel difference stats ────────────────────────────────────────────
    // Compare the original image and the inpainted result on a per-pixel
    // basis to surface "how much of the image actually changed" to the user.
    //
    // A pixel is considered "changed" if any of its RGB channels differs by
    // more than 3 levels (out of 255) between the original and the result.
    // The 3-level threshold ignores negligible resampling/rounding noise.
    //
    // Both images share the same dimensions (inpaintImage preserves them),
    // but we defensively resize both to the original's dimensions just in
    // case the implementation ever changes.
    let stats = { changedPixels: 0, totalPixels: 0, diffPercentage: 0 };
    try {
      const sharp = (await import("sharp")).default;
      const originalMeta = await sharp(imageBuffer).metadata();
      const origW = originalMeta.width || 0;
      const origH = originalMeta.height || 0;

      if (origW > 0 && origH > 0) {
        // Force both buffers to identical RGBA dimensions for a clean diff.
        const targetW = origW;
        const targetH = origH;

        const [origRaw, resultRaw] = await Promise.all([
          sharp(imageBuffer)
            .resize(targetW, targetH, { fit: "fill" })
            .ensureAlpha()
            .raw()
            .toBuffer(),
          sharp(resultBuffer)
            .resize(targetW, targetH, { fit: "fill" })
            .ensureAlpha()
            .raw()
            .toBuffer(),
        ]);

        const totalPixels = targetW * targetH;
        let changedPixels = 0;
        const len = Math.min(origRaw.length, resultRaw.length);
        // 4 channels per pixel (RGBA); step by 4.
        for (let i = 0; i + 3 < len; i += 4) {
          const dr = Math.abs(origRaw[i] - resultRaw[i]);
          const dg = Math.abs(origRaw[i + 1] - resultRaw[i + 1]);
          const db = Math.abs(origRaw[i + 2] - resultRaw[i + 2]);
          if (dr > 3 || dg > 3 || db > 3) {
            changedPixels++;
          }
        }

        const diffPercentage =
          totalPixels > 0
            ? Math.round((changedPixels / totalPixels) * 1000) / 10
            : 0;

        stats = { changedPixels, totalPixels, diffPercentage };
      }
    } catch (statsError) {
      // Stats are additive metadata — never let a failure here break the
      // main watermark-removal flow. Log and continue with zeroed stats.
      console.error(
        "Diff stats computation failed:",
        statsError instanceof Error ? statsError.message : statsError
      );
    }

    return NextResponse.json({
      success: true,
      result: {
        dataUrl,
        width: info.width,
        height: info.height,
        size: info.size,
      },
      stats,
      // Only present when autoDetect ran. JSON.stringify omits `undefined`,
      // so the field is dropped entirely from the wire response for the
      // manual-mask path (per task spec cron9-feat-B).
      detectionConfidence,
      // null when autoDetect did not run; bounding box of the detected
      // region(s) otherwise.
      detectionRegion,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Watermark removal error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
