"""
In-app notification CRUD.

Programmatic create: ``services.notifications.service.create_notification_sync``.
"""

from __future__ import annotations

from services.notifications.service import create_notification_sync

from .crud import router

__all__ = ["create_notification_sync", "router"]
