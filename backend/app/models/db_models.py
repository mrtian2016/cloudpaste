"""
SQLAlchemy 数据库模型定义
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, Boolean, Integer, DateTime, Index
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    """ORM 模型基类"""
    pass


class User(Base):
    """用户模型"""
    __tablename__ = "users"
    
    # 主键
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # 用户信息
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, comment="用户名")
    email: Mapped[Optional[str]] = mapped_column(String(100), unique=True, comment="邮箱")
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False, comment="密码哈希")
    full_name: Mapped[Optional[str]] = mapped_column(String(100), comment="全名")
    
    # 状态
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, comment="是否激活")
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, comment="是否超级用户")

    # 用户设置
    max_history_items: Mapped[int] = mapped_column(Integer, default=1000, nullable=False, comment="历史数据最大保留条数")

    # 时间戳
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        nullable=False,
        comment="创建时间"
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        comment="更新时间"
    )
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime, comment="最后登录时间")
    
    # 索引
    __table_args__ = (
        Index('idx_username', 'username'),
        Index('idx_email', 'email'),
    )


class ClipboardHistory(Base):
    """剪贴板历史记录模型"""
    __tablename__ = "clipboard_history"
    
    # 主键
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # 内容字段
    content: Mapped[str] = mapped_column(Text, nullable=False, comment="剪贴板内容或文件路径")
    content_type: Mapped[str] = mapped_column(
        String(50), 
        default="text", 
        nullable=False,
        comment="内容类型: text/image/file"
    )
    content_hash: Mapped[Optional[str]] = mapped_column(String(64), comment="内容哈希(SHA256)，用于去重")
    
    # 文件相关字段
    file_name: Mapped[Optional[str]] = mapped_column(String(255), comment="原始文件名")
    file_size: Mapped[Optional[int]] = mapped_column(Integer, comment="文件大小(字节)")
    mime_type: Mapped[Optional[str]] = mapped_column(String(100), comment="MIME类型")
    
    # 设备信息
    device_id: Mapped[Optional[str]] = mapped_column(String(100), comment="设备ID")
    device_name: Mapped[Optional[str]] = mapped_column(String(100), comment="设备名称")
    
    # 用户关联
    user_id: Mapped[Optional[int]] = mapped_column(Integer, comment="用户ID")
    
    # 时间戳
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        nullable=False,
        comment="创建时间"
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        comment="更新时间"
    )
    
    # 状态标记
    synced: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, comment="是否已同步")
    favorite: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, comment="是否收藏")
    
    # 标签
    tags: Mapped[Optional[str]] = mapped_column(Text, comment="标签(逗号分隔)")
    
    # 索引
    __table_args__ = (
        Index('idx_created_at', 'created_at'),
        Index('idx_device_id', 'device_id'),
        Index('idx_favorite', 'favorite'),
        Index('idx_user_id', 'user_id'),
        Index('idx_user_content', 'user_id', 'content_type', 'created_at'),  # 用于去重查询
        Index('idx_user_hash', 'user_id', 'content_hash', 'created_at'),  # 用于哈希去重
    )
    
    def __repr__(self) -> str:
        return f"<ClipboardHistory(id={self.id}, content='{self.content[:20]}...', created_at={self.created_at})>"


class Device(Base):
    """设备信息模型"""
    __tablename__ = "devices"
    
    # 主键
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # 设备信息
    device_id: Mapped[str] = mapped_column(
        String(100), 
        unique=True, 
        nullable=False,
        comment="设备唯一标识"
    )
    device_name: Mapped[str] = mapped_column(String(100), nullable=False, comment="设备名称")
    device_type: Mapped[Optional[str]] = mapped_column(String(50), comment="设备类型")
    
    # 时间戳
    last_sync: Mapped[Optional[datetime]] = mapped_column(DateTime, comment="最后同步时间")
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        nullable=False,
        comment="创建时间"
    )
    
    def __repr__(self) -> str:
        return f"<Device(id={self.id}, device_id='{self.device_id}', device_name='{self.device_name}')>"
