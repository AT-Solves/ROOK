"""Model abstraction (README §28): ROOK never depends on one vendor.

``get_provider()`` returns ``None`` in ``rules`` mode — callers must always have a deterministic
fallback, so the product works (and is testable) without any API key.
"""

from __future__ import annotations

import json
import logging
import re
from abc import ABC, abstractmethod

import httpx

from ..config import settings

log = logging.getLogger(__name__)


class LLMError(Exception):
    pass


class LLMProvider(ABC):
    name: str

    @abstractmethod
    def complete(self, system: str, prompt: str, max_tokens: int = 1200) -> str: ...

    def complete_json(self, system: str, prompt: str, max_tokens: int = 1500) -> dict:
        text = self.complete(system + "\nRespond with a single JSON object and nothing else.", prompt, max_tokens)
        match = re.search(r"\{.*\}", text, re.S)
        if not match:
            raise LLMError("model did not return JSON")
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError as exc:
            raise LLMError(f"invalid JSON from model: {exc}") from exc


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    def __init__(self, api_key: str, model: str):
        self.api_key, self.model = api_key, model

    def complete(self, system: str, prompt: str, max_tokens: int = 1200) -> str:
        try:
            r = httpx.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": self.api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                json={"model": self.model, "max_tokens": max_tokens, "system": system,
                      "messages": [{"role": "user", "content": prompt}]},
                timeout=60,
            )
            r.raise_for_status()
        except httpx.HTTPError as exc:
            raise LLMError(f"Anthropic request failed: {exc}") from exc
        return "".join(block.get("text", "") for block in r.json().get("content", []) if block.get("type") == "text")


class OpenAIProvider(LLMProvider):
    name = "openai"

    def __init__(self, api_key: str, model: str):
        self.api_key, self.model = api_key, model

    def complete(self, system: str, prompt: str, max_tokens: int = 1200) -> str:
        try:
            r = httpx.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"model": self.model, "max_tokens": max_tokens,
                      "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}]},
                timeout=60,
            )
            r.raise_for_status()
        except httpx.HTTPError as exc:
            raise LLMError(f"OpenAI request failed: {exc}") from exc
        return r.json()["choices"][0]["message"]["content"] or ""


class OllamaProvider(LLMProvider):
    """Self-hosted models for data-sovereign deployments (§36)."""

    name = "ollama"

    def __init__(self, url: str, model: str):
        self.url, self.model = url.rstrip("/"), model

    def complete(self, system: str, prompt: str, max_tokens: int = 1200) -> str:
        try:
            r = httpx.post(
                f"{self.url}/api/chat",
                json={"model": self.model, "stream": False, "options": {"num_predict": max_tokens},
                      "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}]},
                timeout=120,
            )
            r.raise_for_status()
        except httpx.HTTPError as exc:
            raise LLMError(f"Ollama request failed: {exc}") from exc
        return r.json().get("message", {}).get("content", "")


def get_provider() -> LLMProvider | None:
    p = settings.llm_provider
    if p == "anthropic" and settings.anthropic_api_key:
        return AnthropicProvider(settings.anthropic_api_key, settings.anthropic_model)
    if p == "openai" and settings.openai_api_key:
        return OpenAIProvider(settings.openai_api_key, settings.openai_model)
    if p == "ollama":
        return OllamaProvider(settings.ollama_url, settings.ollama_model)
    if p not in {"rules", ""}:
        log.warning("LLM provider %r selected but not configured; falling back to rules", p)
    return None


def provider_name() -> str:
    provider = get_provider()
    return provider.name if provider else "rules"
