import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { existsSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
]

async function ensureUploadDir(directory: string) {
  if (!existsSync(directory)) {
    await mkdir(directory, { recursive: true })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      console.error('Upload failed: Unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      console.error('Upload failed: No file provided')
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }

    console.log('Upload attempt:', { fileName: file.name, fileType: file.type, fileSize: file.size })

    // More lenient file type checking - check extension if MIME type is empty
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || ''
    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp']
    const isValidMimeType = ALLOWED_MIME_TYPES.includes(file.type)
    const isValidExtension = allowedExtensions.includes(fileExtension)

    if (!isValidMimeType && !isValidExtension) {
      console.error('Upload failed: Invalid file type', { fileType: file.type, extension: fileExtension })
      return NextResponse.json(
        { error: `Invalid file type. Only PDF and image files are allowed. Received: ${file.type || fileExtension}` },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      console.error('Upload failed: File too large', { fileSize: file.size })
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      )
    }

    const uploadDir = join(process.cwd(), 'public', 'uploads', 'order-links')
    console.log('Upload directory:', uploadDir)
    await ensureUploadDir(uploadDir)

    const extension = fileExtension || 'bin'
    const uniqueFileName = `${randomUUID()}.${extension}`
    const filePath = join(uploadDir, uniqueFileName)

    console.log('Writing file to:', filePath)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)
    console.log('File uploaded successfully:', uniqueFileName)

    return NextResponse.json({
      success: true,
      url: `/uploads/order-links/${uniqueFileName}`,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    })
  } catch (error) {
    console.error('Error uploading order link file:', error)
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      })
    }
    const errorMessage = error instanceof Error ? error.message : 'Failed to upload file'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

