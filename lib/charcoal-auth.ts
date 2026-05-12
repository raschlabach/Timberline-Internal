import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'

type CharcoalRole = 'office' | 'shipping_station' | null

export async function getCharcoalSession(): Promise<{
  session: Awaited<ReturnType<typeof getServerSession>>
  role: CharcoalRole
  userId: string | null
}> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { session: null, role: null, userId: null }
  }

  const r = session.user.role
  if (r === 'admin' || r === 'user') {
    return { session, role: 'office', userId: session.user.id }
  }
  if (r === 'shipping_station') {
    return { session, role: 'shipping_station', userId: session.user.id }
  }
  return { session, role: null, userId: null }
}

export function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
