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
const cursor = document.getElementById('cursor');
const pausedOverlay = document.getElementById('paused-overlay');
const gestureSelect = document.getElementById('gesture-type');
const debugToggle = document.getElementById('debug-toggle');
const debugSidebar = document.getElementById('debug-sidebar');
const debugStatus = document.getElementById('debug-status');
const debugPos = document.getElementById('debug-pos');
const debugPinching = document.getElementById('debug-pinching');
const debugGestureData = document.getElementById('debug-gesture-data');
const debugDragState = document.getElementById('debug-drag-state');
const debugDragTarget = document.getElementById('debug-drag-target');
const cameraToggleBtn = document.getElementById('camera-toggle-btn');

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
  cursor.style.display = 'none';
  isSystemRunning = false;
  cameraToggleBtn.innerText = 'Start Camera';
  cameraToggleBtn.classList.add('starting');
  debugStatus.innerText = 'Stopped';
  status.innerText = 'Camera Stopped';
}

async function startSystem() {
  status.innerText = 'Starting Camera...';
  debugStatus.innerText = 'Starting...';
  await setupWebcam();
  if (tracker) {
    tracker.resume();
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

async function initTracker() {
  let currentScreenPos = [0, 0];
  let smoothedPos = [0, 0];
  const lerp = (start, end, factor) => start + (end - start) * factor;

  const gestureCallbacks = {
    onStart: () => {
      dragManager.handlePinchStart(currentScreenPos);
      cursor.classList.add('pinching');
    },
    onEnd: () => {
      dragManager.handlePinchEnd();
      cursor.classList.remove('pinching');
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

  const drawHand = (landmarks, isPinching) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    const alpha = isPinching ? HAND_PINCH_OPACITY : HAND_TRACK_OPACITY;
    const color = isPinching ? `rgba(255, 236, 51, ${alpha})` : `rgba(46, 213, 115, ${alpha})`;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = HAND_LINE_WIDTH;
    ctx.fillStyle = color;

    const fingerIndices = [[0,1,2,3,4],[0,5,6,7,8],[0,9,10,11,12],[0,13,14,15,16],[0,17,18,19,20]];
    fingerIndices.forEach(finger => {
      ctx.beginPath();
      ctx.moveTo(landmarks[finger[0]][0], landmarks[finger[0]][1]);
      for (let i = 1; i < finger.length; i++) ctx.lineTo(landmarks[finger[i]][0], landmarks[finger[i]][1]);
      ctx.stroke();
    });

    landmarks.forEach(point => {
      ctx.beginPath(); ctx.arc(point[0], point[1], HAND_POINT_RADIUS, 0, Math.PI * 2); ctx.fill();
    });
  };

  tracker = new HandTracker(video, {
    gesture: initialGesture,
    onUpdate: (data) => {
      if (!data.landmarks) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        cursor.style.display = 'none';
        debugPos.innerText = 'N/A';
        debugPinching.innerText = 'No';
        debugGestureData.innerText = 'N/A';
        debugDragState.innerText = 'IDLE';
        debugDragTarget.innerText = 'None';
        return;
      }

      drawHand(data.landmarks, data.isPinching);

      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;

      const targetX = (1 - (data.position[0] / videoWidth)) * screenWidth;
      const targetY = (data.position[1] / videoHeight) * screenHeight;
      
      if (smoothedPos[0] === 0 && smoothedPos[1] === 0) {
        smoothedPos = [targetX, targetY];
      } else {
        smoothedPos[0] = lerp(smoothedPos[0], targetX, SMOOTHING_FACTOR);
        smoothedPos[1] = lerp(smoothedPos[1], targetY, SMOOTHING_FACTOR);
      }

      currentScreenPos = [...smoothedPos];
      cursor.style.display = 'block';
      cursor.style.left = `${currentScreenPos[0]}px`;
      cursor.style.top = `${currentScreenPos[1]}px`;
      const dragInfo = dragManager.updatePosition(currentScreenPos, data.isPinching);

      // Update Debug Sidebar
      debugPos.innerText = `X: ${Math.round(data.position[0])}, Y: ${Math.round(data.position[1])}`;
      debugPinching.innerText = data.isPinching ? 'YES' : 'No';
      debugGestureData.innerText = JSON.stringify(data.gestureData, null, 2);
      debugDragState.innerText = dragInfo.state;
      debugDragTarget.innerText = dragInfo.target;
    }
  });

  await tracker.init();
  debugStatus.innerText = 'Ready';
  status.innerText = 'Hand Tracking Ready!';
}

export async function init() {
  try {
    await setupWebcam();
    status.innerText = 'Loading Model...';
    debugStatus.innerText = 'Loading Model...';
    await initTracker();

    const pauseApp = () => { 
      if (tracker && isSystemRunning) {
        tracker.pause(); 
        pausedOverlay.style.display = 'flex'; 
        cursor.style.display = 'none';
        debugStatus.innerText = 'Paused';
      }
    };
    const resumeApp = () => { 
      if (tracker && isSystemRunning) {
        tracker.resume(); 
        pausedOverlay.style.display = 'none'; 
        debugStatus.innerText = 'Ready';
      }
    };

    window.addEventListener('blur', pauseApp);
    window.addEventListener('focus', resumeApp);
    pausedOverlay.addEventListener('click', resumeApp);
  } catch (err) {
    console.error(err);
    status.innerText = 'Error: ' + err.message;
    debugStatus.innerText = 'Error';
  }
}
