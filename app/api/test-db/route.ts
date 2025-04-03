import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

// Temporary test endpoint - DO NOT USE IN PRODUCTION
export async function GET() {
  try {
    console.log('Testing database connection...')
    const result = await query('SELECT NOW()')
    console.log('Database query result:', result.rows[0])
    
    return NextResponse.json({ 
      success: true, 
      timestamp: result.rows[0].now,
      message: 'Database connection successful'
    })
  } catch (error) {
    console.error('Database connection test failed:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error details:', errorMessage)
    
    return NextResponse.json({ 
      success: false, 
      error: errorMessage
    }, { status: 500 })
  }
} 