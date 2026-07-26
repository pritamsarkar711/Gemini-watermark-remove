import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const metadata = await sharp(imageBuffer).metadata();
    const imgWidth = metadata.width!;
    const imgHeight = metadata.height!;

    let x = parseInt(formData.get("x") as string) || 0;
    let y = parseInt(formData.get("y") as string) || 0;
    let width = parseInt(formData.get("width") as string) || imgWidth;
    let height = parseInt(formData.get("height") as string) || imgHeight;

    // Clamp values to image bounds
    x = Math.max(0, Math.min(x, imgWidth - 1));
    y = Math.max(0, Math.min(y, imgHeight - 1));
    width = Math.max(1, Math.min(width, imgWidth - x));
    height = Math.max(1, Math.min(height, imgHeight - y));

    const resultBuffer = await sharp(imageBuffer)
      .extract({ left: x, top: y, width, height })
      .png({ quality: 100 })
      .toBuffer();

    const resultMeta = await sharp(resultBuffer).metadata();
    const size = resultBuffer.byteLength;
    const dataUrl = `data:image/png;base64,${resultBuffer.toString("base64")}`;

    return NextResponse.json({
      success: true,
      result: {
        dataUrl,
        width: resultMeta.width!,
        height: resultMeta.height!,
        size,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Crop error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
