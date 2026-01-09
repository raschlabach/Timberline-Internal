import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.role || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Add color column to lumber_species table
    await query(`
      ALTER TABLE lumber_species 
      ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#6B7280'
    `)

    // Set default colors for specific species
    await query(`UPDATE lumber_species SET color = '#F97316' WHERE name = 'R Oak'`)
    await query(`UPDATE lumber_species SET color = '#92400E' WHERE name = 'Walnut'`)
    await query(`UPDATE lumber_species SET color = '#3B82F6' WHERE name = 'Poplar'`)
    await query(`UPDATE lumber_species SET color = '#A855F7' WHERE name = 'Alder'`)
    await query(`UPDATE lumber_species SET color = '#EAB308' WHERE name = 'Ash'`)
    await query(`UPDATE lumber_species SET color = '#EF4444' WHERE name = 'Cherry'`)
    await query(`UPDATE lumber_species SET color = '#166534' WHERE name = 'Uns Soft Maple'`)
    await query(`UPDATE lumber_species SET color = '#22C55E' WHERE name = 'Sap Soft Maple'`)

    return NextResponse.json({ 
      success: true, 
      message: 'Species colors migration applied successfully' 
    })
  } catch (error) {
    console.error('Error applying species colors migration:', error)
    return NextResponse.json(
      { error: 'Failed to apply species colors migration' },
      { status: 500 }
    )
  }
}
