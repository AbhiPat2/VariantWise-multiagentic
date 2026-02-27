/**
 * DESIGN TOKENS
 * Premium design system with proper elevation, glass surfaces, and emotion-driven staging
 */

// 1. EMOTION PALETTE (6 stage colors)
export const EMOTION_COLORS = {
  calm: {
    name: "Calm",
    hex: "#6DC6DA",
    rgb: "109 198 218",
    soft: "206 235 241",
    description: "Onboarding & welcome",
  },
  tender: {
    name: "Tender",
    hex: "#E9B8A0",
    rgb: "233 184 160",
    soft: "245 226 215",
    description: "Preference capture",
  },
  desire: {
    name: "Desire",
    hex: "#EB8846",
    rgb: "235 136 70",
    soft: "252 226 206",
    description: "Narrowing down",
  },
  passion: {
    name: "Passion",
    hex: "#E35067",
    rgb: "227 80 103",
    soft: "252 222 228",
    description: "Ranking reveal",
  },
  longing: {
    name: "Longing",
    hex: "#9C88CD",
    rgb: "156 136 205",
    soft: "231 223 247",
    description: "Deep comparison",
  },
  void: {
    name: "Void",
    hex: "#223162",
    rgb: "34 49 98",
    soft: "210 220 245",
    description: "Final decision",
  },
}

// 2. STAGE → EMOTION MAPPING
export const STAGE_MAPPING = {
  welcome: "calm",
  onboarding: "calm",
  capture: "tender",
  preference: "tender",
  filtering: "desire",
  narrowing: "desire",
  ranking: "passion",
  reveal: "passion",
  comparison: "longing",
  reasoning: "longing",
  decision: "void",
  summary: "void",
}

// 3. ELEVATION SYSTEM (4 surface levels)
export const ELEVATION = {
  0: {
    name: "Background",
    bg: "transparent",
    border: "none",
    shadow: "none",
    blur: 0,
  },
  1: {
    name: "Glass Panel",
    bg: "rgba(255, 255, 255, 0.65)",
    bgGradient: "linear-gradient(150deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.58))",
    border: "1px solid rgba(255, 255, 255, 0.58)",
    shadow: "0 10px 30px rgba(0, 0, 0, 0.055), 0 2px 10px rgba(0, 0, 0, 0.035)",
    blur: 16,
    innerHighlight: "inset 0 1px 0 rgba(255, 255, 255, 0.48)",
    radius: 24,
  },
  2: {
    name: "Elevated Card",
    bg: "rgba(255, 255, 255, 0.75)",
    bgGradient: "linear-gradient(160deg, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.68))",
    border: "1px solid rgba(255, 255, 255, 0.65)",
    shadow: "0 14px 36px rgba(0, 0, 0, 0.075), 0 4px 14px rgba(0, 0, 0, 0.045)",
    blur: 18,
    innerHighlight: "inset 0 1px 0 rgba(255, 255, 255, 0.62)",
    radius: 22,
  },
  3: {
    name: "Hero Surface",
    bg: "rgba(255, 255, 255, 0.88)",
    bgGradient: "linear-gradient(160deg, rgba(255, 255, 255, 0.94), rgba(255, 255, 255, 0.8))",
    border: "1px solid rgba(255, 255, 255, 0.72)",
    shadow: "0 18px 42px rgba(0, 0, 0, 0.095), 0 6px 18px rgba(0, 0, 0, 0.055)",
    blur: 22,
    innerHighlight: "inset 0 1.5px 0 rgba(255, 255, 255, 0.75)",
    radius: 28,
  },
}

// 4. Helper: Get stage theme config
export function getStageTheme(stage = "welcome") {
  const emotion = STAGE_MAPPING[stage] || "calm"
  const colorConfig = EMOTION_COLORS[emotion]

  return {
    emotion,
    className: `vw-stage-${emotion}`,
    accent: colorConfig.hex,
    accentRgb: colorConfig.rgb,
    accentSoft: `rgb(${colorConfig.soft})`,
    gradient: `linear-gradient(135deg, rgb(${colorConfig.rgb}) 0%, rgba(${colorConfig.rgb}, 0.56) 100%)`,
    glow: `0 0 0 4px rgba(${colorConfig.rgb}, 0.16)`,
    subtleGlow: `0 12px 32px rgba(${colorConfig.rgb}, 0.22)`,
    wash: `linear-gradient(135deg, rgba(${colorConfig.rgb}, 0.08) 0%, rgba(${colorConfig.rgb}, 0.03) 100%)`,
  }
}
