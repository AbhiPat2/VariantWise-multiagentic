"""
Offline training data builder for Agent Lightning.

Builds reward-shaped episodes from VariantWise JSONL traces and can
optionally invoke Agent Lightning training APIs when installed.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List


DEFAULT_TRACE_PATH = Path(__file__).resolve().parent / "training" / "agent_lightning_traces.jsonl"
DEFAULT_DATASET_PATH = Path(__file__).resolve().parent / "training" / "agent_lightning_dataset.jsonl"


def load_trace_records(trace_path: Path) -> List[Dict[str, Any]]:
    records: List[Dict[str, Any]] = []
    if not trace_path.exists():
        return records
    with trace_path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except Exception:
                continue
    return records


def build_training_episodes(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    by_session: Dict[str, List[Dict[str, Any]]] = {}
    for record in records:
        payload = record.get("payload", {}) or {}
        session_id = str(payload.get("session_id", "")).strip()
        if not session_id:
            continue
        by_session.setdefault(session_id, []).append(record)

    episodes: List[Dict[str, Any]] = []
    for session_id, events in by_session.items():
        reward = 0.0
        steps = []
        top_variants = []

        for event in events:
            event_type = event.get("event_type", "")
            payload = event.get("payload", {}) or {}
            if event_type == "agent_step":
                steps.append(
                    {
                        "step": payload.get("step"),
                        "agent": payload.get("agent"),
                        "status": payload.get("status"),
                        "outputs": payload.get("outputs", {}),
                    }
                )
            elif event_type == "ranking_event":
                top_variants = [str(v) for v in (payload.get("top_variants", []) or []) if str(v).strip()]
            elif event_type == "feedback_event":
                accepted = payload.get("accepted_variants", []) or []
                rejected = payload.get("rejected_variants", []) or []
                reward += 2.0 * len(accepted)
                reward -= 1.0 * len(rejected)

        if top_variants:
            reward += 0.2 * len(top_variants[:3])

        episodes.append(
            {
                "session_id": session_id,
                "reward": round(reward, 4),
                "steps": steps,
                "top_variants": top_variants[:5],
            }
        )

    return episodes


def save_dataset(dataset_path: Path, episodes: List[Dict[str, Any]]) -> None:
    dataset_path.parent.mkdir(parents=True, exist_ok=True)
    with dataset_path.open("w", encoding="utf-8") as f:
        for episode in episodes:
            f.write(json.dumps(episode, ensure_ascii=True) + "\n")


def maybe_run_agent_lightning(dataset_path: Path) -> None:
    try:
        import agentlightning as agl  # type: ignore
    except Exception:
        print("Agent Lightning package not available. Dataset prepared only.")
        return

    # Best-effort API compatibility across potential package versions.
    for api in ("train", "fit", "run_training"):
        fn = getattr(agl, api, None)
        if callable(fn):
            try:
                fn(dataset_path=str(dataset_path))
                print(f"Agent Lightning training invoked via agl.{api}(dataset_path=...).")
                return
            except Exception as e:
                print(f"Attempt agl.{api} failed: {e}")

    trainer_cls = getattr(agl, "Trainer", None)
    if trainer_cls:
        try:
            trainer = trainer_cls(dataset_path=str(dataset_path))
            for method in ("train", "fit", "run"):
                m = getattr(trainer, method, None)
                if callable(m):
                    m()
                    print(f"Agent Lightning training invoked via Trainer.{method}().")
                    return
        except Exception as e:
            print(f"Trainer invocation failed: {e}")

    print("Agent Lightning detected, but no known training API entrypoint matched.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build VariantWise Agent Lightning dataset.")
    parser.add_argument("--trace-path", default=str(DEFAULT_TRACE_PATH))
    parser.add_argument("--output-path", default=str(DEFAULT_DATASET_PATH))
    parser.add_argument("--run-agentlightning", action="store_true")
    args = parser.parse_args()

    trace_path = Path(args.trace_path)
    output_path = Path(args.output_path)

    records = load_trace_records(trace_path)
    episodes = build_training_episodes(records)
    save_dataset(output_path, episodes)

    print(f"Loaded records: {len(records)}")
    print(f"Built episodes: {len(episodes)}")
    print(f"Saved dataset: {output_path}")

    if args.run_agentlightning:
        maybe_run_agent_lightning(output_path)


if __name__ == "__main__":
    main()

