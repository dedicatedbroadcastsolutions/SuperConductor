# SuperConductor TSR Bridge

To run the project in development mode, run `yarn dev`.

## WebSocket API

TSR Bridge exposes a WebSocket API for controllers like SuperConductor and external tools.
The examples below show request/response pairs sent over the same socket.

### Connection modes

TSR Bridge supports two connection modes, configured in settings:

- Server mode: `acceptConnections` is true. The bridge listens on `ws://<host>:<listenPort>`.
- Client mode: `acceptConnections` is false. The bridge connects to `superConductorHost` using `bridgeId`.

### Handshake

Server mode (external client connects to TSR Bridge):

1. Bridge sends `initRequestId`.
2. Client replies with `setId`.
3. Bridge replies with `init` (with `incoming: false`).

Client mode (TSR Bridge connects to SuperConductor):

1. Bridge sends `init` immediately (with `incoming: true`).

### Message reference

#### From SuperConductor to bridge

- `setId`: reply to `initRequestId`.
- `setSettings`: configure devices and peripherals.
- `setMappings`: set layer-to-device mappings (includes `currentTime`).
- `addTimeline`: add or replace a timeline group (includes `currentTime`).
- `removeTimeline`: remove a timeline group (includes `currentTime`).
- `updateDatastore`: update the datastore (includes `currentTime`).
- `getTimelineIds`: request the list of timeline IDs.
- `getTimeline`: request the content for one timeline ID.
- `refreshResources`: request a resource refresh for side-loaded devices.
- `peripheralSetKeyDisplay`: set a key display on a peripheral.
- `getKnownPeripherals`: request known peripherals.

#### From bridge to SuperConductor

- `initRequestId`: request a bridge ID (server mode only).
- `init`: announce bridge ID/version and connection direction.
- `deviceStatus`: device status changes (`ok`, `message`).
- `deviceRemoved`: device removed.
- `updatedResourcesAndMetadata`: resource refresh response.
- `DeviceRefreshStatus`: refresh in-progress/completed state.
- `timelineIds`: response to `getTimelineIds`.
- `timeline`: response to `getTimeline`.
- `PeripheralStatus`: peripheral connect/disconnect.
- `PeripheralTrigger`: peripheral key down/up.
- `PeripheralAnalog`: peripheral analog input changes.
- `KnownPeripherals`: response to `getKnownPeripherals`.

### Time synchronization

The bridge keeps a time offset based on `currentTime`. Send `currentTime` (Unix ms)
whenever you send any of these messages:

- `addTimeline`
- `removeTimeline`
- `setMappings`
- `updateDatastore`

To sync time without changing timelines or mappings, send an empty `updateDatastore`:

```json
{
	"type": "updateDatastore",
	"updates": [],
	"currentTime": 1708070400000
}
```

### Timelines

`addTimeline` replaces or creates a timeline group by ID. Each timeline entry must
conform to `TSRTimeline` from `timeline-state-resolver-types`.

Minimal example:

```json
{
	"type": "addTimeline",
	"timelineId": "group-123",
	"timeline": [
		{
			"id": "obj0",
			"layer": "caspar_player0",
			"enable": {
				"start": 1708070400000,
				"duration": 5000
			},
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

### Query timeline IDs

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

### Get timeline content

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

Returns `null` for `timeline` if the id is not found. SuperConductor ignores the
`timeline` response today, but external tools can use it.

### Devices, mappings, and resources

Device and mapping shapes are defined by `timeline-state-resolver-types`.
Example `setSettings`:

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

Side-loaded devices (used for resource/metadata refresh) include:

- CasparCG
- ATEM
- OBS
- VMix
- OSC
- HTTPSend
- Hyperdeck
- TCPSend
- TriCaster

To refresh device resources:

```json
{
	"type": "refreshResources"
}
```

The bridge responds with `DeviceRefreshStatus` and `updatedResourcesAndMetadata`.

### Peripherals

Peripherals are configured via `setSettings`. The bridge publishes
`PeripheralStatus`, `PeripheralTrigger`, `PeripheralAnalog`, and `KnownPeripherals`.
To update a key display:

```json
{
	"type": "peripheralSetKeyDisplay",
	"deviceId": "peripheral-1",
	"identifier": "key-1",
	"keyDisplay": {
		"type": "static",
		"label": "On"
	}
}
```
