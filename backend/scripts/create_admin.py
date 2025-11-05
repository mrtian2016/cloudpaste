#!/usr/bin/env python
"""
创建管理员用户
"""
import asyncio
import sys
import os
from pathlib import Path

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import db
from app.models.db_models import User
from app.core.security import get_password_hash
from sqlalchemy import select

# 从环境变量读取配置，如果不存在则使用默认值
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@example.com")
ADMIN_FULL_NAME = os.getenv("ADMIN_FULL_NAME", "系统管理员")

async def create_admin():
    """创建管理员用户"""
    try:
        # 初始化数据库
        db.init_engine()

        # 确保数据库表已创建
        print("🔄 检查数据库表...")
        await db.create_tables()
        print("✅ 数据库表检查完成")

        async with db.async_session_maker() as session:
            # 检查是否已存在管理员
            result = await session.execute(
                select(User).where(User.username == ADMIN_USERNAME)
            )
            existing_admin = result.scalar_one_or_none()

            if existing_admin:
                print("\n⚠️  管理员用户已存在")
                print(f"   用户名: {existing_admin.username}")
                print(f"   邮箱: {existing_admin.email}")
                return

            # 创建管理员
            admin = User(
                username=ADMIN_USERNAME,
                email=ADMIN_EMAIL,
                hashed_password=get_password_hash(ADMIN_PASSWORD),
                full_name=ADMIN_FULL_NAME,
                is_active=True,
                is_superuser=True
            )

            session.add(admin)
            await session.commit()

            print("\n✅ 管理员用户创建成功!")
            print(f"   用户名: {ADMIN_USERNAME}")
            print(f"   密码: {ADMIN_PASSWORD}")
            print(f"   邮箱: {ADMIN_EMAIL}")
            print(f"   全名: {ADMIN_FULL_NAME}")

            # 如果使用的是默认密码，则提示修改
            if ADMIN_PASSWORD == "admin123":
                print("\n⚠️  正在使用默认密码，请立即修改!")

            # 提示环境变量用法
            using_defaults = []
            if os.getenv("ADMIN_USERNAME") is None:
                using_defaults.append("ADMIN_USERNAME")
            if os.getenv("ADMIN_PASSWORD") is None:
                using_defaults.append("ADMIN_PASSWORD")
            if os.getenv("ADMIN_EMAIL") is None:
                using_defaults.append("ADMIN_EMAIL")
            if os.getenv("ADMIN_FULL_NAME") is None:
                using_defaults.append("ADMIN_FULL_NAME")

            if using_defaults:
                print(f"\n💡 提示: 以下配置使用了默认值: {', '.join(using_defaults)}")
                print("   可通过环境变量自定义，例如:")
                print("   export ADMIN_USERNAME=myadmin")
                print("   export ADMIN_PASSWORD=mypassword")
                print("   export ADMIN_EMAIL=admin@mydomain.com")
                print("   export ADMIN_FULL_NAME='My Admin'")

    except Exception as e:
        print(f"\n❌ 创建管理员失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        # 关闭数据库连接
        await db.close()

if __name__ == "__main__":
    asyncio.run(create_admin())
