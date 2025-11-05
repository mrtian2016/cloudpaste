FROM docker.1ms.run/library/python:3.12.7-slim

# 设置时区
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 换清华源
RUN sed -i 's/deb.debian.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apt/sources.list.d/debian.sources && \
    sed -i 's|security.debian.org/debian-security|mirrors.tuna.tsinghua.edu.cn/debian-security|g' /etc/apt/sources.list.d/debian.sources

# 安装系统依赖（编译 cryptography 和 bcrypt 需要）
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    nginx \
    supervisor \
    tzdata \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

# 先复制 requirements.txt 并安装依赖（优化构建缓存）
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt

# 复制后端代码
COPY backend .

# 复制前端文件
COPY frontend/out /app/frontend

# 配置 Nginx 虚拟主机
# 创建必要的目录
RUN mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled /etc/nginx/conf.d

# 复制 Nginx 配置文件
COPY docker/config/cloudpaste-maps.conf /etc/nginx/conf.d/cloudpaste-maps.conf
COPY docker/config/cloudpaste.conf /etc/nginx/sites-available/cloudpaste.conf

# 配置 Nginx：删除默认配置、启用 cloudpaste 配置、确保包含必要的 include 指令
RUN rm -f /etc/nginx/sites-enabled/default && \
    ln -s /etc/nginx/sites-available/cloudpaste.conf /etc/nginx/sites-enabled/cloudpaste.conf && \
    (grep -q "include /etc/nginx/conf.d" /etc/nginx/nginx.conf || \
     sed -i '/http {/a \    include /etc/nginx/conf.d/*.conf;' /etc/nginx/nginx.conf) && \
    (grep -q "include /etc/nginx/sites-enabled" /etc/nginx/nginx.conf || \
     sed -i '/http {/a \    include /etc/nginx/sites-enabled/*;' /etc/nginx/nginx.conf)

# 复制 supervisor 配置
COPY docker/config/supervisord.conf /etc/supervisord.conf

# 复制启动脚本并设置执行权限
COPY docker/scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 健康检查（使用 nginx 提供的 /health 端点）
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:5280/health || exit 1

# 暴露端口
EXPOSE 5280

# 使用 entrypoint.sh 作为启动脚本
CMD ["/entrypoint.sh"]
