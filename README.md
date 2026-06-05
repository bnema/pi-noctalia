# pi-noctalia

Pi package that turns Noctalia's generated colors into a Pi theme and keeps it synchronized while Pi is running.

## What it does

- Reads Noctalia colors from `~/.config/noctalia/colors.json`.
- Writes a complete Pi theme to `~/.pi/agent/themes/noctalia.json`.
- Watches the Noctalia colors file and rewrites the Pi theme when it changes.
- Applies the `noctalia` theme automatically by default.
- Adds `/noctalia` commands for status, manual sync, and apply.

## Install locally

```bash
pi install /home/brice/dev/projects/pi-noctalia
```

Restart Pi or run `/reload`, then use:

```text
/noctalia status
/noctalia sync
/noctalia apply
```

The generated theme can also be selected from `/settings` as `noctalia`.

## Configuration

Set environment variables before starting Pi:

| Variable | Default | Purpose |
| --- | --- | --- |
| `NOCTALIA_COLORS_PATH` | `~/.config/noctalia/colors.json` | Source Noctalia colors file |
| `PI_NOCTALIA_THEME_NAME` | `noctalia` | Generated Pi theme name |
| `PI_NOCTALIA_AUTO_APPLY` | `true` | Set `0` to sync without forcing the active theme |
| `PI_NOCTALIA_WATCH` | `true` | Set `0` to disable the file watcher |

## Development

```bash
npm test
npm run check
```

The package is discovered through the `pi.extensions` entry in `package.json`.
