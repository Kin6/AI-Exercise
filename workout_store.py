import calendar
import json
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
HISTORY_PATH = DATA_DIR / "workout_history.json"


def load_history():
    if not HISTORY_PATH.exists():
        return []
    try:
        with HISTORY_PATH.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return []
    return data.get("sessions", [])


def save_session(record):
    DATA_DIR.mkdir(exist_ok=True)
    sessions = load_history()
    if any(item.get("id") == record.get("id") for item in sessions):
        return
    sessions.append(record)
    with HISTORY_PATH.open("w", encoding="utf-8") as f:
        json.dump({"sessions": sessions[-500:]}, f, ensure_ascii=False, indent=2)


def build_session_summary(exercise_name, history, duration_seconds, body_parts):
    attempts = len(history)
    valid_reps = sum(1 for item in history if item.get("valid"))
    invalid_attempts = max(0, attempts - valid_reps)
    scores = [item.get("score", 0) for item in history]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0
    valid_score_sum = sum(item.get("score", 0) for item in history if item.get("valid"))
    points = int(valid_score_sum + invalid_attempts * 8 + max(0, avg_score - 80) * 2)

    if attempts == 0:
        grade = "N/A"
    elif avg_score >= 92 and valid_reps >= 3:
        grade = "S"
    elif avg_score >= 85 and valid_reps >= 2:
        grade = "A"
    elif avg_score >= 75 and valid_reps >= 1:
        grade = "B"
    else:
        grade = "C"

    all_errors = [error for item in history for error in item.get("errors", [])]
    common_errors = Counter(all_errors).most_common(3)
    now = datetime.now()
    return {
        "id": f"{now.strftime('%Y%m%d%H%M%S')}-{exercise_name}",
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M"),
        "exercise": exercise_name,
        "duration_seconds": duration_seconds,
        "attempts": attempts,
        "valid_reps": valid_reps,
        "invalid_attempts": invalid_attempts,
        "avg_score": avg_score,
        "points": points,
        "grade": grade,
        "body_parts": list(body_parts),
        "common_errors": [{"name": name, "count": count} for name, count in common_errors],
    }


def summarize_by_date(sessions=None):
    sessions = sessions if sessions is not None else load_history()
    by_date = defaultdict(lambda: {"points": 0, "valid_reps": 0, "attempts": 0, "body_parts": Counter(), "sessions": 0})
    for item in sessions:
        date = item.get("date")
        if not date:
            continue
        day = by_date[date]
        day["points"] += item.get("points", 0)
        day["valid_reps"] += item.get("valid_reps", 0)
        day["attempts"] += item.get("attempts", 0)
        day["sessions"] += 1
        day["body_parts"].update(item.get("body_parts", []))
    return by_date


def body_part_totals(sessions=None):
    sessions = sessions if sessions is not None else load_history()
    totals = Counter()
    for item in sessions:
        weight = max(1, item.get("valid_reps", 0))
        for part in item.get("body_parts", []):
            totals[part] += weight
    return totals


def render_calendar_html(year, month, sessions=None):
    by_date = summarize_by_date(sessions)
    today = datetime.now().strftime("%Y-%m-%d")
    weeks = calendar.Calendar(firstweekday=0).monthdatescalendar(year, month)
    html = [
        """
<style>
.fit-cal { display:grid; grid-template-columns: repeat(7, minmax(0,1fr)); gap:6px; }
.fit-cal-head { color:#6b7280; font-size:12px; text-align:center; padding:4px 0; }
.fit-day { min-height:78px; border:1px solid #e5e7eb; border-radius:8px; padding:7px; background:#ffffff; }
.fit-day.muted { opacity:.35; background:#f9fafb; }
.fit-day.today { border-color:#06b6d4; box-shadow: inset 0 0 0 1px #06b6d4; }
.fit-date { font-size:12px; font-weight:700; color:#111827; }
.fit-points { margin-top:6px; font-size:13px; font-weight:700; color:#0f766e; }
.fit-parts { margin-top:4px; font-size:11px; color:#374151; line-height:1.25; }
</style>
<div class="fit-cal">
        """
    ]
    for day_name in ["一", "二", "三", "四", "五", "六", "日"]:
        html.append(f'<div class="fit-cal-head">周{day_name}</div>')

    for week in weeks:
        for day in week:
            date_key = day.strftime("%Y-%m-%d")
            data = by_date.get(date_key)
            cls = "fit-day"
            if day.month != month:
                cls += " muted"
            if date_key == today:
                cls += " today"
            if data:
                parts = "、".join([name for name, _ in data["body_parts"].most_common(3)])
                html.append(
                    f'<div class="{cls}"><div class="fit-date">{day.day}</div>'
                    f'<div class="fit-points">{data["points"]} 积分</div>'
                    f'<div class="fit-parts">{parts}<br>{data["valid_reps"]} 标准 / {data["attempts"]} 尝试</div></div>'
                )
            else:
                html.append(f'<div class="{cls}"><div class="fit-date">{day.day}</div></div>')
    html.append("</div>")
    return "\n".join(html)
