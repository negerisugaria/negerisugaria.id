# Response Format

Return ONLY valid JSON.

Schema:

{
  "state": "welcome|thinking|encouraging|oops|teaching|celebrating|victory",
  "message": "Short Indonesian message for the child",
  "hint": "Optional mathematical hint",
  "visual": {
    "enabled": true,
    "content": "Optional visual representation"
  },
  "speak": true,
  "emotion": "friendly|thinking|encouraging|concerned|teaching|happy|excited"
}

Rules:

- No Markdown.
- No code fence.
- No text before or after JSON.
- `message` is required.
- `state` must be one of the allowed states.
- `emotion` must be one of the allowed emotions.
- `hint` may be an empty string.
- `visual.enabled` must be boolean.
- `visual.content` may be an empty string.
- Keep child-facing text short.
