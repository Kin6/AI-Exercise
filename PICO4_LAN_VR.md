# Pico 4 局域网 VR 展示版

这个版本不改变现有训练主流程。电脑端仍然负责摄像头采集、FastAPI 姿态识别和动作评分，Pico 4 只作为同一局域网里的沉浸式展示屏。

## 效果

- 电脑端打开原来的训练页面，进入实时训练。
- Pico 4 浏览器打开独立展示页：`/pico-vr.html`。
- Pico 4 页面会显示最新 AI 标注画面、教学视频、AI 实时纠正、本组总结、标准次数、尝试次数、最近得分、识别耗时。
- 一组结束后，Pico 4 页面会同步显示“本组完成了多少个动作、过程怎么样”的总结。

## 网络要求

- 电脑和 Pico 4 必须连接同一个 Wi-Fi 或同一个局域网。
- 电脑需要允许局域网访问 `3002` 和 `8001` 两个端口。
- Pico 4 里不要访问 `127.0.0.1`，那会指向 Pico 4 自己。Pico 4 必须访问电脑的局域网 IP。

## 1. 查看电脑局域网 IP

在电脑 PowerShell 执行：

```powershell
ipconfig
```

找到当前 Wi-Fi 或以太网的 `IPv4 地址`，例如：

```text
192.168.1.23
```

下面命令里的 `<电脑IP>` 都替换成这个地址。

## 2. 启动 FastAPI

在电脑 PowerShell 执行：

```powershell
cd D:\HKS_ai_teaching\ai-fitness-coach
.\.venv\Scripts\python -m uvicorn api_server:app --host 0.0.0.0 --port 8001
```

注意这里必须用 `--host 0.0.0.0`，这样 Pico 4 才能从局域网访问后端。

如果提示 `8001` 被占用，可以查看占用进程：

```powershell
Get-NetTCPConnection -LocalPort 8001 | Select-Object LocalAddress,LocalPort,State,OwningProcess
```

如需停止旧进程：

```powershell
Stop-Process -Id <PID>
```

## 3. 启动前端

另开一个 PowerShell：

```powershell
cd D:\HKS_ai_teaching\ai-fitness-coach\UI
$env:PORT="3002"
$env:VITE_POSE_API_URL="http://127.0.0.1:8001"
npm run dev
```

前端服务会监听 `0.0.0.0:3002`，Pico 4 可以通过电脑 IP 访问它。

## 4. 电脑端打开主训练页面

在电脑浏览器打开：

```text
http://127.0.0.1:3002
```

然后进入：

```text
训练中心 -> 进入实时训练
```

电脑端负责摄像头权限，所以建议电脑端继续用 `127.0.0.1` 打开主页面。某些浏览器在局域网 IP 页面下会限制摄像头权限。

## 5. Pico 4 打开展示页

在 Pico 4 浏览器打开：

```text
http://<电脑IP>:3002/pico-vr.html
```

例如：

```text
http://192.168.1.23:3002/pico-vr.html
```

打开后点击右上角 `沉浸全屏`，就可以当作 Pico 4 的训练展示屏使用。

## 6. 如果后端不在同一台电脑

展示页默认会连接：

```text
http://<当前前端页面的主机IP>:8001
```

如果 FastAPI 在另一台机器，可以给展示页加 `api` 参数：

```text
http://<前端电脑IP>:3002/pico-vr.html?api=http://<后端电脑IP>:8001
```

## 7. 常见问题

### Pico 4 页面显示 Pose API 未连接

检查：

```text
http://<电脑IP>:8001/api/health
```

如果 Pico 4 浏览器也打不开这个地址，通常是电脑防火墙没有放行 `8001`，或者 FastAPI 没有用 `--host 0.0.0.0` 启动。

### Pico 4 页面一直等待训练

需要先在电脑端打开主训练页面并进入实时训练。Pico 4 展示页只读取电脑端训练会话，不会自己创建摄像头识别会话。

### 电脑端摄像头打不开

电脑端主训练页面建议打开：

```text
http://127.0.0.1:3002
```

不要用：

```text
http://<电脑IP>:3002
```

因为非 HTTPS 的局域网地址可能被浏览器限制摄像头权限。
