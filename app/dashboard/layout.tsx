"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Truck, Users, Package, List, ArrowLeftRight, ClipboardList, Map, UserCog, LogOut, Calculator, FileText, DollarSign, Trees, FileBox, PackageCheck, Hammer, TrendingUp, Clock, BarChart3, CalendarClock, ArrowLeft, CalendarDays, FolderOpen, Boxes, Ship, FileSpreadsheet } from 'lucide-react'
import { NotificationPanel } from '@/components/notifications/notification-panel'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session } = useSession()
  const pathname = usePathname()
  
  // Check user roles
  const isAdmin = session?.user?.role === 'admin'
  const isRipOperator = session?.user?.role === 'rip_operator'
  const isDriver = session?.user?.role === 'driver'
  const isShippingStation = session?.user?.role === 'shipping_station'
  
  // Restricted roles only see specific pages
  const canSeeAllPages = !isRipOperator && !isDriver && !isShippingStation
  
  // Exclusive section toggle - only one section visible at a time
  const isLumberRoute = pathname?.startsWith('/dashboard/lumber') || false
  const [activeSection, setActiveSection] = useState<'timberline' | 'rnr'>(
    isLumberRoute || isRipOperator || isShippingStation ? 'rnr' : 'timberline'
  )

  useEffect(() => {
    if (pathname?.startsWith('/dashboard/lumber')) {
      setActiveSection('rnr')
    } else if (canSeeAllPages) {
      setActiveSection('timberline')
    }
  }, [pathname, canSeeAllPages])

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/auth/login' })
  }

  const isActiveRoute = (href: string) => pathname === href
  const isActiveSubRoute = (basePath: string) => pathname?.startsWith(basePath) || false
  
  // Hide sidebar on rip entry page to maximize horizontal space
  const isRipEntryPage = pathname === '/dashboard/lumber/rip-entry'
  const isSidebarHidden = isRipEntryPage

  // Driver portal layout - mobile-first with bottom navigation
  if (isDriver) {
    const driverNavItems = [
      { href: '/dashboard/driver/planner', icon: CalendarDays, label: 'Schedule' },
      { href: '/dashboard/driver/customers', icon: Users, label: 'Customers' },
      { href: '/dashboard/driver/load-papers', icon: FolderOpen, label: 'Papers' },
      { href: '/dashboard/driver/log-hours', icon: Clock, label: 'Hours' },
    ]

    return (
      <div className="flex flex-col h-screen bg-[#f8f9fa]">
        {/* Driver Header - slimmer in landscape for max vertical space */}
        <header className="h-14 landscape:h-10 bg-white border-b border-gray-200 flex items-center px-4 md:px-8 shrink-0 z-20">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-blue-100 rounded-lg">
                <Truck size={20} className="text-blue-600" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight text-gray-900">Timberline</h1>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold leading-none">Driver Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium text-gray-900">
                  {session?.user?.name || 'Driver'}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 h-8"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Desktop sidebar navigation for drivers - hidden on phones even in landscape */}
        <div className="flex flex-1 overflow-hidden">
          <aside className="hidden portrait:hidden lg:flex lg:flex-col w-[200px] bg-white border-r border-gray-200 shrink-0">
            <nav className="flex-1 py-4">
              <ul className="space-y-1 px-3">
                {driverNavItems.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <item.icon className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                        <span className={`font-medium text-sm ${isActive ? 'text-blue-700' : ''}`}>{item.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>
          </aside>

          {/* Driver content area */}
          <main className="flex-1 overflow-auto p-4 lg:p-6 pb-20 landscape:pb-14 lg:pb-6">
            {children}
          </main>
        </div>

        {/* Bottom navigation for drivers - shows on phones (portrait & landscape) and tablets, hidden on lg+ desktop */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 safe-area-bottom">
          <div className="flex items-center justify-around h-16 landscape:h-10">
            {driverNavItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col landscape:flex-row items-center justify-center gap-1 landscape:gap-1.5 px-3 py-2 landscape:py-1 rounded-lg transition-colors min-w-[72px] landscape:min-w-0 ${
                    isActive ? 'text-blue-600' : 'text-gray-400'
                  }`}
                >
                  <item.icon className={`h-5 w-5 landscape:h-4 landscape:w-4 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className={`text-[11px] font-medium landscape:text-[10px] ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9fa]">
      <aside className={`w-[280px] bg-white border-r border-gray-200 shadow-sm ${isSidebarHidden ? 'hidden' : 'hidden md:flex md:flex-col'}`}>
        {/* Colored accent bar indicating active section */}
        <div className={`h-1 shrink-0 transition-colors duration-300 ${activeSection === 'rnr' ? 'bg-emerald-500' : 'bg-blue-500'}`} />

        {/* Section Toggle */}
        <div className="p-4 border-b border-gray-200 shrink-0">
          {canSeeAllPages ? (
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveSection('timberline')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm font-semibold transition-all ${
                  activeSection === 'timberline'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Truck size={16} className={activeSection === 'timberline' ? 'text-blue-600' : ''} />
                Timberline
              </button>
              <button
                onClick={() => setActiveSection('rnr')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm font-semibold transition-all ${
                  activeSection === 'rnr'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Hammer size={16} className={activeSection === 'rnr' ? 'text-emerald-600' : ''} />
                RNR
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-1">
              {isShippingStation ? (
                <>
                  <Ship size={24} className="text-emerald-600" />
                  <h1 className="text-lg font-bold tracking-tight text-emerald-800">Shipping Station</h1>
                </>
              ) : (
                <>
                  <Hammer size={24} className="text-emerald-600" />
                  <h1 className="text-lg font-bold tracking-tight text-emerald-800">RNR Lumber</h1>
                </>
              )}
            </div>
          )}
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          <div className="space-y-0.5 px-3">

            {/* ===== TIMBERLINE SECTION (blue theme) ===== */}
            {activeSection === 'timberline' && canSeeAllPages && (
              <>
                <NavItem
                  href="/dashboard/orders"
                  icon={<Package size={20} />}
                  label="Order Entry"
                  isActive={isActiveSubRoute('/dashboard/orders')}
                  isPrimary
                  theme="blue"
                />
                <SubNavItem
                  href="/dashboard/customers"
                  icon={<Users size={16} />}
                  label="Customers"
                  isActive={isActiveSubRoute('/dashboard/customers')}
                  theme="blue"
                />

                <div className="pt-3" />
                <NavItem
                  href="/dashboard/load-board"
                  icon={<List size={20} />}
                  label="Load Board"
                  isActive={
                    isActiveSubRoute('/dashboard/load-board') ||
                    isActiveSubRoute('/dashboard/backhaul-planner')
                  }
                  theme="blue"
                />
                <SubNavItem
                  href="/dashboard/load-board/map"
                  icon={<Map size={16} />}
                  label="Load Board Map"
                  isActive={isActiveRoute('/dashboard/load-board/map')}
                  theme="blue"
                />
                <SubNavItem
                  href="/dashboard/backhaul-planner"
                  icon={<ArrowLeftRight size={16} />}
                  label="Backhaul Planner"
                  isActive={isActiveRoute('/dashboard/backhaul-planner')}
                  theme="blue"
                />

                <div className="pt-3" />
                <NavItem
                  href="/dashboard/truckload-manager"
                  icon={<ClipboardList size={20} />}
                  label="Truckload Manager"
                  isActive={isActiveSubRoute('/dashboard/truckload-manager') || isActiveSubRoute('/dashboard/truckload-planner')}
                  theme="blue"
                />
                <SubNavItem
                  href="/dashboard/truckload-planner"
                  icon={<CalendarClock size={16} />}
                  label="Truckload Planner"
                  isActive={isActiveSubRoute('/dashboard/truckload-planner')}
                  theme="blue"
                />

                <div className="pt-3" />
                <NavItem
                  href="/dashboard/invoices"
                  icon={<FileText size={20} />}
                  label="Invoice Page"
                  isActive={isActiveSubRoute('/dashboard/invoices')}
                  theme="blue"
                />
                <SubNavItem
                  href="/dashboard/driver-pay"
                  icon={<DollarSign size={16} />}
                  label="Driver Pay"
                  isActive={isActiveSubRoute('/dashboard/driver-pay')}
                  theme="blue"
                />

                <div className="pt-3" />
                <NavItem
                  href="/dashboard/pricing-notes"
                  icon={<Calculator size={20} />}
                  label="Pricing Notes"
                  isActive={isActiveSubRoute('/dashboard/pricing-notes')}
                  theme="blue"
                />

                <div className="pt-3" />
                <NavItem
                  href="/dashboard/vinyl-tech"
                  icon={<FileSpreadsheet size={20} />}
                  label="Vinyl Tech"
                  isActive={isActiveSubRoute('/dashboard/vinyl-tech')}
                  theme="blue"
                />
                <NavItem
                  href="/dashboard/dyoder"
                  icon={<FileSpreadsheet size={20} />}
                  label="D. Yoder"
                  isActive={isActiveSubRoute('/dashboard/dyoder')}
                  theme="blue"
                />
              </>
            )}

            {/* ===== RNR / LUMBER SECTION (emerald theme) ===== */}
            {activeSection === 'rnr' && (
              <>
                {canSeeAllPages && (
                  <>
                    <NavItem
                      href="/dashboard/lumber/create"
                      icon={<Package size={20} />}
                      label="Create Load"
                      isActive={isActiveRoute('/dashboard/lumber/create')}
                      isPrimary
                      theme="emerald"
                    />
                    <SubNavItem
                      href="/dashboard/lumber/po"
                      icon={<FileBox size={16} />}
                      label="PO Page"
                      isActive={isActiveRoute('/dashboard/lumber/po')}
                      theme="emerald"
                    />
                    <div className="pt-3" />
                  </>
                )}

                <NavItem
                  href="/dashboard/lumber/overview"
                  icon={<Trees size={20} />}
                  label="Overview"
                  isActive={isActiveRoute('/dashboard/lumber/overview')}
                  theme="emerald"
                />
                <SubNavItem
                  href="/dashboard/lumber/incoming"
                  icon={<Package size={16} />}
                  label={isRipOperator ? "Incoming Loads (View)" : "Incoming Loads"}
                  isActive={isActiveRoute('/dashboard/lumber/incoming')}
                  theme="emerald"
                />
                {(canSeeAllPages || isShippingStation) && (
                  <SubNavItem
                    href="/dashboard/lumber/trucking"
                    icon={<Truck size={16} />}
                    label="Trucking"
                    isActive={isActiveRoute('/dashboard/lumber/trucking')}
                    theme="emerald"
                  />
                )}
                {canSeeAllPages && (
                  <SubNavItem
                    href="/dashboard/lumber/invoices"
                    icon={<FileText size={16} />}
                    label="Invoice Page"
                    isActive={isActiveRoute('/dashboard/lumber/invoices')}
                    theme="emerald"
                  />
                )}
                {!isShippingStation && (
                  <SubNavItem
                    href="/dashboard/lumber/all-loads"
                    icon={<List size={16} />}
                    label={isRipOperator ? "All Loads (View)" : "All Loads"}
                    isActive={isActiveRoute('/dashboard/lumber/all-loads')}
                    theme="emerald"
                  />
                )}

                {!isShippingStation && (
                  <>
                    <div className="pt-3" />
                    {canSeeAllPages && (
                      <NavItem
                        href="/dashboard/lumber/tally-entry"
                        icon={<ClipboardList size={20} />}
                        label="Tally Entry"
                        isActive={isActiveRoute('/dashboard/lumber/tally-entry')}
                        theme="emerald"
                      />
                    )}
                    <SubNavItem
                      href="/dashboard/lumber/rip-entry"
                      icon={<Hammer size={16} />}
                      label="Rip Entry"
                      isActive={isActiveRoute('/dashboard/lumber/rip-entry')}
                      theme="emerald"
                      className={isRipOperator ? '' : 'ml-6'}
                    />
                    <SubNavItem
                      href="/dashboard/lumber/misc-rip"
                      icon={<Package size={16} />}
                      label="Misc Rip"
                      isActive={isActiveRoute('/dashboard/lumber/misc-rip')}
                      theme="emerald"
                      className={isRipOperator ? '' : 'ml-6'}
                    />
                    <SubNavItem
                      href="/dashboard/lumber/daily-hours"
                      icon={<Clock size={16} />}
                      label="Daily Hours"
                      isActive={isActiveRoute('/dashboard/lumber/daily-hours')}
                      theme="emerald"
                      className={isRipOperator ? '' : 'ml-6'}
                    />
                    <SubNavItem
                      href="/dashboard/lumber/ripped-packs"
                      icon={<PackageCheck size={16} />}
                      label="Ripped Packs"
                      isActive={isActiveRoute('/dashboard/lumber/ripped-packs')}
                      theme="emerald"
                      className={isRipOperator ? '' : 'ml-6'}
                    />
                  </>
                )}

                {canSeeAllPages && (
                  <>
                    <div className="pt-3" />
                    <NavItem
                      href="/dashboard/lumber/inventory"
                      icon={<PackageCheck size={20} />}
                      label="Inventory"
                      isActive={isActiveRoute('/dashboard/lumber/inventory')}
                      theme="emerald"
                    />
                    <SubNavItem
                      href="/dashboard/lumber/rip-bonus"
                      icon={<TrendingUp size={16} />}
                      label="Rip Bonus"
                      isActive={isActiveRoute('/dashboard/lumber/rip-bonus')}
                      theme="emerald"
                    />
                    <SubNavItem
                      href="/dashboard/lumber/rip-report"
                      icon={<BarChart3 size={16} />}
                      label="Rip Report"
                      isActive={isActiveRoute('/dashboard/lumber/rip-report')}
                      theme="emerald"
                    />
                  </>
                )}

                {isAdmin && (
                  <SubNavItem
                    href="/dashboard/lumber/admin"
                    icon={<UserCog size={16} />}
                    label="Admin"
                    isActive={isActiveRoute('/dashboard/lumber/admin')}
                    theme="emerald"
                  />
                )}

                {canSeeAllPages && (
                  <>
                    <div className="pt-3" />
                    <NavItem
                      href="/dashboard/lumber/cabinet"
                      icon={<Boxes size={20} />}
                      label="Order Processor"
                      isActive={pathname === '/dashboard/lumber/cabinet'}
                      theme="emerald"
                    />
                    <NavItem
                      href="/dashboard/lumber/cabinet/parts"
                      icon={<Calculator size={20} />}
                      label="Part Builder"
                      isActive={pathname === '/dashboard/lumber/cabinet/parts'}
                      theme="emerald"
                    />
                  </>
                )}
                {(canSeeAllPages || isShippingStation) && (
                  <>
                    {isShippingStation && <div className="pt-3" />}
                    <NavItem
                      href="/dashboard/lumber/nw-shipping"
                      icon={<Ship size={20} />}
                      label="NW Shipping Report"
                      isActive={pathname?.startsWith('/dashboard/lumber/nw-shipping') || false}
                      theme="emerald"
                    />
                  </>
                )}
              </>
            )}
          </div>

          {/* User Management - outside both sections, always visible for admins */}
          {isAdmin && (
            <div className="px-3 pt-3 mt-2 border-t border-gray-100">
              <NavItem
                href="/dashboard/users"
                icon={<UserCog size={20} />}
                label="User Management"
                isActive={isActiveSubRoute('/dashboard/users')}
                theme={activeSection === 'rnr' ? 'emerald' : 'blue'}
              />
            </div>
          )}

          <NotificationPanel />
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-8">
          <div className="flex items-center justify-between w-full">
            {isSidebarHidden ? (
              <Link 
                href="/dashboard/lumber/overview" 
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="text-sm font-medium">Back to Dashboard</span>
              </Link>
            ) : (
              <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
            )}
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
  theme?: 'blue' | 'emerald'
}

function NavItem({ href, icon, label, isActive = false, isPrimary = false, theme = 'blue' }: NavItemProps) {
  const baseClasses = 'flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors group'

  let stateClasses: string
  let iconClasses: string
  let labelClasses: string

  if (isPrimary) {
    if (theme === 'emerald') {
      stateClasses = isActive ? 'bg-emerald-700 text-white shadow-sm' : 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
    } else {
      stateClasses = isActive ? 'bg-blue-700 text-white shadow-sm' : 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
    }
    iconClasses = 'text-white'
    labelClasses = 'text-white font-semibold'
  } else if (theme === 'emerald') {
    stateClasses = isActive ? 'bg-emerald-50 text-emerald-700 border-r-2 border-emerald-600' : 'text-gray-600 hover:bg-gray-50'
    iconClasses = isActive ? 'text-emerald-600' : 'text-gray-400 group-hover:text-emerald-600'
    labelClasses = isActive ? 'text-emerald-700 font-medium' : 'group-hover:text-gray-900 font-medium'
  } else {
    stateClasses = isActive ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'
    iconClasses = isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-600'
    labelClasses = isActive ? 'text-blue-700 font-medium' : 'group-hover:text-gray-900 font-medium'
  }

  return (
    <div>
      <Link href={href} className={`${baseClasses} ${stateClasses}`}>
        <span className={`transition-colors ${iconClasses}`}>{icon}</span>
        <span className={`transition-colors ${labelClasses}`}>{label}</span>
      </Link>
    </div>
  )
}

interface SubNavItemProps {
  href: string
  icon: React.ReactNode
  label: string
  isActive?: boolean
  className?: string
  theme?: 'blue' | 'emerald'
}

function SubNavItem({ href, icon, label, isActive = false, className = 'ml-6', theme = 'blue' }: SubNavItemProps) {
  const activeClasses = theme === 'emerald'
    ? 'bg-emerald-50 text-emerald-700 border-r-2 border-emerald-600'
    : 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'

  const activeIcon = theme === 'emerald' ? 'text-emerald-600' : 'text-blue-600'
  const hoverIcon = theme === 'emerald' ? 'text-gray-400 group-hover:text-emerald-600' : 'text-gray-400 group-hover:text-blue-600'
  const activeLabel = theme === 'emerald' ? 'text-emerald-700' : 'text-blue-700'

  return (
    <div className={className}>
      <Link
        href={href}
        className={`flex items-center gap-3 px-4 py-2 text-sm rounded-lg transition-colors group ${
          isActive ? activeClasses : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        <span className={`transition-colors ${isActive ? activeIcon : hoverIcon}`}>{icon}</span>
        <span className={`font-medium ${isActive ? activeLabel : 'group-hover:text-gray-900'}`}>{label}</span>
      </Link>
    </div>
  )
}