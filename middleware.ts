import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Pages that rip_operator role CAN access
const RIP_OPERATOR_ALLOWED_PATHS = [
  '/dashboard/lumber/overview',
  '/dashboard/lumber/rip-entry',
  '/dashboard/lumber/daily-hours',
  '/dashboard/lumber/ripped-packs',
]

/**
 * Middleware that runs on specific routes to protect them from unauthorized access
 */
export async function middleware(request: NextRequest) {
  // Get the pathname
  const path = request.nextUrl.pathname
  
  // Middleware processing - logging disabled to reduce noise
  
  // Public paths that don't require authentication
  const isPublicPath = path === '/auth/login' || 
                       path === '/auth/error' ||
                       path.startsWith('/auth/error');
  
  // API paths and static assets that should bypass auth checks
  const isBypassPath = path.startsWith('/api/auth') || 
                       path === '/api/test-db' ||  // Allow test endpoint
                       path.startsWith('/_next') || 
                       path.includes('/favicon.ico') ||
                       path.startsWith('/images/');
  
  // API paths that require authentication
  const isProtectedApiPath = path.startsWith('/api/') && 
                            !path.startsWith('/api/auth') &&
                            path !== '/api/test-db';  // Don't protect test endpoint
  
  if (isBypassPath && !isProtectedApiPath) {
    return NextResponse.next();
  }
  
  // Get the auth token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  });
  
  const isAuthenticated = !!token;
  
  // Auth status logging disabled to reduce noise
  
  // Handle API routes
  if (isProtectedApiPath) {
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }
  
  // Redirect unauthenticated users to login
  if (!isAuthenticated && !isPublicPath) {
    
    // Construct a proper URL with callbackUrl parameter
    const url = new URL('/auth/login', request.url);
    url.searchParams.set('callbackUrl', path);
    
    return NextResponse.redirect(url);
  }
  
  // Redirect authenticated users away from login page
  if (isAuthenticated && isPublicPath) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  // Role-based access control for rip_operator
  if (isAuthenticated && token?.role === 'rip_operator') {
    // Check if trying to access a restricted page
    const isDashboardPath = path.startsWith('/dashboard')
    
    if (isDashboardPath) {
      // Check if the path is allowed for rip_operator
      const isAllowed = RIP_OPERATOR_ALLOWED_PATHS.some(allowedPath => 
        path === allowedPath || path.startsWith(allowedPath + '/')
      )
      
      // If not allowed, redirect to overview (their main page)
      if (!isAllowed) {
        return NextResponse.redirect(new URL('/dashboard/lumber/overview', request.url));
      }
    }
  }
  
  return NextResponse.next();
}

/**
 * Configure which paths the middleware runs on
 */
export const config = {
  matcher: [
    // Match all request paths except for the ones starting with:
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
} 