"""The API's own timings of /predict and /explain, for the Dashboard: API-005.

Kept in memory in this one API process: a lock-protected list of (time, path, status, duration),
trimmed to the last 7 days. Nothing is written to the database, so the numbers RESET WHEN THE API
RESTARTS; `since` in every summary says from when they count. A table comes with monitoring
(WEB-010) if history across restarts is needed.

main.py creates one recorder at startup (app.state.metrics) and its middleware records every
/predict and /explain answer, including errors. /health and /dashboard are not counted.
"""

import math
import threading
import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

COUNTED_PATHS = ("/predict", "/explain")
KEEP_SECONDS = 7 * 24 * 60 * 60
DAYS = 7


@dataclass(frozen=True)
class Sample:
    at: float  # seconds since the epoch, from the recorder's clock
    path: str
    status: int
    duration_ms: float


def percentile(sorted_values: list[float], p: float) -> float:
    """Nearest-rank percentile of an already sorted, non-empty list."""
    rank = max(1, math.ceil(p / 100 * len(sorted_values)))
    return sorted_values[rank - 1]


class RequestMetrics:
    def __init__(self, clock: Callable[[], float] = time.time) -> None:
        # The clock is injectable so tests can move time instead of sleeping.
        self.clock = clock
        self.started_at = clock()
        self._samples: deque[Sample] = deque()
        self._lock = threading.Lock()

    def record(self, path: str, status: int, duration_ms: float) -> None:
        if path not in COUNTED_PATHS:
            return
        now = self.clock()
        with self._lock:
            self._samples.append(Sample(now, path, status, duration_ms))
            while self._samples and self._samples[0].at < now - KEEP_SECONDS:
                self._samples.popleft()

    def uptime_seconds(self) -> float:
        return self.clock() - self.started_at

    def summary(self) -> dict:
        now = self.clock()
        with self._lock:
            samples = [s for s in self._samples if s.at >= now - KEEP_SECONDS]

        today = datetime.fromtimestamp(now, UTC).date()
        dates = [today - timedelta(days=offset) for offset in range(DAYS - 1, -1, -1)]  # oldest first
        per_day = dict.fromkeys(dates, 0)
        for sample in samples:
            day = datetime.fromtimestamp(sample.at, UTC).date()
            if day in per_day:
                per_day[day] += 1

        last_minute = [s for s in samples if s.at > now - 60]
        durations = sorted(s.duration_ms for s in samples)
        latency = (
            {f"p{p}": round(percentile(durations, p), 1) for p in (50, 95, 99)} if durations else None
        )
        succeeded = sum(1 for s in samples if s.status < 400)
        return {
            "since": datetime.fromtimestamp(self.started_at, UTC),
            "days": [{"date": day, "requests": count} for day, count in per_day.items()],
            "success_rate": round(succeeded / len(samples), 4) if samples else None,
            "latency_ms": latency,
            "requests_last_minute": len(last_minute),
            "predictions_last_minute": sum(1 for s in last_minute if s.path == "/predict"),
        }
