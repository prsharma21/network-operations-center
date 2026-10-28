"""Optional AWS Secrets Manager lookup for RDS credentials.

boto3 is imported only when DATABASE_SECRET_ARN is set. Local Docker does not
need AWS credentials. Secret values are never written to logs.
"""

from __future__ import annotations

import json
from typing import Any
from urllib.parse import quote_plus


class DatabaseSecretError(RuntimeError):
    """Raised when RDS credentials cannot be loaded from Secrets Manager."""


def database_url_from_secret(secret_arn: str, region: str) -> str:
    payload = _load_secret_payload(secret_arn, region)
    username = _required(payload, "username")
    password = _required(payload, "password")
    host = payload.get("host") or payload.get("endpoint")
    if not isinstance(host, str) or not host.strip():
        raise DatabaseSecretError("Secret is missing host/endpoint")
    port = payload.get("port") or 5432
    db_name = payload.get("dbname") or payload.get("database") or "telecom_noc"
    return (
        f"postgresql+psycopg://{quote_plus(str(username))}:"
        f"{quote_plus(str(password))}@{host.strip()}:{int(port)}/{db_name}"
    )


def _load_secret_payload(secret_arn: str, region: str) -> dict[str, Any]:
    try:
        import boto3
        from botocore.exceptions import BotoCoreError, ClientError
    except ImportError as exc:
        raise DatabaseSecretError(
            "boto3 is required to load DATABASE_SECRET_ARN. "
            "Install boto3 in the deployed environment or set DATABASE_URL."
        ) from exc
    try:
        client = boto3.client("secretsmanager", region_name=region)
        response = client.get_secret_value(SecretId=secret_arn)
    except (BotoCoreError, ClientError) as exc:
        raise DatabaseSecretError("Unable to load database credentials from Secrets Manager") from exc
    raw = response.get("SecretString")
    if not raw:
        raise DatabaseSecretError("Database secret has no SecretString payload")
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise DatabaseSecretError("Database secret is not valid JSON") from exc
    if not isinstance(payload, dict):
        raise DatabaseSecretError("Database secret JSON must be an object")
    return payload


def _required(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value:
        raise DatabaseSecretError(f"Database secret is missing {key}")
    return value
