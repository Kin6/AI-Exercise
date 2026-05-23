from exercise_knowledge import get_critical_errors, get_penalties, get_positive_reasons, get_valid_score


DEFAULT_PENALTIES = {
    "深度不足": 20,
    "膝盖内扣": 25,
    "背部前倾": 15,
    "左右不平衡": 10,
    "身体不成直线": 25,
    "下放不够": 20,
    "髋部塌陷或抬太高": 20,
    "肘部晃动": 20,
    "动作幅度不足": 20,
    "借力摆动": 15,
}

DEFAULT_VALID_REP_SCORE = 85
DEFAULT_CRITICAL_ERRORS = {"深度不足", "下放不够", "动作幅度不足"}


def _unique_errors(errors):
    return list(dict.fromkeys(errors))


def score_from_errors(errors, exercise_name=None):
    penalty = get_penalties(exercise_name) if exercise_name else DEFAULT_PENALTIES
    total = 100
    for err in _unique_errors(errors):
        total -= penalty.get(err, DEFAULT_PENALTIES.get(err, 10))
    return max(0, total)


def is_valid_rep(errors, score, exercise_name=None):
    unique_errors = set(_unique_errors(errors))
    critical_errors = get_critical_errors(exercise_name) if exercise_name else DEFAULT_CRITICAL_ERRORS
    valid_score = get_valid_score(exercise_name) if exercise_name else DEFAULT_VALID_REP_SCORE
    return score >= valid_score and not (unique_errors & critical_errors)


def build_score_details(errors, exercise_name):
    unique_errors = _unique_errors(errors)
    penalty = get_penalties(exercise_name)
    deductions = [
        {
            "reason": err,
            "points": penalty.get(err, DEFAULT_PENALTIES.get(err, 10)),
            "label": f"{err} -{penalty.get(err, DEFAULT_PENALTIES.get(err, 10))}",
        }
        for err in unique_errors
    ]
    positive_reasons = get_positive_reasons(exercise_name)
    positives = [
        reason
        for err, reason in positive_reasons.items()
        if err not in unique_errors
    ]
    score = score_from_errors(unique_errors, exercise_name)

    if deductions:
        deduction_text = "；".join(item["label"] for item in deductions)
    else:
        deduction_text = "无扣分项"

    if positives:
        positive_text = "；".join(positives)
    else:
        positive_text = "本次仍有关键动作问题，先把扣分项修正回来"

    return {
        "base": 100,
        "score": score,
        "deductions": deductions,
        "positives": positives,
        "deduction_text": deduction_text,
        "positive_text": positive_text,
    }
