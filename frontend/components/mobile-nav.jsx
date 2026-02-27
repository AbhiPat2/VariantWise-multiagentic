"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu } from "lucide-react"
import { usePathname } from "next/navigation"

export function MobileNav() {
  const [open, setOpen] = React.useState(false)
  const pathname = usePathname()

  const isAuthPage =
    pathname === "/signin" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password"

  const links = [
    { href: "/", label: "Home" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/consultant", label: "Consultation" },
  ]

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="border border-white/14 bg-white/5 text-white hover:bg-white/12 md:hidden"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex flex-col border-r border-white/10 bg-[rgba(8,14,25,0.95)] backdrop-blur-xl">
        <nav className="mt-8 flex flex-col gap-2">
          {links.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl px-3 py-2 text-base font-semibold transition-colors ${
                  active ? "bg-white/12 text-white" : "text-[rgba(255,255,255,0.78)] hover:bg-white/8 hover:text-white"
                }`}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        {!isAuthPage && (
          <div className="mb-8 mt-auto space-y-2">
            <Link href="/consultant" onClick={() => setOpen(false)}>
              <Button className="vw-btn-primary vw-stage-desire w-full">Get Started</Button>
            </Link>
            <Link href="/signin" onClick={() => setOpen(false)}>
              <Button className="vw-btn-secondary w-full">Sign In</Button>
            </Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
