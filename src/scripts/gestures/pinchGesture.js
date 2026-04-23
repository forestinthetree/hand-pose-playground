/**
 * Standard Pinch Gesture Plugin (Multi-hand Support)
 * Detects clicks based on the distance between thumb and index finger.
 */
export class PinchGesture {
  constructor(options = {}) {
    this.name = 'pinch';
    this.pinchStartRatio = options.pinchStartRatio || 0.35;
    this.pinchStopRatio = options.pinchStopRatio || 0.75;
    
    // Per-hand state
    this.handsState = []; // [{ isPinching, prevPinchRatio }]
    
    // Callbacks
    this.onStart = options.onStart || (() => {});
    this.onEnd = options.onEnd || (() => {});
  }

  getHandState(index) {
    if (!this.handsState[index]) {
      this.handsState[index] = {
        isPinching: false,
        prevPinchRatio: 1.0
      };
    }
    return this.handsState[index];
  }

  update(landmarks, metadata, handIndex = 0) {
    if (!landmarks) {
      this.reset(handIndex);
      return { active: false };
    }

    const state = this.getHandState(handIndex);
    const { handScale } = metadata;
    
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];

    const fingerDistance = Math.sqrt(
      Math.pow(thumbTip[0] - indexTip[0], 2) +
      Math.pow(thumbTip[1] - indexTip[1], 2)
    );

    const pinchRatio = fingerDistance / handScale;

    // 1. Dynamic Squeeze & Threshold Detection
    const squeezeDelta = state.prevPinchRatio - pinchRatio;
    const isSqueezing = squeezeDelta > 0.008;
    const isBelowStart = pinchRatio < this.pinchStartRatio;

    if (isSqueezing || isBelowStart) {
      if (!state.isPinching || isSqueezing) {
        if (!state.isPinching) this.onStart(handIndex);
        state.isPinching = true;
      }
    }

    // 2. Release Detection
    if (state.isPinching && pinchRatio > this.pinchStopRatio) {
      state.isPinching = false;
      this.onEnd(handIndex);
    }

    state.prevPinchRatio = pinchRatio;

    return {
      active: state.isPinching,
      ratio: pinchRatio
    };
  }

  reset(handIndex) {
    if (handIndex !== undefined) {
      const state = this.handsState[handIndex];
      if (state && state.isPinching) {
        state.isPinching = false;
        this.onEnd(handIndex);
      }
      if (state) state.prevPinchRatio = 1.0;
    } else {
      this.handsState.forEach((state, idx) => {
        if (state.isPinching) {
          state.isPinching = false;
          this.onEnd(idx);
        }
        state.prevPinchRatio = 1.0;
      });
    }
  }
}
