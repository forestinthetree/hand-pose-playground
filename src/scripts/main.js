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
const dragManager = new DragManager();
let tracker = null;

// Register draggables
document.querySelectorAll('.draggable').forEach(el => {
  dragManager.register(el);
});

async function setupWebcam() {
  const stream = await navigator.mediaDevices.getUserMedia({ 
    video: { width: 640, height: 480 } 
  });
  video.srcObject = stream;
  return new Promise((resolve) => {
    video.onloadedmetadata = () => resolve(video);
  });
}

export async function init() {
  try {
    await setupWebcam();
    status.innerText = 'Loading Model...';
    
    let currentScreenPos = [0, 0];
    let smoothedPos = [0, 0];
    const lerp = (start, end, factor) => start + (end - start) * factor;

    // --- Gesture Plugin Setup ---
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

    gestureSelect.addEventListener('change', (e) => {
      if (tracker) {
        if (tracker.gesture) tracker.gesture.reset();
        tracker.gesture = gestures[e.target.value];
      }
    });

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
        dragManager.updatePosition(currentScreenPos);
      }
    });

    await tracker.init();
    status.innerText = 'Hand Tracking Ready!';

    const pauseApp = () => { if (tracker) tracker.pause(); pausedOverlay.style.display = 'flex'; cursor.style.display = 'none'; };
    const resumeApp = () => { if (tracker) tracker.resume(); pausedOverlay.style.display = 'none'; };

    window.addEventListener('blur', pauseApp);
    window.addEventListener('focus', resumeApp);
    pausedOverlay.addEventListener('click', resumeApp);
  } catch (err) {
    console.error(err);
    status.innerText = 'Error: ' + err.message;
  }
}
