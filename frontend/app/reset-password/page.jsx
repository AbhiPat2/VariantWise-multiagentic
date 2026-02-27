import { Suspense } from "react"
import ResetPasswordClient from "./reset-password-client"

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-4rem)] bg-black text-white">
          <div className="mx-auto w-full max-w-2xl px-4 py-12">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <div className="h-5 w-48 animate-pulse rounded bg-white/10" />
              <div className="mt-3 h-4 w-80 animate-pulse rounded bg-white/10" />
              <div className="mt-6 h-10 w-full animate-pulse rounded bg-white/10" />
              <div className="mt-3 h-10 w-full animate-pulse rounded bg-white/10" />
              <div className="mt-5 h-11 w-full animate-pulse rounded bg-white/10" />
            </div>
          </div>
        </div>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  )
}

