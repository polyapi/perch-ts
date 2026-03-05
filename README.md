# perch-ts 🦜

The TypeScript client for [PolyAPI](https://polyapi.io). `perch-ts` uses a JavaScript `Proxy` to dynamically route function calls to the PolyAPI backend — no code generation, no bloat.

---

## Installation

```bash
# npm
npm install polyapi-perch

# pnpm
pnpm add polyapi-perch

# yarn
yarn add polyapi-perch
```

---

## How it works

`perch-ts` creates a recursive `Proxy` object that intercepts property access and function calls. Each call is serialized and dispatched to the PolyAPI backend at runtime — the client itself has no knowledge of your specific API surface.

```
your code
    │
    ▼
poly.namespace.functionName(args)
    │
    │  Proxy intercepts call, builds request:
    │  { path: ["namespace", "functionName"], args }
    │
    ▼
PolyAPI backend
    │
    ▼
response
```

This means:
- Faster server function executions
- No generated stubs to keep in sync
- New client functions are available without a redepoly
- The full API surface is available from a single set of imports

---

## Quickstart

### Call a function

Property access builds the path; calling it dispatches to the backend.

```typescript
import poly from 'polyapi-perch';

// Calls: POST /execute/send-email/notify-user
const result = await poly.sendEmail.notifyUser({
  to: 'hello@example.com',
  subject: 'Hello from perch',
})
```

### Nested namespaces

```typescript
import poly from 'polyapi-perch';

const report = await poly.reporting.finance.generateQuarterly({ quarter: 'Q3' })
```
