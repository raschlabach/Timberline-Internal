import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
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

    // Convert file to base64 for database storage (works in serverless environments)
    const buffer = Buffer.from(await file.arrayBuffer())
    const base64Data = buffer.toString('base64')
    const fileId = randomUUID()

    // Store file metadata in database
    // We'll create a temporary record that can be linked to an order later
    const result = await query(
      `INSERT INTO order_links (
        order_id,
        url,
        description,
        file_data,
        file_name,
        file_type,
        file_size
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id`,
      [
        0, // Temporary order_id (0 means unlinked file)
        `/api/uploads/order-links/${fileId}`, // URL to serve the file
        file.name,
        base64Data,
        file.name,
        file.type,
        file.size
      ]
    )

    const linkId = result.rows[0].id

    console.log('File uploaded successfully to database:', { linkId, fileName: file.name })

    return NextResponse.json({
      success: true,
      url: `/api/uploads/order-links/${fileId}`,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      linkId: linkId.toString(), // Return link ID so it can be updated when order is created
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


