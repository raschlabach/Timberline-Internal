import React from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import TruckloadInvoicePage from '@/components/invoices/truckload-invoice-page'

export default async function InvoicesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/login')
  return (
    <div className="h-full w-full">
      <TruckloadInvoicePage />
    </div>
  )
}


