# SuperConductor TSR Bridge

To run the project in development mode, run `yarn dev`.

## WebSocket API

TSR Bridge exposes a WebSocket API for controllers like SuperConductor and external tools.

### Query Timeline IDs

Request:

```json
{
	"type": "getTimelineIds"
}
```

Response:

```json
{
	"type": "timelineIds",
	"timelineIds": ["group-123", "group-456"]
}
```

### Get Timeline Content

Request:

```json
{
	"type": "getTimeline",
	"timelineId": "group-123"
}
```

Response:

```json
{
	"type": "timeline",
	"timelineId": "group-123",
	"timeline": []
}
```

Returns `null` for `timeline` if the id is not found.
