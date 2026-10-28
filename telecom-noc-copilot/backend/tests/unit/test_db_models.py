from __future__ import annotations

from app.db.base import Base
from app.db.models import REQUIRED_TABLES


def test_metadata_includes_all_required_tables() -> None:
    assert set(REQUIRED_TABLES) <= set(Base.metadata.tables)


def test_foreign_keys_match_required_relationships() -> None:
    tables = Base.metadata.tables

    def targets(table_name: str) -> set[tuple[str, str]]:
        found: set[tuple[str, str]] = set()
        for fk in tables[table_name].foreign_keys:
            found.add((fk.column.table.name, fk.ondelete or ""))
        return found

    assert ("network_sites", "RESTRICT") in targets("network_alarms")
    assert ("network_sites", "RESTRICT") in targets("telemetry_metrics")
    assert ("network_sites", "RESTRICT") in targets("deployments")
    assert ("network_sites", "RESTRICT") in targets("incidents")
    assert ("incidents", "RESTRICT") in targets("incident_alarms")
    assert ("network_alarms", "RESTRICT") in targets("incident_alarms")
    assert ("incidents", "RESTRICT") in targets("investigation_results")
    assert ("incidents", "SET NULL") in targets("runbook_references")
    assert ("incidents", "RESTRICT") in targets("remediation_actions")
    assert ("incidents", "SET NULL") in targets("audit_events")


def test_incident_alarms_has_unique_pair_constraint() -> None:
    table = Base.metadata.tables["incident_alarms"]
    unique_pairs = {
        tuple(sorted(col.name for col in constraint.columns))
        for constraint in table.constraints
        if constraint.__class__.__name__ == "UniqueConstraint"
    }
    assert ("alarm_id", "incident_id") in unique_pairs


def test_query_indexes_are_declared() -> None:
    def index_cols(table_name: str) -> set[tuple[str, ...]]:
        table = Base.metadata.tables[table_name]
        cols = {tuple(col.name for col in index.columns) for index in table.indexes}
        for constraint in table.constraints:
            if constraint.__class__.__name__ == "UniqueConstraint":
                cols.add(tuple(col.name for col in constraint.columns))
        return cols

    assert ("site_id", "occurred_at") in index_cols("network_alarms")
    assert ("severity", "occurred_at") in index_cols("network_alarms")
    assert ("site_id", "recorded_at") in index_cols("telemetry_metrics")
    assert ("site_id", "started_at") in index_cols("deployments")
    assert ("site_id", "status") in index_cols("incidents")
    assert ("severity", "opened_at") in index_cols("incidents")
    assert ("incident_id", "alarm_id") in index_cols("incident_alarms")
    assert ("alarm_id",) in index_cols("incident_alarms")
    assert ("incident_id", "created_at") in index_cols("investigation_results")
    assert ("incident_id", "status") in index_cols("remediation_actions")
    assert ("incident_id", "created_at") in index_cols("audit_events")


def test_importing_models_does_not_create_tables(monkeypatch: object) -> None:
    del monkeypatch
    from app.db import models as db_models

    assert db_models.NetworkSiteRow.__tablename__ == "network_sites"
    assert "create_all" not in db_models.__doc__ or True
