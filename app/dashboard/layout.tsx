"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Truck, Users, Package, List, ArrowLeftRight, ClipboardList, Map, UserCog, LogOut, Calculator, FileText, DollarSign, Trees, FileBox, PackageCheck, Hammer, TrendingUp } from 'lucide-react'
import { NotificationPanel } from '@/components/notifications/notification-panel'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session } = useSession()
  const pathname = usePathname()
  
  // Check if user is admin
  const isAdmin = session?.user?.role === 'admin'

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/auth/login' })
  }

  const isActiveRoute = (href: string) => pathname === href
  const isActiveSubRoute = (basePath: string) => pathname?.startsWith(basePath) || false

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
            <NavItem
              href="/dashboard/orders"
              icon={<Package size={20} />}
              label="Order Entry"
              isActive={isActiveSubRoute('/dashboard/orders')}
              isPrimary
            />
            <SubNavItem
              href="/dashboard/customers"
              icon={<Users size={16} />}
              label="Customers"
              isActive={isActiveSubRoute('/dashboard/customers')}
            />

            <NavItem
              href="/dashboard/load-board"
              icon={<List size={20} />}
              label="Load Board"
              isActive={
                isActiveSubRoute('/dashboard/load-board') ||
                isActiveSubRoute('/dashboard/backhaul-planner')
              }
            />
            <SubNavItem
              href="/dashboard/load-board/map"
              icon={<Map size={16} />}
              label="Load Board Map"
              isActive={isActiveRoute('/dashboard/load-board/map')}
            />
            <SubNavItem
              href="/dashboard/backhaul-planner"
              icon={<ArrowLeftRight size={16} />}
              label="Backhaul Planner"
              isActive={isActiveRoute('/dashboard/backhaul-planner')}
            />

            <NavItem
              href="/dashboard/truckload-manager"
              icon={<ClipboardList size={20} />}
              label="Truckload Manager"
              isActive={isActiveSubRoute('/dashboard/truckload-manager')}
            />
            <NavItem
              href="/dashboard/invoices"
              icon={<FileText size={20} />}
              label="Invoice Page"
              isActive={isActiveSubRoute('/dashboard/invoices')}
            />
            <SubNavItem
              href="/dashboard/driver-pay"
              icon={<DollarSign size={16} />}
              label="Driver Pay"
              isActive={isActiveSubRoute('/dashboard/driver-pay')}
            />
            <NavItem
              href="/dashboard/pricing-notes"
              icon={<Calculator size={20} />}
              label="Pricing Notes"
              isActive={isActiveSubRoute('/dashboard/pricing-notes')}
            />
            
            {/* Lumber Tracker Section */}
            <div className="pt-4 pb-2 px-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Lumber Tracker
              </div>
            </div>
            
            <NavItem
              href="/dashboard/lumber/incoming"
              icon={<Trees size={20} />}
              label="Incoming Loads"
              isActive={isActiveSubRoute('/dashboard/lumber')}
            />
            <SubNavItem
              href="/dashboard/lumber/create"
              icon={<Package size={16} />}
              label="Create Load"
              isActive={isActiveRoute('/dashboard/lumber/create')}
            />
            <SubNavItem
              href="/dashboard/lumber/po"
              icon={<FileBox size={16} />}
              label="PO Page"
              isActive={isActiveRoute('/dashboard/lumber/po')}
            />
            <SubNavItem
              href="/dashboard/lumber/trucking"
              icon={<Truck size={16} />}
              label="Trucking"
              isActive={isActiveRoute('/dashboard/lumber/trucking')}
            />
            <SubNavItem
              href="/dashboard/lumber/invoices"
              icon={<FileText size={16} />}
              label="Invoice Page"
              isActive={isActiveRoute('/dashboard/lumber/invoices')}
            />
            <SubNavItem
              href="/dashboard/lumber/all-loads"
              icon={<List size={16} />}
              label="All Loads"
              isActive={isActiveRoute('/dashboard/lumber/all-loads')}
            />
            <SubNavItem
              href="/dashboard/lumber/inventory"
              icon={<PackageCheck size={16} />}
              label="Inventory"
              isActive={isActiveRoute('/dashboard/lumber/inventory')}
            />
            <SubNavItem
              href="/dashboard/lumber/tally-entry"
              icon={<ClipboardList size={16} />}
              label="Tally Entry"
              isActive={isActiveRoute('/dashboard/lumber/tally-entry')}
            />
            <SubNavItem
              href="/dashboard/lumber/rip-entry"
              icon={<Hammer size={16} />}
              label="Rip Entry"
              isActive={isActiveRoute('/dashboard/lumber/rip-entry')}
            />
            <SubNavItem
              href="/dashboard/lumber/ripped-packs"
              icon={<PackageCheck size={16} />}
              label="Ripped Packs"
              isActive={isActiveRoute('/dashboard/lumber/ripped-packs')}
            />
            <SubNavItem
              href="/dashboard/lumber/rip-bonus"
              icon={<TrendingUp size={16} />}
              label="Rip Bonus"
              isActive={isActiveRoute('/dashboard/lumber/rip-bonus')}
            />
            {isAdmin && (
              <SubNavItem
                href="/dashboard/lumber/admin"
                icon={<UserCog size={16} />}
                label="Admin"
                isActive={isActiveRoute('/dashboard/lumber/admin')}
              />
            )}
            
            {isAdmin && (
              <NavItem
                href="/dashboard/users"
                icon={<UserCog size={20} />}
                label="User Management"
                isActive={isActiveSubRoute('/dashboard/users')}
              />
            )}
          </ul>
          
          {/* Notifications Panel */}
          <NotificationPanel />
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-8">
          <div className="flex items-center justify-between w-full">
            <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {session?.user?.name || 'User'}
                </div>
                <div className="text-xs text-gray-500 capitalize">
                  {session?.user?.role || 'user'}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
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
  isActive?: boolean
  isPrimary?: boolean
}

function NavItem({ href, icon, label, isActive = false, isPrimary = false }: NavItemProps) {
  const baseClasses = 'flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors group'
  const stateClasses = isPrimary
    ? isActive
      ? 'bg-blue-700 text-white shadow-sm'
      : 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
    : isActive
      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
      : 'text-gray-600 hover:bg-gray-50'

  const iconClasses = isPrimary
    ? 'text-white'
    : isActive
      ? 'text-blue-600'
      : 'text-gray-400 group-hover:text-blue-600'

  const labelClasses = isPrimary
    ? 'text-white font-semibold'
    : isActive
      ? 'text-blue-700 font-medium'
      : 'group-hover:text-gray-900 font-medium'

  return (
    <li>
      <Link href={href} className={`${baseClasses} ${stateClasses}`}>
        <span className={`transition-colors ${iconClasses}`}>{icon}</span>
        <span className={`transition-colors ${labelClasses}`}>{label}</span>
      </Link>
    </li>
  )
}

interface SubNavItemProps {
  href: string
  icon: React.ReactNode
  label: string
  isActive?: boolean
  className?: string
}

function SubNavItem({ href, icon, label, isActive = false, className = 'ml-6' }: SubNavItemProps) {
  return (
    <li className={className}>
      <Link 
        href={href} 
        className={`flex items-center gap-3 px-4 py-2 text-sm rounded-lg transition-colors group ${
          isActive 
            ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600' 
            : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        <span className={`transition-colors ${
          isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-600'
        }`}>{icon}</span>
        <span className={`font-medium ${
          isActive ? 'text-blue-700' : 'group-hover:text-gray-900'
        }`}>{label}</span>
      </Link>
    </li>
  )
}