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

#### How Time Synchronization Works

TSR Bridge maintains a time offset calculated as: `offset = receivedCurrentTime - Date.now()`. All timeline calculations use `Date.now() + offset` to determine what should be playing at any given moment.

#### Updating Current Time

You can update the time synchronization by sending `currentTime` with any of these messages:

- `addTimeline` - Add/update a timeline and sync time
- `removeTimeline` - Remove a timeline and sync time
- `setMappings` - Update mappings and sync time
- `updateDatastore` - Update datastore and sync time

**Example: Sync time without changing timeline:**

```json
{
	"type": "setMappings",
	"mappings": {},
	"currentTime": 1708070400000
}
```

This sends empty/unchanged mappings but updates the time offset. If you already have mappings configured, send the same mappings object to avoid clearing them.

**Better approach: Use updateDatastore:**

```json
{
	"type": "updateDatastore",
	"updates": [],
	"currentTime": 1708070400000
}
```

Sending an empty `updates` array has no side effects and only updates time synchronization.

#### When to Update Time

- **Initial setup**: Send with your first `addTimeline` or `setMappings`
- **Periodic sync**: Every 30-60 seconds to compensate for clock drift between machines
- **After reconnection**: If your application disconnects and reconnects
- **Time-critical operations**: Before scheduled events to ensure accuracy

**Note**: Time synchronization is cumulative - each `currentTime` received replaces the previous offset. There's no need to send continuous updates unless you need high precision across different machines or after long periods of inactivity.

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

### Timeline Object Properties

Timeline objects are the core building blocks sent to TSR Bridge. Each object defines what should happen, when, and on which device output.

#### Required Properties

**`id`** (string): Unique identifier for this timeline object

```javascript
id: 'obj0'
```

**`layer`** (string): Maps to a device output via mappings. Must match a mapping key.

```javascript
layer: 'caspar_player0'
```

**`enable`** (object | array): Defines when/how the object is active. Can be a single enable object or array of enable objects.

Enable object properties:

- `start` (number | string): When to start (Unix timestamp or expression like `#other_id.end`)
- `end` (number | string): When to end (Unix timestamp or expression)
- `duration` (number): How long to play (milliseconds)
- `while` (string | number): Condition expression (e.g., `1` = always, `#other_id` = while other exists)
- `repeating` (number): Repeat interval (milliseconds)

```javascript
// Absolute time
enable: { start: 1708070400000, duration: 5000 }

// Relative to another object
enable: { start: "#obj1.end + 1000", duration: 3000 }

// Infinite duration
enable: { start: 1708070400000 }

// While condition
enable: { while: "#background_obj" }

// Multiple enable conditions
enable: [
  { start: 1708070400000, end: 1708070405000 },
  { start: 1708070410000, duration: 5000 }
]
```

**`content`** (object): Device-specific content. Always includes `deviceType` and varies by device.

Common device types:

- `0` = CasparCG
- `1` = ATEM
- `5` = TCPSend
- `6` = Hyperdeck
- `8` = OSC
- `15` = VMix
- `16` = OBS
- `19` = TriCaster

```javascript
// CasparCG media file
content: {
  deviceType: 0,
  type: 1, // MEDIA
  file: "my-video.mp4",
  loop: false
}

// ATEM mix effect
content: {
  deviceType: 1,
  type: 0, // ME
  me: {
    input: 1,
    transition: 0 // CUT
  }
}
```

#### Optional Properties

**`priority`** (number): Layering priority. Higher numbers take precedence when multiple objects are on the same layer. Default: 0

```javascript
priority: 5
```

**`classes`** (string[]): CSS-like classes for organization and grouping

```javascript
classes: ['graphics', 'lower-third']
```

**`disabled`** (boolean): Temporarily disable without removing. Default: false

```javascript
disabled: true
```

**`seamless`** (boolean): For CasparCG, attempt seamless transitions. Default: false

```javascript
seamless: true
```

**`isGroup`** (boolean): Indicates if this object is a container for child objects. Default: false

```javascript
isGroup: true
```

**`children`** (array): Child timeline objects that inherit timing from parent

```javascript
children: [
	{
		id: 'child1',
		layer: 'layer1',
		enable: { start: 0 }, // Relative to parent start
		content: {
			/* ... */
		},
	},
]
```

#### Complete Timeline Object Example

```javascript
{
  "id": "main_video",
  "layer": "caspar_player0",
  "enable": {
    "start": 1708070400000,
    "duration": 30000
  },
  "priority": 1,
  "classes": ["main-content"],
  "content": {
    "deviceType": 0,
    "type": 1,
    "file": "intro.mp4",
    "loop": false,
    "seek": 0,
    "inPoint": 0,
    "length": 30000
  },
  "isGroup": false,
  "children": [
    {
      "id": "graphics_overlay",
      "layer": "caspar_gfx0",
      "enable": {
        "start": 5000,  // 5 seconds after parent starts
        "duration": 10000
      },
      "content": {
        "deviceType": 0,
        "type": 2,  // TEMPLATE
        "name": "lower_third",
        "data": {
          "f0": "John Doe",
          "f1": "CEO"
        }
      }
    }
  ]
}
```

#### Timeline Resolution

TSR uses the [Superfly Timeline](https://github.com/SuperFlyTV/supertimeline) library to resolve timeline objects. This means:

- **Expression support**: Enable times can reference other objects (`#other_id.start + 1000`)
- **Conflict resolution**: Priority determines which object wins when multiple objects target the same layer
- **Automatic timing**: Child objects inherit parent timing
- **While conditions**: Objects can exist conditionally based on other objects

For more details on timeline expressions and resolution, see the [Superfly Timeline documentation](https://github.com/SuperFlyTV/supertimeline).

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
