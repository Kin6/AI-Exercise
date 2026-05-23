import React, { useState, useEffect } from "react";
import { MascotCharacter } from "./MascotCharacter";
import { MASCOT_LEVELS } from "../data/staticData";
import { HistoryRecord } from "../types";
import { Award, Zap, Calendar, Heart, ShieldQuestion, HelpCircle } from "lucide-react";
import { motion } from "motion/react";

interface ProgressHistoryProps {
  onBackToHome: () => void;
}

export const ProgressHistory: React.FC<ProgressHistoryProps> = ({ onBackToHome }) => {
  const [logs, setLogs] = useState<HistoryRecord[]>([]);
  const [streak, setStreak] = useState(4);
  const [selectedJoint, setSelectedJoint] = useState<"shoulder" | "lumbar" | "knee">("shoulder");

  useEffect(() => {
    // Read from localStorage to coordinate logged sessions
    const saved = localStorage.getItem("xiaomo_health_logs");
    if (saved) {
      setLogs(JSON.parse(saved));
    } else {
      // Setup some rich initial mock logs for stunning dashboard rendering
      const initialLogs: HistoryRecord[] = [
        {
          date: "5月22日",
          feeling: "轻松了一些",
          mechanisms: ["斜方肌过度代偿解除"],
          muscles: ["上斜方肌", "肩胛提肌"],
          relieved: "轻松了一些",
          cameraObs: "右肩稍微高耸 1.2cm",
          score: 8
        },
        {
          date: "5月21日",
          feeling: "有一点缓解",
          mechanisms: ["腰肌过载降低"],
          muscles: ["背部竖脊肌", "腹横肌"],
          relieved: "有一点缓解",
          cameraObs: "骨盆倾斜角 2.5°",
          score: 7
        },
        {
          date: "5月19日",
          feeling: "轻松了一些",
          mechanisms: ["斜方肌僵直松解"],
          muscles: ["上斜方肌"],
          relieved: "轻松了一些",
          cameraObs: "右肩高拔代偿 1.5cm",
          score: 9
        }
      ];
      localStorage.setItem("xiaomo_health_logs", JSON.stringify(initialLogs));
      setLogs(initialLogs);
    }

    const savedStreak = localStorage.getItem("xiaomo_streak");
    if (savedStreak) {
      setStreak(parseInt(savedStreak));
    } else {
      localStorage.setItem("xiaomo_streak", "4");
    }
  }, []);

  const calendarDays = [
    { day: "一", status: "rest", date: 18 },
    { day: "二", status: "rest", date: 19 },
    { day: "三", status: "bad", date: 20 }, // 🟡 completed discomfort
    { day: "四", status: "good", date: 21 }, // 🟢 good
    { day: "五", status: "good", date: 22 }, // 🟢 good
    { day: "六", status: "good", date: 23 }, // 🟢 good
    { day: "日", status: "rest", date: 24 },
  ];

  const jointMetrics = {
    shoulder: {
      name: "双侧肩峰/颈肩关节力线",
      frequency: "本周出现 3 次发胀",
      deviation: "右耸肩偏移度: 1.4厘米",
      tensionLevel: 78,
      suggest: "下巴内收到中立 + 激活中下斜方肌舒展开肩"
    },
    lumbar: {
      name: "胸腰椎段/下腰骨盆平衡",
      frequency: "本周出现 1 次发胀",
      deviation: "骨盆左右倾侧: 2.1度",
      tensionLevel: 45,
      suggest: "经常性四足跪姿鸟狗支撑 + 腹深层核心力量补强"
    },
    knee: {
      name: "双侧髌股关节力线轨迹",
      frequency: "本周完成 2 次稳定性加强",
      deviation: "髌骨向外侧平移: 0.5毫米",
      tensionLevel: 32,
      suggest: "蚌式开合收缩臀中肌稳定骨盆 + 慢深蹲中段对齐"
    }
  };

  const handleClearHistory = () => {
    localStorage.removeItem("xiaomo_health_logs");
    localStorage.setItem("xiaomo_streak", "1");
    setLogs([]);
    setStreak(1);
  };

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24 px-4 pt-4 scrollbar-none" id="progress_history">
      {/* Target levels title card (A9) */}
      <div className="bg-slate-850 border border-slate-800 rounded-3xl p-4 flex items-center gap-4 mb-5 shadow-lg">
        <div className="bg-indigo-950/60 p-2.5 rounded-2xl border border-indigo-500/10">
          <MascotCharacter expression="cheer" size={68} glow={false} />
        </div>
        
        <div>
          <span className="text-[9px] text-teal-400 font-mono tracking-widest uppercase font-bold bg-teal-950/50 px-2 py-0.5 rounded-full border border-teal-500/10">
            {MASCOT_LEVELS[2].title} (Lv.2)
          </span>
          <h3 className="text-sm font-black text-slate-105 mt-1">
            小摩状态：轻松放松中 🧘
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            你已连续照顾身体 <strong className="text-indigo-400 font-bold">{streak}天</strong>，干得不错！
          </p>
        </div>
      </div>

      {/* Monthly grid tracker block */}
      <div className="bg-slate-850/80 border border-slate-800 rounded-2xl p-4 mb-5">
        <div className="flex items-center justify-between mb-3.5">
          <h4 className="text-xs font-bold text-slate-350 flex items-center gap-1.5 uppercase font-mono tracking-wider">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span>本月护理恢复周历表</span>
          </h4>
          <span className="text-[10px] text-slate-400 font-semibold font-mono">5月 May</span>
        </div>

        <div className="grid grid-cols-7 gap-2.5 mb-3.5">
          {calendarDays.map((cal, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <span className="text-[10px] text-slate-500 font-bold mb-1">{cal.day}</span>
              <div className={`w-8 h-8 rounded-xl font-bold font-mono text-xs flex items-center justify-center border transition-all ${
                cal.status === "bad"
                  ? "bg-amber-950/70 border-amber-500/40 text-amber-400"
                  : cal.status === "good"
                    ? "bg-teal-950/70 border-teal-500/40 text-teal-400"
                    : "bg-slate-900 border-slate-800/80 text-slate-600"
              }`}>
                {cal.date}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[10px] text-slate-500 border-t border-slate-800/60 pt-2 font-medium justify-center">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-amber-500/20 border border-amber-500/40 inline-block" />
            <span>有不适并完成恢复 (🟡)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-teal-500/20 border border-teal-500/40 inline-block" />
            <span>感觉疼痛有缓解 (🟢)</span>
          </div>
        </div>
      </div>

      {/* Interactive stickman postural map segment */}
      <div className="bg-slate-850 rounded-2xl p-4 border border-slate-800 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase font-mono tracking-wider">
            身体压力地图 (骨架力线热力)
          </h4>
          <span className="text-[9px] text-slate-500 font-mono font-bold">CLICK NODES TO WEIGH</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Mannequin stickman */}
          <div className="w-[110px] aspect-[4/9] bg-slate-900 rounded-xl relative overflow-hidden flex items-center justify-center border border-slate-800/40 shrink-0">
            <svg width="100%" height="100%" viewBox="0 0 100 200" className="p-3">
              {/* Spine core */}
              <path d="M50,30 L50,130 M30,55 L70,55 M33,130 L67,130" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
              
              {/* Head */}
              <circle cx="50" cy="22" r="10" fill="rgba(99, 102, 241, 0.15)" stroke="#6366F1" strokeWidth="1.5" />

              {/* Clicking Target 1 - Shoulder */}
              <g className="cursor-pointer" onClick={() => setSelectedJoint("shoulder")}>
                <circle cx="50" cy="55" r="9" fill={selectedJoint === "shoulder" ? "rgba(99, 102, 241, 0.45)" : "transparent"} />
                <circle cx="50" cy="55" r="4.5" fill={selectedJoint === "shoulder" ? "#22D3EE" : "#475569"} stroke="#0F172A" strokeWidth="1.5" />
              </g>

              {/* Clicking Target 2 - Lumbar */}
              <g className="cursor-pointer" onClick={() => setSelectedJoint("lumbar")}>
                <circle cx="50" cy="95" r="9" fill={selectedJoint === "lumbar" ? "rgba(244, 63, 94, 0.45)" : "transparent"} />
                <circle cx="50" cy="95" r="4.5" fill={selectedJoint === "lumbar" ? "#F43F5E" : "#475569"} stroke="#0F172A" strokeWidth="1.5" />
              </g>

              {/* Clicking Target 3 - Knee */}
              <g className="cursor-pointer" onClick={() => setSelectedJoint("knee")}>
                <circle cx="50" cy="155" r="9" fill={selectedJoint === "knee" ? "rgba(16, 185, 129, 0.45)" : "transparent"} />
                <circle cx="50" cy="155" r="4.5" fill={selectedJoint === "knee" ? "#10B981" : "#475569"} stroke="#0F172A" strokeWidth="1.5" />
              </g>

              {/* Leg lines */}
              <path d="M33,130 L33,155 L33,185 M67,130 L67,155 L67,185" fill="none" stroke="#273549" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          {/* Righthand: metrics overlay readout */}
          <div className="flex-1 min-w-0">
            <span className="text-[10px] text-indigo-400 font-mono font-bold uppercase tracking-wider block">
              关节评估参数
            </span>
            <h5 className="font-bold text-slate-205 text-xs truncate mt-0.5">
              {jointMetrics[selectedJoint].name}
            </h5>

            <div className="space-y-1.5 mt-2.5 text-[11px] text-slate-400 font-medium">
              <p className="flex items-center gap-1">
                📅 <span className="truncate">{jointMetrics[selectedJoint].frequency}</span>
              </p>
              <p className="flex items-center gap-1 text-slate-350">
                ⚠️ <span className="truncate">{jointMetrics[selectedJoint].deviation}</span>
              </p>
              <p className="flex items-center gap-1">
                ⏱️ 建议：
                <span className="text-indigo-300 font-bold hover:underline cursor-help">
                  {jointMetrics[selectedJoint].suggest.split(" + ")[0]}
                </span>
              </p>
            </div>

            {/* Custom gauge render */}
            <div className="mt-3 bg-slate-900/60 p-2 rounded-xl border border-slate-800/60">
              <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1 font-mono">
                <span>肌肉紧张劳损指数</span>
                <span className="font-bold text-rose-400">{jointMetrics[selectedJoint].tensionLevel}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-teal-400 to-rose-500 transition-all duration-300"
                  style={{ width: `${jointMetrics[selectedJoint].tensionLevel}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Week overview analytics */}
      <div className="bg-slate-850/80 border border-slate-800 rounded-2xl p-4 mb-6">
        <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-1 uppercase font-mono tracking-wider">
          <Award className="w-4 h-4 text-teal-400" />
          <span>本周照顾身体变化趋势</span>
        </h4>

        <div className="space-y-2 text-xs">
          <div className="bg-slate-900 border border-slate-800/60 p-3 rounded-xl flex items-center justify-between">
            <span className="text-slate-400">肩颈紧张频率 (Scapulae Area)</span>
            <span className="text-emerald-400 bg-emerald-950/45 px-2 py-0.5 rounded-full font-bold">稳步下降 ↓</span>
          </div>
          <div className="bg-slate-900 border border-slate-800/60 p-3 rounded-xl flex items-center justify-between">
            <span className="text-slate-400">右肩代偿耸肩问题 (Shrugging Trapezius)</span>
            <span className="text-amber-400 bg-amber-950/45 px-2 py-0.5 rounded-full font-bold">仍需观察 ⚠️</span>
          </div>
        </div>
      </div>

      {/* Real logs detail viewer list */}
      <h4 className="text-xs font-bold text-slate-400 mb-3 uppercase font-mono tracking-wider">
        历史打卡记录明细 ({logs.length}次)
      </h4>

      <div className="space-y-2.5 mb-6">
        {logs.length > 0 ? (
          logs.map((log, idx) => (
            <div key={idx} className="bg-slate-850 border border-slate-800 rounded-xl p-3.5 relative">
              <span className="absolute top-3.5 right-3.5 text-[10px] text-slate-500 font-mono font-bold">{log.date}</span>
              <p className="text-xs font-bold text-slate-200">
                🎯 {log.muscles.join(" & ")} 恢复
              </p>
              
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800/40 text-[11px] text-slate-400">
                <div>
                  <span className="text-slate-500">感觉变化：</span>
                  <span className="text-teal-400 font-semibold">{log.feeling}</span>
                </div>
                {log.cameraObs && (
                  <div>
                    <span className="text-slate-500">AI观察：</span>
                    <span className="text-cyan-400 font-medium truncate inline-block max-w-[120px]">{log.cameraObs}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-slate-900 text-center py-8 rounded-2xl border border-slate-800">
            <p className="text-xs text-slate-500">现在还没有打卡记录噢。赶紧开启一个恢复方案吧！</p>
          </div>
        )}
      </div>

      {/* Clear logs helper */}
      {logs.length > 0 && (
        <button
          onClick={handleClearHistory}
          className="text-[10px] text-slate-600 hover:text-rose-500 text-center font-mono hover:underline mb-12 block"
        >
          RESET / 清空历史打卡记录数据
        </button>
      )}
    </div>
  );
};
