"""
WebSocket 连接管理器
"""
from typing import Dict
from fastapi import WebSocket
from loguru import logger
from datetime import datetime
import asyncio


class ConnectionManager:
    """
    WebSocket 连接管理器
    管理多个设备的 WebSocket 连接，支持消息广播和设备间同步
    支持用户隔离：每个用户只能看到和同步自己的设备
    """
    
    def __init__(self):
        # 存储所有活动连接: {device_id: WebSocket}
        self.active_connections: Dict[str, WebSocket] = {}
        # 存储设备信息: {device_id: {"device_name": str, "user_id": int, "username": str, "connected_at": datetime}}
        self.device_info: Dict[str, dict] = {}
        # 剪贴板广播队列
        self.clipboard_queue: asyncio.Queue = asyncio.Queue()
        # 队列消费者任务
        self._queue_consumer_task = None
    
    async def connect(self, websocket: WebSocket, device_id: str, device_name: str = None, user_id: int = None, username: str = None):
        """
        接受新的 WebSocket 连接
        
        Args:
            websocket: WebSocket 连接对象
            device_id: 设备唯一标识
            device_name: 设备名称
            user_id: 用户ID（用于隔离）
            username: 用户名
        """
        await websocket.accept()
        
        # 如果设备已连接，先断开旧连接
        if device_id in self.active_connections:
            old_ws = self.active_connections[device_id]
            try:
                await old_ws.close(code=1000, reason="New connection from same device")
            except:
                pass
        
        self.active_connections[device_id] = websocket
        self.device_info[device_id] = {
            "device_name": device_name or device_id,
            "user_id": user_id,
            "username": username,
            "connected_at": datetime.now()
        }
        
        logger.info(f"设备已连接: {device_id} ({device_name}), 用户: {username} (ID={user_id}), 当前在线: {len(self.active_connections)}")
        
        # 通知同一用户的其他设备有新设备上线
        if user_id is not None:
            user_device_count = self._get_user_device_count(user_id)
            await self.broadcast_system_message(
                message_type="device_online",
                data={
                    "device_id": device_id,
                    "device_name": device_name,
                    "online_count": user_device_count
                },
                exclude_device=device_id,
                user_id=user_id
            )
    
    def disconnect(self, device_id: str):
        """
        断开设备连接
        
        Args:
            device_id: 设备唯一标识
        """
        if device_id in self.active_connections:
            del self.active_connections[device_id]
        
        device_name = None
        if device_id in self.device_info:
            device_name = self.device_info[device_id].get("device_name")
            del self.device_info[device_id]
        
        logger.info(f"设备已断开: {device_id} ({device_name}), 当前在线: {len(self.active_connections)}")
    
    async def send_personal_message(self, message: dict, device_id: str):
        """
        发送消息给指定设备
        
        Args:
            message: 消息内容
            device_id: 目标设备ID
        """
        if device_id in self.active_connections:
            websocket = self.active_connections[device_id]
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"发送消息失败 ({device_id}): {e}")
                self.disconnect(device_id)
    
    async def broadcast(self, message: dict, exclude_device: str = None, user_id: int = None):
        """
        广播消息给指定用户的所有设备（可排除指定设备）
        
        Args:
            message: 消息内容
            exclude_device: 要排除的设备ID（通常是发送者）
            user_id: 用户ID，如果指定则只广播给该用户的设备
        """
        disconnected = []
        
        logger.debug(f"开始广播: 总设备数={len(self.active_connections)}, 排除设备={exclude_device}, 目标用户ID={user_id}")
        logger.debug(f"当前在线设备: {list(self.active_connections.keys())}")
        
        for device_id, websocket in self.active_connections.items():
            # 跳过排除的设备
            if device_id == exclude_device:
                logger.debug(f"跳过发送者设备: {device_id}")
                continue
            
            # 如果指定了用户ID，只发送给该用户的设备
            if user_id is not None:
                device_user_id = self.device_info.get(device_id, {}).get("user_id")
                if device_user_id != user_id:
                    logger.debug(f"跳过其他用户的设备: {device_id} (用户ID={device_user_id})")
                    continue
            
            try:
                logger.debug(f"正在发送消息到设备: {device_id}")
                await websocket.send_json(message)
                logger.debug(f"✓ 消息已发送到: {device_id}")
            except Exception as e:
                logger.error(f"广播消息失败 ({device_id}): {e}")
                disconnected.append(device_id)
        
        # 清理断开的连接
        for device_id in disconnected:
            self.disconnect(device_id)
    
    async def broadcast_clipboard(self, clipboard_data: dict, source_device_id: str, user_id: int = None):
        """
        广播剪贴板内容给同一用户的其他设备
        
        Args:
            clipboard_data: 剪贴板数据
            source_device_id: 源设备ID
            user_id: 用户ID（只广播给该用户的设备）
        """
        message = {
            "type": "clipboard_sync",
            "data": clipboard_data,
            "source_device_id": source_device_id,
            "timestamp": datetime.now().isoformat()
        }
        
        await self.broadcast(message, exclude_device=source_device_id, user_id=user_id)
        
        # 计算实际发送的设备数
        target_count = self._get_user_device_count(user_id) - 1 if user_id else len(self.active_connections) - 1
        logger.info(f"剪贴板同步: {source_device_id} (用户ID={user_id}) -> {target_count} 个设备")
    
    async def broadcast_system_message(self, message_type: str, data: dict, exclude_device: str = None, user_id: int = None):
        """
        广播系统消息给指定用户的设备
        
        Args:
            message_type: 消息类型
            data: 消息数据
            exclude_device: 要排除的设备ID
            user_id: 用户ID（只广播给该用户的设备）
        """
        message = {
            "type": message_type,
            "data": data,
            "timestamp": datetime.now().isoformat()
        }
        
        await self.broadcast(message, exclude_device=exclude_device, user_id=user_id)
    
    def get_online_devices(self, user_id: int = None) -> list:
        """
        获取在线设备列表（可按用户过滤）
        
        Args:
            user_id: 用户ID，如果指定则只返回该用户的设备
        
        Returns:
            在线设备信息列表
        """
        devices = []
        for device_id, info in self.device_info.items():
            # 如果指定了用户ID，只返回该用户的设备
            if user_id is not None and info.get("user_id") != user_id:
                continue
            
            devices.append({
                "device_id": device_id,
                "device_name": info.get("device_name"),
                "username": info.get("username"),
                "connected_at": info.get("connected_at").isoformat()
            })
        
        return devices
    
    def get_connection_count(self, user_id: int = None) -> int:
        """
        获取当前连接数（可按用户过滤）
        
        Args:
            user_id: 用户ID，如果指定则只统计该用户的设备
        
        Returns:
            连接数
        """
        if user_id is None:
            return len(self.active_connections)
        
        return self._get_user_device_count(user_id)
    
    def _get_user_device_count(self, user_id: int) -> int:
        """
        获取指定用户的设备数量

        Args:
            user_id: 用户ID

        Returns:
            该用户的设备数量
        """
        count = 0
        for info in self.device_info.values():
            if info.get("user_id") == user_id:
                count += 1
        return count

    async def push_to_queue(self, clipboard_data: dict, user_id: int, device_id: str = None):
        """
        将剪贴板数据推送到队列，用于异步广播

        Args:
            clipboard_data: 剪贴板数据
            user_id: 用户ID
            device_id: 源设备ID（可选，用于排除）
        """
        await self.clipboard_queue.put({
            "clipboard_data": clipboard_data,
            "user_id": user_id,
            "device_id": device_id,
            "timestamp": datetime.now().isoformat()
        })
        logger.debug(f"剪贴板数据已加入队列: 用户ID={user_id}, 设备ID={device_id}")

    async def _queue_consumer(self):
        """
        队列消费者，持续从队列中取出数据并广播
        """
        logger.info("剪贴板广播队列消费者已启动")

        while True:
            try:
                # 从队列中获取数据
                queue_item = await self.clipboard_queue.get()

                clipboard_data = queue_item.get("clipboard_data")
                user_id = queue_item.get("user_id")
                device_id = queue_item.get("device_id")

                logger.debug(f"从队列中取出剪贴板数据: 用户ID={user_id}, 设备ID={device_id}")

                # 广播给该用户的所有设备（排除源设备）
                await self.broadcast_clipboard(
                    clipboard_data=clipboard_data,
                    source_device_id=device_id or "http_api",
                    user_id=user_id
                )

                # 标记任务完成
                self.clipboard_queue.task_done()

            except asyncio.CancelledError:
                logger.info("剪贴板广播队列消费者已停止")
                break
            except Exception as e:
                logger.error(f"队列消费者处理错误: {e}")
                import traceback
                logger.error(traceback.format_exc())

    def start_queue_consumer(self):
        """
        启动队列消费者
        """
        if self._queue_consumer_task is None or self._queue_consumer_task.done():
            self._queue_consumer_task = asyncio.create_task(self._queue_consumer())
            logger.info("队列消费者任务已创建")

    def stop_queue_consumer(self):
        """
        停止队列消费者
        """
        if self._queue_consumer_task and not self._queue_consumer_task.done():
            self._queue_consumer_task.cancel()
            logger.info("队列消费者任务已取消")


# 全局连接管理器实例
manager = ConnectionManager()
