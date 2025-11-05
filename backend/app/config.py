"""
应用配置模块
"""
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    """应用配置类"""
    
    # 服务器配置
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True
    
    # SQLAlchemy 配置
    SQLALCHEMY_ECHO: bool = False  # 设置为 False 隐藏 SQL 日志
    
    # 数据库配置
    DATABASE_PATH: str = "./data/clipboard.db"
    
    # 日志配置
    LOG_LEVEL: str = "INFO"
    LOG_PATH: str = "./logs"

    # 文件上传配置
    UPLOAD_DIR: str = "./uploads"

    # API 配置
    API_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "CloudPaste History API"
    VERSION: str = "1.0.0"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# 创建全局配置实例
settings = Settings()

# 确保必要的目录存在
Path(settings.DATABASE_PATH).parent.mkdir(parents=True, exist_ok=True)
Path(settings.LOG_PATH).mkdir(parents=True, exist_ok=True)
Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
