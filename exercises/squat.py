from feedback import build_coach_message, build_live_feedback
from exercise_knowledge import get_phase, get_quality
from pose_utils import calculate_angle, line_angle_to_vertical, midpoint, visibility_ok, xy
from scoring import build_score_details, is_valid_rep, live_score_from_errors
from exercises.base import ExerciseState


class SquatAnalyzer:
    display_name = "深蹲 Squat"

    def __init__(self):
        self.state = ExerciseState(name=self.display_name)
        self.phase = get_phase(self.display_name)
        self.quality = get_quality(self.display_name)
        self.rep_min_knee_angle = 180
        self.rep_start_knee_angle = None
        self.last_up_knee_angle = None
        self.down_frames = 0
        self.cooldown_frames = 0
        self.rep_score_penalty = 0.0

    def reset(self):
        self.state.reset()
        self.rep_min_knee_angle = 180
        self.rep_start_knee_angle = None
        self.last_up_knee_angle = None
        self.down_frames = 0
        self.cooldown_frames = 0
        self.rep_score_penalty = 0.0

    def update(self, landmarks):
        keys = ["left_hip", "left_knee", "left_ankle", "right_hip", "right_knee", "right_ankle", "left_shoulder", "right_shoulder"]
        if not visibility_ok(landmarks, keys):
            self.state.last_message = "请让全身进入画面，尤其是肩、髋、膝、踝。"
            self.state.live_errors = []
            self.state.live_message = self.state.last_message
            self.state.update_live_score([], self.display_name, 100)
            return self.state

        live_errors = []
        score_gap_penalty = 0.0
        rep_finished = False
        left_knee = calculate_angle(xy(landmarks["left_hip"]), xy(landmarks["left_knee"]), xy(landmarks["left_ankle"]))
        right_knee = calculate_angle(xy(landmarks["right_hip"]), xy(landmarks["right_knee"]), xy(landmarks["right_ankle"]))
        knee_angle = min(left_knee or 180, right_knee or 180)
        enter_down_angle = self.phase.get("enter_down_knee_angle", 125)
        exit_up_angle = self.phase.get("exit_up_knee_angle", 170)
        min_phase_frames = self.phase.get("min_phase_frames", 4)
        cooldown_frames = self.phase.get("cooldown_frames", 7)
        target_min_knee = self.quality.get("target_min_knee_angle", 100)
        min_rom = self.quality.get("min_rom_degrees", 60)
        max_knee_asymmetry = self.quality.get("max_knee_asymmetry", 18)
        max_back_tilt = self.quality.get("max_back_tilt", 28)

        shoulder_mid = midpoint(xy(landmarks["left_shoulder"]), xy(landmarks["right_shoulder"]))
        hip_mid = midpoint(xy(landmarks["left_hip"]), xy(landmarks["right_hip"]))
        back_tilt = line_angle_to_vertical(shoulder_mid, hip_mid)

        knee_asymmetry = abs((left_knee or 180) - (right_knee or 180))
        if knee_asymmetry > max_knee_asymmetry:
            live_errors.append("左右不平衡")
            self._add_error("左右不平衡")
            score_gap_penalty += min(8, (knee_asymmetry - max_knee_asymmetry) * 0.25)
        if back_tilt > max_back_tilt:
            live_errors.append("背部前倾")
            self._add_error("背部前倾")
            score_gap_penalty += min(10, (back_tilt - max_back_tilt) * 0.3)

        # 简化膝盖内扣判断：膝盖比髋-踝中线更靠身体中心过多
        left_mid_x = (landmarks["left_hip"][0] + landmarks["left_ankle"][0]) / 2
        right_mid_x = (landmarks["right_hip"][0] + landmarks["right_ankle"][0]) / 2
        stance_width = max(abs(landmarks["left_ankle"][0] - landmarks["right_ankle"][0]), 1)
        knee_valgus_px = stance_width * self.quality.get("knee_valgus_ratio", 0.08)
        left_valgus_gap = landmarks["left_knee"][0] - (left_mid_x + knee_valgus_px)
        right_valgus_gap = (right_mid_x - knee_valgus_px) - landmarks["right_knee"][0]
        if left_valgus_gap > 0 or right_valgus_gap > 0:
            live_errors.append("膝盖内扣")
            self._add_error("膝盖内扣")
            score_gap_penalty += min(10, max(left_valgus_gap, right_valgus_gap) / stance_width * 55)

        if self.cooldown_frames > 0:
            self.cooldown_frames -= 1
            self._update_live_state(live_errors, score_gap_penalty)
            return self.state

        if self.state.stage in ["ready", "up"] and knee_angle >= exit_up_angle - 5:
            self.last_up_knee_angle = knee_angle if self.last_up_knee_angle is None else max(self.last_up_knee_angle, knee_angle)

        if knee_angle < enter_down_angle and self.state.stage in ["ready", "up"]:
            self.state.stage = "down"
            self.rep_min_knee_angle = knee_angle
            self.rep_start_knee_angle = self.last_up_knee_angle or knee_angle
            self.down_frames = 0
            self.rep_score_penalty = score_gap_penalty

        if self.state.stage == "down":
            self.down_frames += 1
            self.rep_min_knee_angle = min(self.rep_min_knee_angle, knee_angle)
            score_gap_penalty += min(18, max(0, self.rep_min_knee_angle - target_min_knee) * 0.3)
            self.rep_score_penalty = max(self.rep_score_penalty, score_gap_penalty)
            if self.down_frames >= min_phase_frames and knee_angle > target_min_knee and self.rep_min_knee_angle > target_min_knee:
                live_errors.append("深度不足")

        if self.state.stage == "down" and self.down_frames >= min_phase_frames and knee_angle > exit_up_angle:
            if self.rep_min_knee_angle > target_min_knee:
                self._add_error("深度不足")
            if self.rep_start_knee_angle is None or self.rep_start_knee_angle - self.rep_min_knee_angle < min_rom:
                self._add_error("动作幅度不足")
            self._finish_rep()
            rep_finished = True
            self.state.stage = "up"
            self.rep_min_knee_angle = 180
            self.rep_start_knee_angle = None
            self.last_up_knee_angle = knee_angle
            self.down_frames = 0
            self.cooldown_frames = cooldown_frames

        if self.state.stage == "ready":
            self.state.stage = "up"

        self._update_live_state(live_errors, score_gap_penalty, update_score=not rep_finished)
        return self.state

    def _update_live_state(self, live_errors, score_gap_penalty=0.0, update_score=True):
        self.state.live_errors = list(dict.fromkeys(live_errors))
        self.state.live_message = build_live_feedback(self.display_name, self.state.stage, self.state.live_errors)
        if update_score:
            self.state.update_live_score(self.state.live_errors, self.display_name, score_gap_penalty)

    def _add_error(self, error):
        if error not in self.state.current_errors:
            self.state.current_errors.append(error)

    def _finish_rep(self):
        self.state.attempts += 1
        score = live_score_from_errors(self.state.current_errors, self.display_name, self.rep_score_penalty)
        valid = is_valid_rep(self.state.current_errors, score, self.display_name)
        if valid:
            self.state.count += 1
        score_details = build_score_details(
            self.state.current_errors,
            self.display_name,
            score_override=score,
            closeness_penalty=self.rep_score_penalty,
        )
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
        self.rep_score_penalty = 0.0
