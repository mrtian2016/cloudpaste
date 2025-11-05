"""
认证 API 路由
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from loguru import logger

from app.models.db_models import User as DBUser
from app.models.schemas import (
    User, UserCreate, UserUpdate, Token, LoginRequest, UserSettings, UserSettingsUpdate, ApiResponse
)
from app.core.database import get_db
from app.core.security import (
    get_password_hash,
    authenticate_user,
    create_access_token,
    get_current_active_user,
    get_current_superuser,
    ACCESS_TOKEN_EXPIRE_MINUTES
)

router = APIRouter()


@router.post("/register", response_model=User, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    session: AsyncSession = Depends(get_db)
):
    """
    注册新用户
    
    Args:
        user_data: 用户注册数据
        session: 数据库会话
    
    Returns:
        创建的用户信息
    """
    # 检查用户名是否已存在
    result = await session.execute(
        select(DBUser).where(DBUser.username == user_data.username)
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在"
        )
    
    # 检查邮箱是否已存在
    if user_data.email:
        result = await session.execute(
            select(DBUser).where(DBUser.email == user_data.email)
        )
        existing_email = result.scalar_one_or_none()
        
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="邮箱已被使用"
            )
    
    # 创建新用户
    db_user = DBUser(
        username=user_data.username,
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        is_active=True,
        is_superuser=False
    )
    
    session.add(db_user)
    await session.commit()
    await session.refresh(db_user)
    
    logger.info(f"新用户注册: {user_data.username}")
    
    return db_user


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_db)
):
    """
    用户登录（支持 OAuth2 标准表单格式）
    
    Args:
        form_data: OAuth2 表单数据（username, password）
        session: 数据库会话
    
    Returns:
        访问令牌
    """
    user = await authenticate_user(form_data.username, form_data.password, session)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户未激活"
        )
    
    # 更新最后登录时间
    user.last_login = datetime.now()
    await session.commit()
    
    # 创建访问令牌
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=access_token_expires
    )
    
    logger.info(f"用户登录: {user.username}")
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=User)
async def get_current_user_info(
    current_user: DBUser = Depends(get_current_active_user)
):
    """
    获取当前用户信息
    
    Args:
        current_user: 当前用户
    
    Returns:
        用户信息
    """
    return current_user


@router.put("/me", response_model=User)
async def update_current_user(
    user_update: UserUpdate,
    current_user: DBUser = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_db)
):
    """
    更新当前用户信息
    
    Args:
        user_update: 更新数据
        current_user: 当前用户
        session: 数据库会话
    
    Returns:
        更新后的用户信息
    """
    # 更新字段
    if user_update.email is not None:
        # 检查邮箱是否已被其他用户使用
        result = await session.execute(
            select(DBUser).where(
                DBUser.email == user_update.email,
                DBUser.id != current_user.id
            )
        )
        existing_email = result.scalar_one_or_none()
        
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="邮箱已被使用"
            )
        
        current_user.email = user_update.email
    
    if user_update.full_name is not None:
        current_user.full_name = user_update.full_name
    
    if user_update.password is not None:
        current_user.hashed_password = get_password_hash(user_update.password)
    
    current_user.updated_at = datetime.now()
    
    await session.commit()
    await session.refresh(current_user)
    
    logger.info(f"用户信息已更新: {current_user.username}")
    
    return current_user


@router.get("/users", response_model=list[User])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    current_user: DBUser = Depends(get_current_superuser),
    session: AsyncSession = Depends(get_db)
):
    """
    获取用户列表（仅超级用户）
    
    Args:
        skip: 跳过数量
        limit: 限制数量
        current_user: 当前用户（超级用户）
        session: 数据库会话
    
    Returns:
        用户列表
    """
    result = await session.execute(
        select(DBUser).offset(skip).limit(limit)
    )
    users = result.scalars().all()
    
    return users


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: DBUser = Depends(get_current_superuser),
    session: AsyncSession = Depends(get_db)
):
    """
    删除用户（仅超级用户）
    
    Args:
        user_id: 用户ID
        current_user: 当前用户（超级用户）
        session: 数据库会话
    
    Returns:
        删除结果
    """
    result = await session.execute(
        select(DBUser).where(DBUser.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 不能删除自己
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能删除自己"
        )
    
    await session.delete(user)
    await session.commit()

    logger.info(f"用户已删除: {user.username} (by {current_user.username})")

    return {"message": "用户已删除", "username": user.username}


@router.get("/settings", response_model=UserSettings, summary="获取用户设置")
async def get_user_settings(
    current_user: DBUser = Depends(get_current_active_user)
):
    """
    获取当前用户的设置

    Returns:
        用户设置信息
    """
    return UserSettings(
        max_history_items=current_user.max_history_items
    )


@router.put("/settings", response_model=UserSettings, summary="更新用户设置")
async def update_user_settings(
    settings: UserSettingsUpdate,
    session: AsyncSession = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user)
):
    """
    更新当前用户的设置

    Args:
        settings: 要更新的设置
        session: 数据库会话
        current_user: 当前用户

    Returns:
        更新后的用户设置
    """
    # 更新设置
    if settings.max_history_items is not None:
        current_user.max_history_items = settings.max_history_items

    await session.commit()
    await session.refresh(current_user)

    logger.info(f"用户设置已更新: {current_user.username}, max_history_items={current_user.max_history_items}")

    return UserSettings(
        max_history_items=current_user.max_history_items
    )
