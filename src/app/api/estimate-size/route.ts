import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/estimate-size
 *
 * Estimates the output file size of an image after applying the same
 * sharp pipeline used by /api/optimize (resize → format → quality),
 * WITHOUT returning the encoded image data. This avoids the costly
 * base64 round-trip and makes the endpoint fast (< 200ms for typical
 * images) so the UI can call it on every QualityConfig change.
 *
 * FormData fields:
 *   - image:    File (required)
 *   - format:   'jpeg' | 'png' | 'webp'  (default 'png')
 *   - quality:  number 1..100            (default 90)
 *   - maxWidth:  number                  (default 4096)
 *   - maxHeight: number                  (default 4096)
 *
 * Response (success):
 *   { success: true, estimatedSize: number, format: string, width: number, height: number }
 *
 * Response (error):
 *   { success: false, error: string }
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile) {
      return NextResponse.json(
        { success: false, error: "No image provided" },
        { status: 400 }
      );
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());

    // Import sharp directly to keep this route lightweight and independent
    // of the heavier image-processing module (no canvas / inpainting code).
    const sharp = (await import("sharp")).default;

    const format = (formData.get("format") as string) || "png";
    const quality = Math.max(
      1,
      Math.min(100, parseInt(formData.get("quality") as string) || 90)
    );
    const maxWidth = Math.max(
      1,
      parseInt(formData.get("maxWidth") as string) || 4096
    );
    const maxHeight = Math.max(
      1,
      parseInt(formData.get("maxHeight") as string) || 4096
    );

    // Read metadata first to know whether a resize is needed.
    const meta = await sharp(imageBuffer).metadata();
    const originalWidth = meta.width || 0;
    const originalHeight = meta.height || 0;

    let pipeline = sharp(imageBuffer);

    // Resize if the source exceeds the configured max dimensions.
    if (
      originalWidth > maxWidth ||
      originalHeight > maxHeight
    ) {
      pipeline = pipeline.resize(maxWidth, maxHeight, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    // Apply the same format/quality options as /api/optimize so the
    // estimate matches what the user will actually download.
    switch (format) {
      case "jpeg":
        pipeline = pipeline.jpeg({ quality, mozjpeg: true });
        break;
      case "png":
        pipeline = pipeline.png({
          quality,
          compressionLevel: Math.round(((100 - quality) / 100) * 9),
          palette: quality < 80,
        });
        break;
      case "webp":
        pipeline = pipeline.webp({ quality });
        break;
      default:
        return NextResponse.json(
          { success: false, error: `Unsupported format: ${format}` },
          { status: 400 }
        );
    }

    // Encode to buffer purely to measure its byte length. We deliberately
    // do NOT convert to a dataUrl — that would be ~33% larger via base64
    // and slow. The size returned here is the raw encoded byte count.
    const buffer = await pipeline.toBuffer();

    // Read the resulting dimensions so the UI can show them if desired.
    const resultMeta = await sharp(buffer).metadata();

    return NextResponse.json({
      success: true,
      estimatedSize: buffer.length,
      format,
      width: resultMeta.width || 0,
      height: resultMeta.height || 0,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Estimate-size error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
