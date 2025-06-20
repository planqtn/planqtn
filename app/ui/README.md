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
