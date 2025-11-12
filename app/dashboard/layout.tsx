"use client"

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Truck, Users, Package, List, LayoutDashboard, ArrowLeftRight, ClipboardList, Map, ChevronDown, ChevronRight, UserCog, LogOut, Calculator, FileText } from 'lucide-react'
import { NotificationPanel } from '@/components/notifications/notification-panel'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session } = useSession()
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set(['load-board']))
  const pathname = usePathname()
  
  // Check if user is admin
  const isAdmin = session?.user?.role === 'admin'

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/auth/login' })
  }

  const toggleMenu = (menuKey: string) => {
    setExpandedMenus(prev => {
      const newSet = new Set(prev)
      if (newSet.has(menuKey)) {
        newSet.delete(menuKey)
      } else {
        newSet.add(menuKey)
      }
      return newSet
    })
  }

  const isMenuExpanded = (menuKey: string) => expandedMenus.has(menuKey)
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
            <NavItem href="/dashboard" icon={<LayoutDashboard size={20} />} label="Dashboard" isActive={isActiveRoute('/dashboard')} />
            
            {/* Load Board with Sub-menu */}
            <SubMenuNavItem
              label="Load Board"
              icon={<List size={20} />}
              isExpanded={isMenuExpanded('load-board')}
              isActive={isActiveSubRoute('/dashboard/load-board')}
              onToggle={() => toggleMenu('load-board')}
            >
              <SubNavItem 
                href="/dashboard/load-board" 
                icon={<List size={16} />} 
                label="Load Board" 
                isActive={isActiveRoute('/dashboard/load-board')} 
              />
              <SubNavItem 
                href="/dashboard/load-board/map" 
                icon={<Map size={16} />} 
                label="Load Board Map" 
                isActive={isActiveRoute('/dashboard/load-board/map')} 
              />
            </SubMenuNavItem>
            
            <NavItem href="/dashboard/orders" icon={<Package size={20} />} label="Order Entry" isActive={isActiveSubRoute('/dashboard/orders')} />
            <NavItem href="/dashboard/customers" icon={<Users size={20} />} label="Customers" isActive={isActiveSubRoute('/dashboard/customers')} />
            <NavItem href="/dashboard/pricing-notes" icon={<Calculator size={20} />} label="Pricing Notes" isActive={isActiveSubRoute('/dashboard/pricing-notes')} />
            <NavItem href="/dashboard/invoices" icon={<FileText size={20} />} label="Invoice Page" isActive={isActiveSubRoute('/dashboard/invoices')} />
            {isAdmin && (
              <NavItem href="/dashboard/users" icon={<UserCog size={20} />} label="User Management" isActive={isActiveSubRoute('/dashboard/users')} />
            )}
            <NavItem href="/dashboard/truckload-manager" icon={<ClipboardList size={20} />} label="Truckload Manager" isActive={isActiveSubRoute('/dashboard/truckload-manager')} />
            <NavItem href="/dashboard/backhaul-planner" icon={<ArrowLeftRight size={20} />} label="Backhaul Planner" isActive={isActiveSubRoute('/dashboard/backhaul-planner')} />
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
}

function NavItem({ href, icon, label, isActive = false }: NavItemProps) {
  return (
    <li>
      <Link 
        href={href} 
        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors group ${
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

interface SubMenuNavItemProps {
  label: string
  icon: React.ReactNode
  isExpanded: boolean
  isActive: boolean
  onToggle: () => void
  children: React.ReactNode
}

function SubMenuNavItem({ label, icon, isExpanded, isActive, onToggle, children }: SubMenuNavItemProps) {
  return (
    <li>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-colors group ${
          isActive 
            ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600' 
            : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className={`transition-colors ${
            isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-600'
          }`}>{icon}</span>
          <span className={`font-medium ${
            isActive ? 'text-blue-700' : 'group-hover:text-gray-900'
          }`}>{label}</span>
        </div>
        <span className={`transition-transform ${
          isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-600'
        }`}>
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </button>
      {isExpanded && (
        <ul className="mt-1 ml-4 space-y-1">
          {children}
        </ul>
      )}
    </li>
  )
}

interface SubNavItemProps {
  href: string
  icon: React.ReactNode
  label: string
  isActive?: boolean
}

function SubNavItem({ href, icon, label, isActive = false }: SubNavItemProps) {
  return (
    <li>
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