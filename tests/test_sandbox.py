from app.models import SandboxCheckRequest
from app.services.sandbox import check_sandbox_code


def test_python_sandbox_accepts_valid_function() -> None:
    result = check_sandbox_code(
        SandboxCheckRequest(
            language="python",
            code="def two_sum(nums, target):\n    return []\n",
        )
    )

    assert result.syntax_valid is True
    assert result.diagnostics == []
    assert result.execution_enabled is False
    assert result.score_hint == 100


def test_python_sandbox_rejects_syntax_and_forbidden_imports() -> None:
    syntax_result = check_sandbox_code(
        SandboxCheckRequest(language="python", code="def broken(:\n    pass")
    )
    unsafe_result = check_sandbox_code(
        SandboxCheckRequest(language="python", code="import os\ndef solve():\n    return os.getcwd()")
    )

    assert syntax_result.syntax_valid is False
    assert syntax_result.diagnostics[0].rule == "python-syntax"
    assert unsafe_result.syntax_valid is False
    assert unsafe_result.diagnostics[0].rule == "sandbox-import"


def test_javascript_sandbox_reports_unbalanced_delimiter() -> None:
    result = check_sandbox_code(
        SandboxCheckRequest(language="javascript", code="function solve(input) { return input.length;")
    )

    assert result.syntax_valid is False
    assert result.diagnostics[0].rule == "js-delimiter"


def test_typescript_sandbox_warns_on_any_without_blocking() -> None:
    result = check_sandbox_code(
        SandboxCheckRequest(language="typescript", code="const solve = (input: any) => input.length;")
    )

    assert result.syntax_valid is True
    assert result.diagnostics[0].severity == "warning"
    assert result.diagnostics[0].rule == "typescript-any"
