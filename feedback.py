TIPS = {
    "深度不足": "继续下蹲，让大腿更接近平行地面。",
    "膝盖内扣": "膝盖向脚尖方向打开，不要向内夹。",
    "背部前倾": "挺胸收腹，把肩膀拉回到髋部上方。",
    "左右不平衡": "两侧同时发力，让左右膝盖弯曲幅度接近。",
    "身体不成直线": "收紧核心，让肩、髋、踝连成一条直线。",
    "下放不够": "身体继续下降，让肘部弯曲到接近 90 度。",
    "髋部塌陷或抬太高": "收紧腹部和臀部，把髋部放回身体直线。",
    "肘部晃动": "夹住上臂，肘部固定在身体旁边。",
    "动作幅度不足": "手腕继续靠近肩膀，再完整放回到底部。",
    "借力摆动": "放慢速度，肩膀和躯干保持稳定。",
}

ERROR_EXPLANATIONS = {
    "深度不足": "末端下蹲深度不够，髋部还没有降到标准深度。",
    "膝盖内扣": "下蹲时膝盖向身体中线夹，和脚尖方向不一致。",
    "背部前倾": "躯干过度向前倒，肩膀没有稳定在髋部上方。",
    "左右不平衡": "左右两侧弯曲幅度不一致，发力不够均匀。",
    "身体不成直线": "肩、髋、踝没有保持在一条稳定直线上。",
    "下放不够": "俯卧撑下放末端不够低，肘部弯曲没有接近 90 度。",
    "髋部塌陷或抬太高": "核心没有锁住，髋部偏离身体直线。",
    "肘部晃动": "弯举时肘部离开固定位置，动作变成甩臂。",
    "动作幅度不足": "手腕没有充分靠近肩膀，弯举顶端幅度不完整。",
    "借力摆动": "肩膀或躯干参与摆动，目标肌群控制不足。",
}


def _unique_errors(errors):
    return list(dict.fromkeys(errors))


def tips_for_errors(errors):
    return [TIPS.get(error, error) for error in _unique_errors(errors)]


def build_live_feedback(exercise_name, stage, errors):
    if errors:
        return "实时纠正：" + " ".join(tips_for_errors(errors)[:2])

    if stage in ["down", "up"]:
        return "姿态不错，保持节奏和控制。"
    return "准备开始，身体进入画面后完成一次动作。"


def build_rep_correction_text(exercise_name, last_rep):
    if not last_rep:
        return "动作纠正回放", ["完成第一次动作后，这里会回放上一 rep 的问题和修正方向。"]

    attempt = last_rep.get("attempt", last_rep.get("rep", 0))
    valid = last_rep.get("valid", True)
    score = last_rep.get("score", 100)
    errors = _unique_errors(last_rep.get("errors", []))
    if not errors:
        return "上一动作达标", [f"第 {attempt} 次尝试得分 {score}。末端幅度和身体控制都达标，已计入完成次数。"]

    first_errors = errors[:2]
    problem_text = "；".join(ERROR_EXPLANATIONS.get(error, error) for error in first_errors)
    correction_text = " ".join(tips_for_errors(first_errors))
    deduction_text = last_rep.get("deductions", "、".join(first_errors))
    count_text = "已计入完成次数" if valid else "未计入完成次数"
    return (
        "上一动作哪里不到位",
        [
            f"第 {attempt} 次尝试得分 {score}：{deduction_text}，{count_text}。",
            f"问题：{problem_text}",
            f"纠正：{correction_text}",
        ],
    )


def build_coach_message(exercise_name, count, score, errors, score_details=None, valid=True, attempt=None):
    rep_label = f"第 {count} 次" if valid else f"第 {attempt} 次尝试"
    if not errors:
        return f"{rep_label} {exercise_name} 完成得不错，评分 {score} 分。保分原因：动作幅度和身体控制都达标。"

    unique_errors = _unique_errors(errors)
    tip_text = " ".join(tips_for_errors(unique_errors))
    valid_text = "已计入完成次数" if valid else "未计入完成次数，请按纠正动画再来一次"
    if score_details:
        deduction_text = score_details.get("deduction_text", "无扣分项")
        positive_text = score_details.get("positive_text", "")
        return (
            f"{rep_label} {exercise_name} 评分 {score} 分，{valid_text}。"
            f"扣分原因：{deduction_text}。"
            f"加分/保分原因：{positive_text}。"
            f"{tip_text}"
        )

    return f"{rep_label} {exercise_name} 评分 {score} 分，{valid_text}。主要问题：{'、'.join(unique_errors)}。{tip_text}"
