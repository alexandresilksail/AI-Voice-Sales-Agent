class OfflinePcmCapture extends AudioWorkletProcessor {
 constructor(options) { super(); this.targetRate = options.processorOptions?.targetRate || 16000; this.ratio = sampleRate / this.targetRate; this.position = 0; this.packet = new Int16Array(320); this.offset = 0; this.previous = 0; }
 process(inputs, outputs) {
  const input = inputs[0]?.[0]; const output = outputs[0]?.[0]; if (output) output.fill(0); if (!input) return true;
  while (this.position < input.length) {
   const index = Math.floor(this.position), fraction = this.position - index;
   const left = index === 0 ? this.previous : input[index - 1]; const right = input[index] ?? input[input.length - 1];
   const value = Math.max(-1, Math.min(1, left + (right - left) * fraction));
   this.packet[this.offset++] = value < 0 ? Math.round(value * 32768) : Math.round(value * 32767);
   if (this.offset === this.packet.length) { const chunk = this.packet; this.port.postMessage(chunk, [chunk.buffer]); this.packet = new Int16Array(320); this.offset = 0; }
   this.position += this.ratio;
  }
  this.position -= input.length; this.previous = input[input.length - 1]; return true;
 }
}
registerProcessor('offline-pcm-capture', OfflinePcmCapture);
