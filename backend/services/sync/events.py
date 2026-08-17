"""Pluggable per-study event fan-out for segmentation sync SSE."""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
from collections import defaultdict
from collections.abc import AsyncIterator
from typing import Any

logger = logging.getLogger(__name__)


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


class RedisStudyEventHub:
    """Redis pub/sub fan-out for deployments with multiple API workers."""

    def __init__(self, redis_url: str, fallback: StudyEventHub | None = None) -> None:
        try:
            from redis.asyncio import from_url
        except ImportError as exc:
            raise RuntimeError("Redis event transport requires the 'redis' package.") from exc
        self._redis = from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=5,
            health_check_interval=30,
        )
        self._fallback = fallback or StudyEventHub()

    @staticmethod
    def _channel(study_id: str) -> str:
        digest = hashlib.sha256(study_id.encode("utf-8")).hexdigest()
        return "graymatter:study-events:" + digest

    async def publish(self, study_id: str, event: dict[str, Any]) -> None:
        try:
            await self._redis.publish(
                self._channel(study_id),
                json.dumps(event, separators=(",", ":"), allow_nan=False),
            )
        except Exception:  # noqa: BLE001 - Redis clients expose backend-specific errors
            logger.warning(
                "Redis event publish unavailable; using process-local fallback.",
                exc_info=False,
            )
            await self._fallback.publish(study_id, event)

    async def subscribe(self, study_id: str) -> AsyncIterator[dict[str, Any]]:
        pubsub = self._redis.pubsub()
        try:
            await pubsub.subscribe(self._channel(study_id))
            async for message in pubsub.listen():
                if message.get("type") != "message":
                    continue
                try:
                    event = json.loads(message["data"])
                except (TypeError, ValueError):
                    continue
                if isinstance(event, dict):
                    yield event
        except Exception:  # noqa: BLE001 - fall back on any Redis transport failure
            logger.warning(
                "Redis event subscription unavailable; using process-local fallback.",
                exc_info=False,
            )
            async for event in self._fallback.subscribe(study_id):
                yield event
        finally:
            try:
                await pubsub.aclose()
            except Exception:  # noqa: BLE001 - cleanup must not mask stream failure
                logger.warning("Could not close Redis event subscription.", exc_info=True)


def create_study_event_hub():
    backend = os.environ.get("GRAYMATTER_EVENT_BACKEND", "memory").strip().lower()
    if backend != "redis":
        return StudyEventHub()
    redis_url = os.environ.get("GRAYMATTER_REDIS_URL", "").strip()
    if not redis_url:
        logger.warning(
            "Redis event backend requested without GRAYMATTER_REDIS_URL; "
            "using process-local transport."
        )
        return StudyEventHub()
    try:
        return RedisStudyEventHub(redis_url)
    except RuntimeError:
        logger.warning(
            "Redis event transport could not initialize; using process-local transport."
        )
        return StudyEventHub()


study_event_hub = create_study_event_hub()

__all__ = [
    "RedisStudyEventHub",
    "StudyEventHub",
    "create_study_event_hub",
    "study_event_hub",
]
