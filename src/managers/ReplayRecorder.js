class ReplayRecorder {
  constructor() {
    this.frames = [];
    this.isRecording = false;
    this.lastCapture = 0;
    this.captureInterval = 100; // ms between keyframes (10fps)
  }

  start() {
    this.frames = [];
    this.isRecording = true;
    this.lastCapture = 0;
    console.log("[REPLAY] Recording started.");
  }

  stop() {
    this.isRecording = false;
    console.log(`[REPLAY] Recording stopped. ${this.frames.length} frames captured.`);
    return [...this.frames];
  }

  record(clockSeconds, position, rotationY) {
    if (!this.isRecording) return;
    const now = clockSeconds * 1000;
    if (now - this.lastCapture < this.captureInterval) return;
    this.lastCapture = now;
    this.frames.push({
      t: Math.round(now),
      x: parseFloat(position.x.toFixed(2)),
      y: parseFloat(position.y.toFixed(2)),
      z: parseFloat(position.z.toFixed(2)),
      ry: parseFloat(rotationY.toFixed(3)),
    });
  }

  getFrames() {
    return [...this.frames];
  }
}

export const replayRecorder = new ReplayRecorder();