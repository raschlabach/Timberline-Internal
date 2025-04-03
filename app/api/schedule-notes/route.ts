import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"
import { addDays, format, subDays } from "date-fns"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    let startDate = searchParams.get("startDate")
    let endDate = searchParams.get("endDate")

    // If no dates provided, default to ±30 days from today
    if (!startDate || !endDate) {
      const today = new Date()
      startDate = format(subDays(today, 30), 'yyyy-MM-dd')
      endDate = format(addDays(today, 30), 'yyyy-MM-dd')
    }

    const notes = await query(
      `SELECT * FROM expanded_schedule_notes 
      WHERE note_date BETWEEN $1 AND $2 
      ORDER BY note_date, created_at`,
      [startDate, endDate]
    )

    return NextResponse.json({ success: true, notes: notes.rows })
  } catch (error) {
    console.error("Error fetching schedule notes:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { content, start_date, end_date, is_recurring, recurrence_pattern, color } = body

    // Validate required fields
    if (!start_date) {
      return NextResponse.json({ 
        error: "Start date is required",
        details: { start_date: !start_date }
      }, { status: 400 })
    }

    // For recurring notes, end_date is required
    if (is_recurring && !end_date) {
      return NextResponse.json({ 
        error: "End date is required for recurring notes" 
      }, { status: 400 })
    }

    // Use the provided end_date if it exists, otherwise use start_date
    const finalEndDate = end_date || start_date

    const result = await query(
      `INSERT INTO schedule_notes 
      (title, content, start_date, end_date, is_recurring, recurrence_pattern, color, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        "", // Empty title since we no longer use it
        content || "", 
        start_date, 
        finalEndDate,
        is_recurring || false,
        recurrence_pattern ? JSON.stringify(recurrence_pattern) : null,
        color || "#808080",
        session.user.id
      ]
    )

    return NextResponse.json({ success: true, note: result.rows[0] })
  } catch (error) {
    console.error("Error creating schedule note:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, content, start_date, end_date, is_recurring, recurrence_pattern, color } = body

    // Validate required fields
    if (!id || !start_date) {
      return NextResponse.json({ 
        error: "ID and start date are required",
        details: { id: !id, start_date: !start_date }
      }, { status: 400 })
    }

    // For recurring notes, end_date is required
    if (is_recurring && !end_date) {
      return NextResponse.json({ 
        error: "End date is required for recurring notes" 
      }, { status: 400 })
    }

    // Use the provided end_date if it exists, otherwise use start_date
    const finalEndDate = end_date || start_date

    const result = await query(
      `UPDATE schedule_notes 
      SET title = $1, 
          content = $2, 
          start_date = $3, 
          end_date = $4, 
          is_recurring = $5, 
          recurrence_pattern = $6, 
          color = $7
      WHERE id = $8 AND created_by = $9
      RETURNING *`,
      [
        "", // Empty title since we no longer use it
        content || "", 
        start_date, 
        finalEndDate,
        is_recurring || false,
        recurrence_pattern ? JSON.stringify(recurrence_pattern) : null,
        color || "#808080",
        id,
        session.user.id
      ]
    )

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, note: result.rows[0] })
  } catch (error) {
    console.error("Error updating schedule note:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Note ID is required" }, { status: 400 })
    }

    const result = await query(
      `DELETE FROM schedule_notes 
      WHERE id = $1 AND created_by = $2 
      RETURNING *`,
      [id, session.user.id]
    )

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting schedule note:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
} 