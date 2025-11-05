"""
文件上传和下载 API
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Request
from fastapi.responses import FileResponse, StreamingResponse
from pathlib import Path
import uuid
import shutil
from loguru import logger
from typing import Optional
import mimetypes
import os
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.db_models import User as DBUser, ClipboardHistory
from app.core.security import get_current_active_user, get_current_user_flexible
from app.core.database import get_db
from app.config import settings

router = APIRouter()

# 文件存储目录（从配置读取）
UPLOAD_DIR = Path(settings.UPLOAD_DIR)


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    device_id: Optional[str] = None,
    current_user: DBUser = Depends(get_current_active_user)
):
    """
    上传文件（图片或其他文件）
    
    Args:
        file: 上传的文件
        device_id: 设备ID
    
    Returns:
        文件信息和访问URL
    """
    try:
        # 生成唯一文件名
        file_ext = Path(file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = UPLOAD_DIR / unique_filename
        
        # 保存文件
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 获取文件大小
        file_size = file_path.stat().st_size
        
        # 获取 MIME 类型
        mime_type = file.content_type or mimetypes.guess_type(file.filename)[0] or "application/octet-stream"
        
        logger.info(f"文件上传成功: {file.filename} -> {unique_filename} ({file_size} bytes)")
        
        return {
            "success": True,
            "data": {
                "file_id": unique_filename,
                "file_name": file.filename,
                "file_size": file_size,
                "mime_type": mime_type,
                "file_url": f"/api/v1/files/download/{unique_filename}",
                "content_type": "image" if mime_type.startswith("image/") else "file"
            }
        }
    
    except Exception as e:
        logger.error(f"文件上传失败: {e}")
        raise HTTPException(status_code=500, detail=f"文件上传失败: {str(e)}")


@router.get("/download/{file_id}")
async def download_file(
    file_id: str,
    request: Request,
    download: bool = False,
    current_user: DBUser = Depends(get_current_user_flexible),
    session: AsyncSession = Depends(get_db)
):
    """
    下载文件 - 支持流式传输和 Range 请求
    支持 Header 和 URL 参数两种认证方式（必须认证）

    Args:
        file_id: 文件ID（唯一文件名）
        request: HTTP 请求对象
        download: 是否强制下载（添加 Content-Disposition: attachment）
        current_user: 当前用户（必须认证）
        session: 数据库会话

    Returns:
        文件内容（支持部分内容下载）

    注意：
        - 支持 Authorization Header: Bearer <token>
        - 支持 URL 参数: ?token=<token>
        - 支持 ?download=true 强制下载
        - 必须提供有效的认证凭据
        - 下载时使用原始文件名
    """
    try:
        file_path = UPLOAD_DIR / file_id

        if not file_path.exists():
            raise HTTPException(status_code=404, detail="文件不存在")

        # 获取 MIME 类型
        mime_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"

        # 获取文件大小
        file_size = os.path.getsize(file_path)

        # 尝试从数据库获取原始文件名
        original_filename = file_id  # 默认使用 UUID
        if download:
            try:
                # 查询包含此文件的剪贴板记录
                result = await session.execute(
                    select(ClipboardHistory)
                    .where(ClipboardHistory.content.like(f"%{file_id}%"))
                    .where(ClipboardHistory.user_id == current_user.id)
                    .order_by(ClipboardHistory.created_at.desc())
                    .limit(1)
                )
                clipboard_item = result.scalar_one_or_none()
                logger.info(clipboard_item.content)
                if clipboard_item and clipboard_item.file_name:
                    original_filename = clipboard_item.file_name
                    logger.info(f"找到原始文件名: {original_filename}")
            except Exception as e:
                logger.exception(e)
                logger.warning(f"获取原始文件名失败，使用 UUID: {e}")

        # 检查是否为媒体文件（需要流式传输）
        is_media = mime_type.startswith(('video/', 'audio/'))

        # 获取 Range 请求头
        range_header = request.headers.get("range")
        logger.info(f"文件类型: {mime_type}, 是否为媒体文件: {is_media}, Range 请求头: {range_header}, 强制下载: {download}, 文件名: {original_filename}")

        # 如果是媒体文件且有 Range 请求，使用流式传输
        if is_media and range_header and not download:
            return await stream_file_with_range(file_path, file_size, mime_type, range_header)

        # 如果是媒体文件但没有 Range 请求，仍然支持 Range（除非强制下载）
        if is_media and not download:
            # 返回支持 Range 的响应
            def file_iterator():
                with open(file_path, "rb") as f:
                    chunk_size = 1024 * 1024  # 200KB chunks
                    while True:
                        chunk = f.read(chunk_size)
                        if not chunk:
                            break
                        yield chunk

            headers = {
                "Accept-Ranges": "bytes",
                "Content-Length": str(file_size),
                "Content-Type": mime_type,
            }

            return StreamingResponse(
                file_iterator(),
                headers=headers,
                media_type=mime_type
            )

        # 非媒体文件或强制下载：使用 FileResponse
        # 对文件名进行 URL 编码以支持中文等特殊字符
        from urllib.parse import quote
        encoded_filename = quote(original_filename)

        # 构建 Content-Disposition（同时支持 ASCII 和 UTF-8）
        if download:
            # 强制下载模式
            content_disposition = f'attachment; filename="{original_filename}"; filename*=UTF-8\'\'{encoded_filename}'
        else:
            # 内联显示模式（浏览器决定如何处理）
            content_disposition = f'inline; filename="{original_filename}"; filename*=UTF-8\'\'{encoded_filename}'

        return FileResponse(
            path=file_path,
            media_type=mime_type,
            filename=original_filename,
            headers={"Content-Disposition": content_disposition}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"文件下载失败: {e}")
        raise HTTPException(status_code=500, detail=f"文件下载失败: {str(e)}")


async def stream_file_with_range(file_path: Path, file_size: int, mime_type: str, range_header: str):
    """
    处理 Range 请求，返回部分文件内容

    Args:
        file_path: 文件路径
        file_size: 文件大小
        mime_type: MIME 类型
        range_header: Range 请求头值 (例如: "bytes=0-1023")

    Returns:
        StreamingResponse with 206 status
    """
    try:
        # 解析 Range 头
        # 格式: "bytes=start-end" 或 "bytes=start-"
        range_match = range_header.replace("bytes=", "").split("-")
        start = int(range_match[0]) if range_match[0] else 0
        end = int(range_match[1]) if range_match[1] else file_size - 1

        # 确保范围有效
        start = max(0, start)
        end = min(end, file_size - 1)
        content_length = end - start + 1
        logger.info(f"Range: {start}-{end}/{file_size}, Content-Length: {content_length}")

        # 创建文件流生成器
        def range_file_iterator():
            with open(file_path, "rb") as f:
                f.seek(start)
                remaining = content_length
                chunk_size = 1024 * 1024  # 1MB chunks

                while remaining > 0:
                    chunk = f.read(min(chunk_size, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        # 构建响应头
        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": mime_type,
        }

        logger.info(f"流式传输文件: {file_path.name}, Range: {start}-{end}/{file_size}")

        return StreamingResponse(
            range_file_iterator(),
            status_code=206,  # 206 Partial Content
            headers=headers,
            media_type=mime_type
        )

    except Exception as e:
        logger.error(f"Range 请求处理失败: {e}")
        raise HTTPException(status_code=416, detail="Range Not Satisfiable")


@router.delete("/delete/{file_id}")
async def delete_file(
    file_id: str,
    current_user: DBUser = Depends(get_current_active_user)
):
    """
    删除文件
    
    Args:
        file_id: 文件ID
    
    Returns:
        删除结果
    """
    try:
        file_path = UPLOAD_DIR / file_id
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="文件不存在")
        
        file_path.unlink()
        logger.info(f"文件删除成功: {file_id}")
        
        return {
            "success": True,
            "message": "文件删除成功"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"文件删除失败: {e}")
        raise HTTPException(status_code=500, detail=f"文件删除失败: {str(e)}")


@router.get("/info/{file_id}")
async def get_file_info(
    file_id: str,
    current_user: DBUser = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_db)
):
    """
    获取文件信息

    Args:
        file_id: 文件ID
        current_user: 当前用户（必须认证）
        session: 数据库会话

    Returns:
        文件信息（包含原始文件名）
    """
    try:
        file_path = UPLOAD_DIR / file_id

        if not file_path.exists():
            raise HTTPException(status_code=404, detail="文件不存在")

        file_stat = file_path.stat()
        mime_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"

        # 尝试从数据库获取原始文件名
        original_filename = file_id
        try:
            result = await session.execute(
                select(ClipboardHistory)
                .where(ClipboardHistory.content.like(f"%{file_id}%"))
                .where(ClipboardHistory.user_id == current_user.id)
                .order_by(ClipboardHistory.created_at.desc())
                .limit(1)
            )
            clipboard_item = result.scalar_one_or_none()

            if clipboard_item and clipboard_item.file_name:
                original_filename = clipboard_item.file_name
        except Exception as e:
            logger.warning(f"获取原始文件名失败: {e}")

        return {
            "success": True,
            "data": {
                "file_id": file_id,
                "file_name": original_filename,
                "file_size": file_stat.st_size,
                "mime_type": mime_type,
                "created_at": file_stat.st_ctime,
                "content_type": "image" if mime_type.startswith("image/") else "file"
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取文件信息失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取文件信息失败: {str(e)}")
