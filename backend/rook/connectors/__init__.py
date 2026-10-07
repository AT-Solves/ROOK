from __future__ import annotations

from .base import BaseConnector, ConnectorAuthError, ConnectorContext, ConnectorNotConfigured, OutboundMessage, SyncBatch
from .demo import DemoConnector, ManualConnector
from .microsoft import Microsoft365Connector
from .stubs import (
    ConfluenceConnector,
    GitHubConnector,
    GmailConnector,
    GoogleCalendarConnector,
    JiraConnector,
    SalesforceConnector,
    SharePointConnector,
    SlackConnector,
    ZoomConnector,
)

REGISTRY: dict[str, type[BaseConnector]] = {
    c.kind: c
    for c in (
        DemoConnector,
        ManualConnector,
        Microsoft365Connector,
        GmailConnector,
        GoogleCalendarConnector,
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


__all__ = ["REGISTRY", "BaseConnector", "ConnectorAuthError", "ConnectorContext", "ConnectorNotConfigured",
           "OutboundMessage", "SyncBatch", "get_connector_class"]
