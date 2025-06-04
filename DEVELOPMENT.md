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

## Running the planqTN CLI

The CLI can be run in two modes:

- `local` mode - this is what end users will use, and what the CLI is meant to be used for in production and CI/CD environments. The tool operates in ~/.planqtn and has prepackaged configuration definitions for the supabase / k8s clusters. It does not need the project git repo to work. The postfix on all objects (containers, docker network, supabase instance) is `-local`.

- `dev` mode - it works solely from the git repo, and is meant to "dog food" our own CLI tool, but without the need to build the tool and install it every time things change, also allowing for fast reload of function development in supabase. The postfix on all objects (containers, docker network, supabase instance) is `-dev`.

This setup allows for the two different setups to coexist though currently ports are the same, so only one of them can be active at a time.

### Dev mode - using htn for development

Simply run `hack/htn` instead of `htn`, and things should work.

### Building for local mode

To build the tool, run

```
hack/cli_build.sh
```

This allows you to inspect the app/planqtn_cli/dist folder content.

Install the tool globally, to use local kernel mode

```
hack/cli_build.sh --install
```

Now,

```
htn --help
```

should work.

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
