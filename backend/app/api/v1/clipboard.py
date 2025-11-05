"""
剪贴板相关API路由 (SQLAlchemy 版本)
"""
import hashlib
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from typing import Optional
from sqlalchemy import select, delete, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger
from pathlib import Path

from app.api.deps import get_db
from app.models.db_models import ClipboardHistory, User as DBUser
from app.models.schemas import (
    ClipboardItem,
    ClipboardItemCreate,
    ClipboardItemUpdate,
    ClipboardListResponse,
    ApiResponse
)
from app.core.security import get_current_active_user
from app.core.websocket import manager
from app.config import settings

router = APIRouter()

# 文件存储目录
UPLOAD_DIR = Path(settings.UPLOAD_DIR)


def delete_file_if_exists(file_id: str) -> bool:
    """
    删除文件（如果存在）

    Args:
        file_id: 文件ID（文件名）

    Returns:
        是否成功删除
    """
    try:
        file_path = UPLOAD_DIR / file_id
        if file_path.exists() and file_path.is_file():
            file_path.unlink()
            logger.info(f"文件删除成功: {file_id}")
            return True
        return False
    except Exception as e:
        logger.warning(f"删除文件失败: {file_id}, 错误: {e}")
        return False


@router.post("/", response_model=ClipboardItem, summary="添加剪贴板项")
async def create_clipboard_item(
    item: ClipboardItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user)
):
    """添加新的剪贴板历史记录（需要认证，支持去重）"""
    try:
        # 计算内容哈希（用于去重）
        content_hash = hashlib.sha256(
            f"{item.content_type}:{item.content}".encode('utf-8')
        ).hexdigest()

        # 检查是否存在相同内容（基于 hash）
        result = await db.execute(
            select(ClipboardHistory)
            .where(
                ClipboardHistory.user_id == current_user.id,
                ClipboardHistory.content_hash == content_hash
            )
            .order_by(ClipboardHistory.created_at.desc())
            .limit(1)
        )
        existing_item = result.scalar_one_or_none()

        if existing_item:
            # 找到重复内容，更新时间戳使其重新出现在顶部
            existing_item.created_at = datetime.now(timezone.utc)
            await db.flush()
            await db.refresh(existing_item)

            logger.info(
                f"更新重复内容时间戳: 用户={current_user.username}, "
                f"类型={item.content_type}, 内容长度={len(item.content)}, "
                f"哈希={content_hash[:8]}..., ID={existing_item.id}"
            )

            # 准备广播数据
            clipboard_data = {
                "clipboard_id": existing_item.id,
                "content": existing_item.content,
                "content_type": existing_item.content_type,
                "device_id": existing_item.device_id,
                "device_name": existing_item.device_name,
                "file_name": existing_item.file_name,
                "file_size": existing_item.file_size,
                "mime_type": existing_item.mime_type,
                "created_at": existing_item.created_at.isoformat(),
                "is_duplicate": True  # 标记为重复内容
            }

            # 对于文件类型，添加下载URL
            if existing_item.content_type in ["image", "file"] and existing_item.content:
                clipboard_data["file_url"] = f"/api/v1/files/download/{existing_item.content}"

            # 推送到队列进行广播（通知时间戳更新）
            await manager.push_to_queue(
                clipboard_data=clipboard_data,
                user_id=current_user.id,
                device_id=item.device_id
            )

            logger.info(f"重复内容时间戳更新已推送到广播队列: ID={existing_item.id}, User={current_user.id}")

            return existing_item

        # 不是重复内容，创建新记录
        db_item = ClipboardHistory(
            content=item.content,
            content_type=item.content_type,
            content_hash=content_hash,  # 保存 hash 值
            device_id=item.device_id,
            device_name=item.device_name,
            favorite=item.favorite,
            tags=item.tags,
            file_name=item.file_name,
            file_size=item.file_size,
            mime_type=item.mime_type,
            user_id=current_user.id  # 设置用户 ID
        )

        db.add(db_item)
        await db.flush()  # 刷新以获取 ID
        await db.refresh(db_item)  # 刷新以获取所有字段

        logger.info(f"创建剪贴板项成功: ID={db_item.id}, User={current_user.id}, Hash={content_hash[:8]}...")

        # 推送到 WebSocket 广播队列
        clipboard_data = {
            "clipboard_id": db_item.id,
            "content": db_item.content,
            "content_type": db_item.content_type,
            "device_id": db_item.device_id,
            "device_name": db_item.device_name,
            "file_name": db_item.file_name,
            "file_size": db_item.file_size,
            "mime_type": db_item.mime_type,
            "created_at": db_item.created_at.isoformat(),
            "is_duplicate": False  # 新内容
        }

        # 对于文件类型，添加下载URL
        if db_item.content_type in ["image", "file"] and db_item.content:
            clipboard_data["file_url"] = f"/api/v1/files/download/{db_item.content}"

        # 推送到队列进行广播
        await manager.push_to_queue(
            clipboard_data=clipboard_data,
            user_id=current_user.id,
            device_id=item.device_id
        )

        logger.info(f"剪贴板数据已推送到广播队列: ID={db_item.id}, User={current_user.id}")

        # 自动清理：检查用户的历史数据量，如果超过限制则删除最旧的数据
        try:
            # 获取用户的历史数据总数
            count_result = await db.execute(
                select(func.count()).where(ClipboardHistory.user_id == current_user.id)
            )
            total_count = count_result.scalar() or 0

            # 如果超过用户设置的最大数量，删除最旧的记录
            if total_count > current_user.max_history_items:
                # 计算需要删除的数量
                delete_count = total_count - current_user.max_history_items

                # 查询最旧的记录（按创建时间排序）
                old_items_result = await db.execute(
                    select(ClipboardHistory)
                    .where(ClipboardHistory.user_id == current_user.id)
                    .order_by(ClipboardHistory.created_at.asc())
                    .limit(delete_count)
                )
                old_items = old_items_result.scalars().all()

                # 删除关联的文件
                deleted_files = 0
                for old_item in old_items:
                    if old_item.content_type in ['image', 'file'] and old_item.content:
                        file_id = old_item.content
                        if '/' in file_id:
                            file_id = file_id.split('/')[-1]
                        if delete_file_if_exists(file_id):
                            deleted_files += 1

                # 批量删除数据库记录
                old_item_ids = [item.id for item in old_items]
                await db.execute(
                    delete(ClipboardHistory).where(ClipboardHistory.id.in_(old_item_ids))
                )

                logger.info(
                    f"自动清理历史数据: User={current_user.id}, "
                    f"删除记录={len(old_items)}, 删除文件={deleted_files}, "
                    f"当前总数={total_count}, 限制={current_user.max_history_items}"
                )
        except Exception as clean_error:
            # 清理失败不应影响主流程
            logger.error(f"自动清理历史数据失败: {clean_error}")

        return db_item

    except Exception as e:
        logger.error(f"创建剪贴板项失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=ClipboardListResponse, summary="获取剪贴板列表")
async def get_clipboard_list(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    device_id: Optional[str] = Query(None, description="设备ID筛选"),
    favorite: Optional[bool] = Query(None, description="是否只显示收藏"),
    search: Optional[str] = Query(None, description="搜索内容"),
    db: AsyncSession = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user)
):
    """获取剪贴板历史列表,支持分页和筛选（需要认证）"""
    try:
        # 构建基础查询（只查询当前用户的数据）
        query = select(ClipboardHistory).where(ClipboardHistory.user_id == current_user.id)

        # 添加筛选条件
        if device_id:
            query = query.where(ClipboardHistory.device_id == device_id)

        if favorite is not None:
            query = query.where(ClipboardHistory.favorite == favorite)

        if search:
            query = query.where(ClipboardHistory.content.like(f"%{search}%"))
        
        # 获取总数
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0
        
        # 添加排序和分页
        offset = (page - 1) * page_size
        query = query.order_by(ClipboardHistory.updated_at.desc()).limit(page_size).offset(offset)
        
        # 执行查询
        result = await db.execute(query)
        items = result.scalars().all()
        
        logger.info(f"获取剪贴板列表: 总数={total}, 页码={page}, 每页={page_size}")
        
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "items": items
        }
        
    except Exception as e:
        logger.error(f"获取剪贴板列表失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{item_id}", response_model=ClipboardItem, summary="获取单个剪贴板项")
async def get_clipboard_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user)
):
    """根据ID获取剪贴板项详情（需要认证，只能访问自己的数据）"""
    try:
        result = await db.execute(
            select(ClipboardHistory)
            .where(ClipboardHistory.id == item_id)
            .where(ClipboardHistory.user_id == current_user.id)
        )
        item = result.scalar_one_or_none()

        if not item:
            raise HTTPException(status_code=404, detail="剪贴板项不存在")

        return item
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取剪贴板项失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{item_id}", response_model=ClipboardItem, summary="更新剪贴板项")
async def update_clipboard_item(
    item_id: int,
    item: ClipboardItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user)
):
    """更新剪贴板项信息（需要认证，只能修改自己的数据）"""
    try:
        # 查询现有项
        result = await db.execute(
            select(ClipboardHistory)
            .where(ClipboardHistory.id == item_id)
            .where(ClipboardHistory.user_id == current_user.id)
        )
        db_item = result.scalar_one_or_none()

        if not db_item:
            raise HTTPException(status_code=404, detail="剪贴板项不存在")

        # 更新字段
        update_data = item.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_item, field, value)

        await db.flush()
        await db.refresh(db_item)

        logger.info(f"更新剪贴板项成功: ID={item_id}, User={current_user.id}")

        return db_item
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新剪贴板项失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{item_id}", response_model=ApiResponse, summary="删除剪贴板项")
async def delete_clipboard_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user)
):
    """删除指定的剪贴板项（需要认证，只能删除自己的数据）"""
    try:
        # 查询项是否存在
        result = await db.execute(
            select(ClipboardHistory)
            .where(ClipboardHistory.id == item_id)
            .where(ClipboardHistory.user_id == current_user.id)
        )
        item = result.scalar_one_or_none()

        if not item:
            raise HTTPException(status_code=404, detail="剪贴板项不存在")

        # 如果是图片或文件类型，删除对应的文件
        if item.content_type in ['image', 'file'] and item.content:
            # content 字段存储的是文件ID
            file_id = item.content
            # 如果是完整路径，提取文件名
            if '/' in file_id:
                file_id = file_id.split('/')[-1]

            delete_file_if_exists(file_id)
            logger.info(f"删除剪贴板项关联文件: ID={item_id}, FileID={file_id}")

        # 删除项
        await db.delete(item)
        await db.flush()

        logger.info(f"删除剪贴板项成功: ID={item_id}, User={current_user.id}")

        return {
            "success": True,
            "message": "删除成功"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除剪贴板项失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/", response_model=ApiResponse, summary="批量删除剪贴板项")
async def batch_delete_clipboard_items(
    ids: list[int] = Body(..., description="要删除的剪贴板项ID列表"),
    db: AsyncSession = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user)
):
    """批量删除剪贴板项（需要认证，只能删除自己的数据）"""
    try:
        if not ids:
            raise HTTPException(status_code=400, detail="未提供要删除的ID")

        # 先查询要删除的所有项，以便删除关联的文件
        result = await db.execute(
            select(ClipboardHistory)
            .where(ClipboardHistory.id.in_(ids))
            .where(ClipboardHistory.user_id == current_user.id)
        )
        items = result.scalars().all()

        # 删除图片和文件类型的关联文件
        deleted_files = 0
        for item in items:
            if item.content_type in ['image', 'file'] and item.content:
                # content 字段存储的是文件ID
                file_id = item.content
                # 如果是完整路径，提取文件名
                if '/' in file_id:
                    file_id = file_id.split('/')[-1]

                if delete_file_if_exists(file_id):
                    deleted_files += 1

        # 使用 delete 语句批量删除（只删除当前用户的数据）
        stmt = (
            delete(ClipboardHistory)
            .where(ClipboardHistory.id.in_(ids))
            .where(ClipboardHistory.user_id == current_user.id)
        )
        result = await db.execute(stmt)
        await db.flush()

        deleted_count = result.rowcount
        logger.info(f"批量删除剪贴板项: 删除记录={deleted_count}, 删除文件={deleted_files}, User={current_user.id}")

        return {
            "success": True,
            "message": f"成功删除 {deleted_count} 条记录"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量删除剪贴板项失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))
