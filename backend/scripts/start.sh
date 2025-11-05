#!/bin/bash

# 启动脚本
echo "启动 CloudPaste 后端服务..."



# 检查依赖
if [ ! -d "logs" ]; then
    echo "创建日志目录..."
    mkdir -p logs
fi

if [ ! -d "data" ]; then
    echo "创建数据目录..."
    mkdir -p data
fi

if [ ! -f ".env" ]; then
    echo "创建 .env 文件..."
    cp .env.example .env
fi

# 启动服务
echo "启动 FastAPI 服务器..."
~/conda/envs/cloudpaste/bin/python run.py
