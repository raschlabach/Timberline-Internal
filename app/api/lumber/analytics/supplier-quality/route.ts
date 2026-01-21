import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/analytics/supplier-quality - Get supplier quality averages by species/grade
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get supplier quality data for each species/grade combination
    const result = await query(`
      WITH supplier_species_grade AS (
        SELECT DISTINCT 
          l.supplier_id,
          s.name as supplier_name,
          li.species,
          li.grade
        FROM lumber_loads l
        JOIN lumber_suppliers s ON l.supplier_id = s.id
        JOIN lumber_load_items li ON li.load_id = l.id
        WHERE l.load_quality IS NOT NULL
      ),
      overall_avg AS (
        SELECT 
          l.supplier_id,
          li.species,
          li.grade,
          AVG(l.load_quality) as overall_avg_quality,
          COUNT(*) as total_loads
        FROM lumber_loads l
        JOIN lumber_load_items li ON li.load_id = l.id
        WHERE l.load_quality IS NOT NULL
        GROUP BY l.supplier_id, li.species, li.grade
      ),
      recent_3_avg AS (
        SELECT 
          supplier_id,
          species,
          grade,
          AVG(load_quality) as recent_avg_quality
        FROM (
          SELECT 
            l.supplier_id,
            li.species,
            li.grade,
            l.load_quality,
            ROW_NUMBER() OVER (
              PARTITION BY l.supplier_id, li.species, li.grade 
              ORDER BY l.created_at DESC
            ) as rn
          FROM lumber_loads l
          JOIN lumber_load_items li ON li.load_id = l.id
          WHERE l.load_quality IS NOT NULL
        ) ranked
        WHERE rn <= 3
        GROUP BY supplier_id, species, grade
      ),
      dismissed AS (
        SELECT supplier_id, species, grade
        FROM dismissed_quality_warnings
      )
      SELECT 
        ssg.supplier_id,
        ssg.supplier_name,
        ssg.species,
        ssg.grade,
        ROUND(oa.overall_avg_quality::numeric, 1) as overall_avg_quality,
        oa.total_loads,
        ROUND(r3.recent_avg_quality::numeric, 1) as recent_3_avg_quality,
        CASE WHEN d.supplier_id IS NOT NULL THEN true ELSE false END as is_dismissed,
        CASE 
          WHEN oa.overall_avg_quality < 50 OR r3.recent_avg_quality < 50 
          THEN true 
          ELSE false 
        END as is_warning
      FROM supplier_species_grade ssg
      JOIN overall_avg oa ON ssg.supplier_id = oa.supplier_id 
        AND ssg.species = oa.species 
        AND ssg.grade = oa.grade
      LEFT JOIN recent_3_avg r3 ON ssg.supplier_id = r3.supplier_id 
        AND ssg.species = r3.species 
        AND ssg.grade = r3.grade
      LEFT JOIN dismissed d ON ssg.supplier_id = d.supplier_id 
        AND ssg.species = d.species 
        AND ssg.grade = d.grade
      ORDER BY ssg.species, ssg.grade, ssg.supplier_name
    `)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching supplier quality:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
