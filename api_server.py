import base64
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Dict, Optional

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from exercise_knowledge import get_body_parts
from exercises.bicep_curl import BicepCurlAnalyzer
from exercises.pushup import PushupAnalyzer
from exercises.squat import SquatAnalyzer
from pose_utils import PoseDetector, draw_exercise_joint_highlights
from workout_store import body_part_totals, build_session_summary, load_history, save_session


SESSION_IDLE = "idle"
SESSION_ACTIVE = "active"
SESSION_FINISHED = "finished"

POSE_PROCESS_WIDTH = 640
MAX_SESSIONS = 24


EXERCISE_REGISTRY = {
    "squat": {
        "label": "深蹲 Squat",
        "backend_name": SquatAnalyzer.display_name,
        "factory": SquatAnalyzer,
    },
    "pushup": {
        "label": "俯卧撑 Push-up",
        "backend_name": PushupAnalyzer.display_name,
        "factory": PushupAnalyzer,
    },
    "curl": {
        "label": "弯举 Bicep Curl",
        "backend_name": BicepCurlAnalyzer.display_name,
        "factory": BicepCurlAnalyzer,
    },
}


app = FastAPI(title="AI Fitness Coach Pose API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SessionCreateRequest(BaseModel):
    exercise: str = Field(default="squat")
    durationSeconds: int = Field(default=30, ge=5, le=300)


class SessionActionRequest(BaseModel):
    action: str = Field(pattern="^(start|reset|finish)$")


class FrameRequest(BaseModel):
    imageData: str


@dataclass
class PoseSession:
    session_id: str
    exercise_key: str
    duration_seconds: int
    detector: PoseDetector = field(default_factory=lambda: PoseDetector(model_complexity=0, process_width=POSE_PROCESS_WIDTH))
    analyzer: object = field(init=False)
    status: str = SESSION_IDLE
    started_at: Optional[float] = None
    finished_at: Optional[float] = None
    summary: Dict = field(default_factory=dict)
    recorded: bool = False
    lock: threading.Lock = field(default_factory=threading.Lock)

    def __post_init__(self):
        self._new_analyzer()

    @property
    def config(self):
        return EXERCISE_REGISTRY[self.exercise_key]

    @property
    def backend_name(self):
        return self.config["backend_name"]

    @property
    def label(self):
        return self.config["label"]

    def _new_analyzer(self):
        self.analyzer = self.config["factory"]()

    def start(self):
        with self.lock:
            self.analyzer.reset()
            self.status = SESSION_ACTIVE
            self.started_at = time.time()
            self.finished_at = None
            self.summary = {}
            self.recorded = False

    def reset(self):
        with self.lock:
            self._new_analyzer()
            self.status = SESSION_IDLE
            self.started_at = None
            self.finished_at = None
            self.summary = {}
            self.recorded = False

    def finish(self):
        with self.lock:
            self._finish_locked(time.time())
            return self.snapshot()

    def remaining(self):
        if self.status != SESSION_ACTIVE or self.started_at is None:
            return 0
        return max(0, round(self.duration_seconds - (time.time() - self.started_at), 1))

    def _finish_locked(self, now):
        if self.status == SESSION_FINISHED:
            return
        self.status = SESSION_FINISHED
        self.finished_at = now
        history = list(self.analyzer.state.history)
        self.summary = build_session_summary(
            self.backend_name,
            history,
            self.duration_seconds,
            get_body_parts(self.backend_name),
        )
        if not self.recorded:
            save_session(self.summary)
            self.recorded = True

    def snapshot(self):
        state = self.analyzer.state
        return {
            "sessionId": self.session_id,
            "exercise": self.exercise_key,
            "exerciseLabel": self.label,
            "status": self.status,
            "remaining": self.remaining(),
            "detected": False,
            "count": state.count,
            "attempts": state.attempts,
            "stage": state.stage,
            "score": state.last_score,
            "message": state.last_message,
            "liveMessage": state.live_message,
            "liveErrors": list(state.live_errors),
            "scoreDetails": state.last_score_details,
            "history": list(state.history),
            "summary": self.summary,
        }

    def process_frame(self, frame_bgr):
        started = time.perf_counter()
        pose_result = self.detector.process(frame_bgr)
        with self.lock:
            if self.status == SESSION_ACTIVE and self.started_at is not None and self.remaining() <= 0:
                self._finish_locked(time.time())

            if pose_result.detected and self.status == SESSION_ACTIVE:
                self.analyzer.update(pose_result.landmarks)

            payload = self.snapshot()
            payload["detected"] = pose_result.detected
            payload["processMs"] = round((time.perf_counter() - started) * 1000, 1)

        annotated = draw_exercise_joint_highlights(
            pose_result.annotated_frame,
            self.backend_name,
            pose_result.landmarks,
        )
        payload["annotatedImage"] = encode_jpeg_data_url(annotated)
        return payload


sessions: Dict[str, PoseSession] = {}
sessions_lock = threading.Lock()


def decode_image_data_url(image_data: str):
    if "," in image_data:
        image_data = image_data.split(",", 1)[1]
    try:
        image_bytes = base64.b64decode(image_data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid base64 image data") from exc
    np_buffer = np.frombuffer(image_bytes, dtype=np.uint8)
    frame = cv2.imdecode(np_buffer, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Image could not be decoded")
    return frame


def encode_jpeg_data_url(frame_bgr):
    ok, buffer = cv2.imencode(".jpg", frame_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 78])
    if not ok:
        return ""
    encoded = base64.b64encode(buffer).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


def get_session_or_404(session_id: str):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def prune_sessions():
    if len(sessions) <= MAX_SESSIONS:
        return
    ordered = sorted(
        sessions.values(),
        key=lambda item: item.started_at or item.finished_at or 0,
    )
    for session in ordered[: max(0, len(sessions) - MAX_SESSIONS)]:
        sessions.pop(session.session_id, None)


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "exercises": [
            {"key": key, "label": value["label"]}
            for key, value in EXERCISE_REGISTRY.items()
        ],
        "activeSessions": len(sessions),
    }


@app.post("/api/session")
def create_session(request: SessionCreateRequest):
    exercise = request.exercise if request.exercise in EXERCISE_REGISTRY else "squat"
    session = PoseSession(
        session_id=uuid.uuid4().hex,
        exercise_key=exercise,
        duration_seconds=request.durationSeconds,
    )
    with sessions_lock:
        sessions[session.session_id] = session
        prune_sessions()
    return session.snapshot()


@app.post("/api/session/{session_id}/action")
def session_action(session_id: str, request: SessionActionRequest):
    session = get_session_or_404(session_id)
    if request.action == "start":
        session.start()
    elif request.action == "reset":
        session.reset()
    elif request.action == "finish":
        return session.finish()
    return session.snapshot()


@app.post("/api/session/{session_id}/frame")
def process_frame(session_id: str, request: FrameRequest):
    session = get_session_or_404(session_id)
    frame = decode_image_data_url(request.imageData)
    return session.process_frame(frame)


@app.get("/api/history")
def history():
    sessions_data = load_history()
    totals = body_part_totals(sessions_data)
    return {
        "sessions": sessions_data,
        "totalPoints": sum(item.get("points", 0) for item in sessions_data),
        "totalSessions": len(sessions_data),
        "bodyPartTotals": [{"name": name, "count": count} for name, count in totals.most_common()],
    }

