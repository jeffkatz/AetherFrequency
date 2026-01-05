
# AetherFrequency: Locational Energy Visualizer

This project is a visual metaphor engine exploring a non-Newtonian physics model where objects do not possess mass or move through force, but instead exist as **Energy Signatures** that stabilize within a **Spatial Field** based on frequency tuning.

## 🧠 Conceptual Model

### 1. Locational Variables
In this simulation, coordinates $(x, y, z)$ are not containers for objects. Instead, every point in space has an intrinsic "Locational Frequency". An object is simply a localized frequency state.

### 2. Intersection Nodes
The 3D lattice of glowing points represents stable "Intersection Nodes". These are relational states where the field energy is coherent.

### 3. Motion as Retuning
When you adjust the "Locational Frequency" slider, you are not "moving" the sphere. You are changing its internal state. The sphere naturally relocates to the nearest node that matches its new frequency. This is handled via smooth state interpolation.

### 4. Gravity Analogy
"Up" and "Down" are simply directions in the frequency spectrum. By retuning the object's frequency signature up or down, it ascends or descends through the spatial lattice.

## 🛠 Tech Stack
- **Angular 19+ (Zoneless)**: Reactive state management using Signals.
- **Three.js**: High-performance 3D rendering with GLSL-based post-processing.
- **D3.js**: Real-time analysis of the frequency field distribution.
- **GSAP**: Robust interpolation for "state-based" movement.
- **Tailwind CSS**: Modern, ethereal UI design.

## 🚀 How to Run
1. `npm install`
2. `npm run dev`

## 🧪 Extension Points
- **Harmonics**: Add a second slider to adjust the "Harmonic Factor," allowing the object to stabilize at multiple nodes simultaneously.
- **Node Collision**: Implement interference patterns when the frequency signatures of two objects overlap.
- **Field Distortion**: Dynamically shift node frequencies over time using Perlin noise to simulate a fluctuating spacetime medium.
