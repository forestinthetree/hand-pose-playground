# Hand Pose Playground 🖐️✨

An interactive experimental webpage using TensorFlow.js Handpose model to detect hand gestures for on-page interactions.

## Features

- **Hand Tracking:** Real-time hand detection using `@tensorflow-models/handpose`.
- **Pinch-to-Click:** Detects when your thumb and index finger meet to trigger a "click" or "grab".
- **Drag & Drop:** Move physical-style blocks around the screen using natural hand gestures.
- **Visual Debugging:** Optional hand skeleton visualization and performance (FPS) monitor.
- **Auto-Pause:** Intelligently pauses webcam processing when the tab is inactive to save system resources.
- **Safe Zone Mapping:** Optimized control area that maps a reliable central camera zone to the full screen.

## Prerequisites

- **Node.js:** Version 22.12.0 or higher.
- **Webcam:** A functioning camera for hand detection.
- **Modern Browser:** Chrome, Edge, or Firefox (with webcam permissions granted).

## Getting Started

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Start the Development Server:**
   ```bash
   npm run dev
   ```

3. **Open the App:**
   Navigate to `http://localhost:7900` (or the port specified in your console).

## How to Play

1. **Initialize:** Wait for the model to load (check the status bar at the bottom left).
2. **Move:** Watch the cursor follow your hand.
3. **Pinch:** Bring your thumb and index finger together. The cursor will change color, and the hand skeleton will highlight.
4. **Drag:** Pinch over a colored box (Red, Green, or Blue) and move your hand to relocate it.
5. **Drop:** Release the pinch to drop the object.

## Configuration

You can tune the experience in `src/scripts/main.js` and `src/styles/main.css`:

- **Smoothing:** Adjust `SMOOTHING_FACTOR` in `main.js` for more fluid or snappier movement.
- **Visuals:** Change `HAND_TRACK_OPACITY` or `HAND_LINE_WIDTH` to customize the debug skeleton.
- **Video Blur:** Modify `--video-blur` in `main.css` to adjust the background clarity.

## Technologies Used

- [Astro](https://astro.build/)
- [TensorFlow.js](https://www.tensorflow.org/js)
- [Handpose Model](https://github.com/tensorflow/tfjs-models/tree/master/handpose)
- [Vanilla Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components)
