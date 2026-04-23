/**
 * Finger Curve Gesture Plugin (Experimental) (Multi-hand Support)
 * Detects clicks based on the curvature/flex of the fingers.
 */
export class FingerCurveGesture {
  constructor(options = {}) {
    this.name = 'finger-curve';
    this.handsState = []; // [{ isPinching }]
    this.onStart = options.onStart || (() => {});
    this.onEnd = options.onEnd || (() => {});
  }

  getHandState(index) {
    if (!this.handsState[index]) {
      this.handsState[index] = {
        isPinching: false
      };
    }
    return this.handsState[index];
  }

  // Helper to calculate angle between three points
  getAngle(p1, p2, p3) {
    const v1 = [p1[0] - p2[0], p1[1] - p2[1]];
    const v2 = [p3[0] - p2[0], p3[1] - p2[1]];
    
    const dot = v1[0] * v2[0] + v1[1] * v2[1];
    const mag1 = Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1]);
    const mag2 = Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1]);
    
    return Math.acos(dot / (mag1 * mag2));
  }

  update(landmarks, metadata, handIndex = 0) {
    if (!landmarks) {
      this.reset(handIndex);
      return { active: false };
    }

    const state = this.getHandState(handIndex);

    // Example logic: Check angle at the index finger middle joint (Landmark 6)
    // and thumb joint (Landmark 3)
    const indexAngle = this.getAngle(landmarks[5], landmarks[6], landmarks[8]);
    const thumbAngle = this.getAngle(landmarks[2], landmarks[3], landmarks[4]);

    // This is a placeholder for your actual curve logic
    // Usually, a lower angle means the finger is more curled
    const curveValue = (indexAngle + thumbAngle) / 2;
    const threshold = 1.0; // Radians placeholder

    const currentlyCurved = curveValue < threshold;

    if (currentlyCurved && !state.isPinching) {
      state.isPinching = true;
      this.onStart(handIndex);
    } else if (!currentlyCurved && state.isPinching) {
      state.isPinching = false;
      this.onEnd(handIndex);
    }

    return {
      active: state.isPinching,
      curve: curveValue
    };
  }

  reset(handIndex) {
    if (handIndex !== undefined) {
      const state = this.handsState[handIndex];
      if (state && state.isPinching) {
        state.isPinching = false;
        this.onEnd(handIndex);
      }
    } else {
      this.handsState.forEach((state, idx) => {
        if (state.isPinching) {
          state.isPinching = false;
          this.onEnd(idx);
        }
      });
    }
  }
}
