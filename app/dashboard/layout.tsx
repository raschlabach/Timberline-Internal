import React from 'react'
import Link from 'next/link'
import { Truck, Users, FileText, Package, List, Calendar, LayoutDashboard } from 'lucide-react'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9fa]">
      {/* Sidebar */}
      <aside className="w-[280px] bg-white border-r border-gray-200 shadow-sm hidden md:flex md:flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Truck size={28} className="text-blue-600" />
            <h1 className="text-xl font-bold tracking-tight">Timberline</h1>
          </div>
        </div>
        
        <nav className="flex-1 py-4">
          <ul className="space-y-1 px-3">
            <NavItem href="/dashboard" icon={<LayoutDashboard size={20} />} label="Dashboard" />
            <NavItem href="/dashboard/load-board" icon={<List size={20} />} label="Load Board" />
            <NavItem href="/dashboard/orders" icon={<Package size={20} />} label="Order Entry" />
            <NavItem href="/dashboard/customers" icon={<Users size={20} />} label="Customers" />
            <NavItem href="/dashboard/trucking" icon={<Truck size={20} />} label="Trucking Center" />
            <NavItem href="/dashboard/calendar" icon={<Calendar size={20} />} label="Calendar" />
            <NavItem href="/dashboard/reports" icon={<FileText size={20} />} label="Reports" />
          </ul>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-8">
          <div className="flex items-center justify-between w-full">
            <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Admin User</span>
            </div>
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 overflow-auto p-8">
          {children}
        </div>
      </main>
    </div>
  )
}

interface NavItemProps {
  href: string
  icon: React.ReactNode
  label: string
}

function NavItem({ href, icon, label }: NavItemProps) {
  return (
    <li>
      <Link 
        href={href} 
        className="flex items-center gap-3 px-4 py-2.5 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors group"
      >
        <span className="text-gray-400 group-hover:text-blue-600 transition-colors">{icon}</span>
        <span className="font-medium group-hover:text-gray-900">{label}</span>
      </Link>
    </li>
  )
} 