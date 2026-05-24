import math

from feedback import build_coach_message, build_live_feedback
from exercise_knowledge import get_phase, get_quality
from pose_utils import calculate_angle, visibility_ok, xy
from scoring import build_score_details, is_valid_rep, score_from_errors
from exercises.base import ExerciseState


class BicepCurlAnalyzer:
    display_name = "弯举 Bicep Curl"

    def __init__(self):
        self.state = ExerciseState(name=self.display_name)
        self.phase = get_phase(self.display_name)
        self.quality = get_quality(self.display_name)
        self.last_elbow_x = None
        self.last_shoulder_x = None
        self.rep_min_elbow_angle = 180
        self.rep_start_elbow_angle = None
        self.last_down_elbow_angle = None
        self.rep_elbow_anchor = None
        self.rep_shoulder_anchor = None
        self.up_frames = 0
        self.cooldown_frames = 0

    def reset(self):
        self.state.reset()
        self.last_elbow_x = None
        self.last_shoulder_x = None
        self.rep_min_elbow_angle = 180
        self.rep_start_elbow_angle = None
        self.last_down_elbow_angle = None
        self.rep_elbow_anchor = None
        self.rep_shoulder_anchor = None
        self.up_frames = 0
        self.cooldown_frames = 0

    def update(self, landmarks):
        keys = ["left_shoulder", "left_elbow", "left_wrist"]
        if not visibility_ok(landmarks, keys):
            self.state.last_message = "请让训练手臂完整进入画面，确保肩、肘、腕可见。"
            self.state.live_errors = []
            self.state.live_message = self.state.last_message
            return self.state

        live_errors = []
        elbow_angle = calculate_angle(xy(landmarks["left_shoulder"]), xy(landmarks["left_elbow"]), xy(landmarks["left_wrist"])) or 180
        elbow_x = landmarks["left_elbow"][0]
        shoulder_x = landmarks["left_shoulder"][0]
        shoulder = xy(landmarks["left_shoulder"])
        elbow = xy(landmarks["left_elbow"])
        upper_arm_len = max(math.hypot(shoulder[0] - elbow[0], shoulder[1] - elbow[1]), 1)

        enter_up_angle = self.phase.get("enter_up_elbow_angle", 80)
        exit_down_angle = self.phase.get("exit_down_elbow_angle", 160)
        min_phase_frames = self.phase.get("min_phase_frames", 4)
        cooldown_frames = self.phase.get("cooldown_frames", 7)
        target_min_elbow = self.quality.get("target_min_elbow_angle", 55)
        min_rom = self.quality.get("min_rom_degrees", 85)
        max_elbow_drift = upper_arm_len * self.quality.get("max_elbow_drift_ratio", 0.18)
        max_shoulder_drift = upper_arm_len * self.quality.get("max_shoulder_drift_ratio", 0.14)

        if self.last_elbow_x is not None and abs(elbow_x - self.last_elbow_x) > 65:
            live_errors.append("肘部晃动")
            self._add_error("肘部晃动")
        if self.last_shoulder_x is not None and abs(shoulder_x - self.last_shoulder_x) > 55:
            live_errors.append("借力摆动")
            self._add_error("借力摆动")

        self.last_elbow_x = elbow_x
        self.last_shoulder_x = shoulder_x

        if self.cooldown_frames > 0:
            self.cooldown_frames -= 1
            self.state.live_errors = list(dict.fromkeys(live_errors))
            self.state.live_message = build_live_feedback(self.display_name, self.state.stage, self.state.live_errors)
            return self.state

        if self.state.stage in ["ready", "down"] and elbow_angle >= exit_down_angle - 5:
            self.last_down_elbow_angle = elbow_angle if self.last_down_elbow_angle is None else max(self.last_down_elbow_angle, elbow_angle)

        if elbow_angle < enter_up_angle and self.state.stage in ["ready", "down"]:
            self.state.stage = "up"
            self.rep_min_elbow_angle = elbow_angle
            self.rep_start_elbow_angle = self.last_down_elbow_angle or elbow_angle
            self.rep_elbow_anchor = elbow
            self.rep_shoulder_anchor = shoulder
            self.up_frames = 0

        if self.state.stage == "up":
            self.up_frames += 1
            self.rep_min_elbow_angle = min(self.rep_min_elbow_angle, elbow_angle)
            if self.up_frames >= min_phase_frames and elbow_angle > target_min_elbow and self.rep_min_elbow_angle > target_min_elbow:
                live_errors.append("动作幅度不足")
            if self.rep_elbow_anchor and math.hypot(elbow[0] - self.rep_elbow_anchor[0], elbow[1] - self.rep_elbow_anchor[1]) > max_elbow_drift:
                live_errors.append("肘部晃动")
                self._add_error("肘部晃动")
            if self.rep_shoulder_anchor and math.hypot(shoulder[0] - self.rep_shoulder_anchor[0], shoulder[1] - self.rep_shoulder_anchor[1]) > max_shoulder_drift:
                live_errors.append("借力摆动")
                self._add_error("借力摆动")

        if self.state.stage == "up" and self.up_frames >= min_phase_frames and elbow_angle > exit_down_angle:
            if self.rep_min_elbow_angle > target_min_elbow:
                self._add_error("动作幅度不足")
            if self.rep_start_elbow_angle is None or self.rep_start_elbow_angle - self.rep_min_elbow_angle < min_rom:
                self._add_error("动作幅度不足")
            self._finish_rep()
            self.state.stage = "down"
            self.rep_min_elbow_angle = 180
            self.rep_start_elbow_angle = None
            self.last_down_elbow_angle = elbow_angle
            self.rep_elbow_anchor = None
            self.rep_shoulder_anchor = None
            self.up_frames = 0
            self.cooldown_frames = cooldown_frames

        if self.state.stage == "ready":
            self.state.stage = "down"

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
