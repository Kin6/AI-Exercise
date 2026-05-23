import React, { useState } from "react";
import { DISCOMFORT_FEELS, SCENARIOS } from "../data/staticData";
import { ArrowLeft, User, Activity } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AssessmentPanelProps {
  onBack: () => void;
  onSubmitAssessment: (data: {
    feels: string[];
    areaId: string;
    scenario: string;
  }) => void;
}

export const AssessmentPanel: React.FC<AssessmentPanelProps> = ({
  onBack,
  onSubmitAssessment,
}) => {
  const [selectedFeels, setSelectedFeels] = useState<string[]>([]);
  const [activeArea, setActiveArea] = useState<string>("neck");
  const [selectedScenario, setSelectedScenario] = useState<string>(SCENARIOS[0]);

  const toggleFeel = (feelId: string) => {
    setSelectedFeels((prev) =>
      prev.includes(feelId) ? prev.filter((id) => id !== feelId) : [...prev, feelId]
    );
  };

  const handleAreaClick = (areaId: string) => {
    setActiveArea(areaId);
  };

  const areaLabels: Record<string, string> = {
    neck: "颈后/双侧斜方肌",
    back: "下腰椎/坚硬竖脊肌",
    legs: "双大腿外侧/髌股软韧带",
    全身: "全身多处代偿僵直",
  };

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24 px-4 pt-3 scrollbar-none" id="assessment_panel">
      {/* Top Header navbar */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="text-base font-bold text-slate-100">身体觉察</h3>
          <p className="text-[10px] text-slate-400">倾听身体的求救，不盲目开始拉伸</p>
        </div>
      </div>

      {/* 1. Feelings selector row */}
      <div className="mb-6">
        <p className="text-xs font-bold text-indigo-300 mb-2.5">1. 今天受累的肌肉最明显的感受是什么？ (多选)</p>
        <div className="grid grid-cols-3 gap-2">
          {DISCOMFORT_FEELS.map((feel) => {
            const isSelected = selectedFeels.includes(feel.id);
            return (
              <button
                key={feel.id}
                onClick={() => toggleFeel(feel.id)}
                className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                  isSelected
                    ? "bg-indigo-950/90 border-indigo-400 text-indigo-300 shadow shadow-indigo-500/10"
                    : "bg-slate-850/80 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <span>{feel.icon}</span>
                <span>{feel.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Graphical vector body selector */}
      <div className="mb-6 bg-slate-850/70 border border-slate-800 rounded-2xl p-4 flex gap-4">
        {/* Lefthand side: interactive vector mannequin */}
        <div className="flex-1 max-w-[140px] bg-slate-900/60 rounded-xl py-4 flex flex-col items-center relative overflow-hidden border border-slate-800/40">
          <p className="text-[9px] text-slate-500 font-mono tracking-wider absolute top-1">BODY MAP</p>

          <svg width="100%" height="210" viewBox="0 0 100 210" className="mt-2">
            {/* Background wireframe lines */}
            <circle cx="50" cy="105" r="50" fill="none" stroke="rgba(99, 102, 241, 0.04)" strokeWidth="1" />
            <line x1="15" y1="105" x2="85" y2="105" stroke="rgba(99, 102, 241, 0.04)" strokeWidth="1" />
            <line x1="50" y1="30" x2="50" y2="180" stroke="rgba(99, 102, 241, 0.04)" strokeWidth="1" />

            {/* Simple Elegant Human Posture Vector */}
            {/* Head */}
            <circle
              cx="50"
              cy="38"
              r="11"
              fill={activeArea === "neck" ? "#818CF8" : "#475569"}
              className="transition-colors duration-200"
              opacity="0.8"
            />
            {/* Spine & Torso Core */}
            <path
              d="M 50 49 L 50 120 M 35 60 L 65 60 M 35 60 L 40 120 L 60 120 L 65 60 Z"
              fill="none"
              stroke="#334155"
              strokeWidth="2.5"
            />
            {/* Legs */}
            <path
              d="M 40 120 L 35 175 M 60 120 L 65 175"
              fill="none"
              stroke="#273549"
              strokeWidth="3"
            />

            {/* Hotspots layer with responsive glowing rings and pulsing elements */}
            {/* Neck shoulder zone (Y: 52) */}
            <g className="cursor-pointer" onClick={() => handleAreaClick("neck")}>
              {activeArea === "neck" && (
                <circle cx="50" cy="52" r="14" fill="none" stroke="#22D3EE" strokeWidth="1.5" className="animate-ping" style={{ transformOrigin: "50px 52px" }} />
              )}
              <circle cx="50" cy="52" r="7" fill={activeArea === "neck" ? "#22D3EE" : "#334155"} stroke="#1E1B4B" strokeWidth="1.5" />
            </g>

            {/* Low back lumbar zone (Y: 96) */}
            <g className="cursor-pointer" onClick={() => handleAreaClick("back")}>
              {activeArea === "back" && (
                <circle cx="50" cy="96" r="14" fill="none" stroke="#F43F5E" strokeWidth="1.5" className="animate-ping" style={{ transformOrigin: "50px 96px" }} />
              )}
              <circle cx="50" cy="96" r="7" fill={activeArea === "back" ? "#F43F5E" : "#334155"} stroke="#1E1B4B" strokeWidth="1.5" />
            </g>

            {/* Knee/Leg Zone (Y: 152) */}
            <g className="cursor-pointer" onClick={() => handleAreaClick("legs")}>
              {activeArea === "legs" && (
                <circle cx="50" cy="152" r="14" fill="none" stroke="#10B981" strokeWidth="1.5" className="animate-ping" style={{ transformOrigin: "50px 152px" }} />
              )}
              <circle cx="50" cy="152" r="7" fill={activeArea === "legs" ? "#10B981" : "#334155"} stroke="#1E1B4B" strokeWidth="1.5" />
            </g>
          </svg>
        </div>

        {/* Righthand side: details selection list */}
        <div className="flex-1 flex flex-col justify-center">
          <p className="text-[10px] text-slate-500 font-mono tracking-wider uppercase mb-1">Active Region</p>
          <h4 className="font-bold text-slate-250 text-base mb-3 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block animate-pulse" />
            {areaLabels[activeArea]}
          </h4>
          
          <div className="space-y-2">
            <button
              onClick={() => handleAreaClick("neck")}
              className={`w-full text-left py-2 px-3 rounded-xl border text-xs transition-all ${
                activeArea === "neck"
                  ? "bg-slate-800 border-cyan-400/40 text-cyan-400"
                  : "bg-slate-900 border-transparent text-slate-400"
              }`}
            >
              🎯 颈后 / 双侧斜方肌
            </button>
            <button
              onClick={() => handleAreaClick("back")}
              className={`w-full text-left py-2 px-3 rounded-xl border text-xs transition-all ${
                activeArea === "back"
                  ? "bg-slate-800 border-rose-400/40 text-rose-400"
                  : "bg-slate-900 border-transparent text-slate-400"
              }`}
            >
              🎯 后躯 / 腰部竖脊肌
            </button>
            <button
              onClick={() => handleAreaClick("legs")}
              className={`w-full text-left py-2 px-3 rounded-xl border text-xs transition-all ${
                activeArea === "legs"
                  ? "bg-slate-800 border-emerald-400/40 text-emerald-400"
                  : "bg-slate-900 border-transparent text-slate-400"
              }`}
            >
              🎯 腿部 / 髂胫外侧肌
            </button>
          </div>
        </div>
      </div>

      {/* 3. Normal scenarios trigger */}
      <div className="mb-8">
        <p className="text-xs font-bold text-indigo-300 mb-2.5">3. 绝大多数时候发生或诱发在什么场景下？</p>
        <div className="space-y-2">
          {SCENARIOS.map((scen, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedScenario(scen)}
              className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-center justify-between ${
                selectedScenario === scen
                  ? "bg-indigo-950/70 border-indigo-500 text-indigo-200"
                  : "bg-slate-850/80 border-slate-800/80 text-slate-400 hover:border-slate-700"
              }`}
            >
              <span>{scen}</span>
              <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                selectedScenario === scen ? "border-indigo-400 bg-indigo-500" : "border-slate-600"
              }`}>
                {selectedScenario === scen && <span className="w-1.5 h-1.5 bg-slate-950 rounded-full" />}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Little Mo speaker tag */}
      <div className="bg-indigo-950/45 border border-indigo-500/10 rounded-2xl p-4 flex items-center gap-3.5 mb-6">
        <div className="bg-slate-900 w-11 h-11 rounded-full flex items-center justify-center shrink-0 border border-indigo-500/20 shadow">
          💬
        </div>
        <p className="text-xs text-indigo-200/90 leading-relaxed font-medium">
          小摩提示：『我已经大概感应到了你的代偿发胀位置，现在让我们一键生成深度代偿剖析吧！』
        </p>
      </div>

      {/* Trigger generator button */}
      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => onSubmitAssessment({
          feels: selectedFeels,
          areaId: activeArea,
          scenario: selectedScenario
        })}
        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-slate-100 font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-900/30 text-xs flex items-center justify-center gap-2"
      >
        <Activity className="w-4 h-4 animate-pulse" />
        进入 A2 | 生成身体理解剖析
      </motion.button>
    </div>
  );
};
