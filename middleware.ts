import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * Middleware that runs on specific routes to protect them from unauthorized access
 */
export async function middleware(request: NextRequest) {
  // Get the pathname
  const path = request.nextUrl.pathname
  
  console.log(`Middleware processing: ${path}`)
  
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
    console.log(`Bypassing auth check for: ${path}`);
    return NextResponse.next();
  }
  
  // Get the auth token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  });
  
  const isAuthenticated = !!token;
  
  console.log(`Path: ${path}, Authenticated: ${isAuthenticated}, Public: ${isPublicPath}`);
  
  // Handle API routes
  if (isProtectedApiPath) {
    if (!isAuthenticated) {
      console.log(`Unauthorized API access: ${path}`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }
  
  // Redirect unauthenticated users to login
  if (!isAuthenticated && !isPublicPath) {
    console.log(`Redirecting to login: ${path}`);
    
    // Construct a proper URL with callbackUrl parameter
    const url = new URL('/auth/login', request.url);
    url.searchParams.set('callbackUrl', path);
    
    return NextResponse.redirect(url);
  }
  
  // Redirect authenticated users away from login page
  if (isAuthenticated && isPublicPath) {
    console.log(`Redirecting authenticated user to dashboard`);
    return NextResponse.redirect(new URL('/dashboard', request.url));
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