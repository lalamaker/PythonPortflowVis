from __future__ import annotations

from typing import Dict, List, Union

from . import api
from .time_range import TimeRange, in_time_range, pick_evaluation_timestamp


def extract_students(shared_items: List[dict]) -> Dict[str, dict]:
    students: Dict[str, dict] = {}
    for item in shared_items:
        inviter = item.get("inviter")
        if not inviter or inviter.get("current_role") != "student":
            continue

        name = inviter["name"]
        portfolio_id = item["portfolio_id"]
        
        students.setdefault(name, {"student_id": inviter["id"], "portfolio_ids": set(), "collection_names": {}})
        students[name]["portfolio_ids"].add(portfolio_id)

        collections = item.get("collections", [])
        if collections and isinstance(collections, list):
            for coll in collections:
                import_id = coll.get("import_id")
                coll_name = coll.get("name")
                if import_id and coll_name:
                    students[name]["collection_names"][str(import_id)] = coll_name

    return students


def resolve_level(evaluation: dict):
    level_id = evaluation.get("level")
    if not level_id:
        return None

    for lvl in evaluation.get("level_set", []):
        if lvl["id"] == level_id:
            return lvl["label"]

    return None


def collect_results(
    token: str,
    student_name: str,
    student_data: dict,
    include_reviewer: bool = False,
    time_range: TimeRange = TimeRange(),
) -> Union[List[dict], str]:
    results: List[dict] = []

    seen_evals = set()

    for portfolio_id in student_data["portfolio_ids"]:
        collection_names = student_data.get("collection_names", {})

        goals = api.get_goals(token, portfolio_id)

        if goals == api.TokenExpired:
            return api.TokenExpired

        if goals in (None, api.NotFound):
            print(f"  Warning: Cannot access evaluations for {student_name} (no permission or not found)")
            continue

        if not goals:
            continue

        for goal in goals:
            goal_name = goal.get("name") or "onbekende vaardigheid"
            goal_import_id = str(goal.get("import_id")) if goal.get("import_id") else None
            
            if goal_import_id and goal_import_id in collection_names:
                collection_name_override = collection_names[goal_import_id]
            else:
                collection_name_override = goal.get("imported_template_name") or "Unknown"

            feedback_items = api.get_feedback(token, portfolio_id, goal.get("id"))
            if feedback_items == api.TokenExpired:
                return api.TokenExpired

            for item in feedback_items:
                item_type = item.get("type")
                if item_type not in ["criterion_evaluation", "sub_criterion_evaluation"]:
                    continue
                if item.get("role") == "self":
                    continue

                ts = pick_evaluation_timestamp(item)
                if not in_time_range(ts, time_range):
                    continue

                evaluation = item.get("evaluation")
                if not evaluation:
                    continue

                level = resolve_level(evaluation)
                if level is None:
                    continue
                    
                actual_goal_name = evaluation.get("sub_criterion_name", goal_name)

                result = {
                    "student_name": student_name, 
                    "goal_name": actual_goal_name, 
                    "evaluation": level,
                    "date": ts.isoformat() if ts else None,
                    "collection_name": collection_name_override,
                    "portfolio_id": goal_import_id or portfolio_id
                }
                
                # Deduplicate identical evaluations from multiple portfolio shares
                eval_key = (student_name, actual_goal_name, level, result["date"], collection_name_override)
                if eval_key in seen_evals:
                    continue
                seen_evals.add(eval_key)
                
                if include_reviewer:
                    reviewer = evaluation.get("reviewer", {})
                    result["reviewer_name"] = reviewer.get("name", "Unknown")

                results.append(result)

    return results

