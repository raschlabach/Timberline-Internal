import { redirect } from "next/navigation"

/**
 * Root page that redirects to the dashboard
 */
export default function Home() {
  // In a real app, we'd check authentication state here
  // and redirect to login if needed
  redirect("/dashboard")
} 