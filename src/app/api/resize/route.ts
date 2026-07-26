import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const metadata = await sharp(imageBuffer).metadata();
    const imgWidth = metadata.width!;
    const imgHeight = metadata.height!;

    // Parse resize parameters
    const width = parseInt(formData.get("width") as string) || imgWidth;
    const height = parseInt(formData.get("height") as string) || imgHeight;
    const mode = (formData.get("mode") as string) || "fit"; // fit | fill | stretch | exact
    const format = (formData.get("format") as string) || null; // png | jpeg | webp | avif

    // Clamp dimensions to reasonable bounds
    const MIN_DIM = 16;
    const MAX_DIM = 8192;
    const targetWidth = Math.max(MIN_DIM, Math.min(width, MAX_DIM));
    const targetHeight = Math.max(MIN_DIM, Math.min(height, MAX_DIM));

    // Determine sharp fit mode
    let fit: sharp.FitEnum[keyof sharp.FitEnum];
    switch (mode) {
      case "fill":
        fit = "cover";
        break;
      case "stretch":
        fit = "fill";
        break;
      case "exact":
        fit = "outside";
        break;
      case "fit":
        fit = "inside";
        break;
      default:
        fit = "inside";
    }

    // For "exact" mode, we don't want to preserve aspect ratio
    // sharp's "outside" fit still preserves aspect ratio, so for true exact
    // we use "fill" (which ignores aspect ratio) with force resize
    const resizeOptions: sharp.ResizeOptions = {
      fit,
      withoutEnlargement: true, // Don't upscale
    };

    // "stretch" and "exact" modes should ignore aspect ratio
    if (mode === "stretch" || mode === "exact") {
      resizeOptions.fit = mode === "stretch" ? "fill" : "fill";
    }

    // Build the sharp pipeline: resize first, then optionally convert format
    let pipeline = sharp(imageBuffer, { failOn: "none" })
      .resize(targetWidth, targetHeight, resizeOptions);

    // Determine output format and MIME type
    // If no explicit format specified (or "same"), preserve original format as PNG
    const FORMAT_MAP: Record<string, { mime: string; sharpFormat: keyof sharp.FormatEnum }> = {
      png: { mime: "image/png", sharpFormat: "png" },
      jpeg: { mime: "image/jpeg", sharpFormat: "jpeg" },
      webp: { mime: "image/webp", sharpFormat: "webp" },
      avif: { mime: "image/avif", sharpFormat: "avif" },
    };

    let outputMime = "image/png";

    if (format && FORMAT_MAP[format]) {
      const target = FORMAT_MAP[format];
      outputMime = target.mime;

      // Apply format conversion with appropriate options
      switch (format) {
        case "png":
          pipeline = pipeline.png({ quality: 100 });
          break;
        case "jpeg":
          pipeline = pipeline.jpeg({ quality: 90 });
          break;
        case "webp":
          pipeline = pipeline.webp({ quality: 90 });
          break;
        case "avif":
          pipeline = pipeline.avif({ quality: 80 });
          break;
      }
    } else {
      // Default: output as PNG (lossless)
      pipeline = pipeline.png({ quality: 100 });
    }

    const resultBuffer = await pipeline.toBuffer();

    const resultMeta = await sharp(resultBuffer).metadata();
    const size = resultBuffer.byteLength;
    const dataUrl = `data:${outputMime};base64,${resultBuffer.toString("base64")}`;

    return NextResponse.json({
      success: true,
      result: {
        dataUrl,
        width: resultMeta.width ?? targetWidth,
        height: resultMeta.height ?? targetHeight,
        size,
        format: outputMime,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Resize error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
