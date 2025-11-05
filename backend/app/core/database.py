"""
数据库连接和会话管理模块 (SQLAlchemy 异步版本)
"""
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession,
    AsyncEngine
)
from loguru import logger
from app.config import settings
from app.models.db_models import Base


class Database:
    """数据库管理类"""
    
    def __init__(self):
        # SQLite 异步连接字符串
        self.database_url = f"sqlite+aiosqlite:///{settings.DATABASE_PATH}"
        self.engine: AsyncEngine | None = None
        self.async_session_maker: async_sessionmaker[AsyncSession] | None = None
    
    def init_engine(self):
        """初始化数据库引擎"""
        if not self.engine:
            self.engine = create_async_engine(
                self.database_url,
                echo=settings.SQLALCHEMY_ECHO,  # 控制 SQL 日志输出
                future=True,
                pool_pre_ping=True,  # 连接池预检查
            )
            
            self.async_session_maker = async_sessionmaker(
                self.engine,
                class_=AsyncSession,
                expire_on_commit=False,
                autocommit=False,
                autoflush=False,
            )
            
            logger.info(f"数据库引擎初始化成功: {self.database_url}")
    
    async def create_tables(self):
        """创建所有数据库表"""
        try:
            if not self.engine:
                self.init_engine()
            
            async with self.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            
            logger.info("数据库表创建成功")
        except Exception as e:
            logger.error(f"数据库表创建失败: {e}")
            raise
    
    async def drop_tables(self):
        """删除所有数据库表 (谨慎使用)"""
        try:
            if not self.engine:
                self.init_engine()
            
            async with self.engine.begin() as conn:
                await conn.run_sync(Base.metadata.drop_all)
            
            logger.warning("数据库表已删除")
        except Exception as e:
            logger.error(f"删除数据库表失败: {e}")
            raise
    
    async def close(self):
        """关闭数据库连接"""
        if self.engine:
            await self.engine.dispose()
            logger.info("数据库连接已关闭")


# 全局数据库实例
db = Database()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    获取数据库会话的依赖注入函数
    
    使用示例:
        @app.get("/items")
        async def get_items(db: AsyncSession = Depends(get_db)):
            result = await db.execute(select(Item))
            return result.scalars().all()
    """
    if not db.async_session_maker:
        db.init_engine()
    
    async with db.async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
