import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "لم يتم اختيار الملف" },
        { status: 400 }
      );
    }

    const isImage = file.type.startsWith("image/");
    const subFolder = isImage ? "images" : "videos";

    const uploadsDir = path.join(process.cwd(), "public", "uploads", subFolder);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const ext = path.extname(file.name) || (isImage ? ".jpg" : ".mp4");
    const safeBase = path
      .basename(file.name, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 40);
    const prefix = isImage ? "img" : "vid";
    const fileName = `${prefix}_${Date.now()}_${safeBase || "media"}${ext}`;
    const filePath = path.join(uploadsDir, fileName);

    const webStream = file.stream();
    const nodeStream = Readable.fromWeb(webStream as any);
    const writeStream = fs.createWriteStream(filePath);
    await pipeline(nodeStream, writeStream);

    const publicUrl = `/uploads/${subFolder}/${fileName}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      videoUrl: publicUrl,
      fileName: file.name,
    });
  } catch (err) {
    console.error("Media upload error:", err);
    return NextResponse.json(
      { error: "حدث خطأ أثناء رفع الملف" },
      { status: 500 }
    );
  }
}
