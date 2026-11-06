# Day 16–17 — Correlation Engine and LangGraph Supervisor

## Day 16 — Alarm correlation engine

**Location:** `agent/services/correlation/`

Deterministic (no LLM) pipeline:

1. Keep only `active` / `acknowledged` alarms.
2. Group by `site_id` + `region` + (`correlation_key` or component).
3. Split groups by a 6-hour time window.
4. Match known synthetic scenarios (`SCN-OUTAGE-01`, `SCN-CONGESTION-01`, `SCN-DEPLOY-01`).
5. Assign severity (worst alarm) and priority (`critical→P1`, `major→P2`, …).
6. Link evidence alarm IDs to a correlated incident.
7. Suppress duplicates via fingerprint and evidence overlap against open incidents.

Ground-truth checks use `data/ground_truth/expected_incidents.json`.

## Day 17 — LangGraph Supervisor multi-agent workflow

**Location:** `agent/runtime/`, `agent/nodes/`

```
START → supervisor
          ├─ alarm_correlation
          ├─ network_diagnostics
          ├─ root_cause_analysis   (runbook retrieval, no LLM)
          └─ incident_reporting
        specialists return → supervisor → END
```

Shared state: `InvestigationState` (`agent/runtime/state.py`).

Specialists:

| Node | Role |
|---|---|
| `alarm_correlation` | Re-validate Day 16 correlation |
| `network_diagnostics` | Site / telemetry / deployments / topology from synthetic fixtures |
| `root_cause_analysis` | Deterministic cause + runbook passages |
| `incident_reporting` | Structured report only after diagnostics + RCA |

Supervisor policy: ordered delegation, completion gates, bounded retries, explicit failed/completed ends.

## Run tests

```bash
cd agent
pip install -r requirements-dev.txt
pytest -q tests/test_correlation_engine.py tests/test_supervisor_workflow.py
```

## Example

```python
from agent.services.correlation import AlarmCorrelationEngine
from agent.runtime import run_investigation
import json
from pathlib import Path

alarms = json.loads(Path("data/alarms/alarms.json").read_text())["alarms"]
result = AlarmCorrelationEngine().correlate(alarms)
incident = next(i for i in result.incidents if i.incident_id == "INC-OUTAGE-001")
final = run_investigation(incident, alarms=[a for a in alarms if a.get("scenario_id") == "SCN-OUTAGE-01"])
print(final["report"]["candidate_cause"])
```

## Next steps

- Wire diagnostics node to live Day-15 httpx tools optionally.
- Add MCP exposure for correlation / investigate actions.
- Optional Bedrock LLM assist for RCA narrative (keep deterministic path as default).
