"""
API 依赖注入
"""
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

# 导出依赖
__all__ = ["get_db"]
