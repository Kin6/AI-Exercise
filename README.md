# HKS AI Teaching 项目部署说明

本项目由两部分组成：

- `UI/`：React + Vite + Express 前端。
- `ai-fitness-coach/`：Python 后端，包含 MediaPipe 姿态识别、动作评分、训练记录，以及 FastAPI 接口。

当前推荐运行方式是：

```text
浏览器前端 http://127.0.0.1:3000
        |
        | 发送摄像头帧与训练请求
        v
Pose API 后端 http://127.0.0.1:8001
```

## 1. 需要安装的环境

### 必装

1. Git
2. Node.js 20 或以上
3. Python 3.10 或 3.11
4. 一个可用摄像头

### 推荐

- Windows 11 + PowerShell
- 或 WSL2 Ubuntu

摄像头权限由浏览器管理。使用 `localhost` 或 `127.0.0.1` 打开前端时，Chrome/Edge 可以直接申请摄像头权限。

## 2. 获取代码

建议目录结构如下：

```text
D:\HKS_ai_teaching
├── UI
└── ai-fitness-coach
```

如果前端还没有拉取：

```powershell
cd D:\HKS_ai_teaching
git clone https://github.com/Lsq-cell/hks-mrqd.git UI
```

后端 `ai-fitness-coach/` 需要从项目仓库或共享文件中同步到同级目录。

## 3. 安装后端依赖

### Windows PowerShell

```powershell
cd D:\HKS_ai_teaching\ai-fitness-coach
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

后端主要依赖在 `ai-fitness-coach/requirements.txt`：

```text
streamlit
streamlit-webrtc
fastapi
uvicorn
opencv-python-headless
mediapipe
numpy
av
pillow
```

注意：`numpy` 需要保持 `<2.0.0`，`opencv-python-headless` 需要保持 `<4.12.0`，以避免 MediaPipe 兼容问题。

### WSL / Linux

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip libgl1 libglib2.0-0

cd /mnt/d/HKS_ai_teaching/ai-fitness-coach
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

如果你已经有自己的 WSL Python 环境，只要确认这些包能 import 即可：

```bash
python - <<'PY'
import fastapi, uvicorn, cv2, mediapipe, numpy
print("backend deps ok")
PY
```

## 4. 安装前端依赖

```powershell
cd D:\HKS_ai_teaching\UI
npm ci
```

如果没有 `package-lock.json`，使用：

```powershell
npm install
```

前端主要依赖包括：

```text
react
react-dom
vite
express
tsx
typescript
tailwindcss
lucide-react
motion
@google/genai
```

## 5. 配置环境变量

在前端目录创建 `.env.local`：

```powershell
cd D:\HKS_ai_teaching\UI
Copy-Item .env.example .env.local
```

至少确认下面这一项：

```text
VITE_POSE_API_URL="http://127.0.0.1:8001"
```

如果要使用 Gemini 身体状态分析接口，再填写：

```text
GEMINI_API_KEY="你的 Gemini API Key"
```

不填 `GEMINI_API_KEY` 也能运行，前端服务会使用内置兜底逻辑。

## 6. 启动项目

需要开两个终端：一个跑后端，一个跑前端。

### 终端 1：启动 Pose API 后端

Windows PowerShell：

```powershell
cd D:\HKS_ai_teaching\ai-fitness-coach
.\start_pose_api.ps1
```

等价命令：

```powershell
cd D:\HKS_ai_teaching\ai-fitness-coach
.\.venv\Scripts\Activate.ps1
python -m uvicorn api_server:app --host 127.0.0.1 --port 8001 --reload
```

WSL：

```bash
cd /mnt/d/HKS_ai_teaching/ai-fitness-coach
bash ./start_pose_api_wsl.sh
```

等价命令：

```bash
cd /mnt/d/HKS_ai_teaching/ai-fitness-coach
source .venv/bin/activate
python -m uvicorn api_server:app --host 0.0.0.0 --port 8001 --reload
```

检查后端是否启动成功：

```powershell
Invoke-RestMethod http://127.0.0.1:8001/api/health
```

或在浏览器打开：

```text
http://127.0.0.1:8001/api/health
```

### 终端 2：启动前端

```powershell
cd D:\HKS_ai_teaching\UI
npm run dev
```

浏览器打开：

```text
http://127.0.0.1:3000
```

进入“训练中心”，选择深蹲、俯卧撑或弯举，点击“进入实时训练”，浏览器允许摄像头权限即可开始识别。

## 7. 构建与检查

前端类型检查：

```powershell
cd D:\HKS_ai_teaching\UI
npm run lint
```

前端生产构建：

```powershell
cd D:\HKS_ai_teaching\UI
npm run build
```

启动生产构建：

```powershell
cd D:\HKS_ai_teaching\UI
npm run start
```

Python 语法检查：

```powershell
cd D:\HKS_ai_teaching\ai-fitness-coach
python -m py_compile api_server.py app.py pose_utils.py feedback.py scoring.py workout_store.py exercise_knowledge.py exercises\base.py exercises\squat.py exercises\pushup.py exercises\bicep_curl.py
```

## 8. 可选：旧版 Streamlit 页面

旧版单体 Streamlit 应用仍然可以运行：

```powershell
cd D:\HKS_ai_teaching\ai-fitness-coach
.\.venv\Scripts\Activate.ps1
streamlit run app.py
```

它与当前 React 前端不是同一个入口。当前主入口建议使用 React 前端 + FastAPI 后端。

## 9. 常见问题

### 前端显示 Pose API 未连接

确认后端已启动：

```powershell
Invoke-RestMethod http://127.0.0.1:8001/api/health
```

如果后端运行在其他端口或其他机器，修改 `UI/.env.local`：

```text
VITE_POSE_API_URL="http://后端地址:端口"
```

修改后重启前端。

### 摄像头没有画面

1. 确认浏览器允许摄像头权限。
2. 使用 `http://127.0.0.1:3000` 或 `http://localhost:3000` 打开前端。
3. 确认其他软件没有占用摄像头。

### WSL 后端可以启动，但 Windows 前端连不上

后端用下面方式监听：

```bash
python -m uvicorn api_server:app --host 0.0.0.0 --port 8001 --reload
```

然后 Windows 浏览器访问：

```text
http://127.0.0.1:8001/api/health
```

如果仍然无法访问，检查防火墙或 WSL 网络转发。

### MediaPipe 或 OpenCV 安装失败

优先使用 Python 3.10 或 3.11，并重新创建虚拟环境：

```powershell
cd D:\HKS_ai_teaching\ai-fitness-coach
Remove-Item -Recurse -Force .venv
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```
