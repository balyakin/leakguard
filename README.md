# LeakGuard

LeakGuard is a CLI analyzer for resource lifecycle leaks on execution paths. It uses a hybrid approach:

- deterministic path checks for obvious leaks,
- optional LLM modeling for ambiguous functions,
- verification and reporting with stable finding identifiers.

## Install

```bash
npm install -g leakguard
```

## Usage

```bash
leakguard scan .
leakguard scan src --format json --output leakguard.json
leakguard demo --language go
```

## Development

```bash
npm install
npm run build
npm test
```
