"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight, RefreshCw, Search, SlidersHorizontal, Sparkles, X } from "lucide-react"

const DEFAULT_PRICE_RANGE = [0, 100]

const makePlaceholder = (title = "VariantWise") => {
  const safe = encodeURIComponent(title)
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='900' height='520' viewBox='0 0 900 520'>
    <defs>
      <linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0' stop-color='#0f1220'/>
        <stop offset='1' stop-color='#141a2b'/>
      </linearGradient>
      <radialGradient id='r1' cx='20%' cy='10%' r='80%'>
        <stop offset='0' stop-color='rgba(255,91,53,0.45)'/>
        <stop offset='1' stop-color='rgba(255,91,53,0)'/>
      </radialGradient>
      <radialGradient id='r2' cx='90%' cy='20%' r='70%'>
        <stop offset='0' stop-color='rgba(133,213,237,0.38)'/>
        <stop offset='1' stop-color='rgba(133,213,237,0)'/>
      </radialGradient>
    </defs>
    <rect width='900' height='520' fill='url(#bg)'/>
    <rect width='900' height='520' fill='url(#r1)'/>
    <rect width='900' height='520' fill='url(#r2)'/>
    <path d='M148 334c76-90 178-140 304-150h98c127 10 229 60 304 150' fill='none' stroke='rgba(255,255,255,0.20)' stroke-width='8' stroke-linecap='round'/>
    <circle cx='300' cy='350' r='42' fill='rgba(255,255,255,0.06)' stroke='rgba(255,255,255,0.20)'/>
    <circle cx='612' cy='350' r='42' fill='rgba(255,255,255,0.06)' stroke='rgba(255,255,255,0.20)'/>
    <text x='56' y='88' font-family='Inter,system-ui,sans-serif' font-size='24' fill='rgba(255,255,255,0.9)'>${safe}</text>
    <text x='56' y='120' font-family='Inter,system-ui,sans-serif' font-size='13' fill='rgba(255,255,255,0.55)'>Variant preview</text>
  </svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const parseCSVLine = (line) => {
  const result = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

const toLakhs = (price) => {
  const raw = String(price || "").replace(/[^\d.]/g, "")
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value)) return 0
  return value < 1000 ? value : value / 100000
}

const formatLakhs = (value) => `₹${value.toFixed(1)}L`

const normalize = (value) => String(value || "").trim().toLowerCase()

export default function DashboardPage() {
  const reduceMotion = useReducedMotion()

  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [searchTerm, setSearchTerm] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)

  const [selectedFuelType, setSelectedFuelType] = useState("All")
  const [selectedTransmission, setSelectedTransmission] = useState("All")
  const [selectedBodyType, setSelectedBodyType] = useState("All")
  const [sortBy, setSortBy] = useState("price-low")
  const [priceRange, setPriceRange] = useState(DEFAULT_PRICE_RANGE)
  const [maxDatasetPrice, setMaxDatasetPrice] = useState(DEFAULT_PRICE_RANGE[1])

  useEffect(() => {
    let cancelled = false

    const fetchCars = async () => {
      try {
        setLoading(true)
        setError("")

        const response = await fetch("/data/final_dataset.csv")
        if (!response.ok) {
          throw new Error(`Dataset request failed (${response.status})`)
        }

        const csvText = await response.text()
        const lines = csvText.split(/\r?\n/).filter((line) => line.trim())

        if (lines.length < 2) {
          throw new Error("Dataset is empty or malformed")
        }

        const headers = parseCSVLine(lines[0]).map((header) =>
          header.trim().replace(/^['\"]|['\"]$/g, "")
        )

        const parsedCars = []

        for (let i = 1; i < lines.length; i += 1) {
          const values = parseCSVLine(lines[i])
          if (!values.length) continue

          const row = {}
          headers.forEach((header, index) => {
            row[header] = (values[index] || "").trim().replace(/^['\"]|['\"]$/g, "")
          })

          const variant = row.variant || row.Variant || ""
          const price = row.price || row.Price || ""
          if (!variant || !price) continue

          const parts = variant.split(" ").filter(Boolean)
          const brand = parts[0] || "Unknown"
          const model = parts[1] || "Model"

          const fuelType = row["Fuel Type"] || "N/A"
          let mileage = "N/A"
          if (normalize(fuelType).includes("petrol")) {
            mileage = row["Petrol Mileage ARAI"] || row["Petrol Mileage (ARAI)"] || "N/A"
          } else if (normalize(fuelType).includes("diesel")) {
            mileage = row["Diesel Mileage ARAI"] || "N/A"
          } else if (normalize(fuelType).includes("electric")) {
            mileage = row.Range || "N/A"
          } else if (normalize(fuelType).includes("cng")) {
            mileage = row["CNG Mileage ARAI"] || "N/A"
          }

          parsedCars.push({
            id: `${variant}-${i}`,
            variant,
            brand,
            model,
            price,
            priceLakhs: toLakhs(price),
            fuelType,
            transmission: row["Transmission Type"] || "N/A",
            power: row["Max Power"] || "N/A",
            mileage,
            bodyType: row["Body Type"] || "N/A",
            seating: row["Seating Capacity"] || "N/A",
            image: makePlaceholder(`${brand} ${model}`.trim() || "VariantWise"),
          })
        }

        if (!cancelled) {
          setCars(parsedCars)

          if (parsedCars.length > 0) {
            const maxPrice = Math.max(
              1,
              Math.ceil(Math.max(...parsedCars.map((car) => car.priceLakhs || 0)))
            )
            setMaxDatasetPrice(maxPrice)
            setPriceRange([0, maxPrice])
          } else {
            setMaxDatasetPrice(DEFAULT_PRICE_RANGE[1])
            setPriceRange(DEFAULT_PRICE_RANGE)
            setError("No variants found in dataset.")
          }
        }
      } catch (err) {
        if (!cancelled) {
          setCars([])
          setMaxDatasetPrice(DEFAULT_PRICE_RANGE[1])
          setPriceRange(DEFAULT_PRICE_RANGE)
          setError(err?.message || "Failed to load dashboard data")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchCars()

    return () => {
      cancelled = true
    }
  }, [])

  const fuelTypes = useMemo(
    () => [
      "All",
      ...new Set(cars.map((car) => car.fuelType).filter((fuel) => fuel && fuel !== "N/A")).values(),
    ],
    [cars]
  )

  const transmissions = useMemo(
    () => [
      "All",
      ...new Set(
        cars
          .map((car) => car.transmission)
          .filter((transmission) => transmission && transmission !== "N/A")
      ).values(),
    ],
    [cars]
  )

  const bodyTypes = useMemo(
    () => [
      "All",
      ...new Set(cars.map((car) => car.bodyType).filter((bodyType) => bodyType && bodyType !== "N/A")).values(),
    ],
    [cars]
  )

  const suggestions = useMemo(() => {
    const query = normalize(searchTerm)
    if (!query) return []

    const grouped = new Map()

    cars.forEach((car) => {
      const haystack = `${car.variant} ${car.brand} ${car.model}`.toLowerCase()
      if (!haystack.includes(query)) return

      const key = `${car.brand} ${car.model}`.trim()
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          text: key,
          prices: [],
        })
      }
      grouped.get(key).prices.push(car.priceLakhs)
    })

    return Array.from(grouped.values())
      .map((entry) => {
        const prices = entry.prices.filter((price) => Number.isFinite(price)).sort((a, b) => a - b)
        const min = prices[0] ?? 0
        const max = prices[prices.length - 1] ?? 0
        return {
          id: entry.id,
          text: entry.text,
          priceRange: prices.length ? `${formatLakhs(min)} - ${formatLakhs(max)}` : "",
        }
      })
      .slice(0, 8)
  }, [cars, searchTerm])

  const filteredCars = useMemo(() => {
    const query = normalize(searchTerm)

    return cars.filter((car) => {
      const matchesSearch =
        !query ||
        normalize(car.variant).includes(query) ||
        normalize(car.brand).includes(query) ||
        normalize(car.model).includes(query)

      const matchesFuel =
        selectedFuelType === "All" ||
        normalize(car.fuelType) === normalize(selectedFuelType)

      const matchesTransmission =
        selectedTransmission === "All" ||
        normalize(car.transmission) === normalize(selectedTransmission)

      const matchesBodyType =
        selectedBodyType === "All" ||
        normalize(car.bodyType) === normalize(selectedBodyType)

      const matchesPrice =
        car.priceLakhs >= (priceRange[0] || 0) && car.priceLakhs <= (priceRange[1] || maxDatasetPrice)

      return matchesSearch && matchesFuel && matchesTransmission && matchesBodyType && matchesPrice
    })
  }, [
    cars,
    searchTerm,
    selectedFuelType,
    selectedTransmission,
    selectedBodyType,
    priceRange,
    maxDatasetPrice,
  ])

  const sortedCars = useMemo(() => {
    const sorted = [...filteredCars]
    sorted.sort((a, b) => {
      if (sortBy === "name") return a.variant.localeCompare(b.variant)
      if (sortBy === "price-high") return (b.priceLakhs || 0) - (a.priceLakhs || 0)
      return (a.priceLakhs || 0) - (b.priceLakhs || 0)
    })
    return sorted
  }, [filteredCars, sortBy])

  const activeFilterChips = useMemo(() => {
    const chips = []
    if (selectedFuelType !== "All") chips.push(selectedFuelType)
    if (selectedTransmission !== "All") chips.push(selectedTransmission)
    if (selectedBodyType !== "All") chips.push(selectedBodyType)
    chips.push(`${formatLakhs(priceRange[0] || 0)}-${formatLakhs(priceRange[1] || maxDatasetPrice)}`)
    return chips
  }, [selectedFuelType, selectedTransmission, selectedBodyType, priceRange, maxDatasetPrice])

  const resetFilters = () => {
    setSearchTerm("")
    setSelectedFuelType("All")
    setSelectedTransmission("All")
    setSelectedBodyType("All")
    setSortBy("price-low")
    setPriceRange([0, maxDatasetPrice])
    setShowSuggestions(false)
    setSelectedSuggestionIndex(-1)
  }

  const onSearchInputKeyDown = (event) => {
    if (!showSuggestions || suggestions.length === 0) return

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setSelectedSuggestionIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : suggestions.length - 1
      )
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1))
    } else if (event.key === "Enter" && selectedSuggestionIndex >= 0) {
      event.preventDefault()
      setSearchTerm(suggestions[selectedSuggestionIndex].text)
      setShowSuggestions(false)
      setSelectedSuggestionIndex(-1)
    } else if (event.key === "Escape") {
      setShowSuggestions(false)
      setSelectedSuggestionIndex(-1)
    }
  }

  const staggerContainer = reduceMotion
    ? {}
    : {
        hidden: {},
        show: {
          transition: {
            staggerChildren: 0.05,
          },
        },
      }

  const staggerItem = reduceMotion
    ? {}
    : {
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
      }

  return (
    <div className="relative min-h-screen text-[rgb(var(--vw-text-strong))]">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute inset-[-18%]"
          style={{
            background:
              "radial-gradient(ellipse 72% 58% at 8% 12%, rgba(255,91,53,0.14), transparent 65%), radial-gradient(ellipse 70% 56% at 90% 8%, rgba(133,213,237,0.13), transparent 62%), radial-gradient(ellipse 80% 66% at 52% 100%, rgba(160,120,240,0.11), transparent 64%), linear-gradient(180deg, rgba(7,9,14,0.98), rgba(7,9,14,1))",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(133,213,237,0.22) 1px, transparent 1.2px)",
            backgroundSize: "30px 30px",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-[1560px] px-4 pb-16 pt-[176px] sm:px-6 lg:px-8">
        <header className="mb-8 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(133,213,237,0.25)] bg-[rgba(133,213,237,0.09)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[rgba(133,213,237,0.88)]">
              <Sparkles size={12} /> Variant Intelligence Dashboard
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
              Discover trim-level variants with precision.
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-[rgba(255,255,255,0.62)] sm:text-base">
              Filter by budget, body style, fuel, and transmission, then open full variant reports powered by the same reasoning layer as consultation.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:w-[340px]">
            <MetricCard label="Variants indexed" value={loading ? "..." : cars.length.toLocaleString()} />
            <MetricCard label="Current matches" value={loading ? "..." : sortedCars.length.toLocaleString()} />
          </div>
        </header>

        <section className="rounded-[28px] border border-[rgba(133,213,237,0.15)] bg-[rgba(16,14,26,0.72)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.35)]" size={18} />
              <input
                type="text"
                placeholder="Search variants, brands, or models"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value)
                  setShowSuggestions(true)
                  setSelectedSuggestionIndex(-1)
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
                onKeyDown={onSearchInputKeyDown}
                className="w-full rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] py-3 pl-12 pr-11 text-sm text-white placeholder:text-[rgba(255,255,255,0.30)] focus:border-[rgba(133,213,237,0.36)] focus:outline-none focus:ring-2 focus:ring-[rgba(133,213,237,0.18)]"
              />
              {searchTerm ? (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setSearchTerm("")
                    setShowSuggestions(false)
                    setSelectedSuggestionIndex(-1)
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.06)] p-1.5 text-[rgba(255,255,255,0.5)] hover:text-white"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              ) : null}

              {showSuggestions && suggestions.length > 0 && searchTerm ? (
                <div className="absolute left-0 right-0 top-full z-50 mt-3 overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(14,13,22,0.96)] shadow-[0_24px_44px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
                  {suggestions.map((suggestion, index) => (
                    <button
                      type="button"
                      key={suggestion.id}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setSearchTerm(suggestion.text)
                        setShowSuggestions(false)
                        setSelectedSuggestionIndex(-1)
                      }}
                      className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors ${
                        index === selectedSuggestionIndex
                          ? "bg-[rgba(133,213,237,0.12)] text-white"
                          : "text-[rgba(255,255,255,0.82)] hover:bg-[rgba(133,213,237,0.08)]"
                      }`}
                    >
                      <span className="font-medium">{suggestion.text}</span>
                      <span className="text-[11px] text-[rgba(255,255,255,0.48)]">{suggestion.priceRange}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[rgba(255,255,255,0.62)]">
                <SlidersHorizontal size={14} /> Active filters
              </span>
              {activeFilterChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-[rgba(255,91,53,0.28)] bg-[rgba(255,91,53,0.12)] px-3 py-1.5 text-[11px] font-semibold text-[rgba(255,91,53,0.92)]"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <SelectField label="Fuel" value={selectedFuelType} onChange={setSelectedFuelType} options={fuelTypes} />
            <SelectField
              label="Transmission"
              value={selectedTransmission}
              onChange={setSelectedTransmission}
              options={transmissions}
            />
            <SelectField label="Body" value={selectedBodyType} onChange={setSelectedBodyType} options={bodyTypes} />
            <SelectField
              label="Sort"
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: "price-low", label: "Price: low to high" },
                { value: "price-high", label: "Price: high to low" },
                { value: "name", label: "Name" },
              ]}
            />

            <div className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[rgba(255,255,255,0.48)]">Budget in lakhs</p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={priceRange[1]}
                  value={priceRange[0]}
                  onChange={(event) => {
                    const nextMin = Math.max(0, Number(event.target.value || 0))
                    setPriceRange([Math.min(nextMin, priceRange[1]), priceRange[1]])
                  }}
                  className="w-full rounded-xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.05)] px-3 py-2 text-sm text-white focus:border-[rgba(133,213,237,0.35)] focus:outline-none"
                />
                <span className="text-[rgba(255,255,255,0.42)]">to</span>
                <input
                  type="number"
                  min={priceRange[0]}
                  max={maxDatasetPrice}
                  value={priceRange[1]}
                  onChange={(event) => {
                    const nextMax = Math.max(0, Number(event.target.value || 0))
                    setPriceRange([priceRange[0], Math.max(nextMax, priceRange[0])])
                  }}
                  className="w-full rounded-xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.05)] px-3 py-2 text-sm text-white focus:border-[rgba(133,213,237,0.35)] focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[rgba(255,255,255,0.60)]">
              {loading ? "Loading variants..." : `${sortedCars.length.toLocaleString()} matches`}
            </p>

            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] px-4 py-2 text-sm text-[rgba(255,255,255,0.72)] hover:border-[rgba(133,213,237,0.35)] hover:text-white"
            >
              <RefreshCw size={14} /> Reset filters
            </button>
          </div>
        </section>

        <section className="mt-6">
          {error ? (
            <div className="rounded-2xl border border-[rgba(255,91,53,0.18)] bg-[rgba(255,91,53,0.08)] p-5 text-[rgba(255,220,214,0.9)]">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-3 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={`skeleton-${idx}`}
                  className="overflow-hidden rounded-[24px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-4"
                >
                  <div className="h-40 w-full rounded-2xl bg-[rgba(255,255,255,0.06)] skeleton-shimmer" />
                  <div className="mt-4 h-5 w-2/3 rounded bg-[rgba(255,255,255,0.08)] skeleton-shimmer" />
                  <div className="mt-3 h-4 w-1/2 rounded bg-[rgba(255,255,255,0.08)] skeleton-shimmer" />
                </div>
              ))}
            </div>
          ) : sortedCars.length === 0 ? (
            <div className="mt-3 rounded-[24px] border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] p-10 text-center">
              <p className="text-xl font-semibold text-white">No matching variants</p>
              <p className="mt-2 text-sm text-[rgba(255,255,255,0.55)]">Relax one or more filters and run again.</p>
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="vw-btn-primary"
                >
                  Clear filters
                </button>
              </div>
            </div>
          ) : (
            <motion.div variants={staggerContainer} initial="hidden" animate="show" className="mt-3 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {sortedCars.map((car) => (
                <motion.article
                  key={car.id}
                  variants={staggerItem}
                  className="group overflow-hidden rounded-[24px] border border-[rgba(133,213,237,0.16)] bg-[rgba(16,14,26,0.7)] shadow-[0_20px_48px_rgba(0,0,0,0.35)] transition-all hover:border-[rgba(255,91,53,0.35)]"
                >
                  <div className="relative h-44 w-full overflow-hidden">
                    <img src={car.image} alt={car.variant} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,9,14,0.02),rgba(7,9,14,0.55))]" />
                    <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                      <span className="rounded-full border border-[rgba(255,255,255,0.18)] bg-[rgba(7,9,14,0.65)] px-3 py-1 text-[10px] font-semibold text-[rgba(255,255,255,0.88)]">
                        {car.brand}
                      </span>
                      <span className="rounded-full border border-[rgba(133,213,237,0.3)] bg-[rgba(133,213,237,0.12)] px-3 py-1 text-[10px] font-semibold text-[rgba(133,213,237,0.92)]">
                        {car.bodyType}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4 p-5">
                    <h3 className="line-clamp-2 min-h-[54px] text-lg font-semibold leading-snug text-white">
                      {car.variant}
                    </h3>

                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-[rgba(255,255,255,0.45)]">Price</p>
                        <p className="mt-1 text-2xl font-semibold text-white">{car.price}</p>
                      </div>
                      <span className="rounded-full border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.06)] px-3 py-1.5 text-[11px] text-[rgba(255,255,255,0.75)]">
                        {car.fuelType}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <StatPill label="Transmission" value={car.transmission} />
                      <StatPill label="Mileage/Range" value={car.mileage} />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] px-2.5 py-1 text-[11px] text-[rgba(255,255,255,0.66)]">
                        Seats {car.seating}
                      </span>
                      <span className="rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] px-2.5 py-1 text-[11px] text-[rgba(255,255,255,0.66)] line-clamp-1">
                        {car.power}
                      </span>
                    </div>

                    <Link href={`/dashboard/${encodeURIComponent(car.variant)}`} className="inline-flex w-full">
                      <span className="vw-btn-primary w-full justify-center py-3">
                        View details <ArrowRight className="ml-1 h-4 w-4" />
                      </span>
                    </Link>
                  </div>
                </motion.article>
              ))}
            </motion.div>
          )}
        </section>
      </div>
    </div>
  )
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] p-3 text-xs text-[rgba(255,255,255,0.58)]">
      <span className="mb-1.5 block font-semibold uppercase tracking-[0.1em]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[rgba(255,255,255,0.10)] bg-[rgba(7,9,14,0.72)] px-3 py-2 text-sm text-white focus:border-[rgba(133,213,237,0.35)] focus:outline-none"
      >
        {options.map((option) => {
          const isObject = typeof option === "object"
          const optionValue = isObject ? option.value : option
          const optionLabel = isObject ? option.label : option
          return (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          )
        })}
      </select>
    </label>
  )
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-[rgba(133,213,237,0.14)] bg-[rgba(16,14,26,0.66)] px-4 py-3 backdrop-blur-xl">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[rgba(255,255,255,0.45)]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  )
}

function StatPill({ label, value }) {
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] p-2.5">
      <p className="text-[10px] text-[rgba(255,255,255,0.42)]">{label}</p>
      <p className="mt-1 line-clamp-1 text-sm font-semibold text-white">{value || "N/A"}</p>
    </div>
  )
}
