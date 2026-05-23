import importlib
import json
import threading
import time
from datetime import datetime

import av
import streamlit as st
import streamlit.components.v1 as components
from streamlit_webrtc import RTCConfiguration, VideoProcessorBase, WebRtcMode, webrtc_streamer

import feedback as feedback_module
from exercise_knowledge import get_body_parts
from exercises.bicep_curl import BicepCurlAnalyzer
from exercises.pushup import PushupAnalyzer
from exercises.squat import SquatAnalyzer
from local_camera import create_usb_first_camera_track
from pose_utils import PoseDetector, draw_exercise_joint_highlights, draw_session_banner
from workout_store import body_part_totals, build_session_summary, load_history, render_calendar_html, save_session

feedback_module = importlib.reload(feedback_module)
build_rep_correction_text = feedback_module.build_rep_correction_text

st.set_page_config(page_title="AI Fitness Coach", page_icon="🏋️", layout="wide")

EXERCISES = {
    "深蹲 Squat": SquatAnalyzer,
    "俯卧撑 Push-up": PushupAnalyzer,
    "弯举 Bicep Curl": BicepCurlAnalyzer,
}

RTC_CONFIGURATION = RTCConfiguration({"iceServers": [{"urls": ["stun:stun.l.google.com:19302"]}]})

BROWSER_CAMERA_CONSTRAINTS = {
    "video": {
        "width": {"ideal": 1280, "max": 1280},
        "height": {"ideal": 720, "max": 720},
        "frameRate": {"ideal": 15, "max": 15},
    },
    "audio": False,
}

CAMERA_WIDTH = 1280
CAMERA_HEIGHT = 720
CAMERA_FPS = 15
POSE_PROCESS_WIDTH = 640
USB_WAIT_SECONDS = 1.2

CAMERA_SOURCES = {
    "浏览器摄像头": "browser",
    "本机摄像头（USB优先）": "local",
}

STAGE_LABELS = {
    "ready": "准备",
    "up": "上方 / 起身",
    "down": "下方 / 下放",
}

SESSION_IDLE = "idle"
SESSION_COUNTDOWN = "countdown"
SESSION_ACTIVE = "active"
SESSION_PAUSED = "paused"
SESSION_FINISHED = "finished"

TUTORIAL_VIDEO_SOURCES = {
    "深蹲 Squat": "",
    "俯卧撑 Push-up": "",
    "弯举 Bicep Curl": "",
}


def empty_score_details():
    return {
        "base": 100,
        "score": 100,
        "deductions": [],
        "positives": [],
        "deduction_text": "完成一次动作后显示扣分原因",
        "positive_text": "完成一次动作后显示加分/保分原因",
    }


def empty_session_summary():
    return {
        "points": 0,
        "grade": "N/A",
        "valid_reps": 0,
        "attempts": 0,
        "avg_score": 0,
        "body_parts": [],
        "common_errors": [],
    }


def apply_theme():
    st.markdown(
        """
<style>
:root {
  --fit-bg: #f6f8fb;
  --fit-panel: rgba(255,255,255,.86);
  --fit-ink: #111827;
  --fit-muted: #64748b;
  --fit-cyan: #06b6d4;
  --fit-green: #10b981;
  --fit-amber: #f59e0b;
}
.stApp { background: linear-gradient(180deg, #f8fbff 0%, #eef4f8 100%); color: var(--fit-ink); }
.main .block-container {
  max-width: 100%;
  padding-left: 2rem;
  padding-right: 2rem;
}
video {
  width: 100% !important;
  height: auto !important;
  image-rendering: auto;
}
[data-testid="stSidebar"] { background: #ffffff; border-right: 1px solid #e5e7eb; }
[data-testid="stSidebar"] h1, [data-testid="stSidebar"] h2, [data-testid="stSidebar"] h3 { color: #0f172a; }
[data-testid="stMetric"] {
  background: rgba(255,255,255,.82);
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px 12px;
  box-shadow: 0 8px 22px rgba(15,23,42,.06);
}
[data-testid="stMetricLabel"] { color: var(--fit-muted); }
.fit-hero {
  border: 1px solid #dbeafe;
  border-radius: 10px;
  padding: 14px 16px;
  background: linear-gradient(135deg, rgba(6,182,212,.12), rgba(16,185,129,.10));
  margin-bottom: 12px;
}
.fit-hero-title { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
.fit-hero-copy { font-size: 13px; color: #475569; line-height: 1.5; }
.fit-panel {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px 14px;
  background: rgba(255,255,255,.84);
  box-shadow: 0 8px 22px rgba(15,23,42,.05);
}
.fit-pet {
  display: grid;
  grid-template-columns: 76px 1fr;
  gap: 12px;
  align-items: center;
  border: 1px solid #ccfbf1;
  border-radius: 10px;
  padding: 12px;
  background: linear-gradient(135deg, rgba(240,253,250,.95), rgba(236,254,255,.9));
}
.fit-pet-avatar {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 34px;
  background: #ffffff;
  border: 1px solid #a7f3d0;
  box-shadow: inset 0 -5px 0 rgba(16,185,129,.12);
}
.fit-pet-title { font-weight: 800; color:#064e3b; margin-bottom: 4px; }
.fit-pet-copy { color:#475569; font-size:13px; line-height:1.45; }
.stButton > button {
  border-radius: 8px;
  font-weight: 700;
}
</style>
        """,
        unsafe_allow_html=True,
    )


class FitnessVideoProcessor(VideoProcessorBase):
    def __init__(self):
        self.detector = PoseDetector(model_complexity=0, process_width=POSE_PROCESS_WIDTH)
        self.analyzer = SquatAnalyzer()
        self.exercise_name = "深蹲 Squat"
        self.frame_index = 0
        self.process_ms = 0.0
        self.session_status = SESSION_IDLE
        self.session_duration = 30
        self.countdown_started_at = None
        self.active_started_at = None
        self.finished_at = None
        self.paused_from_status = None
        self.paused_remaining = 0
        self.session_summary = empty_session_summary()
        self.session_recorded = False
        self.lock = threading.Lock()
        self.snapshot = {
            "count": 0,
            "attempts": 0,
            "stage": "ready",
            "score": 100,
            "message": "开始训练，保持身体完整出现在画面中。",
            "live_message": "准备开始，身体进入画面后完成一次动作。",
            "live_errors": [],
            "score_details": empty_score_details(),
            "history": [],
            "detected": False,
            "process_ms": 0.0,
            "session_status": self.session_status,
            "session_remaining": 0,
            "session_summary": self.session_summary,
        }

    def set_exercise(self, exercise_name):
        with self.lock:
            if exercise_name != self.exercise_name:
                self.exercise_name = exercise_name
                self.analyzer = EXERCISES[exercise_name]()
                self.session_status = SESSION_IDLE
                self.countdown_started_at = None
                self.active_started_at = None
                self.finished_at = None
                self.paused_from_status = None
                self.paused_remaining = 0
                self.session_summary = empty_session_summary()
                self.session_recorded = False
                self.snapshot.update(
                    {
                        "stage": "ready",
                        "count": 0,
                        "attempts": 0,
                        "score": 100,
                        "message": "已切换动作，准备开始训练。",
                        "live_message": "准备开始，身体进入画面后完成一次动作。",
                        "live_errors": [],
                        "score_details": empty_score_details(),
                        "history": [],
                        "detected": False,
                        "process_ms": 0.0,
                        "session_status": self.session_status,
                        "session_remaining": self._session_remaining(time.time()),
                        "session_summary": self.session_summary,
                    }
                )

    def start_session(self, duration_seconds):
        with self.lock:
            self.analyzer.reset()
            self.session_status = SESSION_COUNTDOWN
            self.session_duration = int(duration_seconds)
            self.countdown_started_at = time.time()
            self.active_started_at = None
            self.finished_at = None
            self.paused_from_status = None
            self.paused_remaining = 0
            self.session_summary = empty_session_summary()
            self.session_recorded = False
            self.snapshot.update(
                {
                    "count": 0,
                    "attempts": 0,
                    "score": 100,
                    "message": "准备开始，3 秒倒计时后进入专家评判。",
                    "live_message": "倒计时中，站好位置，准备开始。",
                    "history": [],
                    "session_status": self.session_status,
                    "session_remaining": 3,
                    "session_summary": self.session_summary,
                }
            )

    def reset(self):
        with self.lock:
            self.analyzer.reset()
            self.session_status = SESSION_IDLE
            self.countdown_started_at = None
            self.active_started_at = None
            self.finished_at = None
            self.paused_from_status = None
            self.paused_remaining = 0
            self.session_summary = empty_session_summary()
            self.session_recorded = False
            self.snapshot = {
                "count": 0,
                "attempts": 0,
                "stage": "ready",
                "score": 100,
                "message": "已重置，开始训练。",
                "live_message": "准备开始，身体进入画面后完成一次动作。",
                "live_errors": [],
                "score_details": empty_score_details(),
                "history": [],
                "detected": False,
                "process_ms": 0.0,
                "session_status": self.session_status,
                "session_remaining": 0,
                "session_summary": self.session_summary,
            }

    async def recv_queued(self, frames):
        return [self.recv(frames[-1])]

    def _session_remaining(self, now):
        if self.session_status == SESSION_COUNTDOWN and self.countdown_started_at:
            return max(0, 3 - (now - self.countdown_started_at))
        if self.session_status == SESSION_ACTIVE and self.active_started_at:
            return max(0, self.session_duration - (now - self.active_started_at))
        if self.session_status == SESSION_PAUSED:
            return max(0, self.paused_remaining)
        return 0

    def toggle_pause(self):
        with self.lock:
            now = time.time()
            if self.session_status in {SESSION_COUNTDOWN, SESSION_ACTIVE}:
                self.paused_from_status = self.session_status
                self.paused_remaining = self._session_remaining(now)
                self.session_status = SESSION_PAUSED
                self.snapshot["session_status"] = self.session_status
                self.snapshot["session_remaining"] = self.paused_remaining
                self.snapshot["message"] = "训练已暂停。"
                self.snapshot["live_message"] = "已暂停，点击继续恢复训练。"
                return

            if self.session_status == SESSION_PAUSED:
                if self.paused_from_status == SESSION_COUNTDOWN:
                    self.countdown_started_at = now - max(0, 3 - self.paused_remaining)
                    self.session_status = SESSION_COUNTDOWN
                elif self.paused_from_status == SESSION_ACTIVE:
                    self.active_started_at = now - max(0, self.session_duration - self.paused_remaining)
                    self.session_status = SESSION_ACTIVE
                self.paused_from_status = None
                self.paused_remaining = 0
                self.snapshot["session_status"] = self.session_status
                self.snapshot["session_remaining"] = self._session_remaining(now)
                self.snapshot["message"] = "训练继续。"
                self.snapshot["live_message"] = "训练继续，保持动作节奏。"

    def complete_session(self):
        with self.lock:
            self._finish_session(time.time())

    def _advance_session(self, now):
        if self.session_status == SESSION_COUNTDOWN and self.countdown_started_at:
            if now - self.countdown_started_at >= 3:
                self.session_status = SESSION_ACTIVE
                self.active_started_at = now
                self.snapshot["message"] = "专家评判开始。"
                self.snapshot["live_message"] = "专家评判中，尽量做标准动作。"

        if self.session_status == SESSION_ACTIVE and self.active_started_at:
            if now - self.active_started_at >= self.session_duration:
                self._finish_session(now)

    def _finish_session(self, now):
        if self.session_status == SESSION_FINISHED:
            return
        self.session_status = SESSION_FINISHED
        self.finished_at = now
        history = list(self.analyzer.state.history)
        body_parts = get_body_parts(self.exercise_name)
        self.session_summary = build_session_summary(self.exercise_name, history, self.session_duration, body_parts)
        if not self.session_recorded:
            save_session(self.session_summary)
            self.session_recorded = True
        self.snapshot["message"] = (
            f"本轮结束：{self.session_summary['grade']} 级，"
            f"{self.session_summary['points']} 积分，"
            f"标准 {self.session_summary['valid_reps']} / 尝试 {self.session_summary['attempts']}。"
        )
        self.snapshot["live_message"] = "本轮已结束，按空格可开始下一轮。"

    def recv(self, frame):
        start = time.perf_counter()
        self.frame_index += 1
        now = time.time()
        img = frame.to_ndarray(format="bgr24")
        pose_result = self.detector.process(img)
        self.process_ms = (time.perf_counter() - start) * 1000

        with self.lock:
            self._advance_session(now)
            judging = self.session_status == SESSION_ACTIVE

            if pose_result.detected and judging:
                state = self.analyzer.update(pose_result.landmarks)
                self.snapshot = {
                    "count": state.count,
                    "attempts": state.attempts,
                    "stage": state.stage,
                    "score": state.last_score,
                    "message": state.last_message,
                    "live_message": state.live_message,
                    "live_errors": list(state.live_errors),
                    "score_details": state.last_score_details or empty_score_details(),
                    "history": list(state.history),
                    "detected": True,
                    "process_ms": round(self.process_ms, 1),
                    "session_status": self.session_status,
                    "session_remaining": self._session_remaining(now),
                    "session_summary": self.session_summary,
                }
            elif pose_result.detected:
                self.snapshot["detected"] = True
                self.snapshot["process_ms"] = round(self.process_ms, 1)
                self.snapshot["session_status"] = self.session_status
                self.snapshot["session_remaining"] = self._session_remaining(now)
                self.snapshot["session_summary"] = self.session_summary
                if self.session_status == SESSION_IDLE:
                    self.snapshot["live_message"] = "按空格开始训练回合。"
                elif self.session_status == SESSION_COUNTDOWN:
                    self.snapshot["live_message"] = "倒计时中，站好位置，准备开始。"
                elif self.session_status == SESSION_FINISHED:
                    self.snapshot["live_message"] = "本轮已结束，按空格可开始下一轮。"
            else:
                self.snapshot["detected"] = False
                self.snapshot["message"] = "未检测到人体，请站到摄像头前。"
                self.snapshot["live_message"] = "未检测到人体，请站到摄像头前。"
                self.snapshot["live_errors"] = []
                self.snapshot["process_ms"] = round(self.process_ms, 1)
                self.snapshot["session_status"] = self.session_status
                self.snapshot["session_remaining"] = self._session_remaining(now)
                self.snapshot["session_summary"] = self.session_summary

            summary = self.snapshot.get("session_summary") or empty_session_summary()
            session_status = self.snapshot.get("session_status", SESSION_IDLE)
            remaining = self.snapshot.get("session_remaining", 0)
            if session_status == SESSION_COUNTDOWN:
                session_text = f"倒计时 {max(1, int(remaining + 0.999))} 秒"
            elif session_status == SESSION_ACTIVE:
                session_text = f"专家评判中 | 剩余 {max(0, int(remaining + 0.999))} 秒"
            elif session_status == SESSION_PAUSED:
                session_text = "训练已暂停"
            elif session_status == SESSION_FINISHED:
                session_text = f"本轮结束 | {summary.get('grade', 'N/A')}级 | {summary.get('points', 0)}积分"
            else:
                session_text = "按空格开始：3秒倒计时后进入专家评判"

            self.snapshot["status_lines"] = [
                f"当前：{self.exercise_name} | 标准 {self.snapshot['count']} / 尝试 {self.snapshot.get('attempts', 0)} | 阶段 {STAGE_LABELS.get(self.snapshot['stage'], self.snapshot['stage'])} | 最近得分 {self.snapshot['score']}",
                session_text,
                self.snapshot["live_message"],
            ]
            exercise_name = self.exercise_name
            banner_status = session_status
            banner_remaining = remaining
            banner_summary = summary

        output_frame = draw_exercise_joint_highlights(pose_result.annotated_frame, exercise_name, pose_result.landmarks)
        output_frame = draw_session_banner(output_frame, banner_status, banner_remaining, banner_summary)
        return av.VideoFrame.from_ndarray(output_frame, format="bgr24")


def stop_local_camera_track():
    track = st.session_state.get("local_camera_track")
    if track is not None:
        track.stop()
    st.session_state.pop("local_camera_track", None)
    st.session_state.pop("local_camera_message", None)
    st.session_state.pop("local_camera_error", None)


def get_local_camera_track():
    track = st.session_state.get("local_camera_track")
    if track is not None and getattr(track, "readyState", "live") == "live":
        return track

    try:
        track, message = create_usb_first_camera_track(
            width=CAMERA_WIDTH,
            height=CAMERA_HEIGHT,
            fps=CAMERA_FPS,
            usb_wait_seconds=USB_WAIT_SECONDS,
        )
        st.session_state.local_camera_track = track
        st.session_state.local_camera_message = message
        st.session_state.pop("local_camera_error", None)
        return track
    except RuntimeError as exc:
        st.session_state.local_camera_error = str(exc)
        return None


def install_space_start_shortcut():
    components.html(
        """
<script>
(() => {
  const label = "空格开始训练";
  const root = window.parent;
  const bind = (win) => {
    if (!win || win.__fitnessSpaceStartBound) return;
    win.__fitnessSpaceStartBound = true;
    win.addEventListener("keydown", (event) => {
      const tag = (event.target && event.target.tagName || "").toUpperCase();
      if (event.code !== "Space" || tag === "INPUT" || tag === "TEXTAREA" || event.repeat) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      try { win.document.activeElement && win.document.activeElement.blur && win.document.activeElement.blur(); } catch (_) {}
      const doc = root.document;
      const buttons = Array.from(doc.querySelectorAll("button"));
      const target = buttons.find((button) => (button.innerText || "").includes(label));
      if (target) setTimeout(() => target.click(), 0);
    }, true);
  };
  bind(root);
  const bindFrames = () => {
    Array.from(root.document.querySelectorAll("iframe")).forEach((frame) => {
      try { bind(frame.contentWindow); } catch (_) {}
    });
  };
  bindFrames();
  setInterval(bindFrames, 1000);
</script>
        """,
        height=0,
    )


def _query_param(name, default=""):
    value = st.query_params.get(name, default)
    if isinstance(value, list):
        return value[0] if value else default
    return value if value is not None else default


def read_overlay_action():
    action = _query_param("fit_action", "")
    token = _query_param("fit_token", "")
    if not action or not token:
        return "", ""
    if st.session_state.get("last_fit_action_token") == token:
        return "", ""
    return action, token


def apply_pre_render_overlay_action(action):
    if action != "previous":
        return
    choices = list(EXERCISES.keys())
    current = st.session_state.get("exercise_choice", choices[0])
    index = choices.index(current) if current in choices else 0
    st.session_state.exercise_choice = choices[(index - 1) % len(choices)]


def mark_overlay_action_handled(token):
    if token:
        st.session_state.last_fit_action_token = token


def exercise_overlay_copy(exercise_name):
    if "俯卧撑" in exercise_name:
        return {
            "title": "标准俯卧撑",
            "subtitle": "收紧核心，观察身体是否成直线",
            "metricA": "下放深度",
            "metricB": "身体直线",
            "metricC": "核心稳定",
            "muscle": "胸肌 / 肱三头肌 / 核心",
        }
    if "弯举" in exercise_name:
        return {
            "title": "哑铃弯举",
            "subtitle": "固定肘部，观察是否借力摆动",
            "metricA": "弯举幅度",
            "metricB": "肘部稳定",
            "metricC": "躯干控制",
            "muscle": "肱二头肌 / 肱肌 / 前臂",
        }
    return {
        "title": "标准深蹲",
        "subtitle": "膝盖朝向脚尖，观察下蹲深度",
        "metricA": "下蹲深度",
        "metricB": "膝盖轨迹",
        "metricC": "身体控制",
        "muscle": "股四头肌 / 臀大肌 / 核心",
    }


def build_overlay_data(exercise_name, ctx, duration_seconds):
    snapshot = ctx.video_processor.snapshot if ctx and ctx.video_processor else {}
    summary = snapshot.get("session_summary") or empty_session_summary()
    status = snapshot.get("session_status", SESSION_IDLE)
    valid = int(snapshot.get("count", 0) or 0)
    attempts = int(snapshot.get("attempts", 0) or 0)
    score = int(snapshot.get("score", 100) or 100)
    errors = list(snapshot.get("live_errors", []) or [])
    copy = exercise_overlay_copy(exercise_name)

    completion = min(100, round(valid / 5 * 100))
    form_score = max(0, min(100, score))
    stability = max(0, min(100, 88 - len(errors) * 16))
    symmetry = 72 if "左右不平衡" in errors else 92

    if errors:
        coach_title = errors[0]
        coach_text = snapshot.get("live_message", "按提示调整动作。").replace("实时纠正：", "")
    elif status == SESSION_PAUSED:
        coach_title = "训练已暂停"
        coach_text = "点击继续恢复训练"
    elif status == SESSION_ACTIVE:
        coach_title = "动作稳定"
        coach_text = "保持节奏，继续完成动作"
    else:
        coach_title = "准备开始"
        coach_text = "按空格或开始训练进入评判"

    primary_action = "start" if status in {SESSION_IDLE, SESSION_FINISHED} else "complete"
    primary_label = "开始训练" if primary_action == "start" else "完成本动作"
    pause_label = "继续" if status == SESSION_PAUSED else "暂停"

    return {
        **copy,
        "exercise": exercise_name,
        "tutorialUrl": TUTORIAL_VIDEO_SOURCES.get(exercise_name, ""),
        "valid": valid,
        "attempts": attempts,
        "score": score,
        "duration": int(duration_seconds),
        "remaining": int(snapshot.get("session_remaining", 0) or 0),
        "status": status,
        "grade": summary.get("grade", "N/A"),
        "points": int(summary.get("points", 0) or 0),
        "completion": completion,
        "formScore": form_score,
        "stability": stability,
        "symmetry": symmetry,
        "coachTitle": coach_title,
        "coachText": coach_text,
        "message": snapshot.get("live_message", "准备开始，身体进入画面后完成一次动作。"),
        "primaryAction": primary_action,
        "primaryLabel": primary_label,
        "pauseLabel": pause_label,
    }


def install_course_overlay(data):
    payload = json.dumps(data, ensure_ascii=False)
    components.html(
        f"""
<script>
(() => {{
  const data = {payload};
  const root = window.parent;
  const doc = root.document;
  root.__fitOverlayData = data;

  if (!root.__fitOverlayAction) {{
    root.__fitOverlayAction = (action) => {{
      const url = new URL(root.location.href);
      url.searchParams.set("fit_action", action);
      url.searchParams.set("fit_token", String(Date.now()));
      root.location.href = url.toString();
    }};
  }}

  const ensureStyle = () => {{
    if (doc.getElementById("fit-course-overlay-style")) return;
    const style = doc.createElement("style");
    style.id = "fit-course-overlay-style";
    style.textContent = `
      #fit-course-overlay {{
        position: fixed;
        z-index: 999997;
        pointer-events: none;
        font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif;
        color: rgba(255,255,250,.96);
        text-rendering: geometricPrecision;
        -webkit-font-smoothing: antialiased;
      }}
      #fit-course-overlay * {{ box-sizing: border-box; }}
      .fit-ov-root {{
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        border-radius: 2px;
        background: linear-gradient(90deg, rgba(0,0,0,.22), rgba(0,0,0,0) 38%, rgba(0,0,0,.24));
      }}
      .fit-ov-card {{
        position: absolute;
        pointer-events: auto;
        border: 1px solid rgba(255,255,255,.22);
        background: rgba(34,34,34,.34);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 18px 50px rgba(0,0,0,.18);
        backdrop-filter: blur(18px) saturate(125%);
        -webkit-backdrop-filter: blur(18px) saturate(125%);
      }}
      .fit-ov-top {{
        position: absolute;
        left: 2.2%;
        top: 3.2%;
        display: flex;
        gap: 20px;
        align-items: center;
      }}
      .fit-ov-back {{
        width: clamp(42px, 4.3vw, 58px);
        height: clamp(42px, 4.3vw, 58px);
        border: 0;
        border-radius: 999px;
        background: rgba(255,255,255,.9);
        color: #1f2433;
        font-size: clamp(28px, 3vw, 40px);
        line-height: 1;
        display: grid;
        place-items: center;
        cursor: pointer;
        pointer-events: auto;
      }}
      .fit-ov-title h2 {{
        margin: 0 0 8px;
        font-size: clamp(24px, 3.2vw, 42px);
        line-height: 1;
        letter-spacing: 0;
        font-weight: 800;
      }}
      .fit-ov-title p {{
        margin: 0;
        font-size: clamp(15px, 1.55vw, 22px);
        line-height: 1.15;
        color: rgba(255,255,250,.84);
      }}
      .fit-ov-pill {{
        position: absolute;
        right: 2.3%;
        top: 3.2%;
        padding: 12px 22px;
        border-radius: 999px;
        background: rgba(28,28,28,.34);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        font-size: clamp(14px, 1.35vw, 20px);
        font-weight: 750;
      }}
      .fit-ov-tutorial {{
        left: 2.2%;
        top: 14%;
        width: 27%;
        height: 23%;
        border-radius: 18px;
        overflow: hidden;
      }}
      .fit-ov-tutorial video, .fit-ov-video-placeholder {{
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }}
      .fit-ov-video-placeholder {{
        display: grid;
        place-items: center;
        background: radial-gradient(circle at 55% 45%, rgba(255,255,255,.24), rgba(255,255,255,.04));
      }}
      .fit-ov-video-title {{
        position: absolute;
        top: 18px;
        left: 22px;
        font-size: clamp(14px, 1.4vw, 20px);
        font-weight: 750;
      }}
      .fit-ov-play {{
        width: 54px;
        height: 54px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.28);
        background: rgba(30,30,38,.48);
        display: grid;
        place-items: center;
        font-size: 28px;
      }}
      .fit-ov-time {{
        position: absolute;
        left: 22px;
        bottom: 18px;
        font-size: clamp(14px, 1.3vw, 19px);
        font-weight: 700;
      }}
      .fit-ov-progress {{
        left: 3.5%;
        bottom: 15%;
        width: 22%;
        min-width: 245px;
        border-radius: 20px;
        padding: 28px 30px;
      }}
      .fit-ov-progress h3, .fit-ov-coach h3 {{
        margin: 0 0 22px;
        font-size: clamp(16px, 1.5vw, 22px);
        font-weight: 800;
      }}
      .fit-ov-ring-row {{
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 22px;
      }}
      .fit-ov-ring {{
        width: 96px;
        height: 96px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: conic-gradient(#b9ef75 calc(var(--p) * 1%), rgba(255,255,255,.18) 0);
        font-size: 30px;
        font-weight: 800;
      }}
      .fit-ov-ring::before {{
        content: "";
        position: absolute;
        width: 74px;
        height: 74px;
        border-radius: inherit;
        background: rgba(64,64,64,.58);
      }}
      .fit-ov-ring span {{ position: relative; }}
      .fit-ov-meter {{
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px 14px;
        align-items: center;
        margin: 16px 0;
        font-size: clamp(13px, 1.25vw, 18px);
        font-weight: 680;
      }}
      .fit-ov-bar {{
        grid-column: 1 / -1;
        height: 7px;
        border-radius: 999px;
        background: rgba(255,255,255,.2);
        overflow: hidden;
      }}
      .fit-ov-bar i {{
        display: block;
        height: 100%;
        width: calc(var(--v) * 1%);
        border-radius: inherit;
        background: #b9ef75;
      }}
      .fit-ov-coach {{
        right: 4%;
        top: 13%;
        width: 22%;
        min-width: 285px;
        height: 63%;
        border-radius: 22px;
        padding: 28px;
      }}
      .fit-ov-bubble {{
        display: grid;
        grid-template-columns: 64px 1fr;
        gap: 16px;
        align-items: center;
        padding: 14px;
        border-radius: 16px;
        background: rgba(255,255,255,.08);
        margin-bottom: 24px;
      }}
      .fit-ov-mascot {{
        width: 58px;
        height: 58px;
        border-radius: 18px;
        display: grid;
        place-items: center;
        background: linear-gradient(145deg, #8b7af7, #6554d9);
        font-weight: 900;
      }}
      .fit-ov-bubble strong {{
        display: block;
        color: #ffd558;
        font-size: clamp(14px, 1.25vw, 18px);
        margin-bottom: 6px;
      }}
      .fit-ov-bubble span {{
        display: block;
        font-size: clamp(13px, 1.15vw, 17px);
        color: rgba(255,255,250,.86);
      }}
      .fit-ov-section {{
        border-top: 1px solid rgba(255,255,255,.12);
        padding-top: 20px;
        margin-top: 20px;
      }}
      .fit-ov-segments {{
        display: flex;
        gap: 6px;
        margin: 12px 0 18px;
      }}
      .fit-ov-segments i {{
        flex: 1;
        height: 9px;
        border-radius: 999px;
        background: rgba(255,255,255,.16);
      }}
      .fit-ov-segments i.on.amber {{ background: #ffbe55; }}
      .fit-ov-segments i.on.green {{ background: #a8ea70; }}
      .fit-ov-muscle {{
        display: flex;
        align-items: center;
        gap: 16px;
        color: rgba(255,255,250,.82);
        font-size: clamp(12px, 1vw, 16px);
      }}
      .fit-ov-figure {{
        width: 86px;
        height: 132px;
        border: 1px solid rgba(255,255,255,.35);
        border-radius: 999px 999px 26px 26px;
        background: linear-gradient(rgba(255,255,255,.08), rgba(255,255,255,.02));
      }}
      .fit-ov-bottom {{
        position: absolute;
        left: 1.6%;
        right: 1.6%;
        bottom: 2.4%;
        height: 78px;
        border-radius: 22px;
        background: rgba(42,42,42,.42);
        border: 1px solid rgba(255,255,255,.14);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        display: grid;
        grid-template-columns: 220px 1fr 190px 1fr 320px;
        align-items: center;
        gap: 18px;
        padding: 0 28px;
        pointer-events: auto;
      }}
      .fit-ov-btn {{
        height: 52px;
        border: 0;
        border-radius: 999px;
        color: rgba(255,255,250,.96);
        background: rgba(255,255,255,.08);
        font-size: clamp(15px, 1.5vw, 21px);
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        cursor: pointer;
      }}
      .fit-ov-btn.primary {{
        background: linear-gradient(100deg, #6d83ff, #9354ea);
      }}
      .fit-ov-count {{
        text-align: center;
        font-size: clamp(16px, 1.6vw, 24px);
        font-weight: 780;
        color: rgba(255,255,250,.86);
      }}
      .fit-ov-hidden {{ display: none !important; }}
    `;
    doc.head.appendChild(style);
  }};

  const segmentHtml = (count, total, color) => Array.from({{ length: total }}, (_, i) => `<i class="${{i < count ? `on ${{color}}` : ""}}"></i>`).join("");
  const setAction = (action) => `root.__fitOverlayAction("${{action}}")`;
  const render = (d) => `
    <div class="fit-ov-root">
      <div class="fit-ov-top">
        <button class="fit-ov-back" onclick='${{setAction("previous")}}'>‹</button>
        <div class="fit-ov-title">
          <h2>${{d.title}}</h2>
          <p>${{d.subtitle}}</p>
        </div>
      </div>
      <div class="fit-ov-pill">💡 动作要点</div>
      <div class="fit-ov-card fit-ov-tutorial">
        ${{d.tutorialUrl ? `<video src="${{d.tutorialUrl}}" controls playsinline></video>` : `<div class="fit-ov-video-placeholder"><div class="fit-ov-play">▶</div></div>`}}
        <div class="fit-ov-video-title">教学视频</div>
        <div class="fit-ov-time">${{d.tutorialUrl ? "00:00 / 00:00" : "待接入视频"}}</div>
      </div>
      <div class="fit-ov-card fit-ov-progress">
        <div class="fit-ov-ring-row">
          <h3>动作完成度</h3>
          <div class="fit-ov-ring" style="--p:${{d.completion}}"><span>${{d.completion}}%</span></div>
        </div>
        ${{[
          [d.metricA, d.formScore],
          [d.metricB, d.stability],
          [d.metricC, d.symmetry]
        ].map(([label, value]) => `<div class="fit-ov-meter"><span>${{label}}</span><b>${{value}}%</b><div class="fit-ov-bar" style="--v:${{value}}"><i></i></div></div>`).join("")}}
      </div>
      <div class="fit-ov-card fit-ov-coach">
        <h3>AI正在观察 ✦</h3>
        <div class="fit-ov-bubble">
          <div class="fit-ov-mascot">AI</div>
          <div><strong>${{d.coachTitle}}</strong><span>${{d.coachText}}</span></div>
        </div>
        <div class="fit-ov-section">
          <h3>身体感受</h3>
          <div>稳定程度 <span style="float:right">${{d.stability >= 80 ? "良好" : "中等"}}</span></div>
          <div class="fit-ov-segments">${{segmentHtml(Math.round(d.stability / 12.5), 8, "amber")}}</div>
          <div>左右对称性 <span style="float:right">${{d.symmetry >= 85 ? "良好" : "中等"}}</span></div>
          <div class="fit-ov-segments">${{segmentHtml(Math.round(d.symmetry / 12.5), 8, "green")}}</div>
        </div>
        <div class="fit-ov-section">
          <h3>肌肉激活</h3>
          <div class="fit-ov-muscle"><div class="fit-ov-figure"></div><div>${{d.muscle}}<br><br>● 激活良好<br>● 激活中等<br>● 激活较弱</div></div>
        </div>
      </div>
      <div class="fit-ov-bottom">
        <button class="fit-ov-btn" onclick='${{setAction("previous")}}'>‹ 上一个</button>
        <div class="fit-ov-count">进度&nbsp; ${{Math.min(5, d.valid)}} / 5</div>
        <button class="fit-ov-btn" onclick='${{setAction("pause")}}'>⏸ ${{d.pauseLabel}}</button>
        <div class="fit-ov-count">${{d.status === "active" ? `剩余 ${{d.remaining}} 秒` : d.grade !== "N/A" ? `${{d.grade}} 级 · ${{d.points}} 分` : ""}}</div>
        <button class="fit-ov-btn primary" onclick='${{setAction(d.primaryAction)}}'>✓ ${{d.primaryLabel}}</button>
      </div>
    </div>
  `;

  const findTargetFrame = () => {{
    const frames = Array.from(doc.querySelectorAll("iframe"));
    return frames
      .map((frame) => [frame, frame.getBoundingClientRect()])
      .filter(([frame, rect]) => rect.width > 520 && rect.height > 100)
      .sort((a, b) => (b[1].width * b[1].height) - (a[1].width * a[1].height))[0];
  }};

  const sync = () => {{
    ensureStyle();
    let overlay = doc.getElementById("fit-course-overlay");
    if (!overlay) {{
      overlay = doc.createElement("div");
      overlay.id = "fit-course-overlay";
      doc.body.appendChild(overlay);
    }}
    const target = findTargetFrame();
    if (!target) {{
      overlay.classList.add("fit-ov-hidden");
      return;
    }}
    const [frame, rect] = target;
    const videoHeight = Math.min(rect.height, rect.width * 9 / 16);
    overlay.classList.remove("fit-ov-hidden");
    overlay.style.left = `${{rect.left}}px`;
    overlay.style.top = `${{rect.top}}px`;
    overlay.style.width = `${{rect.width}}px`;
    overlay.style.height = `${{videoHeight}}px`;
    overlay.innerHTML = render(root.__fitOverlayData || data);
  }};

  sync();
  if (!root.__fitOverlayInterval) {{
    root.__fitOverlayInterval = root.setInterval(sync, 700);
    root.addEventListener("resize", sync);
    root.addEventListener("scroll", sync, true);
  }}
}})();
</script>
        """,
        height=0,
    )


def render_sidebar():
    st.sidebar.title("🏋️ AI Fitness Coach")
    exercise = st.sidebar.selectbox("选择动作", list(EXERCISES.keys()), key="exercise_choice")
    duration_seconds = st.sidebar.slider("专家评判时长", min_value=15, max_value=120, value=30, step=15)
    camera_source_label = st.sidebar.radio(
        "摄像头来源",
        list(CAMERA_SOURCES.keys()),
        help="浏览器模式兼容性最好；本机模式会先找 USB/外接摄像头，3 秒找不到再回退到默认摄像头。",
    )
    st.sidebar.markdown("### 使用建议")
    st.sidebar.write("1. 浏览器模式需要允许摄像头权限，本机模式会直接读取 Windows 摄像头")
    st.sidebar.write("2. 保持全身或训练部位在画面中")
    st.sidebar.write("3. 深蹲建议正面，俯卧撑建议侧面，弯举建议侧面或 45°")
    st.sidebar.write("4. 已启用清晰课程界面模式：1280×720 / 15fps，旧帧会自动丢弃，兼顾观感和实时性")
    st.sidebar.caption("动作成功标准来自外挂知识库：knowledge/exercise_standards.json")

    rediscover_camera = False
    if CAMERA_SOURCES[camera_source_label] == "local":
        st.sidebar.caption("本机模式会优先尝试 Camera 1-5，3 秒内找不到外接摄像头再使用 Camera 0。")
        rediscover_camera = st.sidebar.button("重新检测 USB 摄像头")

    start_requested = st.sidebar.button("空格开始训练", type="primary", use_container_width=True)
    reset_requested = st.sidebar.button("重置本组训练")
    return exercise, CAMERA_SOURCES[camera_source_label], duration_seconds, start_requested, reset_requested, rediscover_camera


def render_training_calendar():
    sessions = load_history()
    st.markdown("### 后台锻炼日历")
    if not sessions:
        st.info("完成一次限时评判后，这里会记录训练日期、积分和被锻炼的身体部位。")
        return

    now = datetime.now()
    totals = body_part_totals(sessions)
    c1, c2, c3 = st.columns(3)
    c1.metric("累计积分", sum(item.get("points", 0) for item in sessions))
    c2.metric("训练回合", len(sessions))
    c3.metric("最常训练部位", totals.most_common(1)[0][0] if totals else "暂无")

    st.markdown(render_calendar_html(now.year, now.month, sessions), unsafe_allow_html=True)
    if totals:
        st.write("身体部位覆盖：" + "、".join([f"{part}({count})" for part, count in totals.most_common()]))


def render_pet_preview():
    sessions = load_history()
    total_points = sum(item.get("points", 0) for item in sessions)
    totals = body_part_totals(sessions)
    level = max(1, total_points // 500 + 1)
    favorite_part = totals.most_common(1)[0][0] if totals else "还没选择"
    progress = min(100, total_points % 500 // 5)
    st.markdown(
        f"""
<div class="fit-pet">
  <div class="fit-pet-avatar">🐾</div>
  <div>
    <div class="fit-pet-title">训练伙伴孵化舱 · Lv.{level}</div>
    <div class="fit-pet-copy">
      你的训练积分会喂养未来的宠物伙伴。当前累计 {total_points} 积分，下一等级进度 {progress}%。
      最近偏爱的训练部位：{favorite_part}。后续可以让不同身体部位解锁不同宠物技能和外观。
    </div>
  </div>
</div>
        """,
        unsafe_allow_html=True,
    )


def main():
    apply_theme()
    st.markdown(
        """
<div class="fit-hero">
  <div class="fit-hero-title">AI Exercise Coach · 专家评判训练舱</div>
  <div class="fit-hero-copy">
    按空格进入 3 秒倒计时，系统会在限时回合内用动作知识库评判标准完成、积分、评级和身体部位训练记录。
  </div>
</div>
        """,
        unsafe_allow_html=True,
    )
    install_space_start_shortcut()

    if "exercise_choice" not in st.session_state:
        st.session_state.exercise_choice = list(EXERCISES.keys())[0]
    overlay_action, overlay_token = read_overlay_action()
    apply_pre_render_overlay_action(overlay_action)

    exercise, camera_source, duration_seconds, start_requested, reset_requested, rediscover_camera = render_sidebar()
    if "webrtc_key_version" not in st.session_state:
        st.session_state.webrtc_key_version = 0
    previous_camera_source = st.session_state.get("camera_source")
    if previous_camera_source and previous_camera_source != camera_source:
        stop_local_camera_track()
        st.session_state.webrtc_key_version += 1
    st.session_state.camera_source = camera_source

    if rediscover_camera:
        stop_local_camera_track()
        st.session_state.webrtc_key_version += 1

    ctx = None
    if camera_source == "local":
        source_track = get_local_camera_track()
        if source_track:
            st.caption(st.session_state.get("local_camera_message", "已打开本机摄像头。"))
            ctx = webrtc_streamer(
                key=f"ai-fitness-coach-local-{st.session_state.webrtc_key_version}",
                mode=WebRtcMode.RECVONLY,
                rtc_configuration=RTC_CONFIGURATION,
                video_processor_factory=FitnessVideoProcessor,
                source_video_track=source_track,
                async_processing=True,
                video_receiver_size=1,
                sendback_audio=False,
            )
        else:
            st.error(st.session_state.get("local_camera_error", "未找到可用摄像头。"))
    else:
        ctx = webrtc_streamer(
            key=f"ai-fitness-coach-browser-{st.session_state.webrtc_key_version}",
            mode=WebRtcMode.SENDRECV,
            rtc_configuration=RTC_CONFIGURATION,
            video_processor_factory=FitnessVideoProcessor,
            media_stream_constraints=BROWSER_CAMERA_CONSTRAINTS,
            async_processing=True,
            video_receiver_size=1,
        )

    if ctx and ctx.video_processor:
        ctx.video_processor.set_exercise(exercise)
        if start_requested:
            ctx.video_processor.start_session(duration_seconds)
        if reset_requested:
            ctx.video_processor.reset()
        if overlay_action == "start":
            ctx.video_processor.start_session(duration_seconds)
        elif overlay_action == "pause":
            ctx.video_processor.toggle_pause()
        elif overlay_action == "complete":
            ctx.video_processor.complete_session()

    if overlay_token:
        mark_overlay_action_handled(overlay_token)

    install_course_overlay(build_overlay_data(exercise, ctx, duration_seconds))

    render_pet_preview()
    render_training_calendar()

    st.markdown("---")
    st.markdown(
        """
### 当前版本能力边界
- 这是黑客松 MVP，不是医疗或康复建议。
- 规则阈值需要根据摄像头角度、身高、镜头距离微调。
- 如需更稳定，可加入动作校准、关键点平滑、视频回放和个性化阈值。
        """
    )


if __name__ == "__main__":
    main()
