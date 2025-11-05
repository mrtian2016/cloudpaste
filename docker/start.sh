#!/bin/bash

# CloudPaste 快速启动脚本

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}CloudPaste Docker 快速启动${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# 默认数据目录
DATA_DIR="${DATA_DIR:-./data}"

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误: Docker 未安装，请先安装 Docker${NC}"
    exit 1
fi

# 检查 docker-compose 是否安装
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
else
    echo -e "${YELLOW}警告: docker-compose 未安装，将使用 docker run${NC}"
    COMPOSE_CMD=""
fi

# 创建数据目录
if [ ! -d "$DATA_DIR" ]; then
    echo -e "${YELLOW}创建数据目录: $DATA_DIR${NC}"
    mkdir -p "$DATA_DIR"
fi

# 使用 docker-compose
if [ -n "$COMPOSE_CMD" ]; then
    echo -e "${GREEN}使用 docker-compose 启动...${NC}"
    cd "$(dirname "$0")"
    $COMPOSE_CMD up -d

    echo ""
    echo -e "${GREEN}✓ 容器启动成功！${NC}"
    echo ""
    echo -e "查看日志: ${YELLOW}$COMPOSE_CMD logs -f${NC}"
    echo -e "停止服务: ${YELLOW}$COMPOSE_CMD down${NC}"
else
    # 使用 docker run
    echo -e "${GREEN}使用 docker run 启动...${NC}"

    # 检查镜像是否存在
    if ! docker image inspect cloudpaste:latest &> /dev/null; then
        echo -e "${YELLOW}镜像不存在，开始构建...${NC}"
        cd "$(dirname "$0")/.."
        docker build -f docker/Dockerfile -t cloudpaste:latest .
    fi

    # 停止并删除旧容器
    if docker ps -a --format '{{.Names}}' | grep -q "^cloudpaste$"; then
        echo -e "${YELLOW}停止旧容器...${NC}"
        docker stop cloudpaste &> /dev/null || true
        docker rm cloudpaste &> /dev/null || true
    fi

    # 启动新容器
    docker run -d \
        -p 8910:8910 \
        -v "$(cd "$DATA_DIR" && pwd)":/cloudpaste \
        --name cloudpaste \
        --restart unless-stopped \
        cloudpaste:latest

    echo ""
    echo -e "${GREEN}✓ 容器启动成功！${NC}"
    echo ""
    echo -e "查看日志: ${YELLOW}docker logs -f cloudpaste${NC}"
    echo -e "停止服务: ${YELLOW}docker stop cloudpaste${NC}"
fi

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}服务访问地址:${NC}"
echo -e "  主页:     ${YELLOW}http://localhost:8910${NC}"
echo -e "  API 文档: ${YELLOW}http://localhost:8910/docs${NC}"
echo -e "  健康检查: ${YELLOW}http://localhost:8910/health${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "${GREEN}数据目录:${NC} ${YELLOW}$(cd "$DATA_DIR" && pwd)${NC}"
echo ""
