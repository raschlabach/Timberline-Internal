import { redirect } from "next/navigation"

/**
 * Root page that redirects directly to the load board
 */
export default function Home() {
  redirect("/dashboard/load-board")
}