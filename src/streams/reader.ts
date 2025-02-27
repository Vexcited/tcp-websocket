class StreamReader {
  private _queue: Buffer[]
  private _queueSize: number
  
  constructor () {
    this._queue = [];
    this._queueSize = 0;
  }

  /**
   * adds a buffer in queue.
   * @param buffer - what we want to add in the queue
   */
  put (buffer: Buffer): void {
    // when the buffer is empty, we have nothing to do
    if (buffer.length === 0) return;
    
    this._queue.push(buffer);
    this._queueSize += buffer.length;
  };
  
  read(n: number): Buffer | null {
    if (n > this._queueSize) return null;
    if (n === 0) return Buffer.alloc(0);

    this._queueSize -= n;

    const first_buffer = this._queue[0];

    if (first_buffer.length === n) {
      return this._queue.shift()!;
    } else if (first_buffer.length > n) {
      const buffer = first_buffer.subarray(0, n);
      this._queue[0] = first_buffer.subarray(n);
      return buffer;
    }

    let totalBytesRead = 0;
    const buffersToConcat: Buffer[] = [];

    for (let i = 0; i < this._queue.length;) {
      const currentBuffer = this._queue[i];
      if (totalBytesRead + currentBuffer.length <= n) {
        buffersToConcat.push(currentBuffer);
        totalBytesRead += currentBuffer.length;
        this._queue.shift(); // remove the buffer from the queue
      } else {
        const remainingBytes = n - totalBytesRead;
        buffersToConcat.push(currentBuffer.subarray(0, remainingBytes));
        this._queue[i] = currentBuffer.subarray(remainingBytes);
        break;
      }
    }

    return Buffer.concat(buffersToConcat, n);
  };
}

export default StreamReader;
