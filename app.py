import importlib
import threading
import time
from datetime import datetime
from collections import Counter

import av
import streamlit as st
from streamlit_webrtc import RTCConfiguration, VideoProcessorBase, WebRtcMode, webrtc_streamer

import feedback as feedback_module
from exercise_knowledge import get_body_parts
from exercises.bicep_curl import BicepCurlAnalyzer
from exercises.pushup import PushupAnalyzer
from exercises.squat import SquatAnalyzer
from local_camera import create_usb_first_camera_track
from pose_utils import PoseDetector, draw_correction_card, draw_session_banner, draw_text_panel
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
        "width": {"ideal": 480, "max": 640},
        "height": {"ideal": 360, "max": 480},
        "frameRate": {"ideal": 15, "max": 15},
    },
    "audio": False,
}

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
SESSION_FINISHED = "finished"


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
        self.detector = PoseDetector(model_complexity=0, process_width=384)
        self.analyzer = SquatAnalyzer()
        self.exercise_name = "深蹲 Squat"
        self.frame_index = 0
        self.process_ms = 0.0
        self.session_status = SESSION_IDLE
        self.session_duration = 30
        self.countdown_started_at = None
        self.active_started_at = None
        self.finished_at = None
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
        return 0

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
            elif session_status == SESSION_FINISHED:
                session_text = f"本轮结束 | {summary.get('grade', 'N/A')}级 | {summary.get('points', 0)}积分"
            else:
                session_text = "按空格开始：3秒倒计时后进入专家评判"

            status_lines = [
                f"当前：{self.exercise_name} | 标准 {self.snapshot['count']} / 尝试 {self.snapshot.get('attempts', 0)} | 阶段 {STAGE_LABELS.get(self.snapshot['stage'], self.snapshot['stage'])} | 最近得分 {self.snapshot['score']}",
                session_text,
                self.snapshot["live_message"],
            ]
            exercise_name = self.exercise_name
            history = list(self.snapshot.get("history", []))
            last_rep = history[-1] if history else None
            correction_title, correction_lines = build_rep_correction_text(exercise_name, last_rep)
            correction_errors = list(last_rep.get("errors", [])) if last_rep else []
            tick = self.frame_index
            banner_status = session_status
            banner_remaining = remaining
            banner_summary = summary

        output_frame = draw_correction_card(
            pose_result.annotated_frame,
            exercise_name,
            correction_errors,
            correction_title,
            correction_lines,
            tick,
        )
        output_frame = draw_session_banner(output_frame, banner_status, banner_remaining, banner_summary)
        status_y = max(12, output_frame.shape[0] - 112)
        output = draw_text_panel(output_frame, status_lines, x=14, y=status_y, font_size=16)
        return av.VideoFrame.from_ndarray(output, format="bgr24")


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
        track, message = create_usb_first_camera_track(width=480, height=360, fps=15, usb_wait_seconds=3.0)
        st.session_state.local_camera_track = track
        st.session_state.local_camera_message = message
        st.session_state.pop("local_camera_error", None)
        return track
    except RuntimeError as exc:
        st.session_state.local_camera_error = str(exc)
        return None


def install_space_start_shortcut():
    st.html(
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
        width=1,
        unsafe_allow_javascript=True,
    )

def render_sidebar():
    st.sidebar.title("🏋️ AI Fitness Coach")
    exercise = st.sidebar.selectbox("选择动作", list(EXERCISES.keys()))
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
    st.sidebar.write("4. 已启用低延迟模式：480×360 / 15fps，优先保证实时性")
    st.sidebar.caption("动作成功标准来自外挂知识库：knowledge/exercise_standards.json")

    rediscover_camera = False
    if CAMERA_SOURCES[camera_source_label] == "local":
        st.sidebar.caption("本机模式会优先尝试 Camera 1-5，3 秒内找不到外接摄像头再使用 Camera 0。")
        rediscover_camera = st.sidebar.button("重新检测 USB 摄像头")

    start_requested = st.sidebar.button("空格开始训练", type="primary", use_container_width=True)
    reset_requested = st.sidebar.button("重置本组训练")
    return exercise, CAMERA_SOURCES[camera_source_label], duration_seconds, start_requested, reset_requested, rediscover_camera


def render_metrics(ctx):
    if not ctx or not ctx.video_processor:
        st.info("启动摄像头后，这里会显示实时计数、评分和反馈。")
        return

    snapshot = ctx.video_processor.snapshot
    summary = snapshot.get("session_summary") or empty_session_summary()
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("标准完成", snapshot["count"])
    c2.metric("尝试次数", snapshot.get("attempts", len(snapshot.get("history", []))))
    c3.metric("最近评分", snapshot["score"])
    c4.metric("处理耗时", f"{snapshot.get('process_ms', 0)} ms")

    s1, s2, s3 = st.columns(3)
    s1.metric("本轮积分", summary.get("points", 0))
    s2.metric("专家评级", summary.get("grade", "N/A"))
    s3.metric("评判剩余", f"{int(snapshot.get('session_remaining', 0))} 秒")

    if snapshot["detected"] and snapshot.get("live_errors"):
        st.warning(snapshot["live_message"])
    elif snapshot["detected"]:
        st.success(snapshot["live_message"])
    else:
        st.warning(snapshot["message"])

    history = snapshot.get("history", [])
    score_details = snapshot.get("score_details") or empty_score_details()
    if history:
        st.markdown("### 最近一次得分原因")
        st.write(f"基础分：{score_details.get('base', 100)}，最近得分：{score_details.get('score', snapshot['score'])}")
        st.write("扣分原因：" + score_details.get("deduction_text", "无扣分项"))
        st.write("加分/保分原因：" + score_details.get("positive_text", "暂无"))
        st.caption(snapshot["message"])

    if history:
        scores = [h["score"] for h in history]
        all_errors = [err for h in history for err in h.get("errors", [])]
        st.markdown("### 本组训练报告")
        r1, r2, r3 = st.columns(3)
        r1.metric("总尝试", len(history))
        r2.metric("平均分", round(sum(scores) / len(scores), 1))
        r3.metric("最高分", max(scores))

        if all_errors:
            common = Counter(all_errors).most_common(3)
            st.write("最常见问题：" + "、".join([f"{name}({num}次)" for name, num in common]))
        else:
            st.write("本组动作整体很标准，继续保持。")

        st.dataframe(history, use_container_width=True)


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

    col_video, col_panel = st.columns([2, 1])

    ctx = None
    with col_video:
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
                    async_processing=False,
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
                async_processing=False,
                video_receiver_size=1,
            )

    if ctx and ctx.video_processor:
        ctx.video_processor.set_exercise(exercise)
        if start_requested:
            ctx.video_processor.start_session(duration_seconds)
        if reset_requested:
            ctx.video_processor.reset()

    with col_panel:
        render_metrics(ctx)

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
