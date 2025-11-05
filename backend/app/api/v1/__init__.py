"""
API v1 版本路由
"""
from fastapi import APIRouter
from .clipboard import router as clipboard_router
from .devices import router as devices_router
from .websocket import router as websocket_router
from .files import router as files_router
from .auth import router as auth_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["认证"])
api_router.include_router(clipboard_router, prefix="/clipboard", tags=["剪贴板"])
api_router.include_router(devices_router, prefix="/devices", tags=["设备管理"])
api_router.include_router(websocket_router, tags=["WebSocket"])
api_router.include_router(files_router, prefix="/files", tags=["文件管理"])
