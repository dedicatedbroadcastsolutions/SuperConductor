# SuperConductor TSR Bridge

To run the project in development mode, run `yarn dev`.

## WebSocket API

TSR Bridge provides a WebSocket API for external applications to interact with it. By default, the bridge listens on `ws://localhost:5401` (port is configurable in settings).

### Connecting

Connect to the WebSocket server and send/receive JSON messages. All messages follow the `BridgeAPI` format defined in `@shared/api`.

### Available Messages

#### Query Timeline IDs

Get a list of all currently loaded timeline IDs:

**Request:**

```json
{
	"type": "getTimelineIds"
}
```

**Response:**

```json
{
  "type": "timelineIds",
  "timelineIds": ["timeline-id-1", "timeline-id-2", ...]
}
```

#### Get Timeline Content

Retrieve the full timeline content for a specific timeline ID:

**Request:**

```json
{
	"type": "getTimeline",
	"timelineId": "your-timeline-id"
}
```

**Response:**

```json
{
  "type": "timeline",
  "timelineId": "your-timeline-id",
  "timeline": [...] // Array of TSR timeline objects, or null if not found
}
```

### Message Types

See `shared/packages/api/src/bridgeAPI.ts` for the complete API definition including:

- Device status updates
- Peripheral (Stream Deck, X-keys) integration
- Resource and metadata updates
- Timeline and mapping management
