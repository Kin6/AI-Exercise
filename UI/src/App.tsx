import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bell,
  Brain,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  HeartPulse,
  Home,
  LineChart,
  MessageCircle,
  Pause,
  Play,
  Search,
  Sparkles,
  Video,
  Volume2,
  VolumeX,
} from "lucide-react";
import archiveImage from "./assets/dangan.png";
import bodyImage from "./assets/body-cutout.png";
import neckStretchImage from "./assets/jingce-qls.png";
import muscleExplainImage from "./assets/jiroujiangjie.png";
import musclePartOneImage from "./assets/jirou3-fenbie(1)(1).png";
import musclePartTwoImage from "./assets/jirou3-fenbie(2)(2).png";
import musclePartThreeImage from "./assets/jirou3-fenbie(3)(3).png";
import tuantuanImage from "./assets/tuantuan-xin.png";

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
    invalid_attempts?: number;
    avg_score?: number;
    common_errors?: { name: string; count: number }[];
  };
};

type CoachExercise = {
  key: ExerciseKey;
  title: string;
  text: string;
  note: string;
  teachingVideoFile: string;
  teachingLabel: string;
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
    teachingVideoFile: "深蹲.mp4",
    teachingLabel: "深蹲标准示范",
  },
  {
    key: "pushup",
    title: "上肢稳定 | 俯卧撑",
    text: "肘角幅度 / 身体直线 / 核心塌陷",
    note: "建议侧面入镜，肩、肘、腕、髋、踝保持在画面内。",
    teachingVideoFile: "俯卧撑.mp4",
    teachingLabel: "俯卧撑标准示范",
  },
  {
    key: "curl",
    title: "手臂控制 | 弯举",
    text: "肘部漂移 / 借力摆动 / 动作幅度",
    note: "建议侧面或 45 度入镜，训练手臂完整可见。",
    teachingVideoFile: "弯举.mp4",
    teachingLabel: "弯举标准示范",
  },
];

const getTeachingVideoSrc = (fileName: string) => `/videoTeaching/${encodeURIComponent(fileName)}`;
const trainingDurationSeconds = 30;

const correctionSpeechKeywords = [
  "请",
  "不要",
  "避免",
  "保持",
  "放慢",
  "固定",
  "稳定",
  "下沉",
  "收紧",
  "伸直",
  "进入画面",
  "完整",
  "可见",
  "控制",
  "节奏",
  "过高",
  "过低",
  "偏",
  "漂移",
  "摆动",
];

const positiveSpeechKeywords = ["不错", "很好", "标准", "完成一次", "继续保持"];

function cleanSpeechText(text = "") {
  return text
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isCorrectionSpeech(text: string) {
  if (!text || positiveSpeechKeywords.some((keyword) => text.includes(keyword))) return false;
  return correctionSpeechKeywords.some((keyword) => text.includes(keyword));
}

function getExerciseShortName(title: string) {
  const parts = title.split("|");
  return (parts[parts.length - 1] || title).trim();
}

function buildRoundSummaryMessage(session: PoseSessionState, exercise: CoachExercise) {
  const actionName = getExerciseShortName(exercise.title);
  const completedReps = session.summary?.valid_reps ?? session.count ?? 0;
  const attempts = session.summary?.attempts ?? session.attempts ?? completedReps;
  const averageScore = session.summary?.avg_score ?? session.score ?? 0;
  const invalidAttempts = session.summary?.invalid_attempts ?? Math.max(0, attempts - completedReps);
  const roundedScore = Math.round(averageScore);
  const scoreText = roundedScore > 0 ? `${roundedScore} 分` : "暂无评分";
  const repeatedErrors = (session.summary?.common_errors || []).map((error) => error.name).filter(Boolean);
  const visibleErrors = repeatedErrors.length ? repeatedErrors : session.liveErrors || [];
  const errorText = visibleErrors.slice(0, 2).join("、");

  if (attempts === 0) {
    return `本组完成 0 个标准动作，尝试 0 次，暂时没有有效评分。还没有识别到完整的${actionName}动作，先把身体完整放进画面，下一组从一次标准动作开始。`;
  }

  if (errorText) {
    return `本组完成 ${completedReps} 个标准动作，尝试 ${attempts} 次，平均得分 ${scoreText}。过程中主要需要注意${errorText}，下一组先放慢节奏，把动作做完整。`;
  }

  if (invalidAttempts > 0) {
    return `本组完成 ${completedReps} 个标准动作，尝试 ${attempts} 次，平均得分 ${scoreText}。有 ${invalidAttempts} 次动作还没达到标准，整体已经进入节奏，下一组优先稳定轨迹。`;
  }

  if (roundedScore >= 85) {
    return `本组完成 ${completedReps} 个标准动作，尝试 ${attempts} 次，平均得分 ${scoreText}。过程整体稳定，节奏和控制感不错，下一组保持这个速度。`;
  }

  return `本组完成 ${completedReps} 个标准动作，尝试 ${attempts} 次，平均得分 ${scoreText}。动作已经被识别到，下一组把幅度和身体控制再做得更稳。`;
}

function pickChineseVoice(voices: SpeechSynthesisVoice[]) {
  const chineseVoices = voices.filter((voice) => /zh|cmn|普通话|中文|Chinese/i.test(`${voice.lang} ${voice.name}`));
  const preferredNames = [
    "Xiaoxiao",
    "晓晓",
    "Microsoft Xiaoxiao",
    "Microsoft 晓晓",
    "Natural",
    "Xiaoyi",
    "Yunxi",
    "Yunyang",
    "Yunjian",
    "云希",
    "Microsoft",
    "Google",
    "普通话",
    "中文",
  ];

  return (
    preferredNames
      .map((name) => chineseVoices.find((voice) => voice.name.toLowerCase().includes(name.toLowerCase())))
      .find(Boolean) ||
    chineseVoices.find((voice) => voice.lang.toLowerCase().startsWith("zh-cn")) ||
    chineseVoices[0] ||
    voices[0] ||
    null
  );
}

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
  home: { index: "01", title: "首页 | 今日状态入口", hint: "从一点点身体觉察开始" },
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
  { label: "成长变化", page: "feedback" as PageId, icon: LineChart },
  { label: "身体档案", page: "archive" as PageId, icon: CalendarDays },
  { label: "训练中心", page: "coach" as PageId, icon: Dumbbell },
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

function Pill({
  children,
  active = false,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  key?: React.Key;
  onClick?: () => void;
}) {
  return (
    <button className={`pill ${active ? "is-active" : ""}`} type="button" aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  );
}

function Tuantuan() {
  return (
    <div className="tuantuan" aria-label="团团">
      <img src={tuantuanImage} alt="" aria-hidden="true" />
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
    maxX: Math.max(300, width * 0.5),
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

const bodyRegionMarkers = [
  { left: "50%", top: "11%" },
  { left: "60%", top: "23%" },
  { left: "50%", top: "31%" },
  { left: "50%", top: "42%" },
  { left: "50%", top: "53%" },
  { left: "42%", top: "66%" },
  { left: "42%", top: "75%" },
  { left: "57%", top: "85%" },
  { left: "57%", top: "95%" },
];

function HumanFigure({
  compact = false,
  selectedRegionIndexes = [],
  onRegionSelect,
}: {
  compact?: boolean;
  selectedRegionIndexes?: number[];
  onRegionSelect?: (index: number) => void;
}) {
  const markerIndexes = selectedRegionIndexes.includes(9)
    ? bodyRegionMarkers.map((_, index) => index)
    : selectedRegionIndexes.filter((index) => index >= 0 && index < bodyRegionMarkers.length);

  return (
    <div className={`human-figure ${compact ? "compact" : ""}`}>
      <img className="body-image" src={bodyImage} alt="" aria-hidden="true" />
      {markerIndexes.map((index) => (
        <button
          className="body-dot is-active"
          style={bodyRegionMarkers[index]}
          type="button"
          aria-label={regions[index]}
          aria-pressed="true"
          onClick={() => onRegionSelect?.(index)}
          key={regions[index]}
        />
      ))}
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
  const [selectedFeelings, setSelectedFeelings] = useState([1]);
  const [selectedRegions, setSelectedRegions] = useState([1]);
  const [selectedScenes, setSelectedScenes] = useState([0]);
  const toggleIndex = (items: number[], index: number) =>
    items.includes(index) ? items.filter((item) => item !== index) : [...items, index];

  return (
    <div className="page awareness-layout">
      <Card className="control-panel">
        <h2>1. 今天最明显的感觉是什么？</h2>
        <div className="pill-grid">
          {feelings.map((item, i) => (
            <Pill key={item} active={selectedFeelings.includes(i)} onClick={() => setSelectedFeelings((current) => toggleIndex(current, i))}>
              {item}
            </Pill>
          ))}
        </div>
      </Card>
      <Card className="body-picker">
        <div>
          <h2>2. 哪个区域最明显？</h2>
          <p>团团会把区域、感觉和场景连起来理解。</p>
        </div>
        <HumanFigure
          selectedRegionIndexes={selectedRegions}
          onRegionSelect={(index) => setSelectedRegions((current) => toggleIndex(current, index))}
        />
        <div className="region-list">
          {regions.map((item, i) => (
            <Pill key={item} active={selectedRegions.includes(i)} onClick={() => setSelectedRegions((current) => toggleIndex(current, i))}>
              {item}
            </Pill>
          ))}
        </div>
      </Card>
      <Card className="control-panel scene-panel">
        <h2>3. 最近通常发生在？</h2>
        <div className="pill-grid">
          {scenes.map((item, i) => (
            <Pill key={item} active={selectedScenes.includes(i)} onClick={() => setSelectedScenes((current) => toggleIndex(current, i))}>
              {item}
            </Pill>
          ))}
        </div>
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
          {["久坐低头", "头部前移", "深层颈屈肌参与不足", "斜方肌上束和肩胛提肌代偿", "肩颈酸胀"].map((step) => (
            <span key={step}>{step}</span>
          ))}
        </div>
        <button className="primary" onClick={() => go("muscles")}>查看相关肌肉 <ChevronRight size={18} /></button>
      </Card>
      <Card className="body-map-card">
        <img className="muscle-explain-image" src={muscleExplainImage} alt="" aria-hidden="true" loading="eager" decoding="sync" />
        <div className="bubble-note">颈肩区域正在承担更多稳定任务，先让它慢慢卸力。</div>
      </Card>
    </div>
  );
}

function MusclesPage({ go }: { go: (page: PageId) => void }) {
  const musclePartImages = [musclePartOneImage, musclePartTwoImage, musclePartThreeImage];
  const muscles = [
    ["01", "斜方肌上束", "低头和耸肩时容易过度工作，带来肩颈上缘的酸胀。"],
    ["02", "肩胛提肌", "连接颈椎与肩胛，紧张时会让脖子侧后方变沉。"],
    ["03", "深层颈屈肌", "像脖子的内侧稳定器，参与不足时外层肌肉会代偿。"],
  ];
  return (
    <div className="page muscles-page">
      <div className="muscle-cards">
        {muscles.map(([n, title, text], index) => (
          <Card className="muscle-card" key={title}>
            <img
              className="muscle-card-visual"
              src={musclePartImages[index]}
              alt=""
              aria-hidden="true"
            />
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
          <strong>最后 AI 观察动作</strong>
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
        <p>预计时间：6 分钟</p>
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
          <img className="training-pose-image" src={neckStretchImage} alt="" aria-hidden="true" />
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
            <p className="eyebrow">AI 正在观察</p>
            <h2>团团看见了你的肩颈</h2>
          </div>
        </div>
        <blockquote>“肩膀有点上提，试着轻轻下沉。”</blockquote>
        <div className="sense-list">
          <div><span>肩颈紧张</span><strong>中等</strong></div>
          <div><span>左右对称</span><strong>良好</strong></div>
          <div><span>肩颈区域</span><strong>偏高</strong></div>
        </div>
        <p className="soft-note">这不是考试打分，团团只是帮你发现身体正在怎么努力。</p>
      </Card>
    </div>
  );
}

function IntegratedObservationPage({
  go,
  exercise,
  onPreviousExercise,
  onRoundComplete,
}: {
  go: (page: PageId) => void;
  exercise: CoachExercise;
  onPreviousExercise: () => void;
  onRoundComplete: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoAdvanceRef = useRef(false);
  const speechVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const lastSpokenCorrectionRef = useRef({ text: "", at: 0 });
  const [sessionId, setSessionId] = useState<string>("");
  const [session, setSession] = useState<PoseSessionState>({});
  const [apiState, setApiState] = useState<"connecting" | "ready" | "offline">("connecting");
  const [streamReady, setStreamReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(trainingDurationSeconds);
  const [showRoundFinish, setShowRoundFinish] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speechSupported, setSpeechSupported] = useState(false);

  const countdownRemainingPercent = clamp((countdownSeconds / trainingDurationSeconds) * 100, 0, 100);
  const bottomMetrics = [
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
  const isRoundFinished = session.status === "finished";
  const panelMessage = isRoundFinished ? buildRoundSummaryMessage(session, exercise) : liveMessage;
  const panelEyebrow = isRoundFinished ? "本组已完成" : "AI 正在观察";
  const correctionSpeechText = useMemo(() => {
    if (apiState !== "ready" || isPaused || showRoundFinish) return "";

    const errors = (session.liveErrors || []).map((error) => cleanSpeechText(error)).filter(Boolean);
    if (errors.length) return `请注意，${errors.slice(0, 2).join("，")}。`;

    const message = cleanSpeechText(session.liveMessage || "");
    if (!session.detected || !isCorrectionSpeech(message)) return "";
    return message.endsWith("。") || message.endsWith("！") ? message : `${message}。`;
  }, [apiState, isPaused, session.detected, session.liveErrors, session.liveMessage, showRoundFinish]);

  useEffect(() => {
    let alive = true;

    async function createPoseSession() {
      setApiState("connecting");
      setSession({});
      setSessionId("");
      setIsPaused(false);
      setCountdownSeconds(trainingDurationSeconds);
      setShowRoundFinish(false);
      autoAdvanceRef.current = false;
      lastSpokenCorrectionRef.current = { text: "", at: 0 };
      window.speechSynthesis?.cancel();

      try {
        const health = await fetch(`${poseApiBase}/api/health`);
        if (!health.ok) throw new Error("Pose API health check failed");

        const createResponse = await fetch(`${poseApiBase}/api/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ exercise: exercise.key, durationSeconds: trainingDurationSeconds }),
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
            remaining: trainingDurationSeconds,
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
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return;

    setSpeechSupported(true);

    const loadVoices = () => {
      speechVoiceRef.current = pickChineseVoice(window.speechSynthesis.getVoices());
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (!voiceEnabled || !speechSupported || !correctionSpeechText) return;

    const now = Date.now();
    const normalizedText = correctionSpeechText.replace(/\s+/g, "");
    const lastSpoken = lastSpokenCorrectionRef.current;
    if (lastSpoken.text === normalizedText && now - lastSpoken.at < 11000) return;
    if (now - lastSpoken.at < 4800) return;

    const utterance = new SpeechSynthesisUtterance(correctionSpeechText);
    utterance.lang = "zh-CN";
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.9;
    if (speechVoiceRef.current) utterance.voice = speechVoiceRef.current;

    lastSpokenCorrectionRef.current = { text: normalizedText, at: now };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [correctionSpeechText, speechSupported, voiceEnabled]);

  useEffect(() => {
    if (session.status !== "active") return;
    if (typeof session.remaining !== "number") return;
    const nextRemaining = clamp(Math.ceil(session.remaining), 0, trainingDurationSeconds);
    setCountdownSeconds(nextRemaining);
  }, [session.remaining, session.status]);

  useEffect(() => {
    if (isPaused || countdownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCountdownSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [countdownSeconds, isPaused]);

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
    if (!sessionId || !streamReady || apiState !== "ready" || isPaused) return;

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
  }, [apiState, isPaused, sessionId, streamReady]);

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
    setIsPaused(false);
    setCountdownSeconds(trainingDurationSeconds);
    setShowRoundFinish(false);
    autoAdvanceRef.current = false;
    await runSessionAction("reset");
    await runSessionAction("start");
  };

  const finishSession = async () => {
    await runSessionAction("finish");
    go("feedback");
  };

  const togglePaused = () => {
    if (showRoundFinish) return;
    setIsPaused((current) => !current);
  };

  const toggleVoice = () => {
    if (!speechSupported) return;
    setVoiceEnabled((current) => {
      if (current) {
        window.speechSynthesis.cancel();
      } else {
        window.speechSynthesis.resume();
      }
      return !current;
    });
  };

  useEffect(() => {
    if (countdownSeconds > 0 || autoAdvanceRef.current) return;

    autoAdvanceRef.current = true;
    setIsPaused(true);
    setShowRoundFinish(true);

    const timer = window.setTimeout(async () => {
      await runSessionAction("finish");
      setShowRoundFinish(false);
      onRoundComplete();
    }, 2400);

    return () => window.clearTimeout(timer);
  }, [countdownSeconds, onRoundComplete, sessionId]);

  return (
    <div className="page observation-grid">
      <section className="camera-stage">
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

          <div className="camera-top">
            <button><Video size={18} /> {apiStatusText}</button>
            <button
              type="button"
              className={`voice-toggle ${voiceEnabled ? "is-on" : ""}`}
              onClick={toggleVoice}
              disabled={!speechSupported}
              title={speechSupported ? "切换姿势纠正语音播报" : "当前浏览器不支持语音播报"}
            >
              {voiceEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
              <span>{speechSupported ? (voiceEnabled ? "语音" : "静音") : "无语音"}</span>
            </button>
            <span>{session.exerciseLabel || exercise.title} · AI 实时观察</span>
          </div>

          <section className="teaching-video-card" aria-label="教学视频">
            <div className="teaching-video-head">
              <strong>教学视频</strong>
              <span>{exercise.teachingLabel}</span>
            </div>
            <div className="teaching-video-frame">
              <video
                key={exercise.teachingVideoFile}
                src={getTeachingVideoSrc(exercise.teachingVideoFile)}
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
              />
              <span className="teaching-play-mark" aria-hidden="true">
                <Play size={34} />
              </span>
            </div>
            <div className="teaching-video-meta">
              <span>循环示范</span>
              <span>{session.processMs ? `${session.processMs}ms` : "实时对照"}</span>
            </div>
          </section>

          <section className="coach-progress-panel" aria-label="训练倒计时">
            <div className="coach-progress-head">
              <strong>训练倒计时</strong>
              <span>{isPaused ? "已暂停" : "30秒计时"}</span>
            </div>
            <div
              className="coach-ring"
              style={{ "--countdown-remaining": `${countdownRemainingPercent}%` } as React.CSSProperties}
            >
              <strong>{countdownSeconds}</strong>
              <span>秒</span>
            </div>
            <div className="countdown-status">
              <span>当前阶段</span>
              <strong>{stageLabel[session.stage || ""] || session.stage || "准备"}</strong>
            </div>
          </section>

          <div className={`pose-live-badge ${session.detected ? "detected" : ""}`}>
            <span />
            {session.detected ? "已识别人体彩点" : "等待完整入镜"}
          </div>

          {showRoundFinish && (
            <div className="round-finish-effect" role="status" aria-live="polite">
              <div className="flower-bloom" aria-hidden="true">
                {Array.from({ length: 14 }, (_, index) => (
                  <span
                    className="flower-petal"
                    style={{
                      "--petal-angle": `${index * (360 / 14)}deg`,
                      "--petal-delay": `${index * 22}ms`,
                    } as React.CSSProperties}
                    key={index}
                  />
                ))}
                {Array.from({ length: 10 }, (_, index) => (
                  <span
                    className="flower-spark"
                    style={{
                      "--spark-angle": `${index * 36}deg`,
                      "--spark-delay": `${index * 38}ms`,
                    } as React.CSSProperties}
                    key={index}
                  />
                ))}
                <span className="flower-center" />
              </div>
              <div className="round-finish-copy">
                <strong>本轮完成</strong>
                <span>点击下一页继续</span>
              </div>
            </div>
          )}

          <div className="training-control-bar">
            <button type="button" className="training-control ghost" onClick={onPreviousExercise} disabled={showRoundFinish}>
              <ChevronLeft size={20} /> 上一个
            </button>
            <div className="training-metrics-strip" aria-label="实时识别指标">
              {bottomMetrics.map(([label, value]) => (
                <div className="training-metric-item" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <button type="button" className="training-control pause" onClick={togglePaused} disabled={showRoundFinish}>
              {isPaused ? <Play size={20} /> : <Pause size={20} />}
              {isPaused ? "继续" : "暂停"}
            </button>
            <button type="button" className="training-control complete" onClick={finishSession} disabled={showRoundFinish}>
              <Check size={20} /> 完成本动作
            </button>
          </div>
        </div>
      </section>
      <Card className="ai-panel">
        <div className="ai-panel-head">
          <Brain />
          <div>
            <p className="eyebrow">{panelEyebrow}</p>
            <h2>{exercise.title}</h2>
          </div>
        </div>
        <blockquote className={isRoundFinished ? "is-summary" : undefined}>“{panelMessage}”</blockquote>
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
        <h1>今天恢复完成了！</h1>
        <p>你照顾了肩颈 6 分钟</p>
      </Card>
      <Card className="feedback-card">
        <Tuantuan />
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
      <img className="archive-dashboard-image" src={archiveImage} alt="" aria-hidden="true" />
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
  const [observationRoundComplete, setObservationRoundComplete] = useState(false);
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
    if (page === "observation") {
      return (
        <IntegratedObservationPage
          go={setPage}
          exercise={selectedExercise}
          onRoundComplete={() => setObservationRoundComplete(true)}
          onPreviousExercise={() => {
            setObservationRoundComplete(false);
            setSelectedExercise((current) => {
              const currentIndex = coachExercises.findIndex((exercise) => exercise.key === current.key);
              return coachExercises[(currentIndex - 1 + coachExercises.length) % coachExercises.length];
            });
          }}
        />
      );
    }
    if (page === "feedback") return <FeedbackPage go={setPage} />;
    if (page === "archive") return <ArchivePage />;
    if (page === "explore") return <ExplorePage />;
    return <IntegratedCoachPage onStartExercise={(exercise) => {
      setObservationRoundComplete(false);
      setSelectedExercise(exercise);
      setPage("observation");
    }} />;
  };

  return (
    <main className="wellness-app">
      <img className="asset-preload" src={muscleExplainImage} alt="" aria-hidden="true" />
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
          <strong>团团</strong>
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

        {page !== "archive" && (page !== "observation" || observationRoundComplete) && (
          <button className="floating-next" onClick={() => setPage(nextPage)}>
            下一页 <ChevronRight size={18} />
          </button>
        )}
      </section>
      {page !== "observation" && <DesktopPet />}
    </main>
  );
}
