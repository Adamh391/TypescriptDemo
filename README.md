# Data8 TypeScript Packages Demo

A demo project showcasing Data8's TypeScript packages for validation and data services, with both React and Vue examples.

## Available Demos

- **Predictive Address** — Address autocomplete
- **Email Validation** — Email address verification
- **Bank Account Validation** — Bank account number and sort code checking

## Getting Started

### Prerequisites

- Node.js

### Setup

```bash
npm install
```

Create a `.env` file in the project root and add your Data8 API key:

```env
API_KEY=your-key-here
```

If you do not already have a key, create one at:

https://portal.data-8.co.uk/development/api-keys

### Running the Demos

```bash
# React demo
npm run dev:react

# Vue demo
npm run dev:vue
```

If `API_KEY` is missing, each app will stop at startup and display an error message with setup instructions.

## Project Structure

| Directory | Description |
|-----------|-------------|
| `demo/react/` | React demo pages |
| `demo/vue/` | Vue demo pages |

## Dependencies

| Package | Description |
|---------|-------------|
| [`@data8/types`](https://www.npmjs.com/package/@data8/types) | TypeScript type definitions for Data8 web services |
| [`openapi-fetch`](https://www.npmjs.com/package/openapi-fetch) | Type-safe HTTP client for OpenAPI schemas |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:react` | Start React demo dev server |
| `npm run dev:vue` | Start Vue demo dev server |