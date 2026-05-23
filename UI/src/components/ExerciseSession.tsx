import React, { useState, useEffect, useRef } from "react";
import { RoutineStep } from "../types";
import { MascotCharacter } from "./MascotCharacter";
import { ArrowLeft, Play, Pause, SkipForward, ChevronLeft, Camera, RefreshCw, CheckCircle2, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ExerciseSessionProps {
  routine: RoutineStep[];
  onBack: () => void;
  onFinishedSession: (obsData: {
    cameraObs?: string;
    score: number;
    reliefLevel: string;
  }) => void;
}

export const ExerciseSession: React.FC<ExerciseSessionProps> = ({
  routine,
  onBack,
  onFinishedSession,
}) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timerLeft, setTimerLeft] = useState(30);
  const [isPlaying, setIsPlaying] = useState(true);
  
  // Camera feed states
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);

  const currentStep = routine[currentIdx] || routine[0];
  const isFinalStep = currentIdx === routine.length - 1;

  // Track coaching dialogs
  const [voiceLine, setVoiceLine] = useState("准备好了吗？开始我们的第一个动作！");

  // Timer Countdown logic
  useEffect(() => {
    let initialTime = 30;
    if (currentStep.duration.includes("秒")) {
      initialTime = parseInt(currentStep.duration) || 30;
    } else if (currentStep.duration.includes("次")) {
      initialTime = 20; // Default 20 for repetitions
    }
    setTimerLeft(initialTime);
  }, [currentIdx, currentStep]);

  useEffect(() => {
    if (!isPlaying) return;
    if (timerLeft <= 0) {
      if (!isFinalStep) {
        handleNext();
      }
      return;
    }

    const tid = setTimeout(() => {
      setTimerLeft((t) => t - 1);
    }, 1000);

    return () => clearTimeout(tid);
  }, [timerLeft, isPlaying, isFinalStep]);

  // Handle active step changes voice queues
  useEffect(() => {
    if (currentStep.type === "relax") {
      setVoiceLine("慢下来。轻柔地拉伸被代偿的肌肉，切勿用力猛扯。");
    } else if (currentStep.type === "activate") {
      setVoiceLine("找到肌肉发力，把下巴向后缩或挺直，唤醒稳定力量。");
    } else {
      setVoiceLine("AI姿态观察启动！抬起双手，试着让右边耸高的肩膀沉下来。");
      setupTrackingCanvas();
    }
  }, [currentIdx]);

  // Request & Start real computer webcam
  const startCamera = async () => {
    setCameraLoading(true);
    setCameraError("");
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
          setupTrackingCanvas();
        }
      } else {
        throw new Error("Webcam is not supported in this frame environment.");
      }
    } catch (err: any) {
      console.warn("Camera grant state declined or unsupported, initiating smart skeletal proxy simulation.", err);
      setCameraError("未检测到有效摄像头或权限受限，已切换为小摩AI骨线高算力仿真观察。");
      setCameraActive(true); // fall back to Simulated Wireframe
      setCameraLoading(false);
      setupTrackingCanvas();
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

  // Draw 2D skeletal nodes on Canvas to overlay user video or simulator
  const setupTrackingCanvas = () => {
    let theta = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // If user is actually sharing camera, draw video frame
      if (videoRef.current && videoRef.current.readyState === 4) {
        ctx.save();
        ctx.scale(-1, 1); // Mirror
        ctx.drawImage(videoRef.current, -w, 0, w, h);
        ctx.restore();
      } else {
        // Draw deep ambient blue grid background
        ctx.fillStyle = "#020617";
        ctx.fillRect(0, 0, w, h);
        
        ctx.strokeStyle = "rgba(99, 102, 241, 0.08)";
        ctx.lineWidth = 1;
        for (let i = 0; i < w; i += 20) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, h);
          ctx.stroke();
        }
        for (let i = 0; i < h; i += 20) {
          ctx.beginPath();
          ctx.moveTo(0, i);
          ctx.lineTo(w, i);
          ctx.stroke();
        }
      }

      theta += 0.04;
      const wave = Math.sin(theta) * 3;

      // Draw Joint points representing "Rongrong Tuantuan AI Joint"
      // Nodes coordinates
      const nose = { x: w / 2, y: h / 4 + wave };
      const leftEar = { x: w / 2 - 25, y: h / 4 - 5 + wave };
      const rightEar = { x: w / 2 + 25, y: h / 4 - 5 + wave };

      const leftShoulder = { x: w / 2 - 45, y: h / 2 - 15 + Math.sin(theta * 1.5) * 1.5 };
      const rightShoulder = { x: w / 2 + 45, y: h / 2 - 6 + wave * 0.7 }; // Simulating slight shrug on right side
      const leftElbow = { x: w / 2 - 65, y: h / 2 + 10 + Math.cos(theta) * 4 };
      const rightElbow = { x: w / 2 + 65, y: h / 2 + 22 + wave };

      // Draw bone joints connecting lines
      ctx.strokeStyle = "rgba(45, 212, 191, 0.75)"; // Cyan lines
      ctx.lineWidth = 2.5;

      // Shoulder line
      ctx.beginPath();
      ctx.moveTo(leftShoulder.x, leftShoulder.y);
      ctx.lineTo(rightShoulder.x, rightShoulder.y);
      ctx.stroke();

      // Arms
      ctx.beginPath();
      ctx.moveTo(leftShoulder.x, leftShoulder.y);
      ctx.lineTo(leftElbow.x, leftElbow.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(rightShoulder.x, rightShoulder.y);
      ctx.lineTo(rightElbow.x, rightElbow.y);
      ctx.stroke();

      // Neck line
      ctx.beginPath();
      ctx.moveTo(nose.x, nose.y + 12);
      ctx.lineTo(nose.x, h / 2 - 11);
      ctx.stroke();

      // Draw Head Circle overlay
      ctx.fillStyle = "rgba(139, 92, 246, 0.15)";
      ctx.strokeStyle = "#8B5CF6";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(nose.x, nose.y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Draw individual Joint nodes (cyan dots)
      const joints = [nose, leftEar, rightEar, leftShoulder, rightShoulder, leftElbow, rightElbow];
      joints.forEach((j) => {
        ctx.fillStyle = "#2DD4BF";
        ctx.beginPath();
        ctx.arc(j.x, j.y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#FFF";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(j.x, j.y, 5.5, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Special Right shoulder attention shrugging ring
      ctx.strokeStyle = "#F43F5E"; // Rose alert
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(rightShoulder.x, rightShoulder.y, 11 + Math.sin(theta * 3) * 2, 0, Math.PI * 2);
      ctx.stroke();

      // Label shrugging text
      ctx.fillStyle = "#F43F5E";
      ctx.font = "bold 9px sans-serif";
      ctx.fillText("右肩代偿耸起", rightShoulder.x + 10, rightShoulder.y - 12);

      animationFrameId.current = requestAnimationFrame(draw);
    };

    animationFrameId.current = requestAnimationFrame(draw);
  };

  useEffect(() => {
    if (currentStep.type === "check") {
      // Start camera automatically or simulate
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [currentIdx]);

  const handleNext = () => {
    if (currentIdx < routine.length - 1) {
      setCurrentIdx((c) => c + 1);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx((c) => c - 1);
    }
  };

  const handleFinishTraining = () => {
    // Return custom simulation values of observational corrections
    onFinishedSession({
      cameraObs: "右肩有轻微耸起，代偿程度 34%，斜方肌略有活化舒缓",
      score: 8,
      reliefLevel: "轻松了一些"
    });
  };

  return (
    <div className="flex flex-col flex-1 overflow-y-auto pb-24 px-4 pt-3 scrollbar-none" id="exercise_session">
      {/* Navbar segment */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 py-1.5 px-3 rounded-lg bg-slate-900 border border-slate-800 transition"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>放弃本次</span>
        </button>

        <p className="text-xs font-mono font-bold text-indigo-400 bg-indigo-950/60 py-1 px-3 rounded-full border border-indigo-500/10">
          今日恢复进度 {currentIdx + 1} / {routine.length}
        </p>
      </div>

      {/* Main workout slides layout */}
      <div className="flex-1 flex flex-col items-center">
        {/* Step Class Type Header banner */}
        <p className="text-[10px] text-indigo-400 tracking-wider font-mono font-extrabold uppercase mb-1">
          {currentStep.type === "relax" 
            ? "第一组 | 放松代偿肌" 
            : currentStep.type === "activate"
              ? "第二组 | 激活稳定群"
              : "第三组 | AI动作观察"}
        </p>
        <h3 className="text-lg font-black text-slate-100 mb-4 text-center">
          {currentStep.name}
        </h3>

        {/* Dynamic visual segment: Camera OR Mascot animation depending on Step Type */}
        <div className="w-full relative bg-slate-850/70 border border-slate-800 rounded-3xl p-5 mb-5 flex flex-col items-center justify-center min-h-[260px] shadow-inner">
          {currentStep.type === "check" ? (
            /* AI POSTURE OBSERVATION SCREEN (A6) */
            <div className="w-full relative flex flex-col items-center">
              <div className="w-full aspect-video bg-slate-900 rounded-2xl overflow-hidden relative border border-slate-750">
                <video ref={videoRef} className="hidden" playsInline muted />
                <canvas ref={canvasRef} width="320" height="180" className="w-full h-full object-cover" />

                {/* Simulated Overlay HUD */}
                <div className="absolute top-3 left-3 flex gap-1 bg-black/60 px-2 py-0.5 rounded text-[8px] font-mono text-cyan-400 items-center">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                  <span>AI DYNAMIC PORT: 3000</span>
                </div>

                <div className="absolute bottom-3 right-3 bg-black/55 py-1 px-2 rounded-lg text-[9px] text-slate-300 font-mono">
                  Symmetry: 56%
                </div>
              </div>

              {/* High precision gauge list */}
              <div className="w-full grid grid-cols-3 gap-2 mt-4 font-mono text-[10px]">
                <div className="bg-slate-900 p-2 rounded-xl text-center border border-slate-800/60">
                  <span className="text-slate-500 block mb-0.5">高抬高度</span>
                  <span className="text-emerald-400 font-bold">78% 标准</span>
                </div>
                <div className="bg-slate-900 p-2 rounded-xl text-center border border-slate-800/60">
                  <span className="text-slate-500 block mb-0.5">左肩下沉</span>
                  <span className="text-teal-400 font-bold">64% 正常</span>
                </div>
                <div className="bg-slate-900 p-2 rounded-xl text-center border border-slate-800/60">
                  <span className="text-rose-400 block mb-0.5 text-center font-bold">右肩代偿</span>
                  <span className="text-rose-400 font-bold">56% 耸肩</span>
                </div>
              </div>
            </div>
          ) : (
            /* MASCOT EXERCISE SCHEMATIC GRAPH (A5) */
            <div className="flex flex-col items-center">
              <MascotCharacter expression={isPlaying ? "active" : "normal"} size={130} glow={true} />
              
              <p className="text-xs text-slate-400 text-center max-w-xs leading-relaxed mt-4 px-2 font-medium">
                👉 {currentStep.focus}
              </p>
            </div>
          )}

          {/* Sparkly watermark circle */}
          <div className="absolute top-2 right-2 text-indigo-950 text-7xl select-none font-bold font-mono opacity-15 pointer-events-none">
            {currentStep.step}
          </div>
        </div>

        {/* Timer / Counter countdown */}
        <div className="flex flex-col items-center mb-6">
          <div className="text-3xl font-black font-mono tracking-tight text-white mb-1.5 bg-slate-900 px-5 py-2 rounded-2xl border border-slate-800 shadow">
            {currentStep.duration.includes("次") ? "REPS" : ""} {timerLeft > 0 ? `00:${timerLeft.toString().padStart(2, "0")}` : "STAY!"}
          </div>
          <p className="text-xs text-slate-400 font-semibold">{currentStep.duration} / 对肌肉组</p>
        </div>

        {/* Coach Voice assistance board */}
        <div className="w-full bg-slate-900/60 border border-indigo-500/10 rounded-2xl p-4 flex gap-3 items-start mb-6">
          <Volume2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5 animate-pulse" />
          <div>
            <span className="text-[10px] text-indigo-400 font-bold tracking-wider uppercase block">小摩实时语音纠正</span>
            <p className="text-xs text-indigo-200/90 leading-relaxed mt-1 font-semibold">
              『{voiceLine}』
            </p>
          </div>
        </div>

        {/* Action controls row */}
        <div className="flex items-center gap-4 w-full justify-center">
          <button
            onClick={handlePrev}
            disabled={currentIdx === 0}
            className="p-3 bg-slate-900 border border-slate-850 text-slate-400 hover:text-slate-100 rounded-2xl disabled:opacity-30 disabled:pointer-events-none transition"
            title="上一个"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="py-4 px-8 bg-indigo-950 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-900 rounded-3xl font-bold text-xs flex items-center gap-2 transition"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 text-indigo-400 fill-indigo-400" />
                暂停指导
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-teal-400 fill-teal-400 animate-pulse" />
                继续运动
              </>
            )}
          </button>

          {!isFinalStep ? (
            <button
              onClick={handleNext}
              className="p-3 bg-slate-900 border border-slate-850 text-slate-200 hover:text-slate-100 rounded-2xl transition"
              title="下一个"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleFinishTraining}
              className="py-3 px-5 bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 rounded-2xl font-bold text-xs flex items-center gap-1.5 shadow shadow-cyan-500/20 hover:scale-102 transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              完成恢复
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
