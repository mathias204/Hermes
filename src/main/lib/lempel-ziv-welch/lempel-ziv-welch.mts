/**
 * Class used to encode text files with Lempel-Ziv-Welch encoding
 */
export class LZW {
  /**
   * Encodes an ASCII textfile with Lempel-Ziv-Welch encoding
   *
   * @param data - buffer of the textfile.
   * @returns an array that represents the Lempel-Ziv-Welch-encoding.
   */
  static encode(data: Buffer): number[] {
    if (data.length === 0) return [];

    // Initialize dictionary Map<string,number> with single-byte strings
    const dict: Map<string, number> = new Map();
    for (let i = 0; i < 256; i++) {
      dict.set(String.fromCharCode(i), i);
    }

    const encoding: number[] = [];
    let sequence = '';

    for (const byte of data) {
      const char = String.fromCharCode(byte);
      const seqChar = sequence + char;
      if (dict.has(seqChar)) {
        sequence = seqChar; // add the character to the sequence for next iteration
      } else {
        encoding.push(dict.get(sequence)!); // output code of the sequence
        dict.set(seqChar, dict.size); // add the concatenated string to the end of the Map
        sequence = char;
      }
    }

    // Add last found sequence
    encoding.push(dict.get(sequence)!);
    return encoding;
  }

  /**
   * Decodes an Lempel-Ziv-Welch-encoding of a textfile.
   *
   * @param encoding - an array with the Lempel-Ziv-Welch-encoding of a file.
   * @returns a buffer that represents the decoded textfile or null when the encoding is invalid
   */
  static decode(encoding: number[]): Buffer {
    // Initialize dictionary Map<number,string> with single-byte strings
    const dict: Map<number, string> = new Map();
    for (let i = 0; i < 256; i++) {
      dict.set(i, String.fromCharCode(i));
    }

    let output: string = '';
    let entry: string | null = null;
    let oldCode: number | null = null; // code of previous iteration, null in first iteration
    let str: string;

    for (const code of encoding) {
      if (dict.has(code)) {
        str = dict.get(code)!;
        output += str;
      } else if (code === dict.size) {
        if (oldCode !== null && entry !== null) {
          str = entry + entry.charAt(0);
          output += str;
        } else {
          throw new Error('Invalid encoding.');
        }
      } else {
        throw new Error('Invalid encoding.');
      }
      if (oldCode !== null) {
        dict.set(dict.size, entry + str.charAt(0));
      }
      entry = str;
      oldCode = code;
    }

    return Buffer.from(output);
  }
}
