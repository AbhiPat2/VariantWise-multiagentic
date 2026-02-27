"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { DEFAULT_PREFS, DEFAULT_USER_CONTROLS } from "./controls-config";
import { shouldTriggerSearch } from "./chat-flow";

import ConsultationHeader from "./_components/ConsultationHeader";
import ChatPanel from "./_components/ChatPanel";
import FormPanel from "./_components/FormPanel";
import FormResultsPanel from "./_components/FormResultsPanel";
import WhyTopFiveDrawer from "./_components/WhyTopFiveDrawer";
import { countApplied } from "./_components/AppliedFilterPills";

const API_BASE_URL = process.env.NEXT_PUBLIC_MODEL_URL || "http://127.0.0.1:8000";
const GRAPH_REQUEST_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_GRAPH_TIMEOUT_MS || 180000);

const normalizeFeatureList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[,\n;|]+/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

export default function ConsultantPage() {
  const reduceMotion = useReducedMotion();

  /* ── Core preferences ── */
  const [prefs, setPrefs] = useState({ ...DEFAULT_PREFS });
  const [userControls, setUserControls] = useState({ ...DEFAULT_USER_CONTROLS });

  /* ── Chat ── */
  const [chatMessages, setChatMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [chatPrefs, setChatPrefs] = useState({});

  /* ── Results ── */
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [reviews, setReviews] = useState({});
  const [sentiments, setSentiments] = useState({});

  /* ── Pipeline data ── */
  const [agentTrace, setAgentTrace] = useState([]);
  const [pipelineStats, setPipelineStats] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [explanationContexts, setExplanationContexts] = useState([]);
  const [agentEvaluations, setAgentEvaluations] = useState([]);
  const [scoringDiagnostics, setScoringDiagnostics] = useState(null);
  const [clarifyingQuestions, setClarifyingQuestions] = useState([]);
  const [userControlApplied, setUserControlApplied] = useState(null);
  const [variantFocusInfo, setVariantFocusInfo] = useState(null);
  const [lightningStatus, setLightningStatus] = useState(null);

  /* ── Shortlist ── */
  const [shortlist, setShortlist] = useState([]);

  /* ── UI ── */
  const [mode, setMode] = useState("chat");
  const [showWhyDrawer, setShowWhyDrawer] = useState(false);
  const [showAdvancedInChat, setShowAdvancedInChat] = useState(false);
  const [advancedOffered, setAdvancedOffered] = useState(false);

  /* ── Refs for auto-scroll ── */
  const formResultsRef = useRef(null);

  /* ── Derived ── */
  const appliedCount = useMemo(() => countApplied(prefs, userControls), [prefs, userControls]);

  useEffect(() => {
    if (hasSearched && results.length > 0 && mode === "form") {
      setTimeout(() => {
        formResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 350);
    }
  }, [hasSearched, results.length, mode]);

  /* ── Updaters ── */
  const updatePrefs = useCallback((patch) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }, []);
  const updateControls = useCallback((patch) => {
    setUserControls((prev) => ({ ...prev, ...patch }));
  }, []);

  /* ── Build control config ── */
  const buildControlConfig = useCallback(() => {
    const split = (v) =>
      typeof v === "string"
        ? Array.from(new Set(v.split(/[,\n;]+/g).map((s) => s.trim()).filter(Boolean)))
        : Array.isArray(v)
        ? Array.from(new Set(v.map((s) => String(s).trim()).filter(Boolean)))
        : [];

    const preferred = split(userControls.preferred_brands);
    const blacklisted = split(userControls.blacklisted_brands);
    const explorationRateSet = Boolean(userControls.exploration_rate_set);

    let brandMode = userControls.brand_mode || "any";
    if (brandMode === "any") {
      if (blacklisted.length > 0 && preferred.length > 0) brandMode = "preferred";
      else if (blacklisted.length > 0) brandMode = "blacklist";
      else if (preferred.length > 0) brandMode = "preferred";
    }

    return {
      diversity_mode: userControls.diversity_mode || "balanced",
      relevance_weight: userControls.relevance_weight ?? 0.7,
      diversity_weight: userControls.diversity_weight ?? 0.3,
      brand_mode: brandMode,
      preferred_brands: preferred,
      blacklisted_brands: blacklisted,
      price_preference: userControls.price_preference || null,
      price_tolerance: userControls.price_tolerance ?? 0.2,
      must_have_features: userControls.must_have_features || [],
      nice_to_have_features: userControls.nice_to_have_features || [],
      feature_weights: userControls.feature_weights || {},
      use_cases: userControls.use_cases || [],
      use_case_weights: userControls.use_case_weights || {},
      comparison_mode: userControls.comparison_mode || false,
      comparison_cars: userControls.comparison_mode ? split(userControls.comparison_cars) : [],
      similar_to_car: userControls.comparison_mode ? (userControls.similar_to_car || "") : "",
      exploration_rate: userControls.exploration_rate ?? 0.1,
      exploration_rate_set: explorationRateSet,
      objective_weights: userControls.objective_weights || {},
      scoring_priorities: explorationRateSet ? (userControls.scoring_priorities || {}) : {},
    };
  }, [userControls]);

  const sendFeedbackEvent = useCallback(
    async (payload) => {
      if (!sessionId) return;
      try {
        const response = await axios.post(`${API_BASE_URL}/api/feedback`, {
          session_id: sessionId,
          preferences: {
            min_budget: prefs.min_budget,
            max_budget: prefs.max_budget,
            fuel_type: prefs.fuel_type,
            body_type: prefs.body_type,
            transmission: prefs.transmission,
            seating: prefs.seating,
            features: prefs.features || [],
            performance: prefs.performance,
            brand: prefs.brand || "Any",
          },
          user_control_config: buildControlConfig(),
          ...payload,
        });
        if (response?.data?.agent_lightning_status) {
          setLightningStatus(response.data.agent_lightning_status);
        }
      } catch (err) {
        console.warn("Feedback event failed:", err?.message || err);
      }
    },
    [sessionId, prefs, buildControlConfig]
  );

  useEffect(() => {
    let mounted = true;
    const fetchLightningStatus = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/agent_lightning/status`);
        if (!mounted) return;
        if (response?.data?.agent_lightning) {
          setLightningStatus(response.data.agent_lightning);
        }
      } catch (err) {
        // Silent fail; UI remains functional if backend status endpoint is unavailable.
      }
    };

    fetchLightningStatus();
    const intervalId = setInterval(fetchLightningStatus, 25000);
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  /* ══════════════════════════════════════════
     SEARCH — graph pipeline with fallback
     ══════════════════════════════════════════ */

  const injectSearchingMessage = useCallback(() => {
    setChatMessages((prev) => [
      ...prev,
      { type: "searching", timestamp: new Date() },
    ]);
  }, []);

  const removeSearchingAndInjectResults = useCallback((matchesData, traceData, extra = {}) => {
    setChatMessages((prev) => {
      const cleaned = prev.filter((m) => m.type !== "searching");
      const newMessages = [];
      if (traceData?.agentTrace?.length > 0) {
        newMessages.push({
          type: "agent-trace",
          agentTrace: traceData.agentTrace,
          pipelineStats: traceData.pipelineStats,
          timestamp: new Date(),
        });
      }
      if (extra?.variantFocus?.active) {
        newMessages.push({
          type: "bot",
          text: `Focused exploration active: ${extra.variantFocus.focus_variant || extra.variantFocus.family_label}. Showing sibling variants from a narrowed graph scope.`,
          timestamp: new Date(),
        });
      }
      if (matchesData.length > 0) {
        newMessages.push({
          type: "results",
          results: matchesData,
          timestamp: new Date(),
        });
      }
      if (matchesData.length > 0) {
        newMessages.push({
          type: "bot",
          text: `Found ${matchesData.length} match${matchesData.length === 1 ? "" : "es"} for you. Tap any card to explore details, or ask me to compare them.`,
          timestamp: new Date(),
        });
      }
      return [...cleaned, ...newMessages];
    });
  }, []);

  const searchCars = useCallback(
    async (searchPrefs, opts = {}) => {
      const emitChatArtifacts = opts.emitChatArtifacts !== false;
      setIsSearching(true);
      setError("");
      if (emitChatArtifacts) {
        injectSearchingMessage();
      }
      try {
        const controlConfig = buildControlConfig();
        const payload = {
          min_budget: searchPrefs.min_budget,
          max_budget: searchPrefs.max_budget,
          fuel_type: searchPrefs.fuel_type,
          body_type: searchPrefs.body_type,
          transmission: searchPrefs.transmission,
          seating: searchPrefs.seating,
          features: normalizeFeatureList(searchPrefs.features),
          performance: searchPrefs.performance,
          brand: searchPrefs.brand || "Any",
          user_input: opts.userInput || "",
          conversation_history: opts.conversationHistory || [],
          session_id: sessionId || undefined,
          user_control_config: controlConfig,
        };
        if (opts.variantFamilyFocus) {
          payload.variant_family_focus = opts.variantFamilyFocus;
        }
        if (opts.focusModel) {
          payload.focus_model = opts.focusModel;
        }
        if (opts.focusBrand) {
          payload.focus_brand = opts.focusBrand;
        }
        if (opts.excludeVariant) {
          payload.exclude_variant = opts.excludeVariant;
        }
        const fallbackPayload = {
          min_budget: searchPrefs.min_budget,
          max_budget: searchPrefs.max_budget,
          fuel_type: searchPrefs.fuel_type,
          body_type: searchPrefs.body_type,
          transmission: searchPrefs.transmission,
          seating: searchPrefs.seating,
          features: normalizeFeatureList(searchPrefs.features),
          performance: searchPrefs.performance,
          brand: searchPrefs.brand || "Any",
        };
        if (opts.variantFamilyFocus) {
          fallbackPayload.variant_family_focus = opts.variantFamilyFocus;
        }
        if (opts.focusModel) {
          fallbackPayload.focus_model = opts.focusModel;
        }
        if (opts.focusBrand) {
          fallbackPayload.focus_brand = opts.focusBrand;
        }
        if (opts.excludeVariant) {
          fallbackPayload.exclude_variant = opts.excludeVariant;
        }

        const response = await axios.post(
          `${API_BASE_URL}/api/recommend_with_graph`,
          payload,
          { timeout: GRAPH_REQUEST_TIMEOUT_MS }
        );
        const graphData = response?.data || {};
        const graphMatches = Array.isArray(graphData.matches) ? graphData.matches : [];
        if (graphMatches.length > 0) {
          applyPipelineResults(graphData, { emitChatArtifacts });
          return;
        }

        if (opts.variantFamilyFocus) {
          try {
            const fallback = await axios.post(`${API_BASE_URL}/api/recommend`, fallbackPayload);
            const fallbackMatches = Array.isArray(fallback?.data?.matches) ? fallback.data.matches : [];
            if (fallbackMatches.length > 0) {
              applyBasicResults(fallback.data, { emitChatArtifacts });
              return;
            }
          } catch (focusedFallbackErr) {
            console.warn("Focused fallback recommender failed:", focusedFallbackErr?.message || focusedFallbackErr);
          }
          if (emitChatArtifacts) {
            setChatMessages((prev) => prev.filter((m) => m.type !== "searching"));
          }
          setError("No sibling variants matched the selected model focus.");
          return;
        }

        console.warn("Graph endpoint returned no matches, trying fallback recommender.");
        const fallback = await axios.post(`${API_BASE_URL}/api/recommend`, fallbackPayload);
        applyBasicResults(fallback.data, { emitChatArtifacts });
      } catch (err) {
        const timedOut =
          err?.code === "ECONNABORTED" ||
          String(err?.message || "").toLowerCase().includes("timeout");
        console.warn(
          timedOut
            ? `Graph endpoint timed out after ${Math.round(GRAPH_REQUEST_TIMEOUT_MS / 1000)}s; trying fallback recommender.`
            : `Graph endpoint failed, trying fallback recommender: ${err?.message || "unknown error"}`
        );
        if (opts.variantFamilyFocus) {
          try {
            const fallback = await axios.post(`${API_BASE_URL}/api/recommend`, fallbackPayload);
            const fallbackMatches = Array.isArray(fallback?.data?.matches) ? fallback.data.matches : [];
            if (fallbackMatches.length > 0) {
              applyBasicResults(fallback.data, { emitChatArtifacts });
              return;
            }
          } catch (focusedFallbackErr) {
            console.warn("Focused fallback recommender failed:", focusedFallbackErr?.message || focusedFallbackErr);
          }
          if (emitChatArtifacts) {
            setChatMessages((prev) => prev.filter((m) => m.type !== "searching"));
          }
          const errorMessage = err?.response?.data?.error || err?.message || "Unknown error";
          setError(`Focused variant search failed. ${errorMessage}`);
          return;
        }
        try {
              const fallback = await axios.post(`${API_BASE_URL}/api/recommend`, {
                min_budget: searchPrefs.min_budget,
                max_budget: searchPrefs.max_budget,
                fuel_type: searchPrefs.fuel_type,
                body_type: searchPrefs.body_type,
                transmission: searchPrefs.transmission,
                seating: searchPrefs.seating,
                features: normalizeFeatureList(searchPrefs.features),
                performance: searchPrefs.performance,
                brand: searchPrefs.brand || "Any",
              });
          applyBasicResults(fallback.data, { emitChatArtifacts });
        } catch (fallbackErr) {
          if (emitChatArtifacts) {
            setChatMessages((prev) => prev.filter((m) => m.type !== "searching"));
          }
          const errorMessage =
            fallbackErr?.response?.data?.error || fallbackErr?.message || "Unknown error";
          setError(`Failed to get recommendations. ${errorMessage}`);
        }
      } finally {
        setIsSearching(false);
      }
    },
    [sessionId, buildControlConfig, injectSearchingMessage]
  );

  function applyPipelineResults(data, opts = {}) {
    const emitChatArtifacts = opts.emitChatArtifacts !== false;
    setSessionId(data.session_id);
    const matches = (data.matches || []).map((m) => ({
      car: m.car,
      details: m.details,
      score: m.score,
      combined_score: m.combined_score,
      semantic_score: m.semantic_score,
      advanced_score: m.advanced_score,
      graph_confidence: m.graph_confidence,
      score_breakdown: m.score_breakdown,
      reasoning_paths: m.reasoning_paths,
      critique_notes: m.critique_notes,
      agent_votes: m.agent_votes,
      low_confidence: m.low_confidence,
      low_confidence_override: m.low_confidence_override,
    }));
    setResults(matches);
    if (data.reviews) setReviews(data.reviews);
    if (data.sentiments) setSentiments(data.sentiments);
    if (data.agent_trace) setAgentTrace(data.agent_trace);
    if (data.pipeline_stats) setPipelineStats(data.pipeline_stats);
    if (data.variant_focus) setVariantFocusInfo(data.variant_focus);
    else setVariantFocusInfo(null);
    if (data.conflicts) setConflicts(data.conflicts);
    if (data.explanation_contexts) setExplanationContexts(data.explanation_contexts);
    if (data.agent_evaluations) setAgentEvaluations(data.agent_evaluations);
    if (data.scoring_diagnostics) setScoringDiagnostics(data.scoring_diagnostics);
    if (data.clarifying_questions) setClarifyingQuestions(data.clarifying_questions);
    if (data.user_control_applied) setUserControlApplied(data.user_control_applied);
    setHasSearched(true);
    if (emitChatArtifacts) {
      removeSearchingAndInjectResults(matches, {
        agentTrace: data.agent_trace,
        pipelineStats: data.pipeline_stats,
      }, {
        variantFocus: data.variant_focus || null,
      });
    }
  }

  function applyBasicResults(data, opts = {}) {
    const emitChatArtifacts = opts.emitChatArtifacts !== false;
    setSessionId(data.session_id);
    const matches = (data.matches || []).map((m) => ({
      car: m.car,
      details: m.details,
      score: m.combined_score || m.score,
      combined_score: m.combined_score || m.score,
    }));
    setResults(matches);
    if (data.reviews) setReviews(data.reviews);
    if (data.sentiments) setSentiments(data.sentiments);
    if (data.variant_focus) setVariantFocusInfo(data.variant_focus);
    else setVariantFocusInfo(null);
    setHasSearched(true);
    if (emitChatArtifacts) {
      removeSearchingAndInjectResults(matches, {}, {
        variantFocus: data.variant_focus || null,
      });
    }
  }

  /* ── Header search trigger ── */
  const handleSearchFromHeader = useCallback(() => {
    if (prefs.min_budget > prefs.max_budget) {
      setError("Min budget cannot exceed max budget");
      return;
    }
    searchCars(prefs, {
      userInput: chatMessages.filter((m) => m.type === "user").slice(-1)[0]?.text || "",
      conversationHistory: chatMessages.map((m) => ({
        role: m.type === "user" ? "user" : "assistant",
        content: m.text || "",
      })),
      emitChatArtifacts: true,
    });
  }, [prefs, chatMessages, searchCars]);

  const handleFormSearch = useCallback(() => {
    if (prefs.min_budget > prefs.max_budget) {
      setError("Min budget cannot exceed max budget");
      return;
    }
    searchCars(prefs, {
      userInput: "",
      conversationHistory: [],
      emitChatArtifacts: false,
    });
  }, [prefs, searchCars]);

  const mergeAskUpdatesIntoPrefs = useCallback((basePrefs, updates = {}) => {
    const next = { ...basePrefs };
    let changed = false;

    const assign = (key, value) => {
      if (value === undefined || value === null) return;
      if (next[key] === value) return;
      next[key] = value;
      changed = true;
    };

    if (Array.isArray(updates.budget) && updates.budget.length === 2) {
      const min = Number(updates.budget[0]);
      const max = Number(updates.budget[1]);
      if (Number.isFinite(min) && Number.isFinite(max)) {
        assign("min_budget", Math.max(0, Math.round(min)));
        assign("max_budget", Math.max(0, Math.round(max)));
      }
    }

    if (typeof updates.fuel_type === "string" && updates.fuel_type.trim()) {
      assign("fuel_type", updates.fuel_type.trim());
    }
    if (typeof updates.body_type === "string" && updates.body_type.trim()) {
      assign("body_type", updates.body_type.trim());
    }
    if (typeof updates.transmission === "string" && updates.transmission.trim()) {
      assign("transmission", updates.transmission.trim());
    }
    if (updates.seating !== undefined && updates.seating !== null) {
      const seating = Number(updates.seating);
      if (Number.isFinite(seating) && seating > 0) {
        assign("seating", Math.round(seating));
      }
    }
    if (typeof updates.brand === "string" && updates.brand.trim()) {
      assign("brand", updates.brand.trim());
    }
    if (updates.performance !== undefined && updates.performance !== null) {
      const perf = Number(updates.performance);
      if (Number.isFinite(perf)) {
        assign("performance", Math.min(10, Math.max(1, Math.round(perf))));
      }
    }

    const existingFeatures = normalizeFeatureList(basePrefs.features);
    const featureSet = new Set(existingFeatures);
    if (Array.isArray(updates.features)) {
      updates.features.forEach((f) => {
        const value = String(f || "").trim();
        if (value) featureSet.add(value);
      });
    }
    if (Array.isArray(updates.features_add)) {
      updates.features_add.forEach((f) => {
        const value = String(f || "").trim();
        if (value) featureSet.add(value);
      });
    }
    if (Array.isArray(updates.features_remove)) {
      updates.features_remove.forEach((f) => {
        const value = String(f || "").trim();
        if (value) featureSet.delete(value);
      });
    }
    const mergedFeatures = Array.from(featureSet);
    if (mergedFeatures.join("||") !== existingFeatures.join("||")) {
      next.features = mergedFeatures;
      changed = true;
    }

    return { nextPrefs: next, changed };
  }, []);

  const detectVariantFocusIntent = useCallback((text) => {
    const input = String(text || "").trim();
    if (!input) return "";
    const lowered = input.toLowerCase();
    const asksForVariants =
      lowered.includes("other variant") ||
      lowered.includes("more variant") ||
      lowered.includes("all variant") ||
      lowered.includes("another variant") ||
      lowered.includes("sibling variant");
    if (!asksForVariants) return "";

    const patterns = [
      /(?:other|more|all|another|sibling)\s+variants?\s+(?:of|for)\s+(.+)$/i,
      /variants?\s+(?:of|for)\s+(.+)$/i,
      /show\s+me\s+(.+?)\s+variants?$/i,
    ];
    let candidate = "";
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match?.[1]) {
        candidate = match[1].trim();
        break;
      }
    }
    candidate = candidate
      .replace(/[?.!]+$/, "")
      .replace(/\b(please|now|only|just)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    const resultVariants = (results || []).map((r) => r?.car?.variant).filter(Boolean);
    const shortlistVariants = (shortlist || []).filter(Boolean);
    const knownVariants = Array.from(new Set([...resultVariants, ...shortlistVariants]));

    if (candidate) {
      const candidateLower = candidate.toLowerCase();
      const direct = knownVariants.find((variant) => variant.toLowerCase() === candidateLower);
      if (direct) return direct;
      const fuzzy = knownVariants.find((variant) => variant.toLowerCase().includes(candidateLower));
      if (fuzzy) return fuzzy;
      return candidate;
    }

    return knownVariants[0] || "";
  }, [results, shortlist]);

  const exploreVariantFamily = useCallback(
    async (variantName, opts = {}) => {
      const variant = String(variantName || "").trim();
      if (!variant) {
        throw new Error("Could not detect which car variant to expand.");
      }
      const emitChatArtifacts = opts.emitChatArtifacts !== false;
      const userInput = opts.userInput || `Show other variants of ${variant}`;
      const conversationHistory = opts.conversationHistory || chatMessages.map((m) => ({
        role: m.type === "user" ? "user" : "assistant",
        content: m.text || "",
      }));

      if (emitChatArtifacts) {
        setChatMessages((prev) => [
          ...prev,
          { type: "user", text: userInput, timestamp: new Date() },
          { type: "bot", text: `Exploring other variants related to ${variant}.`, timestamp: new Date() },
        ]);
      }

      await searchCars(prefs, {
        userInput,
        conversationHistory,
        emitChatArtifacts,
        variantFamilyFocus: variant,
        excludeVariant: variant,
      });
    },
    [chatMessages, prefs, searchCars]
  );

  const askFormQuestion = useCallback(
    async (question) => {
      const prompt = String(question || "").trim();
      if (!prompt) {
        throw new Error("Please enter a question.");
      }
      if (!sessionId) {
        throw new Error("Run Find Matches first, then ask follow-up questions.");
      }

      const variantIntent = detectVariantFocusIntent(prompt);
      if (variantIntent) {
        await exploreVariantFamily(variantIntent, {
          emitChatArtifacts: false,
          userInput: prompt,
          conversationHistory: [{ role: "user", content: prompt }],
        });
        return {
          type: "answer",
          content: `Done. I re-ran the pipeline focusing on variants related to ${variantIntent}.`,
        };
      }

      const response = await axios.post(`${API_BASE_URL}/api/ask`, {
        question: prompt,
        session_id: sessionId,
      });

      const payload = response.data || {};
      if (payload.type === "update" && payload.updates) {
        const { nextPrefs, changed } = mergeAskUpdatesIntoPrefs(prefs, payload.updates);
        if (changed) {
          setPrefs(nextPrefs);
          await searchCars(nextPrefs, {
            userInput: prompt,
            conversationHistory: [{ role: "user", content: prompt }],
            emitChatArtifacts: false,
          });
        }
      }

      return payload;
    },
    [sessionId, mergeAskUpdatesIntoPrefs, prefs, searchCars, detectVariantFocusIntent, exploreVariantFamily]
  );

  /* ── Reset ── */
  const handleReset = useCallback(() => {
    setPrefs({ ...DEFAULT_PREFS });
    setUserControls({ ...DEFAULT_USER_CONTROLS });
    setChatMessages([]);
    setChatPrefs({});
    setResults([]);
    setHasSearched(false);
    setError("");
    setSessionId("");
    setReviews({});
    setSentiments({});
    setAgentTrace([]);
    setPipelineStats(null);
    setConflicts([]);
    setExplanationContexts([]);
    setAgentEvaluations([]);
    setScoringDiagnostics(null);
    setClarifyingQuestions([]);
    setUserControlApplied(null);
    setVariantFocusInfo(null);
    setShortlist([]);
    setShowAdvancedInChat(false);
    setAdvancedOffered(false);
    setChatMessages([
      {
        type: "bot",
        text: "Hey! I'm your AI car consultant. Tell me what kind of car you're looking for — budget, fuel type, body style, features — and I'll find your perfect match.",
        timestamp: new Date(),
        showStarters: true,
      },
    ]);
  }, []);

  /* ── Chatbot init ── */
  useEffect(() => {
    if (chatMessages.length === 0) {
      setChatMessages([
        {
          type: "bot",
          text: "Hey! I'm your AI car consultant. Tell me what kind of car you're looking for — budget, fuel type, body style, features — and I'll find your perfect match.",
          timestamp: new Date(),
          showStarters: true,
        },
      ]);
    }
  }, []);

  /* ── Send chat message ── */
  const sendMessage = useCallback(async (messageOverride = null) => {
    if (isChatLoading) return;
    const sourceMessage =
      typeof messageOverride === "string" ? messageOverride : currentMessage;
    if (!sourceMessage.trim()) return;
    const userMessage = sourceMessage.trim();
    setCurrentMessage("");

    const nextHistory = [
      ...chatMessages,
      { type: "user", text: userMessage, timestamp: new Date() },
    ];
    setChatMessages(nextHistory);
    setIsChatLoading(true);
    setIsTyping(true);

    try {
      const variantIntent = detectVariantFocusIntent(userMessage);
      if (variantIntent) {
        setIsTyping(false);
        await searchCars(prefs, {
          userInput: userMessage,
          conversationHistory: nextHistory.map((m) => ({
            role: m.type === "user" ? "user" : "assistant",
            content: m.text || "",
          })),
          emitChatArtifacts: true,
          variantFamilyFocus: variantIntent,
        });
        return;
      }

      const response = await axios.post(`${API_BASE_URL}/api/chat`, {
        message: userMessage,
        history: nextHistory,
        preferences: chatPrefs,
        user_control_config: buildControlConfig(),
      });

      setIsTyping(false);

      if (response.data.preferences) {
        const p = response.data.preferences;
        const normalizedFeatures = normalizeFeatureList(p.features);
        setChatPrefs({
          ...p,
          features: normalizedFeatures,
        });
        setPrefs((prev) => ({
          ...prev,
          ...(p.min_budget ? { min_budget: p.min_budget } : {}),
          ...(p.max_budget ? { max_budget: p.max_budget } : {}),
          ...(p.fuel_type ? { fuel_type: p.fuel_type } : {}),
          ...(p.body_type ? { body_type: p.body_type } : {}),
          ...(p.transmission ? { transmission: p.transmission } : {}),
          ...(p.seating ? { seating: p.seating } : {}),
          ...(normalizedFeatures.length > 0 || p.features !== undefined ? { features: normalizedFeatures } : {}),
          ...(p.performance ? { performance: p.performance } : {}),
        }));
      }

      if (response.data.user_control_config) {
        setUserControls((prev) => ({ ...prev, ...response.data.user_control_config }));
      }

      const updatedPrefs = { ...prefs };
      if (response.data.preferences) {
        const p = response.data.preferences;
        if (p.min_budget) updatedPrefs.min_budget = p.min_budget;
        if (p.max_budget) updatedPrefs.max_budget = p.max_budget;
        if (p.fuel_type) updatedPrefs.fuel_type = p.fuel_type;
        if (p.body_type) updatedPrefs.body_type = p.body_type;
        if (p.transmission) updatedPrefs.transmission = p.transmission;
        if (p.seating) updatedPrefs.seating = p.seating;
        if (p.features !== undefined) updatedPrefs.features = normalizeFeatureList(p.features);
        if (p.performance) updatedPrefs.performance = p.performance;
      }

      const isReady = response.data.ready_to_search || shouldTriggerSearch(updatedPrefs);

      if (isReady && !advancedOffered) {
        setAdvancedOffered(true);
        setChatMessages((prev) => [
          ...prev,
          { type: "bot", text: response.data.response, timestamp: new Date() },
          {
            type: "bot",
            text: "I have your basic preferences. Would you like to fine-tune your search with advanced controls — like brand preferences, budget flexibility, must-have features, or scoring priorities? Or should I find matches now?",
            timestamp: new Date(),
            showAdvancedOffer: true,
          },
        ]);
      } else if (isReady && advancedOffered) {
        setChatMessages((prev) => [
          ...prev,
          { type: "bot", text: response.data.response || "Let me find your best matches now.", timestamp: new Date() },
        ]);
        setTimeout(() => {
          searchCars(updatedPrefs, {
            userInput: userMessage,
            conversationHistory: [...chatMessages, { type: "user", text: userMessage }].map(
              (m) => ({ role: m.type === "user" ? "user" : "assistant", content: m.text || "" })
            ),
          });
        }, 300);
      } else {
        setChatMessages((prev) => [
          ...prev,
          { type: "bot", text: response.data.response, timestamp: new Date() },
        ]);
      }
    } catch (err) {
      console.error("Chat error:", err);
      setIsTyping(false);
      setChatMessages((prev) => [
        ...prev,
        { type: "bot", text: "I apologize, I'm having trouble connecting. Could you try again?", timestamp: new Date() },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  }, [currentMessage, isChatLoading, chatMessages, chatPrefs, prefs, searchCars, buildControlConfig, advancedOffered, detectVariantFocusIntent]);

  /* ── Handle advanced offer response ── */
  const handleAdvancedChoice = useCallback((wantAdvanced) => {
    if (wantAdvanced) {
      setShowAdvancedInChat(true);
      setChatMessages((prev) => [
        ...prev,
        { type: "user", text: "Yes, let me fine-tune", timestamp: new Date() },
        {
          type: "bot",
          text: "Great! I've opened the advanced controls panel. Adjust your brand preferences, budget flexibility, must-have features, and more. Hit 'Find Matches' when you're ready.",
          timestamp: new Date(),
        },
      ]);
    } else {
      setChatMessages((prev) => [
        ...prev,
        { type: "user", text: "No, find matches now", timestamp: new Date() },
      ]);
      const currentPrefs = { ...prefs };
      setTimeout(() => {
        searchCars(currentPrefs, {
          userInput: "Find my best car matches",
          conversationHistory: chatMessages.map((m) => ({
            role: m.type === "user" ? "user" : "assistant",
            content: m.text || "",
          })),
        });
      }, 300);
    }
  }, [prefs, chatMessages, searchCars]);

  /* ── Shortlist ── */
  const toggleShortlist = useCallback((variant) => {
    const wasSelected = shortlist.includes(variant);
    setShortlist((prev) => (wasSelected ? prev.filter((v) => v !== variant) : [...prev, variant]));

    if (wasSelected) {
      sendFeedbackEvent({
        action: "removed_from_shortlist",
        rejected_variants: [variant],
      });
    } else {
      sendFeedbackEvent({
        action: "shortlisted_variant",
        accepted_variants: [variant],
      });
    }
  }, [shortlist, sendFeedbackEvent]);

  const topScore = results[0]?.combined_score || 100;

  /* ══════════════════════════════════════════
     RENDER — Full-width single-pane
     ══════════════════════════════════════════ */
  return (
    <div className="relative min-h-screen text-[rgb(var(--vw-text-strong))]">
      {/* Atmospheric background */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute inset-[-18%]"
          style={{
            background:
              "radial-gradient(ellipse 76% 58% at 12% 10%, rgba(255,91,53,0.13), transparent 66%), radial-gradient(ellipse 74% 56% at 88% 12%, rgba(133,213,237,0.12), transparent 64%), radial-gradient(ellipse 72% 58% at 50% 100%, rgba(160,120,240,0.10), transparent 65%), linear-gradient(180deg, rgba(7,9,14,0.98), rgba(7,9,14,1))",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "62px 62px",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(133,213,237,0.22) 1px, transparent 1.2px)",
            backgroundSize: "30px 30px",
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,9,14,0.35)_0%,rgba(7,9,14,0.12)_10%,rgba(7,9,14,0)_24%,rgba(7,9,14,0)_78%,rgba(7,9,14,0.48)_90%,rgba(7,9,14,0.86)_100%)]" />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 pt-[176px] pb-8">
        <ConsultationHeader
          mode={mode}
          setMode={setMode}
          onReset={handleReset}
          appliedCount={appliedCount}
        />

        {lightningStatus && (
          <div className="mt-2 flex justify-end">
            <div className="inline-flex items-center gap-2 rounded-lg border border-[rgba(133,213,237,0.16)] bg-[rgba(133,213,237,0.06)] px-3 py-1.5 text-[10px] text-[rgba(133,213,237,0.8)]">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  lightningStatus.training_running
                    ? "bg-[rgba(80,200,180,0.95)] shadow-[0_0_8px_rgba(80,200,180,0.8)]"
                    : "bg-[rgba(255,255,255,0.45)]"
                }`}
              />
              Agent Lightning: {lightningStatus.agentlightning_imported ? "active" : "trace mode"}
              {lightningStatus.training_running ? " • training" : ""}
            </div>
          </div>
        )}

        {/* Full-width single pane */}
        <div className="mt-2">
          <AnimatePresence mode="wait">
            {mode === "chat" ? (
              <motion.div
                key="chat"
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <ChatPanel
                  chatMessages={chatMessages}
                  currentMessage={currentMessage}
                  setCurrentMessage={setCurrentMessage}
                  sendMessage={sendMessage}
                  isChatLoading={isChatLoading}
                  isTyping={isTyping}
                  isSearching={isSearching}
                  onReset={handleReset}
                  prefs={prefs}
                  userControls={userControls}
                  updatePrefs={updatePrefs}
                  updateControls={updateControls}
                  onRemovePref={updatePrefs}
                  showAdvancedInChat={showAdvancedInChat}
                  onAdvancedChoice={handleAdvancedChoice}
                  results={results}
                  topScore={topScore}
                  shortlist={shortlist}
                  toggleShortlist={toggleShortlist}
                  reviews={reviews}
                  sentiments={sentiments}
                  explanationContexts={explanationContexts}
                  variantFocusInfo={variantFocusInfo}
                  hasSearched={hasSearched}
                  onSearch={handleSearchFromHeader}
                  onWhyTopFive={() => setShowWhyDrawer(true)}
                  onExploreVariants={(variant) =>
                    exploreVariantFamily(variant, { emitChatArtifacts: true })
                  }
                />
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <FormPanel
                  prefs={prefs}
                  userControls={userControls}
                  updatePrefs={updatePrefs}
                  updateControls={updateControls}
                />
                <div className="mt-5 flex justify-center">
                  <button
                    onClick={handleFormSearch}
                    disabled={isSearching}
                    className="min-w-[220px] px-6 py-3 rounded-xl text-[13px] font-bold transition-all duration-250 disabled:opacity-45 disabled:cursor-not-allowed backdrop-blur-md bg-[rgba(255,91,53,0.12)] text-[rgba(255,91,53,0.9)] border border-[rgba(255,91,53,0.22)] hover:bg-[rgba(255,91,53,0.16)] hover:border-[rgba(255,91,53,0.32)] shadow-[0_4px_16px_rgba(0,0,0,0.25),0_0_12px_rgba(255,91,53,0.05)]"
                  >
                    {isSearching ? "Searching..." : hasSearched ? "Update Matches" : "Find Matches"}
                  </button>
                </div>
                <div className="mt-6" ref={formResultsRef}>
                  <FormResultsPanel
                    results={results}
                    hasSearched={hasSearched}
                    isSearching={isSearching}
                    topScore={topScore}
                    shortlist={shortlist}
                    toggleShortlist={toggleShortlist}
                    reviews={reviews}
                    sentiments={sentiments}
                    explanationContexts={explanationContexts}
                    variantFocusInfo={variantFocusInfo}
                    onWhyTopFive={() => setShowWhyDrawer(true)}
                    agentTrace={agentTrace}
                    pipelineStats={pipelineStats}
                    sessionId={sessionId}
                    onAskQuestion={askFormQuestion}
                    onExploreVariants={(variant) =>
                      exploreVariantFamily(variant, { emitChatArtifacts: false })
                    }
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div className="mt-4 p-3 backdrop-blur-md bg-[rgba(255,60,60,0.06)] border border-[rgba(255,60,60,0.15)] rounded-xl text-sm text-[rgba(255,80,80,0.8)]">
              {error}
            </div>
          )}
        </div>
      </div>

      <WhyTopFiveDrawer
        isOpen={showWhyDrawer}
        onClose={() => setShowWhyDrawer(false)}
        results={results}
        agentTrace={agentTrace}
        pipelineStats={pipelineStats}
        conflicts={conflicts}
        agentEvaluations={agentEvaluations}
        scoringDiagnostics={scoringDiagnostics}
        userControlApplied={userControlApplied}
        explanationContexts={explanationContexts}
        clarifyingQuestions={clarifyingQuestions}
        variantFocusInfo={variantFocusInfo}
      />
    </div>
  );
}
