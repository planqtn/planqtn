# PlanqTN CLI

A command-line interface tool for PlanqTN, to control a local kernel for [PlanqTN Tensor Studio](https://planqtn.com).
See all the details at the [PlanqTN Github repo](https://github.com/planqtn/planqtn).

## Installation

```bash
npm install -g planqtn-cli
```

Or use it directly with npx:

```bash
npx planqtn-cli <command>
```

## Usage

To spin up a new local kernel

```
htn kernel start
```

To get the details of the connection run:

```
htn kernel status
```

Then you should see something like this:

```
Supabase: Running
k3d cluster: Running
k8sproxy: Running
API service: Running
{
   "API_URL": https://localhost:54321,
   "ANON_KEY": ...
}
```

copy the JSON, and paste it in the planqtn UI to use your local runtime with no restrictions!

## License

Copyright 2025 Balint Pato

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
