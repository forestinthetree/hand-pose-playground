import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';

export class HandTracker {
  constructor(videoElement, options = {}) {
    this.video = videoElement;
    this.model = null;
    
    // Pluggable Gesture Engine
    this.gesture = options.gesture || null;
    
    this.onUpdate = options.onUpdate || (() => {});
    this.paused = false;
    this.lastRawPosition = null;
    this.internalSmoothing = 0.4;

    // Grace period for lost tracking
    this.lostHandCount = 0;
    this.lostHandThreshold = options.lostHandThreshold || 7; // ~7 frames grace (~200ms at 30fps)
  }

  async init() {
    await tf.ready();
    console.log("TensorFlow.js backend:", tf.getBackend());
    this.model = await handpose.load();
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

      const predictions = await this.model.estimateHands(this.video);
      
      if (predictions.length > 0) {
        this.lostHandCount = 0; // Reset grace counter
        const hand = predictions[0];
        const landmarks = hand.landmarks;

        // --- Core Tracking Logic ---

        // Calculate metadata (hand scale, etc)
        const wrist = landmarks[0];
        const middleMCP = landmarks[9];
        const handScale = Math.sqrt(
          Math.pow(wrist[0] - middleMCP[0], 2) +
          Math.pow(wrist[1] - middleMCP[1], 2)
        );

        // Calculate center for cursor
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const center = [
          (thumbTip[0] + indexTip[0]) / 2,
          (thumbTip[1] + indexTip[1]) / 2
        ];

        // Apply internal smoothing
        if (!this.lastRawPosition) {
          this.lastRawPosition = center;
        } else {
          this.lastRawPosition[0] += (center[0] - this.lastRawPosition[0]) * this.internalSmoothing;
          this.lastRawPosition[1] += (center[1] - this.lastRawPosition[1]) * this.internalSmoothing;
        }

        // --- Delegate Gesture Detection ---
        let gestureState = { active: false };
        if (this.gesture) {
          gestureState = this.gesture.update(landmarks, { handScale });
        }

        this.onUpdate({
          position: [...this.lastRawPosition],
          isPinching: gestureState.active,
          landmarks: landmarks,
          gestureData: gestureState
        });
      } else {
        // --- Hand Lost (with grace period) ---
        this.lostHandCount++;
        
        if (this.lostHandCount >= this.lostHandThreshold) {
          if (this.gesture) this.gesture.reset();
          this.lastRawPosition = null;
          this.onUpdate({
            position: null,
            isPinching: false,
            landmarks: null
          });
        }
        // If within grace period, we just skip the update, 
        // effectively "freezing" the last known state.
      }
    } catch (error) {
      console.error("Hand tracking error:", error);
    }

    requestAnimationFrame(() => this.track());
  }
}
