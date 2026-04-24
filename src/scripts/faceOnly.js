import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import '@mediapipe/face_mesh';

let detector;
let video;
let canvas;
let ctx;
let status;

async function setupWebcam() {
  video = document.getElementById('webcam');
  const stream = await navigator.mediaDevices.getUserMedia({ 
    video: { width: 640, height: 480 } 
  });
  video.srcObject = stream;
  return new Promise((resolve) => {
    video.onloadedmetadata = () => resolve(video);
  });
}

async function render() {
  const faces = await detector.estimateFaces(video, { flipHorizontal: false });

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  if (faces.length > 0) {
    status.innerText = `Face Detected (${faces[0].keypoints.length} points)`;
    
    // Draw landmarks
    ctx.fillStyle = '#0ff';
    faces[0].keypoints.forEach(kp => {
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, 1, 0, Math.PI * 2);
      ctx.fill();
    });
  } else {
    status.innerText = 'Looking for face...';
  }

  requestAnimationFrame(render);
}

export async function init() {
  try {
    status = document.getElementById('status');
    canvas = document.getElementById('face-canvas');
    ctx = canvas.getContext('2d');

    await setupWebcam();
    status.innerText = 'Loading Face Mesh Model...';

    const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
    const detectorConfig = {
      runtime: 'mediapipe',
      solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
      refineLandmarks: true
    };
    
    detector = await faceLandmarksDetection.createDetector(model, detectorConfig);
    status.innerText = 'Face Mesh Ready';
    
    requestAnimationFrame(render);
  } catch (err) {
    console.error(err);
    status.innerText = 'Error: ' + err.message;
  }
}
