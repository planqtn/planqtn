# Architecture

<p align="center">
<img src="fig/architecture.png" width="100%"></img>
</p>

PlanqTN features largely live in the user's browser. However, for background jobs and more complicated tensornetwork/lego database we offer the PlanqTN Jobs and the PlaqnTN API features. Key points to understand about the architecture:

- the UI only talks to the Supabase instance, for 4 reasons: authentication, edge functions (logic), the database for retrieval and realtime messages
- Supabase functions contain the logic to talk to the API and the Job API of Cloud Run

# Developer Setup

Depending on what you want to work on, your setup might require very minimal time/resouce investment or quite a bit, including setting up a local cloud on your laptop and/or a personal cloud infrastructure hooked up to Github Actions. Please review the development workflows below, and pick the required setup based on the component you want to contribute to.

# PlanqTN Components and development workflows

## The PlanqTN python library

### Components

Source code is in `qlego` (will shortly rename it to `planqtn`). Dependencies are in `requirements.txt` and `requirements.dev.txt` for development. `setup.py` drives the local installation and eventually the pypi setup.

### Development setup

For the python library, just simply clone the repo, and install the dependencies:

```
pip install -r requirements.txt -r requirements.dev.txt
```

### Checks and tests

Before committing, ensure that you followed the black formatting and tests are passing:

```
check/qlego
```

Note that both PlanqTN APIs and PlanqTN Jobs have depenencies on qlego, and changes will trigger integration tests on Github Actions.

## PlanqTN Studio

The PlanqTN Studio involves a couple of components:

- the [Web UI](#web-ui-features) is a ReactJS/Vite web app, running as a Cloud Run Service in the hosted version
- the [API](#planqtn-api) is a web service to serve relatively fast, but non-JS implemented logic
- the [Jobs](#planqtn-background-jobs) are are for executing long running computaitons

We use GCP Cloud Run for executing workloads and the API and we use Supabase for realtime messaging, database, authentication.
It is important to understand the concepts of User context and Runtime context

- **User context**: authentication, task store, quota function, user content database
- **Runtime context**: task management functions, api functions, realtime messaging database

In the hosted version, a single Supabase instance takes care of both the User context and the Runtime context. However, the user can pick from the UI a local Runtime context. This ends up requiring a local kernel with a local Supabase installation. In the codebase we refer to the User context as "Task store" sometimes as it contains the definition for the tasks in the `tasks` table. The Runtime context only uses the `task_updates` table which is then used by the UI to subscribe to the realtime progress bar messages.

The reason for this complicated separation is to give a transparent way for the user to use local features by offloading the most expensive features of the cloud (edge function calls, realtime messaging, task execution), while keeping the ability to publish results in the public database or to just keep things like the canvas in a single hosted place for the user.

## Web UI features

A large set of the features are only in the UI, which doesn't need any backend infrastructure. The PlanqTN UI is based on Vite/ReactJS and is served as a Cloud Run Service.

### Components

Source code is contained within the `app/ui` folder.

### Development setup

After you cloned the repo, you can setup the npm dependencies with:

```
hack/htn ui start --dev
```

This should give you a http://localhost:5173 URL for the UI.
The UI needs a User Context for authentication user content presistence in Supabase, so when it doesn't have it setup you'll see a "User context unavailable" warning next to the User menu.

<img src="fig/user_context_unavailable.png"/>

This is okay if you don't want to develop anything related to authentication / tasks / API calls.

If you have to do any of those, then you'll need a User context. You have two options:

1. Use the `dev` runtime kernel as your User context

- See [Setting up `dev` kernel](#setting-up-dev-kernel)
- start your ui with `hack/htn ui start --dev --dev-user-context` or manually create/edit the `app/ui/.env` file

```bash
VITE_TASK_STORE_URL=http://127.0.0.1:54321
VITE_TASK_STORE_ANON_KEY="<your supabase instance's anon key>"
VITE_ENV=development
```

2. Use your personal cloud

If you want to set that up, then you can manually setup the `app/ui/.env` file

```bash
VITE_TASK_STORE_URL=https://yourprojectref.supabase.co
VITE_TASK_STORE_ANON_KEY="<your supabase instance's anon key>"
VITE_ENV=development
```

### Containerization

As you can see from above, as a typical Vite app, the UI uses env vars during compilation. However, as in production the UI runs in a Docker container, and we need a single image that can run on any environment, we need the ability to change the values in the compiled javascript / CSS code at runtime. This is not

You can test the scripts used by the containerized setup by:

```bash
cd app/ui
# this will build the ui with .env.runtime file, that contains RUNTIME_VITE_... env var place holder values
npm run build
# this uses the .env file (or the process environment from the Docker runtime when in a container) and replaces RUNTIME_VITE_... values with the actual env var values in the compiled files
node serve.js
```

To test the actual container:

```
hack/htn images ui --build
hack/htn ui start
```

This should give you an http://localhost:8080 URL for the UI.

### Checks and tests

To execute formatting/linting and tests, run:

```
check/ui
```

## PlanqTN API

API calls are meant for features that return tensor network structures and/or legos, and are relatively fast, and don't need extensively long computation to work, for which jobs are a better mechanism.

### Components

PlanqTN API consists of the `app/planqtn_api` server, and the `tensornetwork` Supabase Edge Function at the moment and no database component yet (however, we we will develop quota functionality soon, which will involve database tables).

### Development setup

After you cloned the repo, you can setup the python dependencies with:

```
pip install -r requirements.txt -r requirements.dev.txt -r app/planqtn_api/requirements.dev.txt -r app/planqtn_api/requirements.dev.txt
```

### Checks and tests

Unit tests:

```
check/api
```

Integration tests:

```
export KERNEL_ENV=<local/dev/cloud>
check/api-integration
```

See below the reference for KERNEL_ENV.

## PlanqTN Background Jobs

Jobs allow for backend computation of arbitrary complexity, as long as it can be containerized, we can run it. Weight enumerator calculation and QDistRnd execution (coming soon) are the first two examples that use Jobs. Jobs will be subject to quotas and resource constraints (execution time, CPU number and memory) on the cloud environments, but can be executed on local kernels as well that are not subject to quotas/resource constraints.

### Components

PlanqTN Jobs consists of the `app/planqtn_jobs`, which contains a job-monitor service for Cloud Run and the job execution entrypoint `main.py`, and the following Supabase edge functions:

- `planqtn_job`/`planqtn_job_run` to kick off a job locally / Cloud Run
- `cancel_job`/`cancel_job_run` to cancel a job locally / Cloud Run
- `planqtn_job_logs`/`planqtn_job_logs_run` to retrieve job logs locally / Cloud Run

In the database the `tasks` table contains the task execution results and `task_updates` contain the realtime updates from the task execution.

### Checks and tests

```
export KERNEL_ENV=<local/dev/cloud>
check/jobs-integration
```

### The `dev` workflow

This is the typical, fastest way to check that things are working, but it's heavy on local resources.

- run `hack/htn kernel start` to spin up the `dev` kernel.
- Then, to build the jobs images and load them into the k3d cluster, run `hack/htn images jobs --build --load` (this will trigger the restart of the Supabase cluster). To run without supabase restart, which is a bit slow, you can instead run `hack/htn images jobs --build --load-no-restart`, but then in order for the Edge Runtime to pick up the new image tag, you'll need to manually run `npx supabase functions serve --no-verify-jwt` from the `app` folder in the repo. This also has the benefit of showing the logs of the functions. Use `--no-verify-jwt` when the dev kernel is only for runtime context, otherwise if it's for both user/runtime contexts, then JWT verification is fine. This is because runtime context is using the user JWT to authenticate as the user in the task store when storing back the results. However, if the runtime context supabase is separate from the task store instance, then the Supabase JWT verification will fail on the runtime context, as the JWT is valid only in the User Context Supabase instance.
- After modifying `planqtn_jobs` or `qlego` or the edge function `planqtn_job`, run `export KERNEL_ENV=dev; check/jobs-integration`

### Using the `dev` kernel as a local runtime context only - relaxation of authorization

As mentioned above, if the `dev` kernel is used as a runtime context with a cloud user context, the authorization must be relaxed - as the user information is not available in this local instance, given it is in a different supabase instance. This consists of two actions:

- run edge functions with --no-verify-jwt: `npx supabase functions serve --no-verify-jwt`
- disable the Row Level Security on the `task_updates` table on the local UI (http://127.0.0.1:54323/project/default/auth/policies) - otherwise progress bars and realtime update for tasks won't work

### The `local` workflow

This is a workflow tested automatically by Github Actions, and is only required for developers to run if there is an issue with the Github Actions. These steps basically follow the relevant steps from .github/local_integration_tests.yml:

- install the `htn` tool: `hack/cli_build.sh --install`
- run `htn kernel start` to spin up the `local` kernel.
- Then, to build the jobs images and load them into the k3d cluster, run `hack/htn images jobs --build --load-no-restart --k3d-cluster local`
- After modifying `planqtn_jobs` or `qlego`, run `export KERNEL_ENV=local; check/jobs-integration`

### The `cloud` workflow

This is a workflow tested automatically by Github Actions, and is only required for developers to run if there is an issue with the Github Actions. These steps basically follow the relevant steps from .github/cloud_integration_tests.yml:

- setup `gcloud` to have you logged in, see Personal GCP setup below
- ensure that your Supabase env points to your personal Supabase project, see Personal Supabase setup below
- To build the jobs images and deploy them to Cloud Run, run `hack/htn cloud deploy`
- After modifying any of the components run `export KERNEL_ENV=cloud; check/jobs-integration`

### The `broken-hybrid-cloud` workflow with local Supabase Edge Functions + Cloud Run testing

This is a fake/broken setup but provides the fastest development feedback loop with a local Supabase function setup with hot reload against a Cloud Run backend (which won't be able to talk back to the local Supabase instance). For now this is only manually supported, assuming that you just ran `hack/htn cloud deploy` successfully.

1. Setup the UI to think that the "cloud task store" is on the localhost, by setting the content of `app/ui/.env` to:

```
VITE_TASK_STORE_URL=http://127.0.0.1:54321
VITE_TASK_STORE_ANON_KEY=<your dev kernel's anon key>
VITE_ENV=development
```

Note that this is very different from pointing your UI to your local kernel, that's only switching the Runtime Context. If you're confused, that's okay, check out the topic on Runtime Context vs User Context in [PlanqTN Studio](#planqtn-studio).

2. Setup the `supabase/functions/.env` with

```
JOBS_IMAGE=[jobs_image] # this is probably already populated - though not that important for the cloud workflow
GCP_PROJECT=[your personal gcp project]
SVC_ACCOUNT=[svc account base 64 encoded]
API_URL=[api url]
```

Use terraform to get the Cloud Run service account key:

```
cd app/gcp
$HOME/.planqtn/bin/terraform output -raw api_service_account_key | base64 --decode
```

and to get the Cloud Run PlanqTN API URL:

```
cd app/gcp
$HOME/.planqtn/bin/terraform output api_service_url
```

Then run `hack/htn kernel start` to spin up the `dev` kernel or, if you want no k3d instance running, then just
`npx supabase --workdir app start` and then `npx supabase --workdir app functions serve --no-verify-jwt` to have a hot reload setup for the functions.

You can use the `app/planqtn_fixtures/manual_testing/main.py` to get started with call manually the API / Job functions and inspect the results. You can use Google Cloud Console in parallel to inspect the kicked off jobs / API call logs.

## PlanqTN Edge Functions

Edge functions come in two flavor: one for the local kernel that manages jobs on Kubernetes, and one for the Cloud Run environment. Under [app/supabase/functions](app/supabase/functions/) you'll find each of these functions in a separate folder:

```
planqtn_job <- kicks off a job on k8s
cancel_job  <- cancels a job on k8s
planqtn_job_logs <- gets logs of a failed job on k8s

planqtn_job_run <- kicks off a job on Cloud Run
cancel_job_run  <- cancels a job on Cloud Run
planqtn_job_logs_run <- gets logs of a failed job on Cloud Run
```

The same duality is true for the API wrapper edge functions, but it's kept currently in a single function, because the only difference between a Cloud Run Service call and a local service call, is that Cloud Run needs some extra headers for authentication.
Currently we only have a single API function:

```
tensornetwork
```

And finally there is a special version function that returns the `JOB_IMAGE` env var and calls into the API endpoint for a version and returns those.

To develop with these functions, locally it is recommended to use the reload functionality. For the cloud one, recommended is to do test driven development through integration tests and auto-deploy to a cloud instance the function with something like this from the app folder:

```
find supabase -name '*.ts' | entr -r npx supabase functions deploy planqtn_job_run
```

# Reference for developer tools

## Personal cloud setup

We use GCP Cloud Run for executing workloads and the API and we use Supabase for the User context (authentication, task store, quota function, user content database) and the Runtime context (task management functions, api functions, realtime messaging database). Both Supabase references GCP (for the API/Job calls) and GCP references Supabase (to write results/task updates back to the Supabase database). Please follow the order of setup as listed below, start with Supabase, then with GCP, and finally deploy the Supabase functions/secrets.

Requirements:

- NodeJS
- Docker (Desktop)
- DockerHub identifier, where you can push images to
  - run `docker login` to ensure you're logged in

From the root of the repo we'll start with installing some necessary tools in the `node_modules` directory locally.

```
npm install --include-dev
```

- a free tier Supabase.com project and secrets (see below)
- a free tier GCP project and secrets (see below)

### 1. Personal Supabase setup for database storage, realtime messaging and authentication

1. Setup your account at https://supabase.com/
2. Create a new organization e.g. "Your Name"
3. Create a a new project e.g. "<yourname>-planqtn-dev" or similar
4. Note down the following secrets:

- note down the database password (though you can reset it from your dashboard)
- your project ref (which is in the `[project-ref].supabase.co` in the "Connect" menu point)
  <img src="fig/supabase_connect.png">
- Get the `service_role` key and `anon_key` from your personal Supabase project via Project Settings/API Keys, click Reveal for the service role key:
  <img src="fig/supabase_connect3.png">

### 2. Personal GCP setup for running workloads

1. Register for a Google Cloud Platform and start a new GCP Project https://cloud.google.com/?hl=en - you will need to add a Billing account, but don't worry, none of the developments will cost anything at our size.
2. Download `gcloud` on Linux/MacOSX, so that it can be used in the scripts: https://cloud.google.com/sdk/docs/install
3. Run `gcloud init` to create a new local gcloud configuration that points to your project, choose `us-east1` if you're unsure what to choose for your environment.
4. Run `gcloud auth login` to enable automatically gcloud to act on your behalf
5. Create the following for managing the state via terraform:

```
export MYNAME=<your-name>
gsutil mb gs://planqtn-$MYNAME-tfstate
gsutil versioning set on gs://planqtn-$MYNAME-tfstate
```

### 3. Deploy your project

```
hack/htn cloud deploy
```

This should walk you through the process automatically, and will ask you interactively for the secrets above.

During the first run, things might take a while, as APIs need to be enabled, and resources are created the first time.
Also, you might need to rerun it, we've seen this kind of failure on new project creation:

```
│ Error: Error creating service account: googleapi: Error 403: Identity and Access Management (IAM) API has not been used in project [PROJECT-NUMBER] before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/iam.googleapis.com/overview?project=[PROJECT-NUMBER] then retry. If you enabled this API recently, wait a few minutes for the action to propagate to our systems and retry.
│ Details:
```

Due to the async nature of terraform/GCP, unfortunately sometimes it thinks that it added the right roles to the service accounts, and it did, but it is not applied yet in time for the next deployment step, and then you'll see failures like this:

```
Revision 'planqtn-monitor-00001-mp8' is not ready and cannot serve traffic. spec.template.spec.containers[0].env[0].value_from.secret_key_ref.name: Permission denied on secret: projects/.../secrets/supabase_url/versions/latest for Revision service account cloud-run-execution-svc@yourproject.iam.gserviceaccount.com. The service account used must be granted the 'Secret Manager Secret Accessor' role (roles/secretmanager.secretAccessor) at the secret, project or higher level.
                    spec.template.spec.containers[0].env[1].value_from.secret_key_ref.name: Permission denied on secret: projects/.../secrets/supabase_service_key/versions/latest for Revision service account cloud-run-execution-svc@yourproject.iam.gserviceaccount.com. The service account used must be granted the 'Secret Manager Secret Accessor' role (roles/secretmanager.secretAccessor) at the secret, project or higher level.
```

Just restart again.

## Github Actions secrets for your personal integration testing environment

After your setup and deployed your project successfully ensure that the integration tests are passing:

```
export KERNEL_ENV=cloud
hack/job-integrations
hack/api-integrations
```

If everything's good, you're ready to setup Github Actions! As we need to setup a bunch of secrets and variables, we tried to make this less of a pain as well. Follow the prompts from this script:

```
hack/htn cloud setup-github-actions
```

To test that the service account was setup correctly, you can logout of gcloud by removing or moving the gcloud config dir (e.g. `rm -rf ~/.config/gcloud`) then try to deploy using it the same way we use it in Github Action:

```
GCP_SVC_CREDENTIALS=$(cat ~/.planqtn/.config/tf-deployer-svc.json | base64 -w 0) hack/htn cloud deploy -q
```

### Unlocking the terraform deployment

Sometimes, when you cancel a terraform deployment in the middle (on Github Actions as well!) it can leave a stale lock in place. For example:

```
╷
│ Error: Error acquiring the state lock
│
│ Error message: writing "gs://planqtn-staging-tfstate/stg/default.tflock"
│ failed: googleapi: Error 412: At least one of the pre-conditions you
│ specified did not hold., conditionNotMet
│ Lock Info:
│   ID:        1750351695430284
│   Path:      gs://planqtn-staging-tfstate/stg/default.tflock
│   Operation: OperationTypeApply
│   Who:       runner@fv-az1938-75
│   Version:   1.7.4
│   Created:   2025-06-19 16:48:15.335242296 +0000 UTC
│   Info:
│
│
│ Terraform acquires a state lock to protect the state from being written
│ by multiple users at the same time. Please resolve the issue above and try
│ again. For most commands, you can disable locking with the "-lock=false"
│ flag, but this is not recommended.
```

The way to unlock it is by manually:

```
hack/htn cloud unlock-terraform-state
```

(of course, if you're prudent, run it as the tf-deployer service account `GCP_SVC_CREDENTIALS=$(cat ~/.planqtn/.config/tf-deployer-svc.json | base64 -w 0)`).

## PlanqTN CLI

The CLI can be run in two modes:

- `local` mode - this is what end users will use, and what the CLI is meant to be used for in production and CI/CD environments. The tool operates in $HOME/.planqtn and has prepackaged configuration definitions for the supabase / k8s clusters. It does not need the project git repo to work. The postfix on all objects (containers, docker network, supabase instance) is `-local`.

- `dev` mode - it works solely from the git repo, and is meant to "dog food" our own CLI tool, but without the need to build the tool and install it every time things change, also allowing for fast reload of function development in supabase. The postfix on all objects (containers, docker network, supabase instance) is `-dev`. The `dev` mode also allows for image building (`images` subcommand), and deployment to the cloud environments. the `dev` mode is what's used for cloud deployment as well.

### Dev mode - using htn for development (and cloud deployment)

Simply run `hack/htn` instead of `htn`, and things should work. We wrap certain tasks into `htn` scripts that frequently happen together or need to happen together as an atomic unit, for example, spining up a local env and applying database migrations on it, or building an image and reloading it into a local env, or deploying a Cloud Run service with it.

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

## Setting up kernel environments

KERNEL_ENV is used by the integration tests (`check/jobs-integration` and `check/api-integration` scripts) to determine which kernel to use.

The options for KERNEL_ENV are:

- `local` simulates the user's local environment, assuming that there is a local kernel running and has the latest images.
- `dev` for a locally running development kernel that allows "hot reload" features from the repo directly
- `cloud` will connect to the developer's personal cloud services, including Supabase and Google Cloud Platform (GCP) project for Cloud Run.

Note that `local` and `dev` are allowed to coexist, but currently ports are the same, so only one of them can be active at a time. If you try to start both of them, then the second one will fail with error messages like this due to port collisions:

```
failed to start docker container: Error response from daemon: failed to set up container networking: driver failed programming external connectivity on endpoint supabase_db_planqtn-dev (fbececa5f29188d872ba3d0b1db86ddc18703ad3e09f741743ba8a0d0938a306): Bind for 0.0.0.0:54322 failed: port is already allocated
```

### Setting up `local` kernel

First, build & install `htn` globally:

```
hack/cli_build.sh --install
```

Then use it:

```
htn kernel start
```

Warning, this needs roughly 10GB disk space and 5GB RAM for the Docker runtimes.

### Setting up `dev` kernel

Simply run:

```
hack/htn kernel start
```

Warning, this needs roughly 10GB disk space and 5GB RAM for the Docker runtimes.

Now, locally, this will start a Supabase instance. If you want to use this only as a Runtime context, then you have nothing else to do, except be aware of JWT verification (see [dev workflow](#the-dev-workflow) for jobs). If you want to use this instance as a User context, then you might want to look at [your local Supabase dashboard](http://127.0.0.1:54323/project/default) to setup other authentication methods than the default email based, adding test users, etc.

### Setting up `cloud` kernel

See above for personal cloud setup.

## Database migrations

Modifying the Supabase database is exclusively done through the `app/migrations` folder, we are using `node-pg-migrate`, because it's lightweight, much faster than Supabase's own migration feature and supports down/redo of migrations, which is very useful during development and for production rollbacks.

To setup for using `node-pg-migrate` with your personal cloud supabase, ensure that in `app/.env` you have

```
DATABASE_URL=postgresql://postgres.[YOUR-SUPABASE-PROJECT-ref]:[YOUR-PASSWORD]@aws-0-us-east-2.pooler.supabase.com:6543/postgres
```

for local dev use

```
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

And now you can use from the `app` directory:

```
npx node-pg-migrate up
```

or other commands. Please refer to the [node-pg-migrate docs](https://salsita.github.io/node-pg-migrate/getting-started) for getting started with migrations, and always create a rollback script for your migrations!

# Reference for `.env` files

It is a bit crazy how many `.env` files are in this project due to all the small tools. Here's a description of each of them.

- `app/supabase/functions/.env` - Supabase Edge Function configuration for local and dev look at `app/supabase/functions/.env.local/dev`, for cloud `app/supabase/functions/.env.cloud` templates for documentation on the variables.
- `app/ui/.env` - UI configuration. See [Web UI features](#web-ui-features) for instructions.
- `app/planqtn_api/.env` - API config, only needs an `API_IMAGE` to report its own version. We might remove this.
- `app/planqtn_jobs/.env` - just kidding - no env file here, however `RUNTIME_SUPABASE_URL` and `RUNTIME_SERVICE_KEY` are passed by the K8s job edge function and they are setup as secrets for the Cloud Run version.
