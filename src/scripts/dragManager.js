export class DragManager {
  constructor() {
    this.draggables = [];
    this.draggedElement = null;
    this.offset = { x: 0, y: 0 };
  }

  register(element) {
    this.draggables.push(element);
    element.style.position = 'absolute';
    element.style.cursor = 'grab';
  }

  handlePinchStart(position) {
    const x = position[0];
    const y = position[1];

    // Check if we hit any draggable element
    // Note: We need to scale these coordinates if the video is scaled or offset
    // For simplicity, we assume the hand coordinates map directly to viewport or relative container
    for (const el of this.draggables) {
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        this.draggedElement = el;
        this.offset.x = x - rect.left;
        this.offset.y = y - rect.top;
        el.style.cursor = 'grabbing';
        el.classList.add('active');
        break;
      }
    }
  }

  handlePinchEnd() {
    if (this.draggedElement) {
      this.draggedElement.style.cursor = 'grab';
      this.draggedElement.classList.remove('active');
      this.draggedElement = null;
    }
  }

  updatePosition(position) {
    if (this.draggedElement) {
      const x = position[0] - this.offset.x;
      const y = position[1] - this.offset.y;
      this.draggedElement.style.left = `${x}px`;
      this.draggedElement.style.top = `${y}px`;
    }
  }
}
