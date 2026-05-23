import json
from functools import lru_cache
from pathlib import Path

STANDARD_PATH = Path(__file__).parent / "knowledge" / "exercise_standards.json"


@lru_cache(maxsize=1)
def load_exercise_standards():
    with STANDARD_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def get_standard(exercise_name):
    standards = load_exercise_standards()
    if exercise_name not in standards:
        raise KeyError(f"Unknown exercise standard: {exercise_name}")
    return standards[exercise_name]


def get_phase(exercise_name):
    return get_standard(exercise_name).get("phase", {})


def get_quality(exercise_name):
    return get_standard(exercise_name).get("quality", {})


def get_penalties(exercise_name):
    return get_standard(exercise_name).get("penalties", {})


def get_positive_reasons(exercise_name):
    return get_standard(exercise_name).get("positives", {})


def get_valid_score(exercise_name):
    return get_standard(exercise_name).get("valid_score", 85)


def get_critical_errors(exercise_name):
    return set(get_standard(exercise_name).get("critical_errors", []))


def get_body_parts(exercise_name):
    return list(get_standard(exercise_name).get("body_parts", []))
