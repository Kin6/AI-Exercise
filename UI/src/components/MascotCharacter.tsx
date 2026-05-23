import React from "react";
import { motion } from "motion/react";

interface MascotProps {
  expression: "tired" | "normal" | "determined" | "active" | "focus" | "completed" | "sad" | "cheer";
  size?: number;
  glow?: boolean;
}

export const MascotCharacter: React.FC<MascotProps> = ({ expression, size = 120, glow = false }) => {
  // Determine gradient colors based on energy levels
  let bodyGradient = "url(#fuzzyPurpleGrad)";
  let ringColor = "rgba(167, 139, 250, 0.4)";
  let customEmoji = "💜";

  switch (expression) {
    case "tired":
      bodyGradient = "url(#tiredGrad)";
      ringColor = "rgba(129, 140, 248, 0.2)";
      customEmoji = "😮‍💨";
      break;
    case "determined":
      bodyGradient = "url(#determinedGrad)";
      ringColor = "rgba(139, 92, 246, 0.5)";
      customEmoji = "🔥";
      break;
    case "active":
      bodyGradient = "url(#activeGrad)";
      ringColor = "rgba(236, 72, 153, 0.4)";
      customEmoji = "🏃";
      break;
    case "focus":
      bodyGradient = "url(#focusGrad)";
      ringColor = "rgba(45, 212, 191, 0.5)";
      customEmoji = "🧐";
      break;
    case "completed":
      bodyGradient = "url(#completedGrad)";
      ringColor = "rgba(16, 185, 129, 0.6)";
      customEmoji = "👑";
      break;
    case "sad":
      bodyGradient = "url(#sadGrad)";
      ringColor = "rgba(99, 102, 241, 0.3)";
      customEmoji = "😭";
      break;
    case "cheer":
      bodyGradient = "url(#cheerGrad)";
      ringColor = "rgba(245, 158, 11, 0.5)";
      customEmoji = "✨";
      break;
  }

  // Define SVG elements depending on the expression status
  return (
    <div className="relative flex flex-col items-center justify-center" id="mascot_container">
      {/* Glow shadow behind mascot */}
      {glow && (
        <motion.div
          className={`absolute rounded-full blur-2xl opacity-4xl`}
          style={{
            width: size * 1.1,
            height: size * 1.1,
            background: expression === "completed" 
              ? "radial-gradient(circle, rgba(45,212,191,0.6) 0%, rgba(139,92,246,0) 70%)"
              : expression === "tired"
                ? "radial-gradient(circle, rgba(165,180,252,0.4) 0%, rgba(129,140,248,0) 70%)"
                : "radial-gradient(circle, rgba(167,139,250,0.5) 0%, rgba(139,92,246,0) 70%)",
          }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.6, 0.85, 0.6]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      )}

      {/* Floating Ring Outline */}
      <svg
        width={size * 1.3}
        height={size * 1.3}
        viewBox="0 0 100 100"
        className="absolute"
      >
        <motion.circle
          cx="50"
          cy="50"
          r="43"
          fill="none"
          stroke={ringColor}
          strokeWidth="1.5"
          strokeDasharray={expression === "active" ? "8 4" : "15 5"}
          animate={{
            rotate: 360
          }}
          transition={{
            duration: expression === "active" ? 10 : 25,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        {expression === "completed" && (
          <motion.circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="rgba(45, 212, 191, 0.4)"
            strokeWidth="0.8"
            animate={{ rotate: -360 }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          />
        )}
      </svg>

      {/* Body Vector */}
      <motion.div
        className="relative cursor-pointer"
        style={{ width: size, height: size }}
        animate={
          expression === "active"
            ? { y: [0, -8, 0], scale: [1, 1.05, 0.98, 1], rotate: [0, 2, -2, 0] }
            : expression === "tired"
              ? { y: [0, 3, 0], scale: [1, 0.96, 1], rotate: [0, -1, 0] }
              : { y: [0, -4, 0] }
        }
        transition={{
          duration: expression === "active" ? 1.4 : expression === "tired" ? 4 : 2.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <svg width="100%" height="100%" viewBox="0 0 100 100">
          <defs>
            {/* Soft fluffy purple gradient */}
            <linearGradient id="fuzzyPurpleGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#C4B5FD" />
              <stop offset="60%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#6D28D9" />
            </linearGradient>
            
            {/* Low energy Indigo-gray for tired mode */}
            <linearGradient id="tiredGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#E2E8F0" />
              <stop offset="50%" stopColor="#94A3B8" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>

            {/* Passion red-orange-purple for determined mode */}
            <linearGradient id="determinedGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="40%" stopColor="#EC4899" />
              <stop offset="100%" stopColor="#7C3AED" />
            </linearGradient>

            {/* Bouncing pinkish energetic for active mode */}
            <linearGradient id="activeGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F472B6" />
              <stop offset="60%" stopColor="#DB2777" />
              <stop offset="100%" stopColor="#9D174D" />
            </linearGradient>

            {/* Pure focus teal-cyan-violet gradient */}
            <linearGradient id="focusGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6EE7B7" />
              <stop offset="50%" stopColor="#0D9488" />
              <stop offset="100%" stopColor="#4F46E5" />
            </linearGradient>

            {/* Completed golden green-cyan */}
            <linearGradient id="completedGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6EE7B7" />
              <stop offset="50%" stopColor="#34D399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>

            {/* Sad pale indigo gradient */}
            <linearGradient id="sadGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#C7D2FE" />
              <stop offset="60%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#4338CA" />
            </linearGradient>

            {/* Cheerful sunny gradient */}
            <linearGradient id="cheerGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FCD34D" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>

            <filter id="fluffyShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#312E81" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Fluffy spikes / outer puff elements */}
          <g filter="url(#fluffyShadow)">
            <path
              d="M50 8 C60 10, 68 8, 74 15 C80 20, 84 25, 88 34 C92 42, 94 48, 92 56 C90 64, 88 72, 80 80 C72 88, 64 92, 50 92 C36 92, 28 88, 20 80 C12 72, 10 64, 8 56 C6 48, 8 42, 12 34 C16 25, 20 20, 26 15 C32 8, 40 10, 50 8 Z"
              fill={bodyGradient}
            />
          </g>

          {/* Expressions faces (Drawn vector lines) */}
          {/* Default/Normal expression eyes */}
          {expression === "normal" && (
            <g id="normal-eyes" className="fill-white">
              <circle cx="37" cy="46" r="6" />
              <circle cx="63" cy="46" r="6" />
              <circle cx="39" cy="44" r="2.2" fill="#1E1B4B" />
              <circle cx="65" cy="44" r="2.2" fill="#1E1B4B" />
              {/* Smiling mouth */}
              <path d="M 44 58 Q 50 63 56 58" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />
              {/* Soft touch cheeks */}
              <ellipse cx="28" cy="52" rx="4.5" ry="2.2" fill="#F472B6" opacity="0.6" />
              <ellipse cx="72" cy="52" rx="4.5" ry="2.2" fill="#F472B6" opacity="0.6" />
            </g>
          )}

          {/* Tired face design */}
          {expression === "tired" && (
            <g id="tired-eyes" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none">
              {/* Drooped tired lines */}
              <path d="M 32 44 L 42 48" />
              <path d="M 68 44 L 58 48" />
              {/* Little sighing mouth */}
              <circle cx="50" cy="59" r="3.5" fill="white" stroke="none" />
              {/* Tear indicators or low tension shadows */}
              <path d="M 37 54 L 37 59" stroke="#818CF8" strokeWidth="1.5" />
            </g>
          )}

          {/* Energetic determined face */}
          {expression === "determined" && (
            <g id="determined-eyes" className="fill-white">
              {/* Inner focus eyes */}
              <polygon points="32,41 42,48 34,51" />
              <polygon points="68,41 58,48 66,51" />
              {/* Headband wrapping the ball */}
              <rect x="18" y="24" width="64" height="7" rx="3" fill="#EF4444" />
              <text x="50" y="29.5" textAnchor="middle" fontSize="5" fontWeight="bold" fill="white" fontFamily="sans-serif">FIGHT</text>
              {/* Smirk mouth */}
              <path d="M 43 57 Q 50 61 57 56" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            </g>
          )}

          {/* Focus face */}
          {expression === "focus" && (
            <g id="focus-eyes">
              {/* Round specs on eyes */}
              <circle cx="36" cy="46" r="9" stroke="#FAF5FF" strokeWidth="2" fill="rgba(255,255,255,0.15)" />
              <circle cx="64" cy="46" r="9" stroke="#FAF5FF" strokeWidth="2" fill="rgba(255,255,255,0.15)" />
              <line x1="45" y1="46" x2="55" y2="46" stroke="#FAF5FF" strokeWidth="2" />
              {/* Dilated pupils */}
              <circle cx="36" cy="46" r="3.2" fill="#1E1B4B" />
              <circle cx="64" cy="46" r="3.2" fill="#1E1B4B" />
              <circle cx="37.5" cy="44.5" r="1.2" fill="white" />
              <circle cx="65.5" cy="44.5" r="1.2" fill="white" />
              {/* Concentrating linear mouth */}
              <line x1="45" y1="58" x2="55" y2="58" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </g>
          )}

          {/* Jogging active state */}
          {expression === "active" && (
            <g id="active-eyes" className="fill-white">
              {/* Twinkly arches */}
              <path d="M 31 48 Q 37 40 43 48" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />
              <path d="M 57 48 Q 63 40 69 48" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />
              {/* Cute tongue out mouth */}
              <path d="M 45 56 Q 50 61 55 56" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              <path d="M 47 57 C 47 62, 53 62, 53 57 Z" fill="#F472B6" />
              {/* Sweat drop sweat emoji */}
              <path d="M 78 30 C 78 33, 76 34, 73 35 C 74 33, 76 32, 76 30 Z" fill="#67E8F9" />
            </g>
          )}

          {/* Completed/Master state */}
          {expression === "completed" && (
            <g id="completed-eyes">
              {/* Crown top of head */}
              <path d="M 38 10 L 41 18 L 50 12 L 59 18 L 62 10 L 58 21 L 42 21 Z" fill="#F59E0B" stroke="#FFF" strokeWidth="1" />
              {/* Stars twinkle eyes */}
              <path d="M 35 38 L 37 43 L 42 44 L 38 48 L 39 53 L 35 50 L 31 53 L 32 48 L 28 44 L 33 43 Z" fill="#FCD34D" />
              <path d="M 65 38 L 67 43 L 72 44 L 68 48 L 69 53 L 65 50 L 61 53 L 62 48 L 58 44 L 63 43 Z" fill="#FCD34D" />
              {/* Smiling curved mouth */}
              <path d="M 42 56 Q 50 64 58 56" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />
              {/* Cheerful red cheeks */}
              <ellipse cx="27" cy="49" rx="5" ry="3" fill="#EF4444" opacity="0.65" />
              <ellipse cx="73" cy="49" rx="5" ry="3" fill="#EF4444" opacity="0.65" />
            </g>
          )}

          {/* Sad face */}
          {expression === "sad" && (
            <g id="sad-eyes">
              {/* Drooped sorrow eyes */}
              <path d="M 31 43 Q 36 39 41 45" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />
              <path d="M 69 43 Q 64 39 59 45" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />
              {/* Big teardrop leaking */}
              <path d="M 31 47 C 29 47, 27 51, 29 53 C 31 53, 33 50, 31 47 Z" fill="#38BDF8" />
              {/* Downward curves */}
              <path d="M 44 59 Q 50 54 56 59" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            </g>
          )}

          {/* Cheer face */}
          {expression === "cheer" && (
            <g id="cheer-eyes" className="fill-white">
              {/* Closed smiling arcs */}
              <path d="M 32 46 Q 37 41 42 46" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />
              <path d="M 58 46 Q 63 41 68 46" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />
              {/* Open laughing mouth */}
              <path d="M 43 54 C 43 62, 57 62, 57 54 Z" fill="white" />
              <ellipse cx="28" cy="50" rx="4" ry="2.2" fill="#F472B6" />
              <ellipse cx="72" cy="50" rx="4" ry="2.2" fill="#F472B6" />
            </g>
          )}
        </svg>
      </motion.div>

      {/* Accompanying Emoji Bubble showing energetic level labels */}
      <span className="absolute bottom-[-10px] bg-indigo-950/95 text-indigo-200 border border-indigo-500/20 px-2 py-0.5 rounded-full text-xs font-semibold select-none shadow">
        {customEmoji} 绒绒团团
      </span>
    </div>
  );
};
