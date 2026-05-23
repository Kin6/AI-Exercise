import React, { useState } from "react";
import { MascotCharacter } from "./MascotCharacter";
import { Send, Sparkles } from "lucide-react";
import { motion } from "motion/react";

interface HomePanelProps {
  userName: string;
  onSelectPath: (path: "A" | "B" | "C") => void;
  onTriggerAIChat: (text: string) => void;
  loadingAI: boolean;
}

const CHAT_SUGGESTIONS = [
  "今天做了一天PPT，肩膀特别沉…",
  "下楼梯的时候感觉右边膝盖有点软无力",
  "办公桌前坐太久，后腰酸累像冰硬木板",
];

export const HomePanel: React.FC<HomePanelProps> = ({
  userName = "刘思琪",
  onSelectPath,
  onTriggerAIChat,
  loadingAI,
}) => {
  const [inputText, setInputText] = useState("");
  const [mascotExpression, setMascotExpression] = useState<"tired" | "normal" | "determined" | "active" | "focus" | "completed" | "sad" | "cheer">("normal");
  const [mascotDialog, setMascotDialog] = useState("小摩在等你，今天先照顾一下身体吧！");

  const clickMascotAnswers = [
    "按按我，不如直接告诉我哪里不舒服？",
    "今天喝水了吗？拉伸前深呼吸三次噢！",
    "斜方肌正悄悄工作，赶紧放松耸起的肩膀！",
    "小摩今天陪你一起成长，点燃能量球吧！",
  ];

  const handleMascotClick = () => {
    const randomText = clickMascotAnswers[Math.floor(Math.random() * clickMascotAnswers.length)];
    const randomExpressions: Array<"cheer" | "focus" | "normal" | "determined"> = ["cheer", "focus", "normal", "determined"];
    const randomExp = randomExpressions[Math.floor(Math.random() * randomExpressions.length)];
    setMascotExpression(randomExp);
    setMascotDialog(randomText);
    setTimeout(() => {
      setMascotExpression("normal");
    }, 2800);
  };

  const handleSend = () => {
    if (!inputText.trim() || loadingAI) return;
    onTriggerAIChat(inputText);
  };

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24 px-4 pt-4 scrollbar-none" id="home_panel">
      {/* Header Profile Greeting */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-indigo-400 font-mono tracking-wider uppercase">Welcome Back</p>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-1.5">
            晚上好，{userName}
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">今天先照顾一下身体吧 🌿</p>
        </div>
        <div className="w-10 h-10 rounded-full border border-indigo-400/30 overflow-hidden shadow-md shadow-indigo-900/30 bg-slate-800 flex items-center justify-center font-bold text-indigo-300">
          思琪
        </div>
      </div>

      {/* Mascot Dialog Bubble Section */}
      <div className="bg-slate-850/80 rounded-2xl p-5 border border-indigo-500/10 shadow-xl shadow-indigo-950/20 mb-6 flex flex-col items-center">
        <div className="relative mb-3 flex justify-center w-full">
          <MascotCharacter expression={mascotExpression} size={110} glow={true} />
        </div>
        
        {/* Dialog Box text speech */}
        <div className="bg-indigo-950/70 border border-indigo-500/15 py-2.5 px-4 rounded-xl text-xs text-indigo-200 text-center max-w-xs transition-all duration-300 relative">
          <p className="font-medium animate-pulse-subtle">{mascotDialog}</p>
          <div className="absolute top-[-6px] left-[50%] translate-x-[-50%] w-3 h-3 bg-indigo-950 border-t border-l border-indigo-500/15 rotate-45" />
        </div>
      </div>

      {/* Title block */}
      <p className="text-xs font-semibold text-indigo-300 tracking-wider mb-3 uppercase">今天更接近哪一种状态？</p>

      {/* Three Action Route selectors */}
      <div className="space-y-3.5 mb-8">
        {/* Selection Card A */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => onSelectPath("A")}
          className="w-full text-left bg-slate-850/90 border border-dashed border-indigo-500/25 hover:border-indigo-400 p-4 rounded-2xl shadow transition-all flex items-center justify-between"
        >
          <div className="flex-1 pr-3">
            <div className="flex items-center gap-1.5">
              <span className="text-lg">😮‍💨</span>
              <h4 className="font-bold text-slate-100 text-sm">身体有点累 / 酸麻不舒服</h4>
            </div>
            <p className="text-xs text-indigo-300/80 mt-1">肩颈酸滞沉沙 / 后腰坚挺僵硬 / 深层拉伸放松排乳酸</p>
          </div>
          <span className="text-xs text-indigo-400 bg-indigo-950/80 border border-indigo-500/20 px-2 py-1 rounded-lg shrink-0">
            放松评估 →
          </span>
        </motion.button>

        {/* Selection Card B */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => onSelectPath("B")}
          className="w-full text-left bg-slate-850/90 border border-indigo-500/10 hover:border-indigo-400 p-4 rounded-2xl shadow transition-all flex items-center justify-between"
        >
          <div className="flex-1 pr-3">
            <div className="flex items-center gap-1.5">
              <span className="text-lg">🙂</span>
              <h4 className="font-bold text-slate-100 text-sm">想轻量活动一下身体</h4>
            </div>
            <p className="text-xs text-slate-400 mt-1">柔性流动 / 关节松动舒展 / 主动核心激活调节</p>
          </div>
          <span className="text-xs text-indigo-400 bg-indigo-950/80 px-2 py-1 rounded-lg shrink-0">
            慢速流动 →
          </span>
        </motion.button>

        {/* Selection Card C */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => onSelectPath("C")}
          className="w-full text-left bg-slate-850/90 border border-indigo-500/10 hover:border-indigo-400 p-4 rounded-2xl shadow transition-all flex items-center justify-between"
        >
          <div className="flex-1 pr-3">
            <div className="flex items-center gap-1.5">
              <span className="text-lg">🔥</span>
              <h4 className="font-bold text-slate-100 text-sm">想认真训练健身</h4>
            </div>
            <p className="text-xs text-slate-400 mt-1">AI 3D骨架实时检测 / 膝角下蹲对齐 / 姿态教练规范动作</p>
          </div>
          <span className="text-xs text-red-400 bg-red-950/50 px-2 py-1 rounded-lg shrink-0">
            AI观察教练 →
          </span>
        </motion.button>
      </div>

      {/* AI Speech input helper box */}
      <div className="bg-slate-850/90 border border-indigo-500/15 rounded-2xl p-4 shadow-lg mb-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="w-4 h-4 text-amber-400 animate-spin-slow" />
          <p className="text-xs font-bold text-slate-200">也可以直接告诉小摩：</p>
        </div>

        {/* Chat input form */}
        <div className="relative flex items-center bg-slate-900 border border-indigo-500/20 rounded-xl focus-within:border-indigo-400 overflow-hidden mb-3">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={loadingAI ? "小摩正在仔细诊断中..." : "例如：做了一整天PPT，脖颈快要断了..."}
            className="w-full text-xs text-slate-100 placeholder-slate-500 py-3 pl-3 pr-10 focus:outline-none bg-transparent"
            disabled={loadingAI}
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || loadingAI}
            className="absolute right-2 text-indigo-400 hover:text-indigo-300 disabled:text-slate-600 transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic loading bar */}
        {loadingAI && (
          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mb-3 relative">
            <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-teal-400 w-1/3 rounded-full animate-progress-loading" />
          </div>
        )}

        {/* Suggestion tags */}
        <div className="space-y-1.5">
          {CHAT_SUGGESTIONS.map((tag, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInputText(tag);
                setMascotExpression("cheer");
                setMascotDialog("听到啦！现在点击右侧的小纸飞机，让我为你生成专属的运动机制剖析吧！");
              }}
              className="w-full text-left bg-slate-900 text-slate-400 hover:text-indigo-300 hover:bg-slate-850 p-2 rounded-lg text-[11px] transition-all border border-slate-800 flex items-center justify-between"
            >
              <span className="truncate">{tag}</span>
              <span className="text-[9px] text-indigo-400 shrink-0 font-mono">点击试用</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
