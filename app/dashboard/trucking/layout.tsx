import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Trucking Center - Timberline Logistics",
  description: "Manage truckloads and drivers for Timberline Logistics",
}

export default function TruckingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 