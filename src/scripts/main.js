import { HandTracker } from './handTracker.js';
import { DragManager } from './dragManager.js';
import { PinchGesture } from './gestures/pinchGesture.js';
import { FingerCurveGesture } from './gestures/fingerCurveGesture.js';
import '../components/fps-monitor.js';

// --- Configuration Constants ---
const SMOOTHING_FACTOR = 0.2;
const HAND_TRACK_OPACITY = 0.3;
const HAND_PINCH_OPACITY = 0.3;
const HAND_LINE_WIDTH = 4;
const HAND_POINT_RADIUS = 5;
// -------------------------------

const video = document.getElementById('webcam');
const canvas = document.getElementById('hand-canvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const pausedOverlay = document.getElementById('paused-overlay');
const gestureSelect = document.getElementById('gesture-type');
const debugToggle = document.getElementById('debug-toggle');
const debugSidebar = document.getElementById('debug-sidebar');
const debugStatus = document.getElementById('debug-status');
const cameraToggleBtn = document.getElementById('camera-toggle-btn');

// --- Centralized System State Management ---
const SystemState = {
  INITIALIZING: 'INITIALIZING',
  STARTING_CAMERA: 'STARTING_CAMERA',
  LOADING_MODEL: 'LOADING_MODEL',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  STOPPED: 'STOPPED',
  ERROR: 'ERROR',

  messages: {
    INITIALIZING: 'Initializing Handpose...',
    STARTING_CAMERA: 'Starting Camera...',
    LOADING_MODEL: 'Loading Model...',
    RUNNING: 'Pinch to drag and drop 👌🏼',
    PAUSED: 'Paused',
    STOPPED: 'Camera Stopped',
    ERROR: (msg) => `Error: ${msg}`
  },

  set(state, extraInfo = '') {
    this.currentState = state;
    const message = typeof this.messages[state] === 'function' 
      ? this.messages[state](extraInfo) 
      : this.messages[state];
    
    if (status) status.innerText = message;
    if (debugStatus) {
      // Capitalize first letter for debug sidebar status
      debugStatus.innerText = state.charAt(0) + state.slice(1).toLowerCase().replace('_', ' ');
    }
    console.log(`[SystemState] ${state}${extraInfo ? ': ' + extraInfo : ''}`);
  }
};

const dragManager = new DragManager();
let tracker = null;
let currentStream = null;
let isSystemRunning = true;

// Register draggables
document.querySelectorAll('.draggable').forEach(el => {
  dragManager.register(el);
});

// Sidebar toggle
debugToggle.addEventListener('click', () => {
  const isToggled = debugSidebar.classList.toggle('hidden');
  debugToggle.innerText = isToggled ? 'Debug View' : 'Close';
});

async function setupWebcam() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
  }
  const stream = await navigator.mediaDevices.getUserMedia({ 
    video: { width: 640, height: 480 } 
  });
  video.srcObject = stream;
  currentStream = stream;
  return new Promise((resolve) => {
    video.onloadedmetadata = () => resolve(video);
  });
}

async function stopSystem() {
  if (tracker) tracker.pause();
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
  video.srcObject = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  document.querySelectorAll('.cursor').forEach(c => c.style.display = 'none');
  isSystemRunning = false;
  cameraToggleBtn.innerText = 'Start Camera';
  cameraToggleBtn.classList.add('starting');
  SystemState.set(SystemState.STOPPED);
}

async function startSystem() {
  SystemState.set(SystemState.STARTING_CAMERA);
  await setupWebcam();
  if (tracker) {
    tracker.resume();
    SystemState.set(SystemState.RUNNING);
  } else {
    await initTracker();
  }
  isSystemRunning = true;
  cameraToggleBtn.innerText = 'Stop Camera';
  cameraToggleBtn.classList.remove('starting');
}

if (cameraToggleBtn) {
  cameraToggleBtn.addEventListener('click', () => {
    if (isSystemRunning) {
      stopSystem();
    } else {
      startSystem();
    }
  });
}

function drawHands(hands) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  hands.forEach(hand => {
    const { landmarks, isPinching } = hand;
    const alpha = isPinching ? 0.8 : 0.5;
    const color = isPinching ? `rgba(255, 236, 51, ${alpha})` : `rgba(46, 213, 115, ${alpha})`;
    const fillColor = isPinching ? `rgba(255, 236, 51, 0.15)` : `rgba(46, 213, 115, 0.15)`;

    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = fillColor;

    // Path tracing around the hand silhouette
    const outlineIndices = [
      0, 1, 2, 3, 4, // Thumb
      3, 2, 1, 
      5, 6, 7, 8, // Index
      7, 6, 5,
      9, 10, 11, 12, // Middle
      11, 10, 9,
      13, 14, 15, 16, // Ring
      15, 14, 13,
      17, 18, 19, 20, // Pinky
      17, 0 // Back to wrist
    ];

    ctx.beginPath();
    ctx.moveTo(landmarks[outlineIndices[0]][0], landmarks[outlineIndices[0]][1]);
    for (let i = 1; i < outlineIndices.length; i++) {
      const idx = outlineIndices[i];
      ctx.lineTo(landmarks[idx][0], landmarks[idx][1]);
    }
    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    // Draw only the palm center point for feedback
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(landmarks[9][0], landmarks[9][1], 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

async function initTracker() {
  SystemState.set(SystemState.LOADING_MODEL);
  let smoothedPositions = [];
  const lerp = (start, end, factor) => start + (end - start) * factor;

  const gestureCallbacks = {
    onStart: (handIndex) => {
      const cursor = document.getElementById(`cursor-${handIndex}`);
      if (cursor) cursor.classList.add('pinching');
    },
    onEnd: (handIndex) => {
      dragManager.handlePinchEnd(handIndex);
      const cursor = document.getElementById(`cursor-${handIndex}`);
      if (cursor) cursor.classList.remove('pinching');
    }
  };

  const gestures = {
    pinch: new PinchGesture(gestureCallbacks),
    'finger-curve': new FingerCurveGesture(gestureCallbacks)
  };

  const initialGesture = gestures[gestureSelect.value] || gestures.pinch;

  gestureSelect.onchange = (e) => {
    if (tracker) {
      if (tracker.gesture) tracker.gesture.reset();
      tracker.gesture = gestures[e.target.value];
    }
  };

  tracker = new HandTracker(video, {
    gesture: initialGesture,
    onUpdate: (handsData) => {
      if (handsData.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        document.querySelectorAll('.cursor').forEach(c => c.style.display = 'none');
        [0, 1].forEach(idx => {
          const posEl = document.getElementById(`debug-pos-${idx}`);
          const pinchEl = document.getElementById(`debug-pinching-${idx}`);
          const stateEl = document.getElementById(`debug-drag-state-${idx}`);
          const targetEl = document.getElementById(`debug-drag-target-${idx}`);
          const gestureEl = document.getElementById(`debug-gesture-data-${idx}`);
          if (posEl) posEl.innerText = 'N/A';
          if (pinchEl) pinchEl.innerText = 'No';
          if (stateEl) stateEl.innerText = 'IDLE';
          if (targetEl) targetEl.innerText = 'None';
          if (gestureEl) gestureEl.innerText = 'N/A';
        });
        return;
      }

      drawHands(handsData);

      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;

      // Reset cursors visibility
      document.querySelectorAll('.cursor').forEach(c => c.style.display = 'none');

      handsData.forEach((hand, idx) => {
        const targetX = (1 - (hand.position[0] / videoWidth)) * screenWidth;
        const targetY = (hand.position[1] / videoHeight) * screenHeight;
        
        if (!smoothedPositions[idx]) {
          smoothedPositions[idx] = [targetX, targetY];
        } else {
          smoothedPositions[idx][0] = lerp(smoothedPositions[idx][0], targetX, SMOOTHING_FACTOR);
          smoothedPositions[idx][1] = lerp(smoothedPositions[idx][1], targetY, SMOOTHING_FACTOR);
        }

        const currentScreenPos = [...smoothedPositions[idx]];
        const cursor = document.getElementById(`cursor-${idx}`);
        if (cursor) {
          cursor.style.display = 'block';
          cursor.style.left = `${currentScreenPos[0]}px`;
          cursor.style.top = `${currentScreenPos[1]}px`;
          if (hand.isPinching) cursor.classList.add('pinching');
          else cursor.classList.remove('pinching');
        }

        const dragInfo = dragManager.updatePosition(currentScreenPos, hand.isPinching, idx);

        // Update Debug Sidebar for this hand
        const posEl = document.getElementById(`debug-pos-${idx}`);
        const pinchEl = document.getElementById(`debug-pinching-${idx}`);
        const stateEl = document.getElementById(`debug-drag-state-${idx}`);
        const targetEl = document.getElementById(`debug-drag-target-${idx}`);
        const gestureEl = document.getElementById(`debug-gesture-data-${idx}`);

        if (posEl) posEl.innerText = `X: ${Math.round(hand.position[0])}, Y: ${Math.round(hand.position[1])}`;
        if (pinchEl) pinchEl.innerText = hand.isPinching ? 'YES' : 'No';
        if (stateEl) stateEl.innerText = dragInfo.state;
        if (targetEl) targetEl.innerText = dragInfo.target;
        if (gestureEl) gestureEl.innerText = JSON.stringify(hand.gestureData, null, 2);
      });

      // Cleanup debug for missing hands
      const activeIndices = handsData.map(h => h.index);
      [0, 1].forEach(idx => {
        if (!activeIndices.includes(idx)) {
          const posEl = document.getElementById(`debug-pos-${idx}`);
          if (posEl) posEl.innerText = 'N/A';
        }
      });
    }
  });

  await tracker.init();
  SystemState.set(SystemState.RUNNING);
}

export async function init() {
  try {
    SystemState.set(SystemState.INITIALIZING);
    await setupWebcam();
    await initTracker();

    const pauseApp = () => { 
      if (tracker && isSystemRunning) {
        tracker.pause(); 
        pausedOverlay.style.display = 'flex'; 
        document.querySelectorAll('.cursor').forEach(c => c.style.display = 'none');
        SystemState.set(SystemState.PAUSED);
      }
    };
    const resumeApp = () => { 
      if (tracker && isSystemRunning) {
        tracker.resume(); 
        pausedOverlay.style.display = 'none'; 
        SystemState.set(SystemState.RUNNING);
      }
    };

    window.addEventListener('blur', pauseApp);
    window.addEventListener('focus', resumeApp);
    pausedOverlay.addEventListener('click', resumeApp);
  } catch (err) {
    console.error(err);
    SystemState.set(SystemState.ERROR, err.message);
  }
}
