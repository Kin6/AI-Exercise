import React, { useState } from "react";
import { DiagnosisData } from "../types";
import { ArrowLeft, Sparkles, AlertTriangle, ShieldAlert, Check, Milestone, Zap } from "lucide-react";
import { motion } from "motion/react";

interface DiagnosticsPanelProps {
  diagnosisData: DiagnosisData;
  onBack: () => void;
  onStartRoutine: () => void;
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({
  diagnosisData,
  onBack,
  onStartRoutine,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"findings" | "muscles" | "plan">("findings");

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24 px-4 pt-4 scrollbar-none" id="diagnostics_panel">
      {/* Top Header navbar */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="text-sm font-extrabold text-indigo-400 font-mono tracking-wider uppercase">Kinesiologic Diagnosis</h3>
          <h2 className="text-base font-bold text-slate-100">小摩身体力学理解</h2>
        </div>
      </div>

      {/* Tri-stage Top Navigation Tabs */}
      <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 mb-5">
        <button
          onClick={() => setActiveSubTab("findings")}
          className={`flex-1 py-2 text-center text-xs rounded-lg font-bold transition-all ${
            activeSubTab === "findings"
              ? "bg-indigo-950 text-indigo-300 shadow"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          A2 代偿理解
        </button>
        <button
          onClick={() => setActiveSubTab("muscles")}
          className={`flex-1 py-1.5 text-center text-xs rounded-lg font-bold transition-all ${
            activeSubTab === "muscles"
              ? "bg-indigo-950 text-indigo-300 shadow"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          A3 肌肉溯源
        </button>
        <button
          onClick={() => setActiveSubTab("plan")}
          className={`flex-1 py-1.5 text-center text-xs rounded-lg font-bold transition-all ${
            activeSubTab === "plan"
              ? "bg-indigo-950 text-indigo-300 shadow"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          A4 恢复方案
          <span className="ml-1 px-1 bg-teal-900 border border-teal-500/30 text-teal-300 text-[8px] rounded-full uppercase">NEW</span>
        </button>
      </div>

      {/* Main Container contents based on tab */}
      <div className="flex-1">
        {activeSubTab === "findings" && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* AI Diagnosis block */}
            <div className="bg-slate-850/80 border border-indigo-500/15 rounded-2xl p-4 shadow-md">
              <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-xs mb-2">
                <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                <span>AI核心理解判定</span>
              </div>
              <p className="text-sm text-slate-100 font-semibold leading-relaxed">
                {diagnosisData.diagnosis}
              </p>
            </div>

            {/* Kinetic Chain Graphic diagram (A2) */}
            <div className="bg-slate-850/70 border border-slate-800 rounded-2xl p-4">
              <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-1.5">
                <Milestone className="w-4 h-4 text-cyan-400" />
                <span>代偿发生力线机制（Flow Chart）：</span>
              </h4>

              {/* Sequential nodes */}
              <div className="space-y-2 relative pl-3.5 border-l border-indigo-500/15">
                {diagnosisData.mechanisms.map((mech, idx) => (
                  <div key={idx} className="relative py-1">
                    {/* Circle bulb indicator */}
                    <span className="absolute left-[-18.5px] top-[10px] w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-slate-900" />
                    <p className="text-xs text-slate-300 leading-relaxed font-medium">
                      {mech}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Disclaimer */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3 flex gap-2">
              <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-500 leading-normal">
                免责提示：本身体理解图谱基于小摩日常健康评估算法力学推理，不属于医学诊疗方案。如遇持续疼痛难忍，请及时寻求临床医疗建议。
              </p>
            </div>
          </motion.div>
        )}

        {activeSubTab === "muscles" && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3.5"
          >
            {/* Question title */}
            <div className="bg-indigo-950/20 border border-indigo-500/10 p-4 rounded-2xl">
              <h4 className="text-xs font-bold text-indigo-300">为什么不建议粗暴拉伸痛处？</h4>
              <p className="text-xs text-indigo-200/90 leading-relaxed mt-1.5">
                因为痛处往往是『过度受挫代偿』的表层肌肉，其深层稳定肌其实早已经失活关机。只拉深表层，无法纠正根本力线，必须要：<strong className="text-teal-400 font-bold">先放松过载区，再激活深层稳定。</strong>
              </p>
            </div>

            {/* Muscles mapping list */}
            {diagnosisData.muscles.map((muscle, idx) => (
              <div
                key={idx}
                className="bg-slate-850/80 border border-slate-800/80 rounded-2xl p-4 hover:border-indigo-500/25 transition-all relative"
              >
                <span className="absolute right-4 top-4 text-xs font-mono font-bold text-slate-700">0{idx + 1}</span>
                <h5 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
                  {muscle.name}
                </h5>

                <div className="grid grid-cols-1 gap-2 mt-3.5 pt-3.5 border-t border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-500 block mb-0.5">📍 位置解剖</span>
                    <span className="text-slate-300 font-medium">{muscle.position}</span>
                  </div>
                  <div className="mt-1">
                    <span className="text-rose-400 block mb-0.5">⚠️ 力学问题</span>
                    <span className="text-slate-300 font-medium">{muscle.issue}</span>
                  </div>
                  <div className="mt-1">
                    <span className="text-cyan-400 block mb-0.5">😫 身体痛感</span>
                    <span className="text-slate-300 font-medium">{muscle.feeling}</span>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {activeSubTab === "plan" && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Plan Goals overview card */}
            <div className="bg-slate-850 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">Relief Target</p>
                <h4 className="text-sm font-bold text-slate-200 mt-1">
                  目标：减少关节代偿 / 舒活发卡肌
                </h4>
              </div>
              <div className="bg-teal-950 border border-teal-500/25 py-1 px-2.5 rounded-lg text-teal-400 font-mono text-xs font-bold shrink-0">
                ⏱️ 预计 6 分钟
              </div>
            </div>

            {/* Horizontal sequential logic banner */}
            <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/60 text-[11px] text-indigo-300 flex items-center justify-between font-medium">
              <span>放松过载代偿区 (1)</span>
              <span>➔</span>
              <span>激活深层稳定 (2)</span>
              <span>➔</span>
              <span>AI骨线姿势纠错 (3)</span>
            </div>

            {/* List of actions with index cards */}
            <div className="space-y-3">
              {diagnosisData.routine.map((act) => (
                <div
                  key={act.step}
                  className="bg-slate-850/90 border border-slate-800 rounded-xl p-3.5 flex items-center gap-3"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    act.type === "relax"
                      ? "bg-purple-950 border border-purple-500/40 text-purple-400"
                      : act.type === "activate"
                        ? "bg-teal-950 border border-teal-500/40 text-teal-400"
                        : "bg-cyan-950 border border-cyan-500/40 text-cyan-400"
                  }`}>
                    {act.step}
                  </div>

                  <div className="flex-1 pr-1.5 min-w-0">
                    <div className="flex items-center justify-between">
                      <h6 className="font-bold text-slate-250 text-xs truncate">{act.name}</h6>
                      <span className="font-mono text-[10px] text-slate-400 shrink-0 font-bold">{act.duration}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{act.focus}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Persistent Primary start action button */}
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-slate-950 border-t border-slate-900 px-4 py-4 z-40">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={onStartRoutine}
          className="w-full bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-slate-100 font-bold py-3.5 rounded-xl shadow-lg shadow-teal-900/20 text-xs flex items-center justify-center gap-2"
        >
          <Zap className="w-4 h-4 fill-cyan-400 stroke-none animate-bounce" />
          开启今日恢复训练 (A5 | A6 实时进行)
        </motion.button>
      </div>
    </div>
  );
};
