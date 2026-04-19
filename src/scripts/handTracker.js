import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';

export class HandTracker {
  constructor(videoElement, options = {}) {
    this.video = videoElement;
    this.model = null;
    this.isPinching = false;
    this.pinchThreshold = options.pinchThreshold || 30;
    this.onUpdate = options.onUpdate || (() => {});
    this.onPinchStart = options.onPinchStart || (() => {});
    this.onPinchEnd = options.onPinchEnd || (() => {});
  }

  async init() {
    await tf.ready();
    console.log("TensorFlow.js backend:", tf.getBackend());
    this.model = await handpose.load();
    this.track();
  }

  async track() {
    try {
      if (this.video.readyState < 2) {
        requestAnimationFrame(() => this.track());
        return;
      }

      const predictions = await this.model.estimateHands(this.video);
      
      if (predictions.length > 0) {
        const hand = predictions[0];
        const landmarks = hand.landmarks;

        // Landmarks: 4 is thumb tip, 8 is index finger tip
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

        if (currentlyPinching && !this.isPinching) {
          this.isPinching = true;
          this.onPinchStart(center);
        } else if (!currentlyPinching && this.isPinching) {
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
