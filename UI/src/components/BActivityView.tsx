import React, { useState, useEffect } from "react";
import { ArrowLeft, Play, Pause, RefreshCw, AudioLines, Sparkles, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MascotCharacter } from "./MascotCharacter";

interface BActivityViewProps {
  onBackToHome: () => void;
}

export const BActivityView: React.FC<BActivityViewProps> = ({ onBackToHome }) => {
  const [bStep, setBStep] = useState<"choose" | "flow" | "activate" | "completed">("choose");
  const [activeCategory, setActiveCategory] = useState<"flow" | "activate" | "rhythm">("flow");

  // Breathing pacer states for 03B Flow page
  const [inhale, setInhale] = useState(true);
  const [breathCount, setBreathCount] = useState(0);
  const [timerFlow, setTimerFlow] = useState(120); // 2 minutes flow
  const [isFlowPlaying, setIsFlowPlaying] = useState(true);

  // Breathing expand/contract loop
  useEffect(() => {
    if (bStep !== "flow" || !isFlowPlaying) return;
    const interval = setInterval(() => {
      setInhale((prev) => !prev);
      setBreathCount((c) => c + 0.5);
    }, 4000); // 4 seconds inhale, 4 seconds exhale

    return () => clearInterval(interval);
  }, [bStep, isFlowPlaying]);

  useEffect(() => {
    if (bStep !== "flow" || !isFlowPlaying) return;
    if (timerFlow <= 0) {
      setBStep("completed");
      return;
    }
    const tid = setTimeout(() => {
      setTimerFlow((t) => t - 1);
    }, 1000);
    return () => clearTimeout(tid);
  }, [timerFlow, bStep, isFlowPlaying]);

  const handleStartFlow = () => {
    setTimerFlow(120);
    setBStep("flow");
  };

  const handleStartActivate = () => {
    setBStep("activate");
  };

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24 px-4 pt-3 scrollbar-none" id="b_activity_view">
      <AnimatePresence mode="wait">
        {bStep === "choose" && (
          /* 02B | 身体探索选择页 */
          <motion.div
            key="choose"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Header navbar */}
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={onBackToHome}
                className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h3 className="text-sm font-bold text-slate-100">身体温和探索</h3>
                <p className="text-[10px] text-slate-400">状态还不错？不追求负荷，只是温柔活动关节噢</p>
              </div>
            </div>

            {/* Path description */}
            <div className="bg-gradient-to-r from-teal-950/20 to-indigo-950/20 border border-teal-500/10 p-5 rounded-2xl flex flex-col items-center">
              <MascotCharacter expression="cheer" size={90} />
              <p className="text-xs text-indigo-200 font-semibold text-center mt-3">
                『今天不需要追求标准训练，我们先让僵持的关节温柔地自转流动起来。』
              </p>
            </div>

            {/* Option Selection list */}
            <div className="space-y-3">
              {/* Option 2.1 - Flow */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                onClick={handleStartFlow}
                className="w-full text-left bg-slate-850/90 border border-slate-800/80 p-4.5 rounded-2xl flex items-center justify-between transition-all hover:border-teal-500/25"
              >
                <div>
                  <h4 className="font-bold text-slate-100 text-xs flex items-center gap-1.5">
                    <span className="text-base">🌿</span> 身体温和流动 (Stretch & Flow)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1">肩膀环绕、脊柱猫牛扭转、髋关节舒展流动（推荐）</p>
                </div>
                <span className="text-[11px] text-teal-400 font-bold bg-teal-950/60 px-2 py-1 rounded-lg">
                  2分钟 →
                </span>
              </motion.button>

              {/* Option 2.2 - Activate */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                onClick={handleStartActivate}
                className="w-full text-left bg-slate-850/90 border border-slate-800/80 p-4.5 rounded-2xl flex items-center justify-between transition-all hover:border-indigo-500/25"
              >
                <div>
                  <h4 className="font-bold text-slate-100 text-xs flex items-center gap-1.5">
                    <span className="text-base">✨</span> 深层核心激活 (Stablizers Active)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1">Bird Dog 鸟狗对角平衡、Dead Bug 仰卧死虫核心抗扭</p>
                </div>
                <span className="text-[11px] text-indigo-400 font-bold bg-indigo-950/60 px-2 py-1 rounded-lg">
                  自调练 →
                </span>
              </motion.button>
            </div>
          </motion.div>
        )}

        {bStep === "flow" && (
          /* 03B | 身体流动慢速页 */
          <motion.div
            key="flow"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col flex-1 items-center"
          >
            <div className="w-full flex items-center justify-between mb-6">
              <button
                onClick={() => setBStep("choose")}
                className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-350 text-xs"
              >
                返回
              </button>

              <span className="text-xs font-mono font-bold text-teal-400 bg-teal-950/60 border border-teal-500/20 py-1 px-3 rounded-full">
                ⏱️ 流动倒计时 {Math.floor(timerFlow / 60)}:{(timerFlow % 60).toString().padStart(2, "0")}
              </span>
            </div>

            <h3 className="text-sm font-extrabold text-teal-400 uppercase font-mono tracking-wider mb-1">Rhythmic expander</h3>
            <h2 className="text-base font-bold text-slate-205 mb-5 text-center">肩膀与双脊柱慢自转流动</h2>

            {/* Breathing expand/contract visual circle ring */}
            <div className="w-64 h-64 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center relative mb-8">
              {/* Dynamic breathing orb scale expansion */}
              <motion.div
                className="absolute rounded-full"
                animate={{
                  scale: inhale ? [1, 1.65] : [1.65, 1],
                  backgroundColor: inhale ? ["rgba(167, 139, 250, 0.15)", "rgba(45, 212, 191, 0.1)"] : ["rgba(45, 212, 191, 0.1)", "rgba(167, 139, 250, 0.15)"],
                  boxShadow: inhale 
                    ? ["0 0 0px rgba(45,212,191,0)", "0 0 25px rgba(45,212,191,0.25)"] 
                    : ["0 0 25px rgba(45,212,191,0.25)", "0 0 0px rgba(45,212,191,0)"]
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                style={{ width: "110px", height: "110px" }}
              />

              <div className="z-10 text-center flex flex-col items-center">
                <AudioLines className="w-5 h-5 text-teal-400 animate-pulse mb-2" />
                <span className="text-sm font-bold text-slate-100">{inhale ? "吸气 . 缓缓挺胸" : "呼气 . 温柔躬背"}</span>
                <span className="text-[10px] text-slate-500 font-mono mt-1">Breathing Cycle {Math.floor(breathCount)}</span>
              </div>
            </div>

            {/* Stage details */}
            <div className="w-full bg-slate-850 rounded-2xl p-4 border border-slate-800 text-xs mb-8">
              <span className="text-slate-500 uppercase font-mono tracking-wider font-bold block mb-2">当前阶段 Current Stages：</span>
              
              <div className="space-y-2 font-medium">
                <div className="flex items-center justify-between text-teal-400">
                  <span>● 1. 肩膀绕环与扩胸（自转拉伸）</span>
                  <span className="text-[10px] uppercase">ACTIVE</span>
                </div>
                <div className="text-slate-500">○ 2. 脊柱轻量猫牛扭骨</div>
                <div className="text-slate-500">○ 3. 髋部八字柔性绕环</div>
              </div>
            </div>

            {/* Play controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsFlowPlaying(!isFlowPlaying)}
                className="py-3 px-6 bg-slate-900 border border-slate-800 text-slate-300 font-medium text-xs rounded-xl flex items-center gap-1.5 hover:text-slate-100"
              >
                {isFlowPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />}
                <span>{isFlowPlaying ? "暂停吸吐" : "继续流动"}</span>
              </button>

              <button
                onClick={() => setBStep("completed")}
                className="py-3 px-6 bg-gradient-to-r from-teal-500 to-indigo-600 text-slate-100 font-bold text-xs rounded-xl shadow shadow-teal-900/10"
              >
                提前完成流动 ➔
              </button>
            </div>
          </motion.div>
        )}

        {bStep === "activate" && (
          /* 03B-2 | 身体激活页 */
          <motion.div
            key="activate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => setBStep("choose")}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-350 transition"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h3 className="text-xs font-bold text-slate-310">今日激活：核心抗扭与关节稳定</h3>
            </div>

            {/* Actions cards */}
            <div className="space-y-3">
              {/* Bird Dog */}
              <div className="bg-slate-850 p-4 rounded-2xl border border-slate-800 flex gap-3.5">
                <div className="w-8 h-8 rounded-full bg-indigo-950 border border-indigo-500/20 flex items-center justify-center font-mono text-xs font-bold text-indigo-400 shrink-0">
                  01
                </div>
                <div>
                  <h4 className="font-bold text-slate-205 text-sm">对角鸟狗支撑 (Bird Dog)</h4>
                  <p className="text-xs text-slate-400 mt-1">6次 × 2组 ｜ 激活深层腹横肌，抗旋转代偿</p>
                  <p className="text-[11px] text-indigo-400/85 mt-1.5">💡 对侧手脚并伸时，收小腹禁止塌腰，视线朝前下方</p>
                </div>
              </div>

              {/* Dead Bug */}
              <div className="bg-slate-850 p-4 rounded-2xl border border-slate-800 flex gap-3.5">
                <div className="w-8 h-8 rounded-full bg-indigo-950 border border-indigo-500/20 flex items-center justify-center font-mono text-xs font-bold text-indigo-400 shrink-0">
                  02
                </div>
                <div>
                  <h4 className="font-bold text-slate-205 text-sm">仰卧死虫抗阻 (Dead Bug)</h4>
                  <p className="text-xs text-slate-400 mt-1">8次 × 2组 ｜ 重塑骨盆前后动力链稳定性</p>
                  <p className="text-[11px] text-indigo-400/85 mt-1.5">💡 下腰背必须紧压实瑜伽垫，不可留有空隙</p>
                </div>
              </div>

              {/* Single Leg Balance */}
              <div className="bg-slate-850 p-4 rounded-2xl border border-slate-800 flex gap-3.5">
                <div className="w-8 h-8 rounded-full bg-teal-950 border border-teal-500/20 flex items-center justify-center font-mono text-xs font-bold text-teal-400 shrink-0">
                  03
                </div>
                <div>
                  <h4 className="font-bold text-slate-205 text-sm">单腿站立关节稳定 (Single Balance)</h4>
                  <p className="text-xs text-slate-400 mt-1">20秒 × 2侧 ｜ 训练足踝、膝、髋对位力线</p>
                  <p className="text-[11px] text-indigo-400/85 mt-1.5">💡 开启 AI 摄像头可以实时观察重心足骨盆倾斜角</p>
                </div>
              </div>
            </div>

            {/* AI Obsidian recommendation alert */}
            <div className="bg-teal-950/30 border border-teal-500/10 p-3.5 rounded-xl text-xs text-teal-300 leading-normal mb-4">
              ✨ <strong>核心小常识：</strong>鸟狗与死虫是最经典的“抗伸展”练习，长期坚持练习可从根源上缓解久坐族因后腰代偿引发的慢性背痛、臀肌无力。
            </div>

            <button
              onClick={() => setBStep("completed")}
              className="w-full py-4 bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-slate-100 font-bold rounded-xl text-xs text-center shadow-lg"
            >
              完成所有动作 ➔
            </button>
          </motion.div>
        )}

        {bStep === "completed" && (
          /* Finished stretch page */
          <motion.div
            key="completed"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8 space-y-5"
          >
            <MascotCharacter expression="cheer" size={130} glow={true} />

            <h2 className="text-xl font-black text-slate-100">流动活动已完成 🌟</h2>
            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
              你太棒了，今日身体流动打卡完毕！关节在缓慢活动下分泌了顺畅滑液，僵硬感开始退缩啦。
            </p>

            <div className="bg-slate-850 border border-slate-800 rounded-2xl p-4 text-xs max-w-xs mx-auto">
              🏆 特色奖励：小摩活力属性经验点数 +15！
            </div>

            <button
              onClick={onBackToHome}
              className="py-3.5 px-10 bg-gradient-to-r from-indigo-600 to-teal-500 text-slate-100 font-bold rounded-xl text-xs shadow hover:scale-102 transition"
            >
              解锁今日。回到首页
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
