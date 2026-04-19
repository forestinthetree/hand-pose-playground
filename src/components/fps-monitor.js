class FPSMonitor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fps = 0;
  }

  connectedCallback() {
    this.render();
    this.update();
  }

  update() {
    const now = performance.now();
    this.frameCount++;

    if (now >= this.lastTime + 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.lastTime));
      this.frameCount = 0;
      this.lastTime = now;
      this.displayFPS();
    }

    this.animationId = requestAnimationFrame(() => this.update());
  }

  disconnectedCallback() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  displayFPS() {
    const span = this.shadowRoot.querySelector('#fps-value');
    if (span) {
      span.textContent = this.fps;
      // Change color based on performance
      if (this.fps < 30) {
        span.style.color = '#ff4757';
      } else if (this.fps < 50) {
        span.style.color = '#ffa502';
      } else {
        span.style.color = '#2ed573';
      }
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
          font-family: monospace;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          pointer-events: none;
          user-select: none;
          min-width: 70px;
          text-align: center;
        }
        .label {
          font-size: 10px;
          text-transform: uppercase;
          opacity: 0.6;
          display: block;
          margin-bottom: 2px;
        }
        #fps-value {
          font-size: 18px;
          font-weight: bold;
        }
        .unit {
          font-size: 10px;
          opacity: 0.6;
        }
      </style>
      <span class="label">Performance</span>
      <span id="fps-value">--</span>
      <span class="unit">FPS</span>
    `;
  }
}

customElements.define('fps-monitor', FPSMonitor);
