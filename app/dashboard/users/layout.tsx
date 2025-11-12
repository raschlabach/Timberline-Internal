import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

export default async function UserManagementLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  
  // Check if user is authenticated
  if (!session?.user) {
    redirect('/auth/login')
  }
  
  // Check if user is admin
  if (session.user.role !== 'admin') {
    redirect('/dashboard')
  }
  
  return <>{children}</>
}
