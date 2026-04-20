/**
 * Standard Pinch Gesture Plugin
 * Detects clicks based on the distance between thumb and index finger.
 */
export class PinchGesture {
  constructor(options = {}) {
    this.name = 'pinch';
    this.pinchStartRatio = options.pinchStartRatio || 0.35;
    this.pinchStopRatio = options.pinchStopRatio || 0.75;
    this.prevPinchRatio = 1.0;
    this.isPinching = false;
    
    // Callbacks
    this.onStart = options.onStart || (() => {});
    this.onEnd = options.onEnd || (() => {});
  }

  update(landmarks, metadata) {
    if (!landmarks) {
      if (this.isPinching) {
        this.isPinching = false;
        this.onEnd();
      }
      return { active: false };
    }

    // Use metadata provided by tracker (handScale)
    const { handScale } = metadata;
    
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];

    const fingerDistance = Math.sqrt(
      Math.pow(thumbTip[0] - indexTip[0], 2) +
      Math.pow(thumbTip[1] - indexTip[1], 2)
    );

    const pinchRatio = fingerDistance / handScale;

    // 1. Dynamic Squeeze & Threshold Detection
    const squeezeDelta = this.prevPinchRatio - pinchRatio;
    const isSqueezing = squeezeDelta > 0.008;
    const isBelowStart = pinchRatio < this.pinchStartRatio;

    if (isSqueezing || isBelowStart) {
      if (!this.isPinching || isSqueezing) {
        this.onStart();
        this.isPinching = true;
      }
    }

    // 2. Release Detection
    if (this.isPinching && pinchRatio > this.pinchStopRatio) {
      this.isPinching = false;
      this.onEnd();
    }

    this.prevPinchRatio = pinchRatio;

    return {
      active: this.isPinching,
      ratio: pinchRatio
    };
  }

  reset() {
    if (this.isPinching) {
      this.isPinching = false;
      this.onEnd();
    }
    this.prevPinchRatio = 1.0;
  }
}
