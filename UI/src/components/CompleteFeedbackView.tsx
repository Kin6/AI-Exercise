import React, { useState } from "react";
import { MascotCharacter } from "./MascotCharacter";
import { Check, Heart, Trophy, Medal, Star, Compass, Home } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CompleteFeedbackViewProps {
  onBackToHome: () => void;
  onGoToArchive: () => void;
  observationSummary?: string;
}

export const CompleteFeedbackView: React.FC<CompleteFeedbackViewProps> = ({
  onBackToHome,
  onGoToArchive,
  observationSummary = "右肩有轻度耸起代偿，深呼吸控制良好",
}) => {
  const [reliefLevel, setReliefLevel] = useState<string>("轻松了一些");
  const [savedToArchive, setSavedToArchive] = useState(false);

  const reliefOptions = ["轻松了一些", "有一点缓解", "变化不明显"];

  const handleSaveToArchive = () => {
    // Save to local storage mock health log list
    const existingStr = localStorage.getItem("xiaomo_health_logs");
    const existing = existingStr ? JSON.parse(existingStr) : [];
    const newLog = {
      date: new Date().toLocaleDateString("zh-CN", { month: "short", day: "numeric" }),
      feeling: reliefLevel,
      mechanisms: ["斜方肌上束代偿过载度降低"],
      muscles: ["斜方肌上束", "深层颈屈肌"],
      relieved: reliefLevel,
      cameraObs: observationSummary,
      score: reliefLevel === "轻松了一些" ? 9 : reliefLevel === "有一点缓解" ? 7 : 4
    };
    localStorage.setItem("xiaomo_health_logs", JSON.stringify([newLog, ...existing]));

    // Increment consecutive count days
    const dayStreak = parseInt(localStorage.getItem("xiaomo_streak") || "3") + 1;
    localStorage.setItem("xiaomo_streak", dayStreak.toString());

    setSavedToArchive(true);
  };

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24 px-4 pt-4 scrollbar-none" id="complete_feedback_view">
      <AnimatePresence mode="wait">
        {!savedToArchive ? (
          /* A7 | 完成反馈页 */
          <motion.div
            key="a7"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-4"
          >
            {/* Mascot Cheer Banner */}
            <div className="bg-gradient-to-br from-indigo-950/80 to-slate-900 border border-indigo-500/15 rounded-3xl p-6 flex flex-col items-center shadow-xl">
              <MascotCharacter expression="completed" size={120} glow={true} />
              
              <h3 className="text-lg font-black text-slate-100 mt-4">今天恢复完成了！</h3>
              <p className="text-xs text-indigo-300 mt-1 font-mono">
                你已温柔地照顾了肩颈 6 分钟 ⏱️
              </p>
            </div>

            {/* Session statistics overview (A7) */}
            <div className="bg-slate-850/80 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase font-mono tracking-wider">本次恢复总结摘要：</h4>
              
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/40">
                  <Check className="w-4 h-4 text-purple-400 shrink-0" />
                  <span className="text-slate-300">
                    <strong>放松代偿区：</strong>斜方肌上束 / 肩胛提肌，张力减少 34%
                  </span>
                </div>
                
                <div className="flex items-center gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/40">
                  <Check className="w-4 h-4 text-teal-400 shrink-0" />
                  <span className="text-slate-300">
                    <strong>激活稳定区：</strong>深层颈屈肌 / 下颌力矩收束，稳定增加
                  </span>
                </div>

                <div className="flex items-center gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/40">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="text-slate-300">
                    <strong>AI观察反馈：</strong>{observationSummary}
                  </span>
                </div>
              </div>
            </div>

            {/* Interactive pain scale slider feedback */}
            <div className="bg-slate-850 rounded-2xl p-4 border border-slate-800">
              <p className="text-xs font-bold text-indigo-300 text-center mb-3">现在感觉怎么样？</p>
              
              <div className="grid grid-cols-3 gap-2">
                {reliefOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setReliefLevel(opt)}
                    className={`py-3 px-2 rounded-xl text-xs font-bold border transition-all ${
                      reliefLevel === opt
                        ? "bg-teal-950 border-teal-400 text-teal-300 shadow shadow-teal-500/10"
                        : "bg-slate-900 border-transparent text-slate-400 hover:border-slate-800"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Call to action */}
            <button
              onClick={handleSaveToArchive}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-slate-100 font-bold rounded-xl text-xs shadow-lg shadow-indigo-900/30 transition-transform active:scale-98 text-center"
            >
              📊 保存至身体档案页（进入 A8 成长反馈）
            </button>
          </motion.div>
        ) : (
          /* A8 | 保存后的身体成长反馈 */
          <motion.div
            key="a8"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Mascot Sparkle level up glowing panel */}
            <div className="bg-slate-850/90 border-2 border-dashed border-teal-500/20 rounded-3xl p-6 flex flex-col items-center relative overflow-hidden">
              <span className="absolute top-3 right-3 bg-teal-950/80 border border-teal-500/30 text-teal-300 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                Level Up!
              </span>

              {/* Glowing particles background effect */}
              <div className="absolute inset-0 bg-radial-glowing opacity-25 pointer-events-none" />

              <MascotCharacter expression="cheer" size={110} glow={true} />

              <h3 className="text-base font-black text-slate-100 mt-4 text-center">
                记录成功！小摩能量变亮了一些 ✨
              </h3>
              <p className="text-xs text-slate-400 text-center mt-1">
                你和身体配合默契。每一次微拉伸，都是对健康的温柔誓言！
              </p>
            </div>

            {/* Growth statistics achievements cards */}
            <div className="bg-slate-850 rounded-2xl p-4 border border-slate-810 space-y-3.5">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase font-mono tracking-wider">
                <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                <span>今天身体档案新增成长：</span>
              </h4>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center gap-2.5">
                  <div className="bg-purple-950 text-purple-400 p-2 rounded-lg font-bold font-mono text-center min-w-[36px] border border-purple-500/20 shrink-0">
                    +1
                  </div>
                  <div>
                    <span className="text-slate-200 font-bold block">肩颈恢复经验</span>
                    <span className="text-[10px] text-slate-400">解除代偿乳酸</span>
                  </div>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center gap-2.5">
                  <div className="bg-teal-950 text-teal-400 p-2 rounded-lg font-bold font-mono text-center min-w-[36px] border border-teal-500/20 shrink-0">
                    +1
                  </div>
                  <div>
                    <span className="text-slate-200 font-bold block">肩胛稳定练习</span>
                    <span className="text-[10px] text-slate-400">深层肌群收缩</span>
                  </div>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center gap-2.5">
                  <div className="bg-cyan-950 text-cyan-400 p-2 rounded-lg font-bold font-mono text-center min-w-[36px] border border-cyan-500/20 shrink-0">
                    +1
                  </div>
                  <div>
                    <span className="text-slate-200 font-bold block">动作观察记录</span>
                    <span className="text-[10px] text-slate-400">骨线对称分析</span>
                  </div>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center gap-2.5">
                  <div className="bg-amber-950 text-amber-400 p-2 rounded-lg font-bold font-mono text-center min-w-[36px] border border-amber-500/20 shrink-0">
                    4天
                  </div>
                  <div>
                    <span className="text-slate-200 font-bold block">连续打卡健康</span>
                    <span className="text-[10px] text-slate-400">坚持成习惯</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Smart mascot suggestion bubbles */}
            <div className="bg-indigo-950/40 border border-indigo-500/10 p-4 rounded-2xl">
              <span className="text-[10px] text-indigo-400 font-bold uppercase block tracking-wider">小摩贴心健康信使</span>
              <p className="text-xs text-indigo-200/90 leading-relaxed mt-1.5 font-semibold">
                『思琪，AI骨架检测发现你稍微耸肩。下次我们可以增加针对中下斜方肌的“W字扩开”和“招财猫”肩胛骨稳定运动，多做热敷噢。』
              </p>
            </div>

            {/* Two major redirects button rows */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={onGoToArchive}
                className="py-3.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-indigo-400 hover:text-indigo-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Compass className="w-4 h-4" />
                查看身体档案 (A9)
              </button>

              <button
                onClick={onBackToHome}
                className="py-3.5 bg-gradient-to-r from-teal-500 to-indigo-600 text-slate-100 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition active:scale-98"
              >
                <Home className="w-4 h-4" />
                返回今日首页
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
