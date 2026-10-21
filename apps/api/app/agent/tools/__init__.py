"""Tool registry. Tools call services, never the DB directly."""

from typing import Any

from app.agent.tools.add_note import AddNoteTool
from app.agent.tools.base import Tool, ToolContext, ToolResult
from app.agent.tools.create_task import CreateTaskTool
from app.agent.tools.draft_email import DraftEmailTool
from app.agent.tools.get_record import GetRecordTool
from app.agent.tools.move_deal_stage import MoveDealStageTool
from app.agent.tools.navigate import NavigateTool
from app.agent.tools.pipeline_stats import PipelineStatsTool
from app.agent.tools.search_records import SearchRecordsTool
from app.agent.tools.summarize_record import SummarizeRecordTool
from app.agent.tools.update_record import UpdateRecordTool


class ToolRegistry:
    def __init__(self, tools: list[Tool[Any]]) -> None:
        self._tools = {t.name: t for t in tools}

    def get(self, name: str) -> Tool[Any]:
        try:
            return self._tools[name]
        except KeyError as exc:
            raise KeyError(f"Unknown tool: {name}") from exc

    def __contains__(self, name: str) -> bool:
        return name in self._tools

    def names(self) -> list[str]:
        return list(self._tools)

    def schemas(self) -> list[dict[str, Any]]:
        return [t.json_schema() for t in self._tools.values()]


def default_registry() -> ToolRegistry:
    tools: list[Tool[Any]] = [
        SearchRecordsTool(),
        GetRecordTool(),
        PipelineStatsTool(),
        SummarizeRecordTool(),
        DraftEmailTool(),
        CreateTaskTool(),
        UpdateRecordTool(),
        MoveDealStageTool(),
        AddNoteTool(),
        NavigateTool(),
    ]
    return ToolRegistry(tools)


__all__ = ["Tool", "ToolContext", "ToolRegistry", "ToolResult", "default_registry"]
