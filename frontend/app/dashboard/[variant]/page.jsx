"use client"

import Link from "next/link"
import { useEffect, useState, useRef } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { AnimatedButton } from "@/components/motion"
import { ArrowLeft, Star, Award, Battery, ThumbsUp, Shield, Fuel, Gauge, Settings, Users, Zap, Wind, TrendingUp, MessageCircle, X, Send, Bot, Minimize2, Maximize2 } from "lucide-react"
import axios from "axios"

const API_BASE_URL = "/flask-api"

export default function CarDetailsPage({ params }) {
  const [carData, setCarData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState("overview")
  const variant = decodeURIComponent(params.variant)
  
  // RAG Chatbot state
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const chatEndRef = useRef(null)
  const [sessionId, setSessionId] = useState('')
  const reduceMotion = useReducedMotion()

  // Smooth scroll to section
  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId)
    if (element) {
      const offset = 100 // Account for sticky header
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset
      window.scrollTo({
        top: elementPosition - offset,
        behavior: 'smooth'
      })
    }
  }

  // Update active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['overview', 'specs', 'features', 'dimensions']
      const scrollPosition = window.scrollY + 150

      for (const section of sections) {
        const element = document.getElementById(section)
        if (element) {
          const { offsetTop, offsetHeight } = element
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section)
            break
          }
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Initialize chatbot when opened
  const initializeChat = () => {
    if (chatMessages.length === 0) {
      setChatMessages([
        {
          type: 'bot',
          text: `Hi! I'm here to answer any questions about the ${variant}. Ask me anything - specifications, features, comparisons, or driving experience!`,
          timestamp: new Date()
        }
      ])
    }
  }

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current && isChatOpen) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages, isChatOpen])

  // Send message to RAG backend
  const sendChatMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return

    const userMessage = chatInput.trim()
    setChatInput('')

    // Add user message
    const newMessages = [
      ...chatMessages,
      {
        type: 'user',
        text: userMessage,
        timestamp: new Date()
      }
    ]
    setChatMessages(newMessages)
    setIsChatLoading(true)

    try {
      // Use OpenAI directly for car-specific questions
      const response = await axios.post(`${API_BASE_URL}/car-chat`, {
        question: userMessage,
        car_variant: variant,
        car_data: carData // Pass full car data for context
      })

      // Add bot response
      setChatMessages([
        ...newMessages,
        {
          type: 'bot',
          text: response.data.answer || response.data.response || "I couldn't find an answer to that.",
          timestamp: new Date()
        }
      ])
    } catch (error) {
      console.error('Chat error:', error)
      // Fallback: Try to answer using car data directly
      let fallbackAnswer = "Sorry, I'm having trouble connecting. "
      
      if (carData) {
        if (userMessage.toLowerCase().includes('mileage')) {
          fallbackAnswer = `The ${variant} has a mileage of ${carData.Mileage || 'N/A'}.`
        } else if (userMessage.toLowerCase().includes('price')) {
          fallbackAnswer = `The ${variant} is priced at ${carData.price || 'N/A'}.`
        } else if (userMessage.toLowerCase().includes('engine') || userMessage.toLowerCase().includes('power')) {
          fallbackAnswer = `It has ${carData["Max Power"] || 'N/A'} max power with ${carData.Displacement || 'N/A'} displacement.`
        } else if (userMessage.toLowerCase().includes('feature')) {
          fallbackAnswer = `Key features include: ${carData["Comfort & Convenience Features"] || 'N/A'}`
        } else {
          fallbackAnswer = "I couldn't process your question, but you can see all specifications on this page!"
        }
      }
      
      setChatMessages([
        ...newMessages,
        {
          type: 'bot',
          text: fallbackAnswer,
          timestamp: new Date()
        }
      ])
    } finally {
      setIsChatLoading(false)
    }
  }

  // Handle Enter key
  const handleChatKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendChatMessage()
    }
  }

  useEffect(() => {
    const fetchCarDetails = async () => {
      try {
        const response = await fetch('/data/final_dataset.csv')
        const csvText = await response.text()
        
        // Parse CSV
        const lines = csvText.split('\n')
        const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''))
        
        // Find the car
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim()) {
            const values = lines[i].match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || []
            const cleanValues = values.map(v => v.trim().replace(/^["']|["']$/g, ''))
            
            if (cleanValues[0] === variant) {
              const car = {}
              headers.forEach((header, index) => {
                car[header] = cleanValues[index] || 'N/A'
              })
              setCarData(car)
              break
            }
          }
        }
        setLoading(false)
      } catch (error) {
        console.error('Error loading car details:', error)
        setLoading(false)
      }
    }

    fetchCarDetails()
  }, [variant])

  if (loading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#ffffff,#f7faff)] text-[#17223d] flex flex-col items-center justify-center">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
          <div className="absolute inset-0 animate-ping rounded-full h-16 w-16 border-4 border-blue-500 opacity-20"></div>
        </div>
        <p className="mt-6 text-xl text-[#617192] animate-pulse">Loading car details...</p>
      </div>
    )
  }

  if (!carData) {
    return (
      <div className="min-h-screen bg-white text-[#17223d] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl text-[#b84a3e] mb-4">Car not found</h2>
          <Link href="/dashboard" className="text-[rgb(var(--vw-stage-rgb))] hover:underline">Return to Dashboard</Link>
        </div>
      </div>
    )
  }

  // Get mileage based on fuel type
  const getMileage = () => {
    const fuelType = carData['Fuel Type'] || ''
    if (fuelType.toLowerCase().includes('petrol')) {
      return carData['Petrol Mileage ARAI'] || carData['Petrol Mileage (ARAI)'] || 'N/A'
    } else if (fuelType.toLowerCase().includes('diesel')) {
      return carData['Diesel Mileage ARAI'] || 'N/A'
    } else if (fuelType.toLowerCase().includes('electric')) {
      return carData['Range'] || 'N/A'
    } else if (fuelType.toLowerCase().includes('cng')) {
      return carData['CNG Mileage ARAI'] || 'N/A'
    }
    return 'N/A'
  }

  // Helper component for animated progress bars
  const ProgressBar = ({ label, value, maxValue, color, icon: Icon, unit = "" }) => {
    const percentage = Math.min((parseFloat(value) / maxValue) * 100, 100)
    
    return (
      <div className="space-y-2 group">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {Icon && <Icon size={18} className={`${color} transition-transform group-hover:scale-110`} />}
            <span className="text-sm text-[#617192]">{label}</span>
          </div>
          <span className="text-[#17223d] font-semibold">{value}{unit}</span>
        </div>
        <div className="h-2 rounded-full bg-[#d8e3f8] overflow-hidden">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,rgb(var(--vw-stage-rgb)),rgb(var(--emotion-calm)))] transition-all duration-700 ease-out"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
      </div>
    )
  }

  // Helper component for animated stat cards
  const StatCard = ({ icon: Icon, label, value, color, delay = 0 }) => {
    return (
      <div 
        className="vw-surface-soft p-6 transition-all duration-300 group hover:border-[#b9cdf4]"
        style={{ animationDelay: `${delay}ms` }}
      >
        <div className={`${color} mb-3 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6`}>
          <Icon size={32} />
        </div>
        <h3 className="text-2xl font-bold mb-2 text-[#17223d]">{value}</h3>
        <p className="text-[#617192] text-sm">{label}</p>
      </div>
    )
  }

  return (
    <div className="vw-stage-longing relative min-h-screen bg-white text-[#17223d]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(109,198,218,0.16),_transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,_rgba(156,136,205,0.14),_transparent_50%)]" />
      <div className="absolute inset-0 noise-mask opacity-50" />

      <div className="relative z-10">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_60%)]" />

        <div className="container mx-auto px-4 pb-12 pt-[9.5rem] relative z-10">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-[#6f7f9f] hover:text-[#17223d] transition-colors">
            <ArrowLeft size={16} className="opacity-70" />
            Back
          </Link>
          
          <div className="text-center animate-fade-in mt-8">
            <h1 className="font-display text-4xl md:text-5xl font-semibold mb-4 text-[#17223d]">
              {carData.variant}
            </h1>
            <div className="flex items-center justify-center gap-3 text-sm text-[#4f5f83]">
              <span className="vw-pill">{carData['Body Type']}</span>
              <span className="vw-pill">{carData['Fuel Type']}</span>
            </div>
            <div className="vw-surface inline-block mt-6 px-6 py-4">
              <p className="text-3xl font-semibold text-[rgb(var(--vw-stage-rgb))]">
                {carData.price}
              </p>
              <p className="text-xs text-[#6f7f9f] mt-1">Ex-showroom price</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Sticky Navigation - Scroll to sections */}
      <div className="sticky top-[5.8rem] z-20 backdrop-blur-xl bg-white/88 border-b border-[#dce4f2]">
        <div className="container mx-auto px-4">
          <div className="flex overflow-x-auto py-3 space-x-2">
            {["overview", "specs", "features", "dimensions"].map((tab) => (
              <button
                key={tab}
                onClick={() => scrollToSection(tab)}
                className={`px-4 py-2 text-sm font-medium transition-all whitespace-nowrap rounded-full border ${
                  activeSection === tab 
                    ? "text-[#11192c] bg-white border-white shadow-[0_10px_24px_rgba(255,255,255,0.2)]" 
                    : "text-[#4f5f83] border-[#dce4f2] hover:text-[#17223d] hover:border-[#a9c0eb]"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Main content area - All sections visible */}
      <div className="container mx-auto px-4 py-8 space-y-16">
        {/* Overview Section */}
        <section id="overview" className="scroll-mt-24">
          <div className="space-y-8">
            {/* Car Image with glow effect */}
            <div className="relative rounded-2xl overflow-hidden vw-surface p-8 group">
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(47,97,215,0.06),rgba(47,97,215,0.12),rgba(47,97,215,0.06))] opacity-0 transition-opacity duration-500 group-hover:opacity-100"></div>
              <div className="relative z-10 flex justify-center">
                <div className="rounded-xl w-full max-w-2xl h-64 flex items-center justify-center">
                  <img 
                    src={`https://via.placeholder.com/600x300/eaf1ff/36507f?text=${encodeURIComponent(carData.variant.split(' ').slice(0, 2).join(' '))}`}
                    alt={carData.variant}
                    className="h-full object-contain transform group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              </div>
            </div>
            
            {/* Key Stats with animation */}
            <div className="grid md:grid-cols-4 gap-6">
              <StatCard 
                icon={Fuel}
                label="Fuel Type"
                value={carData['Fuel Type']}
                color="text-[rgb(var(--vw-stage-rgb))]"
                delay={0}
              />
              <StatCard 
                icon={Settings}
                label={carData.Gearbox}
                value={carData['Transmission Type']}
                color="text-[rgb(var(--vw-stage-rgb))]"
                delay={100}
              />
              <StatCard 
                icon={Zap}
                label="Max Power"
                value={carData['Max Power']}
                color="text-[rgb(var(--vw-stage-rgb))]"
                delay={200}
              />
              <StatCard 
                icon={Battery}
                label="Mileage"
                value={getMileage()}
                color="text-[rgb(var(--vw-stage-rgb))]"
                delay={300}
              />
            </div>
            
            {/* Quick Specs with Progress Bars */}
            <div className="vw-surface p-8">
              <h2 className="font-display text-2xl font-semibold mb-8 text-[#17223d]">
                Quick Specifications
              </h2>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="group hover:translate-x-2 transition-transform duration-200">
                    <div className="flex justify-between py-3 border-b border-[#dce4f2] transition-colors group-hover:border-[#b9cdf4]">
                      <span className="text-[#617192] flex items-center gap-2">
                        <Settings size={16} className="text-[rgb(var(--vw-stage-rgb))]" />
                        Engine
                      </span>
                      <span className="font-semibold text-[#17223d]">{carData['Engine Type']}</span>
                    </div>
                  </div>
                  <div className="group hover:translate-x-2 transition-transform duration-200">
                    <div className="flex justify-between py-3 border-b border-[#dce4f2] transition-colors group-hover:border-[#b9cdf4]">
                      <span className="text-[#617192] flex items-center gap-2">
                        <Gauge size={16} className="text-[rgb(var(--vw-stage-rgb))]" />
                        Displacement
                      </span>
                      <span className="font-semibold text-[#17223d]">{carData.Displacement}</span>
                    </div>
                  </div>
                  <div className="group hover:translate-x-2 transition-transform duration-200">
                    <div className="flex justify-between py-3 border-b border-[#dce4f2] transition-colors group-hover:border-[#b9cdf4]">
                      <span className="text-[#617192] flex items-center gap-2">
                        <TrendingUp size={16} className="text-[rgb(var(--vw-stage-rgb))]" />
                        Max Torque
                      </span>
                      <span className="font-semibold text-[#17223d]">{carData['Max Torque']}</span>
                    </div>
                  </div>
                  <div className="group hover:translate-x-2 transition-transform duration-200">
                    <div className="flex justify-between py-3 border-b border-[#dce4f2] transition-colors group-hover:border-[#b9cdf4]">
                      <span className="text-[#617192] flex items-center gap-2">
                        <Wind size={16} className="text-[rgb(var(--vw-stage-rgb))]" />
                        Drive Type
                      </span>
                      <span className="font-semibold text-[#17223d]">{carData['Drive Type']}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="group hover:translate-x-2 transition-transform duration-200">
                    <div className="flex justify-between py-3 border-b border-[#dce4f2] transition-colors group-hover:border-[#b9cdf4]">
                      <span className="text-[#617192] flex items-center gap-2">
                        <Users size={16} className="text-[rgb(var(--vw-stage-rgb))]" />
                        Seating
                      </span>
                      <span className="font-semibold text-[#17223d]">{carData['Seating Capacity']}</span>
                    </div>
                  </div>
                  <div className="group hover:translate-x-2 transition-transform duration-200">
                    <div className="flex justify-between py-3 border-b border-[#dce4f2] transition-colors group-hover:border-[#b9cdf4]">
                      <span className="text-[#617192] flex items-center gap-2">
                        <Award size={16} className="text-[rgb(var(--vw-stage-rgb))]" />
                        Boot Space
                      </span>
                      <span className="font-semibold text-[#17223d]">{carData['Boot Space']}</span>
                    </div>
                  </div>
                  <div className="group hover:translate-x-2 transition-transform duration-200">
                    <div className="flex justify-between py-3 border-b border-[#dce4f2] transition-colors group-hover:border-[#b9cdf4]">
                      <span className="text-[#617192] flex items-center gap-2">
                        <Shield size={16} className="text-[rgb(var(--vw-stage-rgb))]" />
                        Airbags
                      </span>
                      <span className="font-semibold text-[#17223d]">{carData['No. of Airbags']}</span>
                    </div>
                  </div>
                  <div className="group hover:translate-x-2 transition-transform duration-200">
                    <div className="flex justify-between py-3 border-b border-[#dce4f2] transition-colors group-hover:border-[#b9cdf4]">
                      <span className="text-[#617192] flex items-center gap-2">
                        <Fuel size={16} className="text-[rgb(var(--vw-stage-rgb))]" />
                        Fuel Tank
                      </span>
                      <span className="font-semibold text-[#17223d]">{carData['Petrol Fuel Tank Capacity'] || carData['Diesel Fuel Tank Capacity'] || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* Specs Section */}
        <section id="specs" className="scroll-mt-24">
          <div className="mb-6">
            <p className="vw-label">Specs</p>
            <h2 className="font-display text-3xl text-[#17223d]">Technical specifications</h2>
          </div>
          <div className="space-y-8">
            <div className="vw-surface p-8">
              
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-[rgb(var(--vw-stage-rgb))] mb-6 flex items-center gap-2">
                    <Zap size={24} />
                    Engine & Performance
                  </h3>
                  
                  <ProgressBar 
                    label="Displacement" 
                    value={carData.Displacement?.replace(/[^\d.]/g, '') || '0'} 
                    maxValue={5000}
                    color="text-[rgb(var(--vw-stage-rgb))]"
                    icon={Gauge}
                    unit=" cc"
                  />
                  
                  <ProgressBar 
                    label="Max Power" 
                    value={carData['Max Power']?.match(/[\d.]+/)?.[0] || '0'} 
                    maxValue={500}
                    color="text-[rgb(var(--vw-stage-rgb))]"
                    icon={Zap}
                    unit=" bhp"
                  />
                  
                  <ProgressBar 
                    label="Max Torque" 
                    value={carData['Max Torque']?.match(/[\d.]+/)?.[0] || '0'} 
                    maxValue={700}
                    color="text-[rgb(var(--vw-stage-rgb))]"
                    icon={TrendingUp}
                    unit=" Nm"
                  />

                  <div className="space-y-3 mt-6">
                    {[
                      ["Engine Type", carData['Engine Type']],
                      ["Cylinders", carData['No. of Cylinders']],
                      ["Turbo Charger", carData['Turbo Charger']],
                      ["Transmission", carData['Transmission Type']],
                      ["Gearbox", carData.Gearbox],
                      ["Drive Type", carData['Drive Type']]
                    ].map(([key, value], idx) => (
                      <div key={idx} className="group flex justify-between py-2 border-b border-[#dce4f2] transition-colors hover:border-[#b9cdf4]">
                        <span className="text-[#617192] group-hover:text-[#4f5f83]">{key}</span>
                        <span className="font-semibold text-[#17223d]">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-[rgb(var(--vw-stage-rgb))] mb-6 flex items-center gap-2">
                    <Battery size={24} />
                    Fuel & Efficiency
                  </h3>
                  
                  <ProgressBar 
                    label="Mileage" 
                    value={getMileage()?.match(/[\d.]+/)?.[0] || '0'} 
                    maxValue={30}
                    color="text-[rgb(var(--vw-stage-rgb))]"
                    icon={Battery}
                    unit=" km/l"
                  />
                  
                  <ProgressBar 
                    label="Fuel Tank Capacity" 
                    value={carData['Petrol Fuel Tank Capacity']?.replace(/[^\d.]/g, '') || carData['Diesel Fuel Tank Capacity']?.replace(/[^\d.]/g, '') || '0'} 
                    maxValue={100}
                    color="text-[rgb(var(--vw-stage-rgb))]"
                    icon={Fuel}
                    unit=" L"
                  />
                  
                  <ProgressBar 
                    label="Top Speed" 
                    value={carData['Top Speed']?.replace(/[^\d.]/g, '') || '0'} 
                    maxValue={300}
                    color="text-[rgb(var(--vw-stage-rgb))]"
                    icon={Wind}
                    unit=" km/h"
                  />

                  <div className="space-y-3 mt-6">
                    {[
                      ["Fuel Type", carData['Fuel Type']],
                      ["Emission Norm", carData['Emission Norm Compliance']],
                    ].map(([key, value], idx) => (
                      <div key={idx} className="flex justify-between py-2 border-b border-[#dce4f2] hover:border-[#b9cdf4] transition-colors group">
                        <span className="text-[#617192] group-hover:text-[#4f5f83]">{key}</span>
                        <span className="font-semibold text-[#17223d]">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* Features Section */}
        <section id="features" className="scroll-mt-24">
          <div className="mb-6">
            <p className="vw-label">Features</p>
            <h2 className="font-display text-3xl text-[#17223d]">Features & safety</h2>
          </div>
          <div className="space-y-8">
            <div className="vw-surface p-8">
              <h2 className="text-2xl font-semibold mb-8 text-[rgb(var(--vw-stage-rgb))] flex items-center gap-3">
                <Star size={22} className="text-[rgb(var(--vw-stage-rgb))]" />
                Comfort & Convenience
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  ["Air Conditioner", carData['Air Conditioner']],
                  ["Power Steering", carData['Power Steering']],
                  ["Power Windows", carData['Power Windows']],
                  ["Keyless Entry", carData['KeyLess Entry']],
                  ["Central Locking", carData['Central Locking']],
                  ["Cruise Control", carData['Cruise Control']],
                  ["Sunroof", carData.Sunroof],
                  ["Push Button Start", carData['Engine Start/Stop Button']]
                ].filter(([key, value]) => value && value !== 'N/A').map(([key, value], idx) => (
                  <div 
                    key={idx} 
                    className="group flex items-center space-x-3 vw-surface-soft p-3 transition-all duration-200 hover:border-[#b9cdf4]"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${value === 'yes' ? 'bg-[rgb(var(--vw-stage-rgb))] shadow-[0_0_10px_rgba(47,97,215,0.4)]' : 'bg-[#dfe8f9]'} shadow-md`}></div>
                    <span className="text-[#4f5f83] group-hover:text-[#17223d] transition-colors font-medium">{key}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="vw-surface p-8">
              <h2 className="text-2xl font-semibold mb-8 text-[rgb(var(--vw-stage-rgb))] flex items-center gap-3">
                <Shield size={22} className="text-[rgb(var(--vw-stage-rgb))]" />
                Safety Features
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  [`${carData['No. of Airbags']} Airbags`, carData['No. of Airbags']],
                  ["ABS", carData['Anti-lock Braking System (ABS)']],
                  ["EBD", carData['Electronic Brakeforce Distribution (EBD)']],
                  ["ESC", carData['Electronic Stability Control (ESC)']],
                  ["Hill Assist", carData['Hill Assist']],
                  ["Rear Camera", carData['Rear Camera']],
                  ["Parking Sensors", carData['Parking Sensors']],
                  ["TPMS", carData['Tyre Pressure Monitoring System (TPMS)']]
                ].filter(([key, value]) => value && value !== 'N/A' && value !== 'no').map(([key, value], idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center vw-surface-soft p-4 hover:border-[#b9cdf4] transition-all duration-200 group"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="bg-[#eef4ff] p-2 rounded-lg mr-4 group-hover:bg-[#e7f1ff] transition-colors">
                      <Shield size={18} className="text-[rgb(var(--vw-stage-rgb))]" />
                    </div>
                    <span className="text-[#4f5f83] group-hover:text-[#17223d] transition-colors font-medium">{key}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        
        {/* Dimensions Section */}
        <section id="dimensions" className="scroll-mt-24">
          <div className="mb-6">
            <p className="vw-label">Dimensions</p>
            <h2 className="font-display text-3xl text-[#17223d]">Dimensions & capacity</h2>
          </div>
          <div className="space-y-8">
            <div className="vw-surface p-8">
              
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-[rgb(var(--vw-stage-rgb))] mb-6 flex items-center gap-2">
                    <Settings size={24} />
                    Exterior Dimensions
                  </h3>
                  
                  <ProgressBar 
                    label="Length" 
                    value={carData.Length?.replace(/[^\d.]/g, '') || '0'} 
                    maxValue={6000}
                    color="text-[rgb(var(--vw-stage-rgb))]"
                    icon={TrendingUp}
                    unit=" mm"
                  />
                  
                  <ProgressBar 
                    label="Width" 
                    value={carData.Width?.replace(/[^\d.]/g, '') || '0'} 
                    maxValue={2500}
                    color="text-[rgb(var(--vw-stage-rgb))]"
                    icon={Wind}
                    unit=" mm"
                  />
                  
                  <ProgressBar 
                    label="Height" 
                    value={carData.Height?.replace(/[^\d.]/g, '') || '0'} 
                    maxValue={2500}
                    color="text-[rgb(var(--vw-stage-rgb))]"
                    icon={TrendingUp}
                    unit=" mm"
                  />

                  <ProgressBar 
                    label="Kerb Weight" 
                    value={carData['Kerb Weight']?.replace(/[^\d.]/g, '') || '0'} 
                    maxValue={3000}
                    color="text-[rgb(var(--vw-stage-rgb))]"
                    icon={Gauge}
                    unit=" kg"
                  />

                  <div className="space-y-3 mt-6">
                    {[
                      ["Wheelbase", carData['Wheel Base']],
                      ["Ground Clearance", carData['Ground Clearance Unladen']],
                      ["Gross Weight", carData['Gross Weight']],
                      ["Doors", carData['No. of Doors']]
                    ].map(([key, value], idx) => (
                      <div key={idx} className="flex justify-between py-2 border-b border-[#dce4f2] hover:border-[#b9cdf4] transition-colors group">
                        <span className="text-[#617192] group-hover:text-[#4f5f83]">{key}</span>
                        <span className="font-semibold text-[#17223d]">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-[rgb(var(--vw-stage-rgb))] mb-6 flex items-center gap-2">
                    <Award size={24} />
                    Capacity & Wheels
                  </h3>
                  
                  <ProgressBar 
                    label="Seating Capacity" 
                    value={carData['Seating Capacity']?.replace(/[^\d.]/g, '') || '0'} 
                    maxValue={10}
                    color="text-[rgb(var(--vw-stage-rgb))]"
                    icon={Users}
                    unit=" seats"
                  />
                  
                  <ProgressBar 
                    label="Boot Space" 
                    value={carData['Boot Space']?.replace(/[^\d.]/g, '') || '0'} 
                    maxValue={1000}
                    color="text-[rgb(var(--vw-stage-rgb))]"
                    icon={Award}
                    unit=" L"
                  />
                  
                  <ProgressBar 
                    label="Fuel Tank" 
                    value={carData['Petrol Fuel Tank Capacity']?.replace(/[^\d.]/g, '') || carData['Diesel Fuel Tank Capacity']?.replace(/[^\d.]/g, '') || '0'} 
                    maxValue={100}
                    color="text-[rgb(var(--vw-stage-rgb))]"
                    icon={Fuel}
                    unit=" L"
                  />

                  <div className="space-y-3 mt-6">
                    {[
                      ["Tyre Size", carData['Tyre Size']],
                      ["Wheel Size", carData['Wheel Size']],
                      ["Alloy Wheels", carData['Alloy Wheels']],
                      ["Spare Wheel", carData['Tyre Type']]
                    ].map(([key, value], idx) => (
                      <div key={idx} className="flex justify-between py-2 border-b border-[#dce4f2] hover:border-[#b9cdf4] transition-colors group">
                        <span className="text-[#617192] group-hover:text-[#4f5f83]">{key}</span>
                        <span className="font-semibold text-[#17223d]">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Floating Chat Button */}
      {!isChatOpen && (
        <button
          onClick={() => {
            setIsChatOpen(true)
            initializeChat()
          }}
          className="fixed bottom-8 right-8 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(140deg,rgb(var(--emotion-void)),rgb(var(--vw-stage-rgb)))] shadow-[0_18px_36px_rgba(31,46,83,0.28)] transition-all duration-300 hover:scale-110 hover:opacity-95 group"
        >
          <MessageCircle size={28} className="text-white group-hover:scale-110 transition-transform" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[rgb(var(--vw-stage-rgb))] rounded-full border-2 border-white"></span>
        </button>
      )}

      {/* Floating Chat Window */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.98 }}
            animate={reduceMotion ? false : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`fixed ${isMinimized ? 'bottom-8 right-8 w-80' : 'bottom-8 right-8 w-96'} bg-white/95 backdrop-blur-lg border border-[#d2def2] rounded-2xl shadow-2xl z-50 transition-all duration-300 ${isMinimized ? 'h-16' : 'h-[600px]'} flex flex-col`}
          >
          {/* Chat Header */}
          <div className="bg-[linear-gradient(140deg,rgb(var(--emotion-void)),rgb(var(--vw-stage-rgb)))] p-4 rounded-t-2xl flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                <Bot size={24} className="text-[rgb(var(--vw-stage-rgb))]" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Car Assistant</h3>
                <p className="text-xs text-[#dfe9ff]">Ask me anything!</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-2 hover:bg-white/10 rounded-lg transition-all"
                title={isMinimized ? "Maximize" : "Minimize"}
              >
                {isMinimized ? <Maximize2 size={18} /> : <Minimize2 size={18} />}
              </button>
              <button
                onClick={() => setIsChatOpen(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-all"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Chat Messages */}
          {!isMinimized && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                  >
                    <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-lg ${
                        msg.type === 'user'
                          ? 'bg-[linear-gradient(140deg,rgb(var(--emotion-void)),rgb(var(--vw-stage-rgb)))] text-white rounded-br-sm'
                          : 'bg-white text-[#1d2a48] rounded-bl-sm border border-[#dce4f2]'
                      }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      <p className="text-xs opacity-50 mt-1">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Typing Indicator */}
                {isChatLoading && (
                  <div className="flex justify-start animate-fade-in">
                    <div className="bg-white border border-[#dce4f2] rounded-2xl rounded-bl-sm px-4 py-3 shadow-lg">
                      <div className="flex gap-1.5">
                        <div className="w-2 h-2 bg-[rgb(var(--vw-stage-rgb))] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-[rgb(var(--vw-stage-rgb))] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-[rgb(var(--vw-stage-rgb))] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-[#dce4f2] flex-shrink-0">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={handleChatKeyPress}
                    placeholder="Ask about this car..."
                    disabled={isChatLoading}
                    className="vw-input flex-1 disabled:opacity-50"
                  />
                  <AnimatedButton
                    onClick={sendChatMessage}
                    disabled={!chatInput.trim() || isChatLoading}
                    className="vw-btn-primary rounded-xl px-4 py-2.5 font-medium flex items-center gap-2"
                  >
                    <Send size={18} />
                  </AnimatedButton>
                </div>
                <p className="mt-2 text-center text-xs text-[#7a86a5]">
                  Ask about specs, features, or comparisons.
                </p>
              </div>
            </>
          )}
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  )
}
