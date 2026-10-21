from pydantic import BaseModel, Field

from app.agent.tools.base import Tool, ToolContext, ToolResult


class NavigateArgs(BaseModel):
    href: str = Field(pattern=r"^/")


class NavigateTool(Tool[NavigateArgs]):
    name = "navigate"
    label = "Opening a page"
    description = "Navigate the user's screen to an in-app route."
    Args = NavigateArgs

    async def run(self, tctx: ToolContext, args: NavigateArgs) -> ToolResult:
        return ToolResult(
            ok=True,
            summary=f"Opened {args.href}",
            data={"ui_actions": [{"kind": "navigate", "href": args.href}]},
        )
