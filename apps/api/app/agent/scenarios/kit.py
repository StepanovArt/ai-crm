"""Helpers that make mock scenarios read like a real model: paced tokens and thinking."""

import asyncio
import random
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

from app.agent.context import PageContext
from app.agent.providers.base import (
    CardStep,
    ConversationState,
    ProviderStep,
    TextStep,
    ThinkingStep,
    UIActionStep,
)
from app.agent.tools import ToolRegistry

_CHUNK = re.compile(r"\S+\s*|\s+")


@dataclass
class Pacer:
    scale: float
    rng: random.Random

    async def pause(self, lo_ms: int, hi_ms: int) -> None:
        if self.scale <= 0:
            return
        await asyncio.sleep(self.rng.uniform(lo_ms, hi_ms) * self.scale / 1000)

    def chunks(self, text: str) -> list[str]:
        """Split into 1-4 word tokens, keeping whitespace/newlines attached."""
        words = _CHUNK.findall(text)
        out: list[str] = []
        i = 0
        while i < len(words):
            n = self.rng.randint(1, 4)
            piece = "".join(words[i : i + n])
            # Keep markdown markers and newlines from being split awkwardly.
            out.append(piece)
            i += n
        return out


@dataclass
class Kit:
    conv: ConversationState
    ctx: PageContext
    tools: ToolRegistry
    pacer: Pacer

    @property
    def message(self) -> str:
        return self.conv.message

    @property
    def first_name(self) -> str:
        return (self.conv.user_name or "there").split()[0]

    def term(self, key: str) -> str:
        return self.conv.terminology.get(key, key.capitalize())

    async def say(self, text: str) -> AsyncIterator[ProviderStep]:
        for piece in self.pacer.chunks(text):
            yield TextStep(piece)
            await self.pacer.pause(25, 45)

    async def think(self, label: str) -> AsyncIterator[ProviderStep]:
        yield ThinkingStep(label)
        await self.pacer.pause(300, 700)

    async def ui(self, action: dict[str, Any]) -> AsyncIterator[ProviderStep]:
        yield UIActionStep(action)
        await self.pacer.pause(*ui_pause(action))

    async def card(self, kind: str, data: dict[str, Any]) -> AsyncIterator[ProviderStep]:
        await self.pacer.pause(120, 220)
        yield CardStep(kind, data)


def ui_pause(action: dict[str, Any]) -> tuple[int, int]:
    """How long to wait after a ui_action so the user can watch it happen."""
    kind = action.get("kind")
    if kind == "highlight":
        d = int(action.get("duration_ms") or 900)
        return d, d + 100
    if kind == "navigate":
        return 700, 900
    if kind == "move_card":
        return 650, 800
    if kind == "apply_filter":
        return 500, 650
    return 150, 300
