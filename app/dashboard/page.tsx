import React from 'react'
import Link from 'next/link'
import { Truck, Users, Package, List, Calendar, AlertTriangle, Clock } from 'lucide-react'

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Welcome to Timberline Logistics</h1>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Summary Cards */}
        <SummaryCard 
          title="Pending Orders" 
          value="24" 
          icon={<Package className="h-6 w-6 text-blue-600" />}
          linkHref="/dashboard/orders"
        />
        
        <SummaryCard 
          title="Active Truckloads" 
          value="8" 
          icon={<Truck className="h-6 w-6 text-emerald-600" />}
          linkHref="/dashboard/trucking"
        />
        
        <SummaryCard 
          title="Rush Orders" 
          value="5" 
          icon={<AlertTriangle className="h-6 w-6 text-red-600" />}
          linkHref="/dashboard/load-board?filter=rush"
        />
        
        <SummaryCard 
          title="Today's Deliveries" 
          value="12" 
          icon={<Clock className="h-6 w-6 text-purple-600" />}
          linkHref="/dashboard/calendar"
        />
      </div>
      
      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickActionButton 
            icon={<Package className="h-5 w-5" />}
            label="New Order" 
            href="/dashboard/orders/new" 
          />
          
          <QuickActionButton 
            icon={<List className="h-5 w-5" />}
            label="View Load Board" 
            href="/dashboard/load-board" 
          />
          
          <QuickActionButton 
            icon={<Users className="h-5 w-5" />}
            label="Add Customer" 
            href="/dashboard/customers/new" 
          />
        </div>
      </div>
      
      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <p className="text-gray-500 text-sm">Recent activity will be displayed here...</p>
        </div>
      </div>
    </div>
  )
}

interface SummaryCardProps {
  title: string
  value: string
  icon: React.ReactNode
  linkHref: string
}

function SummaryCard({ title, value, icon, linkHref }: SummaryCardProps) {
  return (
    <Link href={linkHref}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:border-gray-300 transition-colors">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">{icon}</div>
        </div>
      </div>
    </Link>
  )
}

interface QuickActionButtonProps {
  icon: React.ReactNode
  label: string
  href: string
}

function QuickActionButton({ icon, label, href }: QuickActionButtonProps) {
  return (
    <Link 
      href={href} 
      className="inline-flex items-center justify-center gap-2 bg-white text-gray-700 font-medium py-2.5 px-4 rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
    >
      {icon}
      <span>{label}</span>
    </Link>
  )
} 