"""
WebSocket API 路由
"""
import hashlib
from datetime import datetime, timedelta, timezone
from pathlib import Path
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from loguru import logger
from jose import JWTError, jwt

from app.core.websocket import manager
from app.core.database import db
from app.models.db_models import ClipboardHistory, User as DBUser
from app.core.security import SECRET_KEY, ALGORITHM, get_user_by_username
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


async def verify_websocket_token(token: str) -> DBUser:
    """
    验证 WebSocket Token
    
    Args:
        token: JWT token
    
    Returns:
        用户对象
    
    Raises:
        Exception: 认证失败
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        
        if username is None:
            raise Exception("无效的token")
        
        if not db.async_session_maker:
            db.init_engine()
        
        async with db.async_session_maker() as session:
            user = await get_user_by_username(username, session)
            
            if user is None or not user.is_active:
                raise Exception("用户不存在或未激活")
            
            return user
            
    except JWTError:
        raise Exception("token验证失败")


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    device_id: str = Query(..., description="设备唯一标识"),
    device_name: str = Query(None, description="设备名称"),
    token: str = Query(..., description="认证Token（必须）")
):
    """
    WebSocket 连接端点（需要认证）

    Args:
        websocket: WebSocket 连接
        device_id: 设备唯一标识
        device_name: 设备名称（可选）
        token: JWT认证Token（必须）
    """
    # 确保队列消费者已启动
    manager.start_queue_consumer()

    # Token 认证（必须）
    if not token:
        logger.warning(f"WebSocket 未提供token: 设备={device_id}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        user = await verify_websocket_token(token)
        logger.info(f"WebSocket 认证成功: 用户={user.username}, 设备={device_id}")
    except Exception as e:
        logger.warning(f"WebSocket 认证失败: {e}, 设备={device_id}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    
    # 接受连接（传递用户信息以支持隔离）
    await manager.connect(
        websocket,
        device_id,
        device_name,
        user_id=user.id,
        username=user.username
    )

    try:
        # 发送欢迎消息（只显示该用户的设备）
        await websocket.send_json({
            "type": "connected",
            "data": {
                "device_id": device_id,
                "message": "WebSocket 连接成功",
                "user": user.username,
                "online_devices": manager.get_online_devices(user_id=user.id)
            }
        })
        
        # 持续接收消息
        while True:
            # 接收客户端消息
            data = await websocket.receive_json()
            action = data.get("action")
            
            if action == "sync_clipboard":
                # 同步剪贴板
                clipboard_data = data.get("data", {})
                content_type = clipboard_data.get("content_type", "text")
                content = clipboard_data.get("content", "")
                
                # 对于文件类型，添加下载URL
                if content_type in ["image", "file"] and "file_id" in clipboard_data:
                    file_id = clipboard_data["file_id"]
                    clipboard_data["file_url"] = f"/api/v1/files/download/{file_id}"
                
                # 去重检查和保存到数据库
                should_sync = True
                saved_to_db = False
                
                # 计算内容哈希
                content_hash = hashlib.sha256(
                    f"{content_type}:{content}".encode('utf-8')
                ).hexdigest()
                
                try:
                    if not db.async_session_maker:
                        db.init_engine()

                    # 第一步：使用哈希快速检查是否重复
                    async with db.async_session_maker() as session:

                        result = await session.execute(
                            select(ClipboardHistory)
                            .where(
                                ClipboardHistory.user_id == user.id,
                                ClipboardHistory.content_hash == content_hash
                            )
                            .order_by(ClipboardHistory.updated_at.desc())
                            .limit(1)
                        )
                        existing_item = result.scalar_one_or_none()

                        if existing_item:
                            should_sync = False

                            # 更新时间戳，使重复内容重新出现在列表顶部
                            existing_item.updated_at = datetime.now(timezone.utc)
                            await session.commit()
                            await session.refresh(existing_item)

                            logger.info(f"更新重复内容时间戳: 用户={user.username}, 类型={content_type}, 内容长度={len(content)}, 哈希={content_hash[:8]}..., ID={existing_item.id}")

                            # 准备更新数据（用于广播）
                            update_data = {
                                "clipboard_id": existing_item.id,
                                "content": existing_item.content,
                                "content_type": existing_item.content_type,
                                "file_name": existing_item.file_name,
                                "file_size": existing_item.file_size,
                                "mime_type": existing_item.mime_type,
                                "updated_at": existing_item.updated_at.isoformat(),
                                "device_id": existing_item.device_id,
                                "device_name": existing_item.device_name
                            }

                            # 对于文件类型，添加下载URL
                            if existing_item.content_type in ["image", "file"] and existing_item.content:
                                update_data["file_url"] = f"/api/v1/files/download/{existing_item.content}"

                            # 广播时间戳更新事件到同一用户的其他设备
                            await manager.broadcast_system_message(
                                message_type="timestamp_updated",
                                data={
                                    "message": "剪贴板项时间戳已更新",
                                    "clipboard_item": update_data,
                                    "reason": "duplicate_content"
                                },
                                user_id=user.id,
                                exclude_device=device_id  # 排除当前设备
                            )

                            # 发送时间戳更新通知给当前设备
                            await websocket.send_json({
                                "type": "timestamp_updated",
                                "data": {
                                    "message": "内容重复，已更新时间戳",
                                    "clipboard_item": update_data,
                                    "reason": "duplicate_content"
                                }
                            })

                    # 第二步：如果不是重复内容，则保存（写操作）
                    if should_sync:
                        async with db.async_session_maker() as session:
                            # 创建剪贴板记录
                            # 优先使用 clipboard_data 中的设备信息，如果没有则使用 WebSocket 连接的设备信息
                            item_device_id = clipboard_data.get("device_id") or device_id
                            item_device_name = clipboard_data.get("device_name") or device_name

                            db_item = ClipboardHistory(
                                content=content,
                                content_type=content_type,
                                content_hash=content_hash,  # 保存哈希值
                                device_id=item_device_id,  # 使用原始设备信息
                                device_name=item_device_name,  # 使用原始设备信息
                                user_id=user.id,  # 用户ID（必须）
                                file_name=clipboard_data.get("file_name"),
                                file_size=clipboard_data.get("file_size"),
                                mime_type=clipboard_data.get("mime_type"),
                                synced=True  # WebSocket 同步的标记为已同步
                            )

                            session.add(db_item)
                            await session.commit()
                            await session.refresh(db_item)

                            saved_to_db = True
                            logger.info(f"剪贴板已保存到数据库: ID={db_item.id}, 用户={user.username}, 类型={content_type}, 内容={content}")

                            # 将数据库ID添加到广播数据中
                            clipboard_data["clipboard_id"] = db_item.id

                            # 自动清理：检查用户的历史数据量，如果超过限制则删除最旧的数据
                            try:
                                # 获取用户的历史数据总数
                                count_result = await session.execute(
                                    select(func.count()).where(ClipboardHistory.user_id == user.id)
                                )
                                total_count = count_result.scalar() or 0

                                # 如果超过用户设置的最大数量，删除最旧的记录
                                if total_count > user.max_history_items:
                                    # 计算需要删除的数量
                                    delete_count = total_count - user.max_history_items

                                    # 查询最旧的记录（按创建时间排序）
                                    old_items_result = await session.execute(
                                        select(ClipboardHistory)
                                        .where(ClipboardHistory.user_id == user.id)
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
                                    await session.execute(
                                        delete(ClipboardHistory).where(ClipboardHistory.id.in_(old_item_ids))
                                    )
                                    await session.commit()

                                    logger.info(
                                        f"自动清理历史数据(WebSocket): User={user.id}, "
                                        f"删除记录={len(old_items)}, 删除文件={deleted_files}, "
                                        f"当前总数={total_count}, 限制={user.max_history_items}"
                                    )
                            except Exception as clean_error:
                                # 清理失败不应影响主流程
                                logger.error(f"自动清理历史数据失败(WebSocket): {clean_error}")
                
                except Exception as e:
                    logger.error(f"保存剪贴板到数据库失败: {e}")
                    import traceback
                    logger.error(traceback.format_exc())
                    # 即使保存失败，仍然继续广播
                
                # 只有非重复内容才广播
                if should_sync:
                    # 广播给同一用户的其他设备
                    await manager.broadcast_clipboard(
                        clipboard_data,
                        device_id,
                        user_id=user.id
                    )

                    # 确认消息（包含完整的剪贴板数据，供发送者更新本地列表）
                    await websocket.send_json({
                        "type": "sync_confirmed",
                        "data": {
                            "message": "剪贴板已同步并保存",
                            "synced_to": manager.get_connection_count(user_id=user.id) - 1,
                            "content_type": content_type,
                            "saved_to_db": saved_to_db,
                            "clipboard_data": clipboard_data  # 返回完整数据（包含 clipboard_id）
                        }
                    })
            
            elif action == "ping":
                # 心跳检测
                await websocket.send_json({
                    "type": "pong",
                    "data": {"timestamp": data.get("timestamp")}
                })
            
            elif action == "get_online_devices":
                # 获取该用户的在线设备列表
                await websocket.send_json({
                    "type": "online_devices",
                    "data": {
                        "devices": manager.get_online_devices(user_id=user.id),
                        "count": manager.get_connection_count(user_id=user.id)
                    }
                })
            
            else:
                # 未知操作
                await websocket.send_json({
                    "type": "error",
                    "data": {"message": f"未知操作: {action}"}
                })
    
    except WebSocketDisconnect:
        manager.disconnect(device_id)

        # 通知同一用户的其他设备
        await manager.broadcast_system_message(
            message_type="device_offline",
            data={
                "device_id": device_id,
                "online_count": manager.get_connection_count(user_id=user.id)
            },
            user_id=user.id
        )

        logger.info(f"设备断开连接: {device_id} (用户: {user.username})")
    
    except Exception as e:
        logger.error(f"WebSocket 错误 ({device_id}): {e}")
        manager.disconnect(device_id)


@router.get("/online")
async def get_online_devices(
    current_user: DBUser = Depends(lambda: None)  # 可选认证
):
    """
    获取当前在线设备列表
    如果提供了认证，则只返回该用户的设备
    """
    user_id = current_user.id if current_user else None
    
    return {
        "success": True,
        "data": {
            "devices": manager.get_online_devices(user_id=user_id),
            "count": manager.get_connection_count(user_id=user_id)
        }
    }
