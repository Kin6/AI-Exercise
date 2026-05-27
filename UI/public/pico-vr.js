const params = new URLSearchParams(window.location.search);
const apiBase = (params.get("api") || `${window.location.protocol}//${window.location.hostname}:8001`).replace(/\/$/, "");

const elements = {
  apiStatus: document.getElementById("apiStatus"),
  attempts: document.getElementById("attempts"),
  coachEyebrow: document.getElementById("coachEyebrow"),
  coachMessage: document.getElementById("coachMessage"),
  emptyState: document.getElementById("emptyState"),
  errorTags: document.getElementById("errorTags"),
  exerciseTitle: document.getElementById("exerciseTitle"),
  fullscreenButton: document.getElementById("fullscreenButton"),
  grade: document.getElementById("grade"),
  liveImage: document.getElementById("liveImage"),
  processMs: document.getElementById("processMs"),
  score: document.getElementById("score"),
  serviceState: document.getElementById("serviceState"),
  stage: document.getElementById("stage"),
  teachingLabel: document.getElementById("teachingLabel"),
  teachingVideo: document.getElementById("teachingVideo"),
  validReps: document.getElementById("validReps"),
};

const exerciseMeta = {
  squat: {
    title: "下肢力量 | 深蹲",
    video: "深蹲.mp4",
    label: "深蹲标准示范",
    note: "建议正面入镜，脚踝、膝盖、髋部都要可见。",
  },
  pushup: {
    title: "上肢稳定 | 俯卧撑",
    video: "俯卧撑.mp4",
    label: "俯卧撑标准示范",
    note: "建议侧面入镜，肩、肘、腕、髋、踝保持在画面内。",
  },
  curl: {
    title: "手臂控制 | 弯举",
    video: "弯举.mp4",
    label: "弯举标准示范",
    note: "建议侧面或 45 度入镜，训练手臂完整可见。",
  },
};

const stageLabel = {
  ready: "准备",
  up: "上方",
  down: "下方",
};

let currentVideo = "";
let lastFrameAt = 0;
let offlineCount = 0;

function getExerciseShortName(title) {
  const parts = String(title || "").split("|");
  return (parts[parts.length - 1] || title || "动作").trim();
}

function buildRoundSummaryMessage(session, meta) {
  const actionName = getExerciseShortName(meta.title);
  const summary = session.summary || {};
  const completedReps = summary.valid_reps ?? session.count ?? 0;
  const attempts = summary.attempts ?? session.attempts ?? completedReps;
  const averageScore = summary.avg_score ?? session.score ?? 0;
  const invalidAttempts = summary.invalid_attempts ?? Math.max(0, attempts - completedReps);
  const roundedScore = Math.round(averageScore);
  const scoreText = roundedScore > 0 ? `${roundedScore} 分` : "暂无评分";
  const repeatedErrors = Array.isArray(summary.common_errors) ? summary.common_errors.map((error) => error.name).filter(Boolean) : [];
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

function setStatus(label, mode) {
  elements.apiStatus.textContent = label;
  elements.apiStatus.classList.toggle("is-ready", mode === "ready");
  elements.apiStatus.classList.toggle("is-waiting", mode === "waiting");
  elements.apiStatus.classList.toggle("is-offline", mode === "offline");
  elements.serviceState.textContent = label;
}

function setTeachingVideo(meta) {
  const src = `/videoTeaching/${encodeURIComponent(meta.video)}`;
  if (currentVideo === src) return;
  currentVideo = src;
  elements.teachingVideo.src = src;
  elements.teachingLabel.textContent = meta.label;
  elements.teachingVideo.play().catch(() => {
    elements.teachingLabel.textContent = "点击页面后播放";
  });
}

function updateErrorTags(errors) {
  elements.errorTags.replaceChildren();
  (errors || []).slice(0, 4).forEach((error) => {
    const tag = document.createElement("span");
    tag.textContent = error;
    elements.errorTags.appendChild(tag);
  });
}

function renderWaiting(message = "等待电脑端训练数据。") {
  setStatus("等待训练", "waiting");
  elements.exerciseTitle.textContent = "等待电脑端开始训练";
  elements.coachEyebrow.textContent = "AI 状态";
  elements.coachMessage.textContent = message;
  elements.coachMessage.classList.remove("is-summary");
  elements.emptyState.classList.remove("is-hidden");
  elements.liveImage.classList.remove("has-frame");
  elements.validReps.textContent = "0";
  elements.attempts.textContent = "0";
  elements.score.textContent = "0";
  elements.processMs.textContent = "--";
  elements.stage.textContent = "准备";
  elements.grade.textContent = "训练中";
  updateErrorTags([]);
}

function renderSession(session) {
  const meta = exerciseMeta[session.exercise] || {
    title: session.exerciseLabel || "AI 动作观察",
    video: "深蹲.mp4",
    label: "循环示范",
    note: "请保持身体完整进入画面。",
  };
  const isFinished = session.status === "finished";

  setStatus("Pose API 已连接", "ready");
  setTeachingVideo(meta);
  elements.exerciseTitle.textContent = meta.title;
  elements.validReps.textContent = String(Math.round(session.score ?? session.summary?.avg_score ?? 0));
  elements.attempts.textContent = String(session.attempts ?? session.summary?.attempts ?? 0);
  elements.score.textContent = String(session.count ?? session.summary?.valid_reps ?? 0);
  elements.processMs.textContent = session.processMs ? `${session.processMs}ms` : "--";
  elements.stage.textContent = stageLabel[session.stage] || session.stage || "准备";
  elements.grade.textContent = session.summary?.grade || (isFinished ? "N/A" : "训练中");
  elements.coachEyebrow.textContent = isFinished ? "本组已完成" : "AI 正在观察";

  const message = isFinished
    ? buildRoundSummaryMessage(session, meta)
    : session.liveMessage || meta.note || "等待电脑端动作数据。";
  elements.coachMessage.textContent = `“${message}”`;
  elements.coachMessage.classList.toggle("is-summary", isFinished);
  updateErrorTags(session.liveErrors);

  if (session.annotatedImage) {
    lastFrameAt = Date.now();
    elements.liveImage.src = session.annotatedImage;
    elements.liveImage.classList.add("has-frame");
    elements.emptyState.classList.add("is-hidden");
  } else if (Date.now() - lastFrameAt > 1800) {
    elements.liveImage.classList.remove("has-frame");
    elements.emptyState.classList.remove("is-hidden");
  }
}

async function pollLiveSession() {
  try {
    const response = await fetch(`${apiBase}/api/session/live`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    offlineCount = 0;

    if (!data.ok) {
      renderWaiting("等待电脑端创建训练会话。");
    } else {
      renderSession(data);
    }
  } catch (error) {
    offlineCount += 1;
    if (offlineCount > 2) {
      setStatus("Pose API 未连接", "offline");
      elements.coachEyebrow.textContent = "连接提醒";
      elements.coachMessage.textContent = `“没有连上电脑端 Pose API。请确认 FastAPI 已用 0.0.0.0:8001 启动，并且 Pico 4 与电脑在同一 Wi-Fi。”`;
      elements.coachMessage.classList.remove("is-summary");
      elements.emptyState.classList.remove("is-hidden");
    }
  } finally {
    window.setTimeout(pollLiveSession, 500);
  }
}

elements.fullscreenButton.addEventListener("click", () => {
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
    return;
  }
  document.documentElement.requestFullscreen?.();
});

renderWaiting();
pollLiveSession();
