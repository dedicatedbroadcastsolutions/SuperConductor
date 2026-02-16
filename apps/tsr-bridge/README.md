# SuperConductor TSR Bridge

To run the project in development mode, run `yarn dev`.

## WebSocket API

TSR Bridge provides a WebSocket API for external applications to interact with it. By default, the bridge listens on `ws://localhost:5401` (port is configurable in settings).

### Connection Modes

TSR Bridge supports two connection modes:

1. **Server Mode (Default)**: TSR Bridge listens for incoming connections on port 5401
2. **Client Mode**: TSR Bridge connects to an external controller (e.g., SuperConductor)

For external applications connecting to TSR Bridge, use Server Mode.

### Initial Connection and Handshake

When connecting to TSR Bridge as a client:

1. **Connect** to `ws://localhost:5401`
2. **Receive** an `initRequestId` message from the bridge
3. **Send** a `setId` message to assign a Bridge ID
4. **Receive** an `init` message confirming the bridge is ready

**Example Handshake:**

```javascript
const ws = new WebSocket('ws://localhost:5401')

ws.on('message', (data) => {
	const msg = JSON.parse(data)

	if (msg.type === 'initRequestId') {
		// Bridge is requesting an ID - assign one
		ws.send(
			JSON.stringify({
				type: 'setId',
				id: 'my-bridge-id', // Your unique bridge identifier
			})
		)
	}

	if (msg.type === 'init') {
		console.log(`Bridge ready: ${msg.id}, version: ${msg.version}`)
		// Now you can send configuration and timelines
	}
})
```

### Configuring Devices

Before sending timelines, you must configure which devices (CasparCG, ATEM, OBS, etc.) the bridge should control:

**Send `setSettings` message:**

```json
{
	"type": "setSettings",
	"devices": {
		"casparcg0": {
			"type": 0,
			"options": {
				"host": "127.0.0.1",
				"port": 5250
			}
		}
	},
	"peripherals": {},
	"autoConnectToAllPeripherals": false
}
```

Device types:

- `0` = CasparCG
- `1` = ATEM
- `2` = Lawo
- `3` = HTTPSend
- `4` = Panasonic PTZ
- `5` = TCPSend
- `6` = Hyperdeck
- `7` = Pharos
- `8` = OSC
- `9` = HTTPWatcher
- `10` = Sisyfos
- `11` = Quantel
- `12` = VizMSE
- `13` = Singular.Live
- `14` = Shotoku
- `15` = VMix
- `16` = OBS
- `17` = Telemetrics
- `18` = SofieChef
- `19` = TriCaster
- `20` = MultiOSC

### Setting Mappings

Mappings define how timeline layers map to device outputs:

**Send `setMappings` message:**

```json
{
	"type": "setMappings",
	"mappings": {
		"caspar_player0": {
			"device": 0,
			"deviceId": "casparcg0",
			"options": {
				"mappingType": 0,
				"channel": 1,
				"layer": 10
			}
		}
	},
	"currentTime": 1708070400000
}
```

### Sending Timelines

Add a timeline to be played by TSR:

**Send `addTimeline` message:**

```json
{
	"type": "addTimeline",
	"timelineId": "group-123",
	"timeline": [
		{
			"id": "obj0",
			"enable": {
				"start": 1708070400000,
				"duration": 5000
			},
			"layer": "caspar_player0",
			"content": {
				"deviceType": 0,
				"type": 1,
				"file": "my-video.mp4",
				"loop": false
			}
		}
	],
	"currentTime": 1708070400000
}
```

**Remove a timeline:**

```json
{
	"type": "removeTimeline",
	"timelineId": "group-123",
	"currentTime": 1708070400000
}
```

### Time Synchronization

The `currentTime` parameter (Unix timestamp in milliseconds) synchronizes the bridge's clock with your application. This is critical for scheduled playback. TSR Bridge calculates a time offset and uses `getCurrentTime()` internally to ensure accurate playback timing.

### Monitoring Device Status

TSR Bridge automatically sends device status updates:

**Receive `deviceStatus` messages:**

```json
{
	"type": "deviceStatus",
	"deviceId": "casparcg0",
	"ok": true,
	"message": "Connected"
}
```

**Monitor connection changes:**

- `ok: true` = Device connected and operational
- `ok: false` = Device disconnected or error

### Querying Timeline State

#### Get Timeline IDs

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
	"timelineIds": ["group-123", "group-456"]
}
```

#### Get Timeline Content

Retrieve the full timeline content for a specific timeline ID:

**Request:**

```json
{
	"type": "getTimeline",
	"timelineId": "group-123"
}
```

**Response:**

```json
{
	"type": "timeline",
	"timelineId": "group-123",
	"timeline": [
		{
			"id": "obj0",
			"enable": { "start": 1708070400000, "duration": 5000 },
			"layer": "caspar_player0",
			"content": { "deviceType": 0, "type": 1, "file": "my-video.mp4" }
		}
	]
}
```

Returns `null` if timeline not found.

### Device Resources

Query available resources (media files, templates, etc.) from devices:

**Request:**

```json
{
	"type": "refreshResources"
}
```

**Response** (one per device):

```json
{
	"type": "updatedResourcesAndMetadata",
	"deviceId": "casparcg0",
	"resources": [{ "id": "my-video", "displayName": "my-video.mp4", "resourceType": 0 }],
	"metadata": {}
}
```

### Complete Message Reference

#### Messages FROM Bridge (received by your application):

- `initRequestId` - Bridge requests an ID (handshake)
- `init` - Bridge initialized with ID
- `deviceStatus` - Device connection status changed
- `deviceRemoved` - Device was removed from configuration
- `timelineIds` - Response to `getTimelineIds`
- `timeline` - Response to `getTimeline`
- `updatedResourcesAndMetadata` - Device resources updated
- `DeviceRefreshStatus` - Device is refreshing resources
- `PeripheralStatus` - Stream Deck/X-keys status (connected/disconnected)
- `PeripheralTrigger` - Stream Deck/X-keys button press
- `PeripheralAnalog` - Stream Deck/X-keys analog input
- `KnownPeripherals` - Response to `getKnownPeripherals`

#### Messages TO Bridge (sent by your application):

- `setId` - Assign a bridge ID (handshake)
- `setSettings` - Configure devices and peripherals
- `setMappings` - Set timeline layer to device output mappings
- `addTimeline` - Add/update a timeline
- `removeTimeline` - Remove a timeline
- `updateDatastore` - Update TSR datastore values
- `getTimelineIds` - Query loaded timeline IDs
- `getTimeline` - Query specific timeline content
- `refreshResources` - Request device resource refresh
- `peripheralSetKeyDisplay` - Set Stream Deck button display
- `getKnownPeripherals` - Query connected peripherals

### Example: Complete Workflow

```javascript
const WebSocket = require('ws')
const ws = new WebSocket('ws://localhost:5401')

ws.on('open', () => {
	console.log('Connected to TSR Bridge')
})

ws.on('message', (data) => {
	const msg = JSON.parse(data)
	console.log('Received:', msg.type)

	// Handshake
	if (msg.type === 'initRequestId') {
		ws.send(JSON.stringify({ type: 'setId', id: 'my-app' }))
	}

	if (msg.type === 'init') {
		console.log('Bridge ready!')

		// Configure CasparCG device
		ws.send(
			JSON.stringify({
				type: 'setSettings',
				devices: {
					casparcg0: {
						type: 0,
						options: { host: '127.0.0.1', port: 5250 },
					},
				},
				peripherals: {},
				autoConnectToAllPeripherals: false,
			})
		)

		// Set mappings
		ws.send(
			JSON.stringify({
				type: 'setMappings',
				mappings: {
					layer0: {
						device: 0,
						deviceId: 'casparcg0',
						options: {
							mappingType: 0,
							channel: 1,
							layer: 10,
						},
					},
				},
				currentTime: Date.now(),
			})
		)

		// Add timeline
		ws.send(
			JSON.stringify({
				type: 'addTimeline',
				timelineId: 'my-timeline',
				timeline: [
					{
						id: 'obj0',
						enable: { start: Date.now() + 1000 },
						layer: 'layer0',
						content: {
							deviceType: 0,
							type: 1,
							file: 'AMB',
						},
					},
				],
				currentTime: Date.now(),
			})
		)
	}

	// Monitor device status
	if (msg.type === 'deviceStatus') {
		console.log(`Device ${msg.deviceId}: ${msg.ok ? 'OK' : 'ERROR'} - ${msg.message}`)
	}
})
```

### TypeScript Definitions

For TypeScript projects, import the API types:

```typescript
import { BridgeAPI } from '@shared/api'
import { DeviceType, Mappings, TSRTimeline } from 'timeline-state-resolver-types'

// Strongly typed messages
const message: BridgeAPI.FromSuperConductor.AddTimeline = {
	type: 'addTimeline',
	timelineId: 'my-timeline',
	timeline: [],
	currentTime: Date.now(),
}
```

### API Reference

For the complete API definition, see:

- `shared/packages/api/src/bridgeAPI.ts` - Message types and schemas
- `node_modules/timeline-state-resolver-types` - Timeline and device types
