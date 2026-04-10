# NOVIVO Agent Planer

> Desktop app AI lên kế hoạch nội dung TikTok & Reels — Powered by Gemini 2.5 Flash

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/dotronghieucntt/NOVIVO-Agent-Planer/releases)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)](https://github.com/dotronghieucntt/NOVIVO-Agent-Planer/releases)
[![Python](https://img.shields.io/badge/python-3.11+-green.svg)](https://www.python.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## Tính năng

| Tính năng | Mô tả |
|---|---|
| 🤖 **AI Ý tưởng hàng ngày** | Tự động đề xuất 5 chủ đề video theo xu hướng thực tế |
| ✍️ **Viết kịch bản** | Kịch bản đầy đủ cho TikTok/Reels với hook, nội dung, CTA |
| 📚 **Thư viện RAG** | Tìm kiếm thông minh (bigram, title boost, chuẩn hóa tiếng Việt) |
| 📋 **Kanban Board** | Quản lý nội dung theo trạng thái: Ý tưởng → Đang tạo AI → Hoàn thiện → Đã đăng |
| 🎨 **AI Video Tools** | Hỗ trợ HeyGen, ElevenLabs, Midjourney, CapCut AI, Runway, Pika |
| 🌐 **Tìm kiếm web** | Tích hợp Tavily search để nắm xu hướng real-time |
| 💾 **Lưu & quản lý** | Thêm / sửa / xóa ý tưởng, lưu lịch sử toàn bộ |

---

## Kiến trúc

```
frontend/   — React 18 + Vite + Tailwind CSS + Electron (→ .exe)
backend/    — Python FastAPI + Gemini AI + ChromaDB (RAG) + SQLite
```

---

## Cài đặt & Chạy (Development)

### 1. Backend

```bash
cd backend

# Tạo môi trường ảo
python -m venv venv
venv\Scripts\activate

# Cài dependencies
pip install -r requirements.txt

# Cấu hình API keys
copy .env.example .env
# Mở .env và điền GEMINI_API_KEY, TAVILY_API_KEY
```

### 2. Frontend

```bash
cd frontend
npm install
```

### 3. Chạy app

```batch
# Windows — double-click hoặc:
run.bat
```

---

## Build & Release

### Yêu cầu

- Python 3.11+, Node.js 20+
- Điền `.env` tại root với `GITHUB_TOKEN`, `GITHUB_USERNAME`, `GITHUB_REPO`

### Tăng phiên bản

```bash
python scripts/bump_version.py patch   # 1.0.0 → 1.0.1
python scripts/bump_version.py minor   # 1.0.0 → 1.1.0
python scripts/bump_version.py major   # 1.0.0 → 2.0.0
```

### Build toàn bộ + Upload release

```batch
scripts\build_all.bat
```

Pipeline tự động:
1. Build Python backend → PyInstaller (`dist-backend/`)
2. Build Electron app → NSIS installer + portable zip (`frontend/dist-electron/`)
3. Tạo bản Full ZIP chứa toàn bộ (`dist/NOVIVO-Agent-Planer-Full-vX.Y.Z.zip`)
4. Upload lên GitHub Releases

### Sản phẩm build

| File | Mô tả |
|---|---|
| `NOVIVO Agent Planer Setup X.Y.Z.exe` | Bản cập nhật — NSIS installer |
| `NOVIVO Agent Planer X.Y.Z.zip` | Bản portable Electron |
| `NOVIVO-Agent-Planer-Full-vX.Y.Z.zip` | **Bản full** — gồm cả backend & frontend |

---

## Cấu trúc dự án

```
├── backend/
│   ├── main.py                    # FastAPI entry point (port 8001)
│   ├── services/
│   │   ├── agent_service.py       # Gemini AI agent + tools
│   │   ├── rag_service.py         # RAG với bigram + title boost
│   │   ├── gemini_service.py      # Gemini API wrapper
│   │   └── web_search_service.py  # Tavily search
│   ├── routers/                   # API endpoints
│   ├── models/                    # SQLAlchemy models
│   ├── novivo_backend.spec        # PyInstaller build spec
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/            # React components
│   │   ├── pages/                 # App pages
│   │   └── lib/api.js             # API client
│   ├── electron/main.cjs          # Electron main process
│   └── package.json
├── scripts/
│   ├── build_all.bat              # Full build pipeline
│   ├── upload_release.py          # GitHub release uploader
│   └── bump_version.py            # Version manager
├── version.json                   # Version tracking
└── run.bat                        # Development launcher
```

---

## API Keys cần thiết

| Key | Lấy tại |
|---|---|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `TAVILY_API_KEY` | [Tavily](https://app.tavily.com/) *(tùy chọn)* |

---

## License

MIT © [NOVIVO](https://github.com/dotronghieucntt)


---

## Kiến trúc

```
frontend/   — React + Vite + Tailwind CSS + Electron (→ .exe)
backend/    — Python FastAPI + Gemini + ChromaDB (RAG) + SQLite
```

---

## Cài đặt & Chạy

### 1. Backend (Python)

```bash
cd backend

# Tạo môi trường ảo
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

# Cài dependencies
pip install -r requirements.txt

# Cấu hình API keys
copy .env.example .env
# Mở .env và điền GEMINI_API_KEY, TAVILY_API_KEY

# Chạy server
python main.py
# Server chạy tại http://127.0.0.1:8000
```

### 2. Frontend (React)

```bash
cd frontend
npm install

# Chế độ dev (browser)
npm run dev
# Mở http://localhost:5173

# Chế độ Electron (desktop window)
npm run electron:dev
```

### 3. Đóng gói thành .exe

```bash
cd frontend
npm run electron:build
# Output: dist-electron/AI Content Planner Setup.exe
```

---

## Tính năng

| Tính năng | Mô tả |
|-----------|-------|
| 🎯 **Lên kế hoạch** | AI tụ động tạo 2-3 ý tưởng video không trùng lặp (kiểm tra 30 ngày gần nhất) |
| 🔍 **Tìm Trend** | Tích hợp Tavily API để tìm xu hướng trending trên internet |
| 🧠 **RAG Filter** | Mọi nội dung đi qua màng lọc Knowledge Base của công ty (ChromaDB) |
| ✍️ **Kịch bản chi tiết** | Sinh ra kịch bản quay phim theo từng cảnh (hành động, lời thoại, âm thanh) |
| 💬 **Chat AI** | Giao diện chat streaming như ChatGPT để brainstorm tự do |
| 📋 **Kanban Board** | Kéo thả trạng thái video: Ý tưởng → Đang quay → Đã dựng → Đã đăng |
| 🌙 **Dark/Light Mode** | Hỗ trợ chuyển đổi theme |
| 🔑 **Phân quyền** | Admin (full access) / Staff (chỉ tạo nội dung) |

---

## Cấu hình API Keys

Lấy tại:
- **Gemini API Key**: https://aistudio.google.com/app/apikey
- **Tavily API Key**: https://tavily.com (tùy chọn, dùng cho web search)

---

## Tài khoản mặc định

```
Username: admin
Password: Admin@123
```
> ⚠️ **Hãy đổi mật khẩu ngay sau khi đăng nhập lần đầu!**

---

## Thêm kiến thức công ty vào AI

Vào **Admin** → **Kiến thức AI** → Thêm tài liệu:
- `brand_voice`: Giọng nói thương hiệu, phong cách giao tiếp
- `product`: Mô tả sản phẩm/dịch vụ
- `regulation`: Quy định nội dung không được vi phạm

AI sẽ tự động tham chiếu các tài liệu này khi tạo nội dung.
