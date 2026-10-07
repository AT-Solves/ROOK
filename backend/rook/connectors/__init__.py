from __future__ import annotations

from .base import BaseConnector, ConnectorNotConfigured, OutboundMessage, SyncBatch
from .demo import DemoConnector, ManualConnector
from .stubs import (
    ConfluenceConnector,
    GitHubConnector,
    GmailConnector,
    GoogleCalendarConnector,
    JiraConnector,
    MicrosoftCalendarConnector,
    OutlookConnector,
    SalesforceConnector,
    SharePointConnector,
    SlackConnector,
    TeamsConnector,
    ZoomConnector,
)

REGISTRY: dict[str, type[BaseConnector]] = {
    c.kind: c
    for c in (
        DemoConnector,
        ManualConnector,
        GmailConnector,
        GoogleCalendarConnector,
        OutlookConnector,
        MicrosoftCalendarConnector,
        TeamsConnector,
        SlackConnector,
        JiraConnector,
        ConfluenceConnector,
        GitHubConnector,
        SharePointConnector,
        ZoomConnector,
        SalesforceConnector,
    )
}


def get_connector_class(kind: str) -> type[BaseConnector]:
    try:
        return REGISTRY[kind]
    except KeyError as exc:
        raise KeyError(f"Unknown connector kind: {kind}") from exc


__all__ = ["REGISTRY", "BaseConnector", "ConnectorNotConfigured", "OutboundMessage", "SyncBatch", "get_connector_class"]
