# Synthetic Telecom NOC Dataset

This dataset supports the Day 2 “Generate synthetic telecom data” task in the Agentic AI Telecom NOC Copilot implementation plan.

## Contents
- `sites/sites.json`: 20 synthetic cell sites
- `alarms/alarms.json`: 100 synthetic network alarms
- `telemetry/telemetry_metrics.json`: time-series latency, throughput, utilization and dropped-call metrics
- `oss/oss_inventory.json`: mock OSS equipment inventory
- `topology/network_topology.json`: site-to-aggregation/core links
- `deployments/deployment_events.json`: simulated deployment history
- `tickets/tickets.json`: mock NOC ticket records
- `scenarios/known_incident_scenarios.json`: outage, congestion and deployment-related fault scenarios
- `ground_truth/expected_incidents.json`: expected causes and evidence alarm IDs for testing
- `dataset_manifest.json`: counts, seed, version and safety disclaimer

## Data conventions
- All records are fictional and contain `synthetic: true` where applicable.
- Timestamps are ISO 8601 and timezone-aware (UTC).
- IDs are deterministic for this generated package.
- Scenario IDs: `SCN-OUTAGE-01`, `SCN-CONGESTION-01`, `SCN-DEPLOY-01`.
- No production network actions or live customer data are included.

## Use
Keep these files under your project `data/` directory. Adapt file locations to the existing repository rather than replacing working code. These are initial JSON fixtures for local development; Day 3 in the plan adds Pydantic validation and FastAPI endpoints.
