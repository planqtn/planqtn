[![Unitary Foundation](https://img.shields.io/badge/Supported%20By-UNITARY%20FOUNDATION-brightgreen.svg?style=for-the-badge)](https://unitary.foundation)

<p align="center">
<img src="https://github.com/user-attachments/assets/486609eb-1180-4a2b-a605-588cd1d5a2e4" width="300"></img>
</p>

Welcome to the PlanqTN! We are before the v0.1 public release, which is scheduled around mid-July 2025. Check out the issues for the [milestone](https://github.com/balopat/tnqec/issues?q=is%3Aissue%20state%3Aopen%20milestone%3A%22v0.1%20-%20first%20public%20release%22).

The project has two main components currently in the same repo:

1. qlego Python library for weight enumerators, under the [qlego](./qlego) folder
2. the PlanqTN app
   1. UI under [ui](./ui)
   2. Cloud based or local kernel
      - API server Docker image in [planqtn_api](./planqtn_api) with example implementations for parameterized tensonetworks
      - Jobs Docker image in [planqtn_jobs](./planqtn_jobs) for job execution (currently only weight enumerator jobs)
      - Supabase edge functions in the [supabase](./supabase/) folder
   3. The planqtn CLI in [planqtn_cli](./planqtn-cli) to manage local kernels

!WARNING!

You are seeing an early preview; there are many breaking changes expected in the library and the app, including significant design changes. Exciting times!

# PlanqTN cloud

Navigate to https://planqtn.com and start playing with the legos! Even without registering/authenticating, you can achieve a lot. After authenticating, you can run a certain amount of weight enumerator calculations and/or API calls for more complicated tensor network creations. This is completely free, supported by the Unitary Foundation.

... TODO ... a tutorial will be linked here

# Local setup

For a local setup, you will need to install our CLI tool:

1. Ensure you have npm installed and Docker installed on your machine.
2. Run

```
npm install -g planqtn_cli
```

You can use `planqtn` or `htn` for short (as h is the Planck constant) to call the CLI tool.

```
htn --help
```

## Cloud UI with local kernel

If you need to go beyond the limits of the cloud based execution, then you can use a local kernel to execute expensive weight enumerator job calculations, still connected to the official UI, and your results will be stored in the PlanqTN database under your profile.

Run `htn kernel up` to start the kernel. The first time can take a couple of minutes as it will setup a k3d cluster and a local instance of supabase within your Docker engine. To stop everything, use `htn stop`. To remove all images and data, use `htn uninstall`.

## Running the UI locally

If you want to run the UI locally, use `htn ui up`.

Then, open http://localhost:5173 in your browser, and you should see a screen similar as below:

![image](https://github.com/user-attachments/assets/5e4cacdf-b062-4c75-9f38-e67c6b790314)

# Install instructions for the qlego library only

Quick start:

1. Create a virtualenv
2. Install qlego

```
pip install -e .
```

3. Try it:

```python
from galois import GF2

from qlego.codes.compass_code import CompassCodeTN
from qlego.codes.css_tanner_code import CssTannerCodeTN
from qlego.progress_reporter import TqdmProgressReporter

hz = GF2(
    [
        [1, 1, 0, 1, 1, 0, 1, 1, 0],
        [0, 1, 1, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 1, 0, 1, 1],
    ]
)

hx = GF2(
    [
        [1, 0, 0, 1, 0, 0, 0, 0, 0],
        [0, 1, 1, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 1, 0, 0],
        [0, 0, 0, 0, 1, 0, 0, 1, 0],
        [0, 0, 0, 0, 0, 1, 0, 0, 1],
    ]
)

tn = CssTannerCodeTN(hx, hz)

wep = tn.stabilizer_enumerator_polynomial(progress_reporter=TqdmProgressReporter(), verbose=False)
print(wep)
```
