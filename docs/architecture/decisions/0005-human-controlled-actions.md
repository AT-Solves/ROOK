# ADR-0005 — Human-controlled external actions in the MVP

- **Status:** accepted (implements the C-001 resolution)
- **Decision:** ROOK may observe, recommend and prepare (draft) without approval. External communication (`send_email`, `send_message`) can only be executed after explicit approval by the **requesting user**. The policy value `auto` is rejected for these kinds in the MVP. Admin policy can further restrict an action to `never`. Every draft, approval, rejection, block and execution is audited (actor, intent, tool, input, authorisation, result). Drafts carry their supporting evidence so the user sees why ROOK recommends the action.
