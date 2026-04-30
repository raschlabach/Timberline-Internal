import React from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import PayrollPage from '@/components/payroll/payroll-page'

export default async function PayrollPageRoute() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/login')
  return (
    <div className="h-full w-full">
      <PayrollPage />
    </div>
  )
}
