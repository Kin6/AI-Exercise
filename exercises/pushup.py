import math

from feedback import build_coach_message, build_live_feedback
from exercise_knowledge import get_phase, get_quality
from pose_utils import calculate_angle, distance_point_to_line, visibility_ok, xy
from scoring import build_score_details, is_valid_rep, score_from_errors
from exercises.base import ExerciseState


class PushupAnalyzer:
    display_name = "俯卧撑 Push-up"

    def __init__(self):
        self.state = ExerciseState(name=self.display_name)
        self.phase = get_phase(self.display_name)
        self.quality = get_quality(self.display_name)
        self.rep_min_elbow_angle = 180
        self.rep_start_elbow_angle = None
        self.last_up_elbow_angle = None
        self.down_frames = 0
        self.cooldown_frames = 0

    def reset(self):
        self.state.reset()
        self.rep_min_elbow_angle = 180
        self.rep_start_elbow_angle = None
        self.last_up_elbow_angle = None
        self.down_frames = 0
        self.cooldown_frames = 0

    def update(self, landmarks):
        keys = ["left_shoulder", "left_elbow", "left_wrist", "left_hip", "left_ankle"]
        if not visibility_ok(landmarks, keys):
            self.state.last_message = "请侧身进入画面，确保肩、肘、腕、髋、踝可见。"
            self.state.live_errors = []
            self.state.live_message = self.state.last_message
            return self.state

        live_errors = []
        elbow_angle = calculate_angle(xy(landmarks["left_shoulder"]), xy(landmarks["left_elbow"]), xy(landmarks["left_wrist"])) or 180
        body_angle = calculate_angle(xy(landmarks["left_shoulder"]), xy(landmarks["left_hip"]), xy(landmarks["left_ankle"])) or 180
        hip_line_distance = distance_point_to_line(xy(landmarks["left_hip"]), xy(landmarks["left_shoulder"]), xy(landmarks["left_ankle"]))
        shoulder = xy(landmarks["left_shoulder"])
        ankle = xy(landmarks["left_ankle"])
        body_length = max(math.hypot(shoulder[0] - ankle[0], shoulder[1] - ankle[1]), 1)

        enter_down_angle = self.phase.get("enter_down_elbow_angle", 130)
        exit_up_angle = self.phase.get("exit_up_elbow_angle", 165)
        min_phase_frames = self.phase.get("min_phase_frames", 4)
        cooldown_frames = self.phase.get("cooldown_frames", 7)
        target_min_elbow = self.quality.get("target_min_elbow_angle", 90)
        min_rom = self.quality.get("min_rom_degrees", 60)
        min_body_angle = self.quality.get("min_body_angle", 165)
        max_hip_line_distance = body_length * self.quality.get("max_hip_line_ratio", 0.08)

        if body_angle < min_body_angle or hip_line_distance > max_hip_line_distance:
            live_errors.append("髋部塌陷或抬太高")
            live_errors.append("身体不成直线")
            self._add_error("髋部塌陷或抬太高")
            self._add_error("身体不成直线")

        if self.cooldown_frames > 0:
            self.cooldown_frames -= 1
            self.state.live_errors = list(dict.fromkeys(live_errors))
            self.state.live_message = build_live_feedback(self.display_name, self.state.stage, self.state.live_errors)
            return self.state

        if self.state.stage in ["ready", "up"] and elbow_angle >= exit_up_angle - 5:
            self.last_up_elbow_angle = elbow_angle if self.last_up_elbow_angle is None else max(self.last_up_elbow_angle, elbow_angle)

        if elbow_angle < enter_down_angle and self.state.stage in ["ready", "up"]:
            self.state.stage = "down"
            self.rep_min_elbow_angle = elbow_angle
            self.rep_start_elbow_angle = self.last_up_elbow_angle or elbow_angle
            self.down_frames = 0

        if self.state.stage == "down":
            self.down_frames += 1
            self.rep_min_elbow_angle = min(self.rep_min_elbow_angle, elbow_angle)
            if self.down_frames >= min_phase_frames and elbow_angle > target_min_elbow and self.rep_min_elbow_angle > target_min_elbow:
                live_errors.append("下放不够")

        if self.state.stage == "down" and self.down_frames >= min_phase_frames and elbow_angle > exit_up_angle:
            if self.rep_min_elbow_angle > target_min_elbow:
                self._add_error("下放不够")
            if self.rep_start_elbow_angle is None or self.rep_start_elbow_angle - self.rep_min_elbow_angle < min_rom:
                self._add_error("动作幅度不足")
            self._finish_rep()
            self.state.stage = "up"
            self.rep_min_elbow_angle = 180
            self.rep_start_elbow_angle = None
            self.last_up_elbow_angle = elbow_angle
            self.down_frames = 0
            self.cooldown_frames = cooldown_frames

        if self.state.stage == "ready":
            self.state.stage = "up"

        self.state.live_errors = list(dict.fromkeys(live_errors))
        self.state.live_message = build_live_feedback(self.display_name, self.state.stage, self.state.live_errors)
        return self.state

    def _add_error(self, error):
        if error not in self.state.current_errors:
            self.state.current_errors.append(error)

    def _finish_rep(self):
        self.state.attempts += 1
        score = score_from_errors(self.state.current_errors, self.display_name)
        valid = is_valid_rep(self.state.current_errors, score, self.display_name)
        if valid:
            self.state.count += 1
        score_details = build_score_details(self.state.current_errors, self.display_name)
        self.state.last_score = score
        self.state.last_score_details = score_details
        self.state.last_valid = valid
        self.state.last_message = build_coach_message(
            self.display_name,
            self.state.count,
            score,
            self.state.current_errors,
            score_details,
            valid=valid,
            attempt=self.state.attempts,
        )
        self.state.history.append(
            {
                "attempt": self.state.attempts,
                "rep": self.state.count if valid else "",
                "valid": valid,
                "score": score,
                "errors": list(self.state.current_errors),
                "deductions": score_details["deduction_text"],
                "positives": score_details["positive_text"],
            }
        )
        self.state.current_errors.clear()
