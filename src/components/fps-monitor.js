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
          font-family: inherit;
          pointer-events: none;
          user-select: none;
        }
        #fps-value {
          font-weight: bold;
          font-family: monospace;
        }
        .label {
          margin-right: 4px;
        }
      </style>
      <span class="label">FPS:</span>
      <span id="fps-value">--</span>
    `;
  }
}

customElements.define('fps-monitor', FPSMonitor);
