import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bell,
  Brain,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  HeartPulse,
  Home,
  LineChart,
  MessageCircle,
  Pause,
  Search,
  Sparkles,
  User,
  Video,
} from "lucide-react";

type PageId =
  | "home"
  | "awareness"
  | "understanding"
  | "muscles"
  | "plan"
  | "training"
  | "observation"
  | "feedback"
  | "archive"
  | "explore"
  | "coach";

type ExerciseKey = "squat" | "pushup" | "curl";

type PoseSessionState = {
  sessionId?: string;
  exerciseLabel?: string;
  status?: "idle" | "active" | "finished" | string;
  remaining?: number;
  detected?: boolean;
  count?: number;
  attempts?: number;
  stage?: string;
  score?: number;
  message?: string;
  liveMessage?: string;
  liveErrors?: string[];
  processMs?: number;
  annotatedImage?: string;
  summary?: {
    grade?: string;
    points?: number;
    valid_reps?: number;
    attempts?: number;
    avg_score?: number;
  };
};

type CoachExercise = {
  key: ExerciseKey;
  title: string;
  text: string;
  note: string;
};

const poseApiBase =
  ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_POSE_API_URL || "http://127.0.0.1:8001").replace(
    /\/$/,
    "",
  );

const coachExercises: CoachExercise[] = [
  {
    key: "squat",
    title: "下肢力量 | 深蹲",
    text: "膝盖轨迹 / 髋部后坐 / 左右对称",
    note: "建议正面入镜，脚踝、膝盖、髋部都要可见。",
  },
  {
    key: "pushup",
    title: "上肢稳定 | 俯卧撑",
    text: "肘角幅度 / 身体直线 / 核心塌陷",
    note: "建议侧面入镜，肩、肘、腕、髋、踝保持在画面内。",
  },
  {
    key: "curl",
    title: "手臂控制 | 弯举",
    text: "肘部漂移 / 借力摆动 / 动作幅度",
    note: "建议侧面或 45 度入镜，训练手臂完整可见。",
  },
];

const flow: PageId[] = [
  "home",
  "awareness",
  "understanding",
  "muscles",
  "plan",
  "training",
  "observation",
  "feedback",
  "archive",
  "explore",
  "coach",
];

const pageMeta: Record<PageId, { index: string; title: string; hint: string }> = {
  home: { index: "01", title: "首页｜今日状态入口", hint: "从一点点身体觉察开始" },
  awareness: { index: "02", title: "身体觉察页", hint: "先听见身体正在说什么" },
  understanding: { index: "03", title: "身体理解页", hint: "把不舒服背后的链路说清楚" },
  muscles: { index: "04", title: "核心肌肉溯源页", hint: "找到肩颈代偿的源头" },
  plan: { index: "05", title: "今日恢复方案页", hint: "6 分钟，轻轻照顾肩颈" },
  training: { index: "06", title: "训练进行页", hint: "慢一点，也很好" },
  observation: { index: "07", title: "AI动作观察页", hint: "团团正在温柔观察动作" },
  feedback: { index: "08", title: "完成反馈页", hint: "记录今天这一点变化" },
  archive: { index: "09", title: "身体档案页", hint: "看见身体的长期变化" },
  explore: { index: "10", title: "身体探索页", hint: "想活动一下身体" },
  coach: { index: "11", title: "AI动作教练页", hint: "想认真训练，先保证标准" },
};

const navItems = [
  { label: "今日状态", page: "home" as PageId, icon: Home },
  { label: "身体档案", page: "archive" as PageId, icon: CalendarDays },
  { label: "成长变化", page: "feedback" as PageId, icon: LineChart },
  { label: "训练中心", page: "coach" as PageId, icon: Dumbbell },
  { label: "我的", page: "archive" as PageId, icon: User },
];

const feelings = ["酸胀", "发紧", "疲惫", "沉重", "无力", "僵硬"];
const regions = ["头颈", "肩颈", "上背", "腰背", "髋部", "大腿", "膝盖", "小腿", "足踝", "全身"];
const scenes = ["久坐后", "睡前", "低头时", "运动后", "起床后", "压力大时"];
const moves = ["颈侧轻拉伸", "肩颈呼吸放松", "下巴内收", "肩胛后缩", "过头手臂伸展"];

function Card({
  children,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  key?: React.Key;
  onClick?: () => void;
}) {
  return (
    <div className={`glass-card ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}

function Pill({ children, active = false }: { children: React.ReactNode; active?: boolean; key?: React.Key }) {
  return <button className={`pill ${active ? "is-active" : ""}`}>{children}</button>;
}

function Tuantuan() {
  return (
    <div className="tuantuan" aria-label="团团">
      <span className="tuantuan-glow" />
      <span className="fur f1" />
      <span className="fur f2" />
      <span className="fur f3" />
      <span className="tuantuan-eye left" />
      <span className="tuantuan-eye right" />
      <span className="tuantuan-blush left" />
      <span className="tuantuan-blush right" />
      <span className="tuantuan-smile" />
    </div>
  );
}

type PetMood = "tired" | "early" | "recovering" | "light" | "clear" | "free";

const petMoods: PetMood[] = ["tired", "early", "recovering", "light", "clear", "free"];

const petMoodCopy: Record<PetMood, string> = {
  tired: "Lv.0 疲惫状态",
  early: "Lv.1-2 恢复初期",
  recovering: "Lv.3-4 恢复中期",
  light: "Lv.5 轻盈状态",
  clear: "Lv.6 通透状态",
  free: "Lv.Max 自在状态",
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function getPetBounds() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  return {
    minX: Math.max(24, width * 0.12),
    maxX: Math.max(260, width * 0.43),
    minY: Math.max(230, height * 0.56),
    maxY: Math.max(360, height - 198),
  };
}

function DesktopPet() {
  const [mood, setMood] = useState<PetMood>("recovering");
  const [position, setPosition] = useState({ x: 420, y: 456 });
  const [facing, setFacing] = useState<"left" | "right">("left");
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });
  const movedDuringDrag = useRef(false);

  useEffect(() => {
    if (dragging) return;

    const timer = window.setInterval(() => {
      const bounds = getPetBounds();
      const nextX = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
      const nextY = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);

      setPosition((current) => {
        setFacing(nextX > current.x ? "right" : "left");
        return { x: nextX, y: nextY };
      });

      if (Math.random() > 0.56) {
        setMood(petMoods[Math.floor(Math.random() * petMoods.length)]);
      }
    }, 3600);

    return () => window.clearInterval(timer);
  }, [dragging]);

  useEffect(() => {
    const keepInBounds = () => {
      const bounds = getPetBounds();
      setPosition((current) => ({
        x: clamp(current.x, bounds.minX, bounds.maxX),
        y: clamp(current.y, bounds.minY, bounds.maxY),
      }));
    };

    keepInBounds();
    window.addEventListener("resize", keepInBounds);
    return () => window.removeEventListener("resize", keepInBounds);
  }, []);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      if (!dragging) return;
      if (
        Math.abs(event.clientX - dragStart.current.x) > 6 ||
        Math.abs(event.clientY - dragStart.current.y) > 6
      ) {
        movedDuringDrag.current = true;
      }
      const bounds = getPetBounds();
      setPosition({
        x: clamp(event.clientX - dragOffset.current.x, bounds.minX, bounds.maxX),
        y: clamp(event.clientY - dragOffset.current.y, bounds.minY, bounds.maxY),
      });
    };

    const handleUp = () => setDragging(false);

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [dragging]);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    movedDuringDrag.current = false;
    dragStart.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
    dragOffset.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };
  };

  const cycleMood = () => {
    if (movedDuringDrag.current) return;
    setMood((current) => petMoods[(petMoods.indexOf(current) + 1) % petMoods.length]);
  };

  return (
    <div
      className={`desktop-pet-shell ${dragging ? "is-dragging" : ""}`}
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
      aria-live="polite"
    >
      <div className="pet-speech">
        {petMoodCopy[mood]}
      </div>
      <button
        className={`desktop-pet ${mood} faces-${facing}`}
        type="button"
        onClick={cycleMood}
        onPointerDown={handlePointerDown}
        aria-label="桌面宠物，点击切换状态，拖拽移动"
        title="点击换表情，拖拽移动"
      >
        <span className="pet-loop" />
        <span className="pet-arm left" />
        <span className="pet-arm right" />
        <span className="pet-foot left" />
        <span className="pet-foot right" />
        <span className="pet-eye left" />
        <span className="pet-eye right" />
        <span className="pet-cheek left" />
        <span className="pet-cheek right" />
        <span className="pet-mouth" />
        <span className="pet-bandage" />
        <span className="pet-fuzz f1" />
        <span className="pet-fuzz f2" />
        <span className="pet-fuzz f3" />
        <span className="pet-fuzz f4" />
        <span className="pet-emote e1" />
        <span className="pet-emote e2" />
        <span className="pet-z">Z</span>
        <span className="pet-bubble b1" />
        <span className="pet-bubble b2" />
        <span className="pet-shadow" />
      </button>
    </div>
  );
}

function HumanFigure({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`human-figure ${compact ? "compact" : ""}`}>
      <div className="figure-head" />
      <div className="figure-neck hot" />
      <div className="figure-torso">
        <span className="spine" />
        <span className="shoulder-line hot" />
        <span className="core-glow" />
      </div>
      <div className="arm left hot" />
      <div className="arm right hot" />
      <div className="leg left" />
      <div className="leg right" />
    </div>
  );
}

function MiniChart() {
  return (
    <div className="mini-chart" aria-hidden="true">
      {[32, 46, 38, 62, 54, 76, 58, 84, 68, 92, 78, 88].map((height, index) => (
        <span style={{ height: `${height}%` }} key={index} />
      ))}
    </div>
  );
}

function HomePage({ go }: { go: (page: PageId) => void }) {
  return (
    <div className="page home-grid">
      <section className="hero-panel">
        <div className="hero-copy-block">
          <p className="eyebrow">Daily Light Move</p>
          <h1>晚上好，蜗蜗</h1>
          <p>今天先照顾一下身体吧</p>
        </div>
        <div className="hero-companion">
          <Tuantuan />
          <span className="spark s1">+</span>
          <span className="spark s2">✦</span>
          <span className="spark s3">◇</span>
        </div>
      </section>

      <div className="entry-row">
        <Card className="entry-card violet" onClick={() => go("awareness")}>
          <HeartPulse />
          <h3>身体有点累</h3>
          <p>肩颈沉 / 腰背紧 / 想放松</p>
        </Card>
        <Card className="entry-card blue" onClick={() => go("explore")}>
          <Activity />
          <h3>想活动一下身体</h3>
          <p>舒展 / 流动 / 激活</p>
        </Card>
        <Card className="entry-card amber" onClick={() => go("coach")}>
          <Brain />
          <h3>想认真训练</h3>
          <p>AI观察动作 / 训练标准</p>
        </Card>
      </div>

      <Card className="ask-card">
        <MessageCircle />
        <input placeholder="也可以直接告诉团团：今天做了一天PPT，肩膀特别沉……" />
        <button onClick={() => go("understanding")}>发送</button>
      </Card>

      <div className="capability-grid">
        {["懂你的身体", "科学的恢复", "动作观察", "成长记录", "温柔陪伴"].map((item, index) => (
          <Card className="mini-card" key={item}>
            <span>{`0${index + 1}`}</span>
            <strong>{item}</strong>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AwarenessPage({ go }: { go: (page: PageId) => void }) {
  return (
    <div className="page awareness-layout">
      <Card className="control-panel">
        <h2>1. 今天最明显的感觉是什么？</h2>
        <div className="pill-grid">{feelings.map((item, i) => <Pill key={item} active={i === 1}>{item}</Pill>)}</div>
      </Card>
      <Card className="body-picker">
        <div>
          <h2>2. 哪个区域最明显？</h2>
          <p>团团会把区域、感觉和场景连起来理解。</p>
        </div>
        <HumanFigure />
        <div className="region-list">{regions.map((item) => <Pill key={item} active={item === "肩颈"}>{item}</Pill>)}</div>
      </Card>
      <Card className="control-panel scene-panel">
        <h2>3. 最近通常发生在？</h2>
        <div className="pill-grid">{scenes.map((item, i) => <Pill key={item} active={i === 0}>{item}</Pill>)}</div>
        <div className="companion-note">
          <Tuantuan />
          <p>我会先理解你的身体状态，再给你轻一点的恢复方案。</p>
        </div>
        <button className="primary wide" onClick={() => go("understanding")}>生成身体理解 <ChevronRight size={18} /></button>
      </Card>
    </div>
  );
}

function UnderstandingPage({ go }: { go: (page: PageId) => void }) {
  return (
    <div className="page two-column">
      <Card className="story-card">
        <p className="eyebrow">团团的身体理解</p>
        <h1>你的肩膀，可能正在替脖子工作</h1>
        <p>这是身体在久坐低头后做出的临时补偿，不是你不够放松。先看懂它，再温柔地把工作还给该参与的肌肉。</p>
        <div className="chain">
          {["久坐低头", "头部前移", "深层颈屈肌参与不足", "斜方肌上束/肩胛提肌代偿", "肩颈酸胀"].map((step) => (
            <span key={step}>{step}</span>
          ))}
        </div>
        <button className="primary" onClick={() => go("muscles")}>查看相关肌肉 <ChevronRight size={18} /></button>
      </Card>
      <Card className="body-map-card">
        <HumanFigure />
        <div className="bubble-note">颈肩区域正在承担更多稳定任务，先让它慢慢卸力。</div>
      </Card>
    </div>
  );
}

function MusclesPage({ go }: { go: (page: PageId) => void }) {
  const muscles = [
    ["01", "斜方肌上束", "低头和耸肩时容易过度工作，带来肩颈上缘的酸胀。"],
    ["02", "肩胛提肌", "连接颈椎与肩胛，紧张时会让脖子侧后方变沉。"],
    ["03", "深层颈屈肌", "像脖子的内侧稳定器，参与不足时外层肌肉会代偿。"],
  ];
  return (
    <div className="page muscles-page">
      <div className="muscle-cards">
        {muscles.map(([n, title, text]) => (
          <Card className="muscle-card" key={title}>
            <span>{n}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </Card>
        ))}
      </div>
      <Card className="logic-card">
        <h2>恢复逻辑</h2>
        <div className="logic-flow">
          <strong>先放松代偿区</strong>
          <ChevronRight />
          <strong>再激活稳定肌群</strong>
          <ChevronRight />
          <strong>最后AI观察动作</strong>
        </div>
        <button className="primary wide" onClick={() => go("plan")}>查看今日恢复方案 <ChevronRight size={18} /></button>
      </Card>
    </div>
  );
}

function PlanPage({ go }: { go: (page: PageId) => void }) {
  return (
    <div className="page plan-grid">
      <Card className="plan-summary">
        <p className="eyebrow">今日目标</p>
        <h1>减少肩颈代偿</h1>
        <p>预计时间：6分钟</p>
        <div className="time-ring"><span>6</span><small>分钟</small></div>
      </Card>
      <Card className="move-list">
        <h2>动作列表</h2>
        {moves.map((move, index) => (
          <div className="move-row" key={move}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{move}</strong>
            <small>{index === 4 ? "AI观察" : index < 2 ? "放松" : "激活"}</small>
          </div>
        ))}
        <button className="primary wide" onClick={() => go("training")}>开始今日恢复 <ChevronRight size={18} /></button>
      </Card>
    </div>
  );
}

function TrainingPage({ go }: { go: (page: PageId) => void }) {
  return (
    <div className="page training-grid">
      <Card className="training-main">
        <div className="training-top">
          <div>
            <p className="eyebrow">当前动作</p>
            <h1>颈侧轻拉伸</h1>
          </div>
          <strong className="countdown">0:30</strong>
        </div>
        <div className="demo-zone">
          <HumanFigure />
          <div className="breath-ring" />
        </div>
      </Card>
      <Card className="training-side">
        <Tuantuan />
        <p>不要用力拉脖子，只要感觉到侧面有一点被温柔打开就好。</p>
        <div className="progress-dots">{moves.map((_, i) => <span className={i === 0 ? "active" : ""} key={i} />)}</div>
        <div className="controls">
          <button><ChevronLeft size={18} /> 上一个</button>
          <button className="round"><Pause size={18} /></button>
          <button onClick={() => go("observation")}>下一个 <ChevronRight size={18} /></button>
        </div>
      </Card>
    </div>
  );
}

function SkeletonOverlay() {
  const joints = [
    [320, 82],
    [230, 156],
    [410, 156],
    [180, 64],
    [460, 64],
    [286, 272],
    [354, 272],
    [258, 394],
    [382, 394],
  ];
  return (
    <svg className="skeleton-overlay" viewBox="0 0 640 520" role="img" aria-label="AI骨架观察线">
      <defs>
        <linearGradient id="heat" x1="0" x2="1">
          <stop offset="0" stopColor="#DFFF5F" />
          <stop offset="1" stopColor="#FFA94D" />
        </linearGradient>
      </defs>
      <path className="trajectory" d="M168 132 C150 80 150 42 182 26 M472 132 C490 80 490 42 458 26" />
      <path className="bone" d="M320 82 L320 188 L286 272 M320 188 L354 272" />
      <path className="bone" d="M320 122 L230 156 L180 64 M320 122 L410 156 L460 64" />
      <path className="bone" d="M286 272 L258 394 M354 272 L382 394" />
      <ellipse className="heat-zone" cx="320" cy="135" rx="112" ry="62" />
      {joints.map(([x, y]) => <circle className="joint" cx={x} cy={y} r="7" key={`${x}-${y}`} />)}
    </svg>
  );
}

function ObservationPage({ go }: { go: (page: PageId) => void }) {
  const metrics = [
    ["动作完成度", "78%"],
    ["手臂伸展高度", "82%"],
    ["肩膀放松程度", "65%"],
    ["左右对称性", "90%"],
  ];
  return (
    <div className="page observation-grid">
      <section className="camera-stage">
        <div className="camera-top">
          <button><Video size={18} /> 教学视频</button>
          <span>过头手臂伸展 · AI观察中</span>
        </div>
        <div className="person-back">
          <div className="head" />
          <div className="hair" />
          <div className="back" />
          <div className="arm up-left" />
          <div className="arm up-right" />
          <div className="hip" />
        </div>
        <SkeletonOverlay />
        <div className="metric-overlay">
          {metrics.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <div className="camera-bottom">
          <span>进度 5/5</span>
          <button><Pause size={18} /> 暂停</button>
          <button className="primary" onClick={() => go("feedback")}>完成本动作</button>
        </div>
      </section>
      <Card className="ai-panel">
        <div className="ai-panel-head">
          <Brain />
          <div>
            <p className="eyebrow">AI正在观察</p>
            <h2>团团看见了你的肩颈</h2>
          </div>
        </div>
        <blockquote>“肩膀有点上提，试着轻轻下沉。”</blockquote>
        <div className="sense-list">
          <div><span>肩颈紧张</span><strong>中等</strong></div>
          <div><span>左右对称</span><strong>良好</strong></div>
          <div><span>肩颈区域</span><strong>偏高</strong></div>
        </div>
        <p className="soft-note">这不是考试打分，团团只是在帮你发现身体正在怎么努力。</p>
      </Card>
    </div>
  );
}

function IntegratedObservationPage({ go, exercise }: { go: (page: PageId) => void; exercise: CoachExercise }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [session, setSession] = useState<PoseSessionState>({});
  const [apiState, setApiState] = useState<"connecting" | "ready" | "offline">("connecting");
  const [streamReady, setStreamReady] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const metrics = [
    ["标准次数", String(session.count ?? 0)],
    ["尝试次数", String(session.attempts ?? 0)],
    ["最近得分", `${session.score ?? 100}`],
    ["识别耗时", session.processMs ? `${session.processMs}ms` : "--"],
  ];

  const stageLabel: Record<string, string> = {
    ready: "准备",
    up: "上方",
    down: "下方",
  };

  const apiStatusText =
    apiState === "ready" ? "Pose API 已连接" : apiState === "connecting" ? "正在连接 Pose API" : "Pose API 未连接";
  const liveMessage =
    session.liveMessage ||
    (apiState === "offline"
      ? "姿态识别服务未连接。请先启动 Python Pose API，再回到这里刷新。"
      : "正在连接摄像头和姿态识别服务。");

  useEffect(() => {
    let alive = true;

    async function createPoseSession() {
      setApiState("connecting");
      setSession({});
      setSessionId("");

      try {
        const health = await fetch(`${poseApiBase}/api/health`);
        if (!health.ok) throw new Error("Pose API health check failed");

        const createResponse = await fetch(`${poseApiBase}/api/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ exercise: exercise.key, durationSeconds: 45 }),
        });
        if (!createResponse.ok) throw new Error("Pose API session create failed");

        const created = (await createResponse.json()) as PoseSessionState;
        if (!alive || !created.sessionId) return;
        setSessionId(created.sessionId);
        setSession(created);

        const startResponse = await fetch(`${poseApiBase}/api/session/${created.sessionId}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start" }),
        });
        if (startResponse.ok) {
          const started = (await startResponse.json()) as PoseSessionState;
          if (alive) setSession(started);
        }
        if (alive) setApiState("ready");
      } catch (error) {
        console.warn("Pose API unavailable", error);
        if (alive) {
          setApiState("offline");
          setSession({
            exerciseLabel: exercise.title,
            liveMessage: "没有连上 Python 姿态识别服务，先启动后端 API 就能接入真实评分。",
            score: 100,
            count: 0,
            attempts: 0,
          });
        }
      }
    }

    createPoseSession();
    return () => {
      alive = false;
    };
  }, [exercise]);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      setStreamReady(false);
      setCameraError("");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 20 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStreamReady(true);
      } catch (error) {
        console.warn("Camera unavailable", error);
        if (!cancelled) {
          setCameraError("摄像头未授权或不可用。允许浏览器摄像头权限后即可开始真实识别。");
        }
      }
    }

    startCamera();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStreamReady(false);
    };
  }, [exercise]);

  useEffect(() => {
    if (!sessionId || !streamReady || apiState !== "ready") return;

    let stopped = false;
    let timer: number | undefined;

    async function sendFrame() {
      if (stopped) return;
      const video = videoRef.current;
      const canvas = captureCanvasRef.current;
      const context = canvas?.getContext("2d");

      if (video && canvas && context && video.readyState >= 2) {
        const width = 416;
        const ratio = video.videoHeight && video.videoWidth ? video.videoHeight / video.videoWidth : 0.75;
        canvas.width = width;
        canvas.height = Math.round(width * ratio);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        try {
          const response = await fetch(`${poseApiBase}/api/session/${sessionId}/frame`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageData: canvas.toDataURL("image/jpeg", 0.72) }),
          });
          if (!response.ok) throw new Error("Pose frame request failed");
          const next = (await response.json()) as PoseSessionState;
          if (!stopped) setSession(next);
        } catch (error) {
          console.warn("Pose frame request failed", error);
          if (!stopped) setApiState("offline");
        }
      }

      timer = window.setTimeout(sendFrame, 260);
    }

    sendFrame();
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [apiState, sessionId, streamReady]);

  const runSessionAction = async (action: "start" | "reset" | "finish") => {
    if (!sessionId) return;
    const response = await fetch(`${poseApiBase}/api/session/${sessionId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (response.ok) {
      const next = (await response.json()) as PoseSessionState;
      setSession(next);
    }
  };

  const restartSession = async () => {
    await runSessionAction("reset");
    await runSessionAction("start");
  };

  const finishSession = async () => {
    await runSessionAction("finish");
    go("feedback");
  };

  return (
    <div className="page observation-grid">
      <section className="camera-stage">
        <div className="camera-top">
          <button><Video size={18} /> {apiStatusText}</button>
          <span>{session.exerciseLabel || exercise.title} · AI 实时观察</span>
        </div>
        <div className="backend-camera-feed">
          <video
            ref={videoRef}
            className={`backend-video-frame ${session.annotatedImage ? "is-hidden" : ""}`}
            playsInline
            muted
          />
          {session.annotatedImage && <img className="backend-video-frame" src={session.annotatedImage} alt="AI 姿态识别标注画面" />}
          {!streamReady && (
            <div className="camera-placeholder">
              <Video size={42} />
              <strong>{cameraError || "正在等待摄像头画面"}</strong>
              <span>{exercise.note}</span>
            </div>
          )}
          <canvas ref={captureCanvasRef} className="capture-canvas" />
        </div>
        <div className={`pose-live-badge ${session.detected ? "detected" : ""}`}>
          <span />
          {session.detected ? "已识别人体彩点" : "等待完整入镜"}
        </div>
        <div className="metric-overlay">
          {metrics.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <div className="camera-bottom">
          <span>
            阶段 {stageLabel[session.stage || ""] || session.stage || "准备"} · 剩余 {Math.ceil(session.remaining || 0)} 秒
          </span>
          <button onClick={restartSession}><Pause size={18} /> 重新开始</button>
          <button className="primary" onClick={finishSession}>完成本组</button>
        </div>
      </section>
      <Card className="ai-panel">
        <div className="ai-panel-head">
          <Brain />
          <div>
            <p className="eyebrow">AI 正在观察</p>
            <h2>{exercise.title}</h2>
          </div>
        </div>
        <blockquote>“{liveMessage}”</blockquote>
        <div className="sense-list">
          <div><span>服务状态</span><strong>{apiStatusText}</strong></div>
          <div><span>当前阶段</span><strong>{stageLabel[session.stage || ""] || session.stage || "准备"}</strong></div>
          <div><span>本轮评级</span><strong>{session.summary?.grade || "训练中"}</strong></div>
        </div>
        {session.liveErrors?.length ? (
          <div className="live-error-list">
            {session.liveErrors.map((error) => <span key={error}>{error}</span>)}
          </div>
        ) : (
          <p className="soft-note">{exercise.note}</p>
        )}
        <p className="soft-note">
          后端复用了现有 MediaPipe 与评分规则。这里显示的是 Python 服务实时返回的计数、评分和动作提示。
        </p>
      </Card>
    </div>
  );
}

function FeedbackPage({ go }: { go: (page: PageId) => void }) {
  return (
    <div className="page feedback-grid">
      <Card className="celebrate-card">
        <Tuantuan />
        <h1>今天恢复完成了！</h1>
        <p>你照顾了肩颈6分钟</p>
      </Card>
      <Card className="feedback-card">
        <h2>现在感觉怎么样？</h2>
        {["轻松了一些", "有一点缓解", "变化不明显"].map((item, i) => <button className={i === 0 ? "selected" : ""} key={item}>{item}</button>)}
        <button className="primary wide" onClick={() => go("archive")}>保存到身体档案 <ChevronRight size={18} /></button>
      </Card>
    </div>
  );
}

function ArchivePage() {
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  return (
    <div className="page archive-grid">
      <Card className="profile-card">
        <Tuantuan />
        <p className="eyebrow">用户</p>
        <h1>蜗蜗</h1>
        <div className="stats-pair">
          <div><strong>24天</strong><span>累计照顾身体</span></div>
          <div><strong>12.6小时</strong><span>总时长</span></div>
        </div>
      </Card>
      <Card className="calendar-card">
        <h2>本月记录日历</h2>
        <div className="calendar-grid">{days.map((day) => <span className={day % 5 === 0 || day % 6 === 0 ? "done" : ""} key={day}>{day}</span>)}</div>
      </Card>
      <Card className="heat-card">
        <h2>身体热力地图</h2>
        <HumanFigure compact />
      </Card>
      <Card className="week-card">
        <h2>本周变化</h2>
        <MiniChart />
        <p>肩颈紧张频率下降</p>
        <p>右肩向前圆肩仍需观察</p>
        <p>下次建议：肩胛稳定 + 下巴内收</p>
      </Card>
    </div>
  );
}

function ExplorePage() {
  const cards = [
    ["身体舒展", "肩背 / 脊柱 / 眼部", "lavender"],
    ["身体激活", "核心 / 平衡 / 身体协调", "cyan"],
    ["身体律动", "跟着音乐轻轻舞动", "pink"],
  ];
  return (
    <div className="page catalog-grid">
      {cards.map(([title, text, tone]) => (
        <Card className={`catalog-card ${tone}`} key={title}>
          <HumanFigure compact />
          <h2>{title}</h2>
          <p>{text}</p>
          <button className="ghost-button">开始探索 <ChevronRight size={16} /></button>
        </Card>
      ))}
    </div>
  );
}

function CoachPage() {
  const cards = [
    ["下肢力量", "深蹲 / 硬拉 / 髋部控制"],
    ["上肢稳定", "俯卧撑 / 划船 / 肩胛控制"],
    ["核心训练", "平板支撑 / 死虫 / 抗旋转"],
  ];
  return (
    <div className="page catalog-grid coach">
      {cards.map(([title, text], i) => (
        <Card className="catalog-card" key={title}>
          <div className={`coach-illustration c${i + 1}`}>
            <HumanFigure compact />
          </div>
          <h2>{title}</h2>
          <p>{text}</p>
          <button className="ghost-button">进入训练 <ChevronRight size={16} /></button>
        </Card>
      ))}
    </div>
  );
}

function IntegratedCoachPage({ onStartExercise }: { onStartExercise: (exercise: CoachExercise) => void }) {
  return (
    <div className="page catalog-grid coach">
      {coachExercises.map((exercise, i) => (
        <Card className="catalog-card" key={exercise.key}>
          <div className={`coach-illustration c${i + 1}`}>
            <HumanFigure compact />
          </div>
          <h2>{exercise.title}</h2>
          <p>{exercise.text}</p>
          <p className="coach-note">{exercise.note}</p>
          <button className="ghost-button" onClick={() => onStartExercise(exercise)}>
            进入实时训练 <ChevronRight size={16} />
          </button>
        </Card>
      ))}
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<PageId>("home");
  const [selectedExercise, setSelectedExercise] = useState<CoachExercise>(coachExercises[0]);
  const meta = pageMeta[page];
  const nextPage = useMemo(() => flow[(flow.indexOf(page) + 1) % flow.length], [page]);

  useEffect(() => {
    document.title = "每日轻动";
  }, []);

  const renderPage = () => {
    if (page === "home") return <HomePage go={setPage} />;
    if (page === "awareness") return <AwarenessPage go={setPage} />;
    if (page === "understanding") return <UnderstandingPage go={setPage} />;
    if (page === "muscles") return <MusclesPage go={setPage} />;
    if (page === "plan") return <PlanPage go={setPage} />;
    if (page === "training") return <TrainingPage go={setPage} />;
    if (page === "observation") return <IntegratedObservationPage go={setPage} exercise={selectedExercise} />;
    if (page === "feedback") return <FeedbackPage go={setPage} />;
    if (page === "archive") return <ArchivePage />;
    if (page === "explore") return <ExplorePage />;
    return <IntegratedCoachPage onStartExercise={(exercise) => {
      setSelectedExercise(exercise);
      setPage("observation");
    }} />;
  };

  return (
    <main className="wellness-app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Sparkles size={20} /></div>
          <div>
            <strong>每日轻动</strong>
            <span>AI 身体觉察与轻运动</span>
          </div>
        </div>
        <nav className="side-nav" aria-label="主导航">
          {navItems.map(({ label, page: target, icon: Icon }) => (
            <button className={page === target ? "active" : ""} onClick={() => setPage(target)} key={label}>
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <Card className="sidebar-companion">
          <Tuantuan />
          <strong>团团在线</strong>
          <p>今天会用更轻的节奏陪你恢复肩颈。</p>
        </Card>
      </aside>

      <section className="workspace">
        <header className="top-header">
          <div>
            <p><span>{meta.index}</span> {meta.title}</p>
            <h2>{meta.hint}</h2>
          </div>
          <div className="header-actions">
            <button className="ai-state"><Sparkles size={16} /> AI状态助手</button>
            <button className="icon-button"><Search size={18} /></button>
            <button className="icon-button"><Bell size={18} /></button>
            <div className="avatar"><span>蜗</span><strong>蜗蜗</strong></div>
          </div>
        </header>

        <section className="page-shell" key={page}>
          {renderPage()}
        </section>

        <button className="floating-next" onClick={() => setPage(nextPage)}>
          下一页 <ChevronRight size={18} />
        </button>
      </section>
      <DesktopPet />
    </main>
  );
}
