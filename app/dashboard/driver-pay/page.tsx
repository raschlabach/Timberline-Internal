import React from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DriverPayPage from '@/components/driver-pay/driver-pay-page'

export default async function DriverPayPageRoute() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/login')
  return (
    <div className="h-full w-full">
      <DriverPayPage />
    </div>
  )
}

