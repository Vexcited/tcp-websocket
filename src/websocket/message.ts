import type Frame from "./frame.js";

class Message {
  public rsv1 = false;
  public rsv2 = false;
  public rsv3 = false;
  public opcode: number | null = null;
  public length = 0;
  public data: Buffer | undefined;
  #chunks: Buffer[] = [];
  
  read () {
    this.data = this.data ?? Buffer.concat(this.#chunks, this.length);
    return this.data;
  }
  
  pushFrame (frame: Frame) {
    this.rsv1 = this.rsv1 ?? frame.rsv1;
    this.rsv2 = this.rsv2 ?? frame.rsv2;
    this.rsv3 = this.rsv3 ?? frame.rsv3;
  
    if (typeof this.opcode !== "number") {
      this.opcode = frame.opcode;
    }
  
    this.#chunks.push(frame.payload!);
    this.length += frame.length;
  }
};

export default Message;
