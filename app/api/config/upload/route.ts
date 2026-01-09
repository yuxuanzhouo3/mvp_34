import { NextResponse } from "next/server";
import { getUploadConfig } from "@/lib/config/upload";

export async function GET() {
  return NextResponse.json(getUploadConfig());
}
