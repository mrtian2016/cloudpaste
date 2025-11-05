# CloudPaste - Cloud Clipboard

<div align="center">

English | [简体中文](./README.md)

A powerful cross-platform clipboard synchronization tool that seamlessly transfers your copied content across multiple devices.

**Self-Hosted • Data Sovereignty • Security & Control**

[Features](#-core-features) • [Use Cases](#-use-cases) • [Quick Start](#-quick-start) • [Platform Support](#-platform-support)

</div>

---

## ⚠️ Important Notes

### 🏗️ This is a Self-Hosted Application!

CloudPaste requires you to deploy your own backend service (supports one-click Docker deployment).

- 📦 Docker Image: `ghcr.io/mrtian2016/cloudpaste:latest`
- 🔧 Based on FastAPI + WebSocket
- 💾 Data stored on your own server

[👉 View Quick Deployment Guide](#-quick-start)

### 📌 Tool Positioning

CloudPaste is a **cross-device cloud sync tool**, not a local clipboard manager:

- ✅ **Primary Use**: Real-time clipboard syncing across multiple devices
- ✅ **Best For**: Multi-device workflows (phone, computer, tablet, etc.)
- ❌ **Not**: Local clipboard history manager (like Ditto, CopyQ, etc.)

If you only need clipboard history management on a single computer, consider using dedicated local clipboard tools.
If you need seamless copy-paste sync across multiple devices, CloudPaste is the perfect choice.

---

## 🔐 Why Self-Hosted?

CloudPaste adopts a **self-hosted backend service** architecture instead of traditional cloud services:

- **🔒 Data Privacy** - All clipboard data stored on your own server, fully under your control
- **🚀 Performance Control** - No worries about third-party service throttling or instability
- **💰 Cost Transparency** - Use your own server, no subscription fees
- **🛠️ Full Customization** - Modify and extend features according to your needs
- **🌍 Intranet Deployment** - Supports deployment in private networks without internet access

### How It Works

```
┌─────────────┐                  ┌─────────────────┐                  ┌─────────────┐
│Desktop/Web  │ ◄──WebSocket──► │ Your Backend    │ ◄──WebSocket──► │Desktop/Web  │
│ (Device A)  │                  │  (Self-hosted)  │                  │ (Device B)  │
└─────────────┘                  └─────────────────┘                  └─────────────┘
      ▲                                   │                                   ▲
      │                                   │ Storage                           │
      └──────────── Real-time Sync ──────┼──────── Real-time Sync ──────────┘
                                          ▼
                                   ┌──────────┐
                                   │  SQLite  │
                                   │ Database │
                                   └──────────┘
```

The backend service uses **WebSocket** for real-time bidirectional communication. When any device copies content, it's instantly pushed to all online devices.

---

## 📸 Preview

<div align="center">

![Desktop Application](./screens/desktop-app-screenshot.png)

*Desktop Application - Clean and intuitive clipboard history management interface*

</div>

---

## ✨ Core Features

### 📋 Multi-Format Content Support

- **Text Content** - Supports plain text, code snippets, HTML content, and various text formats
- **Image Files** - Cloud storage and sync for common image formats like PNG, JPG, GIF
- **Various Files** - Supports uploading and syncing any file type (documents, audio/video, archives, etc.)
- **Smart Preview** - Automatically recognizes content types for optimal preview experience

### 🔄 Real-Time Sync

- **Instant Push** - Using WebSocket technology, copied content syncs immediately to all devices
- **Multi-Device Online** - Real-time device online status display, selective sync to specific devices
- **History** - All clipboard content automatically saved, view and restore anytime
- **Conflict Resolution** - Intelligently handles simultaneous operations from multiple devices

### 🔍 Powerful Search

- **Full-Text Search** - Quickly search clipboard history
- **Type Filtering** - Filter by text, image, or file type
- **Device Filtering** - View copy records from specific devices
- **Favorites** - Bookmark important content, support favorites-only view

### 💻 Cross-Platform Experience

- **Desktop Application** - Lightweight native app built with Tauri
  - System tray resident for quick access
  - Automatic system clipboard monitoring
  - Native file operation support
  - Auto-start on boot (optional)
  - In-app auto-update

- **Web Version** - No installation required, use in browser
  - Responsive design for all screen sizes
  - Mobile device support
  - PWA support (Progressive Web App)

### 🎨 Modern Interface

- **Dark Mode** - Automatically adapts to system theme
- **Intuitive Interaction** - Clean and clear operation interface
- **Quick Operations** - One-click copy, favorite, delete
- **Batch Management** - Multi-select and batch delete support
- **Content Preview** - Click to preview full content
  - Image preview (with zoom)
  - Code syntax highlighting
  - Audio/video playback
  - Text file viewer

### 🔒 Security & Reliability

- **User Authentication** - Access data only after login
- **Device Management** - View and manage all logged-in devices
- **Data Isolation** - Each user's data completely independent
- **Quota Management** - Configurable history limit

### ⚡ Convenient Features

- **Smart Recognition** - Automatically recognizes and formats code snippets
- **One-Click Download** - Quickly download images and files locally
- **Tag Management** - Add tags to categorize clipboard content
- **Paginated Browsing** - Efficiently load large history
- **Device Info** - Shows source device and timestamp for each record

---

## 🎯 Use Cases

### 👨‍💻 Developers

- Copy code snippets on your phone, immediately use in IDE on computer
- Quickly transfer API tokens, URLs during cross-device debugging
- Save commonly used code templates and config snippets

### ✍️ Content Creators

- Sync text and creative ideas across devices
- Collect and organize various material links
- Quickly share images and media files

### 📱 Daily Use

- Copy address on phone, use directly on computer
- Transfer temporary files across devices
- Cloud backup of important information

### 👥 Team Collaboration

- Quickly share temporary info with team members
- Unified management of team text templates
- Cross-device collaborative work

---

## 🚀 Quick Start

> **Important Note**: CloudPaste is a self-hosted application. You need to deploy the backend service first, then connect clients (desktop or web) to your server. This ensures your clipboard data is completely under your control, more secure and reliable.

### Step 1: Deploy Backend Service

Backend service based on FastAPI + WebSocket, provides real-time sync capability.

#### Method 1: Docker Deployment (Recommended)

This is the simplest and fastest deployment method:

```bash
# Pull and run image
docker run -d \
  --name cloudpaste \
  --restart unless-stopped \
  -p 5280:5280 \
  -v ./data:/cloudpaste \
  ghcr.io/mrtian2016/cloudpaste:latest
```

**Parameter Description:**
- `-p 5280:5280` - Port mapping (default port 5280, can be changed, e.g., `-p 8000:5280`)
- `-v ./data:/cloudpaste` - Persist all data (database + uploaded files) to data folder in current directory
- `--restart unless-stopped` - Container auto-restart

**Custom Port Example:**
```bash
# Use port 8000
docker run -d \
  --name cloudpaste \
  --restart unless-stopped \
  -p 8000:5280 \
  -v ./data:/cloudpaste \
  ghcr.io/mrtian2016/cloudpaste:latest
```

After startup, visit `http://your-server-ip:5280/docs` to view API documentation and confirm service is running.

#### Method 2: Docker Compose Deployment

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  cloudpaste:
    image: ghcr.io/mrtian2016/cloudpaste:latest
    container_name: cloudpaste
    restart: unless-stopped

    # Only need to map one directory!
    volumes:
      - ./data:/cloudpaste

    # Expose port
    ports:
      - "5280:5280"
```

Start service:

```bash
docker-compose up -d
```

View logs:

```bash
docker-compose logs -f
```

Stop service:

```bash
docker-compose down
```

### Step 2: Use Client

#### Method 1: Desktop Application (Recommended)

1. Go to [Releases](../../releases) to download installer for your platform
2. Install and launch app
3. **First Use**: Configure your server address on login page (e.g., `http://your-server-ip:5280`)
4. Register/Login
5. Start using! App will automatically monitor system clipboard and sync

**⚠️ macOS Users Notice**

When first opening the app, macOS may show: `"CloudPaste.app" is damaged and can't be opened. You should move it to the Trash.`

This is because the app is not verified by Apple. Follow these steps to fix:

1. Open "Terminal" app
2. Run the following command (adjust path based on actual installation location):
   ```bash
   # If installed in Applications folder
   sudo xattr -r -d com.apple.quarantine /Applications/CloudPaste.app

   # Or if in another location, replace with actual path
   sudo xattr -r -d com.apple.quarantine /path/to/CloudPaste.app
   ```
3. Enter your system password, then the app will open normally

💡 **What does this do?** The `xattr` command removes the quarantine attribute flag from macOS. This flag blocks unsigned apps downloaded from the internet. This operation only removes the restriction without modifying the app itself.

#### Method 2: Web Version

1. Deploy frontend to your server or use local development
2. Access web address
3. **First Use**: Configure server address (e.g., `http://your-server-ip:5280`)
4. Register/Login
5. Start using

### Developer Deployment

<details>
<summary>Click to expand detailed deployment steps</summary>

#### Requirements

- **Backend**: Python 3.12+
- **Frontend**: Node.js 18+
- **Desktop**: Rust (cargo)
- **Package Manager**: pnpm 9.0+

#### 1. Start Backend Service

```bash
# Create Python environment
mamba create -n cloudpaste python=3.12
conda activate cloudpaste

# Install dependencies
cd backend
mamba install loguru fastapi aiosqlite pydantic-settings -y

# Start service (default port 8000)
python main.py
```

Backend API Docs: http://localhost:8000/docs

#### 2. Start Web Frontend

```bash
# Install dependencies (in project root)
pnpm install

# Start web version (port 3000)
pnpm dev
```

Visit: http://localhost:3000

#### 3. Build Desktop App

```bash
# Development mode
pnpm dev:desktop

# Build production version
pnpm build:desktop
```

Build output in `desktop/src-tauri/target/release/`

</details>

---

## 📦 Platform Support

| Platform | Support Status | Notes |
|----------|---------------|-------|
| 🪟 Windows | ✅ Full Support | Desktop + Web |
| 🍎 macOS | ✅ Full Support | Desktop + Web |
| 🐧 Linux | ✅ Full Support | Desktop + Web |
| 📱 iOS / Android | ⚠️ Web Only | Via browser |

---

## 🏗️ Project Architecture

```
cloudpaste/
├── backend/              # FastAPI backend service
│   ├── main.py          # Application entry
│   ├── routers/         # API routes
│   ├── database.py      # Database operations
│   └── models.py        # Data models
│
├── frontend/            # Next.js web app
│   ├── app/            # Pages and routes
│   └── public/         # Static assets
│
├── desktop/            # Tauri desktop app
│   ├── app/           # Next.js UI
│   ├── src-tauri/     # Rust backend
│   └── lib/           # Tauri utilities
│
└── packages/          # Shared code
    └── shared/        # Components, hooks, state management
        ├── components/  # UI components
        ├── hooks/       # React Hooks
        ├── store/       # Zustand state management
        ├── lib/         # Utility functions
        └── types/       # TypeScript types
```

**Tech Stack**: Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 + Tauri 2 + FastAPI + SQLite

---

## 📖 Feature Details

### Desktop-Specific Features

- **System Clipboard Monitoring** - Automatically captures copy operations and syncs
- **Clipboard Writing** - Restore content from cloud to system clipboard (supports text, images, files)
- **System Tray** - Minimize to tray, quick access
- **Auto-Start** - Run silently in background
- **Native Notifications** - Receive sync notifications
- **App Updates** - Automatic update detection and installation
- **Local Cache** - Smart caching for images and files

### API Features

<details>
<summary>View all API endpoints</summary>

#### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/me` - Get current user info
- `PUT /api/v1/auth/me` - Update user info
- `GET /api/v1/auth/settings` - Get user settings
- `PUT /api/v1/auth/settings` - Update user settings

#### Clipboard Management
- `POST /api/v1/clipboard/` - Add clipboard item
- `GET /api/v1/clipboard/` - Get list (supports pagination, search, filtering)
- `GET /api/v1/clipboard/{id}` - Get details
- `PUT /api/v1/clipboard/{id}` - Update (favorite, etc.)
- `DELETE /api/v1/clipboard/{id}` - Delete
- `DELETE /api/v1/clipboard/` - Batch delete

#### Device Management
- `POST /api/v1/devices/` - Register device
- `GET /api/v1/devices/` - Get device list
- `GET /api/v1/devices/{id}` - Get device details
- `DELETE /api/v1/devices/{id}` - Delete device

#### File Management
- `POST /api/v1/files/upload` - Upload file
- `GET /api/v1/files/download/{file_id}` - Download file
- `GET /api/v1/files/info/{file_id}` - Get file info
- `DELETE /api/v1/files/delete/{file_id}` - Delete file

#### WebSocket
- `WS /api/v1/ws` - Real-time sync channel

</details>

---

## ⚙️ Configuration

### Backend Configuration

#### Docker Data Persistence

Docker image stores all data in `/cloudpaste` directory, including:
- Database file (SQLite)
- User uploaded files (images, documents, etc.)
- Log files

Only need to map one directory:
```bash
-v ./data:/cloudpaste
```

Data is saved in host's `./data` directory, won't be lost when container restarts or updates.

#### Using Reverse Proxy (Recommended)

For security and better performance, recommend using Nginx or Caddy for reverse proxy with HTTPS:

**Nginx Configuration Example:**

```nginx
server {
    listen 80;
    server_name paste.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name paste.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:5280;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

**Caddy Configuration Example (Simpler):**

```caddy
paste.yourdomain.com {
    reverse_proxy localhost:5280
}
```

Caddy automatically configures HTTPS certificates!

### Frontend Configuration

Web and desktop versions support configuring server address at login, no code modification needed.

**Configuration Examples:**
- Local development: `http://localhost:5280`
- Intranet deployment: `http://192.168.1.100:5280`
- Public deployment: `https://paste.yourdomain.com` (HTTPS recommended)

### Security Recommendations

- ✅ Use HTTPS for encrypted transmission (via reverse proxy)
- ✅ Configure firewall rules, only open necessary ports
- ✅ Regularly backup database and uploaded files
- ✅ Use strong password policy
- ✅ Intranet use doesn't need public exposure

---

## ❓ FAQ

<details>
<summary><b>Why self-hosted? Can't I just use it directly?</b></summary>

CloudPaste's design philosophy is to give users complete control of their data. Clipboard content may contain sensitive information (passwords, tokens, private text, etc.), storing them on third-party servers poses privacy risks. By self-hosting:

- Your data is only stored on your own server
- Can be deployed on intranet, completely unexposed to public network
- No worries about third-party services shutting down or charging fees
- Can customize features as needed

</details>

<details>
<summary><b>Is deploying backend service complicated?</b></summary>

Very simple! With Docker, just one command:

```bash
docker run -d -p 5280:5280 \
  -v ./data:/cloudpaste \
  ghcr.io/mrtian2016/cloudpaste:latest
```

If you have a VPS or NAS, can be deployed in 5 minutes.

</details>

<details>
<summary><b>What kind of server is needed?</b></summary>

**Minimum specs:**
- CPU: 1 core
- RAM: 512MB
- Storage: 1GB (grows with usage)

Almost any server, NAS, even Raspberry Pi can run it. Recommended:
- VPS (Alibaba Cloud, Tencent Cloud, AWS, etc.)
- Home NAS (Synology, QNAP, etc. with Docker support)
- Intranet server

</details>

<details>
<summary><b>Is data secure? Will it be lost?</b></summary>

- All data stored in SQLite database and file system
- Uses Docker Volume for persistent storage
- Recommend regularly backing up `data` and `uploads` directories
- Supports HTTPS encrypted transmission

Data is completely under your control, won't be lost due to third-party service issues.

</details>

<details>
<summary><b>Can multiple people use it?</b></summary>

Yes! CloudPaste supports multi-user:
- Each user registers independent account
- User data completely isolated
- Each user can manage multiple devices
- Suitable for teams or families sharing one backend service

</details>

<details>
<summary><b>Can I use it on mobile?</b></summary>

Yes, via web version:
- iOS/Android access through browser
- Supports PWA (Progressive Web App), can add to home screen
- Mobile can view history, search, copy content
- Automatic clipboard monitoring not supported (browser limitation)

</details>

<details>
<summary><b>How to access intranet deployment from outside?</b></summary>

Several solutions:
1. **Intranet Penetration**: Use frp, ngrok, etc.
2. **VPN**: Connect to intranet via VPN
3. **Public Server**: Deploy directly on server with public IP
4. **Intranet Only**: No external access needed, more secure

</details>

<details>
<summary><b>Which platforms are supported?</b></summary>

**Desktop App:**
- ✅ Windows 10/11
- ✅ macOS 11+
- ✅ Linux (Ubuntu, Debian, Fedora, etc.)

**Web Version:**
- ✅ All modern browsers (Chrome, Firefox, Safari, Edge)
- ✅ Mobile browsers (iOS Safari, Android Chrome)

</details>

<details>
<summary><b>Will it affect system clipboard?</b></summary>

Desktop app monitors system clipboard, but:
- Only reads, doesn't interfere with normal copy-paste
- Can disable auto-sync in settings
- Restoring from app to clipboard won't trigger duplicate sync

</details>

---

## 🤝 Contributing

Issues and Pull Requests are welcome!

---

## 📄 License

MIT License

---

## 🔗 Links

- [Issue Tracker](../../issues)
- [Feature Requests](../../issues/new)
- [Changelog](../../releases)

---

<div align="center">

**CloudPaste - Your Clipboard, Everywhere**

</div>
