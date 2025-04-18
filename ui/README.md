# Tensor Network Quantum Error Correction UI

A modern, interactive web interface for designing and analyzing quantum error correction codes using tensor networks.

## Features

- **Interactive Canvas**: Drag-and-drop interface for placing and connecting quantum error correction components (legos)
- **Component Library**: Pre-built collection of tensor network components with detailed properties
- **Network Analysis**: Real-time calculation of parity check matrices for connected components
- **Advanced Selection Tools**:
  - Single-click selection for individual legos
  - Box selection for multiple components
  - Network selection for connected components
- **Smart Connections**: 
  - Visual connection system with numbered legs
  - Intuitive drag-and-drop connection creation
  - Double-click to remove connections
- **Multi-Selection Operations**:
  - Group movement of selected components
  - Bulk deletion
  - Network-aware operations
- **History Management**:
  - Undo/Redo support (Ctrl+Z, Ctrl+Y)
  - State preservation in URL for sharing
- **Visual Feedback**:
  - Hover effects for interactive elements
  - Visual indicators for selection state
  - Clear feedback for canvas boundaries
- **Example Library**: Pre-built examples including:
  - Surface code from [[5,1,2]] legos
  - Bacon-Shor code
  - Steane code from [[6,0,2]] legos

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd ui
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Start the development server:
   ```bash
   npm start
   # or
   yarn start
   ```

## Usage

### Basic Operations

1. **Adding Components**:
   - Drag components from the left panel onto the canvas
   - Shift+drag to create copies of existing components

2. **Making Connections**:
   - Drag from one leg to another to create connections
   - Numbers indicate leg indices
   - Double-click connections to remove them

3. **Selection**:
   - Click to select individual components
   - Click and drag on canvas to create selection box
   - Click selected component again to select its network

4. **Movement**:
   - Drag components to move them
   - Selected groups move together   

5. **Analysis**:
   - Select a connected network to view its properties
   - Calculate parity check matrix for selected networks
   - Export configurations to Python code

### Keyboard Shortcuts

- `Ctrl+Z`: Undo last action
- `Ctrl+Y` or `Ctrl+Shift+Z`: Redo last action
- `Delete`: Remove selected components
- `Shift` (while dragging): Create copy of component

## Development

The UI is built with:
- React for component management
- Chakra UI for styling and components
- TypeScript for type safety
- Axios for API communication

### Project Structure

```
ui/
├── src/
│   ├── App.tsx        # Main application component
│   ├── components/    # Reusable components
│   ├── types/        # TypeScript type definitions
│   └── utils/        # Utility functions
├── public/           # Static assets
└── package.json      # Project dependencies
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request


# Future ideas / backlog


User stories: 
- As a code designer I want to play around with legos, put them together and see the resulting code. I want to see whether I created an LDPC code, or not. What are the logical operators? 


 - The parity check matrix display should become "Stabilizers display" 
    - option to switch between stabilizers and symplectic view - DONE 
    - in both views one can drag a stabilizer onto another one and thus create a new generate from the product - DONE 
    - option to do Gauss elimination on given columns 
    - all of this with undos within a session, then the stabilizers are saved to the given component - DONE (for TN )
    - allow for the above on a lego piece
    - we need a way to name logical and gauge operators (X1, X2, ...) - WON'T DO 
    - marking a leg as a gauge, logical, or physical degree of freedom - do we need gauge?! 
    - conjoined matrices should have info about the original lego pieces - DONE 
    - auto-sparsification of generators ???
- operator flow 
    - we fix with an operator highlight X (blue) or Z (red) on a leg or multiple legs DONE
        - we see the number of stabilizers that match the fix, and we can iterate through the highlights DONE 
- option to merge tensornetworks into a full lego piece - DONE 
- unfuse
  - ZX spiders - DONE 
  - arbitrary lego to Tanner - DONE via copy-paste of parity check matrix 
  - arbitrary lego to measurement circuit  - DONE via copy-paste of parity check matrix 


- load a TensorNetwork instance in the UI 
    - we could have placement hints in the Tensornetwork (similar to qubit annotations in Stim) - DONE (annotations)
    - we could have an automated graph layout algorithms ?? instead graphical language story below 
- retrieve, evaluate, and visualize contraction schedules     
- lego display customization 
    - 422, 512, 602 tensors - DONE for ZX spiders 
- WEPs 
    - display the polynomial in different formats 
    - bar chart 
    - calculate normalizer enumerator (MacWilliams transform)
- lego database 
    - clicking on a lego type should display it's properties (WEP, stabilizer check)
    - stoppers - DONE 
    - searchable IBM database 
- UI features 
    - resizable, scrollable canvas DONE 
- handled disconnected networks too - this is good for educational purposes - DONE 

I want to put together the new compass code construction with Charles's construction and see the weight enumerators - DONE  


# Big stories

## A QEC database for the community 
- a local database for caching tensornetwork weight enumerators / parity check matrices 
- a global database and automated Github authenticated contribution workflow


## User authentication 

Mostly required to limit unwanted DB requests 

-  unauthenticated (local-only) mode - only lego drops + manual flow tracking 

## Job management 
- 

- support different platforms 
   - run a job on a single server node (MPI?)
   - run slurm jobs 
   - run k8s jobs 

## Graphical contraction schedule analysis 

- see the actual contraction visually on tensornetworks, with a "trace slider" for analysis 
   - show the sparsity, size, order of intermediate tensor(s) 

## Transformation automations 

- derivation rules applied in bulk (similar to how zxlive does it)
- 

## qLego Qonstruct: A graphical language 

A visual language to create parameterized tensornetworks. 

- concatenate - specify a Set of legos and the new layer - could be multiple 
- tiling - given a lattice, place a lego to each coordinate - the user can define a function that maps a coordinate to a lego
   - support different Euclidean (6.6.6, 4.4.4.4, 4.8.12, 4.8.8, aperiodic ones, etc.) and hyperbolic lattices 
- connect 
- product codes 
   - algebraic codes 

## Hybrid enumerator support 

- mix A and B type enumerators in nodes 

## v0.1 WEP lib optimization goals 


## v0.1 UI optimization goals 

A 17x17 rotated surface code should be managable by the UI, this translates to 
- 289 dangling legs for parity check matrix 
- 
    
## Cosets 

Setup cosets and calculate enumerators for them 
- UI: ability to mark a lego with a coset 

## Research ideas 
- logical representative finding - can we get an advantage there over brute force? 
- if we can generalize the [[4,2,2]] code to arbitrary arity local tensors for qLDPC codes, what codes would come out of Penrose tilings? 
- how much reuse is possible for coset enumerator calculations given a trivial enumerator? when calculating cosets in bulk, is there are possibility of reusing intermediate results? 
- 


## License

This project is licensed under the MIT License - see the LICENSE file for details.
