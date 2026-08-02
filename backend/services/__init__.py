"""Service layer for backend-api (business logic below routes).

Subpackages:
  - ``core`` — filesystem paths (DICOM, meshes, weights, sync storage)
  - ``dicom`` — CT series I/O and expert-mask grid alignment
  - ``ai`` — inference pipeline (DICOM → mask → metrics / mesh)
  - ``studies`` — upload, PDF reports, expert compare, in-memory mask cache
  - ``sync`` — segmentation revision storage and realtime events
  - ``notifications`` — DB notification helpers
  - ``patients`` — external patient ID generation
"""
from __future__ import annotations
