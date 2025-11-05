"""
数据模型定义
"""
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional
from datetime import datetime


# ==================== 用户相关模型 ====================

class UserBase(BaseModel):
    """用户基础模型"""
    username: str = Field(..., min_length=3, max_length=50, description="用户名")
    email: Optional[EmailStr] = Field(None, description="邮箱")
    full_name: Optional[str] = Field(None, max_length=100, description="全名")


class UserCreate(UserBase):
    """创建用户模型"""
    password: str = Field(..., min_length=6, description="密码")


class UserUpdate(BaseModel):
    """更新用户模型"""
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    password: Optional[str] = Field(None, min_length=6)
    is_active: Optional[bool] = None


class User(UserBase):
    """用户完整模型"""
    id: int
    is_active: bool = True
    is_superuser: bool = False
    max_history_items: int = 1000
    created_at: datetime
    last_login: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class UserInDB(User):
    """数据库中的用户模型（包含密码哈希）"""
    hashed_password: str


class Token(BaseModel):
    """JWT Token 模型"""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Token 数据模型"""
    username: Optional[str] = None


class UserSettings(BaseModel):
    """用户设置模型"""
    max_history_items: int = Field(1000, ge=100, le=10000, description="历史数据最大保留条数")


class UserSettingsUpdate(BaseModel):
    """更新用户设置模型"""
    max_history_items: Optional[int] = Field(None, ge=100, le=10000, description="历史数据最大保留条数")


class LoginRequest(BaseModel):
    """登录请求模型"""
    username: str = Field(..., description="用户名")
    password: str = Field(..., description="密码")


# ==================== 剪贴板相关模型 ====================


class ClipboardItemBase(BaseModel):
    """剪贴板项基础模型"""
    content: str = Field(..., description="剪贴板内容或文件路径")
    content_type: str = Field(default="text", description="内容类型: text/image/file")
    device_id: Optional[str] = Field(None, description="设备ID")
    device_name: Optional[str] = Field(None, description="设备名称")
    favorite: bool = Field(default=False, description="是否收藏")
    tags: Optional[str] = Field(None, description="标签(逗号分隔)")
    file_name: Optional[str] = Field(None, description="原始文件名")
    file_size: Optional[int] = Field(None, description="文件大小(字节)")
    mime_type: Optional[str] = Field(None, description="MIME类型")


class ClipboardItemCreate(ClipboardItemBase):
    """创建剪贴板项的模型"""
    pass


class ClipboardItemUpdate(BaseModel):
    """更新剪贴板项的模型"""
    content: Optional[str] = None
    favorite: Optional[bool] = None
    tags: Optional[str] = None


class ClipboardItem(ClipboardItemBase):
    """剪贴板项完整模型"""
    id: int
    updated_at: datetime
    synced: bool = False

    model_config = ConfigDict(from_attributes=True)


class DeviceBase(BaseModel):
    """设备基础模型"""
    device_id: str = Field(..., description="设备唯一标识")
    device_name: str = Field(..., description="设备名称")
    device_type: Optional[str] = Field(None, description="设备类型")


class DeviceCreate(DeviceBase):
    """创建设备的模型"""
    pass


class Device(DeviceBase):
    """设备完整模型"""
    id: int
    last_sync: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginationParams(BaseModel):
    """分页参数"""
    page: int = Field(default=1, ge=1, description="页码")
    page_size: int = Field(default=20, ge=1, le=100, description="每页数量")


class ClipboardListResponse(BaseModel):
    """剪贴板列表响应"""
    total: int
    page: int
    page_size: int
    items: list[ClipboardItem]


class ApiResponse(BaseModel):
    """通用API响应"""
    success: bool
    message: str
    data: Optional[dict] = None
