from dataclasses import dataclass, field
from typing import Dict, List, Tuple

from scoring import build_score_details, live_score_from_errors


@dataclass
class ExerciseState:
    name: str
    stage: str = "ready"
    count: int = 0
    attempts: int = 0
    current_errors: List[str] = field(default_factory=list)
    live_errors: List[str] = field(default_factory=list)
    live_message: str = "准备开始，身体进入画面后完成一次动作。"
    last_score: int = 0
    last_message: str = "开始训练，保持身体完整出现在画面中。"
    last_score_details: Dict = field(default_factory=dict)
    last_valid: bool = True
    history: List[Dict] = field(default_factory=list)

    def reset(self):
        self.stage = "ready"
        self.count = 0
        self.attempts = 0
        self.current_errors.clear()
        self.live_errors.clear()
        self.live_message = "准备开始，身体进入画面后完成一次动作。"
        self.last_score = 0
        self.last_message = "开始训练，保持身体完整出现在画面中。"
        self.last_score_details.clear()
        self.last_valid = True
        self.history.clear()

    def update_live_score(self, errors, exercise_name, closeness_penalty=0):
        unique_errors = list(dict.fromkeys(errors))
        score = live_score_from_errors(unique_errors, exercise_name, closeness_penalty)
        self.last_score = score
        self.last_score_details = build_score_details(
            unique_errors,
            exercise_name,
            score_override=score,
            closeness_penalty=closeness_penalty,
        )

    @property
    def avg_score(self):
        if not self.history:
            return 0
        return round(sum(item["score"] for item in self.history) / len(self.history), 1)
