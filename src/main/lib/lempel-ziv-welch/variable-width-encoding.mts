export class VariableWidthEncoding {
  static toBuffer(data: number[]): Buffer {
    let entryLength = 9;
    const bytes = [];
    let byte = '';
    let i = 0;
    for (const num of data) {
      i++;
      let bin = num.toString(2);
      bin = bin.padStart(entryLength, '0');

      for (const sign of bin) {
        byte += sign;
        if (byte.length === 8) {
          bytes.push(parseInt(byte, 2));
          byte = '';
        }
      }

      if (i + 256 === 2 ** entryLength - 1) {
        entryLength++;
      }
    }

    if (byte !== '') {
      byte = byte.padEnd(8, '0'); // Pad to fill remaining byte
      bytes.push(parseInt(byte, 2));
    }

    return Buffer.from(bytes);
  }

  static fromBuffer(buffer: Buffer): number[] {
    const nums: number[] = [];
    let num = 0;
    let bitsLeft = 0;
    let entryLength = 9; // Start with an initial entry length

    for (const byte of buffer) {
      const bin = byte.toString(2).padStart(8, '0');
      for (const sign of bin) {
        num = (num << 1) | parseInt(sign);
        bitsLeft++;

        if (bitsLeft === entryLength) {
          nums.push(num);
          num = 0;
          bitsLeft = 0;
        }
      }

      // Update entry length if needed
      if (nums.length + 256 === 2 ** entryLength - 1) {
        entryLength++;
      }
    }

    return nums;
  }
}
