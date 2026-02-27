"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Eye, EyeOff, ArrowRight, Sparkles } from "lucide-react"
import axios from "axios"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export default function SignUpPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001"

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      if (!agreed) {
        setError("Please accept the Terms of Service and Privacy Policy.")
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

      await axios.post(
        `${BACKEND_URL}/api/register`,
        {
          first_name: firstName,
          last_name: lastName,
          email,
          password,
        },
        { withCredentials: true }
      )

      router.push(`/signin?registered=1&email=${encodeURIComponent(email)}`)
    } catch (err) {
      console.error("Registration failed:", err)
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Registration failed. Please try again."
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-black text-white">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-4 py-10 md:grid-cols-2 md:items-stretch md:py-16">
        <div className="relative overflow-hidden rounded-2xl border border-gray-800 bg-gradient-to-br from-purple-600/15 via-blue-600/10 to-transparent p-8">
          <div className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-purple-500/15 blur-3xl" />
          <div className="absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-sm text-purple-200">
              <Sparkles className="h-4 w-4" />
              Build your preference profile
            </div>
            <h1 className="mt-6 text-4xl font-black leading-tight">
              Create your VariantWise account
              <span className="block bg-clip-text text-transparent bg-gradient-to-r from-purple-300 via-blue-300 to-purple-300">
                in under a minute.
              </span>
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-gray-300">
              Save searches, revisit recommendations, and generate deep-dive reports anytime.
            </p>
            <div className="mt-8 flex flex-wrap gap-2 text-xs text-gray-300">
              <span className="rounded-full border border-gray-800 bg-gray-900/60 px-3 py-1">Faster comparisons</span>
              <span className="rounded-full border border-gray-800 bg-gray-900/60 px-3 py-1">Saved shortlists</span>
              <span className="rounded-full border border-gray-800 bg-gray-900/60 px-3 py-1">Personalized consultant</span>
            </div>
          </div>
        </div>

        <Card className="w-full border-gray-800 bg-gradient-to-b from-gray-950 to-black shadow-xl shadow-purple-500/5">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl font-bold text-white">Sign up</CardTitle>
            <CardDescription className="text-gray-400">
              Create an account with email, or continue with Google.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-gray-200">First name</Label>
                  <Input
                    id="firstName"
                    placeholder="John"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                    className="border-gray-800 bg-gray-950 text-white placeholder:text-gray-600 focus-visible:ring-purple-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-gray-200">Last name</Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                    className="border-gray-800 bg-gray-950 text-white placeholder:text-gray-600 focus-visible:ring-purple-500/50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-200">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="border-gray-800 bg-gray-950 text-white placeholder:text-gray-600 focus-visible:ring-purple-500/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-200">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="pr-10 border-gray-800 bg-gray-950 text-white placeholder:text-gray-600 focus-visible:ring-purple-500/50"
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
                <Label htmlFor="confirmPassword" className="text-gray-200">Confirm password</Label>
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

              <div className="flex items-start gap-2">
                <Checkbox
                  id="terms"
                  checked={agreed}
                  onCheckedChange={(v) => setAgreed(Boolean(v))}
                  className="mt-1 border-gray-700 data-[state=checked]:bg-white data-[state=checked]:text-black"
                />
                <Label htmlFor="terms" className="text-sm text-gray-400 leading-relaxed">
                  I agree to the{" "}
                  <Link href="/terms" className="text-blue-300 hover:text-white hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-blue-300 hover:text-white hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </Label>
              </div>

              {error ? (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700"
                disabled={isLoading}
              >
                {isLoading ? "Creating account..." : (
                  <span className="inline-flex items-center gap-2">
                    Create account
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
              className={cn(
                buttonVariants({ variant: "outline" }),
                "w-full border-gray-800 bg-transparent text-white hover:bg-gray-950"
              )}
            >
              Continue with Google
            </a>

            <div className="text-center text-sm text-gray-400">
              Already have an account?{" "}
              <Link href="/signin" className="text-blue-300 hover:text-white hover:underline">
                Sign in
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
