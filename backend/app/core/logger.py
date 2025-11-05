"""
日志配置模块
"""
import sys
import logging
from pathlib import Path
from loguru import logger
from app.config import settings


def setup_logger():
    """配置日志系统"""
    
    # 移除默认的处理器
    logger.remove()
    
    # 控制台输出 - 彩色格式
    logger.add(
        sys.stdout,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        level=settings.LOG_LEVEL,
        colorize=True
    )
    
    # 文件输出 - 普通日志
    log_path = Path(settings.LOG_PATH)
    logger.add(
        log_path / "app_{time:YYYY-MM-DD}.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
        level=settings.LOG_LEVEL,
        rotation="00:00",  # 每天午夜轮换
        retention="30 days",  # 保留30天
        compression="zip",  # 压缩旧日志
        encoding="utf-8"
    )
    
    # 错误日志单独记录
    logger.add(
        log_path / "error_{time:YYYY-MM-DD}.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
        level="ERROR",
        rotation="00:00",
        retention="90 days",  # 错误日志保留更久
        compression="zip",
        encoding="utf-8"
    )
    
    # 禁用 SQLAlchemy 的日志输出
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
    logging.getLogger('sqlalchemy.pool').setLevel(logging.WARNING)
    logging.getLogger('sqlalchemy.dialects').setLevel(logging.WARNING)
    logging.getLogger('sqlalchemy.orm').setLevel(logging.WARNING)
    
    logger.info("日志系统初始化完成")
    logger.info(f"日志级别: {settings.LOG_LEVEL}")
    logger.info(f"日志路径: {settings.LOG_PATH}")
    logger.info(f"SQLAlchemy 日志: {'启用' if settings.SQLALCHEMY_ECHO else '禁用'}")
