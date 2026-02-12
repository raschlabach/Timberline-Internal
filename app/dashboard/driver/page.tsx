import { redirect } from "next/navigation"

/**
 * Driver portal root page - redirects to the planner view
 */
export default function DriverPortal() {
  redirect("/dashboard/driver/planner")
}
