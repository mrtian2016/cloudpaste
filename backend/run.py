"""
应用启动入口
"""
import uvicorn
from loguru import logger
from app.config import settings

if __name__ == "__main__":
    logger.info(f"启动服务器: http://{settings.HOST}:{settings.PORT}")
    logger.info(f"API 文档: http://{settings.HOST}:{settings.PORT}/docs")
    
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_config=None  # 使用 loguru 而不是 uvicorn 的日志
    )
