import { type NextRequest, NextResponse } from "next/server"
import { getAppFileInfo } from "@/lib/file-service"
import fs from 'fs'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params

    console.log(`[Download API] Download requested: ${filename}`)

    // Validate filename for security
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({
        error: "Invalid filename"
      }, { status: 400 })
    }

    // Get file info
    const fileInfo = getAppFileInfo(filename)
    if (!fileInfo) {
      return NextResponse.json({
        error: "File not found",
        filename
      }, { status: 404 })
    }

    // Check if file exists
    if (!fs.existsSync(fileInfo.filepath)) {
      return NextResponse.json({
        error: "File not found on disk",
        filename
      }, { status: 404 })
    }

    // Read the file
    const fileBuffer = fs.readFileSync(fileInfo.filepath)
    
    // Set appropriate headers for download
    const headers = new Headers()
    headers.set('Content-Type', fileInfo.mimeType)
    headers.set('Content-Length', fileInfo.size.toString())
    headers.set('Content-Disposition', `attachment; filename="${filename}"`)
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    headers.set('Pragma', 'no-cache')
    headers.set('Expires', '0')

    console.log(`[Download API] Serving file: ${filename} (${fileInfo.size} bytes)`)

    // Return the file
    return new NextResponse(fileBuffer, {
      status: 200,
      headers
    })

  } catch (error) {
    console.error("[Download API] Error:", error)
    return NextResponse.json({
      error: "Failed to download file",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

