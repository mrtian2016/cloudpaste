# CloudPaste - 云剪贴板

一个现代化的剪贴板历史同步应用,支持跨设备同步、搜索和管理剪贴板内容。

## 项目架构

```
cloudpaste/
├── frontend/          # Next.js 16 前端应用
├── backend/           # FastAPI 后端服务
├── CLAUDE.md          # 开发指南
├── package.json       # 根目录脚本
└── README.md          # 本文件
```

## 技术栈

### 前端
- **框架**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS 4
- **语言**: TypeScript 5
- **字体**: Geist Sans & Geist Mono

### 后端
- **框架**: FastAPI 0.119.1
- **数据库**: SQLite (aiosqlite)
- **日志**: Loguru
- **服务器**: Uvicorn
- **Python**: 3.12

## 快速开始

### 环境准备

1. **安装 Node.js** (前端需要)
   - 推荐版本: Node.js 18+

2. **创建 Conda 环境** (后端需要)
   ```bash
   mamba create -n cloudpaste python=3.12
   conda activate cloudpaste
   ```

3. **安装后端依赖**
   ```bash
   cd backend
   mamba install loguru fastapi aiosqlite pydantic-settings -y
   ```

4. **安装前端依赖**
   ```bash
   cd frontend
   npm install
   ```

### 启动服务

#### 启动后端 (端口 8000)

```bash
cd backend
conda activate cloudpaste
python main.py
```

访问:
- API 服务: http://localhost:8000
- API 文档: http://localhost:8000/docs

#### 启动前端 (端口 3000)

```bash
cd frontend
npm run dev
```

访问: http://localhost:3000

## 功能特性

### 已实现
- ✅ 后端 API 框架搭建
- ✅ 数据库设计和初始化
- ✅ 剪贴板历史 CRUD 操作
- ✅ 设备管理功能
- ✅ 分页、搜索和筛选
- ✅ 日志系统配置
- ✅ API 文档自动生成

### 待开发
- ⏳ 前端用户界面
- ⏳ 前后端集成
- ⏳ 实时同步功能
- ⏳ 用户认证
- ⏳ 数据加密
- ⏳ 图片和文件支持
- ⏳ 跨设备推送通知

## API 端点

### 剪贴板管理
- `POST /api/v1/clipboard/` - 添加剪贴板项
- `GET /api/v1/clipboard/` - 获取列表 (支持分页、筛选、搜索)
- `GET /api/v1/clipboard/{id}` - 获取详情
- `PUT /api/v1/clipboard/{id}` - 更新
- `DELETE /api/v1/clipboard/{id}` - 删除
- `DELETE /api/v1/clipboard/` - 批量删除

### 设备管理
- `POST /api/v1/devices/` - 注册设备
- `GET /api/v1/devices/` - 获取设备列表
- `GET /api/v1/devices/{id}` - 获取设备详情
- `DELETE /api/v1/devices/{id}` - 删除设备

## 开发指南

详细的开发指南请查看 [CLAUDE.md](./CLAUDE.md)

### 前端开发
```bash
cd frontend
npm run dev        # 启动开发服务器
npm run build      # 构建生产版本
npm run lint       # 代码检查
```

### 后端开发
```bash
cd backend
conda activate cloudpaste
python main.py                              # 启动服务器
uvicorn main:app --reload                   # 带热重载
./test_server.sh                            # 测试服务器
```

## 项目结构

### 前端结构
```
frontend/
├── app/
│   ├── layout.tsx         # 根布局
│   ├── page.tsx           # 首页
│   └── globals.css        # 全局样式
├── public/                # 静态资源
└── package.json           # 依赖配置
```

### 后端结构
```
backend/
├── main.py                # 主应用
├── config.py              # 配置管理
├── database.py            # 数据库
├── models.py              # 数据模型
├── logger_config.py       # 日志配置
├── routers/               # API 路由
│   ├── clipboard.py       # 剪贴板 API
│   └── devices.py         # 设备 API
├── data/                  # 数据库文件
└── logs/                  # 日志文件
```

## 配置说明

### 后端配置 (backend/.env)
```bash
HOST=0.0.0.0
PORT=8000
DEBUG=True
DATABASE_PATH=./data/clipboard.db
LOG_LEVEL=INFO
LOG_PATH=./logs
```

## 数据库设计

### clipboard_history 表
- 剪贴板内容、类型、设备信息
- 创建时间、同步状态、收藏标记
- 支持标签分类

### devices 表
- 设备唯一标识、名称、类型
- 最后同步时间、注册时间

## 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

MIT License

## 联系方式

如有问题或建议,请提交 Issue。
