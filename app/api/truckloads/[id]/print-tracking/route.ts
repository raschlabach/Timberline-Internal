import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const VALID_SHEET_TYPES = {
  truckload_sheet: 'truckload_sheet_printed_at',
  pickup_list: 'pickup_list_printed_at',
  loading_sheet: 'loading_sheet_printed_at',
} as const

type SheetType = keyof typeof VALID_SHEET_TYPES

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const truckloadId = parseInt(params.id)
    if (isNaN(truckloadId)) {
      return NextResponse.json({ success: false, error: 'Invalid truckload ID' }, { status: 400 })
    }

    const body = await request.json()
    const { sheetType } = body as { sheetType: string }

    if (!sheetType || !(sheetType in VALID_SHEET_TYPES)) {
      return NextResponse.json(
        { success: false, error: 'Invalid sheet type. Must be one of: truckload_sheet, pickup_list, loading_sheet' },
        { status: 400 }
      )
    }

    const columnName = VALID_SHEET_TYPES[sheetType as SheetType]

    await query(
      `UPDATE truckloads SET ${columnName} = NOW() WHERE id = $1`,
      [truckloadId]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error recording print tracking:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to record print' },
      { status: 500 }
    )
  }
}
