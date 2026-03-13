"""Task planning endpoints."""

from fastapi import APIRouter

from models.schemas import TaskPlanRequest
from task_planner.task_decomposer import TaskDecomposer
from task_planner.workflow_builder import WorkflowBuilder
from task_planner.scheduler import Scheduler

router = APIRouter()

decomposer = TaskDecomposer()
workflow_builder = WorkflowBuilder()
scheduler = Scheduler()


@router.post("/plan")
async def plan_task(body: TaskPlanRequest):
    steps = decomposer.decompose(body.command)
    workflow = workflow_builder.build(steps)
    schedule = scheduler.parse(body.command)
    return {
        "command": body.command,
        "steps": steps,
        "workflow": workflow,
        "schedule": schedule,
    }
