import pandas as pd
import numpy as np
import os
import re
import difflib
import json
import urllib.request
import urllib.parse
import threading
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
from sklearn.metrics.pairwise import cosine_similarity
import boto3
from botocore.config import Config
import traceback
import requests
from typing import Dict, Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Helper function to convert numpy types to native Python types
def make_json_serializable(obj):
    """Recursively convert numpy types and pandas objects to JSON-serializable types"""
    if isinstance(obj, dict):
        return {k: make_json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [make_json_serializable(item) for item in obj]
    elif isinstance(obj, pd.Series):
        series = obj.astype(object).where(pd.notnull(obj), None)
        return make_json_serializable(series.to_dict())
    elif isinstance(obj, pd.DataFrame):
        df = obj.astype(object).where(pd.notnull(obj), None)
        return make_json_serializable(df.to_dict(orient="records"))
    elif isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32)):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return make_json_serializable(obj.tolist())
    else:
        # pd.isna(obj) can return arrays/Series; only treat scalar True as NA.
        try:
            na = pd.isna(obj)
            if isinstance(na, (bool, np.bool_)) and na:
                return None
        except Exception:
            pass
        return obj


def _to_rupees(value: str, unit: Optional[str]) -> Optional[int]:
    """Convert textual amounts like 15L/1.2 crore into rupees."""
    try:
        amount = float(value)
    except Exception:
        return None

    if unit:
        u = unit.strip().lower()
        if u.startswith('c'):  # crore
            return int(amount * 10000000)
        if u.startswith('l'):  # lakh
            return int(amount * 100000)
    # If no unit and amount looks small, assume lakhs in conversational input.
    if amount < 1000:
        return int(amount * 100000)
    return int(amount)


_COMMON_BRANDS = [
    "Maruti", "Hyundai", "Honda", "Toyota", "Kia", "Mahindra", "Tata",
    "Skoda", "Volkswagen", "MG", "Renault", "Nissan", "Citroen", "Jeep",
    "BMW", "Mercedes-Benz", "Audi", "Volvo", "BYD", "Lexus", "Jaguar",
    "Land Rover", "Porsche"
]


def _known_brands() -> Dict[str, str]:
    """
    Return a case-insensitive brand lookup map.
    Uses common brands plus dataset brands (if loaded).
    """
    brand_map = {b.lower(): b for b in _COMMON_BRANDS}
    try:
        if isinstance(df, pd.DataFrame) and not df.empty and "brand" in df.columns:
            for b in df["brand"].dropna().astype(str).tolist():
                brand = b.strip()
                if not brand:
                    continue
                key = brand.lower()
                if key not in brand_map:
                    brand_map[key] = brand
    except Exception:
        pass
    return brand_map


def _extract_brand_list(fragment: str) -> list:
    """
    Parse a free-form brand phrase into canonical brand names.
    Example: "hyundai, kia and honda" -> ["Hyundai", "Kia", "Honda"]
    """
    if not fragment:
        return []

    cleaned = re.sub(r'[\.\!\?].*$', '', fragment).strip()
    if not cleaned:
        return []

    parts = re.split(r',|/|;|\band\b|\bor\b', cleaned, flags=re.IGNORECASE)
    brand_map = _known_brands()

    out = []
    seen = set()
    for raw_part in parts:
        token = re.sub(r'[^a-zA-Z0-9\-\s&]+', ' ', (raw_part or "")).strip()
        if not token:
            continue

        # Remove common non-brand words in command-style phrases.
        token = re.sub(
            r'\b(brand|brands|car|cars|please|only|just|show|me|with|without|prefer|include|exclude|avoid|remove|from)\b',
            ' ',
            token,
            flags=re.IGNORECASE
        )
        token = re.sub(r'\s+', ' ', token).strip()
        if not token:
            continue

        lower_token = token.lower()
        resolved = None
        if lower_token in brand_map:
            resolved = brand_map[lower_token]
        else:
            # Match multi-word brand mentions in larger fragments.
            for lower_brand, canonical in brand_map.items():
                if re.search(rf'\b{re.escape(lower_brand)}\b', lower_token):
                    resolved = canonical
                    break

        if resolved:
            key = resolved.lower()
            if key not in seen:
                seen.add(key)
                out.append(resolved)

    return out


def extract_preferences_heuristic(
    user_message: str,
    extracted_prefs: Dict,
    user_control_config: Dict
) -> Dict:
    """
    Deterministic fallback preference extraction when LLM is unavailable.
    Keeps chatbot functional even if OpenAI key/model request fails.
    """
    text = (user_message or "").lower()
    updated_prefs = dict(extracted_prefs or {})
    updated_controls = dict(user_control_config or {})

    # Budget extraction: range first, then upper cap style.
    range_match = re.search(
        r'(?:between|from)\s*₹?\s*([\d.]+)\s*(l|lac|lakh|lakhs|c|cr|crore)?\s*(?:and|to|-)\s*₹?\s*([\d.]+)\s*(l|lac|lakh|lakhs|c|cr|crore)?',
        text
    )
    if range_match:
        min_budget = _to_rupees(range_match.group(1), range_match.group(2))
        max_budget = _to_rupees(range_match.group(3), range_match.group(4))
        if min_budget and max_budget:
            updated_prefs["min_budget"] = min(min_budget, max_budget)
            updated_prefs["max_budget"] = max(min_budget, max_budget)
    else:
        cap_match = re.search(
            r'(?:under|below|upto|up to|max|maximum|around)\s*₹?\s*([\d.]+)\s*(l|lac|lakh|lakhs|c|cr|crore)?',
            text
        )
        if cap_match:
            max_budget = _to_rupees(cap_match.group(1), cap_match.group(2))
            if max_budget:
                updated_prefs["min_budget"] = int(max_budget * 0.6)
                updated_prefs["max_budget"] = max_budget

    body_map = {
        "suv": "SUV",
        "sedan": "Sedan",
        "hatchback": "Hatchback",
        "muv": "MUV",
        "crossover": "Crossover",
    }
    for key, value in body_map.items():
        if key in text:
            updated_prefs["body_type"] = value
            break

    fuel_map = {
        "petrol": "Petrol",
        "diesel": "Diesel",
        "electric": "Electric",
        "ev": "Electric",
        "cng": "CNG",
        "hybrid": "Hybrid",
    }
    for key, value in fuel_map.items():
        if key in text:
            updated_prefs["fuel_type"] = value
            break

    if "automatic" in text or "amt" in text or "cvt" in text or "dct" in text:
        updated_prefs["transmission"] = "Automatic"
    elif "manual" in text:
        updated_prefs["transmission"] = "Manual"

    seats_match = re.search(r'(\d+)\s*(?:seater|seaters|seats?)', text)
    if seats_match:
        try:
            updated_prefs["seating"] = int(seats_match.group(1))
        except Exception:
            pass

    feature_patterns = {
        "Sunroof": ["sunroof", "panoramic"],
        "Apple CarPlay": ["carplay", "apple carplay"],
        "Android Auto": ["android auto"],
        "360 Camera": ["360", "360 camera"],
        "Ventilated Seats": ["ventilated seat", "ventilated"],
        "Wireless Charging": ["wireless charging", "wireless charger"],
        "Climate Control": ["climate control", "auto ac"],
        "Lane Assist": ["lane assist", "adas"],
    }
    features = list(updated_prefs.get("features", []) or [])
    for canonical, patterns in feature_patterns.items():
        if any(p in text for p in patterns) and canonical not in features:
            features.append(canonical)
    if features:
        updated_prefs["features"] = features

    if "performance" in text or "powerful" in text or "sporty" in text:
        updated_prefs["performance"] = max(7, int(updated_prefs.get("performance", 5) or 5))
    elif "comfort" in text or "mileage" in text or "efficiency" in text:
        updated_prefs["performance"] = min(4, int(updated_prefs.get("performance", 5) or 5))

    if "variety" in text or "different options" in text or "diverse" in text:
        updated_controls["diversity_mode"] = "maximum_diversity"
    elif "best match" in text or "most relevant" in text:
        updated_controls["diversity_mode"] = "maximum_relevance"

    return {
        "preferences": updated_prefs,
        "user_control_config": updated_controls
    }


def build_next_question_from_preferences(preferences: Dict) -> str:
    """Generate a useful follow-up question if chat runs in fallback mode."""
    if not preferences.get("max_budget"):
        return "What budget range should we target? You can say something like under ₹15 lakh."
    if not preferences.get("body_type"):
        return "Which body style are you leaning toward: SUV, Sedan, Hatchback, or MUV?"
    if not preferences.get("fuel_type"):
        return "Do you prefer Petrol, Diesel, CNG, Hybrid, or Electric?"
    if not preferences.get("transmission"):
        return "Would you like Automatic or Manual transmission?"
    if not preferences.get("seating"):
        return "How many seats do you need?"
    return "Great, I have enough to start searching. I’ll shortlist strong options now."


def split_basic_and_controls(extracted_data: Dict):
    """
    Split extraction payload into basic preferences and advanced controls.

    Supports flat fields and nested payloads:
    - {"preferences": {...}, "user_control_config": {...}}
    - {"basic_preferences": {...}, "advanced_controls": {...}}
    """
    if not isinstance(extracted_data, dict):
        return {}, {}

    basic_pref_keys = {
        'min_budget', 'max_budget', 'body_type', 'fuel_type',
        'transmission', 'seating', 'features', 'performance', 'brand'
    }

    basic_prefs = {}
    controls = {}

    nested_basic = extracted_data.get('preferences')
    if isinstance(nested_basic, dict):
        basic_prefs.update(nested_basic)

    nested_basic_alt = extracted_data.get('basic_preferences')
    if isinstance(nested_basic_alt, dict):
        basic_prefs.update(nested_basic_alt)

    nested_controls = extracted_data.get('user_control_config')
    if isinstance(nested_controls, dict):
        controls.update(nested_controls)

    nested_controls_alt = extracted_data.get('advanced_controls')
    if isinstance(nested_controls_alt, dict):
        controls.update(nested_controls_alt)

    for key, value in extracted_data.items():
        if key in {'preferences', 'basic_preferences', 'user_control_config', 'advanced_controls'}:
            continue
        if key in basic_pref_keys:
            basic_prefs[key] = value
        else:
            controls[key] = value

    return basic_prefs, controls


# === Data normalization utilities (inlined) ===
_MULTI_WORD_BRANDS = [
    "Land Rover",
    "Mercedes Benz",
    "Mercedes-Benz",
    "Mahindra & Mahindra",
    "Aston Martin",
    "Rolls Royce",
    "Alfa Romeo",
    "Mini Cooper",
]


def parse_price(value: object) -> Optional[float]:
    """
    Parse price strings into numeric rupees.
    Handles formats like "₹12.5 Lakh", "12,50,000", "On Request".
    """
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None

    text = str(value).strip().lower()
    if not text or text in {"n/a", "na", "none", "on request", "price not available"}:
        return None

    text = text.replace("₹", "").replace(",", "").strip()

    # Handle lakh/crore formats
    lakh_match = re.search(r"(\d+(\.\d+)?)\s*lakh", text)
    if lakh_match:
        return float(lakh_match.group(1)) * 100000

    crore_match = re.search(r"(\d+(\.\d+)?)\s*crore", text)
    if crore_match:
        return float(crore_match.group(1)) * 10000000

    # Fallback: extract digits
    digits = re.findall(r"\d+", text)
    if not digits:
        return None

    return float("".join(digits))


def parse_seating(value: object) -> Optional[int]:
    """
    Extract numeric seating capacity from strings like "5 Seater", "5+2".
    """
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None

    text = str(value).strip().lower()
    if not text or text in {"n/a", "na", "none"}:
        return None

    match = re.findall(r"\d+", text)
    if not match:
        return None

    # Handle "5+2" as 7 seats
    nums = [int(m) for m in match]
    return sum(nums) if len(nums) > 1 else nums[0]


def normalize_fuel_type(value: object) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return "Unknown"

    text = str(value).lower()
    if any(k in text for k in ["electric", "ev", "battery"]):
        return "Electric"
    if "cng" in text or "compressed natural gas" in text:
        return "CNG"
    if "diesel" in text:
        return "Diesel"
    if "hybrid" in text:
        return "Hybrid"
    if "petrol" in text or "gasoline" in text:
        return "Petrol"
    return "Unknown"


def normalize_body_type(value: object) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return "Unknown"

    text = str(value).lower()
    if any(k in text for k in ["suv", "sport utility", "compact suv", "midsize suv"]):
        return "SUV"
    if any(k in text for k in ["muv", "mpv", "multi utility", "multi purpose"]):
        return "MUV"
    if "sedan" in text:
        return "Sedan"
    if "hatch" in text:
        return "Hatchback"
    if "crossover" in text:
        return "Crossover"
    return "Unknown"


def normalize_transmission(value: object) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return "Unknown"

    text = str(value).lower()
    if any(k in text for k in ["amt", "cvt", "dct", "ivt", "automatic"]):
        return "Automatic"
    if any(k in text for k in ["manual", "mt"]):
        return "Manual"
    return "Unknown"


def extract_brand(variant_name: str, brand_col: Optional[str] = None) -> str:
    """
    Extract brand from explicit brand column or variant name.
    """
    if brand_col and brand_col.strip():
        return brand_col.strip()

    name = (variant_name or "").strip()
    if not name:
        return "Unknown"

    for brand in _MULTI_WORD_BRANDS:
        if name.lower().startswith(brand.lower()):
            return brand

    return name.split()[0] if name.split() else "Unknown"


def normalize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """
    Adds normalized columns to the DataFrame:
    - numeric_price
    - brand
    - fuel_type_norm
    - body_type_norm
    - transmission_norm
    - seating_norm
    """
    normalized = df.copy()

    if "variant" in normalized.columns:
        normalized["variant"] = (
            normalized["variant"].astype(str).str.strip().str.replace('"', "").str.replace("'", "")
        )

    normalized["numeric_price"] = normalized.get("price", "").apply(parse_price)
    normalized["seating_norm"] = normalized.get("Seating Capacity", "").apply(parse_seating)
    normalized["fuel_type_norm"] = normalized.get("Fuel Type", "").apply(normalize_fuel_type)
    normalized["body_type_norm"] = normalized.get("Body Type", "").apply(normalize_body_type)
    normalized["transmission_norm"] = normalized.get("Transmission Type", "").apply(normalize_transmission)
    normalized["brand"] = normalized.apply(
        lambda row: extract_brand(row.get("variant", ""), row.get("brand", "")),
        axis=1,
    )

    return normalized


def _clean_variant_family_text(value: object) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", str(value or "").lower())).strip()


def _infer_variant_family_label(variant_name: str) -> str:
    """
    Infer a coarse family label from a full variant name.
    Example: "Tata Altroz XZA Plus DCT" -> "tata altroz"
    """
    cleaned = _clean_variant_family_text(variant_name)
    if not cleaned:
        return ""
    tokens = cleaned.split()
    if len(tokens) >= 2:
        return f"{tokens[0]} {tokens[1]}"
    return tokens[0]


def _filter_dataset_for_variant_focus(
    variants_df: pd.DataFrame,
    focus_variant: str = "",
    focus_model: str = "",
    focus_brand: str = "",
    exclude_variant: str = "",
):
    """
    Apply optional variant-family focus to keep recommendations within a selected
    model/brand neighborhood while still running the full graph+agent pipeline.
    """
    if variants_df is None or variants_df.empty:
        return variants_df, {}

    focus_variant = (focus_variant or "").strip()
    focus_model = (focus_model or "").strip()
    focus_brand = (focus_brand or "").strip()
    exclude_variant = (exclude_variant or "").strip()

    if not focus_variant and not focus_model and not focus_brand and not exclude_variant:
        return variants_df, {}

    subset = variants_df.copy()
    reason = []
    family_label = _infer_variant_family_label(focus_variant) if focus_variant else _clean_variant_family_text(focus_model)

    if family_label:
        reason.append(f"family={family_label}")
        normalized_variant = subset.get("variant", pd.Series([], dtype="object")).astype(str).str.lower().str.strip()
        family_pattern = re.escape(family_label)
        mask = (
            normalized_variant.str.contains(rf"^{family_pattern}\b", regex=True, na=False)
            | normalized_variant.str.contains(rf"\b{family_pattern}\b", regex=True, na=False)
        )
        subset = subset[mask]

    if focus_brand:
        brand_norm = _clean_variant_family_text(focus_brand).split(" ")[0]
        if brand_norm:
            reason.append(f"brand={brand_norm}")
            if "brand" in subset.columns:
                brand_mask = subset["brand"].astype(str).str.lower().str.contains(rf"\b{re.escape(brand_norm)}\b", regex=True, na=False)
            else:
                brand_mask = subset["variant"].astype(str).str.lower().str.contains(rf"^{re.escape(brand_norm)}\b", regex=True, na=False)
            subset = subset[brand_mask]

    if exclude_variant:
        exclude_norm = _clean_variant_family_text(exclude_variant)
        if exclude_norm:
            reason.append(f"exclude={exclude_norm}")
            variant_norm = subset.get("variant", pd.Series([], dtype="object")).astype(str).apply(_clean_variant_family_text)
            subset = subset[variant_norm != exclude_norm]

    focus_context = {
        "active": True,
        "focus_variant": focus_variant or None,
        "focus_model": focus_model or None,
        "focus_brand": focus_brand or None,
        "exclude_variant": exclude_variant or None,
        "family_label": family_label or None,
        "reason": ", ".join(reason) if reason else "manual_focus",
        "dataset_size_before": int(len(variants_df)),
        "dataset_size_after": int(len(subset)),
    }
    return subset, focus_context

# Retrieve values from the environment
aws_access_key_id = os.getenv("AWS_ACCESS_KEY_ID")
aws_secret_access_key = os.getenv("AWS_SECRET_ACCESS_KEY")
aws_region = os.getenv("AWS_REGION")

app = Flask(__name__)
# Allow all origins for development to rule out CORS issues
CORS(app, resources={r"/*": {"origins": "*"}})

# === Constants ===
DATA_FILE = "../data/final_dataset.csv"
REVIEWS_DIR = "../data/reviews"

# === Enhanced Preference Structure ===
preference_config = {
    "budget": {
        "type": "range",
        "min_label": "Minimum budget (₹)",
        "max_label": "Maximum budget (₹)",
        "min_value": 100000,
        "max_value": 10000000,
        "weight": 10
    },
    "fuel_type": {
        "type": "select",
        "label": "Preferred fuel type",
        "options": ["Any", "Petrol", "Diesel", "Electric", "CNG", "Hybrid"],
        "weight": 8
    },
    "body_type": {
        "type": "select",
        "label": "Preferred body style",
        "options": ["Any", "SUV", "Sedan", "Hatchback", "MUV", "Crossover"],
        "weight": 7
    },
    "transmission": {
        "type": "select",
        "label": "Transmission preference",
        "options": ["Any", "Manual", "Automatic", "CVT", "DCT", "AMT"],
        "weight": 6
    },
    "seating": {
        "type": "slider",
        "label": "Minimum seats required",
        "min": 2,
        "max": 9,
        "weight": 5
    },
    "features": {
        "type": "multiselect",
        "label": "Must-have features",
        "options": ["Sunroof", "Apple CarPlay/Android Auto", "Automatic Climate Control",
                    "360 Camera", "Lane Assist", "Ventilated Seats", "Wireless Charging"],
        "weight": 3
    },
    "performance": {
        "type": "slider",
        "label": "Performance importance (1-10)",
        "min": 1,
        "max": 10,
        "weight": 4
    }
}

# === Helper Functions ===


def load_models():
    """Load embedding model and optional Bedrock client."""
    try:
        # Lazy import avoids blocking Flask startup at module import time.
        print("Loading Sentence Transformer module...")
        from sentence_transformers import SentenceTransformer

        print("Loading Sentence Transformer model...")
        embedding_model = SentenceTransformer("msmarco-distilbert-base-v4")
        print("Sentence Transformer model loaded.")
    except Exception as e:
        print(f"\n--- ERROR Loading Embedding Model ---")
        print(f"Error type: {type(e)}")
        print(f"Error message: {str(e)}")
        print(f"Traceback:\n{traceback.format_exc()}")
        return None, None

    llm = None
    if aws_access_key_id and aws_secret_access_key:
        try:
            print("Initializing Bedrock client...")
            bedrock_config = Config(
                connect_timeout=int(os.getenv("VW_BEDROCK_CONNECT_TIMEOUT", "3")),
                read_timeout=int(os.getenv("VW_BEDROCK_READ_TIMEOUT", "8")),
                retries={"max_attempts": 1, "mode": "standard"}
            )
            bedrock_client = boto3.client(
                "bedrock-runtime",
                region_name=aws_region,
                aws_access_key_id=aws_access_key_id,
                aws_secret_access_key=aws_secret_access_key,
                config=bedrock_config
            )
            print("Bedrock client initialized.")

            try:
                from langchain_community.chat_models import BedrockChat
                llm = BedrockChat(
                    model_id="mistral.mixtral-8x7b-instruct-v0:1",
                    client=bedrock_client,
                    model_kwargs={"max_tokens": 1024, "temperature": 0.4}
                )
                print("BedrockChat model initialized.")
            except Exception as e:
                print(f"Warning: BedrockChat initialization failed: {e}. Q&A/sentiment features will be disabled.")
                llm = None
        except Exception as e:
            print(f"Warning: Bedrock client setup failed: {e}. Continuing without Bedrock.")
            llm = None
    else:
        print("AWS credentials not set. Continuing without Bedrock features.")

    return embedding_model, llm


def should_generate_sentiments():
    """Gate Bedrock sentiment generation to avoid blocking requests."""
    return os.getenv("VW_ENABLE_SENTIMENTS", "0") == "1"


def load_car_data():
    try:
        df = pd.read_csv(DATA_FILE)
        df = normalize_dataframe(df)
        print(f"Loaded {len(df)} car variants. Sample variants: {df['variant'].head(3).tolist()}")
        if os.getenv("VW_DEBUG_PARSE") == "1":
            null_stats = {
                'numeric_price': df['numeric_price'].isna().sum(),
                'seating_norm': df['seating_norm'].isna().sum(),
                'fuel_type_norm': (df['fuel_type_norm'] == 'Unknown').sum(),
                'body_type_norm': (df['body_type_norm'] == 'Unknown').sum(),
                'transmission_norm': (df['transmission_norm'] == 'Unknown').sum()
            }
            print(f"[DEBUG] Normalization stats: {null_stats}")
        # Preserve numeric columns for scoring
        numeric_cols = ['numeric_price', 'seating_norm']
        for col in df.columns:
            if col not in numeric_cols:
                df[col] = df[col].fillna("N/A")
        return df
    except Exception as e:
        print(f"Error loading car data: {e}")
        return pd.DataFrame()


def generate_car_summary(row):
    features = []
    feature_map = {
        'Sunroof': ['sunroof', 'panoramic'],
        'Apple CarPlay/Android Auto': ['carplay', 'android auto'],
        'Automatic Climate Control': ['climate control'],
        '360 Camera': ['360', 'surround view'],
        'Lane Assist': ['lane assist', 'lane keep'],
        'Ventilated Seats': ['ventilated'],
        'Wireless Charging': ['wireless charging']
    }

    # Ensure 'row' is a Pandas Series for consistent access
    if not isinstance(row, pd.Series):
        row = pd.Series(row)  # Convert if it's a dict (e.g., from JSON)

    for feat, keywords in feature_map.items():
        # Access .values attribute, not call it as a function
        if any(any(kw in str(v).lower() for v in row.values) for kw in keywords):
            features.append(feat)

    # Extract numeric values from string fields
    try:
        power = int(re.findall(r'\d+', str(row.get('Max Power', '')))[0])
    except:
        power = 0  # Default if extraction fails

    comfort_scores = [
        row.get('front_seat_comfort_score', 0),
        row.get('rear_seat_comfort_score', 0),
        row.get('bump_absorption_score', 0),
        row.get('material_quality_score', 0)
    ]
    # Filter out non-numeric scores before calculating mean
    numeric_comfort_scores = [
        s for s in comfort_scores if isinstance(s, (int, float))]
    comfort = round(np.mean(numeric_comfort_scores),
                    2) if numeric_comfort_scores else 0

    # Normalized fields (for semantic summary)
    brand = row.get('brand', 'N/A')
    fuel_norm = row.get('fuel_type_norm', row.get('Fuel Type', 'N/A'))
    body_norm = row.get('body_type_norm', row.get('Body Type', 'N/A'))
    trans_norm = row.get('transmission_norm', row.get('Transmission Type', 'N/A'))
    seating_norm = row.get('seating_norm', row.get('Seating Capacity', 'N/A'))
    numeric_price = row.get('numeric_price', None)
    if isinstance(numeric_price, (int, float)):
        price_norm = f"₹{int(numeric_price):,}"
    else:
        price_norm = row.get('price', 'N/A')

    # Use .get() for potentially missing columns to avoid KeyErrors
    return (
        f"{row.get('variant', 'N/A')} | Brand: {brand} | Price: {price_norm} | "
        f"Fuel: {fuel_norm} | Body: {body_norm} | Transmission: {trans_norm} | "
        f"Seats: {seating_norm} | "
        # Handle empty features
        f"Power: {power}bhp | Features: {', '.join(features) if features else 'None'} | "
        f"Comfort Score: {comfort}/5"
    )


def generate_user_summary(prefs):
    features = prefs.get('features', [])
    return (
        f"Budget: ₹{prefs['budget'][0]:,}-₹{prefs['budget'][1]:,} | "
        f"Fuel: {prefs['fuel_type']} | Body: {prefs['body_type']} | "
        f"Transmission: {prefs['transmission']} | Seats: {prefs['seating']}+ | "
        f"Features: {', '.join(features) if features else 'None'} | "
        f"Performance Priority: {prefs['performance']}/10 | "
        f"Normalized: Fuel={prefs['fuel_type']}, Body={prefs['body_type']}, "
        f"Transmission={prefs['transmission']}, Seats={prefs['seating']}"
    )

# === Core Matching Logic ===


def enhanced_matching(cars_df, prefs, scoring_weights=None, user_control_config=None):
    """
    Enhanced matching with dynamic scoring weights.
    
    Args:
        cars_df: DataFrame of car variants
        prefs: User preferences
        scoring_weights: Optional DynamicScoringWeights instance. If None, uses defaults.
        user_control_config: Optional UserControlConfig or dict for advanced controls.
    """
    from dynamic_scoring_config import DynamicScoringWeights

    # Use dynamic weights if provided, otherwise create from preferences + controls.
    if scoring_weights is None:
        scoring_weights = DynamicScoringWeights.from_user_preferences(prefs, user_control_config)

    def clamp(value, min_val, max_val):
        return max(min_val, min(max_val, value))

    def to_float(value, default=0.0):
        try:
            if value is None:
                return default
            return float(value)
        except Exception:
            return default

    def norm_text(value):
        return " ".join(str(value or "").strip().lower().split())

    def similarity(a, b):
        a_norm = norm_text(a)
        b_norm = norm_text(b)
        if not a_norm or not b_norm:
            return 0.0
        if a_norm == b_norm:
            return 1.0
        ratio = difflib.SequenceMatcher(None, a_norm, b_norm).ratio()
        a_tokens = set(a_norm.replace("/", " ").replace("-", " ").split())
        b_tokens = set(b_norm.replace("/", " ").replace("-", " ").split())
        jaccard = len(a_tokens & b_tokens) / max(1, len(a_tokens | b_tokens))
        return max(ratio, jaccard)

    def extract_numeric(value):
        try:
            if value is None:
                return None
            matches = re.findall(r"(\d+(?:\.\d+)?)", str(value))
            if not matches:
                return None
            return float(matches[0])
        except Exception:
            return None

    def row_text_blob(car_row):
        return " ".join([str(v).lower() for v in car_row.values if v is not None])

    control_data = {}
    if user_control_config:
        if isinstance(user_control_config, dict):
            control_data = user_control_config
        else:
            try:
                control_data = user_control_config.to_dict()
            except Exception:
                control_data = {}

    must_have_features = {norm_text(f) for f in (control_data.get("must_have_features", []) or []) if norm_text(f)}
    nice_to_have_features = {norm_text(f) for f in (control_data.get("nice_to_have_features", []) or []) if norm_text(f)}
    feature_weight_map = {
        norm_text(k): to_float(v, 1.0)
        for k, v in (control_data.get("feature_weights", {}) or {}).items()
        if norm_text(k)
    }
    brand_mode = norm_text(control_data.get("brand_mode", "any") or "any")
    preferred_brands = {norm_text(b) for b in (control_data.get("preferred_brands", []) or []) if norm_text(b)}
    blacklisted_brands = {norm_text(b) for b in (control_data.get("blacklisted_brands", []) or []) if norm_text(b)}
    price_preference = norm_text(control_data.get("price_preference", ""))
    price_tolerance = clamp(to_float(control_data.get("price_tolerance", 0.2), 0.2), 0.02, 0.5)
    use_cases = [norm_text(u) for u in (control_data.get("use_cases", []) or []) if norm_text(u)]
    use_case_weights = {
        norm_text(k): clamp(to_float(v, 1.0), 0.3, 2.0)
        for k, v in (control_data.get("use_case_weights", {}) or {}).items()
        if norm_text(k)
    }
    comparison_mode = bool(control_data.get("comparison_mode", False))
    comparison_cars = [str(c).strip() for c in (control_data.get("comparison_cars", []) or []) if str(c).strip()]
    similar_to_car = str(control_data.get("similar_to_car", "") or "").strip()
    exploration_rate = clamp(to_float(control_data.get("exploration_rate", 0.1), 0.1), 0.0, 0.5)
    exploration_rate_set = bool(control_data.get("exploration_rate_set", True))
    objective_weights = control_data.get("objective_weights", {}) or {}

    default_priorities = {
        "budget": 0.5,
        "fuel_type": 0.5,
        "body_type": 0.5,
        "transmission": 0.5,
        "seating": 0.5,
        "features": 0.5,
        "performance": 0.5,
    }
    scoring_priorities = {**default_priorities, **(control_data.get("scoring_priorities", {}) or {})}
    if not exploration_rate_set:
        # Gate priorities until exploration is explicitly set in UI.
        scoring_priorities = {**default_priorities}
    for k in list(scoring_priorities.keys()):
        scoring_priorities[k] = clamp(to_float(scoring_priorities.get(k), 0.5), 0.0, 1.0)

    def priority_multiplier(key, min_mult=0.65, max_mult=1.85):
        p = scoring_priorities.get(key, 0.5)
        return min_mult + (max_mult - min_mult) * p

    exploration_norm = clamp(exploration_rate / 0.5, 0.0, 1.0)

    def constraint_strictness(key):
        p = scoring_priorities.get(key, 0.5)
        return clamp((0.68 * p) + (0.32 * (1.0 - exploration_norm)), 0.0, 1.0)

    def is_hard_constraint(key):
        return constraint_strictness(key) >= 0.78

    # Normalize comparison targets once.
    comparison_targets = [norm_text(c) for c in comparison_cars if norm_text(c)]
    similar_anchor = norm_text(similar_to_car)
    comparison_focus = clamp(
        (
            scoring_priorities.get("body_type", 0.5)
            + scoring_priorities.get("fuel_type", 0.5)
            + scoring_priorities.get("transmission", 0.5)
            + scoring_priorities.get("performance", 0.5)
        )
        / 4.0,
        0.0,
        1.0,
    )

    brand_frequency = (
        cars_df.get("brand", pd.Series([], dtype="object"))
        .fillna("unknown")
        .astype(str)
        .str.strip()
        .str.lower()
        .value_counts()
        .to_dict()
    )
    max_brand_count = max(brand_frequency.values()) if brand_frequency else 1

    def comparison_match_score(car_row):
        if not comparison_mode and not similar_anchor:
            return 0.0
        names_to_compare = [
            car_row.get("variant", ""),
            car_row.get("model", ""),
            f"{car_row.get('brand', '')} {car_row.get('model', '')}",
        ]
        names_to_compare = [n for n in names_to_compare if str(n).strip()]
        if not names_to_compare:
            return 0.0
        best = 0.0
        if comparison_targets:
            for candidate in names_to_compare:
                for target in comparison_targets:
                    best = max(best, similarity(candidate, target))
        if similar_anchor:
            for candidate in names_to_compare:
                best = max(best, similarity(candidate, similar_anchor))
        return clamp(best, 0.0, 1.0)

    def use_case_match_score(car_row):
        if not use_cases:
            return 0.0

        body = norm_text(car_row.get("body_type_norm", car_row.get("Body Type", "")))
        fuel = norm_text(car_row.get("fuel_type_norm", car_row.get("Fuel Type", "")))
        transmission = norm_text(car_row.get("transmission_norm", car_row.get("Transmission Type", "")))
        seating_val = extract_numeric(car_row.get("seating_norm", car_row.get("Seating Capacity", 0))) or 0
        mileage_val = (
            extract_numeric(car_row.get("Petrol Mileage ARAI", None))
            or extract_numeric(car_row.get("Diesel Mileage ARAI", None))
            or extract_numeric(car_row.get("Mileage", None))
            or 0
        )
        power_val = extract_numeric(car_row.get("Max Power", 0)) or 0

        score_total = 0.0
        for use_case in use_cases:
            weight = use_case_weights.get(use_case, 1.0)
            case_score = 0.0

            if use_case == "city_commute":
                if any(t in body for t in ["hatchback", "sedan", "crossover"]):
                    case_score += 0.35
                if any(t in fuel for t in ["petrol", "cng", "electric", "hybrid"]):
                    case_score += 0.25
                if mileage_val >= 15:
                    case_score += 0.25
                if "automatic" in transmission or "cvt" in transmission or "amt" in transmission:
                    case_score += 0.15
            elif use_case == "highway":
                if power_val >= 110:
                    case_score += 0.4
                if seating_val >= 5:
                    case_score += 0.2
                if any(t in body for t in ["suv", "sedan", "muv"]):
                    case_score += 0.25
                if mileage_val >= 14:
                    case_score += 0.15
            elif use_case == "family_trips":
                if seating_val >= 6:
                    case_score += 0.45
                elif seating_val >= 5:
                    case_score += 0.3
                if any(t in body for t in ["suv", "muv"]):
                    case_score += 0.35
                if "automatic" in transmission or "cvt" in transmission or "amt" in transmission:
                    case_score += 0.2
            elif use_case == "weekend":
                if power_val >= 120:
                    case_score += 0.45
                if any(t in body for t in ["suv", "sedan", "crossover"]):
                    case_score += 0.25
                if "automatic" in transmission or "dct" in transmission:
                    case_score += 0.15
                if mileage_val >= 12:
                    case_score += 0.15

            score_total += case_score * weight

        return score_total / max(1.0, float(len(use_cases)))

    pref_features = []
    for feat in (prefs.get("features", []) or []):
        key = norm_text(feat)
        if key and key not in pref_features:
            pref_features.append(key)
    for feat in (control_data.get("must_have_features", []) or []) + (control_data.get("nice_to_have_features", []) or []):
        key = norm_text(feat)
        if key and key not in pref_features:
            pref_features.append(key)

    results = []
    min_budget, max_budget = prefs.get("budget", (0, 10000000))
    if max_budget <= min_budget:
        max_budget = min_budget + 1

    for _, car in cars_df.iterrows():
        score = 0.0
        details = {}
        score_breakdown = {
            "budget": 0.0,
            "fuel_type": 0.0,
            "body_type": 0.0,
            "transmission": 0.0,
            "seating": 0.0,
            "features": 0.0,
            "performance": 0.0,
            "brand_preference": 0.0,
            "price_preference": 0.0,
            "use_case": 0.0,
            "comparison": 0.0,
            "exploration": 0.0,
            "priority_adjustment": 0.0,
        }

        car_brand = norm_text(car.get("brand", ""))
        if not car_brand:
            car_brand = norm_text(str(car.get("variant", "")).split(" ")[0])

        # Hard constraints first.
        if car_brand and car_brand in blacklisted_brands:
            continue
        if brand_mode == "strict" and preferred_brands and car_brand not in preferred_brands:
            continue

        requested_brand = norm_text(prefs.get("brand", ""))
        if requested_brand not in ("", "any") and requested_brand not in car_brand:
            continue

        # Brand preference shaping.
        if preferred_brands:
            if car_brand in preferred_brands:
                brand_boost = 2.2 + (1.8 * scoring_priorities.get("body_type", 0.5))
                score += brand_boost
                score_breakdown["brand_preference"] += float(brand_boost)
                details["brand_preference"] = "Preferred brand"
            elif brand_mode == "preferred":
                brand_penalty = -1.4
                score += brand_penalty
                score_breakdown["brand_preference"] += float(brand_penalty)

        price = car.get("numeric_price")
        budget_matched = False
        if pd.notna(price):
            budget_mult = priority_multiplier("budget")
            effective_tolerance_multiplier = max(scoring_weights.budget_tolerance_multiplier, 1.0 + price_tolerance)
            if min_budget <= price <= max_budget:
                budget_component = float(scoring_weights.budget_within_range) * budget_mult
                score += budget_component
                score_breakdown["budget"] += budget_component
                details["price"] = "Within budget"
                budget_matched = True
            elif price <= max_budget * effective_tolerance_multiplier:
                over_pct = (float(price) - float(max_budget)) / max(1.0, float(max_budget))
                tolerance_span = max(0.01, effective_tolerance_multiplier - 1.0)
                softness = clamp(1.0 - (over_pct / tolerance_span), 0.1, 1.0)
                budget_component = float(scoring_weights.budget_slightly_over) * softness * budget_mult
                score += budget_component
                score_breakdown["budget"] += budget_component
                details["price"] = "Slightly over budget"
                budget_matched = True
            else:
                if is_hard_constraint("budget"):
                    continue
                budget_penalty = -2.0 * priority_multiplier("budget", 0.5, 1.5)
                score += budget_penalty
                score_breakdown["budget"] += budget_penalty
        elif is_hard_constraint("budget"):
            continue

        # Price preference: lower / mid / higher inside budget.
        if pd.notna(price) and max_budget > min_budget and price_preference in {"lower", "mid", "higher"}:
            budget_position = clamp((float(price) - float(min_budget)) / max(1.0, float(max_budget - min_budget)), 0.0, 1.0)
            if price_preference == "lower":
                alignment = 1.0 - budget_position
            elif price_preference == "higher":
                alignment = budget_position
            else:
                alignment = 1.0 - (abs(budget_position - 0.5) * 2.0)
            price_pref_component = (alignment - 0.5) * 4.0 * priority_multiplier("budget", 0.3, 1.1)
            score += price_pref_component
            score_breakdown["price_preference"] += float(price_pref_component)

        # Fuel type.
        fuel_value = norm_text(car.get("fuel_type_norm", car.get("Fuel Type", "")))
        fuel_pref = norm_text(prefs.get("fuel_type", "Any"))
        fuel_match = fuel_pref in ("", "any") or fuel_pref in fuel_value
        if fuel_pref not in ("", "any"):
            if fuel_match:
                fuel_component = float(scoring_weights.fuel_type_match) * priority_multiplier("fuel_type")
                score += fuel_component
                score_breakdown["fuel_type"] += fuel_component
            else:
                if is_hard_constraint("fuel_type"):
                    continue
                fuel_penalty = -1.5 * priority_multiplier("fuel_type", 0.4, 1.4)
                score += fuel_penalty
                score_breakdown["fuel_type"] += fuel_penalty

        # Body type.
        body_value = norm_text(car.get("body_type_norm", car.get("Body Type", "")))
        body_pref = norm_text(prefs.get("body_type", "Any"))
        body_match = body_pref in ("", "any") or body_pref in body_value
        if body_pref not in ("", "any"):
            if body_match:
                body_component = float(scoring_weights.body_type_match) * priority_multiplier("body_type")
                score += body_component
                score_breakdown["body_type"] += body_component
            else:
                if is_hard_constraint("body_type"):
                    continue
                body_penalty = -1.4 * priority_multiplier("body_type", 0.4, 1.4)
                score += body_penalty
                score_breakdown["body_type"] += body_penalty

        # Transmission.
        trans_value = norm_text(car.get("transmission_norm", car.get("Transmission Type", "")))
        trans_pref = norm_text(prefs.get("transmission", "Any"))
        trans_match = trans_pref in ("", "any") or trans_pref in trans_value
        if trans_pref not in ("", "any"):
            if trans_match:
                trans_component = float(scoring_weights.transmission_match) * priority_multiplier("transmission")
                score += trans_component
                score_breakdown["transmission"] += trans_component
            else:
                if is_hard_constraint("transmission"):
                    continue
                trans_penalty = -1.2 * priority_multiplier("transmission", 0.4, 1.4)
                score += trans_penalty
                score_breakdown["transmission"] += trans_penalty

        # Seating capacity.
        seating_match = False
        required_seating = int(prefs.get("seating", 0) or 0)
        seating_value = extract_numeric(car.get("seating_norm", car.get("Seating Capacity")))
        if seating_value is not None and required_seating > 0:
            if int(seating_value) >= required_seating:
                seating_component = float(scoring_weights.seating_match) * priority_multiplier("seating")
                score += seating_component
                score_breakdown["seating"] += seating_component
                details["seating"] = "Meets requirement"
                seating_match = True
            else:
                if is_hard_constraint("seating"):
                    continue
                seating_penalty = -1.6 * priority_multiplier("seating", 0.4, 1.5)
                score += seating_penalty
                score_breakdown["seating"] += seating_penalty

        # Feature matching: all controls + user-selected features contribute.
        matched_features = []
        feature_blob = row_text_blob(car)
        for feat in pref_features:
            if feat in feature_blob:
                matched_features.append(feat)
                weight_multiplier = 1.0
                if feat in must_have_features:
                    weight_multiplier *= 1.8
                elif feat in nice_to_have_features:
                    weight_multiplier *= 1.25
                if feat in feature_weight_map:
                    weight_multiplier *= clamp(feature_weight_map[feat], 0.5, 2.5)
                feature_component = float(scoring_weights.feature_match_per_item) * weight_multiplier * priority_multiplier("features")
                score += feature_component
                score_breakdown["features"] += feature_component

        missing_must = [feat for feat in must_have_features if feat not in feature_blob]
        if missing_must:
            if is_hard_constraint("features"):
                continue
            missing_penalty = -1.8 * len(missing_must) * priority_multiplier("features", 0.4, 1.4)
            score += missing_penalty
            score_breakdown["features"] += missing_penalty
            details["missing_must_have"] = ", ".join(missing_must[:4])

        if matched_features:
            details["features"] = f"Matched: {', '.join(matched_features[:5])}"

        # Performance and efficiency scoring.
        try:
            power = extract_numeric(car.get("Max Power", ""))
            mileage = (
                extract_numeric(car.get("Petrol Mileage ARAI", None))
                or extract_numeric(car.get("Diesel Mileage ARAI", None))
                or extract_numeric(car.get("Mileage", None))
                or 0
            )
            perf_pref = int(prefs.get("performance", 5) or 5)
            perf_mult = priority_multiplier("performance")
            if perf_pref > 5 and power and power > float(scoring_weights.performance_base_threshold):
                performance_component = (perf_pref * float(scoring_weights.performance_multiplier)) * perf_mult
                score += performance_component
                score_breakdown["performance"] += float(performance_component)
                details["performance"] = f"Power: {int(power)}bhp"
            elif perf_pref <= 5:
                efficiency_score = clamp((mileage - 10.0) / 10.0, 0.0, 1.0)
                efficiency_component = efficiency_score * (6 - perf_pref) * 0.8 * perf_mult
                score += efficiency_component
                score_breakdown["performance"] += float(efficiency_component)
        except Exception:
            pass

        # Use-case contribution.
        if use_cases:
            use_case_score = use_case_match_score(car)
            use_case_priority = (
                scoring_priorities.get("body_type", 0.5)
                + scoring_priorities.get("fuel_type", 0.5)
                + scoring_priorities.get("seating", 0.5)
                + scoring_priorities.get("performance", 0.5)
            ) / 4.0
            use_case_component = use_case_score * (5.0 + (2.5 * use_case_priority))
            score += use_case_component
            score_breakdown["use_case"] += float(use_case_component)

        # Comparison mode and similar-to controls.
        comp_signal = comparison_match_score(car)
        if comparison_mode or similar_anchor:
            comp_component = (comp_signal - 0.35) * (4.0 + 2.5 * comparison_focus)
            score += comp_component
            score_breakdown["comparison"] += float(comp_component)
            if comp_signal >= 0.65:
                details["comparison_fit"] = "Aligned with comparison target"

        # Exploration bonus: increase chance of long-tail brands when user asks.
        brand_count = brand_frequency.get(car_brand, 1)
        rarity = 1.0 - (float(brand_count) / float(max_brand_count))
        exploration_focus = clamp(
            to_float(objective_weights.get("exploration", exploration_rate), exploration_rate),
            0.0,
            1.0,
        )
        exploration_bonus = rarity * exploration_rate * (1.8 + 1.2 * exploration_focus)
        if exploration_rate > 0.25:
            exploration_bonus -= (1.0 - rarity) * exploration_rate * 0.9
        score += exploration_bonus
        score_breakdown["exploration"] += float(exploration_bonus)

        # Priority calibration so sliders directly influence final rank.
        weighted_signal_total = (
            scoring_priorities["budget"]
            + scoring_priorities["fuel_type"]
            + scoring_priorities["body_type"]
            + scoring_priorities["transmission"]
            + scoring_priorities["seating"]
            + scoring_priorities["features"]
            + scoring_priorities["performance"]
        )
        weighted_signal_match = 0.0
        if budget_matched:
            weighted_signal_match += scoring_priorities["budget"]
        if fuel_pref in ("", "any") or fuel_match:
            weighted_signal_match += scoring_priorities["fuel_type"]
        if body_pref in ("", "any") or body_match:
            weighted_signal_match += scoring_priorities["body_type"]
        if trans_pref in ("", "any") or trans_match:
            weighted_signal_match += scoring_priorities["transmission"]
        if required_seating <= 0 or seating_match:
            weighted_signal_match += scoring_priorities["seating"]
        if not must_have_features or len(missing_must) == 0:
            weighted_signal_match += scoring_priorities["features"]
        priority_fit = weighted_signal_match / max(1e-6, weighted_signal_total)
        priority_adjustment = (priority_fit - 0.5) * 3.0
        score += priority_adjustment
        score_breakdown["priority_adjustment"] += float(priority_adjustment)
        score_breakdown["constraint_strictness"] = {
            "budget": float(constraint_strictness("budget")),
            "fuel_type": float(constraint_strictness("fuel_type")),
            "body_type": float(constraint_strictness("body_type")),
            "transmission": float(constraint_strictness("transmission")),
            "seating": float(constraint_strictness("seating")),
            "features": float(constraint_strictness("features")),
            "performance": float(constraint_strictness("performance")),
        }

        # Holistic exact-match marker.
        budget_buffer = max_budget * (1.0 + float(scoring_weights.budget_buffer_percentage))
        is_price_perfect = pd.notna(price) and min_budget <= price <= budget_buffer
        has_active_filters = any([
            fuel_pref not in ("", "any"),
            body_pref not in ("", "any"),
            trans_pref not in ("", "any"),
            bool(must_have_features),
            bool(preferred_brands),
            comparison_mode,
        ])

        if has_active_filters and is_price_perfect and (fuel_pref in ("", "any") or fuel_match) and (body_pref in ("", "any") or body_match) and (trans_pref in ("", "any") or trans_match):
            details["verdict"] = "Best Match"

        results.append({
            "car": car,
            "score": float(score),
            "details": details,
            "score_breakdown": score_breakdown,
        })

    return sorted(results, key=lambda x: x["score"], reverse=True)

# === Review Processing ===


def load_reviews(top_cars):
    reviews = {}
    for car in top_cars:
        variant = car['variant']
        closest_match = difflib.get_close_matches(
            variant,
            [f[:-4] for f in os.listdir(REVIEWS_DIR)],
            n=1,
            cutoff=0.6
        )
        if closest_match:
            try:
                # Added encoding
                with open(os.path.join(REVIEWS_DIR, f"{closest_match[0]}.txt"), 'r', encoding='utf-8') as f:
                    reviews[variant] = f.read()
            except FileNotFoundError:
                print(f"Review file not found for {closest_match[0]}")
            except Exception as e:
                print(f"Error reading review file {closest_match[0]}.txt: {e}")
    return reviews


# Global variables to store models and data
embedding_model, llm = None, None
models_loading = False
models_lock = threading.Lock()
df = None
car_matches = {}
car_reviews = {}
session_feedback_events = {}
pipeline = None
pipeline_init_error = None
_pipeline_init_lock = threading.Lock()

# Default ON so /api/recommend_with_graph uses full graph + multi-agent pipeline
# unless explicitly disabled via VW_ENABLE_GRAPH_PIPELINE=0.
GRAPH_PIPELINE_ENABLED = os.getenv("VW_ENABLE_GRAPH_PIPELINE", "1") == "1"

PIPELINE_INIT_TIMEOUT = int(os.getenv("VW_PIPELINE_INIT_TIMEOUT", "45"))


def get_recommendation_pipeline(timeout=None):
    """
    Return the initialized pipeline.
    If startup initialization failed, raise the stored failure.
    """
    global pipeline, pipeline_init_error

    if pipeline is not None:
        return pipeline
    if pipeline_init_error is not None:
        raise RuntimeError(f"Graph pipeline unavailable: {pipeline_init_error}")
    raise TimeoutError(
        "Graph pipeline is still initializing. Please retry in a moment."
    )


def get_agent_lightning_status_payload():
    """
    Return Agent Lightning status without raising when optional graph pipeline
    is disabled or not initialized yet.
    """
    global pipeline

    if not GRAPH_PIPELINE_ENABLED:
        return {
            "enabled": False,
            "graph_pipeline_enabled": False,
            "pipeline_initialized": False,
            "reason": "graph_pipeline_disabled",
        }

    if pipeline is None:
        return {
            "enabled": False,
            "graph_pipeline_enabled": True,
            "pipeline_initialized": False,
            "reason": "pipeline_not_initialized",
        }

    lightning_bridge = getattr(pipeline, "lightning_bridge", None)
    if lightning_bridge is None:
        return {
            "enabled": False,
            "graph_pipeline_enabled": True,
            "pipeline_initialized": True,
            "reason": "lightning_bridge_unavailable",
        }

    try:
        status = lightning_bridge.status()
        status["graph_pipeline_enabled"] = True
        status["pipeline_initialized"] = True
        return status
    except Exception as exc:
        return {
            "enabled": False,
            "graph_pipeline_enabled": True,
            "pipeline_initialized": True,
            "reason": "status_error",
            "error": str(exc),
        }

# Load models and data at startup
# @app.before_first_request # This decorator is deprecated


def _load_models_worker():
    global embedding_model, llm, models_loading
    try:
        loaded_embedding, loaded_llm = load_models()
        if loaded_embedding is not None:
            embedding_model = loaded_embedding
        llm = loaded_llm
    finally:
        models_loading = False


def ensure_models_loading():
    global models_loading
    if embedding_model is not None or models_loading:
        return
    with models_lock:
        if embedding_model is not None or models_loading:
            return
        models_loading = True
        threading.Thread(target=_load_models_worker, daemon=True).start()


def initialize():
    global df, models_loading, pipeline, pipeline_init_error
    print("Initializing data...")
    df = load_car_data()

    if GRAPH_PIPELINE_ENABLED:
        # Keep graph pipeline import/construct fully synchronous at startup.
        # This avoids thread-based import races that can stall request handling.
        try:
            print("Initializing graph recommendation pipeline...")
            with _pipeline_init_lock:
                if pipeline is None and pipeline_init_error is None:
                    from recommendation_pipeline import RecommendationPipeline
                    import enhanced_filtering   # noqa: F401
                    import user_control_system  # noqa: F401
                    pipeline = RecommendationPipeline()
                    print("[Pipeline] Ready.")
        except Exception as exc:
            pipeline_init_error = exc
            print(f"[Pipeline] Init FAILED: {exc}")

    # Model warmup in background so Flask binds immediately.
    ensure_models_loading()
    print("Model warmup started in background.")

# === API Endpoints ===


@app.route('/api/recommend', methods=['POST'])
def recommend_cars():
    global df, embedding_model

    if df is None:
        return jsonify({'error': 'Server data is still initializing. Please try again in a moment.'}), 503

    if embedding_model is None:
        ensure_models_loading()
        print("Embedding model is warming up; serving rule-based fallback ranking.")

    try:
        # Get user preferences from request
        data = request.json

        # Optional focused exploration (e.g., "show other variants of Altroz").
        focus_variant = str(data.get('variant_family_focus', '') or '').strip()
        focus_model = str(data.get('focus_model', '') or '').strip()
        focus_brand = str(data.get('focus_brand', '') or '').strip()
        exclude_variant = str(data.get('exclude_variant', '') or '').strip()
        scoped_df, focus_context = _filter_dataset_for_variant_focus(
            df,
            focus_variant=focus_variant,
            focus_model=focus_model,
            focus_brand=focus_brand,
            exclude_variant=exclude_variant,
        )
        if focus_context:
            print(
                f"[API] Variant focus active: {focus_context.get('reason')} "
                f"({focus_context.get('dataset_size_before')} -> {focus_context.get('dataset_size_after')})"
            )
        if scoped_df is None or scoped_df.empty:
            return jsonify({
                'error': 'No variants found for the requested model focus.',
                'variant_focus': make_json_serializable(focus_context),
            }), 404

        # Validate required fields
        required_fields = ['min_budget', 'max_budget', 'fuel_type', 'body_type',
                           'transmission', 'seating', 'features', 'performance']

        # Optional fields
        brand_preference = data.get('brand', 'Any')

        for field in required_fields:
            if field not in data:
                # Check for potential variations like 'budget' instead of min/max
                if field == 'min_budget' and 'budget' in data and isinstance(data['budget'], list) and len(data['budget']) == 2:
                    continue  # Skip if 'budget' array exists
                elif field == 'max_budget' and 'budget' in data and isinstance(data['budget'], list) and len(data['budget']) == 2:
                    continue  # Skip if 'budget' array exists
                else:
                    return jsonify({'error': f'Missing required field: {field}'}), 400

        # Format preferences for processing
        # Handle both ['min_budget', 'max_budget'] and ['budget'][0], ['budget'][1]
        min_budget = int(data.get('min_budget', data.get('budget', [0, 0])[0]))
        max_budget = int(data.get('max_budget', data.get('budget', [0, 0])[1]))

        prefs = {
            'budget': (min_budget, max_budget),
            'fuel_type': data['fuel_type'],
            'body_type': data['body_type'],
            'transmission': data['transmission'],
            'seating': int(data['seating']),  # Ensure seating is int
            'features': data.get('features', []),  # Use get with default
            'performance': int(data['performance']),
            'brand': brand_preference
        }

        # First stage filtering
        print(f"DEBUG: Initial cars count: {len(scoped_df)}")
        print(f"DEBUG: Budget filter: {prefs['budget']}")
        
        filtered = scoped_df[
            (scoped_df['numeric_price'] >= prefs['budget'][0]) &
            # Allow slightly over budget
            (scoped_df['numeric_price'] <= prefs['budget'][1] * 1.2)
        ].copy()  # Use copy to avoid SettingWithCopyWarning
        
        print(f"DEBUG: Cars after budget filter: {len(filtered)}")

        # Apply Brand Filter if specified
        if prefs['brand'] != 'Any':
            print(f"DEBUG: Applying brand filter: {prefs['brand']}")
            # Case-insensitive match for brand name in the 'Make' or 'Car Name' column
            # Assuming dataset has a column like 'Make' or the first word of 'variant' is the make
            # Let's try matching the start of the 'variant' string which usually contains the make
            filtered = filtered[filtered['variant'].str.lower().str.contains(prefs['brand'].lower())]
            print(f"DEBUG: Cars after brand filter: {len(filtered)}")
            
        if filtered.empty:
            print("DEBUG: No cars matches filters. Returning empty.")
            empty_payload = {'session_id': 'N/A', 'matches': [], 'reviews': {}}
            if focus_context:
                empty_payload['variant_focus'] = make_json_serializable(focus_context)
            return jsonify(empty_payload)

        # Enhanced matching
        ranked_cars = enhanced_matching(filtered, prefs)
        print(f"DEBUG: Ranked cars count: {len(ranked_cars)}")
        if ranked_cars:
            print(f"DEBUG: Top car before semantic: {ranked_cars[0]['car']['variant']} (Score: {ranked_cars[0]['score']})")

        # Semantic reranking
        user_summary = generate_user_summary(prefs)
        print(f"DEBUG: User Summary for embedding: {user_summary}")
        
        # Pass the Pandas Series directly from the ranked_cars list
        car_summaries = [generate_car_summary(
            car_match['car']) for car_match in ranked_cars[:20]]  # Limit to top 20 for embedding

        if not car_summaries:
            empty_payload = {'session_id': 'N/A', 'matches': [], 'reviews': {}}
            if focus_context:
                empty_payload['variant_focus'] = make_json_serializable(focus_context)
            return jsonify(empty_payload)

        if embedding_model is not None:
            user_embed = embedding_model.encode([user_summary])
            car_embeds = embedding_model.encode(car_summaries)
            similarities = cosine_similarity(user_embed, car_embeds)[0]
        else:
            similarities = [0.0] * len(car_summaries)

        # Use car_match consistently
        for i, car_match in enumerate(ranked_cars[:20]):
            semantic_score = float(similarities[i])
            car_match['semantic_score'] = semantic_score
            if embedding_model is not None:
                car_match['combined_score'] = float(car_match['score']) * 0.7 + semantic_score * 100 * 0.3
            else:
                car_match['combined_score'] = float(car_match['score'])

        # Get top 10 matches
        top_matches = sorted(
            ranked_cars[:20],
            key=lambda x: x['combined_score'],
            reverse=True
        )[:10]

        # Convert car objects to dictionaries
        top_matches_serializable = []
        for car_match in top_matches:
            # Convert numpy types to standard Python types for JSON serialization
            # Ensure car_match['car'] is a Series before calling .astype
            car_series = car_match['car'] if isinstance(
                car_match['car'], pd.Series) else pd.Series(car_match['car'])
            car_dict = car_series.astype(object).where(
                pd.notnull(car_series), None).to_dict()
            top_matches_serializable.append({
                'car': car_dict,
                'score': float(car_match['score']),  # Ensure float
                # Ensure float
                'semantic_score': float(car_match['semantic_score']),
                # Ensure float
                'combined_score': float(car_match['combined_score']),
                'details': car_match['details']
            })

        # Store matches in session (using a simple dict for now)
        session_id = data.get('session_id', str(hash(user_summary)))
        # Store serializable version
        car_matches[session_id] = top_matches_serializable

        # Load reviews using the car dictionary from the serializable list
        reviews = load_reviews([m['car'] for m in top_matches_serializable])
        car_reviews[session_id] = reviews
        
        # --- NEW: Generate Sentiment Analysis (Pros/Cons) ---
        # We do this for the top 5 cars only to save time/tokens
        sentiments = {}
        if llm and should_generate_sentiments():
            for match in top_matches_serializable[:5]:
                variant = match['car']['variant']
                review_text = reviews.get(variant, "")
                if review_text:
                    try:
                        prompt = f"""
                        Analyze the following car review and extract 3 key Pros and 3 key Cons.
                        Return ONLY a JSON object with keys "pros" (list of strings) and "cons" (list of strings).
                        Keep each point under 6 words.
                        
                        Review:
                        {review_text[:2000]}
                        
                        JSON Output:
                        """
                        response = llm.invoke(prompt)
                        content = response.content.replace('```json', '').replace('```', '').strip()
                        import json
                        sentiments[variant] = json.loads(content)
                    except Exception as e:
                        print(f"Error generating sentiment for {variant}: {e}")
                        sentiments[variant] = {"pros": [], "cons": []}

        # Return top 5 for display
        response_payload = {
            'session_id': session_id,
            # Return serializable version
            'matches': top_matches_serializable[:5],
            'reviews': reviews,
            'sentiments': sentiments
        }
        if focus_context:
            response_payload['variant_focus'] = make_json_serializable(focus_context)
        return jsonify(response_payload)

    except Exception as e:
        import traceback
        print(f"Error in recommendation: {str(e)}")
        print(traceback.format_exc())  # Print full traceback
        return jsonify({'error': f'An internal error occurred: {str(e)}'}), 500


@app.route('/api/ask', methods=['POST'])
def ask_question():
    global llm, car_matches, car_reviews, embedding_model  # Ensure globals are accessible
    
    # Check if models need loading
    if llm is None:
        print("LLM not loaded yet in /ask. Attempting to load now...")
        embedding_model, llm = load_models()

    if llm is None:
        return jsonify({'error': 'LLM not initialized properly. Please wait or check logs.'}), 503

    try:
        data = request.json
        question = data.get('question')
        session_id = data.get('session_id')
        
        print(f"DEBUG: /api/ask received - Session: {session_id}, Question: {question}")

        if not question:
            return jsonify({'error': 'No question provided'}), 400

        if not session_id or session_id not in car_matches:
            print(f"DEBUG: Invalid Session ID. Keys in car_matches: {list(car_matches.keys())}")
            return jsonify({'error': 'Invalid or expired session'}), 400

        matches = car_matches[session_id]
        print(f"DEBUG: Found {len(matches)} cars for session.")
        
        reviews = car_reviews.get(session_id, {})  # Use get with default

        # Build context for the LLM
        context = "Cars:\n" + "\n".join([
            # Pass the car dictionary directly to generate_car_summary
            f"{car['car'].get('variant', 'N/A')} - {generate_car_summary(car['car'])}"
            for car in matches
        ])
        if reviews:
            context += "\n\nReviews:\n" + "\n\n".join(
                [f"{k}:\n{v}" for k, v in reviews.items()]
            )

        prompt = f"""You are an expert car consultant with deep automotive knowledge. Your job is to help users make informed car buying decisions.
        
        You have two modes of operation:
        1. ANSWER MODE: When the user asks a question about the cars (e.g., "Which has better mileage?", "Why Alcazar over Creta?", "Is the City worth it?"), provide a DETAILED, COMPREHENSIVE answer that:
           - Compares specific specs (engine, power, torque, mileage, features, price)
           - Explains the reasoning clearly with concrete data from the context
           - Highlights key differences and trade-offs
           - Gives actionable insights (2-4 sentences minimum)
           - Uses the reviews and technical specifications provided
        
        2. UPDATE MODE: When the user wants to change search criteria (e.g., "too expensive", "I want a sunroof", "remove sedans", "show me Toyota"), extract the updated preferences and confirm briefly.

        IMPORTANT: 
        - For ANSWER mode, be thorough and detailed. Don't be brief - users want comprehensive comparisons.
        - For UPDATE mode, keep it short and confirm the action.
        - Use specific numbers from the context (power, torque, price, mileage, features).
        - Reference reviews when available to support your points.

        Current Context (Cars and Reviews):
        {context}

        User Question: {question}

        Output Format:
        You must strictly output a valid JSON object. Do not include markdown formatting, backticks, or preamble.
        {{
            "thought": "Your internal reasoning about how to answer this question.",
            "type": "answer" or "update",
            "content": "Your detailed answer (if ANSWER mode) OR brief confirmation message (if UPDATE mode).",
            "updates": {{
                "budget": [min, max],
                "fuel_type": "Petrol/Diesel/etc",
                "body_type": "SUV/Sedan/etc",
                "transmission": "Manual/Automatic/etc",
                "seating": number,
                "brand": "BrandName" (Use "Any" to reset),
                "features_add": ["Sunroof"],
                "features_remove": [],
                "performance": number (1-10)
            }} (Only include fields that need changing. Use null if no change.)
        }}
        """

        response = llm.invoke(prompt)
        content = response.content.strip()
        print(f"DEBUG: LLM RAW OUTPUT:\n{content}\n-------------------")
        
        # Robust JSON extraction
        try:
            # Try to find JSON object if wrapped in text
            match = re.search(r'\{.*\}', content, re.DOTALL)
            if match:
                content = match.group(0)
            
            result = json.loads(content)
            return jsonify(result)
        except json.JSONDecodeError:
            print(f"JSON Decode Error. Raw content: {content}")
            # Fallback: treat as simple answer
            return jsonify({
                "type": "answer",
                "content": content,
                "thought": "Fallback due to JSON parsing error"
            })

    except Exception as e:
        import traceback
        # import json  <-- REMOVED because it causes UnboundLocalError
        print(f"Error in question answering: {str(e)}")
        print(traceback.format_exc())  # Print full traceback
        # Fallback to simple text response on error
        return jsonify({
            'type': 'answer',
            'content': "I'm having trouble processing that specific request right now. Could you try rephrasing it?",
            'thought': 'Fallback error handling'
        })


@app.route('/api/feedback', methods=['POST'])
@app.route('/api/feedback/', methods=['POST'])
def capture_feedback():
    """
    Capture user-side recommendation feedback for:
    1) adaptive scoring updates
    2) agent-lightning-compatible training traces
    """
    global pipeline, session_feedback_events
    try:
        data = request.get_json() or {}
        session_id = str(data.get('session_id', '') or '').strip()
        if not session_id:
            return jsonify({'error': 'session_id is required'}), 400

        def _to_clean_list(value):
            if not value:
                return []
            if isinstance(value, str):
                return [v.strip() for v in re.split(r'[,\n;]+', value) if v.strip()]
            if isinstance(value, list):
                return [str(v).strip() for v in value if str(v).strip()]
            return []

        feedback_event = {
            'action': str(data.get('action', 'user_feedback') or 'user_feedback'),
            'accepted_variants': _to_clean_list(data.get('accepted_variants', [])),
            'rejected_variants': _to_clean_list(data.get('rejected_variants', [])),
            'viewed_variants': _to_clean_list(data.get('viewed_variants', [])),
            'timestamp': int(time.time()),
            'preferences': data.get('preferences', {}) or {},
            'user_control_config': data.get('user_control_config', {}) or {},
        }

        if session_id not in session_feedback_events:
            session_feedback_events[session_id] = []
        session_feedback_events[session_id].append(feedback_event)

        # Update adaptive scoring memory from accepted/rejected behavior.
        try:
            from dynamic_scoring_config import adaptive_scoring
            adaptive_scoring.update_from_feedback(
                session_id,
                {
                    'accepted_variants': feedback_event['accepted_variants'],
                    'rejected_variants': feedback_event['rejected_variants'],
                    'preferences': feedback_event['preferences'],
                },
            )
        except Exception as scoring_error:
            print(f"[Feedback] adaptive scoring update warning: {scoring_error}")

        training_triggered = False
        agent_lightning_status = get_agent_lightning_status_payload()

        # Persist Agent Lightning-compatible trace event.
        try:
            lightning_bridge = getattr(pipeline, 'lightning_bridge', None) if pipeline is not None else None
            if lightning_bridge is not None:
                was_running = bool(lightning_bridge.status().get('training_running'))
                lightning_bridge.feedback_event(session_id, feedback_event)
                is_running = bool(lightning_bridge.status().get('training_running'))
                training_triggered = (not was_running) and is_running
        except Exception as trace_error:
            print(f"[Feedback] trace warning: {trace_error}")
        finally:
            agent_lightning_status = get_agent_lightning_status_payload()

        return jsonify({
            'status': 'ok',
            'session_id': session_id,
            'events_recorded': len(session_feedback_events[session_id]),
            'training_triggered': bool(training_triggered),
            'agent_lightning_status': agent_lightning_status,
        })
    except Exception as e:
        print(f"Feedback capture error: {e}")
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@app.route('/api/agent_lightning/status', methods=['GET'])
@app.route('/api/agent_lightning/status/', methods=['GET'])
def agent_lightning_status():
    """Expose runtime Agent Lightning bridge/training status."""
    status = get_agent_lightning_status_payload()
    return jsonify({'status': 'ok', 'agent_lightning': status})


@app.route('/api/agent_lightning/train', methods=['POST'])
@app.route('/api/agent_lightning/train/', methods=['POST'])
def agent_lightning_train_now():
    """
    Force a background training cycle from current trace records.
    This endpoint never blocks the request thread.
    """
    global pipeline
    try:
        if not GRAPH_PIPELINE_ENABLED:
            return jsonify({
                'status': 'ok',
                'training_started': False,
                'agent_lightning_status': get_agent_lightning_status_payload(),
                'message': 'Graph pipeline is disabled. Set VW_ENABLE_GRAPH_PIPELINE=1 to enable training.',
            })

        if pipeline is None:
            try:
                pipeline = get_recommendation_pipeline(timeout=30)
            except (TimeoutError, RuntimeError) as exc:
                return jsonify({
                    'status': 'ok',
                    'training_started': False,
                    'agent_lightning_status': get_agent_lightning_status_payload(),
                    'message': f'Pipeline not ready: {exc}',
                })

        lightning_bridge = getattr(pipeline, 'lightning_bridge', None)
        if lightning_bridge is None:
            return jsonify({
                'status': 'ok',
                'training_started': False,
                'agent_lightning_status': get_agent_lightning_status_payload(),
                'message': 'Agent Lightning bridge is unavailable.',
            })

        started = lightning_bridge.maybe_schedule_training(force=True)
        return jsonify({
            'status': 'ok',
            'training_started': bool(started),
            'agent_lightning_status': get_agent_lightning_status_payload(),
        })
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500

# For testing the API is working


@app.route('/health', methods=['GET'])
def health_check():
    global llm, df  # Ensure globals are accessible
    return jsonify({'status': 'ok', 'initialized': llm is not None and df is not None})


# --- Helper: Fetch Car Image ---
def fetch_car_image(variant_name):
    try:
        # 1. Clean name: "Tata Tiago XTA AMT" -> "Tata Tiago"
        clean_name = " ".join(variant_name.split()[:2])
        
        # Headers required by Wikipedia API
        headers = {'User-Agent': 'VariantWise/1.0 (Educational Project)'}
        
        # 2. Search Wikipedia API
        search_query = urllib.parse.quote(clean_name + " car")
        search_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={search_query}&format=json"
        
        req = urllib.request.Request(search_url, headers=headers)
        with urllib.request.urlopen(req) as response:
            search_data = json.loads(response.read().decode())
            
        if not search_data.get('query', {}).get('search'):
            return None
            
        page_title = search_data['query']['search'][0]['title']
        
        # Step 2: Get Image for that Page Title
        title_quoted = urllib.parse.quote(page_title)
        image_url = f"https://en.wikipedia.org/w/api.php?action=query&titles={title_quoted}&prop=pageimages&format=json&pithumbsize=1000"
        
        req_img = urllib.request.Request(image_url, headers=headers)
        with urllib.request.urlopen(req_img) as response:
            image_data = json.loads(response.read().decode())
            
        pages = image_data.get('query', {}).get('pages', {})
        for pid, page in pages.items():
            if 'thumbnail' in page:
                return page['thumbnail']['source']

        return None
    except Exception as e:
        print(f"Image fetch error: {e}")
        return None

# --- NEW: Generate Deep Dive Report ---
@app.route('/api/generate_report', methods=['POST'])
def generate_report():
    global llm, df
    
    # Check loading
    if llm is None:
        embedding_model, llm = load_models()
    if llm is None:
        return jsonify({'error': 'LLM not initialized'}), 503

    try:
        data = request.json
        variant_name = data.get('variant')
        
        print(f"[Report] Searching for variant: '{variant_name}'")
        
        # 1. Find car specs in dataset - try exact match first
        car_data = df[df['variant'] == variant_name]
        
        # If exact match fails, try fuzzy matching
        if car_data.empty:
            # Try case-insensitive match
            car_data = df[df['variant'].str.lower() == variant_name.lower()]
        
        # If still empty, try contains match
        if car_data.empty:
            car_data = df[df['variant'].str.contains(variant_name, case=False, na=False)]
            if not car_data.empty:
                print(f"[Report] Found fuzzy match: '{car_data.iloc[0]['variant']}'")
        
        if car_data.empty:
            print(f"[Report] No match found for: '{variant_name}'")
            print(f"[Report] Sample variants from DB: {df['variant'].head(5).tolist()}")
            return jsonify({'error': f'Car not found in database. Searched for: {variant_name}'}), 404
            
        car_specs = car_data.iloc[0].to_dict()
        
        # 1.5 Fetch Real Image
        image_url = fetch_car_image(variant_name)
        
        # 2. Prompt LLM for a structured report
        prompt = f"""
        You are an expert automotive journalist. Generate a detailed, engaging review report for the {variant_name}.
        
        Here are the technical specifications:
        {json.dumps(car_specs, default=str)}
        
        Output strictly a JSON object with the following structure:
        {{
            "headline": "A catchy 5-7 word headline for this car",
            "summary": "A 2-sentence executive summary.",
            "sections": [
                {{ "title": "Performance & Drive", "content": "Analyze engine, power ({car_specs.get('Max Power')}), torque, and transmission." }},
                {{ "title": "Comfort & Interior", "content": "Analyze seating, space, features like {car_specs.get('Additional Features')}." }},
                {{ "title": "Safety & Build", "content": "Analyze airbags ({car_specs.get('No. of Airbags')}), ratings, and build quality." }},
                {{ "title": "Value for Money", "content": "Analyze price ({car_specs.get('price')}) vs features and mileage ({car_specs.get('Petrol Mileage ARAI') or car_specs.get('Diesel Mileage ARAI')})." }}
            ],
            "scores": {{
                "Performance": number (1-100),
                "Comfort": number (1-100),
                "Features": number (1-100),
                "Value": number (1-100)
            }},
            "verdict": "Final buying advice."
        }}
        """
        
        response = llm.invoke(prompt)
        content = response.content.strip()
        
        # JSON Extraction logic
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            content = match.group(0)
        
        try:
            report_data = json.loads(content)
        except json.JSONDecodeError:
            print(f"JSON Decode Error in Report. Raw content:\n{content}")
            # Fallback: Construct a minimal valid report from the raw text
            report_data = {
                "headline": f"Analysis of {variant_name}",
                "summary": "Full report generation encountered a formatting issue, but here is the raw analysis.",
                "sections": [{"title": "AI Analysis", "content": content[:1000] + "..."}],
                "scores": {"Performance": 70, "Comfort": 70, "Features": 70, "Value": 70},
                "verdict": "Please try regenerating the report."
            }
        
        return jsonify({
            'specs': car_specs,
            'report': report_data,
            'image_url': image_url  # Send real image
        })

    except Exception as e:
        print(f"Report generation error: {e}")
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/chat', methods=['POST'])
def intelligent_chat():
    """
    Intelligent chatbot endpoint.
    Primary path uses OpenAI; fallback path uses deterministic parsing so chat
    remains functional even when provider calls fail.
    """
    try:
        data = request.get_json() or {}
        user_message = data.get('message', '')
        conversation_history = data.get('history', []) or []
        extracted_prefs = data.get('preferences', {}) or {}
        user_control_config = data.get('user_control_config', {}) or {}

        preferences = dict(extracted_prefs)
        user_control_config_data = dict(user_control_config)
        bot_response = ""
        ready_to_search = False
        provider = "fallback_heuristic"
        provider_error = None

        client = None
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if openai_api_key:
            try:
                from openai import OpenAI
                client = OpenAI(api_key=openai_api_key)
            except Exception as e:
                provider_error = f"OpenAI client init failed: {e}"
                print(provider_error)
        else:
            provider_error = "OPENAI_API_KEY not set"

        if client:
            provider = "openai"
            # Build context for the AI
            system_prompt = (
                "You are an expert car consultant AI for VariantWise. "
                "Have a natural conversation and extract actionable preferences. "
                "Ask one question at a time. Do not ask for permission to search. "
                "When you have enough info (budget + at least two among body/fuel/transmission/seating), "
                "respond with READY_TO_SEARCH and a JSON payload.\n"
                f"Current extracted preferences: {json.dumps(extracted_prefs)}\n"
                f"Current advanced controls: {json.dumps(user_control_config)}\n"
                "Output trigger format: READY_TO_SEARCH: {\"preferences\": {...}, \"user_control_config\": {...}}"
            )

            messages = [{"role": "system", "content": system_prompt}]
            for msg in conversation_history:
                messages.append({
                    "role": "user" if msg.get('type') == 'user' else "assistant",
                    "content": msg.get('text', '')
                })
            messages.append({"role": "user", "content": user_message})

            try:
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages,
                    temperature=0.7,
                    max_tokens=500
                )
                bot_response = (response.choices[0].message.content or "").strip()
            except Exception as e:
                provider = "fallback_heuristic"
                provider_error = f"OpenAI chat call failed: {e}"
                print(provider_error)

        # Check if AI explicitly requested search.
        if bot_response and "READY_TO_SEARCH:" in bot_response:
            ready_to_search = True
            json_start = bot_response.find("{")
            json_end = bot_response.rfind("}") + 1
            if json_start != -1 and json_end > json_start:
                try:
                    parsed_payload = json.loads(bot_response[json_start:json_end])
                    if isinstance(parsed_payload, dict):
                        parsed_basic, parsed_controls = split_basic_and_controls(parsed_payload)
                        if parsed_basic:
                            preferences = {**preferences, **parsed_basic}
                        if parsed_controls:
                            user_control_config_data = {**user_control_config_data, **parsed_controls}
                except Exception:
                    ready_to_search = False
            bot_response = "Perfect. I have what I need. I’ll shortlist the best variants now."

        # Structured extraction pass (OpenAI). Fallback to deterministic if unavailable/fails.
        if not ready_to_search:
            extracted_structured = False
            if client and provider == "openai":
                extraction_prompt = (
                    "Based on the user message, extract two groups: "
                    "1) basic preferences (min_budget, max_budget, body_type, fuel_type, transmission, seating, features, performance, brand), "
                    "2) advanced controls (diversity_mode, brand_mode, preferred_brands, blacklisted_brands, "
                    "price_preference, price_tolerance, must_have_features, nice_to_have_features, feature_weights, "
                    "use_cases, use_case_weights, comparison_mode, comparison_cars, similar_to_car, exploration_rate, "
                    "relevance_weight, diversity_weight, objective_weights, scoring_priorities). "
                    "Return only JSON with fields explicitly inferable.\n\n"
                    f"User message: {user_message}\n"
                    f"Current preferences: {json.dumps(extracted_prefs)}\n"
                    f"Current controls: {json.dumps(user_control_config)}\n"
                    "If nothing new is inferable, return {}."
                )
                try:
                    extraction_response = client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[{"role": "user", "content": extraction_prompt}],
                        temperature=0.2,
                        max_tokens=260
                    )
                    extracted_text = (extraction_response.choices[0].message.content or "").strip()
                    if extracted_text.startswith("```"):
                        parts = extracted_text.split("```")
                        extracted_text = parts[1] if len(parts) > 1 else extracted_text
                        if extracted_text.startswith("json"):
                            extracted_text = extracted_text[4:]
                        extracted_text = extracted_text.strip()
                    extracted_data = json.loads(extracted_text) if extracted_text else {}

                    if isinstance(extracted_data, dict):
                        basic_prefs, extracted_controls = split_basic_and_controls(extracted_data)
                        preferences = {**preferences, **basic_prefs}
                        if extracted_controls:
                            user_control_config_data = {**user_control_config_data, **extracted_controls}
                            if extracted_controls.get('must_have_features') and not preferences.get('features'):
                                preferences['features'] = extracted_controls.get('must_have_features', [])
                        extracted_structured = True
                except Exception as e:
                    provider = "fallback_heuristic"
                    provider_error = f"OpenAI extraction failed: {e}"
                    print(provider_error)

            if not extracted_structured:
                fallback = extract_preferences_heuristic(user_message, preferences, user_control_config_data)
                preferences = fallback["preferences"]
                user_control_config_data = fallback["user_control_config"]
                if not bot_response:
                    bot_response = build_next_question_from_preferences(preferences)

            has_budget = bool(preferences.get('min_budget')) and bool(preferences.get('max_budget'))
            other_prefs_count = sum([
                bool(preferences.get('body_type')),
                bool(preferences.get('fuel_type')),
                bool(preferences.get('transmission')),
                bool(preferences.get('seating')),
            ])
            if has_budget and other_prefs_count >= 2:
                ready_to_search = True
                bot_response = "Great. I have enough information. I’m now finding the best variants for you."

        if not bot_response:
            bot_response = build_next_question_from_preferences(preferences)

        return jsonify({
            'response': bot_response,
            'preferences': preferences,
            'ready_to_search': ready_to_search,
            'user_control_config': user_control_config_data,
            'provider': provider,
            'provider_error': provider_error
        })
        
    except Exception as e:
        print(f"Chat error: {e}")
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/car-chat', methods=['POST'])
def car_specific_chat():
    """
    Chat endpoint for asking questions about a specific car.
    Used on the car details page.
    """
    try:
        data = request.get_json()
        question = data.get('question', '')
        car_variant = data.get('car_variant', '')
        car_data = data.get('car_data', {})
        
        if not question:
            return jsonify({'error': 'No question provided'}), 400
        
        # Import OpenAI
        from openai import OpenAI
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
        # Build context about the car
        car_context = f"""Car: {car_variant}
        
Specifications:
- Price: {car_data.get('price', 'N/A')}
- Fuel Type: {car_data.get('Fuel Type', 'N/A')}
- Transmission: {car_data.get('Transmission Type', 'N/A')}
- Mileage: {car_data.get('Mileage', 'N/A')}
- Engine: {car_data.get('Displacement', 'N/A')}
- Max Power: {car_data.get('Max Power', 'N/A')}
- Max Torque: {car_data.get('Max Torque', 'N/A')}
- Seating: {car_data.get('Seating Capacity', 'N/A')}
- Body Type: {car_data.get('Body Type', 'N/A')}
- Length: {car_data.get('Length', 'N/A')}
- Width: {car_data.get('Width', 'N/A')}
- Height: {car_data.get('Height', 'N/A')}
- Wheelbase: {car_data.get('Wheelbase', 'N/A')}
- Boot Space: {car_data.get('Boot Space', 'N/A')}
- Fuel Tank: {car_data.get('Fuel Tank Capacity', 'N/A')}

Features:
- Comfort: {car_data.get('Comfort & Convenience Features', 'N/A')}
- Safety: {car_data.get('Safety Features', 'N/A')}
- Infotainment: {car_data.get('Infotainment & Connectivity', 'N/A')}"""

        # Create prompt
        prompt = f"""You are a helpful car expert assistant. Answer the user's question about this specific car based on the provided specifications.

{car_context}

User Question: {question}

Provide a helpful, concise answer. If the information is not available, say so politely and suggest what you can help with instead."""

        # Get AI response
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=300
        )
        
        answer = response.choices[0].message.content
        
        return jsonify({
            'answer': answer,
            'car_variant': car_variant
        })
        
    except Exception as e:
        print(f"Car chat error: {e}")
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/recommend_with_graph', methods=['POST'])
def recommend_with_graph():
    """
    New recommendation endpoint using knowledge graph + multi-agent system.
    Uses existing scoring logic but adds graph-based reasoning.
    """
    global df, embedding_model, pipeline

    if df is None:
        return jsonify({'error': 'Server data is still initializing. Please try again in a moment.'}), 503

    if embedding_model is None:
        ensure_models_loading()
        print("Embedding model is warming up; graph endpoint is using rule-based fallback scoring.")

    if not GRAPH_PIPELINE_ENABLED:
        print("[API] Graph pipeline disabled (set VW_ENABLE_GRAPH_PIPELINE=1 to enable). Falling back to /api/recommend.")
        return recommend_cars()
    
    try:
        if pipeline is None:
            try:
                pipeline = get_recommendation_pipeline(timeout=PIPELINE_INIT_TIMEOUT)
            except TimeoutError as te:
                print(f"[API] Pipeline init timeout: {te}")
                return jsonify({
                    'error': 'The recommendation engine is still warming up. Please try again in a moment.',
                    'retry': True,
                }), 503
            except RuntimeError as re:
                print(f"[API] Pipeline init failed: {re}")
                return jsonify({'error': str(re)}), 500

        data = request.json

        # Optional focused exploration (e.g., "show other variants of Altroz").
        focus_variant = str(data.get('variant_family_focus', '') or '').strip()
        focus_model = str(data.get('focus_model', '') or '').strip()
        focus_brand = str(data.get('focus_brand', '') or '').strip()
        exclude_variant = str(data.get('exclude_variant', '') or '').strip()
        scoped_df, focus_context = _filter_dataset_for_variant_focus(
            df,
            focus_variant=focus_variant,
            focus_model=focus_model,
            focus_brand=focus_brand,
            exclude_variant=exclude_variant,
        )
        if focus_context:
            print(
                f"[API] Variant focus active: {focus_context.get('reason')} "
                f"({focus_context.get('dataset_size_before')} -> {focus_context.get('dataset_size_after')})"
            )
        if scoped_df is None or scoped_df.empty:
            return jsonify({
                'error': 'No variants found for the requested model focus.',
                'variant_focus': make_json_serializable(focus_context),
            }), 404

        # Validate and format preferences (same as existing /api/recommend)
        required_fields = ['min_budget', 'max_budget', 'fuel_type', 'body_type',
                          'transmission', 'seating', 'features', 'performance']
        
        for field in required_fields:
            if field not in data:
                if field in ['min_budget', 'max_budget'] and 'budget' in data:
                    continue
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        min_budget = int(data.get('min_budget', data.get('budget', [0, 0])[0]))
        max_budget = int(data.get('max_budget', data.get('budget', [0, 0])[1]))
        
        extracted_preferences = {
            'budget': (min_budget, max_budget),
            'fuel_type': data['fuel_type'],
            'body_type': data['body_type'],
            'transmission': data['transmission'],
            'seating': int(data['seating']),
            'features': data.get('features', []),
            'performance': int(data['performance']),
            'brand': data.get('brand', 'Any')
        }
        if focus_context.get('family_label'):
            extracted_preferences['variant_family_focus'] = focus_context['family_label']
        
        user_input = data.get('user_input', '')
        conversation_history = data.get('conversation_history', [])
        session_id = data.get('session_id', str(hash(str(extracted_preferences))))
        
        # Extract user control config if provided
        user_control_config = None
        if 'user_control_config' in data:
            from user_control_system import UserControlConfig
            user_control_config = UserControlConfig.from_dict(data['user_control_config'])
        
        print(f"\n[API] Processing graph recommendation request for session: {session_id}")
        if user_control_config:
            print(f"[API] User controls: {user_control_config.diversity_mode.value}, "
                  f"brand_mode: {user_control_config.brand_mode.value}")
        
        # Get dynamic scoring weights
        from dynamic_scoring_config import DynamicScoringWeights, adaptive_scoring
        scoring_weights = adaptive_scoring.get_weights(
            extracted_preferences,
            user_control_config.to_dict() if user_control_config else None
        )
        
        # Define existing scoring function wrapper (with DYNAMIC weights)
        def existing_scoring_wrapper(candidates_df, prefs):
            """Wrapper around existing enhanced_matching + semantic logic"""
            # Run enhanced matching with DYNAMIC weights
            ranked_cars = enhanced_matching(
                candidates_df,
                prefs,
                scoring_weights=scoring_weights,
                user_control_config=user_control_config
            )
            
            # Semantic reranking (fallbacks to rule-only if embedding model isn't ready)
            user_summary = generate_user_summary(prefs)
            car_summaries = [generate_car_summary(car['car']) for car in ranked_cars[:20]]

            if not car_summaries:
                return []

            if embedding_model is not None:
                user_embed = embedding_model.encode([user_summary])
                car_embeds = embedding_model.encode(car_summaries)
                similarities = cosine_similarity(user_embed, car_embeds)[0]
            else:
                similarities = [0.0] * len(car_summaries)
            
            # Use DYNAMIC weights for semantic combination
            semantic_weight = 0.3  # Default
            rule_weight = 0.7  # Default
            if user_control_config:
                semantic_weight = user_control_config.diversity_weight  # Use diversity weight as semantic weight
                rule_weight = user_control_config.relevance_weight
            
            for i, car_match in enumerate(ranked_cars[:20]):
                car_match['semantic_score'] = float(similarities[i])
                if embedding_model is not None:
                    rule_component = float(car_match['score']) * rule_weight
                    semantic_component = float(similarities[i]) * 100 * semantic_weight
                else:
                    # Deterministic fallback while embeddings warm up.
                    rule_component = float(car_match['score'])
                    semantic_component = 0.0
                car_match['combined_score'] = (
                    rule_component + semantic_component
                )
                base_breakdown = car_match.get('score_breakdown', {})
                car_match['score_breakdown'] = {
                    **base_breakdown,
                    'rule_component': rule_component,
                    'semantic_component': semantic_component,
                    'semantic_weight': semantic_weight,
                    'rule_weight': rule_weight
                }
            
            return sorted(ranked_cars[:20], key=lambda x: x['combined_score'], 
                         reverse=True)
        
        # Run pipeline (pass scoring_weights for dynamic configuration)
        results = pipeline.run_recommendation_pipeline(
            user_input=user_input,
            extracted_preferences=extracted_preferences,
            conversation_history=conversation_history,
            variants_dataset=scoped_df,
            session_id=session_id,
            existing_scoring_function=existing_scoring_wrapper,
            user_control_config=user_control_config,
            scoring_weights=scoring_weights  # Pass dynamic weights
        )
        
        # Load reviews for top recommendations (same as existing)
        # FIXED: Ensure we have at least 5 results
        recommendations = results.get('recommendations', [])
        
        if len(recommendations) < 5:
            print(f"⚠️ WARNING: Only {len(recommendations)} recommendations returned. Expected at least 5.")
            print(f"   Pipeline stats: {results.get('pipeline_stats', {})}")
        
        top_variants_raw = recommendations[:5] if len(recommendations) >= 5 else recommendations
        
        # Convert pandas Series to JSON-serializable dicts (same as old endpoint)
        top_variants = []
        for variant_match in top_variants_raw:
            car_series = variant_match['car'] if isinstance(variant_match['car'], pd.Series) else pd.Series(variant_match['car'])
            car_dict = car_series.astype(object).where(pd.notnull(car_series), None).to_dict()
            top_variants.append({
                'car': car_dict,
                'score': float(variant_match['score']),
                'semantic_score': float(variant_match.get('semantic_score', 0)),
                'combined_score': float(variant_match.get('combined_score', variant_match['score'])),
                'details': variant_match['details'],
                'score_breakdown': make_json_serializable(variant_match.get('score_breakdown', {})),
                'reasoning_paths': make_json_serializable(variant_match.get('reasoning_paths', [])),
                'advanced_score': float(variant_match.get('advanced_score', variant_match.get('combined_score', variant_match['score']))),
                'graph_confidence': float(variant_match.get('graph_confidence', 0)),
                'critique_notes': variant_match.get('critique_notes', []),
                'agent_votes': variant_match.get('agent_votes', {}),
                'low_confidence': bool(variant_match.get('low_confidence', False)),
                'low_confidence_override': bool(variant_match.get('low_confidence_override', False))
            })
        
        # Store matches in session for RAG chatbot
        session_id = results['session_id']
        car_matches[session_id] = top_variants
        
        reviews = load_reviews([m['car'] for m in top_variants])
        car_reviews[session_id] = reviews
        
        # Generate sentiments (same as existing, using LLM)
        sentiments = {}
        if llm and should_generate_sentiments():
            for match in top_variants[:5]:
                variant = match['car']['variant']
                review_text = reviews.get(variant, "")
                if review_text:
                    try:
                        prompt = f"""
                        Analyze the following car review and extract 3 key Pros and 3 key Cons.
                        Return ONLY a JSON object with keys "pros" (list of strings) and "cons" (list of strings).
                        Keep each point under 6 words.
                        
                        Review:
                        {review_text[:2000]}
                        
                        JSON Output:
                        """
                        response = llm.invoke(prompt)
                        content = response.content.replace('```json', '').replace('```', '').strip()
                        sentiments[variant] = json.loads(content)
                    except Exception as e:
                        print(f"Sentiment generation error for {variant}: {e}")
                        sentiments[variant] = {"pros": [], "cons": []}
        
        # Sanitize all data for JSON serialization
        response_data = {
            'session_id': results['session_id'],
            'matches': make_json_serializable(top_variants),
            'reviews': reviews,
            'sentiments': sentiments,
            'explanation_contexts': make_json_serializable(results['explanation_contexts']),
            'pipeline_stats': make_json_serializable(results['pipeline_stats']),
            'agent_trace': make_json_serializable(results.get('agent_trace', [])),
            'conflicts': make_json_serializable(results.get('conflicts', [])),
            'user_control_applied': make_json_serializable(results.get('user_control_applied')),
            'clarifying_questions': make_json_serializable(results.get('clarifying_questions', [])),
            'agent_evaluations': make_json_serializable(results.get('agent_evaluations', [])),
            'hybrid_graph_diagnostics': make_json_serializable(results.get('hybrid_graph_diagnostics', {})),
            'scoring_diagnostics': {
                'weights': make_json_serializable(scoring_weights.to_dict() if hasattr(scoring_weights, 'to_dict') else {}),
                'user_control_config': make_json_serializable(user_control_config.to_dict() if user_control_config else {}),
                'hybrid_graph_diagnostics': make_json_serializable(results.get('hybrid_graph_diagnostics', {})),
            }
        }
        if focus_context:
            response_data['variant_focus'] = make_json_serializable(focus_context)
            if isinstance(response_data.get('pipeline_stats'), dict):
                response_data['pipeline_stats']['variant_focus'] = make_json_serializable(focus_context)
        
        return jsonify(response_data)
    
    except Exception as e:
        print(f"Error in graph recommendation: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': f'An internal error occurred: {str(e)}'}), 500

if __name__ == '__main__':
    initialize()  # Load data first
    print("Starting Flask server on port 8000...")
    app.run(host='0.0.0.0', port=8000, threaded=True)
