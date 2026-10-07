"""Microsoft 365 connector (Outlook mail, calendar, Teams meeting transcripts) via Microsoft Graph — ADR-0003.

Everything Microsoft-specific lives in this package; it emits only provider-neutral normalised records.
"""

from .connector import DATA_SCOPES, Microsoft365Connector

__all__ = ["DATA_SCOPES", "Microsoft365Connector"]
