# Development instructions

## Contributing to the qlego library

For the python library, just simply clone the repo, and install the dependencies:

```
pip install -r requirements.txt -r requirements.dev.txt
```

### Checks and tests

Before committing ensure that you followed the black formatting and tests are passing:

```
check/qlego
```

## Contributing a UI-only feature

After you cloned the repo, you can setup the npm dependencies with:

```
cd app/ui
npm install
```

Start the server in dev mode to get auto-reload:

```
cd app/ui
npm run dev
```

This should give you a http://localhost:5173 URL for the UI.

### Checks and tests

To execute formatting/linting and tests, run:

```
check/ui
```

# Developing cloud features

## planqTN CLI

# Cloud runtime

Make sure that you have access to the planqtn-dev project. Ping @balopat, @brad-lackey or @

## Cloud Run API server

```
gcloud
```

# Local runtime

## API server

This component is currently the home for the different parameterized tensor network construction features.

## Jobs

For the weightenumerator job

## Supabase local instance

```
 supabase --workdir app start/stop
 supabase --workdir app functions serve --no-verify-jwt
```
