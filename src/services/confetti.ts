/**
 * High-performance Canvas Confetti & Fireworks Particle Engine
 * 100% dependency-free, smooth 60fps animations.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  tilt: number;
  tiltSpeed: number;
  shape: 'rect' | 'circle' | 'star';
  life: number;
  maxLife: number;
  opacity: number;
}

const FESTIVE_COLORS = [
  '#FF3366', '#FF9900', '#FFCC00', '#33CC66', 
  '#3399FF', '#9933FF', '#FF66B2', '#00E5FF', '#FFD700'
];

export class ConfettiEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private animationFrameId: number | null = null;
  private isRunning: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context not supported');
    this.ctx = context;
  }

  public resize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.canvas.parentElement?.clientWidth ? this.canvas.parentElement.clientWidth * dpr : window.innerWidth * dpr;
    this.canvas.height = this.canvas.parentElement?.clientHeight ? this.canvas.parentElement.clientHeight * dpr : window.innerHeight * dpr;
    this.ctx.scale(dpr, dpr);
  }

  public fireCelebration(count: number = 220): void {
    const width = this.canvas.parentElement?.clientWidth || window.innerWidth;
    const height = this.canvas.parentElement?.clientHeight || window.innerHeight;

    // Burst from bottom corners & bottom center
    for (let i = 0; i < count; i++) {
      const originX = i % 3 === 0 ? width * 0.15 : i % 3 === 1 ? width * 0.85 : width * 0.5;
      const originY = height * 0.85;

      const angle = i % 3 === 0 
        ? -Math.PI / 4 + (Math.random() - 0.5) * 0.6
        : i % 3 === 1
        ? -3 * Math.PI / 4 + (Math.random() - 0.5) * 0.6
        : -Math.PI / 2 + (Math.random() - 0.5) * 0.9;

      const speed = 12 + Math.random() * 18;
      const shapes: ('rect' | 'circle' | 'star')[] = ['rect', 'rect', 'circle', 'star'];

      this.particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 4,
        vy: Math.sin(angle) * speed - Math.random() * 6,
        size: 7 + Math.random() * 8,
        color: FESTIVE_COLORS[Math.floor(Math.random() * FESTIVE_COLORS.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.25,
        tilt: Math.random() * Math.PI,
        tiltSpeed: 0.08 + Math.random() * 0.1,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        life: 0,
        maxLife: 200 + Math.random() * 120,
        opacity: 1
      });
    }

    if (!this.isRunning) {
      this.isRunning = true;
      this.loop();
    }
  }

  private loop = (): void => {
    if (!this.isRunning) return;

    const width = this.canvas.parentElement?.clientWidth || window.innerWidth;
    const height = this.canvas.parentElement?.clientHeight || window.innerHeight;

    this.ctx.clearRect(0, 0, width, height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Physics
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.28; // Gravity
      p.vx *= 0.985; // Air friction
      p.vy *= 0.985;

      p.rotation += p.rotationSpeed;
      p.tilt += p.tiltSpeed;
      p.life++;

      // Fade out towards end
      if (p.life > p.maxLife * 0.7) {
        p.opacity = Math.max(0, 1 - (p.life - p.maxLife * 0.7) / (p.maxLife * 0.3));
      }

      if (p.life >= p.maxLife || p.y > height + 50) {
        this.particles.splice(i, 1);
        continue;
      }

      // Draw particle
      this.ctx.save();
      this.ctx.globalAlpha = p.opacity;
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rotation);
      this.ctx.fillStyle = p.color;

      const scaleY = Math.sin(p.tilt);

      if (p.shape === 'rect') {
        this.ctx.fillRect(-p.size / 2, (-p.size / 2) * scaleY, p.size, p.size * 1.5 * scaleY);
      } else if (p.shape === 'circle') {
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, p.size / 2, (p.size / 2) * Math.abs(scaleY), 0, 0, Math.PI * 2);
        this.ctx.fill();
      } else if (p.shape === 'star') {
        this.drawStar(0, 0, 4, p.size / 2, p.size / 4);
      }

      this.ctx.restore();
    }

    if (this.particles.length > 0) {
      this.animationFrameId = requestAnimationFrame(this.loop);
    } else {
      this.isRunning = false;
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    }
  };

  private drawStar(cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number): void {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy - outerRadius);

    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      this.ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      this.ctx.lineTo(x, y);
      rot += step;
    }
    this.ctx.lineTo(cx, cy - outerRadius);
    this.ctx.closePath();
    this.ctx.fill();
  }

  public clear(): void {
    this.particles = [];
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    const width = this.canvas.parentElement?.clientWidth || window.innerWidth;
    const height = this.canvas.parentElement?.clientHeight || window.innerHeight;
    this.ctx.clearRect(0, 0, width, height);
  }
}
