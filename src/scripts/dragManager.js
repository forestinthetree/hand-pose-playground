const States = {
  IDLE: 'IDLE',
  HOVER: 'HOVER',
  DRAGGING: 'DRAGGING'
};

export class DragManager {
  constructor() {
    this.draggables = [];
    this.draggedElement = null;
    this.hoveredElement = null;
    this.offset = { x: 0, y: 0 };
    this.state = States.IDLE;
  }

  register(element) {
    this.draggables.push(element);
    element.style.position = 'absolute';
    element.style.cursor = 'grab';
  }

  handlePinchStart(position) {
    const x = position[0];
    const y = position[1];

    if (this.state === States.HOVER && this.hoveredElement) {
      const rect = this.hoveredElement.getBoundingClientRect();
      this.draggedElement = this.hoveredElement;
      this.offset.x = x - rect.left;
      this.offset.y = y - rect.top;
      this.draggedElement.classList.add('dragging');
      this.draggedElement.style.zIndex = '1000';
      this.state = States.DRAGGING;
    }
  }

  handlePinchEnd() {
    if (this.state === States.DRAGGING) {
      this.draggedElement.classList.remove('dragging');
      this.draggedElement.style.zIndex = '10';
      this.draggedElement = null;
      this.state = States.IDLE; // Re-evaluate state on next update
    }
  }

  updatePosition(position) {
    const x = position[0];
    const y = position[1];

    if (this.state !== States.DRAGGING) {
      // Look for hover
      let foundHover = null;
      for (const el of this.draggables) {
        const rect = el.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          foundHover = el;
          break;
        }
      }

      if (this.hoveredElement !== foundHover) {
        if (this.hoveredElement) this.hoveredElement.classList.remove('hover');
        this.hoveredElement = foundHover;
        if (this.hoveredElement) {
          this.hoveredElement.classList.add('hover');
          this.state = States.HOVER;
        } else {
          this.state = States.IDLE;
        }
      }
    } else {
      // Currently dragging
      const targetX = x - this.offset.x;
      const targetY = y - this.offset.y;
      this.draggedElement.style.left = `${targetX}px`;
      this.draggedElement.style.top = `${targetY}px`;
    }

    return {
      state: this.state,
      target: this.draggedElement?.id || this.hoveredElement?.id || 'None'
    };
  }
}
