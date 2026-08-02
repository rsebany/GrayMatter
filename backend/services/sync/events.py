"""In-process per-study event fan-out for segmentation sync SSE."""
from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any, AsyncIterator


class StudyEventHub:
    """In-memory fan-out hub for per-study realtime events."""

    def __init__(self) -> None:
        self._subscribers: dict[str, set[asyncio.Queue[dict[str, Any]]]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def publish(self, study_id: str, event: dict[str, Any]) -> None:
        async with self._lock:
            queues = list(self._subscribers.get(study_id, set()))
        for queue in queues:
            if queue.full():
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                # Drop when backpressure persists.
                pass

    async def subscribe(self, study_id: str) -> AsyncIterator[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=32)
        async with self._lock:
            self._subscribers[study_id].add(queue)
        try:
            while True:
                item = await queue.get()
                yield item
        finally:
            async with self._lock:
                subs = self._subscribers.get(study_id)
                if subs is not None:
                    subs.discard(queue)
                    if not subs:
                        self._subscribers.pop(study_id, None)


study_event_hub = StudyEventHub()

__all__ = ["StudyEventHub", "study_event_hub"]
