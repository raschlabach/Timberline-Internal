import { Suspense } from "react"
import AuthErrorContent from "./error-content"

export const dynamic = "force-dynamic"

export default function AuthErrorPage() {
  return (
    <Suspense fallback={null}>
      <AuthErrorContent />
    </Suspense>
  )
}
