"""
FastAPI 主应用
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from loguru import logger

from app.config import settings
from app.core.database import db
from app.core.logger import setup_logger
from app.api.v1 import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时执行
    setup_logger()
    logger.info("=" * 60)
    logger.info(f"启动 {settings.PROJECT_NAME} v{settings.VERSION}")
    logger.info("=" * 60)
    
    # 初始化数据库引擎和创建表
    db.init_engine()
    await db.create_tables()
    logger.info("应用启动完成")
    
    yield
    
    # 关闭时执行
    await db.close()
    logger.info("应用已关闭")


# 创建 FastAPI 应用
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="剪贴板历史同步服务 API",
    openapi_url="/api/openapi.json",
    lifespan=lifespan
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应该限制具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(api_router, prefix=settings.API_PREFIX)


@app.get("/", tags=["根路径"])
async def root():
    """API 根路径"""
    return {
        "message": "欢迎使用 CloudPaste History API",
        "version": settings.VERSION,
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health", tags=["健康检查"])
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION
    }
