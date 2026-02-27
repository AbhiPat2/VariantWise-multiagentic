"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye, EyeOff, ArrowRight, ShieldCheck } from "lucide-react"
import axios from "axios"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export default function SignInClient() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001"
  const registered = searchParams.get("registered") === "1"
  const resetDone = searchParams.get("reset") === "1"
  const prefillEmail = searchParams.get("email") || ""

  useEffect(() => {
    if (!email && prefillEmail) setEmail(prefillEmail)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillEmail])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/login`,
        { email, password },
        { withCredentials: true }
      )
      console.log("Login successful:", response.data)
      router.push("/dashboard")
    } catch (err) {
      console.error("Login failed:", err)
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Login failed. Please check your email and password."
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-black text-white">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-4 py-10 md:grid-cols-2 md:items-stretch md:py-16">
        <div className="relative overflow-hidden rounded-2xl border border-gray-800 bg-gradient-to-br from-cyan-500/15 via-orange-500/10 to-transparent p-8">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-orange-500/15 blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-sm text-blue-200">
              <ShieldCheck className="h-4 w-4" />
              Secure sign in
            </div>
            <h1 className="mt-6 text-4xl font-black leading-tight">
              Pick the right variant,
              <span className="block bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-orange-300 to-cyan-300">
                confidently.
              </span>
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-gray-300">
              VariantWise helps you cut through model noise and marketing fluff, compare real variants, ask questions, and get recommendations
              that match your priorities.
            </p>
            <div className="mt-8 flex flex-wrap gap-2 text-xs text-gray-300">
              <span className="rounded-full border border-gray-800 bg-gray-900/60 px-3 py-1">Variant-level data</span>
              <span className="rounded-full border border-gray-800 bg-gray-900/60 px-3 py-1">Chat-based consultant</span>
              <span className="rounded-full border border-gray-800 bg-gray-900/60 px-3 py-1">Deep-dive reports</span>
            </div>
          </div>
        </div>

        <Card className="w-full border-gray-800 bg-gradient-to-b from-gray-950 to-black shadow-xl shadow-blue-500/5">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl font-bold text-white">Sign in</CardTitle>
            <CardDescription className="text-gray-400">
              Use your email and password, or continue with Google.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {registered ? (
              <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                Account created. You can sign in now.
              </div>
            ) : null}
            {resetDone ? (
              <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                Password updated. Please sign in with your new password.
              </div>
            ) : null}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-200">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="border-gray-800 bg-gray-950 text-white placeholder:text-gray-600 focus-visible:ring-blue-500/50"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-gray-200">
                    Password
                  </Label>
                  <Link href="/forgot-password" className="text-xs text-gray-400 hover:text-white hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="pr-10 border-gray-800 bg-gray-950 text-white placeholder:text-gray-600 focus-visible:ring-blue-500/50"
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
              </div>

              {error ? (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                className="w-full bg-[linear-gradient(92deg,rgba(56,189,248,0.96),rgba(251,146,60,0.96))] text-slate-950 hover:brightness-110"
                disabled={isLoading}
              >
                {isLoading ? (
                  "Signing in..."
                ) : (
                  <span className="inline-flex items-center gap-2">
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 border-t border-gray-800 pt-6">
            <div className="relative flex w-full items-center">
              <div className="flex-grow border-t border-gray-800"></div>
              <span className="mx-4 flex-shrink text-xs text-gray-500">or</span>
              <div className="flex-grow border-t border-gray-800"></div>
            </div>

            <a
              href={`${BACKEND_URL}/api/auth/google`}
              className={cn(buttonVariants({ variant: "outline" }), "w-full border-gray-800 bg-transparent text-white hover:bg-gray-950")}
            >
              Continue with Google
            </a>

            <div className="text-center text-sm text-gray-400">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-blue-300 hover:text-white hover:underline">
                Sign up
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
