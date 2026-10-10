"""Not-yet-implemented connectors (README §37; sequencing per 02_MVP_SCOPE) — registered so the UI and admin policy can see them.

Each one lists the credentials and OAuth scopes it needs. ``sync`` raises
``ConnectorNotConfigured`` until the real implementation and credentials are in place.
"""

from __future__ import annotations

from datetime import datetime

from .base import BaseConnector, ConnectorNotConfigured, SyncBatch


class _PendingConnector(BaseConnector):
    implemented = False
    def sync(self, since: datetime | None) -> SyncBatch:
        missing = [name for name in self.required_env if not __import__("os").environ.get(name)]
        hint = f" Missing: {', '.join(missing)}." if missing else " Credentials found; API client not implemented yet."
        raise ConnectorNotConfigured(f"{self.display_name} is not available in the prototype.{hint}")


class GmailConnector(_PendingConnector):
    kind, display_name, category, phase = "gmail", "Gmail", "communication", 1
    data_types = (("conversations", "Gmail"),)
    required_env = ("ROOK_GOOGLE_CLIENT_ID", "ROOK_GOOGLE_CLIENT_SECRET")
    scopes = ("https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.compose")


class GoogleCalendarConnector(_PendingConnector):
    kind, display_name, category, phase = "google_calendar", "Google Calendar", "meetings", 1
    data_types = (("meetings", "Calendar"),)
    required_env = ("ROOK_GOOGLE_CLIENT_ID", "ROOK_GOOGLE_CLIENT_SECRET")
    scopes = ("https://www.googleapis.com/auth/calendar.readonly",)





class SharePointConnector(_PendingConnector):
    kind, display_name, category, phase = "sharepoint", "SharePoint / OneDrive", "documents", 2
    data_types = (("documents", "Files"), ("documents", "Sites"))
    required_env = ("MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_TENANT_ID")
    scopes = ("Sites.Read.All", "Files.Read.All")


class SlackConnector(_PendingConnector):
    kind, display_name, category, phase = "slack", "Slack", "communication", 1
    data_types = (("conversations", "Messages"), ("conversations", "Channels"), ("conversations", "Threads"))
    required_env = ("ROOK_SLACK_CLIENT_ID", "ROOK_SLACK_CLIENT_SECRET")
    scopes = ("channels:history", "groups:history", "im:history", "users:read", "chat:write")


class JiraConnector(_PendingConnector):
    kind, display_name, category, phase = "jira", "Jira", "work", 2
    data_types = (("work_items", "Issues"),)
    required_env = ("ROOK_ATLASSIAN_CLIENT_ID", "ROOK_ATLASSIAN_CLIENT_SECRET")
    scopes = ("read:jira-work", "offline_access")


class ConfluenceConnector(_PendingConnector):
    kind, display_name, category, phase = "confluence", "Confluence", "documents", 2
    data_types = (("documents", "Pages"),)
    required_env = ("ROOK_ATLASSIAN_CLIENT_ID", "ROOK_ATLASSIAN_CLIENT_SECRET")
    scopes = ("read:confluence-content.all", "offline_access")


class GitHubConnector(_PendingConnector):
    kind, display_name, category, phase = "github", "GitHub", "work", 2
    data_types = (("work_items", "Issues"), ("work_items", "Pull requests"), ("conversations", "Discussions"))
    required_env = ("ROOK_GITHUB_APP_ID", "ROOK_GITHUB_PRIVATE_KEY")



class ZoomConnector(_PendingConnector):
    kind, display_name, category, phase = "zoom", "Zoom", "meetings", 3
    data_types = (("meetings", "Meetings"), ("transcripts", "Transcripts"))
    required_env = ("ROOK_ZOOM_CLIENT_ID", "ROOK_ZOOM_CLIENT_SECRET")


class SalesforceConnector(_PendingConnector):
    kind, display_name, category, phase = "salesforce", "Salesforce", "business", 3
    data_types = (("work_items", "Accounts and opportunities"),)
    required_env = ("ROOK_SALESFORCE_CLIENT_ID", "ROOK_SALESFORCE_CLIENT_SECRET")
