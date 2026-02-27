export const EMOTION_COLORS = {
  calm: {
    hex: "#6DC6DA",
    rgb: "109 198 218",
    soft: "#D8F0F5",
  },
  tender: {
    hex: "#E9B8A0",
    rgb: "233 184 160",
    soft: "#F6E4DA",
  },
  desire: {
    hex: "#EB8846",
    rgb: "235 136 70",
    soft: "#F9E2D0",
  },
  passion: {
    hex: "#E35067",
    rgb: "227 80 103",
    soft: "#F8D7DE",
  },
  longing: {
    hex: "#9C88CD",
    rgb: "156 136 205",
    soft: "#E8E0F8",
  },
  void: {
    hex: "#223162",
    rgb: "34 49 98",
    soft: "#D3DCF5",
  },
}

const STAGE_THEME = {
  welcome: {
    emotion: "calm",
    className: "vw-stage-calm",
    label: "Welcome",
  },
  capture: {
    emotion: "tender",
    className: "vw-stage-tender",
    label: "Preference capture",
  },
  filtering: {
    emotion: "desire",
    className: "vw-stage-desire",
    label: "Narrowing",
  },
  ranking: {
    emotion: "passion",
    className: "vw-stage-passion",
    label: "Ranking",
  },
  reasoning: {
    emotion: "longing",
    className: "vw-stage-longing",
    label: "Reasoning",
  },
  summary: {
    emotion: "void",
    className: "vw-stage-void",
    label: "Decision",
  },
}

export function getStageTheme(stage = "welcome") {
  const stageConfig = STAGE_THEME[stage] || STAGE_THEME.welcome
  const emotion = EMOTION_COLORS[stageConfig.emotion]

  return {
    ...stageConfig,
    accent: emotion.hex,
    accentRgb: emotion.rgb,
    accentSoft: emotion.soft,
    gradient: `linear-gradient(135deg, rgb(${emotion.rgb}) 0%, rgba(${emotion.rgb}, 0.56) 100%)`,
    glow: `0 0 0 4px rgba(${emotion.rgb}, 0.16)`,
    subtleGlow: `0 12px 32px rgba(${emotion.rgb}, 0.22)`,
  }
}

export const stageOrder = ["welcome", "capture", "filtering", "ranking", "reasoning", "summary"]

export const stageEmotionMap = {
  1: "welcome",
  2: "capture",
  3: "filtering",
  4: "ranking",
  5: "reasoning",
  6: "summary",
}
