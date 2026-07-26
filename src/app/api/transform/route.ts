import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());

    const { transformImage, bufferToDataUrl, getImageInfo } = await import("@/lib/image-processing");

    const options = {
      rotation: parseInt(formData.get("rotation") as string) || 0,
      flipH: formData.get("flipH") === "true",
      flipV: formData.get("flipV") === "true",
    };

    const resultBuffer = await transformImage(imageBuffer, options);

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
    console.error("Transform error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
