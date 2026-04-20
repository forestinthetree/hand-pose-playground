import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';

export class HandTracker {
  constructor(videoElement, options = {}) {
    this.video = videoElement;
    this.model = null;
    this.isPinching = false;
    
    // Relative thresholds (ratios of the hand scale)
    this.pinchStartRatio = options.pinchStartRatio || 0.35; 
    this.pinchStopRatio = options.pinchStopRatio || 0.75;    
    
    this.requiredPinchFrames = 2; 
    this.onUpdate = options.onUpdate || (() => {});
    this.onPinchStart = options.onPinchStart || (() => {});
    this.onPinchEnd = options.onPinchEnd || (() => {});
    this.paused = false;
    this.lastRawPosition = null;
    this.internalSmoothing = 0.4;

    // Tracking for squeeze pulses
    this.prevPinchRatio = 1.0;
    this.wasPinchingDeep = false;
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
        const hand = predictions[0];
        const landmarks = hand.landmarks;

        // Calculate hand scale (Wrist to Middle MCP)
        const wrist = landmarks[0];
        const middleMCP = landmarks[9];
        const handScale = Math.sqrt(
          Math.pow(wrist[0] - middleMCP[0], 2) +
          Math.pow(wrist[1] - middleMCP[1], 2)
        );

        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];

        const fingerDistance = Math.sqrt(
          Math.pow(thumbTip[0] - indexTip[0], 2) +
          Math.pow(thumbTip[1] - indexTip[1], 2)
        );

        const pinchRatio = fingerDistance / handScale;

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

        // --- Gesture State Logic ---

        // 1. Dynamic Squeeze Detection
        // Trigger if we see a clear reduction in distance (squeeze pulse)
        // or if we are below the absolute start threshold.
        const squeezeDelta = this.prevPinchRatio - pinchRatio;
        const isSqueezing = squeezeDelta > 0.008; // intentional squeeze motion
        const isBelowStart = pinchRatio < this.pinchStartRatio;

        if (isSqueezing || isBelowStart) {
          // Fire start event - DragManager will ignore if already dragging
          this.onPinchStart(this.lastRawPosition);
          this.isPinching = true;
          this.wasPinchingDeep = true;
        }

        // 2. Check for Release (Exiting holding state)
        if (this.isPinching && pinchRatio > this.pinchStopRatio) {
          this.isPinching = false;
          this.onPinchEnd(this.lastRawPosition);
        }

        this.prevPinchRatio = pinchRatio;

        this.onUpdate({
          position: [...this.lastRawPosition],
          isPinching: this.isPinching,
          landmarks: landmarks
        });
      }
    } catch (error) {
      console.error("Hand tracking error:", error);
    }

    requestAnimationFrame(() => this.track());
  }
}
