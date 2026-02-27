"""
Agent Lightning Bridge

Provides Agent Lightning-compatible training traces without making runtime
inference dependent on optional training libraries.
"""

from __future__ import annotations

import json
import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional


class AgentLightningBridge:
    """
    Emits normalized pipeline traces to JSONL and optionally forwards to
    Agent Lightning `agl.emit_*` hooks when available.
    """

    def __init__(self, trace_path: Optional[str] = None):
        default_path = Path(__file__).resolve().parent / "training" / "agent_lightning_traces.jsonl"
        self.trace_path = Path(trace_path or os.getenv("VW_AGENT_LIGHTNING_TRACE_PATH", str(default_path)))
        self.enabled = os.getenv("VW_ENABLE_AGENT_LIGHTNING_TRACING", "1") != "0"
        self.training_enabled = os.getenv("VW_AGENT_LIGHTNING_TRAINING_ENABLED", "1") != "0"
        self.training_min_feedback_events = int(os.getenv("VW_AGENT_LIGHTNING_TRAIN_MIN_FEEDBACK_EVENTS", "3"))
        self.training_cooldown_seconds = int(os.getenv("VW_AGENT_LIGHTNING_TRAIN_COOLDOWN_SECONDS", "120"))
        self._feedback_events_since_train = 0
        self._last_training_started_ts = 0.0
        self._last_training_finished_ts = 0.0
        self._last_training_status = "never"
        self._last_training_error = ""
        self._training_lock = threading.Lock()
        self._training_thread: Optional[threading.Thread] = None
        self._client = None
        self._client_checked = False
        self._ensure_trace_parent()

    def _ensure_trace_parent(self) -> None:
        self.trace_path.parent.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _ts() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _safe_json(payload: Dict[str, Any]) -> Dict[str, Any]:
        # Normalize unknown objects to repr for JSONL persistence.
        normalized = {}
        for k, v in payload.items():
            try:
                json.dumps(v)
                normalized[k] = v
            except Exception:
                normalized[k] = repr(v)
        return normalized

    def _load_client(self):
        if self._client_checked:
            return self._client
        self._client_checked = True
        try:
            import agentlightning as agl  # type: ignore

            self._client = agl
        except Exception:
            self._client = None
        return self._client

    def _line_count(self) -> int:
        try:
            if not self.trace_path.exists():
                return 0
            with self.trace_path.open("r", encoding="utf-8") as handle:
                return sum(1 for _ in handle)
        except Exception:
            return 0

    def status(self) -> Dict[str, Any]:
        client = self._load_client()
        return {
            "enabled": self.enabled,
            "trace_path": str(self.trace_path),
            "trace_exists": self.trace_path.exists(),
            "trace_records": self._line_count(),
            "agentlightning_imported": bool(client),
            "training_enabled": self.training_enabled,
            "training_min_feedback_events": self.training_min_feedback_events,
            "training_cooldown_seconds": self.training_cooldown_seconds,
            "feedback_events_since_train": self._feedback_events_since_train,
            "training_running": bool(self._training_thread and self._training_thread.is_alive()),
            "last_training_started_ts": self._last_training_started_ts or None,
            "last_training_finished_ts": self._last_training_finished_ts or None,
            "last_training_status": self._last_training_status,
            "last_training_error": self._last_training_error or None,
        }

    def _emit_to_agent_lightning(self, event_type: str, payload: Dict[str, Any]) -> None:
        client = self._load_client()
        if not client:
            return

        # Agent Lightning exposes helper emit APIs as agl.emit_xxx in its README.
        candidates = [
            f"emit_{event_type}",
            "emit_event",
            "emit_trace",
            "emit_record",
        ]
        for name in candidates:
            fn = getattr(client, name, None)
            if not callable(fn):
                continue
            try:
                if name == "emit_event":
                    fn(event_type, payload)
                else:
                    fn(payload)
                return
            except TypeError:
                try:
                    fn(**payload)
                    return
                except Exception:
                    continue
            except Exception:
                continue

    def emit(self, event_type: str, payload: Dict[str, Any]) -> None:
        if not self.enabled:
            return
        record = {
            "event_type": event_type,
            "timestamp": self._ts(),
            "payload": self._safe_json(payload),
        }
        try:
            with self.trace_path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(record, ensure_ascii=True) + "\n")
        except Exception:
            # Trace write failures should never break recommendation flow.
            pass

        self._emit_to_agent_lightning(event_type, record["payload"])

    def _run_training_pipeline(self, force: bool = False) -> None:
        with self._training_lock:
            self._last_training_started_ts = time.time()
            self._last_training_status = "running"
            self._last_training_error = ""
            try:
                from train_agent_lightning import (
                    build_training_episodes,
                    load_trace_records,
                    maybe_run_agent_lightning,
                    save_dataset,
                    DEFAULT_DATASET_PATH,
                )

                records = load_trace_records(self.trace_path)
                episodes = build_training_episodes(records)
                save_dataset(DEFAULT_DATASET_PATH, episodes)

                # If Agent Lightning package is available, run best-effort training.
                if self._load_client():
                    maybe_run_agent_lightning(DEFAULT_DATASET_PATH)

                self._last_training_status = "ok"
                self._feedback_events_since_train = 0
            except Exception as exc:
                self._last_training_status = "error"
                self._last_training_error = str(exc)
            finally:
                self._last_training_finished_ts = time.time()

    def maybe_schedule_training(self, force: bool = False) -> bool:
        if not self.enabled or not self.training_enabled:
            return False
        if self._training_thread and self._training_thread.is_alive():
            return False

        now = time.time()
        cooldown_ok = (now - self._last_training_started_ts) >= self.training_cooldown_seconds
        enough_feedback = self._feedback_events_since_train >= self.training_min_feedback_events
        if not force and (not cooldown_ok or not enough_feedback):
            return False

        self._training_thread = threading.Thread(
            target=self._run_training_pipeline,
            kwargs={"force": force},
            daemon=True,
            name="agent-lightning-trainer",
        )
        self._training_thread.start()
        return True

    def session_start(self, session_id: str, payload: Optional[Dict[str, Any]] = None) -> None:
        self.emit("session_start", {"session_id": session_id, **(payload or {})})

    def session_end(self, session_id: str, payload: Optional[Dict[str, Any]] = None) -> None:
        self.emit("session_end", {"session_id": session_id, **(payload or {})})

    def agent_step(self, session_id: str, step: int, agent: str, payload: Optional[Dict[str, Any]] = None) -> None:
        self.emit(
            "agent_step",
            {
                "session_id": session_id,
                "step": step,
                "agent": agent,
                **(payload or {}),
            },
        )

    def ranking_event(self, session_id: str, payload: Optional[Dict[str, Any]] = None) -> None:
        self.emit("ranking_event", {"session_id": session_id, **(payload or {})})

    def feedback_event(self, session_id: str, payload: Optional[Dict[str, Any]] = None) -> None:
        self.emit("feedback_event", {"session_id": session_id, **(payload or {})})
        self._feedback_events_since_train += 1
        self.maybe_schedule_training(force=False)
