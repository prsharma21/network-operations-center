"""LangGraph investigation workflow with Supervisor Agent orchestration."""

from __future__ import annotations

from typing import Any

from langgraph.graph import END, START, StateGraph

from agent.nodes.alarm_correlation import alarm_correlation_node
from agent.nodes.incident_reporting import incident_reporting_node
from agent.nodes.network_diagnostics import network_diagnostics_node
from agent.nodes.root_cause_analysis import root_cause_analysis_node
from agent.nodes.supervisor import decide_next_action, supervisor_node
from agent.runtime.state import InvestigationState, initial_state
from agent.services.correlation.models import CorrelatedIncident


def _route_from_supervisor(state: InvestigationState) -> str:
    return decide_next_action(state)


def build_investigation_graph() -> Any:
    """Compile the Supervisor → specialists → Supervisor LangGraph."""
    graph: StateGraph = StateGraph(InvestigationState)

    graph.add_node("supervisor", supervisor_node)
    graph.add_node("alarm_correlation", alarm_correlation_node)
    graph.add_node("network_diagnostics", network_diagnostics_node)
    graph.add_node("root_cause_analysis", root_cause_analysis_node)
    graph.add_node("incident_reporting", incident_reporting_node)

    graph.add_edge(START, "supervisor")
    graph.add_conditional_edges(
        "supervisor",
        _route_from_supervisor,
        {
            "alarm_correlation": "alarm_correlation",
            "network_diagnostics": "network_diagnostics",
            "root_cause_analysis": "root_cause_analysis",
            "incident_reporting": "incident_reporting",
            "completed": END,
            "failed": END,
        },
    )
    # Specialists return to supervisor for the next routing decision.
    for node in (
        "alarm_correlation",
        "network_diagnostics",
        "root_cause_analysis",
        "incident_reporting",
    ):
        graph.add_edge(node, "supervisor")

    return graph.compile()


def run_investigation(
    incident: CorrelatedIncident | dict[str, Any],
    *,
    alarms: list[dict[str, Any]] | None = None,
    max_retries: int = 2,
) -> InvestigationState:
    """Synchronous entrypoint for the multi-agent investigation workflow."""
    payload = (
        incident.model_dump(mode="json")
        if isinstance(incident, CorrelatedIncident)
        else dict(incident)
    )
    state = initial_state(payload, alarms=alarms, max_retries=max_retries)
    app = build_investigation_graph()
    return app.invoke(state)  # type: ignore[return-value]
