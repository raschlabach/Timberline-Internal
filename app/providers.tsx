"use client"

import { SessionProvider } from "next-auth/react"
import { ToasterProvider } from "@/components/providers/toaster"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"
import { TruckloadProvider } from "@/providers/truckload-provider"

interface ProvidersProps {
  children: React.ReactNode
}

/**
 * Wraps the application with all required providers
 */
export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <TruckloadProvider>
          <ToasterProvider />
          {children}
        </TruckloadProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
} 