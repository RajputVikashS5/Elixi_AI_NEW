"""Local no-op Chroma telemetry client.

Prevents noisy Posthog signature mismatch logs while keeping Chroma functional.
"""

from chromadb.config import System
from chromadb.telemetry.product import ProductTelemetryClient, ProductTelemetryEvent
from overrides import override


class NullTelemetry(ProductTelemetryClient):
    """Drop all telemetry events."""

    def __init__(self, system: System):
        super().__init__(system)

    @override
    def capture(self, event: ProductTelemetryEvent) -> None:
        # Intentionally no-op.
        return
