# Rascals archive

The website reads the live publisher’s seven-day snapshot first, then the gzipped
`runescapeRascals:archive` key when the live data expires. The archive has no TTL.
It preserves the published dashboard, not a complete gameplay replay.

To replace the archive after a run, use the publisher’s saved public snapshot:

```sh
node --env-file=/path/to/runscape-local/.env scripts/archive-rascals.mjs /path/to/runscape-local/agents/public/snapshot.json
```

This replaces only the archive key. It does not start the game or make model calls.
Keep the snapshot file as an independent backup: Redis persistence is not a backup.
The archive is updated explicitly; live publishing does not refresh it automatically.
Images are separate assets. Snapshots without an asset base use the bundled character
portraits and do not expose the publisher’s local screenshot paths.
