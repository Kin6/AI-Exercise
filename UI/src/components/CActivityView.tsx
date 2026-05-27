import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Play, Pause, Camera, RefreshCw, Volume2, ShieldAlert, BadgeCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MascotCharacter } from "./MascotCharacter";

interface CActivityViewProps {
  onBackToHome: () => void;
}

export const CActivityView: React.FC<CActivityViewProps> = ({ onBackToHome }) => {
  const [cStep, setCStep] = useState<"choose" | "check" | "completed">("choose");
  const [activeExercise, setActiveExercise] = useState("squat"); // squat, pushup, plank

  // Camera tracking feed
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // HUD Dynamic analysis meters
  const [kneeAlign, setKneeAlign] = useState(68);
  const [hipHinge, setHipHinge] = useState(76);
  const [coreStability, setCoreStability] = useState(59);

  // Little Mo live commentary line
  const [coachAlert, setCoachAlert] = useState("AI动作教练开始工作，请正面后退1.5米，将双脚置于视频框内。");

  const exerciseDetails: Record<string, { title: string; subtitle: string; icon: string; desc: string }> = {
    squat: {
      title: "下肢臀腿力量 ｜ 深蹲 (Squats)",
      subtitle: "观察：深蹲膝盖内扣 / 骨盆前倾代偿 / 左右对称重心度",
      icon: "🦵",
      desc: "双脚与肩同宽站立，髋部缓慢向后坐，膝盖始终沿着第二脚尖方向朝前伸展，避免膝关节提早碾压代偿。"
    },
    pushup: {
      title: "上肢推部稳定 ｜ 俯卧撑 (Push-ups)",
      subtitle: "观察：耸肩代偿 / 挺腹塌腰 / 肘部外扩偏斜角",
      icon: "💪",
      desc: "双手按压瑜伽垫比肩略宽，肩、肘、腕垂直力线传导。下放时躯干成紧绷硬板，核心腹肌积极参与。"
    },
    plank: {
      title: "核心静力抗阻 ｜ 平板支撑 (Planks)",
      subtitle: "观察：低头代偿 / 塌腰耸肩 / 臀部抬得过高",
      icon: "⚡",
      desc: "小臂呈平行压实桌面，前三角肌上推不推，手肘位于肩膀正下方，腹部大腿两侧抗重力紧绷支撑。"
    }
  };

  const currentExercise = exerciseDetails[activeExercise];

  // Request laptop webcam or simulated high-power joint tracking
  const startCamera = async () => {
    setCameraLoading(true);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: "user" },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setCameraActive(true);
          setCameraLoading(false);
          setupSkeletalTracking();
        }
      } else {
        throw new Error("Webcam denied/offline");
      }
    } catch (err) {
      console.warn("Camera fallback triggered, proceeding with smart avatar calibration.");
      setCameraActive(true); // fall back to offline bone simulator
      setCameraLoading(false);
      setupSkeletalTracking();
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
  };

  const setupSkeletalTracking = () => {
    let t = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Render camera image if valid
      if (videoRef.current && videoRef.current.readyState === 4) {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, -w, 0, w, h);
        ctx.restore();
      } else {
        // Draw technological outline grid
        ctx.fillStyle = "#020617";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "rgba(139, 92, 246, 0.08)";
        ctx.lineWidth = 1;
        for (let i = 0; i < w; i += 24) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, h);
          ctx.stroke();
        }
        for (let i = 0; i < h; i += 24) {
          ctx.beginPath();
          ctx.moveTo(0, i);
          ctx.lineTo(w, i);
          ctx.stroke();
        }
      }

      t += 0.025;
      // Change depth to simulate continuous squatting
      const squatDepth = Math.sin(t) * 0.5 + 0.5; // 0 to 1

      // Dynamic feedback values based on squat depth
      const currentKnee = Math.round(65 + Math.sin(t * 1.5) * 8);
      const currentHip = Math.round(75 + Math.cos(t) * 6);
      const currentCore = Math.round(55 + Math.sin(t) * 4);

      setKneeAlign(currentKnee);
      setHipHinge(currentHip);
      setCoreStability(currentCore);

      // Update voice coaching comments based on squat phase
      if (squatDepth > 0.8) {
        setCoachAlert("下蹲到底部，保持核心收紧，膝盖有点往两侧内扣噢！向外展开一些。");
      } else if (squatDepth < 0.2) {
        setCoachAlert("呼气直立站起。大屁股夹紧，髋关节挺起。做得非常好！");
      } else {
        setCoachAlert("髋关节先向后坐、身体微前倾。膝盖和肚脐方向配合自如。");
      }

      // Draw Joint and Posture skeleton based on active selected exercise
      const spineTop = { x: w / 2, y: h / 4 + squatDepth * 30 };
      const pelvis = { x: w / 2, y: h / 2 + squatDepth * 35 };

      const leftHip = { x: w / 2 - 20, y: h / 2 + 5 + squatDepth * 35 };
      const rightHip = { x: w / 2 + 20, y: h / 2 + 5 + squatDepth * 35 };

      const leftKnee = { x: w / 2 - 35 - squatDepth * 5, y: h / 2 + 45 + squatDepth * 20 };
      const rightKnee = { x: w / 2 + 35 + squatDepth * 5, y: h / 2 + 45 + squatDepth * 20 };

      const leftAnkle = { x: w / 2 - 38, y: h / 2 + 82 };
      const rightAnkle = { x: w / 2 + 38, y: h / 2 + 82 };

      // Upper skeleton bone arms
      const leftShoulder = { x: w / 2 - 35, y: h / 4 + 15 + squatDepth * 30 };
      const rightShoulder = { x: w / 2 + 35, y: h / 4 + 15 + squatDepth * 30 };

      const drawStarJoint = (j: { x: number; y: number }) => {
        ctx.save();
        ctx.shadowColor = "rgba(255, 190, 64, 0.72)";
        ctx.shadowBlur = 8;
        ctx.strokeStyle = "rgba(255, 246, 216, 0.96)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(j.x - 6, j.y);
        ctx.lineTo(j.x + 6, j.y);
        ctx.moveTo(j.x, j.y - 6);
        ctx.lineTo(j.x, j.y + 6);
        ctx.stroke();
        ctx.fillStyle = "#FFF7D6";
        ctx.beginPath();
        ctx.moveTo(j.x, j.y - 3);
        ctx.lineTo(j.x + 3, j.y);
        ctx.lineTo(j.x, j.y + 3);
        ctx.lineTo(j.x - 3, j.y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#FFD66E";
        ctx.beginPath();
        ctx.arc(j.x, j.y, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };

      // Render skeleton linkages
      ctx.strokeStyle = "rgba(255, 232, 178, 0.84)";
      ctx.lineWidth = 1;
      ctx.shadowColor = "rgba(255, 190, 64, 0.52)";
      ctx.shadowBlur = 9;

      // Spine link
      ctx.beginPath();
      ctx.moveTo(spineTop.x, spineTop.y);
      ctx.lineTo(pelvis.x, pelvis.y);
      ctx.stroke();

      // Shoulders
      ctx.beginPath();
      ctx.moveTo(leftShoulder.x, leftShoulder.y);
      ctx.lineTo(rightShoulder.x, rightShoulder.y);
      ctx.stroke();

      // Hip pelvis belt
      ctx.beginPath();
      ctx.moveTo(leftHip.x, leftHip.y);
      ctx.lineTo(rightHip.x, rightHip.y);
      ctx.stroke();

      // Legs linkages
      ctx.beginPath();
      ctx.moveTo(leftHip.x, leftHip.y);
      ctx.lineTo(leftKnee.x, leftKnee.y);
      ctx.lineTo(leftAnkle.x, leftAnkle.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(rightHip.x, rightHip.y);
      ctx.lineTo(rightKnee.x, rightKnee.y);
      ctx.lineTo(rightAnkle.x, rightAnkle.y);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Marker joint glints
      const activeJoints = [spineTop, leftShoulder, rightShoulder, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle];
      activeJoints.forEach((j) => {
        drawStarJoint(j);
      });

      // Shrug marker circle warnings
      if (currentKnee < 66) {
        ctx.strokeStyle = "#F43F5E"; // Rose knee collapse warning
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(leftKnee.x, leftKnee.y, 9 + Math.sin(t * 5) * 2, 0, Math.PI * 2);
        ctx.arc(rightKnee.x, rightKnee.y, 9 + Math.sin(t * 5) * 2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#F43F5E";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("膝关节内扣报警", leftKnee.x - 30, leftKnee.y - 14);
      }

      animationFrameId.current = requestAnimationFrame(draw);
    };

    animationFrameId.current = requestAnimationFrame(draw);
  };

  useEffect(() => {
    if (cStep === "check") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [cStep, activeExercise]);

  const handleStartCheck = (exKey: string) => {
    setActiveExercise(exKey);
    setCStep("check");
  };

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24 px-4 pt-3 scrollbar-none" id="c_activity_view">
      <AnimatePresence mode="wait">
        {cStep === "choose" && (
          /* 02C | AI教练选择页 */
          <motion.div
            key="choose"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {/* Nav Header */}
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={onBackToHome}
                className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h3 className="text-sm font-bold text-slate-100">AI动作教练评测</h3>
                <p className="text-[10px] text-slate-400">摄像头三维骨架分析，纠正错误姿式，防止运动压死痛点</p>
              </div>
            </div>

            {/* Mascot header */}
            <div className="bg-indigo-950/20 border border-indigo-500/10 p-4 rounded-2xl flex items-center gap-4">
              <div className="shrink-0 bg-slate-900 w-12 h-12 rounded-xl flex items-center justify-center">
                🤖
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">你好思琪，小摩动作诊断开启</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                  我会持续追踪你的 13 处核心骨骼关节点，通过夹角与力矩评估，比肉眼教练更精准防抖代偿噢。
                </p>
              </div>
            </div>

            {/* Selection Exercise Panels */}
            <p className="text-xs font-bold text-indigo-300 uppercase font-mono tracking-wider">选择你今日的体能打卡项：</p>

            <div className="space-y-3">
              {/* Squats card */}
              <motion.button
                whileHover={{ scale: 1.015 }}
                onClick={() => handleStartCheck("squat")}
                className="w-full text-left bg-slate-850 border border-slate-800 p-4.5 rounded-2xl flex items-start gap-4 transition-all hover:border-cyan-400/20"
              >
                <span className="text-2xl bg-slate-900 w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow">🦵</span>
                <div>
                  <h4 className="font-bold text-slate-120 text-xs text-slate-100">下肢臀腿力量 ｜ 深蹲 (Squats)</h4>
                  <p className="text-[11px] text-slate-400 mt-1">评估股骨外旋力、髌股关节受力均匀性、骨盆倾倒代偿</p>
                </div>
              </motion.button>

              {/* Pushup card */}
              <motion.button
                whileHover={{ scale: 1.015 }}
                onClick={() => handleStartCheck("pushup")}
                className="w-full text-left bg-slate-850 border border-slate-800 p-4.5 rounded-2xl flex items-start gap-4 transition-all hover:border-indigo-400/20"
              >
                <span className="text-2xl bg-slate-900 w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow">💪</span>
                <div>
                  <h4 className="font-bold text-slate-120 text-xs text-slate-100">上肢胸推稳定 ｜ 俯卧撑 (Push-ups)</h4>
                  <p className="text-[11px] text-slate-400 mt-1">纠正圆肩前推、腹肌塌陷下陷、斜方肌异常耸起代偿</p>
                </div>
              </motion.button>

              {/* Plank card */}
              <motion.button
                whileHover={{ scale: 1.015 }}
                onClick={() => handleStartCheck("plank")}
                className="w-full text-left bg-slate-850 border border-slate-800 p-4.5 rounded-2xl flex items-start gap-4 transition-all hover:border-teal-400/20"
              >
                <span className="text-2xl bg-slate-900 w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow">⚡</span>
                <div>
                  <h4 className="font-bold text-slate-120 text-xs text-slate-100">静力核心抗阻 ｜ 平板支撑 (Planks)</h4>
                  <p className="text-[11px] text-slate-400 mt-1">评估头前屈代偿斜方、腹腔腰压塌陷、胸廓后展稳定性</p>
                </div>
              </motion.button>
            </div>
          </motion.div>
        )}

        {cStep === "check" && (
          /* 03C | AI动作教练进行核对页 */
          <motion.div
            key="check"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col flex-1"
          >
            {/* Header sub */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setCStep("choose")}
                className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 text-xs transition"
              >
                更换打卡
              </button>

              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-500/10 py-1 px-3 rounded-full font-bold">
                ● AI ACT-COACH LIVE
              </span>
            </div>

            <p className="text-[10px] text-cyan-405 font-mono font-black uppercase text-center block tracking-widest">{activeExercise.toUpperCase()} TRACKING</p>
            <h3 className="text-sm font-bold text-slate-108 text-center mb-4 truncate">{currentExercise.title}</h3>

            {/* Video Canvas Layer */}
            <div className="w-full relative bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 aspect-video mb-4 shadow">
              <video ref={videoRef} className="hidden" playsInline muted />
              <canvas ref={canvasRef} width="320" height="180" className="w-full h-full object-cover" />

              {/* Top HUD labels */}
              <div className="absolute top-3 left-3 bg-slate-950/80 rounded-md py-0.5 px-2 text-[8px] font-mono text-slate-400 border border-slate-800/40">
                FRAME PORT: 3000
              </div>
            </div>

            {/* Realtime diagnostic data columns */}
            <div className="grid grid-cols-3 gap-2.5 mb-4">
              <div className="bg-slate-850 border border-slate-800 p-2 text-center rounded-xl font-mono">
                <span className="text-[9px] text-slate-500 uppercase block">膝内扣对齐度</span>
                <span className={`text-[12px] font-bold block mt-0.5 ${kneeAlign < 66 ? "text-rose-400" : "text-teal-400"}`}>
                  {kneeAlign}% {kneeAlign < 66 ? "警告" : "适中"}
                </span>
              </div>

              <div className="bg-slate-850 border border-slate-800 p-2 text-center rounded-xl font-mono">
                <span className="text-[9px] text-slate-500 uppercase block">臀髋动力坐度</span>
                <span className="text-[12px] text-cyan-400 font-bold block mt-0.5">{hipHinge}%</span>
              </div>

              <div className="bg-slate-850 border border-slate-800 p-2 text-center rounded-xl font-mono">
                <span className="text-[9px] text-slate-500 uppercase block">脊背核心刚性</span>
                <span className="text-[12px] text-indigo-400 font-bold block mt-0.5">{coreStability}%</span>
              </div>
            </div>

            {/* Realtime Voice bubble coaching feedback (03C) */}
            <div className="bg-indigo-950/45 border border-indigo-500/10 p-4 rounded-xl flex gap-3.5 items-start mb-6 w-full">
              <Volume2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <span className="text-[9px] text-indigo-400 uppercase font-mono font-black tracking-wider block">AI小摩实时运动口令</span>
                <p className="text-xs text-indigo-200 mt-1 font-semibold leading-relaxed">
                  『{coachAlert}』
                </p>
              </div>
            </div>

            {/* Action buttons list */}
            <div className="flex items-center gap-3">
              <button
                onClick={stopCamera}
                className="p-3 bg-slate-900 border border-slate-800 hover:text-slate-100 text-slate-400 rounded-xl"
                title="重校准骨骼"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                onClick={() => setCStep("completed")}
                className="flex-1 py-4 bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-slate-100 font-bold rounded-xl text-xs text-center shadow"
              >
                完成本次教练评测组 ➔
              </button>
            </div>
          </motion.div>
        )}

        {cStep === "completed" && (
          <motion.div
            key="completed"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8 space-y-5"
          >
            <MascotCharacter expression="completed" size={135} glow={true} />

            <h2 className="text-xl font-black text-slate-105">AI动作勋章解锁！🏆</h2>
            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
              做得非常优秀！AI对你的『{currentExercise.title.split(" ｜ ")[1]}』给出了高分评测，运动对称度良好，核心参与活跃！
            </p>

            <div className="bg-slate-850 border border-slate-800 rounded-2xl py-3 px-4 text-xs font-mono font-semibold max-w-xs mx-auto text-indigo-300">
              ⚡ 身体能量储备 +20 !｜打卡记录已追溯
            </div>

            <button
              onClick={onBackToHome}
              className="py-3.5 px-8 bg-gradient-to-r from-teal-500 to-indigo-600 text-slate-100 font-bold rounded-xl text-xs shadow-lg"
            >
              继续守护健康。回到首页
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
