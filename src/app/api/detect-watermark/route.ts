import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());

    const { detectWatermark, generateDetectionMask, bufferToDataUrl } = await import("@/lib/image-processing");

    const regions = await detectWatermark(imageBuffer);

    if (regions.length === 0) {
      return NextResponse.json({
        success: true,
        detected: false,
        regions: [],
        maskDataUrl: null,
      });
    }

    const maskBuffer = await generateDetectionMask(imageBuffer, regions);
    const maskDataUrl = bufferToDataUrl(maskBuffer);

    return NextResponse.json({
      success: true,
      detected: true,
      regions,
      maskDataUrl,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Watermark detection error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
