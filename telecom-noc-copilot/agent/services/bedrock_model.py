"""Bedrock narrative for root-cause analysis and the incident report.

The call runs only when ``BEDROCK_MODEL_ID`` is set. Ranked evidence stays
with the rule engine. A missing model, a timeout, or a bad response leaves
``llm_used`` false and the rule-based text in place.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from agent.config import get_agent_settings

logger = logging.getLogger("telecom_noc_copilot.agent.bedrock")

_SYSTEM = (
    "You write a short telecom NOC investigation narrative from supplied evidence. "
    "Do not invent alarms, metrics, or causes that are not in the input. "
    "Do not claim a verified root cause. Overlapping timestamps are correlation, not causation. "
    "Do not recommend executing a network change. "
    'Reply with JSON only: {"narrative": "...", "summary": "..."}.'
)


def llm_enabled() -> bool:
    """True when a model id is configured and this process should call it."""
    if os.environ.get("PYTEST_CURRENT_TEST") and os.environ.get("BEDROCK_LLM_ENABLED", "").lower() != "true":
        return False
    return bool(get_agent_settings().bedrock_model_id)


def narrate_investigation(context: dict[str, Any]) -> dict[str, str] | None:
    """Ask Bedrock for a narrative and a report summary. None means rules stay."""
    if not llm_enabled():
        return None
    settings = get_agent_settings()
    try:
        import boto3
        from botocore.config import Config
        from botocore.exceptions import BotoCoreError, ClientError
    except ImportError:
        logger.info("event=bedrock_narrative outcome=skipped reason=boto3_missing")
        return None

    client = boto3.client(
        "bedrock-runtime",
        region_name=settings.aws_region or "us-east-1",
        config=Config(
            connect_timeout=3,
            read_timeout=20,
            retries={"max_attempts": 2, "mode": "standard"},
        ),
    )
    prompt = json.dumps(context, default=str)[:6000]
    try:
        response = client.converse(
            modelId=settings.bedrock_model_id,
            system=[{"text": _SYSTEM}],
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            inferenceConfig={"maxTokens": 400, "temperature": 0.0},
        )
    except (BotoCoreError, ClientError) as exc:
        logger.info("event=bedrock_narrative outcome=failed error_type=%s", type(exc).__name__)
        return None

    text = _response_text(response)
    parsed = _parse_narrative(text)
    if parsed is None:
        logger.info("event=bedrock_narrative outcome=empty")
        return None
    usage = (response.get("usage") or {}) if isinstance(response, dict) else {}
    logger.info(
        "event=bedrock_narrative outcome=ok input_tokens=%s output_tokens=%s",
        usage.get("inputTokens"),
        usage.get("outputTokens"),
    )
    return parsed


def _response_text(response: dict[str, Any]) -> str:
    content = ((response.get("output") or {}).get("message") or {}).get("content") or []
    parts = [str(block.get("text") or "") for block in content if isinstance(block, dict)]
    return "\n".join(part for part in parts if part).strip()


def _parse_narrative(text: str) -> dict[str, str] | None:
    cleaned = text.strip()
    if not cleaned:
        return None
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    payload: Any
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start >= 0 and end > start:
            try:
                payload = json.loads(cleaned[start : end + 1])
            except json.JSONDecodeError:
                payload = {"narrative": cleaned, "summary": cleaned}
        else:
            payload = {"narrative": cleaned, "summary": cleaned}
    if not isinstance(payload, dict):
        return None
    narrative = str(payload.get("narrative") or "").strip()
    summary = str(payload.get("summary") or narrative).strip()
    if not narrative:
        return None
    return {"narrative": narrative[:1500], "summary": summary[:1500]}
