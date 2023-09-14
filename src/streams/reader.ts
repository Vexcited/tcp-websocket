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
  
  read (n: number): Buffer | null {
    if (n > this._queueSize) return null;
    if (n === 0) return Buffer.alloc(0);
  
    // update the buffer size in queue.
    this._queueSize -= n;
  
    // get the first buffer in queue for easier reference
    const first_buffer = this._queue[0];
  
    if (first_buffer.length === n) {
      console.log("read: return queue shift");
      return this._queue.shift() as Buffer;
    }
    else if (first_buffer.length > n) {
      const buffer = first_buffer.subarray(0, n);
      this._queue[0] = first_buffer.subarray(n);
      
      console.log("read: return buffer");
      return buffer;
    }
  
    let i = 0, j = this._queue.length;
    while (i < j) {
      if (j < this._queue[i].length) break;
      j -= this._queue[i].length;
      i++;
    }

    console.log("read: while loop", i, j)
    const buffers = this._queue.splice(0, i);
  
    if (n > 0 && this._queue.length > 0) {
      buffers.push(this._queue[0].subarray(0, n));
      this._queue[0] = this._queue[0].subarray(n);
    }
    
    return Buffer.concat(buffers, n);
  };
}

export default StreamReader;
