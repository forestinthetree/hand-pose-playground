import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';

export class HandTracker {
  constructor(videoElement, options = {}) {
    this.video = videoElement;
    this.model = null;
    this.isPinching = false;
    this.pinchThreshold = options.pinchThreshold || 30;
    this.pinchFrames = 0;
    this.requiredPinchFrames = 3; // Must be pinching for 3 frames to trigger
    this.onUpdate = options.onUpdate || (() => {});
    this.onPinchStart = options.onPinchStart || (() => {});
    this.onPinchEnd = options.onPinchEnd || (() => {});
    this.paused = false;
  }

  async init() {
    await tf.ready();
    console.log("TensorFlow.js backend:", tf.getBackend());
    this.model = await handpose.load();
    this.track();
  }

  pause() {
    this.paused = true;
    console.log("Hand tracking paused");
  }

  resume() {
    if (this.paused) {
      this.paused = false;
      console.log("Hand tracking resumed");
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

        const currentlyPinching = distance < this.pinchThreshold;

        if (currentlyPinching) {
          this.pinchFrames = Math.min(this.pinchFrames + 1, 10);
        } else {
          this.pinchFrames = Math.max(this.pinchFrames - 1, 0);
        }

        if (this.pinchFrames >= this.requiredPinchFrames && !this.isPinching) {
          this.isPinching = true;
          this.onPinchStart(center);
        } else if (this.pinchFrames === 0 && this.isPinching) {
          this.isPinching = false;
          this.onPinchEnd(center);
        }

        this.onUpdate({
          position: center,
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
