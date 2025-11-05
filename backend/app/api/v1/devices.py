"""
设备管理相关API路由 (SQLAlchemy 版本)
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func
from loguru import logger

from app.api.deps import get_db
from app.models.db_models import Device as DeviceModel, User as DBUser
from app.models.schemas import Device, DeviceCreate, ApiResponse
from app.core.security import get_current_active_user

router = APIRouter()


@router.post("/", response_model=Device, summary="注册设备")
async def register_device(
    device: DeviceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user)
):
    """注册或更新设备信息（登录时自动调用）"""
    try:
        # 检查设备是否已存在
        result = await db.execute(
            select(DeviceModel).where(DeviceModel.device_id == device.device_id)
        )
        existing = result.scalar_one_or_none()

        if existing:
            # 更新设备信息
            existing.device_name = device.device_name
            existing.device_type = device.device_type
            existing.last_sync = func.now()
            await db.flush()
            await db.refresh(existing)
            logger.info(f"更新设备信息: {device.device_id}")
            return existing
        else:
            # 创建新设备
            new_device = DeviceModel(
                device_id=device.device_id,
                device_name=device.device_name,
                device_type=device.device_type
            )
            db.add(new_device)
            await db.flush()
            await db.refresh(new_device)
            logger.info(f"注册新设备: {device.device_id}")
            return new_device

    except Exception as e:
        logger.error(f"注册设备失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=list[Device], summary="获取设备列表")
async def get_devices(
    db: AsyncSession = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user)
):
    """获取所有已注册的设备列表"""
    try:
        result = await db.execute(
            select(DeviceModel).order_by(DeviceModel.last_sync.desc())
        )
        devices = result.scalars().all()
        
        logger.info(f"获取设备列表: 总数={len(devices)}")
        
        return devices
        
    except Exception as e:
        logger.error(f"获取设备列表失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{device_id}", response_model=Device, summary="获取设备详情")
async def get_device(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user)
):
    """根据设备ID获取设备详情"""
    try:
        result = await db.execute(
            select(DeviceModel).where(DeviceModel.device_id == device_id)
        )
        device = result.scalar_one_or_none()
        
        if not device:
            raise HTTPException(status_code=404, detail="设备不存在")
        
        return device
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取设备详情失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


