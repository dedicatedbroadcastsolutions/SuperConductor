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
			"type": "CASPARCG",
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

Recommended: use string enum values (for example `CASPARCG`, `ATEM`, `OSC`) for `type`, `device`, and `deviceType`. The numeric values below are legacy and kept for backward compatibility.

Device types (legacy numeric values):

Note: To determine the valid string values, use the `DeviceType` enum from `timeline-state-resolver-types` in your client or inspect the package's `DeviceType` definition (for example in `node_modules/timeline-state-resolver-types/dist/index.d.ts`). Examples below use the recommended string enum values.

- `0` = Abstract (empty)
- `1` = CasparCG
- `2` = ATEM
- `3` = Lawo
- `4` = HTTPSend
- `5` = Panasonic PTZ
- `6` = TCPSend
- `7` = Hyperdeck
- `8` = Pharos
- `9` = OSC
- `10` = HTTPWatcher
- `11` = Sisyfos
- `12` = Quantel
- `13` = VizMSE
- `14` = Singular.Live
- `15` = Shotoku
- `20` = VMix
- `21` = OBS
- `22` = SofieChef
- `23` = Telemetrics
- `24` = TriCaster
- `25` = MultiOSC

### Setting Mappings

Mappings define how timeline layers map to device outputs:

Note: `mappingType` accepts string enum names (for example, `mixEffect`, `program`, `input`) from `timeline-state-resolver-types`. Numeric values are legacy and still accepted for backward compatibility. Use the mapping enums for the device (for example, `MappingAtemType`, `MappingVmixType`, `MappingObsType`) to see valid string values. For CasparCG, the enum value is `layer` (lowercase) and casing is significant.

**Send `setMappings` message:**

```json
{
	"type": "setMappings",
	"mappings": {
		"caspar_player0": {
			"device": "CASPARCG",
			"deviceId": "casparcg0",
			"options": {
				"mappingType": "layer",
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
				"deviceType": "CASPARCG",
				"type": "media",
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
			"content": { "deviceType": "CASPARCG", "type": "media", "file": "my-video.mp4" }
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

Note: `content.type` uses string enum values from `timeline-state-resolver-types` (for example, CasparCG `media`, `template`; OBS `CURRENT_SCENE`, `INPUT_MEDIA`; OSC `osc`). Legacy numeric values may work in older payloads, but string enums are the documented/typed form.

Common device types:

- `1` = CasparCG
- `2` = ATEM
- `6` = TCPSend
- `7` = Hyperdeck
- `9` = OSC
- `20` = VMix
- `21` = OBS
- `24` = TriCaster

```javascript
// CasparCG media file
content: {
	deviceType: "CASPARCG",
	type: "media", // MEDIA
  file: "my-video.mp4",
  loop: false
}

// ATEM mix effect
content: {
	deviceType: "ATEM",
	type: "me", // ME
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
		"deviceType": "CASPARCG",
		"type": "media",
    "file": "intro.mp4",
		"loop": false,
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
				"deviceType": "CASPARCG",
				"type": "template",  // TEMPLATE
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

#### Advanced Timeline Properties

**`keyframes`** (array): Modifies content over time without creating separate timeline objects. Each keyframe can override content properties during its active period.

Keyframe object structure:

- `id` (string): Unique identifier for this keyframe
- `enable` (object | array): When this keyframe is active (relative to parent object)
- `duration` (number | string): Optional duration override
- `classes` (string[]): Optional classes for organization
- `content` (object): Partial content to override during this keyframe
- `disabled` (boolean): Temporarily disable this keyframe

```javascript
{
  "id": "gfx_anim",
  "layer": "caspar_gfx0",
  "enable": { "start": 0, "duration": 10000 },
  "content": {
		"deviceType": "CASPARCG",
		"type": "template",
    "name": "lower_third",
    "data": { "opacity": 0 }
  },
  "keyframes": [
    {
      "id": "fade_in",
      "enable": { "start": 0, "duration": 500 },
      "content": { "data": { "opacity": 100 } }
    },
    {
      "id": "fade_out",
      "enable": { "start": 9500, "duration": 500 },
      "content": { "data": { "opacity": 0 } }
    }
  ]
}
```

**`isLookahead`** (boolean): Internal TSR property indicating this object was inserted by lookahead. Generally not set by external applications. Default: false

**`lookaheadForLayer`** (string | number): When `isLookahead` is true, indicates which layer this lookahead object belongs to.

#### Device-Specific Content Properties

Note: TSR Bridge forwards device-specific content fields to TSR. The fields below are supported for CasparCG media and are optional.

Some devices support additional content properties beyond the standard configuration:

**CasparCG Media (`deviceType: CASPARCG, type: media`)**

- `playing` (boolean): Controls play/pause. `false` issues a CasparCG pause (freeze current frame). Transitioning from `false` to `true` resumes playback.
- `seek` (number): Explicit seek offset in milliseconds. When `noStarttime` is `false`, TSR adds the auto-computed play position to `seek`. When `noStarttime` is `true`, TSR uses `seek` as the absolute position.
- `pauseTime` (number): Used to calculate the paused time position. While `playing: false`, TSR issues a pause; if you need to scrub to a new frame, include `seek` (and, if needed, toggle `playing`) to force a seek/update.
- `noStarttime` (boolean): If true, prevents TSR from seeking to the correct position when starting playback. Useful when you want media to play from the beginning regardless of timeline position. Default: false

Behavior notes (CasparCG media):

- Updating `pauseTime` while `playing: false` does not by itself force a seek; TSR compares `pauseTime`, but the pause command does not include a seek parameter. To scrub to a new frame, update `seek` and/or toggle `playing` to trigger a new play/seek or load.
- With `noStarttime: false`, `seek` is treated as a base offset and TSR adds the auto-computed position (now - start). With `noStarttime: true`, `seek` is treated as the absolute position.
- When a clip becomes active mid-play, TSR computes the elapsed time since `enable.start` and issues a play with a computed seek offset rather than starting from the beginning.
- There is no explicit "force" flag in the bridge API; to force a new command, change a property that affects diffing (for example `seek`, `playing`, `media`, or timing), rather than relying on a new object id alone.

Scrub sequence example (explicitly seek while paused):

```javascript
// Initial pause at a known position
{
	"content": {
		"deviceType": "CASPARCG",
		"type": "media",
		"file": "background.mp4",
		"playing": false,
		"seek": 1000,
		"pauseTime": 1000
	}
}

// Scrub to a new frame while still paused (update seek)
{
	"content": {
		"deviceType": "CASPARCG",
		"type": "media",
		"file": "background.mp4",
		"playing": false,
		"seek": 5000,
		"pauseTime": 5000
	}
}
```

```javascript
{
  "id": "video_no_seek",
  "layer": "caspar_player0",
  "enable": { "start": 5000, "duration": 30000 },
  "content": {
		"deviceType": "CASPARCG",
		"type": "media",
    "file": "background.mp4",
    "noStarttime": true  // Play from start, don't seek based on timeline position
  }
}
```

```javascript
// Pause at an explicit frame (scrub/shuttle)
{
	"content": {
		"deviceType": "CASPARCG",
		"type": "media",
		"file": "background.mp4",
		"playing": false,
		"pauseTime": 1250
	}
}

// Resume from a specific position
{
	"content": {
		"deviceType": "CASPARCG",
		"type": "media",
		"file": "background.mp4",
		"playing": true,
		"seek": 1250
	}
}
```

**CasparCG Transitions**

When using CasparCG content, you can define transitions via the `transitions` property in content:

```javascript
{
  "content": {
		"deviceType": "CASPARCG",
		"type": "media",
    "file": "video.mp4",
    "transitions": {
      "inTransition": {
        "type": "MIX",
        "duration": 500
      },
      "outTransition": {
        "type": "WIPE",
        "duration": 1000
      }
    }
  }
}
```

**OSC Messages (`deviceType: OSC`)**

OSC (Open Sound Control) allows controlling external devices via UDP or TCP network messages.

**Device Configuration:**

```javascript
{
	"osc_device": {
		"type": "OSC",  // OSC
    "options": {
      "host": "127.0.0.1",
      "port": 8000,
      "type": "udp"  // or "tcp"
    }
  }
}
```

**Mapping Configuration:**

OSC mappings don't require specific options beyond the standard device and deviceId:

```javascript
{
	"osc_layer": {
		"device": "OSC",
    "deviceId": "osc_device",
    "layerName": "OSC Control",
    "options": {}
  }
}
```

**Timeline Content:**

OSC timeline objects specify the OSC path and values to send:

```javascript
{
  "id": "osc_fader",
  "layer": "osc_layer",
  "enable": { "start": 0, "duration": 5000 },
	"content": {
		"deviceType": "OSC",
    "type": "osc",
    "path": "/mixer/fader1",
    "values": [
      { "type": "f", "value": 0.75 }  // Float value
    ]
  }
}
```

**Value Types:**

OSC supports multiple value types:

- `"i"` - Integer: `{ "type": "i", "value": 42 }`
- `"f"` - Float: `{ "type": "f", "value": 0.5 }`
- `"s"` - String: `{ "type": "s", "value": "hello" }`
- `"b"` - Blob (binary): `{ "type": "b", "value": Uint8Array }`
- `"T"` - True (boolean): `{ "type": "T", "value": undefined }`
- `"F"` - False (boolean): `{ "type": "F", "value": undefined }`

**Multiple Values:**

Send multiple values in a single OSC message:

```javascript
{
	"content": {
		"deviceType": "OSC",
    "type": "osc",
    "path": "/mixer/channel/1",
    "values": [
      { "type": "f", "value": 0.8 },   // Volume
      { "type": "i", "value": 1 },     // Channel number
      { "type": "s", "value": "Main" } // Label
    ]
  }
}
```

**Transitions with Easing:**

OSC values can transition smoothly over time with easing functions:

```javascript
{
	"content": {
		"deviceType": "OSC",
    "type": "osc",
    "path": "/mixer/fader1",
    "values": [
      { "type": "f", "value": 1.0 }  // Target value
    ],
    "from": [
      { "type": "f", "value": 0.0 }  // Starting value
    ],
    "transition": {
      "duration": 2000,  // 2 seconds
      "type": "Sinusoidal",
      "direction": "InOut"
    }
  }
}
```

**Easing Types:**

- `"Linear"` - Constant speed
- `"Quadratic"`, `"Cubic"`, `"Quartic"`, `"Quintic"` - Polynomial curves
- `"Sinusoidal"` - Smooth sine wave
- `"Exponential"` - Rapid acceleration/deceleration
- `"Circular"` - Circular arc curve
- `"Elastic"` - Spring-like overshoot
- `"Back"` - Slight overshoot
- `"Bounce"` - Bouncing effect

**Easing Directions:**

- `"In"` - Easing at start
- `"Out"` - Easing at end
- `"InOut"` - Easing at both start and end
- `"None"` - No easing (linear)

**Complete OSC Example:**

```javascript
// Fade audio fader from 0% to 100% over 3 seconds with smooth easing
{
  "id": "audio_fade_in",
  "layer": "osc_audio",
  "enable": {
    "start": 0,
    "duration": 3000
  },
	"content": {
		"deviceType": "OSC",
    "type": "osc",
    "path": "/audio/master/fader",
    "values": [
      { "type": "f", "value": 1.0 }
    ],
    "from": [
      { "type": "f", "value": 0.0 }
    ],
    "transition": {
      "duration": 3000,
      "type": "Sinusoidal",
      "direction": "InOut"
    }
  }
}
```

For complete device-specific content properties, refer to the [timeline-state-resolver-types](https://github.com/nrkno/sofie-timeline-state-resolver/tree/master/packages/timeline-state-resolver-types) package.

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
						type: 'CASPARCG',
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
						device: 'CASPARCG',
						deviceId: 'casparcg0',
						options: {
							mappingType: 'layer',
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
							deviceType: 'CASPARCG',
							type: 'media',
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
