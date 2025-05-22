# PlanqTN CLI

A command-line interface tool for PlanqTN.

## Installation

```bash
npm install -g planqtn-cli
```

Or use it directly with npx:

```bash
npx planqtn-cli <command>
```

## Usage

### Running Jobs

```bash
planqtn run <job_type>
```

Example:

```bash
planqtn run example
```

## Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```
4. Run in development mode:
   ```bash
   npm run dev
   ```

## Publishing

To publish a new version:

1. Update the version in `package.json`
2. Run `npm publish`

## License

ISC
