import math
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

FONT_CANDIDATES = [
    "C:/Windows/Fonts/msyh.ttc",
    "C:/Windows/Fonts/simhei.ttf",
    "C:/Windows/Fonts/simsun.ttc",
    "/System/Library/Fonts/PingFang.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]

_FONT_CACHE = {}
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
            mp_drawing.draw_landmarks(
                annotated,
                result.pose_landmarks,
                mp_pose.POSE_CONNECTIONS,
                landmark_drawing_spec=mp_drawing.DrawingSpec(thickness=2, circle_radius=2),
                connection_drawing_spec=mp_drawing.DrawingSpec(thickness=2),
            )
            for name, idx in LANDMARK_NAMES.items():
                lm = result.pose_landmarks.landmark[idx]
                landmarks[name] = (lm.x * w, lm.y * h, lm.visibility)

        return PoseResult(landmarks=landmarks, annotated_frame=annotated, detected=detected)


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


def draw_correction_card(
    frame: np.ndarray,
    exercise_name: str,
    errors: Sequence[str],
    title: str,
    lines,
    tick: int,
    x: int = 14,
    y: int = 14,
) -> np.ndarray:
    height, width = frame.shape[:2]
    card_width = min(width - x * 2, max(360, int(width * 0.58)))
    card_height = min(196, height - y * 2)
    if card_width < 260 or card_height < 150:
        return frame

    unique_errors = list(dict.fromkeys(errors))
    wrong_norm, target_norm = _mini_poses(exercise_name, unique_errors)
    progress = _smooth_pingpong(tick)
    animated_norm = _blend_pose(wrong_norm, target_norm, progress)

    mini_x = x + 16
    mini_y = y + 40
    mini_w = min(150, int(card_width * 0.34))
    mini_h = card_height - 58
    base_overlay = _cached_correction_card_base(
        frame.shape,
        title,
        lines,
        x,
        y,
        card_width,
        card_height,
        mini_x,
        font_size=17,
    )
    out = frame.copy()
    if base_overlay is not None:
        out = _alpha_blend_rgba(out, base_overlay)
    else:
        overlay = out.copy()
        cv2.rectangle(overlay, (x, y), (x + card_width, y + card_height), (15, 18, 22), -1)
        cv2.addWeighted(overlay, 0.78, out, 0.22, 0, out)
        cv2.rectangle(out, (x, y), (x + card_width, y + card_height), (85, 235, 245), 2, cv2.LINE_AA)

    wrong = _pose_to_pixels(wrong_norm, mini_x, mini_y, mini_w, mini_h)
    target = _pose_to_pixels(target_norm, mini_x, mini_y, mini_w, mini_h)
    animated = _pose_to_pixels(animated_norm, mini_x, mini_y, mini_w, mini_h)
    connections = _mini_connections(exercise_name)

    _draw_mini_skeleton(out, wrong, connections, (70, 95, 245), 3, 4, alpha=0.35)
    _draw_mini_skeleton(out, target, connections, (105, 245, 225), 3, 4, alpha=0.42)
    _draw_mini_skeleton(out, animated, connections, (255, 255, 255), 4, 5, alpha=1.0)
    _draw_mini_arrow(out, wrong, target, unique_errors)

    return out


def _load_font(size: int):
    if ImageFont is None:
        return None
    if size in _FONT_CACHE:
        return _FONT_CACHE[size]
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            try:
                _FONT_CACHE[size] = ImageFont.truetype(path, size=size)
                return _FONT_CACHE[size]
            except OSError:
                continue
    _FONT_CACHE[size] = ImageFont.load_default()
    return _FONT_CACHE[size]


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


def draw_text_panel(frame: np.ndarray, lines, x: int = 20, y: int = 24, font_size: int = 22) -> np.ndarray:
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

    max_text_width = max(160, width - x * 2 - 24)
    wrapped_lines = []
    for line in lines:
        wrapped_lines.extend(_wrap_text(draw, str(line), font, max_text_width))

    line_height = font_size + 8
    padding = 12
    box_width = min(width - x * 2, max_text_width + padding * 2)
    box_height = min(height - y - 8, padding * 2 + line_height * len(wrapped_lines))
    draw.rounded_rectangle(
        (x, y, x + box_width, y + box_height),
        radius=10,
        fill=(0, 0, 0, 150),
        outline=(80, 245, 255, 180),
        width=2,
    )

    text_y = y + padding
    for line in wrapped_lines:
        color = (255, 240, 130, 255) if "纠正" in line else (255, 255, 255, 255)
        if "虚影" in line:
            color = (120, 250, 255, 255)
        draw.text((x + padding, text_y), line, font=font, fill=color)
        text_y += line_height
        if text_y > y + box_height - line_height:
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
        text = f"{max(0, int(math.ceil(remaining)))}s"
        cv2.rectangle(overlay, (width - 104, 12), (width - 14, 54), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.65, out, 0.35, 0, out)
        cv2.putText(out, text, (width - 92, 42), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (80, 245, 255), 2, cv2.LINE_AA)
        return out

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
