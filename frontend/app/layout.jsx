import "@/app/globals.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Navbar } from "@/components/navbar"
import Link from "next/link"
import { Toaster } from "@/components/ui/sonner"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-ui",
  weight: ["400", "500", "600", "700", "800"],
})

export const metadata = {
  title: "VariantWise - Your Personalized Car Consultant",
  description:
    "Make informed car buying decisions with AI-powered insights on specific variants, real-world experiences, and personalized recommendations.",
  generator: "v0.dev",
}

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1e0711" },
    { media: "(prefers-color-scheme: dark)", color: "#1e0711" },
  ],
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${inter.className} min-h-screen bg-[rgb(var(--vw-bg))] text-[rgb(var(--vw-text-strong))]`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange={false}>
          <Navbar />
          {children}
          <Toaster richColors closeButton />
          <footer className="relative border-t border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] py-10">
            <span className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-[radial-gradient(circle_at_50%_0%,rgba(var(--portland-orange),0.08),rgba(var(--portland-orange),0)_72%)]" />
            <div className="container relative flex flex-col items-center justify-between gap-4 px-4 md:flex-row md:px-6">
              <p className="text-xs text-[rgb(var(--vw-text-muted))]">© {new Date().getFullYear()} VariantWise</p>
              <nav className="flex gap-4 sm:gap-6">
                <Link href="/terms" className="text-xs text-[rgb(var(--vw-text-muted))] hover:text-[rgb(var(--vw-text-strong))]">
                  Terms
                </Link>
                <Link href="/privacy" className="text-xs text-[rgb(var(--vw-text-muted))] hover:text-[rgb(var(--vw-text-strong))]">
                  Privacy
                </Link>
                <Link href="/contact" className="text-xs text-[rgb(var(--vw-text-muted))] hover:text-[rgb(var(--vw-text-strong))]">
                  Contact
                </Link>
              </nav>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  )
}
