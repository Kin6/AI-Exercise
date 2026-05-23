import math
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, Sequence, Tuple

import cv2
import mediapipe as mp
import numpy as np

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:  # pragma: no cover - fallback for minimal environments
    Image = None
    ImageDraw = None
    ImageFont = None

Point = Tuple[float, float]

mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils


LANDMARK_NAMES = {
    "left_shoulder": mp_pose.PoseLandmark.LEFT_SHOULDER.value,
    "right_shoulder": mp_pose.PoseLandmark.RIGHT_SHOULDER.value,
    "left_elbow": mp_pose.PoseLandmark.LEFT_ELBOW.value,
    "right_elbow": mp_pose.PoseLandmark.RIGHT_ELBOW.value,
    "left_wrist": mp_pose.PoseLandmark.LEFT_WRIST.value,
    "right_wrist": mp_pose.PoseLandmark.RIGHT_WRIST.value,
    "left_hip": mp_pose.PoseLandmark.LEFT_HIP.value,
    "right_hip": mp_pose.PoseLandmark.RIGHT_HIP.value,
    "left_knee": mp_pose.PoseLandmark.LEFT_KNEE.value,
    "right_knee": mp_pose.PoseLandmark.RIGHT_KNEE.value,
    "left_ankle": mp_pose.PoseLandmark.LEFT_ANKLE.value,
    "right_ankle": mp_pose.PoseLandmark.RIGHT_ANKLE.value,
}

GUIDANCE_CONNECTIONS = [
    ("left_shoulder", "right_shoulder"),
    ("left_shoulder", "left_elbow"),
    ("left_elbow", "left_wrist"),
    ("right_shoulder", "right_elbow"),
    ("right_elbow", "right_wrist"),
    ("left_shoulder", "left_hip"),
    ("right_shoulder", "right_hip"),
    ("left_hip", "right_hip"),
    ("left_hip", "left_knee"),
    ("left_knee", "left_ankle"),
    ("right_hip", "right_knee"),
    ("right_knee", "right_ankle"),
]

POSE_SEGMENTS = [
    ("torso", ("left_shoulder", "right_shoulder")),
    ("torso", ("left_shoulder", "left_hip")),
    ("torso", ("right_shoulder", "right_hip")),
    ("torso", ("left_hip", "right_hip")),
    ("left_arm", ("left_shoulder", "left_elbow")),
    ("left_arm", ("left_elbow", "left_wrist")),
    ("right_arm", ("right_shoulder", "right_elbow")),
    ("right_arm", ("right_elbow", "right_wrist")),
    ("left_leg", ("left_hip", "left_knee")),
    ("left_leg", ("left_knee", "left_ankle")),
    ("right_leg", ("right_hip", "right_knee")),
    ("right_leg", ("right_knee", "right_ankle")),
]

POSE_COLORS = {
    "torso": (188, 222, 168),
    "left_arm": (214, 244, 172),
    "right_arm": (214, 244, 172),
    "left_leg": (214, 244, 172),
    "right_leg": (214, 244, 172),
}

JOINT_GROUPS = {
    "left_shoulder": "torso",
    "right_shoulder": "torso",
    "left_hip": "torso",
    "right_hip": "torso",
    "left_elbow": "left_arm",
    "left_wrist": "left_arm",
    "right_elbow": "right_arm",
    "right_wrist": "right_arm",
    "left_knee": "left_leg",
    "left_ankle": "left_leg",
    "right_knee": "right_leg",
    "right_ankle": "right_leg",
}

EXERCISE_ACTIVE_JOINTS = {
    "深蹲": {"left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle"},
    "俯卧撑": {"left_shoulder", "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist", "left_hip", "right_hip"},
    "弯举": {"left_shoulder", "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist"},
}

FONT_CANDIDATES = [
    os.environ.get("AI_FITNESS_FONT", ""),
    "C:/Windows/Fonts/msyh.ttc",
    "C:/Windows/Fonts/simhei.ttf",
    "C:/Windows/Fonts/simsun.ttc",
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/STHeiti Light.ttc",
    "/System/Library/Fonts/STHeiti Medium.ttc",
    "/System/Library/Fonts/Supplemental/Songti.ttc",
    "/System/Library/Fonts/Supplemental/Heiti.ttc",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
    "/Library/Fonts/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansSC-Regular.otf",
    "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]

_FONT_CACHE = {}
_FONT_PATHS_CACHE = None
_TEXT_PANEL_CACHE = {}
_CORRECTION_CARD_BASE_CACHE = {}


@dataclass
class PoseResult:
    landmarks: Dict[str, Tuple[float, float, float]]
    annotated_frame: np.ndarray
    detected: bool


class PoseDetector:
    def __init__(self, model_complexity: int = 0, process_width: int = 480):
        self.process_width = process_width
        self.pose = mp_pose.Pose(
            static_image_mode=False,
            model_complexity=model_complexity,
            smooth_landmarks=True,
            enable_segmentation=False,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

    def process(self, frame_bgr: np.ndarray) -> PoseResult:
        h, w = frame_bgr.shape[:2]
        process_frame = frame_bgr
        if self.process_width and w > self.process_width:
            scale = self.process_width / w
            process_frame = cv2.resize(frame_bgr, (self.process_width, int(h * scale)), interpolation=cv2.INTER_AREA)

        process_frame.flags.writeable = False
        image_rgb = cv2.cvtColor(process_frame, cv2.COLOR_BGR2RGB)
        result = self.pose.process(image_rgb)
        annotated = frame_bgr.copy()

        landmarks: Dict[str, Tuple[float, float, float]] = {}
        detected = result.pose_landmarks is not None

        if detected:
            for name, idx in LANDMARK_NAMES.items():
                lm = result.pose_landmarks.landmark[idx]
                landmarks[name] = (lm.x * w, lm.y * h, lm.visibility)
            _draw_colored_pose(annotated, landmarks)

        return PoseResult(landmarks=landmarks, annotated_frame=annotated, detected=detected)


def _draw_colored_pose(frame: np.ndarray, landmarks: Dict[str, Tuple[float, float, float]]) -> None:
    glow = frame.copy()
    for group, (start_key, end_key) in POSE_SEGMENTS:
        start = landmarks.get(start_key)
        end = landmarks.get(end_key)
        if not start or not end or start[2] < 0.42 or end[2] < 0.42:
            continue
        p1 = (int(start[0]), int(start[1]))
        p2 = (int(end[0]), int(end[1]))
        cv2.line(glow, p1, p2, (214, 244, 172), 6, cv2.LINE_AA)
        cv2.line(frame, p1, p2, (242, 246, 238), 2, cv2.LINE_AA)
    cv2.addWeighted(glow, 0.16, frame, 0.84, 0, frame)

    for key, point in landmarks.items():
        if point[2] < 0.42:
            continue
        center = (int(point[0]), int(point[1]))
        if "shoulder" in key:
            color = (236, 242, 222)
            glow_color = (120, 216, 126)
        elif key in {"left_hip", "right_hip"}:
            color = (185, 230, 170)
            glow_color = (126, 205, 122)
        else:
            color = (214, 244, 172)
            glow_color = (130, 206, 122)
        halo = frame.copy()
        cv2.circle(halo, center, 10, glow_color, -1, cv2.LINE_AA)
        cv2.addWeighted(halo, 0.22, frame, 0.78, 0, frame)
        cv2.circle(frame, center, 5, (246, 248, 241), -1, cv2.LINE_AA)
        cv2.circle(frame, center, 3, color, -1, cv2.LINE_AA)


def draw_exercise_joint_highlights(
    frame: np.ndarray,
    exercise_name: str,
    landmarks: Dict[str, Tuple[float, float, float]],
) -> np.ndarray:
    active = _active_joint_keys(exercise_name)
    if not active or not landmarks:
        return frame
    out = frame.copy()
    for key in active:
        point = landmarks.get(key)
        if not point or point[2] < 0.42:
            continue
        center = (int(point[0]), int(point[1]))
        halo = out.copy()
        cv2.circle(halo, center, 9, (70, 154, 255), -1, cv2.LINE_AA)
        cv2.addWeighted(halo, 0.25, out, 0.75, 0, out)
        cv2.circle(out, center, 5, (78, 170, 255), 2, cv2.LINE_AA)
        cv2.circle(out, center, 2, (250, 245, 230), -1, cv2.LINE_AA)
    return out


def _active_joint_keys(exercise_name: str):
    for key, joints in EXERCISE_ACTIVE_JOINTS.items():
        if key in exercise_name:
            return joints
    return set()


def xy(point: Tuple[float, float, float]) -> Point:
    return point[0], point[1]


def visibility_ok(landmarks: Dict[str, Tuple[float, float, float]], keys, threshold: float = 0.45) -> bool:
    return all(k in landmarks and landmarks[k][2] >= threshold for k in keys)


def calculate_angle(a: Point, b: Point, c: Point) -> Optional[float]:
    """Return angle ABC in degrees. b is the joint point."""
    ax, ay = a
    bx, by = b
    cx, cy = c
    ba = (ax - bx, ay - by)
    bc = (cx - bx, cy - by)
    dot = ba[0] * bc[0] + ba[1] * bc[1]
    mag_ba = math.hypot(*ba)
    mag_bc = math.hypot(*bc)
    if mag_ba == 0 or mag_bc == 0:
        return None
    cos_angle = max(min(dot / (mag_ba * mag_bc), 1.0), -1.0)
    return math.degrees(math.acos(cos_angle))


def line_angle_to_vertical(top: Point, bottom: Point) -> float:
    """Angle between a line and vertical axis in degrees."""
    dx = top[0] - bottom[0]
    dy = top[1] - bottom[1]
    return abs(math.degrees(math.atan2(dx, dy)))


def midpoint(p1: Point, p2: Point) -> Point:
    return (p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2


def distance_point_to_line(point: Point, a: Point, b: Point) -> float:
    px, py = point
    ax, ay = a
    bx, by = b
    num = abs((by - ay) * px - (bx - ax) * py + bx * ay - by * ax)
    den = math.hypot(by - ay, bx - ax)
    return num / den if den else 0.0


def _point(landmarks: Dict[str, Tuple[float, float, float]], key: str) -> Optional[Point]:
    if key not in landmarks:
        return None
    return landmarks[key][0], landmarks[key][1]


def _target_point(target: Dict[str, Point], key_or_keys) -> Optional[Point]:
    if isinstance(key_or_keys, tuple):
        points = [target.get(key) for key in key_or_keys if key in target]
        if len(points) != len(key_or_keys):
            return None
        return midpoint(points[0], points[1])
    return target.get(key_or_keys)


def _current_point(landmarks: Dict[str, Tuple[float, float, float]], key_or_keys) -> Optional[Point]:
    if isinstance(key_or_keys, tuple):
        points = [_point(landmarks, key) for key in key_or_keys]
        if any(point is None for point in points):
            return None
        return midpoint(points[0], points[1])
    return _point(landmarks, key_or_keys)


def _clamp_point(point: Point, width: int, height: int) -> Point:
    return (
        max(8, min(width - 8, point[0])),
        max(8, min(height - 8, point[1])),
    )


def _distance(a: Point, b: Point) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _unit_vector(a: Point, b: Point, fallback: Point = (1.0, 0.0)) -> Point:
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    length = math.hypot(dx, dy)
    if length < 1e-6:
        return fallback
    return dx / length, dy / length


def _build_squat_target(landmarks: Dict[str, Tuple[float, float, float]], width: int, height: int) -> Dict[str, Point]:
    left_ankle = _point(landmarks, "left_ankle")
    right_ankle = _point(landmarks, "right_ankle")
    left_shoulder = _point(landmarks, "left_shoulder")
    right_shoulder = _point(landmarks, "right_shoulder")
    if not all([left_ankle, right_ankle, left_shoulder, right_shoulder]):
        return {}

    ankle_y = max(left_ankle[1], right_ankle[1])
    mid_x = (left_ankle[0] + right_ankle[0]) / 2
    shoulder_mid = midpoint(left_shoulder, right_shoulder)
    body_height = max(abs(ankle_y - shoulder_mid[1]), height * 0.42)
    foot_span = max(abs(left_ankle[0] - right_ankle[0]), width * 0.26)
    shoulder_span = max(abs(left_shoulder[0] - right_shoulder[0]), foot_span * 0.48)
    hip_span = foot_span * 0.44
    knee_span = foot_span * 0.88

    left_x = mid_x - foot_span / 2
    right_x = mid_x + foot_span / 2
    knee_y = ankle_y - body_height * 0.30
    hip_y = ankle_y - body_height * 0.34
    shoulder_y = hip_y - body_height * 0.34

    target = {
        "left_ankle": (left_x, ankle_y),
        "right_ankle": (right_x, ankle_y),
        "left_knee": (mid_x - knee_span / 2, knee_y),
        "right_knee": (mid_x + knee_span / 2, knee_y),
        "left_hip": (mid_x - hip_span / 2, hip_y),
        "right_hip": (mid_x + hip_span / 2, hip_y),
        "left_shoulder": (mid_x - shoulder_span / 2, shoulder_y),
        "right_shoulder": (mid_x + shoulder_span / 2, shoulder_y),
    }
    return {key: _clamp_point(point, width, height) for key, point in target.items()}


def _build_pushup_target(landmarks: Dict[str, Tuple[float, float, float]], width: int, height: int) -> Dict[str, Point]:
    shoulder = _point(landmarks, "left_shoulder")
    wrist = _point(landmarks, "left_wrist")
    ankle = _point(landmarks, "left_ankle")
    if not all([shoulder, wrist, ankle]):
        return {}

    body_len = max(_distance(shoulder, ankle), width * 0.35)
    unit = _unit_vector(ankle, shoulder, fallback=(-1.0, -0.08))
    target_ankle = ankle
    target_shoulder = (ankle[0] + unit[0] * body_len, ankle[1] + unit[1] * body_len)
    target_hip = (ankle[0] + unit[0] * body_len * 0.48, ankle[1] + unit[1] * body_len * 0.48)

    shoulder_wrist = _distance(target_shoulder, wrist)
    if shoulder_wrist > 8:
        mid = midpoint(target_shoulder, wrist)
        perp = (-(wrist[1] - target_shoulder[1]) / shoulder_wrist, (wrist[0] - target_shoulder[0]) / shoulder_wrist)
        offset = shoulder_wrist / 2
        candidates = [
            (mid[0] + perp[0] * offset, mid[1] + perp[1] * offset),
            (mid[0] - perp[0] * offset, mid[1] - perp[1] * offset),
        ]
        target_elbow = max(candidates, key=lambda p: p[1])
    else:
        target_elbow = (wrist[0], wrist[1] + body_len * 0.12)

    target = {
        "left_shoulder": target_shoulder,
        "left_elbow": target_elbow,
        "left_wrist": wrist,
        "left_hip": target_hip,
        "left_ankle": target_ankle,
    }
    return {key: _clamp_point(point, width, height) for key, point in target.items()}


def _build_curl_target(landmarks: Dict[str, Tuple[float, float, float]], width: int, height: int) -> Dict[str, Point]:
    shoulder = _point(landmarks, "left_shoulder")
    elbow = _point(landmarks, "left_elbow")
    wrist = _point(landmarks, "left_wrist")
    if not all([shoulder, elbow, wrist]):
        return {}

    forearm_len = max(_distance(elbow, wrist), _distance(shoulder, elbow) * 0.92, height * 0.12)
    toward_shoulder = _unit_vector(elbow, shoulder, fallback=(0.0, -1.0))
    target_wrist = (
        elbow[0] + toward_shoulder[0] * forearm_len * 0.92,
        elbow[1] + toward_shoulder[1] * forearm_len * 0.92,
    )
    target = {
        "left_shoulder": shoulder,
        "left_elbow": elbow,
        "left_wrist": target_wrist,
    }
    return {key: _clamp_point(point, width, height) for key, point in target.items()}


def build_target_pose(exercise_name: str, landmarks: Dict[str, Tuple[float, float, float]], frame_shape) -> Dict[str, Point]:
    height, width = frame_shape[:2]
    if "深蹲" in exercise_name:
        return _build_squat_target(landmarks, width, height)
    if "俯卧撑" in exercise_name:
        return _build_pushup_target(landmarks, width, height)
    if "弯举" in exercise_name:
        return _build_curl_target(landmarks, width, height)
    return {}


def _draw_guidance_arrows(
    frame: np.ndarray,
    landmarks: Dict[str, Tuple[float, float, float]],
    target: Dict[str, Point],
    errors: Sequence[str],
) -> np.ndarray:
    arrow_map = {
        "深度不足": [(("left_hip", "right_hip"), ("left_hip", "right_hip"))],
        "膝盖内扣": [("left_knee", "left_knee"), ("right_knee", "right_knee")],
        "背部前倾": [(("left_shoulder", "right_shoulder"), ("left_shoulder", "right_shoulder"))],
        "左右不平衡": [("left_knee", "left_knee"), ("right_knee", "right_knee")],
        "身体不成直线": [("left_hip", "left_hip")],
        "髋部塌陷或抬太高": [("left_hip", "left_hip")],
        "下放不够": [("left_elbow", "left_elbow")],
        "肘部晃动": [("left_elbow", "left_elbow")],
        "动作幅度不足": [("left_wrist", "left_wrist")],
        "借力摆动": [("left_shoulder", "left_shoulder")],
    }
    for error in dict.fromkeys(errors):
        for source_key, target_key in arrow_map.get(error, []):
            source = _current_point(landmarks, source_key)
            destination = _target_point(target, target_key)
            if not source or not destination or _distance(source, destination) < 10:
                continue
            cv2.arrowedLine(
                frame,
                (int(source[0]), int(source[1])),
                (int(destination[0]), int(destination[1])),
                (255, 90, 240),
                4,
                cv2.LINE_AA,
                tipLength=0.22,
            )
    return frame


def draw_guidance_overlay(
    frame: np.ndarray,
    exercise_name: str,
    landmarks: Dict[str, Tuple[float, float, float]],
    errors: Sequence[str],
    show_target: bool = True,
) -> np.ndarray:
    if not show_target or not landmarks:
        return frame

    target = build_target_pose(exercise_name, landmarks, frame.shape)
    if not target:
        return frame

    overlay = frame.copy()
    for start, end in GUIDANCE_CONNECTIONS:
        if start not in target or end not in target:
            continue
        p1 = target[start]
        p2 = target[end]
        cv2.line(overlay, (int(p1[0]), int(p1[1])), (int(p2[0]), int(p2[1])), (80, 245, 255), 7, cv2.LINE_AA)
        cv2.line(overlay, (int(p1[0]), int(p1[1])), (int(p2[0]), int(p2[1])), (255, 255, 255), 2, cv2.LINE_AA)

    for point in target.values():
        cv2.circle(overlay, (int(point[0]), int(point[1])), 7, (80, 245, 255), -1, cv2.LINE_AA)
        cv2.circle(overlay, (int(point[0]), int(point[1])), 3, (255, 255, 255), -1, cv2.LINE_AA)

    out = cv2.addWeighted(overlay, 0.44, frame, 0.56, 0)
    return _draw_guidance_arrows(out, landmarks, target, errors)


def _smooth_pingpong(tick: int) -> float:
    value = (math.sin(tick * 0.13) + 1.0) / 2.0
    return value * value * (3 - 2 * value)


def _blend_pose(wrong: Dict[str, Point], target: Dict[str, Point], progress: float) -> Dict[str, Point]:
    blended = {}
    for key, wrong_point in wrong.items():
        target_point = target.get(key, wrong_point)
        blended[key] = (
            wrong_point[0] + (target_point[0] - wrong_point[0]) * progress,
            wrong_point[1] + (target_point[1] - wrong_point[1]) * progress,
        )
    return blended


def _mini_connections(exercise_name: str):
    if "俯卧撑" in exercise_name:
        return [("shoulder", "elbow"), ("elbow", "wrist"), ("shoulder", "hip"), ("hip", "ankle")]
    if "弯举" in exercise_name:
        return [("shoulder", "hip"), ("shoulder", "elbow"), ("elbow", "wrist")]
    return [
        ("left_shoulder", "right_shoulder"),
        ("left_shoulder", "left_hip"),
        ("right_shoulder", "right_hip"),
        ("left_hip", "right_hip"),
        ("left_hip", "left_knee"),
        ("left_knee", "left_ankle"),
        ("right_hip", "right_knee"),
        ("right_knee", "right_ankle"),
    ]


def _squat_mini_poses(errors: Sequence[str]):
    target = {
        "left_shoulder": (0.38, 0.20),
        "right_shoulder": (0.62, 0.20),
        "left_hip": (0.42, 0.55),
        "right_hip": (0.58, 0.55),
        "left_knee": (0.26, 0.67),
        "right_knee": (0.74, 0.67),
        "left_ankle": (0.20, 0.92),
        "right_ankle": (0.80, 0.92),
    }
    wrong = dict(target)
    if "深度不足" in errors:
        wrong["left_hip"] = (0.42, 0.42)
        wrong["right_hip"] = (0.58, 0.42)
        wrong["left_knee"] = (0.31, 0.63)
        wrong["right_knee"] = (0.69, 0.63)
        wrong["left_shoulder"] = (0.38, 0.08)
        wrong["right_shoulder"] = (0.62, 0.08)
    if "膝盖内扣" in errors:
        wrong["left_knee"] = (0.43, wrong["left_knee"][1])
        wrong["right_knee"] = (0.57, wrong["right_knee"][1])
    if "背部前倾" in errors:
        wrong["left_shoulder"] = (0.22, wrong["left_shoulder"][1] + 0.10)
        wrong["right_shoulder"] = (0.46, wrong["right_shoulder"][1] + 0.10)
    if "左右不平衡" in errors:
        wrong["left_hip"] = (wrong["left_hip"][0], wrong["left_hip"][1] - 0.08)
        wrong["left_knee"] = (wrong["left_knee"][0] + 0.05, wrong["left_knee"][1] - 0.05)
    return wrong, target


def _pushup_mini_poses(errors: Sequence[str]):
    target = {
        "shoulder": (0.25, 0.46),
        "elbow": (0.36, 0.73),
        "wrist": (0.48, 0.46),
        "hip": (0.62, 0.48),
        "ankle": (0.90, 0.50),
    }
    wrong = dict(target)
    if "下放不够" in errors:
        wrong["shoulder"] = (0.24, 0.30)
        wrong["elbow"] = (0.35, 0.52)
        wrong["wrist"] = (0.48, 0.46)
        wrong["hip"] = (0.62, 0.32)
        wrong["ankle"] = (0.90, 0.34)
    if "身体不成直线" in errors or "髋部塌陷或抬太高" in errors:
        wrong["hip"] = (0.62, 0.66)
    return wrong, target


def _curl_mini_poses(errors: Sequence[str]):
    target = {
        "shoulder": (0.45, 0.22),
        "hip": (0.48, 0.88),
        "elbow": (0.50, 0.58),
        "wrist": (0.38, 0.30),
    }
    wrong = dict(target)
    if "动作幅度不足" in errors:
        wrong["wrist"] = (0.28, 0.54)
    if "肘部晃动" in errors:
        wrong["elbow"] = (0.68, 0.56)
        wrong["wrist"] = (0.58, wrong["wrist"][1])
    if "借力摆动" in errors:
        wrong["shoulder"] = (0.60, 0.20)
        wrong["hip"] = (0.42, 0.88)
    return wrong, target


def _mini_poses(exercise_name: str, errors: Sequence[str]):
    if "俯卧撑" in exercise_name:
        return _pushup_mini_poses(errors)
    if "弯举" in exercise_name:
        return _curl_mini_poses(errors)
    return _squat_mini_poses(errors)


def _pose_to_pixels(pose: Dict[str, Point], x: int, y: int, width: int, height: int):
    return {key: (int(x + px * width), int(y + py * height)) for key, (px, py) in pose.items()}


def _draw_mini_skeleton(
    frame: np.ndarray,
    pose: Dict[str, Point],
    connections,
    color,
    thickness: int,
    radius: int,
    alpha: float = 1.0,
):
    target = frame
    if alpha < 1:
        target = frame.copy()
    for start, end in connections:
        if start in pose and end in pose:
            cv2.line(target, pose[start], pose[end], color, thickness, cv2.LINE_AA)
    for point in pose.values():
        cv2.circle(target, point, radius, color, -1, cv2.LINE_AA)
        cv2.circle(target, point, max(1, radius // 2), (255, 255, 255), -1, cv2.LINE_AA)
    if alpha < 1:
        cv2.addWeighted(target, alpha, frame, 1 - alpha, 0, frame)


def _midpoint_from_pose(pose: Dict[str, Point], keys) -> Optional[Point]:
    if isinstance(keys, tuple):
        points = [pose.get(key) for key in keys]
        if any(point is None for point in points):
            return None
        return midpoint(points[0], points[1])
    return pose.get(keys)


def _mini_arrow_keys(error: str):
    return {
        "深度不足": (("left_hip", "right_hip"), ("left_hip", "right_hip")),
        "膝盖内扣": ("left_knee", "left_knee"),
        "背部前倾": (("left_shoulder", "right_shoulder"), ("left_shoulder", "right_shoulder")),
        "左右不平衡": ("left_knee", "left_knee"),
        "下放不够": ("shoulder", "shoulder"),
        "身体不成直线": ("hip", "hip"),
        "髋部塌陷或抬太高": ("hip", "hip"),
        "肘部晃动": ("elbow", "elbow"),
        "动作幅度不足": ("wrist", "wrist"),
        "借力摆动": ("shoulder", "shoulder"),
    }.get(error)


def _draw_mini_arrow(frame: np.ndarray, wrong: Dict[str, Point], target: Dict[str, Point], errors: Sequence[str]):
    for error in errors:
        keys = _mini_arrow_keys(error)
        if not keys:
            continue
        start = _midpoint_from_pose(wrong, keys[0])
        end = _midpoint_from_pose(target, keys[1])
        if not start or not end or _distance(start, end) < 6:
            continue
        start_point = (int(start[0]), int(start[1]))
        end_point = (int(end[0]), int(end[1]))
        cv2.arrowedLine(frame, start_point, end_point, (255, 100, 235), 3, cv2.LINE_AA, tipLength=0.25)
        break


def _draw_text_block(frame: np.ndarray, title: str, lines, x: int, y: int, max_width: int, font_size: int = 17):
    if Image is None or ImageDraw is None:
        return frame

    title_font = _load_font(font_size + 3)
    body_font = _load_font(font_size)
    pil_image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)).convert("RGBA")
    draw = ImageDraw.Draw(pil_image)
    draw.text((x, y), title, font=title_font, fill=(255, 255, 255, 255))

    body_y = y + font_size + 10
    for line in lines:
        for wrapped in _wrap_text(draw, str(line), body_font, max_width):
            fill = (255, 235, 150, 255) if wrapped.startswith("问题") or wrapped.startswith("纠正") else (220, 238, 245, 255)
            draw.text((x, body_y), wrapped, font=body_font, fill=fill)
            body_y += font_size + 7
            if body_y > y + 128:
                break
        if body_y > y + 128:
            break
    return cv2.cvtColor(np.array(pil_image.convert("RGB")), cv2.COLOR_RGB2BGR)


def _alpha_blend_rgba(frame: np.ndarray, overlay_rgba: np.ndarray) -> np.ndarray:
    if overlay_rgba.shape[:2] != frame.shape[:2]:
        return frame
    alpha_channel = overlay_rgba[:, :, 3]
    ys, xs = np.where(alpha_channel > 0)
    if len(xs) == 0:
        return frame
    x1, x2 = xs.min(), xs.max() + 1
    y1, y2 = ys.min(), ys.max() + 1
    alpha = alpha_channel[y1:y2, x1:x2, None].astype(np.float32) / 255.0
    overlay_bgr = cv2.cvtColor(overlay_rgba[y1:y2, x1:x2, :3], cv2.COLOR_RGB2BGR).astype(np.float32)
    base = frame[y1:y2, x1:x2].astype(np.float32)
    blended = base * (1.0 - alpha) + overlay_bgr * alpha
    out = frame.copy()
    out[y1:y2, x1:x2] = blended.astype(np.uint8)
    return out


def _cached_correction_card_base(
    frame_shape,
    title: str,
    lines,
    x: int,
    y: int,
    card_width: int,
    card_height: int,
    mini_x: int,
    font_size: int = 17,
):
    height, width = frame_shape[:2]
    key = (width, height, title, tuple(map(str, lines)), x, y, card_width, card_height, mini_x, font_size)
    cached = _CORRECTION_CARD_BASE_CACHE.get(key)
    if cached is not None:
        return cached

    if Image is None or ImageDraw is None:
        return None

    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rectangle((x, y, x + card_width, y + card_height), fill=(15, 18, 22, 190))
    draw.rectangle((x, y, x + card_width, y + card_height), outline=(85, 235, 245, 235), width=2)

    mono_font = _load_font(14)
    title_font = _load_font(font_size + 3)
    body_font = _load_font(font_size)
    draw.text((mini_x, y + 16), "fix replay", font=mono_font, fill=(150, 245, 255, 255))

    text_x = mini_x + min(150, int(card_width * 0.34)) + 18
    text_width = max(120, x + card_width - text_x - 12)
    draw.text((text_x, y + 18), title, font=title_font, fill=(255, 255, 255, 255))

    body_y = y + 18 + font_size + 10
    for line in lines:
        for wrapped in _wrap_text(draw, str(line), body_font, text_width):
            fill = (255, 235, 150, 255) if wrapped.startswith("问题") or wrapped.startswith("纠正") else (220, 238, 245, 255)
            draw.text((text_x, body_y), wrapped, font=body_font, fill=fill)
            body_y += font_size + 7
            if body_y > y + 128:
                break
        if body_y > y + 128:
            break

    cached = np.array(overlay)
    if len(_CORRECTION_CARD_BASE_CACHE) > 16:
        _CORRECTION_CARD_BASE_CACHE.clear()
    _CORRECTION_CARD_BASE_CACHE[key] = cached
    return cached


def _exercise_primary_label(exercise_name: str) -> str:
    if "俯卧撑" in exercise_name:
        return "俯卧撑动作"
    if "弯举" in exercise_name:
        return "弯举动作"
    return "深蹲动作"


def _standard_focus_lines(exercise_name: str):
    if "俯卧撑" in exercise_name:
        return ["身体成直线", "肘部接近 90°", "核心保持稳定"]
    if "弯举" in exercise_name:
        return ["肘部贴近身体", "手腕靠近肩部", "躯干不借力摆动"]
    return ["膝盖朝脚尖方向", "背部保持中立", "下蹲更稳定"]


def _compact_feedback_lines(lines, has_errors: bool):
    if not has_errors:
        return []
    compact = []
    for line in lines:
        text = str(line)
        if text.startswith("第"):
            score_part = text.split("：", 1)[0].replace("尝试得分", "")
            if "未计入" in text:
                compact.append(f"{score_part}，未计入")
            elif "已计入" in text:
                compact.append(f"{score_part}，已计入")
            else:
                compact.append(score_part)
        elif text.startswith("问题："):
            compact.append(text.replace("问题：", "问题：", 1))
        elif text.startswith("纠正："):
            compact.append(text.replace("纠正：", "纠正：", 1))
        elif text:
            compact.append(text)
        if len(compact) >= 3:
            break
    return compact


def _draw_hud_card(draw, box, title: str, subtitle: str = "", accent=(36, 211, 238)):
    x1, y1, x2, y2 = box
    draw.rounded_rectangle(box, radius=12, fill=(8, 15, 20, 160), outline=(*accent, 205), width=2)
    draw.line((x1 + 12, y1 + 1, x2 - 12, y1 + 1), fill=(145, 236, 244, 70), width=1)
    title_font = _load_font(17)
    body_font = _load_font(12)
    draw.text((x1 + 14, y1 + 11), title, font=title_font, fill=(*accent, 255))
    if subtitle:
        draw.text((x1 + 14, y1 + 36), subtitle, font=body_font, fill=(224, 238, 240, 225))


def _draw_status_row(draw, text: str, x: int, y: int, accent=(36, 211, 238), max_x: Optional[int] = None):
    font = _load_font(15)
    label_font = _load_font(14)
    parts = [part.strip() for part in text.split("|")]
    cursor = x
    for index, part in enumerate(parts):
        active_font = font if index == 0 else label_font
        bbox = draw.textbbox((cursor, y), part, font=active_font)
        if max_x is not None and bbox[2] > max_x:
            if index == 0:
                part = part[: max(4, int((max_x - cursor) / 14))] + "…"
                bbox = draw.textbbox((cursor, y), part, font=active_font)
            else:
                break
        if index:
            draw.line((cursor, y - 1, cursor, y + 22), fill=(119, 142, 151, 130), width=1)
            cursor += 16
        if "最近得分" in part or "积分" in part:
            fill = (*accent, 255)
        else:
            fill = (231, 238, 240, 245)
        draw.text((cursor, y), part, font=active_font, fill=fill)
        bbox = draw.textbbox((cursor, y), part, font=active_font)
        cursor = bbox[2] + 18


def _scale_for(width: int) -> float:
    return max(0.72, min(1.28, width / 720.0))


def _font_scaled(base: int, scale: float):
    return _load_font(max(10, int(base * scale)))


def _draw_centered_text(draw, box, text: str, font, fill, x_offset: int = 0, y_offset: int = 0):
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = box[0] + (box[2] - box[0] - text_w) / 2 - bbox[0] + x_offset
    y = box[1] + (box[3] - box[1] - text_h) / 2 - bbox[1] + y_offset
    draw.text((x, y), text, font=font, fill=fill)


def _fit_text(draw, text: str, font, max_width: int) -> str:
    if draw.textbbox((0, 0), text, font=font)[2] <= max_width:
        return text
    result = ""
    for char in text:
        candidate = result + char
        if draw.textbbox((0, 0), candidate + "…", font=font)[2] > max_width:
            return result + "…" if result else "…"
        result = candidate
    return result


def _exercise_course_title(exercise_name: str) -> Tuple[str, str]:
    if "俯卧撑" in exercise_name:
        return "俯卧撑训练", "收紧核心，观察身体是否成直线"
    if "弯举" in exercise_name:
        return "哑铃弯举", "固定肘部，观察是否借力摆动"
    return "标准深蹲", "膝盖朝向脚尖，观察下蹲深度"


def _extract_status_metrics(lines):
    first = str(lines[0]) if lines else ""
    second = str(lines[1]) if len(lines) > 1 else ""
    metrics = {"exercise": "训练", "valid": "0", "attempts": "0", "stage": "准备", "score": "100", "session": second}
    if "当前：" in first:
        parts = [part.strip() for part in first.split("|")]
        metrics["exercise"] = parts[0].replace("当前：", "").strip() if parts else metrics["exercise"]
        for part in parts[1:]:
            if part.startswith("标准"):
                standard_part = part.split("/", 1)[0]
                metrics["valid"] = "".join(ch for ch in standard_part if ch.isdigit()) or "0"
                if "/" in part:
                    attempt_part = part.split("/", 1)[1]
                    metrics["attempts"] = "".join(ch for ch in attempt_part if ch.isdigit()) or metrics["attempts"]
            elif part.startswith("尝试"):
                metrics["attempts"] = "".join(ch for ch in part if ch.isdigit()) or "0"
            elif part.startswith("阶段"):
                metrics["stage"] = part.split(" ", 1)[-1].replace("阶段", "").replace("：", "").strip() or "准备"
            elif part.startswith("最近得分"):
                metrics["score"] = "".join(ch for ch in part if ch.isdigit()) or "100"
    return metrics


def _draw_glass(draw, box, radius, fill_alpha=112, outline_alpha=86):
    draw.rounded_rectangle(box, radius=radius, fill=(44, 45, 43, fill_alpha), outline=(242, 244, 238, outline_alpha), width=1)


def _draw_play_icon(draw, cx: int, cy: int, r: int):
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(72, 72, 80, 155), outline=(246, 246, 242, 120), width=1)
    draw.polygon([(cx - r // 3, cy - r // 2), (cx - r // 3, cy + r // 2), (cx + r // 2, cy)], fill=(250, 250, 246, 230))


def _draw_gradient_round_rect(image: Image.Image, box, radius: int, left_color, right_color):
    if Image is None:
        return
    x1, y1, x2, y2 = map(int, box)
    width = max(1, x2 - x1)
    height = max(1, y2 - y1)
    gradient = Image.new("RGBA", (width, height))
    pixels = gradient.load()
    for x in range(width):
        t = x / max(1, width - 1)
        color = tuple(int(left_color[i] * (1 - t) + right_color[i] * t) for i in range(4))
        for y in range(height):
            pixels[x, y] = color
    mask = Image.new("L", (width, height), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle((0, 0, width, height), radius=radius, fill=255)
    image.paste(gradient, (x1, y1), mask)


def _draw_ring(draw, cx: int, cy: int, radius: int, percent: int, scale: float):
    width = max(3, int(5 * scale))
    box = (cx - radius, cy - radius, cx + radius, cy + radius)
    draw.arc(box, 0, 360, fill=(230, 232, 224, 82), width=width)
    draw.arc(box, -90, -90 + int(360 * percent / 100), fill=(183, 229, 112, 245), width=width)
    pct_font = _font_scaled(22, scale)
    small_font = _font_scaled(10, scale)
    text = str(percent)
    bbox = draw.textbbox((0, 0), text, font=pct_font)
    draw.text((cx - (bbox[2] - bbox[0]) / 2 - 3, cy - (bbox[3] - bbox[1]) / 2 - 2), text, font=pct_font, fill=(250, 250, 246, 245))
    draw.text((cx + radius * 0.22, cy - 2), "%", font=small_font, fill=(250, 250, 246, 225))


def _draw_metric_bar(draw, x: int, y: int, w: int, label: str, value: int, scale: float, fill=(183, 229, 112, 235)):
    label_font = _font_scaled(13, scale)
    value_font = _font_scaled(12, scale)
    draw.text((x, y), label, font=label_font, fill=(246, 246, 240, 230))
    value_text = f"{value}%"
    bbox = draw.textbbox((0, 0), value_text, font=value_font)
    draw.text((x + w - (bbox[2] - bbox[0]), y), value_text, font=value_font, fill=(246, 246, 240, 225))
    bar_y = y + int(23 * scale)
    draw.rounded_rectangle((x, bar_y, x + w, bar_y + max(4, int(5 * scale))), radius=4, fill=(232, 232, 226, 82))
    draw.rounded_rectangle((x, bar_y, x + int(w * value / 100), bar_y + max(4, int(5 * scale))), radius=4, fill=fill)


def _draw_segment_meter(draw, x: int, y: int, count: int, active: int, color, scale: float):
    seg_w = max(8, int(13 * scale))
    gap = max(2, int(4 * scale))
    h = max(5, int(7 * scale))
    for i in range(count):
        fill = color if i < active else (230, 232, 226, 52)
        draw.rounded_rectangle((x + i * (seg_w + gap), y, x + i * (seg_w + gap) + seg_w, y + h), radius=3, fill=fill)


def _draw_reference_skeleton(frame: np.ndarray, exercise_name: str, x: int, y: int, w: int, h: int, tick: int, active=False):
    wrong, target = _mini_poses(exercise_name, [])
    pose = _blend_pose(wrong, target, _smooth_pingpong(tick)) if active else target
    pixels = _pose_to_pixels(pose, x, y, w, h)
    _draw_mini_skeleton(frame, pixels, _mini_connections(exercise_name), (238, 240, 234), max(2, int(w / 34)), max(3, int(w / 24)), alpha=0.95)


def _muscle_regions(exercise_name: str):
    if "俯卧撑" in exercise_name:
        return ["left_chest", "right_chest", "left_shoulder", "right_shoulder", "left_triceps", "right_triceps"]
    if "弯举" in exercise_name:
        return ["left_biceps", "right_biceps", "left_forearm", "right_forearm"]
    return ["left_quad", "right_quad", "left_glute", "right_glute"]


def _draw_body_muscle_figure(draw, box, exercise_name: str, scale: float):
    x1, y1, x2, y2 = map(int, box)
    w = x2 - x1
    h = y2 - y1
    cx = x1 + w * 0.47
    active = set(_muscle_regions(exercise_name))
    line = (230, 232, 226, 155)
    soft = (230, 232, 226, 68)
    orange = (255, 160, 66, 220)

    def p(px, py):
        return (x1 + px * w, y1 + py * h)

    # Body outline, intentionally spare like the reference silhouette.
    draw.ellipse((cx - w * 0.08, y1 + h * 0.02, cx + w * 0.08, y1 + h * 0.18), outline=line, width=1)
    draw.line((p(0.43, 0.18), p(0.36, 0.36), p(0.34, 0.58), p(0.40, 0.78)), fill=line, width=1)
    draw.line((p(0.51, 0.18), p(0.58, 0.36), p(0.60, 0.58), p(0.54, 0.78)), fill=line, width=1)
    draw.line((p(0.38, 0.30), p(0.22, 0.44), p(0.12, 0.63), p(0.08, 0.78)), fill=line, width=1)
    draw.line((p(0.56, 0.30), p(0.72, 0.44), p(0.82, 0.63), p(0.86, 0.78)), fill=line, width=1)
    draw.line((p(0.41, 0.78), p(0.35, 0.98)), fill=line, width=1)
    draw.line((p(0.53, 0.78), p(0.59, 0.98)), fill=line, width=1)
    draw.line((p(0.41, 0.42), p(0.53, 0.42)), fill=soft, width=1)
    draw.line((p(0.40, 0.58), p(0.54, 0.58)), fill=soft, width=1)

    regions = {
        "left_shoulder": (0.34, 0.30, 0.13, 0.09, 20),
        "right_shoulder": (0.58, 0.30, 0.13, 0.09, -20),
        "left_biceps": (0.25, 0.47, 0.10, 0.13, 18),
        "right_biceps": (0.69, 0.47, 0.10, 0.13, -18),
        "left_forearm": (0.16, 0.64, 0.08, 0.12, 18),
        "right_forearm": (0.78, 0.64, 0.08, 0.12, -18),
        "left_chest": (0.41, 0.34, 0.11, 0.10, 0),
        "right_chest": (0.53, 0.34, 0.11, 0.10, 0),
        "left_triceps": (0.25, 0.45, 0.08, 0.12, 18),
        "right_triceps": (0.69, 0.45, 0.08, 0.12, -18),
        "left_quad": (0.40, 0.78, 0.09, 0.18, 6),
        "right_quad": (0.54, 0.78, 0.09, 0.18, -6),
        "left_glute": (0.41, 0.59, 0.10, 0.10, 0),
        "right_glute": (0.53, 0.59, 0.10, 0.10, 0),
    }
    for name in active:
        if name not in regions:
            continue
        px, py, rw, rh, angle = regions[name]
        cx2, cy2 = p(px, py)
        draw.ellipse((cx2 - rw * w / 2, cy2 - rh * h / 2, cx2 + rw * w / 2, cy2 + rh * h / 2), fill=orange)


def _draw_course_overlay(
    frame: np.ndarray,
    exercise_name: str,
    errors: Sequence[str],
    title: str,
    lines,
    tick: int,
    status_lines=None,
) -> np.ndarray:
    if Image is None or ImageDraw is None:
        return frame

    height, width = frame.shape[:2]
    if width < 300 or height < 220:
        return frame

    scale = _scale_for(width)
    title_text, subtitle = _exercise_course_title(exercise_name)
    unique_errors = list(dict.fromkeys(errors))
    detail_lines = _compact_feedback_lines(lines, bool(unique_errors)) or _standard_focus_lines(exercise_name)
    metrics = _extract_status_metrics(status_lines or [])
    try:
        valid_count = int(metrics.get("valid", 0))
    except (TypeError, ValueError):
        valid_count = 0
    percent = max(0, min(100, int(round(valid_count / 5 * 100))))

    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    margin = max(10, int(18 * scale))
    top = max(8, int(16 * scale))
    bottom_h = max(40, int(50 * scale))
    radius = max(12, int(20 * scale))

    # Soft vignette like the reference app, with clear center for the body.
    draw.rectangle((0, 0, width, height), fill=(8, 8, 8, 12))
    draw.rectangle((0, 0, width, int(height * 0.16)), fill=(15, 15, 16, 24))
    draw.rectangle((0, int(height * 0.78), width, height), fill=(12, 12, 13, 30))

    # Header.
    back_r = max(13, int(20 * scale))
    back_cx = margin + back_r
    back_cy = top + back_r
    draw.ellipse((back_cx - back_r, back_cy - back_r, back_cx + back_r, back_cy + back_r), fill=(246, 246, 250, 218))
    arrow_font = _font_scaled(26, scale)
    draw.text((back_cx - int(8 * scale), back_cy - int(18 * scale)), "‹", font=arrow_font, fill=(34, 36, 58, 245))
    draw.line((back_cx + back_r + int(13 * scale), top + 7, back_cx + back_r + int(13 * scale), top + int(34 * scale)), fill=(242, 242, 238, 64), width=1)
    title_font = _font_scaled(22, scale)
    subtitle_font = _font_scaled(13, scale)
    title_x = back_cx + back_r + int(26 * scale)
    draw.text((title_x, top + int(2 * scale)), title_text, font=title_font, fill=(255, 255, 250, 255))
    info_r = max(6, int(8 * scale))
    title_bbox = draw.textbbox((title_x, top), title_text, font=title_font)
    info_x = min(width - int(145 * scale), title_bbox[2] + int(14 * scale))
    draw.ellipse((info_x, top + int(9 * scale), info_x + info_r * 2, top + int(9 * scale) + info_r * 2), outline=(246, 246, 240, 135), width=1)
    draw.text((info_x + info_r - 2, top + int(8 * scale)), "i", font=_font_scaled(12, scale), fill=(246, 246, 240, 180))
    draw.text((title_x, top + int(29 * scale)), subtitle, font=subtitle_font, fill=(255, 255, 250, 230))
    pill_w = max(78, int(108 * scale))
    pill_h = max(24, int(34 * scale))
    pill = (width - margin - pill_w, top + int(2 * scale), width - margin, top + int(2 * scale) + pill_h)
    _draw_glass(draw, pill, pill_h // 2, fill_alpha=72, outline_alpha=18)
    draw.text((pill[0] + int(20 * scale), pill[1] + int(7 * scale)), "动作要点", font=_font_scaled(11, scale), fill=(250, 250, 246, 232))
    draw.ellipse((pill[0] + int(9 * scale), pill[1] + int(10 * scale), pill[0] + int(16 * scale), pill[1] + int(17 * scale)), outline=(250, 250, 246, 220), width=2)

    # Left teaching video.
    left_w = max(105, int(width * 0.23))
    video_h = max(58, int(height * 0.18))
    video_box = (margin, int(height * 0.17), margin + left_w, int(height * 0.17) + video_h)
    _draw_glass(draw, video_box, radius, fill_alpha=64, outline_alpha=96)
    draw.text((video_box[0] + int(12 * scale), video_box[1] + int(10 * scale)), "教学视频", font=_font_scaled(14, scale), fill=(255, 255, 250, 245))
    draw.rectangle((video_box[0] + int(3 * scale), video_box[1] + int(32 * scale), video_box[2] - int(3 * scale), video_box[3] - int(3 * scale)), fill=(235, 236, 230, 28))

    # Left completion panel.
    comp_w = max(132, int(width * 0.21))
    comp_h = max(92, int(height * 0.27))
    comp_y = min(height - bottom_h - margin - comp_h, int(height * 0.47))
    comp_box = (margin + int(14 * scale), comp_y, margin + int(14 * scale) + comp_w, comp_y + comp_h)
    _draw_glass(draw, comp_box, radius, fill_alpha=82, outline_alpha=42)
    draw.text((comp_box[0] + int(14 * scale), comp_box[1] + int(14 * scale)), "动作完成度", font=_font_scaled(15, scale), fill=(255, 255, 250, 238))
    ring_r = max(20, int(29 * scale))
    _draw_ring(draw, comp_box[2] - ring_r - int(14 * scale), comp_box[1] + ring_r + int(20 * scale), ring_r, percent, scale)
    bar_x = comp_box[0] + int(14 * scale)
    bar_w = comp_w - int(34 * scale)
    bar_y = comp_box[1] + int(62 * scale)
    _draw_metric_bar(draw, bar_x, bar_y, bar_w, "动作高度", 82 if not unique_errors else 68, scale)
    _draw_metric_bar(draw, bar_x, bar_y + int(34 * scale), bar_w, "身体控制", 90 if not unique_errors else 65, scale)

    # Right AI panel.
    right_w = max(152, int(width * 0.22))
    right_h = max(210, height - bottom_h - int(height * 0.16) - margin)
    right_box = (width - margin - right_w, int(height * 0.16), width - margin, int(height * 0.16) + right_h)
    _draw_glass(draw, right_box, max(10, int(14 * scale)), fill_alpha=92, outline_alpha=42)
    rx = right_box[0] + int(14 * scale)
    ry = right_box[1] + int(14 * scale)
    draw.text((rx, ry), "AI正在观察", font=_font_scaled(14, scale), fill=(255, 255, 250, 245))
    mascot_r = max(14, int(20 * scale))
    draw.ellipse((rx, ry + int(38 * scale), rx + mascot_r * 2, ry + int(38 * scale) + mascot_r * 2), fill=(136, 112, 238, 210))
    draw.text((rx + int(8 * scale), ry + int(43 * scale)), "AI", font=_font_scaled(13, scale), fill=(250, 250, 246, 245))
    bubble_x = rx + mascot_r * 2 + int(10 * scale)
    bubble_y = ry + int(30 * scale)
    bubble_w = right_box[2] - bubble_x - int(12 * scale)
    bubble_h = max(42, int(50 * scale))
    draw.rounded_rectangle((bubble_x, bubble_y, bubble_x + bubble_w, bubble_y + bubble_h), radius=max(8, int(12 * scale)), fill=(34, 34, 34, 146))
    feedback = detail_lines[-1] if detail_lines else "动作稳定"
    draw.text((bubble_x + int(10 * scale), bubble_y + int(10 * scale)), _fit_text(draw, title, _font_scaled(13, scale), bubble_w - int(20 * scale)), font=_font_scaled(13, scale), fill=(255, 213, 78, 255))
    draw.text((bubble_x + int(10 * scale), bubble_y + int(31 * scale)), _fit_text(draw, feedback.replace("纠正：", ""), _font_scaled(12, scale), bubble_w - int(20 * scale)), font=_font_scaled(12, scale), fill=(255, 255, 250, 240))
    sep_y = bubble_y + bubble_h + int(12 * scale)
    draw.line((rx, sep_y, right_box[2] - int(14 * scale), sep_y), fill=(246, 246, 240, 48), width=1)
    draw.text((rx, sep_y + int(10 * scale)), "身体感受", font=_font_scaled(10, scale), fill=(250, 250, 246, 225))
    meter_y = sep_y + int(33 * scale)
    draw.text((rx, meter_y), "稳定程度", font=_font_scaled(10, scale), fill=(250, 250, 246, 208))
    _draw_segment_meter(draw, rx, meter_y + int(23 * scale), 8, 6 if not unique_errors else 4, (255, 185, 72, 230), scale)
    draw.text((right_box[2] - int(46 * scale), meter_y + int(15 * scale)), "中等" if unique_errors else "良好", font=_font_scaled(11, scale), fill=(250, 250, 246, 225))
    meter_y += int(36 * scale)
    draw.text((rx, meter_y), "左右对称性", font=_font_scaled(10, scale), fill=(250, 250, 246, 208))
    _draw_segment_meter(draw, rx, meter_y + int(23 * scale), 8, 7, (171, 230, 105, 235), scale)
    draw.text((right_box[2] - int(46 * scale), meter_y + int(15 * scale)), "良好", font=_font_scaled(11, scale), fill=(250, 250, 246, 225))

    muscle_title_y = meter_y + int(34 * scale)
    draw.line((rx, muscle_title_y - int(12 * scale), right_box[2] - int(14 * scale), muscle_title_y - int(12 * scale)), fill=(246, 246, 240, 38), width=1)
    draw.text((rx, muscle_title_y), "肌肉激活", font=_font_scaled(11, scale), fill=(250, 250, 246, 225))
    figure_box = (
        rx + int(4 * scale),
        muscle_title_y + int(18 * scale),
        rx + int(86 * scale),
        right_box[3] - int(10 * scale),
    )
    _draw_body_muscle_figure(draw, figure_box, exercise_name, scale)
    legend_x = right_box[2] - int(61 * scale)
    legend_y = muscle_title_y + int(24 * scale)
    legend = [("激活良好", (171, 230, 105, 235)), ("激活中等", (255, 160, 66, 230)), ("激活较弱", (155, 190, 240, 220))]
    for label, color in legend:
        draw.ellipse((legend_x, legend_y + 3, legend_x + 7, legend_y + 10), fill=color)
        draw.text((legend_x + 12, legend_y), label, font=_font_scaled(8, scale), fill=(250, 250, 246, 220))
        legend_y += int(16 * scale)

    out = _alpha_blend_rgba(frame, np.array(overlay))

    # Miniatures are drawn after panel blending to stay crisp.
    _draw_reference_skeleton(out, exercise_name, video_box[0] + int(left_w * 0.36), video_box[1] + int(video_h * 0.16), int(left_w * 0.28), int(video_h * 0.68), tick, active=True)
    pil_controls = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    play_draw = ImageDraw.Draw(pil_controls)
    _draw_play_icon(play_draw, video_box[0] + left_w // 2, video_box[1] + video_h // 2, max(13, int(20 * scale)))
    play_draw.text((video_box[0] + int(14 * scale), video_box[3] - int(24 * scale)), "00:18 / 00:45", font=_font_scaled(12, scale), fill=(250, 250, 246, 235))
    out = _alpha_blend_rgba(out, np.array(pil_controls))

    return out


def _draw_compact_correction_card(
    frame: np.ndarray,
    exercise_name: str,
    errors: Sequence[str],
    title: str,
    lines,
    tick: int,
    x: int,
    y: int,
) -> np.ndarray:
    height, width = frame.shape[:2]
    card_width = max(0, width - x * 2)
    card_height = min(96, max(76, int(height * 0.29)))
    if card_width < 240 or card_height < 72:
        return frame

    unique_errors = list(dict.fromkeys(errors))
    wrong_norm, target_norm = _mini_poses(exercise_name, unique_errors)
    animated_norm = _blend_pose(wrong_norm, target_norm, _smooth_pingpong(tick))
    out = frame.copy()
    accent = (35, 211, 238)

    if Image is not None and ImageDraw is not None:
        overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        draw.rounded_rectangle(
            (x, y, x + card_width, y + card_height),
            radius=11,
            fill=(7, 14, 18, 164),
            outline=(*accent, 202),
            width=2,
        )
        title_font = _load_font(14)
        body_font = _load_font(11)
        draw.text((x + 10, y + 8), "标准示范", font=title_font, fill=(*accent, 255))
        draw.text((x + 88, y + 8), title, font=title_font, fill=(234, 242, 244, 245))

        text_x = x + max(136, int(card_width * 0.40))
        text_y = y + 33
        detail_lines = _compact_feedback_lines(lines, bool(unique_errors)) or _standard_focus_lines(exercise_name)
        for line in detail_lines[:2]:
            wrapped_lines = _wrap_text(draw, str(line), body_font, max(90, x + card_width - text_x - 12))
            for wrapped in wrapped_lines[:1]:
                draw.ellipse((text_x, text_y + 5, text_x + 6, text_y + 11), fill=(*accent, 255))
                fill = (255, 237, 168, 255) if wrapped.startswith(("问题", "纠正", "第")) else (228, 238, 240, 245)
                draw.text((text_x + 13, text_y), wrapped, font=body_font, fill=fill)
                text_y += 19
        out = _alpha_blend_rgba(out, np.array(overlay))
    else:
        overlay = out.copy()
        cv2.rectangle(overlay, (x, y), (x + card_width, y + card_height), (7, 14, 18), -1)
        cv2.addWeighted(overlay, 0.60, out, 0.40, 0, out)
        cv2.rectangle(out, (x, y), (x + card_width, y + card_height), accent, 2, cv2.LINE_AA)

    mini_x = x + 16
    mini_y = y + 31
    mini_w = min(76, max(56, int(card_width * 0.20)))
    mini_h = card_height - 39
    correction_x = x + max(82, int(card_width * 0.24))
    correction_w = min(62, max(48, int(card_width * 0.15)))
    target = _pose_to_pixels(target_norm, mini_x, mini_y, mini_w, mini_h)
    wrong = _pose_to_pixels(wrong_norm, correction_x, mini_y, correction_w, mini_h)
    correction_target = _pose_to_pixels(target_norm, correction_x, mini_y, correction_w, mini_h)
    animated = _pose_to_pixels(animated_norm, correction_x, mini_y, correction_w, mini_h)
    connections = _mini_connections(exercise_name)
    _draw_mini_skeleton(out, target, connections, (232, 244, 246), 3, 4, alpha=0.9)
    _draw_mini_skeleton(out, wrong, connections, (94, 63, 244), 2, 3, alpha=0.28)
    _draw_mini_skeleton(out, correction_target, connections, (238, 211, 34), 2, 3, alpha=0.34)
    _draw_mini_skeleton(out, animated, connections, (232, 244, 246), 3, 4, alpha=1.0)
    _draw_mini_arrow(out, wrong, correction_target, unique_errors)
    return out


def draw_correction_card(
    frame: np.ndarray,
    exercise_name: str,
    errors: Sequence[str],
    title: str,
    lines,
    tick: int,
    x: int = 14,
    y: int = 14,
    status_lines=None,
) -> np.ndarray:
    return _draw_course_overlay(frame, exercise_name, errors, title, lines, tick, status_lines=status_lines)

    height, width = frame.shape[:2]
    card_height = min(138, max(108, int(height * 0.34)))
    left_width = min(154, max(124, int(width * 0.27)))
    right_width = min(300, max(214, width - x * 3 - left_width - 24))
    right_x = width - x - right_width
    if width < 400 or right_x < x + left_width + 12 or card_height < 100:
        return _draw_compact_correction_card(frame, exercise_name, errors, title, lines, tick, max(8, x - 4), max(8, y - 4))

    unique_errors = list(dict.fromkeys(errors))
    wrong_norm, target_norm = _mini_poses(exercise_name, unique_errors)
    progress = _smooth_pingpong(tick)
    animated_norm = _blend_pose(wrong_norm, target_norm, progress)

    out = frame.copy()

    if Image is not None and ImageDraw is not None:
        overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        accent = (35, 211, 238)
        _draw_hud_card(
            draw,
            (x, y, x + left_width, y + card_height),
            "标准示范",
            _exercise_primary_label(exercise_name),
            accent,
        )
        _draw_hud_card(
            draw,
            (right_x, y, right_x + right_width, y + card_height),
            title,
            "上一动作反馈" if unique_errors else "动作质量记录",
            accent,
        )
        body_font = _load_font(12)
        bullet_x = right_x + max(94, int(right_width * 0.36))
        bullet_y = y + 52
        detail_lines = _compact_feedback_lines(lines, bool(unique_errors)) or _standard_focus_lines(exercise_name)
        if not unique_errors:
            detail_lines = _standard_focus_lines(exercise_name)
        for line in detail_lines[:3]:
            for wrapped in _wrap_text(draw, str(line), body_font, max(90, right_x + right_width - bullet_x - 14))[:2]:
                draw.ellipse((bullet_x, bullet_y + 5, bullet_x + 6, bullet_y + 11), fill=(*accent, 255))
                fill = (255, 237, 168, 255) if wrapped.startswith(("问题", "纠正", "第")) else (232, 240, 242, 245)
                draw.text((bullet_x + 13, bullet_y), wrapped, font=body_font, fill=fill)
                bullet_y += 20
                if bullet_y > y + card_height - 18:
                    break
            if bullet_y > y + card_height - 18:
                break
        out = _alpha_blend_rgba(out, np.array(overlay))
    else:
        overlay = out.copy()
        cv2.rectangle(overlay, (x, y), (x + left_width, y + card_height), (8, 15, 20), -1)
        cv2.rectangle(overlay, (right_x, y), (right_x + right_width, y + card_height), (8, 15, 20), -1)
        cv2.addWeighted(overlay, 0.60, out, 0.40, 0, out)
        cv2.rectangle(out, (x, y), (x + left_width, y + card_height), (238, 211, 34), 2, cv2.LINE_AA)
        cv2.rectangle(out, (right_x, y), (right_x + right_width, y + card_height), (238, 211, 34), 2, cv2.LINE_AA)

    left_mini_x = x + 24
    left_mini_y = y + 50
    left_mini_w = left_width - 48
    left_mini_h = card_height - 62
    right_mini_x = right_x + 17
    right_mini_y = y + 49
    right_mini_w = min(82, max(64, int(right_width * 0.28)))
    right_mini_h = card_height - 60

    target = _pose_to_pixels(target_norm, left_mini_x, left_mini_y, left_mini_w, left_mini_h)
    wrong = _pose_to_pixels(wrong_norm, right_mini_x, right_mini_y, right_mini_w, right_mini_h)
    correction_target = _pose_to_pixels(target_norm, right_mini_x, right_mini_y, right_mini_w, right_mini_h)
    animated = _pose_to_pixels(animated_norm, right_mini_x, right_mini_y, right_mini_w, right_mini_h)
    connections = _mini_connections(exercise_name)

    _draw_mini_skeleton(out, target, connections, (232, 244, 246), 4, 6, alpha=0.95)
    _draw_mini_skeleton(out, wrong, connections, (94, 63, 244), 3, 4, alpha=0.30)
    _draw_mini_skeleton(out, correction_target, connections, (238, 211, 34), 3, 4, alpha=0.36)
    _draw_mini_skeleton(out, animated, connections, (232, 244, 246), 4, 5, alpha=1.0)
    _draw_mini_arrow(out, wrong, correction_target, unique_errors)

    return out


def _load_font(size: int):
    if ImageFont is None:
        return None
    if size in _FONT_CACHE:
        return _FONT_CACHE[size]
    for path in _font_paths():
        if Path(path).exists():
            try:
                _FONT_CACHE[size] = ImageFont.truetype(path, size=size)
                return _FONT_CACHE[size]
            except OSError:
                continue
    _FONT_CACHE[size] = ImageFont.load_default()
    return _FONT_CACHE[size]


def _font_paths():
    global _FONT_PATHS_CACHE
    if _FONT_PATHS_CACHE is not None:
        return _FONT_PATHS_CACHE

    paths = []
    seen = set()

    def add(path):
        if not path:
            return
        normalized = str(path)
        if normalized not in seen:
            seen.add(normalized)
            paths.append(normalized)

    for path in FONT_CANDIDATES:
        add(path)

    search_dirs = [
        Path("/System/Library/Fonts"),
        Path("/System/Library/Fonts/Supplemental"),
        Path("/Library/Fonts"),
        Path.home() / "Library/Fonts",
        Path("/usr/share/fonts"),
        Path("/usr/local/share/fonts"),
    ]
    preferred_keywords = (
        "pingfang",
        "heiti",
        "songti",
        "hiragino",
        "noto sans cjk",
        "notosanscjk",
        "noto sans sc",
        "notosanssc",
        "sourcehansans",
        "source han sans",
        "wqy",
        "wenquanyi",
        "yahei",
        "simhei",
        "simsun",
        "arial unicode",
    )
    for directory in search_dirs:
        if not directory.exists():
            continue
        try:
            font_files = list(directory.rglob("*.ttf")) + list(directory.rglob("*.ttc")) + list(directory.rglob("*.otf"))
        except OSError:
            continue
        for font_file in font_files:
            name = font_file.name.lower()
            if any(keyword in name for keyword in preferred_keywords):
                add(font_file)

    _FONT_PATHS_CACHE = paths
    return _FONT_PATHS_CACHE


def _wrap_text(draw, text: str, font, max_width: int):
    if not text:
        return [""]
    lines = []
    current = ""
    for char in text:
        candidate = current + char
        bbox = draw.textbbox((0, 0), candidate, font=font)
        if bbox[2] - bbox[0] <= max_width or not current:
            current = candidate
        else:
            lines.append(current)
            current = char
    if current:
        lines.append(current)
    return lines


def _draw_course_bottom_bar(frame: np.ndarray, lines, x: int, y: int, font_size: int) -> np.ndarray:
    if Image is None or ImageDraw is None:
        return frame

    height, width = frame.shape[:2]
    scale = _scale_for(width)
    metrics = _extract_status_metrics(lines)
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    margin = max(10, int(16 * scale))
    bar_h = max(42, int(58 * scale))
    bar_y = min(max(y, height - bar_h - margin), height - bar_h - 4)
    bar = (margin, bar_y, width - margin, bar_y + bar_h)
    draw.rounded_rectangle(bar, radius=max(14, int(20 * scale)), fill=(24, 24, 23, 178), outline=(255, 255, 248, 64), width=1)

    # Previous control.
    prev_w = max(78, int(120 * scale))
    prev = (bar[0] + int(18 * scale), bar_y + int(8 * scale), bar[0] + int(18 * scale) + prev_w, bar_y + bar_h - int(8 * scale))
    draw.rounded_rectangle(prev, radius=(prev[3] - prev[1]) // 2, fill=(72, 72, 70, 142))
    prev_font = _font_scaled(15, scale)
    _draw_centered_text(draw, prev, "‹  上一个", prev_font, (255, 255, 250, 245))

    progress_text = f"进度  {min(5, int(metrics.get('valid', '0') or 0))} / 5"
    progress_font = _font_scaled(16, scale)
    progress_box = (bar[0] + int(150 * scale), bar_y + int(8 * scale), bar[0] + int(300 * scale), bar_y + bar_h - int(8 * scale))
    _draw_centered_text(draw, progress_box, progress_text, progress_font, (255, 255, 250, 245))

    # Pause control.
    pause_w = max(86, int(116 * scale))
    pause = (width // 2 - pause_w // 2, bar_y + int(8 * scale), width // 2 + pause_w // 2, bar_y + bar_h - int(8 * scale))
    draw.rounded_rectangle(pause, radius=(pause[3] - pause[1]) // 2, fill=(48, 48, 46, 156))
    icon_r = max(12, int(18 * scale))
    icon_cx = pause[0] + int(28 * scale)
    icon_cy = (pause[1] + pause[3]) // 2
    draw.ellipse((icon_cx - icon_r, icon_cy - icon_r, icon_cx + icon_r, icon_cy + icon_r), outline=(250, 250, 246, 105), width=1)
    draw.rounded_rectangle((icon_cx - 5, icon_cy - 8, icon_cx - 1, icon_cy + 8), radius=2, fill=(250, 250, 246, 230))
    draw.rounded_rectangle((icon_cx + 3, icon_cy - 8, icon_cx + 7, icon_cy + 8), radius=2, fill=(250, 250, 246, 230))
    pause_font = _font_scaled(15, scale)
    pause_text_box = (pause[0] + int(42 * scale), pause[1], pause[2] - int(12 * scale), pause[3])
    _draw_centered_text(draw, pause_text_box, "暂停", pause_font, (255, 255, 250, 248))

    # Complete button.
    btn_w = max(118, int(172 * scale))
    btn = (bar[2] - btn_w - int(18 * scale), bar_y + int(8 * scale), bar[2] - int(18 * scale), bar_y + bar_h - int(8 * scale))
    _draw_gradient_round_rect(overlay, btn, (btn[3] - btn[1]) // 2, (104, 132, 255, 232), (142, 80, 232, 232))
    btn_font = _font_scaled(15, scale)
    _draw_centered_text(draw, btn, "完成本动作", btn_font, (255, 255, 250, 255))

    return _alpha_blend_rgba(frame, np.array(overlay))


def draw_text_panel(frame: np.ndarray, lines, x: int = 20, y: int = 24, font_size: int = 22) -> np.ndarray:
    return _draw_course_bottom_bar(frame, lines, x, y, font_size)

    if Image is None or ImageDraw is None:
        out = frame.copy()
        for i, line in enumerate(lines):
            yy = y + 26 + i * 30
            cv2.putText(out, str(line), (x, yy), cv2.FONT_HERSHEY_SIMPLEX, 0.72, (0, 0, 0), 5, cv2.LINE_AA)
            cv2.putText(out, str(line), (x, yy), cv2.FONT_HERSHEY_SIMPLEX, 0.72, (255, 255, 255), 2, cv2.LINE_AA)
        return out

    height, width = frame.shape[:2]
    key = (width, height, tuple(map(str, lines)), x, y, font_size)
    cached = _TEXT_PANEL_CACHE.get(key)
    if cached is not None:
        return _alpha_blend_rgba(frame, cached)

    font = _load_font(font_size)
    panel = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(panel)

    accent = (35, 211, 238)
    draw.rounded_rectangle((3, 3, width - 4, height - 4), radius=14, outline=(*accent, 150), width=2)
    padding_x = 14
    box_width = width - x * 2
    box_height = min(height - y - 8, 78)
    if box_height < 58:
        box_height = max(46, height - y - 6)
    max_text_width = max(160, box_width - padding_x * 2)
    draw.rounded_rectangle(
        (x, y, x + box_width, y + box_height),
        radius=11,
        fill=(7, 14, 18, 158),
        outline=(*accent, 190),
        width=2,
    )
    draw.line((x + 1, y + 1, x + box_width - 1, y + 1), fill=(150, 240, 246, 55), width=1)

    if lines:
        _draw_status_row(draw, str(lines[0]), x + padding_x, y + 13, accent=accent, max_x=x + box_width - padding_x)

    divider_y = y + 40
    if box_height >= 62:
        draw.line((x + 1, divider_y, x + box_width - 1, divider_y), fill=(116, 140, 148, 72), width=1)

    message = " · ".join(str(line) for line in lines[1:] if str(line).strip())
    message_font = _load_font(max(13, font_size - 1))
    wrapped = _wrap_text(draw, message, message_font, max(120, max_text_width - 26))
    text_y = divider_y + 11 if box_height >= 62 else y + 36
    if wrapped:
        draw.ellipse((x + padding_x, text_y + 3, x + padding_x + 9, text_y + 12), outline=(*accent, 255), width=2)
        for line in wrapped[:2]:
            color = (255, 237, 168, 255) if "纠正" in line or "未检测" in line else (226, 236, 238, 245)
            draw.text((x + padding_x + 22, text_y - 1), line, font=message_font, fill=color)
            text_y += font_size + 4
            if text_y > y + box_height - font_size:
                break

    cached = np.array(panel)
    if len(_TEXT_PANEL_CACHE) > 32:
        _TEXT_PANEL_CACHE.clear()
    _TEXT_PANEL_CACHE[key] = cached
    return _alpha_blend_rgba(frame, cached)


def draw_session_banner(frame: np.ndarray, session_status: str, remaining: float = 0, summary=None) -> np.ndarray:
    if session_status not in {"countdown", "active", "finished"}:
        return frame

    out = frame.copy()
    height, width = out.shape[:2]
    overlay = out.copy()

    if session_status == "countdown":
        text = str(max(1, int(math.ceil(remaining))))
        cv2.rectangle(overlay, (0, 0), (width, height), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.35, out, 0.65, 0, out)
        cv2.putText(out, text, (width // 2 - 45, height // 2 + 55), cv2.FONT_HERSHEY_SIMPLEX, 4.2, (0, 0, 0), 12, cv2.LINE_AA)
        cv2.putText(out, text, (width // 2 - 45, height // 2 + 55), cv2.FONT_HERSHEY_SIMPLEX, 4.2, (80, 245, 255), 7, cv2.LINE_AA)
        return out

    if session_status == "active":
        return frame

    points = summary.get("points", 0) if summary else 0
    grade = summary.get("grade", "N/A") if summary else "N/A"
    valid_reps = summary.get("valid_reps", 0) if summary else 0
    attempts = summary.get("attempts", 0) if summary else 0
    cv2.rectangle(overlay, (0, height // 2 - 78), (width, height // 2 + 82), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.70, out, 0.30, 0, out)
    cv2.putText(out, "FINISH", (width // 2 - 122, height // 2 - 24), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (80, 245, 255), 4, cv2.LINE_AA)
    cv2.putText(out, f"{grade}  {points} pts", (width // 2 - 128, height // 2 + 22), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 3, cv2.LINE_AA)
    cv2.putText(out, f"valid {valid_reps} / attempts {attempts}", (width // 2 - 142, height // 2 + 58), cv2.FONT_HERSHEY_SIMPLEX, 0.62, (210, 235, 240), 2, cv2.LINE_AA)
    return out
