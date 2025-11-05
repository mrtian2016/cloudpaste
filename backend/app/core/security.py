"""
安全认证工具
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.db_models import User as DBUser
from app.models.schemas import TokenData
from app.core.database import get_db

# JWT 配置
SECRET_KEY = "your-secret-key-change-this-in-production"  # 生产环境需要改成环境变量
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7天

# 密码加密上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 密码流
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    验证密码
    
    Args:
        plain_password: 明文密码
        hashed_password: 哈希密码
    
    Returns:
        是否匹配
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    获取密码哈希
    
    Args:
        password: 明文密码
    
    Returns:
        哈希密码
    """
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    创建访问令牌
    
    Args:
        data: 要编码的数据
        expires_delta: 过期时间增量
    
    Returns:
        JWT token
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    return encoded_jwt


async def get_user_by_username(username: str, session: AsyncSession) -> Optional[DBUser]:
    """
    根据用户名获取用户
    
    Args:
        username: 用户名
        session: 数据库会话
    
    Returns:
        用户对象或 None
    """
    result = await session.execute(
        select(DBUser).where(DBUser.username == username)
    )
    return result.scalar_one_or_none()


async def authenticate_user(username: str, password: str, session: AsyncSession) -> Optional[DBUser]:
    """
    认证用户
    
    Args:
        username: 用户名
        password: 密码
        session: 数据库会话
    
    Returns:
        用户对象或 None
    """
    user = await get_user_by_username(username, session)
    
    if not user:
        return None
    
    if not verify_password(password, user.hashed_password):
        return None
    
    return user


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_db)
) -> DBUser:
    """
    获取当前用户（依赖注入）
    
    Args:
        token: JWT token
        session: 数据库会话
    
    Returns:
        当前用户对象
    
    Raises:
        HTTPException: 认证失败
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        
        if username is None:
            raise credentials_exception
        
        token_data = TokenData(username=username)
        
    except JWTError:
        raise credentials_exception
    
    user = await get_user_by_username(token_data.username, session)
    
    if user is None:
        raise credentials_exception
    
    return user


async def get_current_active_user(
    current_user: DBUser = Depends(get_current_user)
) -> DBUser:
    """
    获取当前激活用户
    
    Args:
        current_user: 当前用户
    
    Returns:
        激活的用户对象
    
    Raises:
        HTTPException: 用户未激活
    """
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="用户未激活")
    
    return current_user


async def get_current_superuser(
    current_user: DBUser = Depends(get_current_active_user)
) -> DBUser:
    """
    获取当前超级用户

    Args:
        current_user: 当前用户

    Returns:
        超级用户对象

    Raises:
        HTTPException: 权限不足
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足"
        )

    return current_user


async def get_optional_current_user(
    request: Request,
    session: AsyncSession = Depends(get_db)
) -> Optional[DBUser]:
    """
    获取当前用户（可选，支持 Header 或 URL 参数认证）
    优先从 Header 获取，其次从 URL 参数获取
    用于需要同时支持 API 调用和媒体文件访问的场景

    Args:
        request: HTTP 请求对象
        session: 数据库会话

    Returns:
        用户对象或 None
    """
    token = None

    # 1. 尝试从 Authorization Header 获取
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "")

    # 2. 如果 Header 没有，尝试从 URL 参数获取
    if not token:
        token = request.query_params.get("token")

    # 如果没有 token，返回 None
    if not token:
        return None

    # 验证 token
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")

        if username is None:
            return None

        user = await get_user_by_username(username, session)
        return user

    except JWTError:
        return None


async def get_current_user_flexible(
    request: Request,
    session: AsyncSession = Depends(get_db)
) -> DBUser:
    """
    获取当前用户（必须认证，支持 Header 或 URL 参数认证）
    优先从 Header 获取，其次从 URL 参数获取
    用于文件下载等需要认证但也需要支持 <video> 标签访问的场景

    Args:
        request: HTTP 请求对象
        session: 数据库会话

    Returns:
        用户对象

    Raises:
        HTTPException: 未认证或认证失败
    """
    user = await get_optional_current_user(request, session)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供有效的认证凭据",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="用户未激活")

    return user
