#!/usr/bin/env python3
from dotenv import load_dotenv
load_dotenv()

"""
combined_pipeline_functions.py

FIXED VERSION:
 - Reads image from `media` field (list or string)
 - Hard-coded OpenAI + SerpAPI keys
 - Robust image normalization
 - Debug logging for image handling
 - ChatGPT-assisted decision (bounded)
 - RabbitMQ consumer unchanged
"""

from pathlib import Path
import json
import os
import sys
import tempfile
import time
from typing import Any, Dict
from urllib.parse import urlparse

import requests
from openai import OpenAI

# ------------------------------
# Optional: pika import
# ------------------------------
try:
    import pika
except Exception:
    pika = None

# ------------------------------
# KEYS
# ------------------------------
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SERPAPI_KEY = os.getenv("SERPAPI_KEY")

if not OPENAI_API_KEY:
    raise RuntimeError("Missing OPENAI_API_KEY")
if not SERPAPI_KEY:
    raise RuntimeError("Missing SERPAPI_KEY")


# ------------------------------
# Config
# ------------------------------
RABBIT_HOST = os.getenv("RABBIT_HOST")
INPUT_QUEUE = "reports"
ALERT_QUEUE = "alerts"
FINAL_QUEUE = "processed_cluster"

ALERT_FILENAME = "true_alert.json"
FINAL_FILENAME = "true_final_output.json"

SERPAPI_ENDPOINT = "https://serpapi.com/search"
SERPAPI_TIMEOUT = 15
SERPAPI_MAX_RETRIES = 2

OPENAI_MODEL = "gpt-4.1-mini"
OPENAI_MAX_TOKENS = 300
OPENAI_TIMEOUT = 20
USE_GPT = True

openai_client = OpenAI(api_key=OPENAI_API_KEY)

# ------------------------------
# Atomic JSON write
# ------------------------------
def _atomic_write_json(path: str, data: Any) -> None:
    """
    Atomically write JSON data (dict or list) to disk.
    Ensures:
    - UTF-8 encoding
    - No partial writes
    - Safe overwrite
    """
    text = json.dumps(data, indent=2, ensure_ascii=False)

    dirn = os.path.dirname(os.path.abspath(path)) or "."
    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        delete=False,
        dir=dirn
    ) as f:
        f.write(text)
        tmp_path = f.name

    os.replace(tmp_path, path)


#------------------------------
# Decision
#------------------------------

def format_final_api_output(report: Dict[str, Any]) -> list:
    
    inp = report.get("input", {})
    decision = report.get("decision", {})
    extra = inp.get("extra", {})
    user = inp.get("user", {})
    location = inp.get("location", {})
    reverse_search = report.get("reverse_search", {})

    # ---- Media extraction ----
    media_url = None
    media_type = None

    if isinstance(inp.get("media"), list) and inp["media"]:
        media_url = inp["media"][0]
    elif isinstance(inp.get("media"), str):
        media_url = inp["media"]

    if media_url:
        media_type = "Image"

    # ---- Sentiment (rule-based) ----
    sentiment = "neutral"
    if decision.get("alert"):
        sentiment = "negative"

    # ---- Relevance score rule ----
    if reverse_search.get("performed") and reverse_search.get("matches", 0) > 0:
        relevance_score = "0.00"
    else:
        relevance_score = f"{decision.get('confidence', 0) * 100:.2f}"

    decoded = report.get("hazard_decoded", {})

    formatted = {
        "user_id": user.get("id", "unknown"),
        "hazard_type": decoded.get("hazard_type") or extra.get("hazard_type", ""),
        "text": inp.get("text", ""),
        "location": {
            "lat": location.get("lat"),
            "lon": location.get("lon"),
            "name": location.get("name"),
        },
        "sentiment": sentiment,
        "relevance_score": relevance_score,
        "report_time": inp.get("created_at"),
        "media_url": media_url,
        "media_type": media_type,
        "platform": inp.get("platform"),
        "user_name": user.get("name"),
    }

    return [formatted]

def format_alert_output(report: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert internal report → external alert schema
    Priority is semantic (high / medium / low), not color-based.
    Hazard type prefers GPT-decoded value.
    """

    inp = report.get("input", {})
    extra = inp.get("extra", {})
    location = inp.get("location", {})
    decoded = report.get("hazard_decoded", {})

    # ---- Media extraction ----
    media_url = None
    if isinstance(inp.get("media"), list) and inp["media"]:
        media_url = inp["media"][0]
    elif isinstance(inp.get("media"), str):
        media_url = inp["media"]

    # ---- Priority mapping (semantic, not color-based) ----
    priority = "medium"

    alert_level = (extra.get("alert_level") or "").lower()
    confidence = report.get("decision", {}).get("confidence", 0)

    if alert_level in ("red", "severe", "critical"):
        priority = "high"
    elif alert_level in ("yellow", "moderate"):
        priority = "medium"
    elif alert_level in ("green", "low"):
        priority = "low"

    # Optional: confidence-based escalation
    if confidence >= 0.85:
        priority = "high"

    return {
        "id": report.get("id"),
        "priority": priority,  
        "location": {
            "lat": location.get("lat"),
            "long": location.get("lon"),
            "name": location.get("name"),
        },
        "platform": inp.get("platform"),
        "type": decoded.get("hazard_type") or extra.get("hazard_type"),
        "text": inp.get("text"),
        "mediaUrl": media_url,
        "reported_at": inp.get("created_at"),
    }



# ------------------------------
# Output writer
# ------------------------------
def write_outputs(reports: list[Dict[str, Any]]):
   
    final_outputs = []
    alert_outputs = []

    for report in reports:
        # ---- Final API output (unchanged) ----
        formatted_list = format_final_api_output(report)
        final_outputs.extend(formatted_list)

        decision = report.get("decision", {})

        # ---- Extract relevance score safely ----
        relevance_raw = formatted_list[0].get("relevance_score", "0")

        try:
            relevance_value = float(relevance_raw)
            # Convert percentage string → 0–1 scale
            if relevance_value > 1:
                relevance_value /= 100.0
        except Exception:
            relevance_value = 0.0

        # ---- Alert condition ----
        if decision.get("alert") and relevance_value > 0.65:
            alert_outputs.append(
                format_alert_output(report)
            )

    # ---- Atomic writes (once per batch) ----
    _atomic_write_json(FINAL_FILENAME, final_outputs)

    if alert_outputs:
        _atomic_write_json(ALERT_FILENAME, alert_outputs)
    else:
        # Remove stale alert file if no alerts in this batch
        if Path(ALERT_FILENAME).exists():
            Path(ALERT_FILENAME).unlink()



# ------------------------------
# Stage 1: text normalization
# ------------------------------
def stage1_process_message(msg: Dict[str, Any]) -> Dict[str, Any]:
    import re

    text = msg.get("text") or ""
    sanitized = re.sub(r"[\x00-\x1F\x7F]+", " ", text)
    sanitized = " ".join(sanitized.split())

    return {
        "original_text": text,
        "sanitized_text": sanitized,
        "processed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

# ------------------------------
# SerpAPI reverse image search
# ------------------------------
def serpapi_reverse_image_search(image_url: str) -> Dict[str, Any]:
    # Normalize image input
    if isinstance(image_url, list):
        image_url = image_url[0] if image_url else None
    if isinstance(image_url, dict):
        image_url = image_url.get("url")

    print("[DEBUG] SERPAPI_KEY =", SERPAPI_KEY)
    print("[DEBUG] image_url =", image_url)
    print("[DEBUG] image_url type =", type(image_url))

    if not SERPAPI_KEY or not image_url or not isinstance(image_url, str):
        return {
            "performed": False,
            "reason": "missing_key_or_image",
            "debug": {
                "has_key": bool(SERPAPI_KEY),
                "image_url": image_url,
                "image_type": str(type(image_url)),
            },
        }

    params = {
        "engine": "google_reverse_image",
        "image_url": image_url,
        "api_key": SERPAPI_KEY,
    }

    for attempt in range(1, SERPAPI_MAX_RETRIES + 1):
        try:
            resp = requests.get(
                SERPAPI_ENDPOINT,
                params=params,
                timeout=SERPAPI_TIMEOUT,
            )
            resp.raise_for_status()
            data = resp.json()

            results = data.get("image_results") or data.get("visual_matches") or []

            domains = set()
            first_seen = None

            for r in results:
                link = r.get("link") or r.get("source")
                if not link:
                    continue
                domain = urlparse(link).netloc.lower()
                if domain:
                    domains.add(domain)

                date = r.get("date")
                if date and (not first_seen or date < first_seen):
                    first_seen = date

            return {
                "performed": True,
                "matches": len(results),
                "domains": sorted(domains),
                "first_seen": first_seen,
                "engine": "google_reverse_image",
            }

        except requests.exceptions.Timeout:
            if attempt == SERPAPI_MAX_RETRIES:
                return {"performed": False, "error": "timeout"}
            time.sleep(2 ** attempt)
        except Exception as e:
            return {"performed": False, "error": str(e)}

    return {"performed": False, "error": "unknown"}

# ------------------------------
# Google Vision Web Detection
# ------------------------------
class ReverseChecker:
    def __init__(self):
        self.available = False
        self._client = None

    def _init_client(self):
        try:
            from google.cloud import vision
            self._client = vision.ImageAnnotatorClient()
            self.available = True
        except Exception:
            self.available = False

    def check_image_duplicate(self, source: str) -> Dict[str, Any]:
        result = {"vision_available": False, "best_guess": None}
        try:
            if self._client is None:
                self._init_client()
            if not self.available:
                return result

            from google.cloud import vision
            image = vision.Image()
            image.source.image_uri = source
            response = self._client.web_detection(image=image)

            wd = response.web_detection
            if wd and wd.best_guess_labels:
                result["best_guess"] = wd.best_guess_labels[0].label
                result["vision_available"] = True
        except Exception:
            pass
        return result

# ------------------------------
# ChatGPT decision wrapper
# ------------------------------
def gpt_decision_wrapper(text: str, reverse_search: Dict[str, Any], vision: Dict[str, Any]) -> Dict[str, Any]:
    if not USE_GPT:
        return {"alert": False, "confidence": 0.0, "reasons": ["gpt_disabled"]}

    prompt = (
        "You are a verification system.\n"
        "Respond ONLY with valid JSON.\n\n"
        f"Text:\n{text}\n\n"
        f"Reverse image search:\n{json.dumps(reverse_search)}\n\n"
        f"Vision web detection:\n{json.dumps(vision)}\n\n"
        "Return JSON:\n"
        "{"
        "\"alert\": boolean, "
        "\"confidence\": number between 0 and 1, "
        "\"reasons\": array of strings"
        "}"
    )

    try:
        resp = openai_client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=OPENAI_MAX_TOKENS,
            temperature=0.0,
            timeout=OPENAI_TIMEOUT,
        )
        return json.loads(resp.choices[0].message.content)
    except Exception as e:
        return {"alert": False, "confidence": 0.0, "reasons": [f"gpt_error:{e}"]}
    

# ------------------------------
# ChatGPT hazard type decoder
# ------------------------------
def gpt_decode_hazard_type(text: str, existing_hazard: str | None = None) -> Dict[str, Any]:
    """
    Use GPT to infer / normalize hazard type from text.
    """

    prompt = (
        "You are a disaster classification system.\n\n"
        "Given a report text, classify the primary hazard type.\n\n"
        "Allowed hazard categories (choose ONE best match):\n"
        "- Flood\n"
        "- High Wave\n"
        "- Tsunami\n"
        "- Oil Spill\n"
        f"Existing hazard (if any): {existing_hazard}\n\n"
        f"Report text:\n{text}\n\n"
        "Respond ONLY with valid JSON:\n"
        "{"
        "\"hazard_type\": string, "
        "\"confidence\": number between 0 and 1"
        "}"
    )

    try:
        resp = openai_client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=120,
            timeout=OPENAI_TIMEOUT,
        )
        return json.loads(resp.choices[0].message.content)

    except Exception as e:
        return {
            "hazard_type": existing_hazard or "Other",
            "confidence": 0.0,
            "error": str(e),
        }


# ------------------------------
# Full pipeline
# ------------------------------
def run_full_pipeline(msg: Dict[str, Any]) -> Dict[str, Any]:
    report = {
        "id": msg.get("id") or f"evt_{int(time.time())}",
        "input": msg,
        "timestamps": {
            "received_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        },
    }

    stage1 = stage1_process_message(msg)
    report["stage1_text"] = stage1

    # ---- Hazard decoding (NEW) ----
    extra = msg.get("extra", {})
    existing_hazard = extra.get("hazard_type")

    hazard_decoded = gpt_decode_hazard_type(
        stage1["sanitized_text"],
        existing_hazard
    )

    report["hazard_decoded"] = hazard_decoded

    print("[DEBUG] hazard_decoded =", report.get("hazard_decoded"))

    # ✅ IMAGE NORMALIZATION (FIXED FOR YOUR INPUT)
    image_ref = None
    if isinstance(msg.get("media"), list) and msg["media"]:
        image_ref = msg["media"][0]
    elif isinstance(msg.get("media"), str):
        image_ref = msg["media"]

    reverse_search = serpapi_reverse_image_search(image_ref)
    report["reverse_search"] = reverse_search

    vision = ReverseChecker()
    vision_out = vision.check_image_duplicate(image_ref) if image_ref else {}
    report["vision_web"] = vision_out

    report["decision"] = gpt_decision_wrapper(
        stage1["sanitized_text"],
        reverse_search,
        vision_out,
    )

    report["timestamps"]["completed_at"] = time.strftime(
        "%Y-%m-%dT%H:%M:%SZ", time.gmtime()
    )

    return report

# ------------------------------
# RabbitMQ helpers
# ------------------------------
def _send_to_rabbit(queue: str, payload: Any) -> bool:
    if pika is None:
        return False
    try:
        conn = pika.BlockingConnection(pika.ConnectionParameters(host=RABBIT_HOST))
        ch = conn.channel()
        ch.queue_declare(queue=queue, durable=True)
        ch.basic_publish(
            exchange="",
            routing_key=queue,
            body=json.dumps(payload),
            properties=pika.BasicProperties(delivery_mode=2),
        )
        conn.close()
        return True
    except Exception:
        return False

def send_files_to_queues():
    # Send final output (always expected to be valid JSON)
    if Path(FINAL_FILENAME).exists():
        final_text = Path(FINAL_FILENAME).read_text().strip()
        if final_text:
            _send_to_rabbit(FINAL_QUEUE, json.loads(final_text))

    # Send alert output ONLY if file exists AND is non-empty
    if Path(ALERT_FILENAME).exists():
        alert_text = Path(ALERT_FILENAME).read_text().strip()
        if alert_text:
            _send_to_rabbit(ALERT_QUEUE, json.loads(alert_text))


# ------------------------------
# Consumer
# ------------------------------
def start_rabbit_consumer():
    if pika is None:
        print("pika not installed")
        sys.exit(1)

    conn = pika.BlockingConnection(pika.ConnectionParameters(host=RABBIT_HOST))
    ch = conn.channel()

    ch.queue_declare(queue=INPUT_QUEUE, durable=True)
    ch.queue_declare(queue=ALERT_QUEUE, durable=True)
    ch.queue_declare(queue=FINAL_QUEUE, durable=True)

    def _callback(ch, method, properties, body):
        try:
            msg = json.loads(body.decode("utf-8"))
        except Exception:
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        reports = []

        if isinstance(msg, dict):
            reports.append(run_full_pipeline(msg))

        elif isinstance(msg, list):
            for item in msg:
                if isinstance(item, dict):
                    reports.append(run_full_pipeline(item))

        if reports:
            write_outputs(reports)
            send_files_to_queues()

        ch.basic_ack(delivery_tag=method.delivery_tag)

    ch.basic_qos(prefetch_count=1)
    ch.basic_consume(queue=INPUT_QUEUE, on_message_callback=_callback)

    print(f"[+] Listening on '{INPUT_QUEUE}' (waiting for messages)")
    ch.start_consuming()

# ------------------------------
# Entrypoint
# ------------------------------
def main():
    start_rabbit_consumer()

if __name__ == "__main__":
    main()
