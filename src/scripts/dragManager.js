export class DragManager {
  constructor() {
    this.draggables = [];
    this.draggedElement = null;
    this.hoveredElement = null;
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

    for (const el of this.draggables) {
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        this.draggedElement = el;
        this.offset.x = x - rect.left;
        this.offset.y = y - rect.top;
        el.classList.add('dragging');
        el.style.zIndex = '1000'; // Bring to front while dragging
        console.log('Started dragging:', el.id);
        break;
      }
    }
  }

  handlePinchEnd() {
    if (this.draggedElement) {
      this.draggedElement.classList.remove('dragging');
      this.draggedElement.style.zIndex = '10';
      this.draggedElement = null;
      console.log('Stopped dragging');
    }
  }

  updatePosition(position) {
    const x = position[0];
    const y = position[1];

    // Handle Hover state
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
      if (this.hoveredElement) this.hoveredElement.classList.add('hover');
    }

    // Handle Dragging
    if (this.draggedElement) {
      const targetX = x - this.offset.x;
      const targetY = y - this.offset.y;
      this.draggedElement.style.left = `${targetX}px`;
      this.draggedElement.style.top = `${targetY}px`;
    }
  }
}
