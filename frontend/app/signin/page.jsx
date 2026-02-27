import { Suspense } from "react"
import SignInClient from "./sign-in-client"

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-4rem)] bg-black text-white flex items-center justify-center">
          Loading…
        </div>
      }
    >
      <SignInClient />
    </Suspense>
  )
}

