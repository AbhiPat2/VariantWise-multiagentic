"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { MobileNav } from "@/components/mobile-nav"
import { usePathname } from "next/navigation"
import axios from "axios"

export function Navbar() {
  const [visible, setVisible] = React.useState(true)
  const [scrolled, setScrolled] = React.useState(false)
  const [user, setUser] = React.useState(null)
  const pathname = usePathname()
  const lastScrollY = React.useRef(0)
  const ticking = React.useRef(false)
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001"

  const isAuthPage =
    pathname === "/signin" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password"

  React.useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return
      ticking.current = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        setScrolled(y > 20)
        if (y < 60) {
          setVisible(true)
        } else if (y > lastScrollY.current + 8) {
          setVisible(false)
        } else if (y < lastScrollY.current - 8) {
          setVisible(true)
        }
        lastScrollY.current = y
        ticking.current = false
      })
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      axios
        .get(`${BACKEND_URL}/api/me`, { withCredentials: true })
        .then((res) => setUser(res.data.user))
        .catch(() => setUser(null))
    }, 220)
    return () => clearTimeout(timeout)
  }, [pathname, BACKEND_URL])

  const handleLogout = async () => {
    try {
      await axios.post(`${BACKEND_URL}/api/logout`, {}, { withCredentials: true })
    } finally {
      setUser(null)
      window.location.href = "/signin"
    }
  }

  const NAV_ITEMS = [
    { href: "/", label: "Home" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/consultant", label: "Consultation" },
  ]

  return (
    <header
      className="fixed inset-x-0 top-4 z-50 flex justify-center px-4 sm:top-6"
      style={{
        transform: visible ? "translateY(0)" : "translateY(-150%)",
        transition: "transform 500ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <div
        className="flex w-full max-w-[1400px] items-center justify-between rounded-[24px] pl-6 pr-2.5 py-2.5 transition-all duration-500"
        style={{
          background: scrolled 
            ? "linear-gradient(160deg, rgba(30, 24, 45, 0.6) 0%, rgba(15, 12, 22, 0.7) 100%)" 
            : "linear-gradient(160deg, rgba(30, 24, 45, 0.2) 0%, rgba(15, 12, 22, 0.25) 100%)",
          backdropFilter: scrolled ? "blur(32px) saturate(160%)" : "blur(16px) saturate(140%)",
          WebkitBackdropFilter: scrolled ? "blur(32px) saturate(160%)" : "blur(16px) saturate(140%)",
          border: scrolled ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(255, 255, 255, 0.06)",
          boxShadow: scrolled
            ? "0 24px 48px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 0 0 1px rgba(133, 213, 237, 0.08)"
            : "0 8px 24px -8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        }}
      >
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <MobileNav />
          <Link href="/" className="group flex items-center">
            <span
              className="text-[22px] font-extrabold tracking-[-0.04em] text-white transition-all duration-300 group-hover:text-[rgba(255,255,255,0.9)]"
              style={{
                textShadow: "0 2px 16px rgba(255,255,255,0.25), 0 0 40px rgba(133,213,237,0.15)",
              }}
            >
              VariantWise
            </span>
          </Link>
        </div>

        {/* Center: Nav Links */}
        <nav 
          className="hidden items-center gap-1 rounded-2xl p-1.5 md:flex backdrop-blur-xl"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex items-center justify-center rounded-xl px-5 py-2 text-[12px] font-bold transition-all duration-250"
                style={{
                  color: active ? "#ffffff" : "rgba(255,255,255,0.4)",
                  background: active ? "rgba(255,255,255,0.12)" : "transparent",
                  border: active ? "1px solid rgba(255,255,255,0.25)" : "1px solid transparent",
                  boxShadow: active ? "0 0 20px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.05)" : "none",
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.9)"
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.4)"
                }}
              >
                <span className="relative z-10">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {!isAuthPage && (
            <>
              {user ? (
                <>
                  <span className="hidden px-2 text-[14px] font-medium text-[rgba(255,255,255,0.45)] md:inline">
                    {user.first_name}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="hidden items-center gap-1.5 rounded-[14px] px-5 py-2.5 text-[14px] font-bold transition-all duration-200 md:inline-flex"
                    style={{
                      color: "rgba(255,100,100,0.9)",
                      background: "rgba(255,60,60,0.08)",
                      border: "1px solid rgba(255,60,60,0.15)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255,60,60,0.14)"
                      e.currentTarget.style.borderColor = "rgba(255,60,60,0.25)"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255,60,60,0.08)"
                      e.currentTarget.style.borderColor = "rgba(255,60,60,0.15)"
                    }}
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link
                  href="/signin"
                  className="vw-btn-primary hidden items-center gap-1.5 text-[14px] md:inline-flex !rounded-[16px] !py-2.5 !px-6"
                >
                  Sign In
                  <ArrowRight size={14} />
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  )
}
