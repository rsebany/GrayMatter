"""
In-app notification CRUD.

Programmatic create: ``services.notifications.service.create_notification_sync``.
"""

from __future__ import annotations

from .crud import router
from services.notifications.service import create_notification_sync

__all__ = ["router", "create_notification_sync"]
