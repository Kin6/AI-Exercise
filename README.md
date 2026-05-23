# AI Fitness Coach

实时 AI 健身教练 MVP：使用摄像头识别人体姿态，对深蹲、俯卧撑、弯举进行计数、评分和动作纠错。

## 功能

- Web 摄像头实时视频流
- MediaPipe Pose 33 个身体关键点检测
- 深蹲 / 俯卧撑 / 弯举动作计数
- 动作标准度评分
- 实时中文反馈，视频画面内支持中文显示
- 左上角动画纠正卡片：回放上一动作从错误末端位姿到标准末端位姿的修正过程
- 每次动作的扣分原因与加分/保分原因
- 训练报告统计
- 浏览器摄像头低延迟模式：480×360 / 15fps，轻量 MediaPipe 推理
- Windows 本机摄像头模式：优先尝试 USB/外接摄像头，3 秒后回退 Camera 0
- 中文面板与纠错卡片使用缓存渲染，减少每帧绘制开销
- 外挂动作标准知识库：`knowledge/exercise_standards.json` 统一管理成功阈值、关键错误、扣分和保分规则
- 空格键开始训练回合：3 秒倒计时后进入限时专家评判
- 积分、评级、身体部位训练记录与月度日历

## 本地运行

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
streamlit run app.py
```

浏览器打开 Streamlit 给出的地址，允许摄像头权限。

## Docker 运行

```bash
docker build -t ai-fitness-coach .
docker run --rm -p 8501:8501 ai-fitness-coach
```

## 目录结构

```text
ai-fitness-coach/
├── app.py
├── pose_utils.py
├── feedback.py
├── scoring.py
├── exercises/
│   ├── base.py
│   ├── squat.py
│   ├── pushup.py
│   └── bicep_curl.py
├── requirements.txt
├── packages.txt
├── Dockerfile
└── README.md
```
