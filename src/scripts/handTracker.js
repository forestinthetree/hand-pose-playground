import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';

export class HandTracker {
  constructor(videoElement, options = {}) {
    this.video = videoElement;
    this.model = null;
    this.isPinching = false;
    this.pinchThreshold = options.pinchThreshold || 30;
    this.pinchFrames = 0;
    this.requiredPinchFrames = 3; 
    this.onUpdate = options.onUpdate || (() => {});
    this.onPinchStart = options.onPinchStart || (() => {});
    this.onPinchEnd = options.onPinchEnd || (() => {});
    this.paused = false;
    this.lastRawPosition = null;
    this.internalSmoothing = 0.4;
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

        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];

        const distance = Math.sqrt(
          Math.pow(thumbTip[0] - indexTip[0], 2) +
          Math.pow(thumbTip[1] - indexTip[1], 2)
        );

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

        const currentlyPinching = distance < this.pinchThreshold;

        if (currentlyPinching) {
          this.pinchFrames = Math.min(this.pinchFrames + 1, 10);
        } else {
          this.pinchFrames = Math.max(this.pinchFrames - 1, 0);
        }

        if (this.pinchFrames >= this.requiredPinchFrames && !this.isPinching) {
          this.isPinching = true;
          this.onPinchStart(this.lastRawPosition);
        } else if (this.pinchFrames === 0 && this.isPinching) {
          this.isPinching = false;
          this.onPinchEnd(this.lastRawPosition);
        }

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
