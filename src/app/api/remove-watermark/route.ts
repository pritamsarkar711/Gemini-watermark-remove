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
    const { inpaintImage, detectWatermark, generateDetectionMask, bufferToDataUrl, getImageInfo } = await import("@/lib/image-processing");

    let maskBuffer: Buffer;

    if (autoDetect && !maskFile) {
      // Auto-detect watermark regions
      const regions = await detectWatermark(imageBuffer);
      
      if (regions.length === 0) {
        // No watermark detected - try broader detection
        // Check bottom-right area with a larger scan
        const imageInfo = await getImageInfo(imageBuffer);
        const fallbackRegions = [{
          x: Math.floor(imageInfo.width * 0.78),
          y: Math.floor(imageInfo.height * 0.78),
          width: Math.floor(imageInfo.width * 0.22),
          height: Math.floor(imageInfo.height * 0.22),
          confidence: 0.5,
        }];
        maskBuffer = await generateDetectionMask(imageBuffer, fallbackRegions);
      } else {
        maskBuffer = await generateDetectionMask(imageBuffer, regions);
      }
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

    return NextResponse.json({
      success: true,
      result: {
        dataUrl,
        width: info.width,
        height: info.height,
        size: info.size,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Watermark removal error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
