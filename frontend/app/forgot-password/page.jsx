"use client"

import { useState } from "react"
import Link from "next/link"
import axios from "axios"
import { Mail, ArrowRight, KeyRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [resetUrl, setResetUrl] = useState("")

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001"

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccess("")
    setResetUrl("")

    try {
      const res = await axios.post(
        `${BACKEND_URL}/api/request-password-reset`,
        { email },
        { withCredentials: true }
      )
      setSuccess(res.data?.message || "If that email exists, we sent a reset link.")
      if (res.data?.reset_url) setResetUrl(res.data.reset_url)
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Could not start password reset. Please try again."
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

        <Card className="border-gray-800 bg-gradient-to-b from-gray-950 to-black shadow-xl shadow-blue-500/5">
          <CardHeader className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-800 bg-gray-900/60 px-3 py-1 text-sm text-gray-300 w-fit">
              <KeyRound className="h-4 w-4" />
              Password reset
            </div>
            <CardTitle className="text-2xl font-bold text-white">Forgot your password?</CardTitle>
            <CardDescription className="text-gray-400">
              Enter your email and we’ll generate a reset link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-200">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="pl-10 border-gray-800 bg-gray-950 text-white placeholder:text-gray-600 focus-visible:ring-blue-500/50"
                  />
                </div>
              </div>

              {error ? (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                  {success}
                </div>
              ) : null}

              {resetUrl ? (
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-sm text-blue-200">
                  Dev shortcut:{" "}
                  <a href={resetUrl} className="underline hover:text-white">
                    Open reset link
                  </a>
                </div>
              ) : null}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
              >
                {isLoading ? "Generating link..." : (
                  <span className="inline-flex items-center gap-2">
                    Send reset link
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="border-t border-gray-800 pt-6">
            <p className="text-xs text-gray-500">
              If you signed up with Google, you may not have a password set. Try “Continue with Google” on the sign-in page.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
