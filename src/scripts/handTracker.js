import * as tf from '@tensorflow/tfjs';
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import '@mediapipe/hands';

export class HandTracker {
  constructor(videoElement, options = {}) {
    this.video = videoElement;
    this.model = null;
    this.detector = null;
    
    // Pluggable Gesture Engine
    this.gesture = options.gesture || null;
    
    this.onUpdate = options.onUpdate || (() => {});
    this.paused = false;
    this.lastRawPositions = []; // Store positions for multiple hands
    this.internalSmoothing = 0.4;

    // Grace period for lost tracking
    this.lostHandCount = 0;
    this.lostHandThreshold = options.lostHandThreshold || 7; 
  }

  async init() {
    await tf.ready();
    console.log("TensorFlow.js backend:", tf.getBackend());
    
    const model = handPoseDetection.SupportedModels.MediaPipeHands;
    const detectorConfig = {
      runtime: 'mediapipe',
      solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands',
      modelType: 'full',
      maxHands: 2
    };
    
    this.detector = await handPoseDetection.createDetector(model, detectorConfig);
    this.track();
  }

  pause() {
    this.paused = true;
  }

  resume() {
    if (this.paused) {
      this.paused = false;
      this.track();
    }
  }

  async track() {
    if (this.paused) return;

    try {
      if (this.video.readyState < 2) {
        requestAnimationFrame(() => this.track());
        return;
      }

      const hands = await this.detector.estimateHands(this.video, {
        flipHorizontal: false // We handle mirroring in CSS
      });
      
      if (hands && hands.length > 0) {
        this.lostHandCount = 0;
        
        const handsData = hands.map((hand, index) => {
          // Map keypoints to the legacy [x, y, z] landmarks format
          const landmarks = hand.keypoints.map(kp => [kp.x, kp.y, kp.z || 0]);

          // Calculate metadata (hand scale)
          const wrist = landmarks[0];
          const middleMCP = landmarks[9];
          const handScale = Math.sqrt(
            Math.pow(wrist[0] - middleMCP[0], 2) +
            Math.pow(wrist[1] - middleMCP[1], 2)
          );

          // Calculate center
          const thumbTip = landmarks[4];
          const indexTip = landmarks[8];
          const center = [
            (thumbTip[0] + indexTip[0]) / 2,
            (thumbTip[1] + indexTip[1]) / 2
          ];

          // Smoothing per hand
          if (!this.lastRawPositions[index]) {
            this.lastRawPositions[index] = center;
          } else {
            this.lastRawPositions[index][0] += (center[0] - this.lastRawPositions[index][0]) * this.internalSmoothing;
            this.lastRawPositions[index][1] += (center[1] - this.lastRawPositions[index][1]) * this.internalSmoothing;
          }

          let gestureState = { active: false };
          if (this.gesture) {
            gestureState = this.gesture.update(landmarks, { handScale }, index);
          }

          return {
            index,
            position: [...this.lastRawPositions[index]],
            isPinching: gestureState.active,
            landmarks: landmarks,
            gestureData: gestureState
          };
        });

        // Cleanup stale hand positions
        if (this.lastRawPositions.length > hands.length) {
          this.lastRawPositions.splice(hands.length);
        }

        this.onUpdate(handsData);
      } else {
        this.lostHandCount++;
        if (this.lostHandCount >= this.lostHandThreshold) {
          if (this.gesture) this.gesture.reset();
          this.lastRawPositions = [];
          this.onUpdate([]);
        }
      }
    } catch (error) {
      console.error("Hand tracking error:", error);
    }

    requestAnimationFrame(() => this.track());
  }
}
