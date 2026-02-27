"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import axios from "axios"
import { Eye, EyeOff, ArrowRight, KeyRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ResetPasswordClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = useMemo(() => searchParams.get("token") || "", [searchParams])

  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001"

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      if (!token) {
        setError("Missing reset token. Please request a new link.")
        return
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters long.")
        return
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.")
        return
      }

      const res = await axios.post(
        `${BACKEND_URL}/api/reset-password`,
        { token, new_password: password },
        { withCredentials: true }
      )

      const email = res.data?.email || ""
      router.push(`/signin?reset=1${email ? `&email=${encodeURIComponent(email)}` : ""}`)
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Could not reset password. Please request a new link."
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-black text-white">
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/signin" className="text-sm text-gray-400 hover:text-white hover:underline">
            Back to sign in
          </Link>
        </div>

        <Card className="border-gray-800 bg-gradient-to-b from-gray-950 to-black shadow-xl shadow-purple-500/5">
          <CardHeader className="space-y-2">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-gray-800 bg-gray-900/60 px-3 py-1 text-sm text-gray-300">
              <KeyRound className="h-4 w-4" />
              Set a new password
            </div>
            <CardTitle className="text-2xl font-bold text-white">Reset password</CardTitle>
            <CardDescription className="text-gray-400">Choose a new password for your account.</CardDescription>
          </CardHeader>
          <CardContent>
            {!token ? (
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">
                Missing token. Please start from{" "}
                <Link href="/forgot-password" className="underline hover:text-white">
                  Forgot password
                </Link>
                .
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-200">
                  New password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="border-gray-800 bg-gray-950 pr-10 text-white placeholder:text-gray-600 focus-visible:ring-purple-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-gray-500">At least 8 characters.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-gray-200">
                  Confirm new password
                </Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="border-gray-800 bg-gray-950 text-white placeholder:text-gray-600 focus-visible:ring-purple-500/50"
                />
              </div>

              {error ? (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700"
              >
                {isLoading ? (
                  "Updating..."
                ) : (
                  <span className="inline-flex items-center gap-2">
                    Update password
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="border-t border-gray-800 pt-6">
            <p className="text-xs text-gray-500">
              For security, reset links expire quickly. If this fails, request a new link.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

