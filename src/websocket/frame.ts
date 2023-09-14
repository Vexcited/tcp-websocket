class Frame {
  public final = false;
  public rsv1 = false;
  public rsv2 = false;
  public rsv3 = false;
  public opcode: number | null = null;
  public masked = false;
  public maskingKey: Buffer | null = null;
  public lengthBytes = 1;
  public length = 0;
  public payload: Buffer | null = null;
}

export default Frame;
