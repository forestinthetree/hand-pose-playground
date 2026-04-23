import * as tf from '@tensorflow/tfjs';
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import '@mediapipe/hands';

export class HandTracker {
  constructor(videoElement, options = {}) {
    this.video = videoElement;
    this.detector = null;
    this.gesture = options.gesture || null;
    this.onUpdate = options.onUpdate || (() => {});
    this.paused = false;
    
    // Hand Persistence State
    this.hands = []; // Array of active hand objects { id, position, lostCount, ... }
    this.nextId = 0;
    this.internalSmoothing = 0.4;
    this.lostHandThreshold = options.lostHandThreshold || 7; 
  }

  async init() {
    await tf.ready();
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

  pause() { this.paused = true; }
  resume() { if (this.paused) { this.paused = false; this.track(); } }

  getDistance(p1, p2) {
    return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
  }

  async track() {
    if (this.paused) return;

    try {
      if (this.video.readyState < 2) {
        requestAnimationFrame(() => this.track());
        return;
      }

      const detectedHands = await this.detector.estimateHands(this.video, { flipHorizontal: false });
      
      // 1. Process Detections
      const processedDetections = detectedHands.map(hand => {
        const landmarks = hand.keypoints.map(kp => [kp.x, kp.y, kp.z || 0]);
        const wrist = landmarks[0];
        const middleMCP = landmarks[9];
        const handScale = Math.sqrt(Math.pow(wrist[0] - middleMCP[0], 2) + Math.pow(wrist[1] - middleMCP[1], 2));
        const center = [(hand.keypoints[4].x + hand.keypoints[8].x) / 2, (hand.keypoints[4].y + hand.keypoints[8].y) / 2];
        
        return { center, landmarks, handScale, handedness: hand.handedness };
      });

      // 2. Proximity Matching
      const matchedDetections = new Set();
      const nextHands = [];

      // Update existing hands
      this.hands.forEach(hand => {
        let bestMatch = null;
        let minDistance = 150; // Threshold for matching

        processedDetections.forEach((det, idx) => {
          if (matchedDetections.has(idx)) return;
          const dist = this.getDistance(hand.position, det.center);
          if (dist < minDistance) {
            minDistance = dist;
            bestMatch = { det, idx };
          }
        });

        if (bestMatch) {
          matchedDetections.add(bestMatch.idx);
          const { det } = bestMatch;
          
          hand.position = [
            hand.position[0] + (det.center[0] - hand.position[0]) * this.internalSmoothing,
            hand.position[1] + (det.center[1] - hand.position[1]) * this.internalSmoothing
          ];
          hand.landmarks = det.landmarks;
          hand.handScale = det.handScale;
          hand.label = det.handedness;
          hand.lostCount = 0;

          if (this.gesture) {
            const gestureState = this.gesture.update(hand.landmarks, { handScale: hand.handScale }, hand.id);
            hand.isPinching = gestureState.active;
            hand.gestureData = gestureState;
          }
          nextHands.push(hand);
        } else {
          // Hand not found in this frame
          hand.lostCount++;
          if (hand.lostCount < this.lostHandThreshold) {
            nextHands.push(hand); // Keep it alive but frozen
          } else {
            if (this.gesture) this.gesture.reset(hand.id);
          }
        }
      });

      // 3. Spawn new hands for unmatched detections
      processedDetections.forEach((det, idx) => {
        if (matchedDetections.has(idx)) return;
        if (nextHands.length >= 2) return; // Limit to 2 hands

        // Find an available ID (0 or 1)
        const usedIds = nextHands.map(h => h.id);
        const id = [0, 1].find(i => !usedIds.includes(i)) ?? this.nextId++;

        const newHand = {
          id,
          label: det.handedness,
          position: det.center,
          landmarks: det.landmarks,
          handScale: det.handScale,
          isPinching: false,
          gestureData: { active: false },
          lostCount: 0
        };

        if (this.gesture) {
          const gestureState = this.gesture.update(newHand.landmarks, { handScale: newHand.handScale }, newHand.id);
          newHand.isPinching = gestureState.active;
          newHand.gestureData = gestureState;
        }

        nextHands.push(newHand);
      });

      this.hands = nextHands;

      // Map to consistent structure for output (sorting by ID ensures stable index)
      const output = this.hands
        .sort((a, b) => a.id - b.id)
        .map(h => ({
          index: h.id, // interaction index
          label: h.label, // model label
          position: h.position,
          isPinching: h.isPinching,
          landmarks: h.landmarks,
          gestureData: h.gestureData
        }));

      this.onUpdate(output);

    } catch (error) {
      console.error("Hand tracking error:", error);
    }

    requestAnimationFrame(() => this.track());
  }
}
