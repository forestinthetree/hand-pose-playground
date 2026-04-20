/**
 * Finger Curve Gesture Plugin (Experimental)
 * Detects clicks based on the curvature/flex of the fingers.
 */
export class FingerCurveGesture {
  constructor(options = {}) {
    this.name = 'finger-curve';
    this.isPinching = false;
    this.onStart = options.onStart || (() => {});
    this.onEnd = options.onEnd || (() => {});
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

  update(landmarks, metadata) {
    if (!landmarks) {
      this.reset();
      return { active: false };
    }

    // Example logic: Check angle at the index finger middle joint (Landmark 6)
    // and thumb joint (Landmark 3)
    const indexAngle = this.getAngle(landmarks[5], landmarks[6], landmarks[8]);
    const thumbAngle = this.getAngle(landmarks[2], landmarks[3], landmarks[4]);

    // This is a placeholder for your actual curve logic
    // Usually, a lower angle means the finger is more curled
    const curveValue = (indexAngle + thumbAngle) / 2;
    const threshold = 1.0; // Radians placeholder

    const currentlyCurved = curveValue < threshold;

    if (currentlyCurved && !this.isPinching) {
      this.isPinching = true;
      this.onStart();
    } else if (!currentlyCurved && this.isPinching) {
      this.isPinching = false;
      this.onEnd();
    }

    return {
      active: this.isPinching,
      curve: curveValue
    };
  }

  reset() {
    if (this.isPinching) {
      this.isPinching = false;
      this.onEnd();
    }
  }
}
