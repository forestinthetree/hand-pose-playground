const States = {
  IDLE: 'IDLE',
  HOVER: 'HOVER',
  DRAGGING: 'DRAGGING'
};

export class DragManager {
  constructor() {
    this.draggables = [];
    this.hands = []; // Array of { draggedElement, hoveredElement, offset, state }
  }

  getHand(index) {
    if (!this.hands[index]) {
      this.hands[index] = {
        draggedElement: null,
        hoveredElement: null,
        offset: { x: 0, y: 0 },
        state: States.IDLE
      };
    }
    return this.hands[index];
  }

  register(element) {
    this.draggables.push(element);
    element.style.position = 'absolute';
    element.style.cursor = 'grab';
  }

  handlePinchStart(position, handIndex = 0) {
    const hand = this.getHand(handIndex);
    const x = position[0];
    const y = position[1];

    if ((hand.state === States.HOVER || hand.state === States.IDLE) && hand.hoveredElement) {
      // Check if this element is already being dragged by another hand
      const isAlreadyDragged = this.hands.some((h, idx) => idx !== handIndex && h.draggedElement === hand.hoveredElement);
      if (isAlreadyDragged) return;

      const rect = hand.hoveredElement.getBoundingClientRect();
      hand.draggedElement = hand.hoveredElement;
      hand.offset.x = x - rect.left;
      hand.offset.y = y - rect.top;
      hand.draggedElement.classList.add('dragging');
      hand.draggedElement.style.zIndex = '1000';
      hand.state = States.DRAGGING;
    }
  }

  handlePinchEnd(handIndex = 0) {
    const hand = this.getHand(handIndex);
    if (hand.state === States.DRAGGING) {
      hand.draggedElement.classList.remove('dragging');
      hand.draggedElement.style.zIndex = '10';
      hand.draggedElement = null;
      hand.state = States.IDLE;
    }
  }

  updatePosition(position, isPinching = false, handIndex = 0) {
    const hand = this.getHand(handIndex);
    const x = position[0];
    const y = position[1];

    if (hand.state !== States.DRAGGING) {
      // Look for hover
      let foundHover = null;
      for (const el of this.draggables) {
        const rect = el.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          foundHover = el;
          break;
        }
      }

      // Update hovered element and classes
      if (hand.hoveredElement !== foundHover) {
        if (hand.hoveredElement) {
            // Only remove class if no OTHER hand is hovering it
            const otherHandsHovering = this.hands.some((h, idx) => idx !== handIndex && h.hoveredElement === hand.hoveredElement);
            if (!otherHandsHovering) hand.hoveredElement.classList.remove('hover');
        }
        hand.hoveredElement = foundHover;
        if (hand.hoveredElement) hand.hoveredElement.classList.add('hover');
      }

      // Update state based on current findings
      if (hand.hoveredElement) {
        hand.state = States.HOVER;
      } else {
        hand.state = States.IDLE;
      }

      // If pinching and we have a target, start dragging
      if (isPinching && hand.hoveredElement) {
        this.handlePinchStart(position, handIndex);
      }
    } else {
      // Currently dragging
      const targetX = x - hand.offset.x;
      const targetY = y - hand.offset.y;
      hand.draggedElement.style.left = `${targetX}px`;
      hand.draggedElement.style.top = `${targetY}px`;
    }

    return {
      state: hand.state,
      target: hand.draggedElement?.id || hand.hoveredElement?.id || 'None'
    };
  }
}
