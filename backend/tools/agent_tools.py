"""
Tools available to interview agents via LLM tool use.

Each tool has:
  - A JSON schema (Anthropic format) used when calling the LLM
  - An executor function that runs the actual logic

Agents receive a `make_tool_executor(state)` closure so tools have
access to the live session state without needing a separate registry.
"""
from __future__ import annotations
import random
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from agents.state import InterviewState


# ── Tool schemas (Anthropic tool-use format) ──────────────────────────────────

SEARCH_QUESTION_BANK: dict = {
    "name": "search_question_bank",
    "description": (
        "Retrieve a curated, battle-tested question from the question bank for a given "
        "competency and difficulty. Prefer this over generating a fresh question when you "
        "want consistent quality. Returns a question string, or an empty string if none found."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "competency": {
                "type": "string",
                "description": (
                    "Competency area. One of: leadership, conflict_resolution, communication, "
                    "problem_solving, ownership, collaboration, adaptability, growth_mindset, execution"
                ),
            },
            "difficulty": {
                "type": "integer",
                "description": "Difficulty level 1–5 (1=entry, 2=junior, 3=mid, 4=senior, 5=staff/principal)",
            },
        },
        "required": ["competency", "difficulty"],
    },
}

GET_COMPETENCY_HISTORY: dict = {
    "name": "get_competency_history",
    "description": (
        "Query the candidate's performance history for a specific competency in this session. "
        "Returns rolling score, attempt count, and recent feedback. "
        "Use this before picking a topic to decide whether to re-probe a weakness or move on."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "competency": {
                "type": "string",
                "description": "The competency to look up (e.g. 'leadership', 'problem_solving')",
            },
        },
        "required": ["competency"],
    },
}

BAN_COMPETENCY: dict = {
    "name": "ban_competency",
    "description": (
        "Mark a competency as saturated — you have collected enough signal and the Interviewer "
        "should not ask about it again this session. Call this when you've seen 2+ questions on "
        "a topic and the score is stable (consistently high or consistently low)."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "competency": {
                "type": "string",
                "description": "The competency to ban from future questions.",
            },
            "reason": {
                "type": "string",
                "description": "Why this competency is saturated (e.g. 'Consistent 4.5 score — strong signal, no need to probe further').",
            },
        },
        "required": ["competency", "reason"],
    },
}

SET_DIRECTIVE: dict = {
    "name": "set_directive",
    "description": (
        "Add an explicit instruction that the Interviewer MUST follow when choosing the next question. "
        "Use this to steer the interview: change topic, adjust framing, increase pressure, "
        "or request a specific type of answer. The instruction is consumed after one turn."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "directive": {
                "type": "string",
                "description": (
                    "A clear, specific instruction. Examples: "
                    "'Push harder on technical specifics — candidate is giving vague high-level answers', "
                    "'Move to collaboration next, leadership is sufficiently covered', "
                    "'Ask for a concrete metric or outcome in the next answer'."
                ),
            },
        },
        "required": ["directive"],
    },
}

FLAG_FOR_HUMAN_REVIEW: dict = {
    "name": "flag_for_human_review",
    "description": (
        "Escalate this session for human review. Call this when you detect wildly inconsistent "
        "answers, indicators of confusion or distress, potential policy violations, or any "
        "situation you cannot properly assess. The session continues but is marked for review."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "reason": {
                "type": "string",
                "description": "Clear explanation of why this session needs human review.",
            },
            "severity": {
                "type": "string",
                "enum": ["low", "medium", "high"],
                "description": "Urgency: low=review within a week, medium=within 24h, high=immediately.",
            },
        },
        "required": ["reason", "severity"],
    },
}

# Grouped by which agent uses them
INTERVIEWER_TOOLS = [SEARCH_QUESTION_BANK, GET_COMPETENCY_HISTORY]
COACH_TOOLS = [BAN_COMPETENCY, SET_DIRECTIVE, FLAG_FOR_HUMAN_REVIEW]


# ── Question bank ─────────────────────────────────────────────────────────────

_QUESTION_BANK: dict[str, dict[int, list[str]]] = {
    "leadership": {
        1: [
            "Tell me about a time you took initiative on a task without being asked.",
            "Describe a situation where you helped a teammate who was struggling.",
            "Give me an example of when you stepped up to lead a small effort.",
        ],
        2: [
            "Tell me about a time you had to influence teammates without formal authority.",
            "Describe a project where you set direction for the team even though you weren't the manager.",
            "Give an example of when you identified a problem no one else had noticed and drove the fix.",
        ],
        3: [
            "Tell me about a time you led a team through a high-stakes, ambiguous project.",
            "Describe a situation where you had to make a difficult call with incomplete information under time pressure.",
            "Tell me about a time you had to hold a teammate accountable for underperformance.",
        ],
        4: [
            "Describe a time you had to build alignment across multiple teams with conflicting priorities.",
            "Tell me about a situation where you had to make an unpopular technical or organizational decision and defend it.",
            "Give an example of how you scaled your leadership impact beyond your immediate team.",
        ],
        5: [
            "Tell me about a time you reshaped an engineering organization's culture or working model.",
            "Describe a situation where you had to lead through a major company crisis or restructuring.",
            "How have you built and developed other senior leaders or principals around you?",
        ],
    },
    "conflict_resolution": {
        1: [
            "Tell me about a time you disagreed with a teammate. How did you handle it?",
            "Describe a situation where you had to give difficult feedback to a peer.",
            "Give an example of a time a conflict arose on a project and how you responded.",
        ],
        2: [
            "Tell me about a time you had a significant disagreement with your manager. What happened?",
            "Describe a situation where two teammates were in conflict and you had to help resolve it.",
            "Give an example of a time you pushed back on a decision you thought was wrong.",
        ],
        3: [
            "Tell me about a time you navigated a conflict between two teams with competing priorities.",
            "Describe a situation where you had to change someone's strongly held technical opinion.",
            "Give an example of a time you were in a protracted disagreement and how you ultimately resolved it.",
        ],
        4: [
            "Describe a time you had to manage a conflict that was affecting team morale and delivery.",
            "Tell me about a situation where you had to de-escalate tension between senior stakeholders.",
            "Give an example of a time you had to fire or remove someone from a project and how you handled the conflict.",
        ],
        5: [
            "Tell me about a time you had to mediate an org-wide conflict that was impacting multiple teams.",
            "Describe a situation where you had to confront a peer leader about systemic issues affecting your team.",
            "How have you built processes or norms that prevented conflict before it arose?",
        ],
    },
    "communication": {
        1: [
            "Tell me about a time you had to explain a technical concept to a non-technical person.",
            "Describe a situation where you gave a presentation or demo. How did it go?",
            "Give an example of a time your communication improved a team outcome.",
        ],
        2: [
            "Tell me about a time you had to communicate bad news to a stakeholder.",
            "Describe a situation where a miscommunication caused a problem and how you fixed it.",
            "Give an example of written communication (doc, RFC, email) you're particularly proud of.",
        ],
        3: [
            "Tell me about a time you had to align multiple stakeholders with conflicting views through communication alone.",
            "Describe a situation where you used data or storytelling to change an executive's mind.",
            "Give an example of a time you created clarity in a chaotic or ambiguous situation.",
        ],
        4: [
            "Describe how you communicate technical strategy to non-technical executives.",
            "Tell me about a time your communication style had to adapt to a very different audience and culture.",
            "Give an example of a time you represented your org publicly (conference, blog, all-hands).",
        ],
        5: [
            "How have you shaped the communication norms or culture of an engineering organization?",
            "Tell me about a time you used communication to drive a company-wide change.",
            "Describe how you maintain information flow and transparency at scale across hundreds of engineers.",
        ],
    },
    "problem_solving": {
        1: [
            "Walk me through how you debug a bug you've never seen before.",
            "Tell me about a time you found a creative solution to a technical problem.",
            "Describe a time you had to solve a problem with limited resources.",
        ],
        2: [
            "Tell me about a complex bug you tracked down. What was your process?",
            "Describe a time when your first solution didn't work and you had to pivot.",
            "Give an example of a time you broke down a vague problem into something tractable.",
        ],
        3: [
            "Tell me about the hardest technical problem you've ever solved. Walk me through your reasoning.",
            "Describe a time you had to balance multiple competing constraints (time, quality, cost) to find a solution.",
            "Give an example of a time you anticipated a problem before it occurred and prevented it.",
        ],
        4: [
            "Tell me about a time you solved a problem that your team had been stuck on for a long time.",
            "Describe a situation where you had to think across systems and teams to find the root cause.",
            "Give an example of a time you introduced a new methodology or framework that improved how the team solves problems.",
        ],
        5: [
            "Tell me about a time you identified and solved a fundamental architectural flaw in a production system.",
            "Describe the most complex system-level problem you've encountered. How did you approach it?",
            "How do you approach problems where there is no established playbook?",
        ],
    },
    "ownership": {
        1: [
            "Tell me about a time you went beyond your job description to ensure something shipped.",
            "Describe a situation where you took responsibility for a mistake.",
            "Give an example of a time you followed through on a commitment even when it was hard.",
        ],
        2: [
            "Tell me about a project you owned end-to-end. What did that look like?",
            "Describe a time you inherited a messy or broken system and what you did with it.",
            "Give an example of a time you had to fight to get resources or prioritization for something you owned.",
        ],
        3: [
            "Tell me about a time you took ownership of something outside your team's scope because it needed to be done.",
            "Describe a situation where you were accountable for a major failure. What did you do?",
            "Give an example of a time you drove something to completion despite significant organizational friction.",
        ],
        4: [
            "Describe a time you owned a multi-year technical investment with uncertain ROI.",
            "Tell me about a time you had to protect your team's commitments when the org was pulling you in other directions.",
            "Give an example of a time you took on a high-risk initiative and how you managed the accountability.",
        ],
        5: [
            "Tell me about a bet you made on a technology or architecture that others were skeptical of.",
            "Describe how you set up accountability structures that outlast your direct involvement.",
            "How have you built a culture of ownership within an engineering organization?",
        ],
    },
    "collaboration": {
        1: [
            "Tell me about a time you worked closely with someone very different from you.",
            "Describe a successful team project. What was your role?",
            "Give an example of a time you helped a teammate succeed.",
        ],
        2: [
            "Tell me about a time you collaborated with a cross-functional team (design, PM, data).",
            "Describe a situation where collaboration was difficult and what you did to improve it.",
            "Give an example of a time you gave up credit for work to strengthen a relationship.",
        ],
        3: [
            "Tell me about a time you built a strong working relationship with a difficult stakeholder.",
            "Describe a project that required deep collaboration across multiple teams. What were the challenges?",
            "Give an example of a time you created shared ownership of a complex system across teams.",
        ],
        4: [
            "Describe how you partner with product and design leadership to set technical direction.",
            "Tell me about a time you had to merge two teams or codebases. What collaboration challenges arose?",
            "Give an example of building a collaborative relationship with another org that was historically adversarial.",
        ],
        5: [
            "How have you built cross-company partnerships or open-source collaborations?",
            "Describe how you create a culture of collaboration at scale across an engineering organization.",
            "Tell me about a time you united multiple organizations around a shared technical standard.",
        ],
    },
    "adaptability": {
        1: [
            "Tell me about a time you had to learn a new technology quickly.",
            "Describe a situation where your priorities changed suddenly and how you adjusted.",
            "Give an example of a time you had to change your approach mid-project.",
        ],
        2: [
            "Tell me about a time you joined a new team or company and had to ramp up fast.",
            "Describe a situation where a major assumption turned out to be wrong. What did you do?",
            "Give an example of a time you had to deliver in a context very different from your background.",
        ],
        3: [
            "Tell me about a time you had to pivot a team or project in response to new information.",
            "Describe a situation where organizational change significantly impacted your team's plans.",
            "Give an example of a time you had to abandon significant work and start fresh.",
        ],
        4: [
            "Describe how you've led a team through a major technology migration or platform shift.",
            "Tell me about a time the business strategy changed and you had to rapidly realign your technical roadmap.",
            "Give an example of leading through uncertainty where the path forward was genuinely unclear.",
        ],
        5: [
            "How have you adapted your leadership style as a company scaled from startup to enterprise?",
            "Describe how you navigate industry-level disruptions (new paradigms, competition, regulation).",
            "Tell me about a time you led a fundamental business model change from the engineering side.",
        ],
    },
    "growth_mindset": {
        1: [
            "Tell me about a time you received critical feedback and what you did with it.",
            "Describe something technical you taught yourself recently and why.",
            "Give an example of a mistake you made and what you learned from it.",
        ],
        2: [
            "Tell me about a time you sought out feedback proactively.",
            "Describe a skill gap you identified in yourself and how you addressed it.",
            "Give an example of a project where you deliberately pushed yourself outside your comfort zone.",
        ],
        3: [
            "Tell me about a time you changed your mind on a deeply held technical belief.",
            "Describe how you approach learning in a domain that moves as fast as software engineering.",
            "Give an example of a time you used failure as a catalyst for significant improvement.",
        ],
        4: [
            "How do you create a culture of learning and growth within your team?",
            "Tell me about a time you helped someone on your team overcome a significant growth barrier.",
            "Describe how you stay technically sharp while spending more time on leadership.",
        ],
        5: [
            "How do you build organizational systems that make teams better over time?",
            "Tell me about a time you introduced new ideas or methodologies from outside the company.",
            "Describe how you think about the long-term development of technical talent at scale.",
        ],
    },
    "execution": {
        1: [
            "Tell me about a project you delivered on time. How did you manage your work?",
            "Describe a time you had to prioritize competing tasks. How did you decide?",
            "Give an example of a time you delivered something under a tight deadline.",
        ],
        2: [
            "Tell me about a time you had to manage scope creep on a project.",
            "Describe how you track and communicate progress when things aren't going to plan.",
            "Give an example of a project where you broke a large effort into milestones effectively.",
        ],
        3: [
            "Tell me about a time you delivered a complex, multi-team project on time and on scope.",
            "Describe how you balance technical quality against delivery speed.",
            "Give an example of a time you used metrics or data to improve your team's execution.",
        ],
        4: [
            "Describe how you set up processes that let a large team execute autonomously without bottlenecks.",
            "Tell me about a time you significantly improved your team's delivery velocity.",
            "Give an example of a time you had to rescue a project that was seriously off-track.",
        ],
        5: [
            "How have you built engineering organizations that consistently deliver ambitious goals?",
            "Describe a time you transformed the execution culture of an engineering org.",
            "Tell me about the largest, most complex delivery initiative you've owned.",
        ],
    },
}

# Derived after _QUESTION_BANK is fully defined
ALL_COMPETENCIES = list(_QUESTION_BANK.keys())
DEFAULT_QUESTION_BUDGET = 2  # questions per competency before auto-ban

# Aliases so the LLM can use natural variants
_COMPETENCY_ALIASES: dict[str, str] = {
    "conflict": "conflict_resolution",
    "conflict resolution": "conflict_resolution",
    "communication skills": "communication",
    "problem solving": "problem_solving",
    "problem-solving": "problem_solving",
    "growth": "growth_mindset",
    "learning": "growth_mindset",
    "ownership/accountability": "ownership",
    "accountability": "ownership",
    "teamwork": "collaboration",
    "delivery": "execution",
    "adapt": "adaptability",
    "lead": "leadership",
}


def _normalize_competency(raw: str) -> str:
    key = raw.lower().strip().replace("-", "_").replace(" ", "_")
    return _COMPETENCY_ALIASES.get(key, key)


def search_question_bank(competency: str, difficulty: int) -> str:
    key = _normalize_competency(competency)
    bank = _QUESTION_BANK.get(key, {})
    level = max(1, min(5, difficulty))
    questions = bank.get(level, [])
    if not questions:
        return ""
    return random.choice(questions)


def get_competency_history(state: "InterviewState", competency: str) -> str:
    key = _normalize_competency(competency)
    scores = state.get("competency_scores", {})

    # Exact match first, then partial
    score_entry = scores.get(key) or next(
        (v for k, v in scores.items() if key in k or k in key), None
    )

    msgs = state.get("messages", [])
    relevant = [
        m for m in msgs
        if m.get("role") == "user" and _normalize_competency(m.get("competency", "")) == key
    ]

    if score_entry is None and not relevant:
        return f"No history yet for competency '{competency}' in this session."

    lines = [f"Competency: {competency}"]
    if score_entry is not None:
        lines.append(f"Rolling score: {score_entry:.1f}/5")
    lines.append(f"Questions asked on this topic: {len(relevant)}")

    recent_feedback = [m.get("feedback", "") for m in relevant[-2:] if m.get("feedback")]
    if recent_feedback:
        lines.append("Recent feedback: " + " | ".join(recent_feedback))

    return "\n".join(lines)


def flag_for_human_review(state: "InterviewState", reason: str, severity: str) -> str:
    state["human_review_flag"] = {
        "reason": reason,
        "severity": severity,
        "turn": state.get("turn_count", 0),
    }
    return f"Session flagged for human review (severity={severity}). Reason logged. Continue the interview normally."


def ban_competency(state: "InterviewState", competency: str, reason: str) -> str:
    key = _normalize_competency(competency)
    banned = list(state.get("banned_competencies", []))
    if key not in banned:
        banned.append(key)
        state["banned_competencies"] = banned
    # Zero out budget so auto-ban logic stays consistent
    budget = dict(state.get("question_budget", {}))
    budget[key] = 0
    state["question_budget"] = budget
    return f"Competency '{key}' banned for this session. Reason: {reason}"


def set_directive(state: "InterviewState", directive: str) -> str:
    directives = list(state.get("coach_directives", []))
    directives.append(directive)
    state["coach_directives"] = directives
    return f"Directive added: {directive}"


def decrement_budget(state: "InterviewState", competency: str) -> bool:
    """
    Decrement question budget for a competency. Returns True if the competency
    was auto-banned (budget hit 0). Called by coach_node in Python, not via LLM tool.
    """
    key = _normalize_competency(competency)
    budget = dict(state.get("question_budget", {}))
    remaining = budget.get(key, DEFAULT_QUESTION_BUDGET)
    remaining = max(0, remaining - 1)
    budget[key] = remaining
    state["question_budget"] = budget

    if remaining == 0:
        banned = list(state.get("banned_competencies", []))
        if key not in banned:
            banned.append(key)
            state["banned_competencies"] = banned
        return True
    return False


# ── Executor factory ──────────────────────────────────────────────────────────

def make_tool_executor(state: "InterviewState"):
    """Return an async callable that executes tool calls with access to current state."""
    async def executor(tool_name: str, tool_input: dict) -> str:
        if tool_name == "search_question_bank":
            return search_question_bank(tool_input["competency"], tool_input["difficulty"])
        if tool_name == "get_competency_history":
            return get_competency_history(state, tool_input["competency"])
        if tool_name == "flag_for_human_review":
            return flag_for_human_review(state, tool_input["reason"], tool_input["severity"])
        if tool_name == "ban_competency":
            return ban_competency(state, tool_input["competency"], tool_input["reason"])
        if tool_name == "set_directive":
            return set_directive(state, tool_input["directive"])
        return f"Unknown tool: {tool_name}"

    return executor
