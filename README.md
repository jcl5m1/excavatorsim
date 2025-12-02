# Excavator Simulator

A 3D excavator simulator built with Three.js and TypeScript, featuring realistic physics and USB gamepad support.

![Excavator Simulator](https://img.shields.io/badge/threejs-v0.159-blue) ![TypeScript](https://img.shields.io/badge/typescript-v5.3-blue) ![License](https://img.shields.io/badge/license-MIT-green)

## Features

- 🎮 **USB Gamepad Support** - Full gamepad control support with standard button mapping
- ⌨️ **Keyboard Controls** - Alternative keyboard controls for accessibility
- 🏗️ **Realistic Physics** - Physics simulation powered by Cannon.js
- 🎨 **3D Graphics** - Rendered with Three.js with shadows and lighting effects
- 📊 **Real-time Telemetry** - Live display of joint angles, blade position, and tread forces
- 🎯 **Articulated Arm** - Multi-segment arm with bucket and thumb gripper
- 🚜 **Tank-style Movement** - Independent left/right tread controls for precise maneuvering

## Installation

1. Clone the repository:
```bash
git clone git@github.com:jcl5m1/excavatorsim.git
cd excavatorsim
```

2. Install dependencies:
```bash
npm install
```

## Running the Project

### Development Mode
```bash
npm run dev
```
This starts the Vite development server. Open your browser to the URL shown in the console (typically http://localhost:5173).

### Build for Production
```bash
npm run build
```
The compiled output will be in the `dist/` directory.

### Preview Production Build
```bash
npm run preview
```

## Controls

### Gamepad Controls
| Control | Function |
|---------|----------|
| **Left Joystick (WASD)** | |
| - X-axis (A/D) | Body yaw rotation |
| - Y-axis (W/S) | 2nd arm joint angle |
| **Right Joystick (Arrows)** | |
| - Y-axis (↑/↓) | 1st arm segment angle |
| - X-axis (←/→) | Bucket angle |
| **Left Trigger (Z)** | Left tread forward |
| **Left Shoulder (X)** | Left tread backward |
| **Right Trigger (/)** | Right tread forward |
| **Right Shoulder (.)** | Right tread backward |
| **D-pad Up (R)** | Thumb open |
| **D-pad Down (F)** | Thumb close |
| **Y Button (T)** | Front blade raise |
| **A Button (G)** | Front blade lower |

### Keyboard Controls
Keyboard keys shown in parentheses above can be used as an alternative to gamepad controls.

### Mouse Controls
- **Click + Drag** - Orbit camera around excavator
- **Scroll Wheel** - Zoom in/out

## Project Structure

```
excavatorsim/
├── src/
│   ├── main.ts              # Main application and scene setup
│   ├── Excavator.ts         # Excavator 3D model and physics
│   ├── GamepadController.ts # USB gamepad input handling
│   └── KeyboardController.ts# Keyboard input handling
├── index.html               # HTML entry point with UI panels
├── package.json             # Project dependencies and scripts
├── tsconfig.json            # TypeScript configuration
└── README.md                # This file
```

## Technologies Used

- **[Three.js](https://threejs.org/)** (v0.159.0) - 3D graphics rendering
- **[Cannon.js](https://github.com/pmndrs/cannon-es)** (v0.20.0) - Physics engine
- **[TypeScript](https://www.typescriptlang.org/)** (v5.3) - Type-safe JavaScript
- **[Vite](https://vitejs.dev/)** (v5.0) - Build tool and dev server

## Development

The project uses TypeScript for type safety and Vite for fast development builds. Key classes:

- **ExcavatorSimulator** - Main application class that orchestrates scene, physics, and controls
- **Excavator** - Defines the 3D model with articulated arm, bucket, blade, and tank treads
- **GamepadController** - Handles USB gamepad input with deadzone filtering
- **KeyboardController** - Provides keyboard alternative with same interface

## License

MIT

## Author

Created by jcl5m1
