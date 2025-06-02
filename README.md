[![Unitary Foundation](https://img.shields.io/badge/Supported%20By-UNITARY%20FOUNDATION-brightgreen.svg?style=for-the-badge)](https://unitary.foundation)

<p align="center">
<img src="https://github.com/user-attachments/assets/486609eb-1180-4a2b-a605-588cd1d5a2e4" width="300"></img>
</p>


Welcome to the PlanqTN! We are before the v0.1 public release, which is scheduled around mid-July 2025. Check out the issues for the [milestone](https://github.com/balopat/tnqec/issues?q=is%3Aissue%20state%3Aopen%20milestone%3A%22v0.1%20-%20first%20public%20release%22).  


The project has two main components currently in the same repo: 

1. qlego Python library for weight enumerators, under the [qlego](./qlego) folder
2. the qlego nodejs UI in the [ui](./ui) folder + python API server [server](./server) folder

You are seeing an early preview; there are many breaking changes expected in the library and the app, including significant design changes. Exciting times! 


# Running the UI locally 

Only Docker is supported for regular users. If you want to deal with installing all the bells and whistles or just don't like containers, see the Development section for setup instructions. 

1. Install Docker (Desktop) or podman 
2. Run ./docker_build_and_run.sh 

Then, open http://localhost:5173 in your browser, and you should see a screen similar as below:


![image](https://github.com/user-attachments/assets/5e4cacdf-b062-4c75-9f38-e67c6b790314)



# Development instructions


## Installation instructions for the UI development 

Open a Linux terminal. On Windows, use WSL2. On a Mac, a regular terminal will be okay. I haven't tested the tools on an actual Linux Desktop instance yet, but I see no reason why it wouldn't work. 

1. The tool requires the latest version of [NodeJS](https://nodejs.org/en) and Python 3.10+. Make sure they are available. 
2. Please ensure redis-server is installed and running on the standard port (check with `redis-client ping` - should respond with `PONG`)
3. Clone the repo (please use git, so that you can be up to date with the rapidly evolving changes)
4. Run the interactive setup script, which will create a Python virtualenv and install Python and Node.js dependencies 
```
./setup.sh
```
4. Run the start script. 
```
./start.sh 
```

At this point, after starting the Python server and building the UI, you should see the logs from both servers: 

```
Press Ctrl+C to stop all servers
[Server] INFO:     Started server process [2878247]
[Server] INFO:     Waiting for application startup.
[Server] INFO:     Application startup complete.
[Server] INFO:     Uvicorn running on http://0.0.0.0:5005 (Press CTRL+C to quit)
[UI] 
[UI] > tnqec-ui@0.1.0 preview
[UI] > vite preview --port 5173
[UI] 
[UI]   ➜  Local:   http://localhost:5173/
[UI]   ➜  Network: http://10.255.255.254:5173/
[UI]   ➜  Network: http://172.18.132.212:5173/
```



The `./force_stop.sh` script helps to cleanup processes if things are still running after shutdown. 


### Port clashing

The default ports for the backend server are 5005 and 5173 for the UI. If you have any clashes, you can change both ports with `--backend-port` and `--frontend-port`. For example:

```
./start.sh --backend-port 8080 --frontend-port 8081
```


For development, please `pip install -r requirements.dev.txt` and use `./start.sh --dev`. For convenience you can use `hack/rerun ./start.sh --dev` which allows for hot-reload of the UI changes and watches python files as well (using [entr](https://github.com/eradman/entr), so you'll need to install that). 




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
