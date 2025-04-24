# Quantum Lego (temporary name)


We are before the v0.1 public release, which is scheduled around mid July 2025. Checkout the issues for the [milestone](https://github.com/balopat/tnqec/issues?q=is%3Aissue%20state%3Aopen%20milestone%3A%22v0.1%20-%20first%20public%20release%22).  


The project has two main components currently in the same repo: 

1. qlego python library for weight enumerators, under the [qlego](./qlego) folder
2. the qlego nodejs UI in the [ui](./ui) folder + python API server [server](./server) folder

You are seeing an early preview, there are a lot of breaking changes expected in the library and the app as well, including major design changes. Exciting times! 


# Installation instructions for the UI 

Open a Linux terminal. On Windows, use WSL2. On Mac a regular terminal will be okay. I haven't tested the tools on an actual Linux Desktop instance yet, but I see no reason why it wouldn't work. 

1. The tool requires the latest version of [NodeJS](https://nodejs.org/en) and Python 3.10+. Make sure they are available. 
2. Clone the repo (please use git, so that you can be up to date with the rapidly evolving changes)
3. Run the interactive setup script, this will create a Python virtualenv and install python and nodejs dependencies 
```
./setup.sh
```
4. Run the start script. For faster, prod-like performance use: 
```
./start.sh 
```

## Port clashing

The default ports for the backend server is 5005 and 5173 for the UI. If you have any clashes, you can change both of the two ports with `--backend-port` and `--frontend-port`, for example

```
./start.sh --backend-port 8080 --frontend-port 8081
```

## Development instructions


There is no continuous integration yet (follow issue #33 for that), until that is done, I can't really take contributions. However, if you want to try things out, or prepare for the day when contributions are welcome, here are some instructions: 


For development, please `pip install -r requirements.dev.txt` and use `./start_dev.sh`. For convenience you can use `hack/rerun ./start_dev.sh` which allows for hot-reload of the UI changes and watches python files as well (using [entr](https://github.com/eradman/entr), so you'll need to install that). 



# Install instructions for qlego library only

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

wep = tn.stabilizer_enumerator_polynomial(progress_bar=True, verbose=False)
print(wep)
```