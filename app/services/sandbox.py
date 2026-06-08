from __future__ import annotations

import ast
import re

from app.models import SandboxCheckRequest, SandboxDiagnostic, SandboxResult


FORBIDDEN_PYTHON_CALLS = {
    "eval",
    "exec",
    "compile",
    "open",
    "__import__",
    "input",
}

FORBIDDEN_PYTHON_MODULES = {
    "os",
    "subprocess",
    "socket",
    "shutil",
    "pathlib",
    "sys",
}


def check_sandbox_code(request: SandboxCheckRequest) -> SandboxResult:
    diagnostics = route_checker(request.language, request.code)
    syntax_valid = not any(item.severity == "error" for item in diagnostics)
    return SandboxResult(
        session_id=request.session_id,
        language=request.language,
        syntax_valid=syntax_valid,
        diagnostics=diagnostics,
        normalized_code=request.code.strip(),
        execution_enabled=False,
        score_hint=score_code_signal(request.code, diagnostics),
        summary=build_summary(request.language, diagnostics),
    )


def route_checker(language: str, code: str) -> list[SandboxDiagnostic]:
    if language == "python":
        return check_python(code)
    if language in {"javascript", "typescript"}:
        return check_javascript_like(code, language)
    return [
        SandboxDiagnostic(
            line=1,
            column=1,
            severity="error",
            message=f"Unsupported sandbox language: {language}",
            rule="language",
        )
    ]


def check_python(code: str) -> list[SandboxDiagnostic]:
    diagnostics: list[SandboxDiagnostic] = []
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return [
            SandboxDiagnostic(
                line=max(1, exc.lineno or 1),
                column=max(1, (exc.offset or 1)),
                severity="error",
                message=exc.msg,
                rule="python-syntax",
            )
        ]

    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            module_names = imported_module_names(node)
            for module_name in module_names:
                root_name = module_name.split(".")[0]
                if root_name in FORBIDDEN_PYTHON_MODULES:
                    diagnostics.append(
                        SandboxDiagnostic(
                            line=max(1, getattr(node, "lineno", 1)),
                            column=max(1, getattr(node, "col_offset", 0) + 1),
                            severity="error",
                            message=f"Importing '{root_name}' is disabled in the interview sandbox.",
                            rule="sandbox-import",
                        )
                    )

        if isinstance(node, ast.Call):
            call_name = python_call_name(node)
            if call_name in FORBIDDEN_PYTHON_CALLS:
                diagnostics.append(
                    SandboxDiagnostic(
                        line=max(1, getattr(node, "lineno", 1)),
                        column=max(1, getattr(node, "col_offset", 0) + 1),
                        severity="error",
                        message=f"Calling '{call_name}' is disabled in the interview sandbox.",
                        rule="sandbox-call",
                    )
                )

    if not has_function_or_class(tree):
        diagnostics.append(
            SandboxDiagnostic(
                line=1,
                column=1,
                severity="warning",
                message="Consider wrapping the solution in a function or class for easier review.",
                rule="structure",
            )
        )

    return diagnostics


def check_javascript_like(code: str, language: str) -> list[SandboxDiagnostic]:
    diagnostics: list[SandboxDiagnostic] = []
    diagnostics.extend(check_balanced_delimiters(code))

    blocked_patterns = {
        r"\beval\s*\(": "Calling eval is disabled in the interview sandbox.",
        r"\bFunction\s*\(": "Dynamic Function construction is disabled in the interview sandbox.",
        r"\bfetch\s*\(": "Network calls are disabled in the interview sandbox.",
        r"\brequire\s*\(\s*['\"](?:fs|child_process|net|http|https)['\"]": (
            "Node system modules are disabled in the interview sandbox."
        ),
    }
    for pattern, message in blocked_patterns.items():
        match = re.search(pattern, code)
        if match:
            line, column = line_column_for_index(code, match.start())
            diagnostics.append(
                SandboxDiagnostic(
                    line=line,
                    column=column,
                    severity="error",
                    message=message,
                    rule="sandbox-call",
                )
            )

    if language == "typescript" and ": any" in code:
        line, column = line_column_for_index(code, code.index(": any"))
        diagnostics.append(
            SandboxDiagnostic(
                line=line,
                column=column,
                severity="warning",
                message="Avoid 'any' when the problem can be typed precisely.",
                rule="typescript-any",
            )
        )

    if "function " not in code and "=>" not in code and "class " not in code:
        diagnostics.append(
            SandboxDiagnostic(
                line=1,
                column=1,
                severity="warning",
                message="Consider defining a function so the interviewer can test the solution.",
                rule="structure",
            )
        )

    return diagnostics


def check_balanced_delimiters(code: str) -> list[SandboxDiagnostic]:
    pairs = {"(": ")", "[": "]", "{": "}"}
    closing = {value: key for key, value in pairs.items()}
    stack: list[tuple[str, int]] = []
    diagnostics: list[SandboxDiagnostic] = []

    for index, char in enumerate(code):
        if char in pairs:
            stack.append((char, index))
        elif char in closing:
            if not stack or stack[-1][0] != closing[char]:
                line, column = line_column_for_index(code, index)
                diagnostics.append(
                    SandboxDiagnostic(
                        line=line,
                        column=column,
                        severity="error",
                        message=f"Unmatched closing delimiter '{char}'.",
                        rule="js-delimiter",
                    )
                )
            else:
                stack.pop()

    for char, index in stack:
        line, column = line_column_for_index(code, index)
        diagnostics.append(
            SandboxDiagnostic(
                line=line,
                column=column,
                severity="error",
                message=f"Missing closing delimiter '{pairs[char]}'.",
                rule="js-delimiter",
            )
        )

    return diagnostics


def imported_module_names(node: ast.Import | ast.ImportFrom) -> list[str]:
    if isinstance(node, ast.Import):
        return [alias.name for alias in node.names]
    return [node.module or ""]


def python_call_name(node: ast.Call) -> str | None:
    if isinstance(node.func, ast.Name):
        return node.func.id
    if isinstance(node.func, ast.Attribute):
        return node.func.attr
    return None


def has_function_or_class(tree: ast.AST) -> bool:
    return any(isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) for node in ast.walk(tree))


def line_column_for_index(code: str, index: int) -> tuple[int, int]:
    prefix = code[:index]
    line = prefix.count("\n") + 1
    last_newline = prefix.rfind("\n")
    column = index + 1 if last_newline == -1 else index - last_newline
    return line, max(1, column)


def score_code_signal(code: str, diagnostics: list[SandboxDiagnostic]) -> float:
    score = 100.0
    score -= sum(30 for item in diagnostics if item.severity == "error")
    score -= sum(8 for item in diagnostics if item.severity == "warning")
    if len(code.strip()) < 30:
        score -= 10
    return round(max(0.0, min(100.0, score)), 1)


def build_summary(language: str, diagnostics: list[SandboxDiagnostic]) -> str:
    errors = sum(1 for item in diagnostics if item.severity == "error")
    warnings = sum(1 for item in diagnostics if item.severity == "warning")
    if errors:
        return f"{language.title()} sandbox found {errors} blocking issue(s) and {warnings} warning(s)."
    if warnings:
        return f"{language.title()} syntax is valid with {warnings} review warning(s)."
    return f"{language.title()} syntax looks valid and sandbox-safe."
