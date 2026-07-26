import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());

    const { optimizeImage, bufferToDataUrl } = await import("@/lib/image-processing");

    const format = (formData.get("format") as string) || "png";
    const quality = parseInt(formData.get("quality") as string) || 90;
    const maxWidth = parseInt(formData.get("maxWidth") as string) || 4096;
    const maxHeight = parseInt(formData.get("maxHeight") as string) || 4096;

    const result = await optimizeImage(imageBuffer, {
      quality,
      format: format as "jpeg" | "png" | "webp" | "avif",
      maxWidth,
      maxHeight,
    });

    const mimeType = format === "jpeg" ? "image/jpeg" : format === "webp" ? "image/webp" : format === "avif" ? "image/avif" : "image/png";
    const dataUrl = bufferToDataUrl(result.buffer, mimeType);

    return NextResponse.json({
      success: true,
      result: {
        dataUrl,
        originalSize: result.originalSize,
        optimizedSize: result.optimizedSize,
        compressionRatio: ((1 - result.optimizedSize / result.originalSize) * 100).toFixed(1),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Optimization error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
