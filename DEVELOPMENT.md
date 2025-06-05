# Architecture

<p align="center">
<img src="fig/architecture.png" width="100%"></img>
</p>

PlanqTN features largely live in the user's browser. However, for background jobs and more complicated tensornetwork/lego database we offer the PlanqTN Jobs and the PlaqnTN API features.

# Setup

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

## Web UI features

A large set of the features are only in the UI, which doesn't need any backend infrastructure. The PlanqTN UI is based on Vite/ReactJS and is served using Vercel.

### Components

Source code is contained within the `app/ui` folder. Vercel setup is in `vercel.json`.

### Development setup

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

## PlanqTN API

API calls are meant for features that return tensor network structures and/or legos, and are relatively fast, and don't need extensively long computation to work, for which jobs are a better mechanism.

### Components

PlanqTN API consists of the `app/planqtn_api` server, and the `tensornetwork` Supabase Edge Function at the moment and no database component yet (however, we we will develop quota functionality soon, which will involve database tables).

### Development setup

After you cloned the repo, you can setup the python dependencies with:

```
pip install -r requirements.txt -r requirements.dev.txt -r app/planqtn_api/requirements.dev.txt -r app/planqtn_api/requirements.dev.txt
```

To

### Checks and tests

Unit tests:

```
check/api
```

Integration tests:

```
export KERNEL_ENV=<local/dev/personal-cloud>
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
export KERNEL_ENV=<local/dev/personal-cloud>
check/jobs-integration
```

### The `dev` workflow

This is the typical, fastest way to check that things are working, but it's heavy on local resources.

- run `hack/htn kernel start` to spin up the `dev` kernel.
- Then, to build the jobs images and load them into the k3d cluster, run `hack/htn images jobs --build --load` (this will trigger the restart of the Supabase cluster). To run without supabase restart, which is a bit slow, you can instead run `hack/htn images jobs --build --load-no-restart`, but then in order for the Edge Runtime to pick up the new image tag, you'll need to manually run `npx supabase functions serve` from the `app` folder in the repo. This also has the benefit of showing the logs of the functions.
- After modifying `planqtn_jobs` or `qlego` or the edge function `planqtn_job`, run `export KERNEL_ENV=dev; check/jobs-integration`

### The `local` workflow

This is a workflow tested automatically by Github Actions, and is only required for developers to run if there is an issue with the Github Actions. These steps basically follow the relevant steps from .github/integration_tests.yml:

- install the `htn` tool: `hack/cli_build.sh --install`
- run `htn kernel start` to spin up the `local` kernel.
- Then, to build the jobs images and load them into the k3d cluster, run `hack/htn images jobs --build --load-no-restart --k3d-cluster local`
- After modifying `planqtn_jobs` or `qlego`, run `export KERNEL_ENV=local; check/jobs-integration`

### The `personal-cloud` workflow

This is a workflow tested automatically by Github Actions, and is only required for developers to run if there is an issue with the Github Actions. These steps basically follow the relevant steps from .github/integration_tests.yml:

- setup `gcloud` to point your GCP project, see Personal GCP setup below
- ensure that your Supabase env points to your personal Supabase project, see Personal Supabase setup below
- To build the jobs images and deploy them to Cloud Run, run `hack/htn images jobs --build --deploy`
- After modifying any of the components run `export KERNEL_ENV=local; check/jobs-integration`

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

### 1. Configuration secrets

Configuration secrets, like DB passwords for your Supabase, or service accounts will be kept inside your home folder, within `$HOME/.planqtn/.config`. Note that `htn remove` will remove these secrets as well, so if you run it, you'll have to recreate them manually again.

To get started, `cp -r app/.config.example $HOME/.planqtn/.config`.

### 2. Setup docker repo for images

1. In `$HOME/.planqtn/.config/docker-repo`, replace `[YOUR-DOCKER-REPO]`:

```
[YOUR-DOCKER-REPO]
```

2. Build & push the Jobs and API images

```
hack/htn images job --build --push
hack/htn images api --build --push
```

You can verify that the right files are updated with the new image tag information.

For the jobs image use:

```
cat app/supabase/functions/.env | grep JOBS
```

The `app/supabase/functions/.env` file is used to determine the secrets for the local environment, but we'll also use it to deploy the jobs Clooud Run job and the job-monitor Cloud Run service.

For the API image use:

```
cat app/planqtn_api/.env | grep API
```

The `~/.planqtn/planqtn_api/.env` file is used by the deployment command later to Cloud Run as well as the local kernel implementation uses it to determine which image to run when spinning up the API server.

### 3. Personal Supabase setup

1. Setup your account at https://supabase.com/
2. Create a new organization e.g. "Your Name"
3. Create a a new project e.g. "<yourname>-planqtn-dev" or similar - remember, note down the database password, then in `$HOME/.planqtn/.config/db.json `, update the "db" connection string by replacing `[YOUR-SUPABASE-PROJECT-ID]` and `[YOUR-PASSWORD]` - the simplest way to add it from your Supabase dashboard "Connect" feature, most importantly **use the Transaction Pooler** connection string, not the direct one (we need IPv4 compatible URL for our migration tool):

```env
DATABASE_URL='postgresql://postgres.[YOUR-SUPABASE-PROJECT-ID]:[YOUR-PASSWORD]@aws-0-us-east-2.pooler.supabase.com:6543/postgres'

```

<img src="fig/supabase_connect.png">
<img src="fig/supabase_connect2.png">

4. Run migrations to test it, and to get your database schema initialized.

```
npx node-pg-migrate up --envPath=$HOME/.planqtn/.config/supa.db.env -m app/migrations
```

You should see something like this:

```
...
initialization SQL
...
Migrations complete!
```

5. In order to deploy functions to your supabase instance, we'll need to link it, so run the following command and follow the instructions to login and pick your project:

```
npx supabase --workdir app link
```

And now we can deploy the functions:

```
npx supabase --workdir app functions deploy
```

6. We'll setup secrets now for GCP to be able to connect to Supabase. Get the `service_role` key from your personal Supabase project via Project Settings/API Keys, Reveal and add it into `$HOME/.planqtn/.config/gcp_secret_data_svc_key`, replace `[YOUR-SUPABASE-SERVICE-ROLE-KEY]` with your key:

<img src="fig/supabase_connect3.png">

7. Add your Supabase url to the `$HOME/.planqtn/.config/gcp_secret_data_api_url`, replace `[YOUR_SUPABASE_PROJECT_ID]` with your project id:

```
https://[YOUR_SUPABASE_PROJECT_ID].supabase.co
```

### 4. Personal GCP setup

1. Register for a Google Cloud Platform and start a new GCP Project https://cloud.google.com/?hl=en - you will need to add a Billing account, but don't worry, none of the developments will cost anything at our size.
2. Download `gcloud` on Linux/MacOSX, so that it can be used in the scripts: https://cloud.google.com/sdk/docs/install
3. Run `gcloud init` to create a new local gcloud configuration that points to your project, choose `us-east1` if you're unsure what to choose for your environment.
4. Run `gcloud auth login` to enable automatically gcloud to act on your behalf
5. Enable the required APIs:

```
gcloud services enable pubsub.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable logging.googleapis.com
gcloud services enable eventarc.googleapis.com
```

6. Setup the Supabase connection secrets in the Secret Manager

```
 gcloud secrets create dev_svc_key_supa
 gcloud secrets versions add dev_svc_key_supa --data-file=$HOME/.planqtn/.config/gcp_secret_data_svc_key
 gcloud secrets create dev_url_supa
 gcloud secrets versions add dev_url_supa --data-file=$HOME/.planqtn/.config/gcp_secret_data_api_url
```

7. Give the default compute service account to have access to run the Jobs and Services and have access to the secrets:

First let's store the project id:

```
GCP_PROJECT=$(gcloud config get-value project)
echo $GCP_PROJECT
```

Ensure it's the right one.

Then, get the email of the default service account. If this is a new project you should only see a single email here in the form of `<project-number>-compute@developer.gserviceaccount.com`

```
gcloud iam service-accounts list --format="get(email)"
```

Now, with this `[SVC-ACCOUNT-EMAIL]`, run the following:

```
 gcloud projects add-iam-policy-binding $GCP_PROJECT  --role=roles/secretmanager.secretAccessor --member="serviceAccount:[SVC-ACCOUNT-EMAIL]"
```

8. Deploy the Cloud Run job definition for the PlanqTN Jobs

Store the `JOBS_IMAGE` env variable and verify that the output is the image you built.

```
export `cat app/supabase/functions/.env | grep JOBS`
echo $JOBS_IMAGE
```

Then deploy the PlanqTN Cloud Run job definition:

```
gcloud run jobs deploy planqtn-jobs --image $JOBS_IMAGE   --set-secrets SUPABASE_URL=dev_url_supa:latest --set-secrets SUPABASE_KEY=dev_svc_key_supa:latest
```

You should see

```
Deploying container to Cloud Run job [planqtn-jobs] in project [<your-project>] region [us-east1]
✓ Updating job... Done.
Done.
Job [planqtn-jobs] has successfully been deployed.

To execute this job, use:
gcloud run jobs execute planqtn-jobs
```

9. Deploy the Cloud Run job-monitor for the PlanqTN jobs

Store the `JOBS_IMAGE` env variable and verify that the output is the image you built.

```
export `cat app/supabase/functions/.env | grep JOBS`
echo $JOBS_IMAGE
```

Then deploy the PlanqTN Cloud Run `job-monitor` service definition:

```
gcloud run deploy planqtn-monitor --image $JOBS_IMAGE  --set-secrets SUPABASE_URL=dev_url_supa:latest --set-secrets SUPABASE_KEY=dev_svc_key_supa:latest --args /app/planqtn_jobs/cloud_run_monitor_service.py --no-allow-unauthenticated
```

You should see

```
Deploying container to Cloud Run service [planqtn-monitor] in project [your-project-id] region [us-east1]
⠶ Deploying new service...
  ⠶ Creating Revision...
  . Routing traffic...
```

then eventually...

```
Deploying container to Cloud Run service [planqtn-monitor] in project [<your-project-id>] region [us-east1]
✓ Deploying new service... Done.
  ✓ Creating Revision...
  ✓ Routing traffic...
Done.
Service [planqtn-monitor] revision [planqtn-monitor-00001-pbl] has been deployed and is serving 100 percent of traffic.
Service URL: https://planqtn-monitor-<your-project-number>.us-east1.run.app
```

Now we'll setup the Cloud Run job failures reported through logs to the planqtn-monitor service. This needs a new PubSub topic:

```
gcloud pubsub topics create planqtn-jobs
```

Then we create a sink for the job failure logs to the topic:

```
gcloud logging sinks create planqtn-job-monitor pubsub.googleapis.com/projects/planqtn-dev/topics/planqtn-jobs --log-filter='protoPayload.methodName="Jobs.RunJob" AND NOT "has completed successfully"'
```

And finally we setup the trigger for the job-monitor service:

```
gcloud eventarc triggers create planqtn-failed-job-trigger --event-filters="type=google.cloud.pubsub.topic.v1.messagePublished" --destination-run-service=planqtn-monitor --transport-topic planqtn-jobs --location us-east1
```

10. Deploy the API server

Store and verify that your `API_IMAGE` env variable contains the API image you built:

```
export `cat app/planqtn_api/.env | grep API`
echo $API_IMAGE
```

Then deploy the service:

```
gcloud run deploy planqtn-api --image $API_IMAGE --no-allow-unauthenticated
```

You should see at the end:

```
Deploying container to Cloud Run service [planqtn-api] in project [<your-project-id>] region [us-east1]
✓ Deploying new service... Done.
  ✓ Creating Revision...
  ✓ Routing traffic...
Done.
Service [planqtn-api] revision [planqtn-api-00001-srp] has been deployed and is serving 100 percent of traffic.
Service URL: https://planqtn-api-<your-project-number>.us-east1.run.app
```

Take note of the service URL, and replace `[YOUR-CLOUD-RUN-API-SERVICE.run.app]` in the following command, to store it in `$HOME/.planqtn/.config/supa.functions.env`:

```
echo API_URL=[YOUR-CLOUD-RUN-API-SERVICE.run.app] >> $HOME/.planqtn/.config/supa.functions.env
```

11. Create the service account for the functions to call the API with

```
gcloud iam service-accounts create dev-api-svc
```

Get the full email address:

```
gcloud iam service-accounts list --format="get(email)" | grep dev-api
```

And add replace `[dev-api-svc@YOUR-PROJECT-ID.iam.gserviceaccount.com]` with the full email address in this command to add the Cloud Run Invoker role:

```
gcloud projects add-iam-policy-binding $GCP_PROJECT  --role=roles/run.invoker --member=serviceAccount:[dev-api-svc@YOUR-PROJECT-ID.iam.gserviceaccount.com]
```

Then download a JSON key for this (again, replace `[dev-api-svc@YOUR-PROJECT-ID.iam.gserviceaccount.com]`):

```
gcloud iam service-accounts keys create ~/.planqtn/.config/svc.json --iam-account=[dev-api-svc@YOUR-PROJECT-ID.iam.gserviceaccount.com]
```

Finally let's add this key as a base64 encoded secret into the config file for functions:

```
echo >> ~/.planqtn/.config/supa.functions.env
echo -n "SVC_ACCOUNT=" >> ~/.planqtn/.config/supa.functions.env
cat ~/.planqtn/.config/svc.json | base64 -w 0 >> ~/.planqtn/.config/supa.functions.env
echo >> ~/.planqtn/.config/supa.functions.env
```

Well done, the your GCP project is setup!!

### 5. Deploy Supabase secrets

As a final step, let's deploy the Supabase secrets

```
supabase secrets set --env-file $HOME/.planqtn/.config/
```

## Github Actions setup for your personal preview environment

TODO

## PlanqTN CLI

The CLI can be run in two modes:

- `local` mode - this is what end users will use, and what the CLI is meant to be used for in production and CI/CD environments. The tool operates in $HOME/.planqtn and has prepackaged configuration definitions for the supabase / k8s clusters. It does not need the project git repo to work. The postfix on all objects (containers, docker network, supabase instance) is `-local`.

- `dev` mode - it works solely from the git repo, and is meant to "dog food" our own CLI tool, but without the need to build the tool and install it every time things change, also allowing for fast reload of function development in supabase. The postfix on all objects (containers, docker network, supabase instance) is `-dev`. The `dev` mode also allows for image building (`images` subcommand), and deployment to the cloud environments.

### Dev mode - using htn for development

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
- `personal-cloud` will connect to the developer's personal cloud services, including Supabase and Google Cloud Platform (GCP) project for Cloud Run.

Note that `local` and `dev` are allowed to coexist, but currently ports are the same, so only one of them can be active at a time.

### Setting up `local` kernel

First, build & install `htn` globally:

```
hack/cli_build.sh --install
```

Then use it:

```
htn kernel start
```

Warning, this needs roughly $HOME40-50GB disk space and $HOME5-15GB RAM for the Docker runtimes.

### Setting up `dev` kernel

Simply run:

```
hack/htn kernel start
```

Warning, this needs roughly $HOME40-50GB disk space and $HOME5-15GB RAM for the Docker runtimes.

### Setting up `personal-cloud` kernel

```
hack/htn kernel start
```

## Database migrations

TODO: this will be filled out after merging the first version of supabase to main and testing on the first change.
