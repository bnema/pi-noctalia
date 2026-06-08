# pi-noctalia

Sync Noctalia colors into a Pi theme.

## What it does

- Reads colors from Noctalia's generated theme data.
- Builds a Pi theme from the current Noctalia palette.
- Keeps Pi's UI visually aligned with the active desktop theme.

## Install

```bash
pi install git:github.com/bnema/pi-noctalia
```

If installed into a running Pi session, reload extensions:

```text
/reload
```

## Use

Run Pi normally after installation. The extension updates the Pi theme from Noctalia when theme data is available.

## Develop

```bash
npm install
npm test
pi -e .
```
