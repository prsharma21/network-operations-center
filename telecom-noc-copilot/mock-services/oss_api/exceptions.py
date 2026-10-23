"""OSS lookup errors. The HTTP layer maps these to status codes."""


class SiteNotFound(LookupError):
    def __init__(self, site_id: str) -> None:
        self.site_id = site_id
        super().__init__(f"Site {site_id} was not found")


class InvalidStoredSite(ValueError):
    def __init__(self, site_id: str, reason: str) -> None:
        self.site_id = site_id
        super().__init__(f"Stored site record {site_id} is invalid: {reason}")


class DuplicateAlarm(ValueError):
    def __init__(self, alarm_id: str) -> None:
        self.alarm_id = alarm_id
        super().__init__(f"Alarm {alarm_id} already exists")


class DuplicateMetric(ValueError):
    def __init__(self, metric_id: str) -> None:
        self.metric_id = metric_id
        super().__init__(f"Metric {metric_id} already exists")


class InvalidTimeRange(ValueError):
    def __init__(self) -> None:
        super().__init__("start_time must be less than or equal to end_time")
