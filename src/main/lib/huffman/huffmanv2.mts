import { Readable } from 'stream';

abstract class Node {
  weight: number;
  constructor(weight: number) {
    this.weight = weight;
  }

  getWeight(): number {
    return this.weight;
  }

  abstract getEncodings(prefix: string): [number, string][];
}

class ValueNode extends Node {
  value: number;

  constructor(value: number, weight: number) {
    super(weight);
    this.weight = weight;
    this.value = value;
  }

  getEncodings(prefix: string): [number, string][] {
    return [[this.value, prefix]];
  }
}

class BranchingNode extends Node {
  leftChild: Node;
  rightChild: Node;

  constructor(leftChild: Node, rightChild: Node) {
    super(leftChild.getWeight() + rightChild.getWeight());
    this.leftChild = leftChild;
    this.rightChild = rightChild;
  }

  getEncodings(prefix: string): [number, string][] {
    return [...this.leftChild.getEncodings(prefix + '0'), ...this.rightChild.getEncodings(prefix + '1')];
  }
}

/**
 * Class used to encode text files.
 */
export class HuffmanEncodingV2 {
  encoding: [number, string][];

  /**
   * creates a HuffmanEncodingV2 instance. Used before decoding a file.
   *
   * @param encoding - an array of tupels which represents a huffman encoding map.
   */
  constructor(encoding: [number, string][]) {
    this.encoding = encoding;
  }

  /**
   * Used to create a huffmantree of a textfile.
   *
   * @param data - a buffer of the textfile.
   * @returns The corresponding HuffmanEncodingV2 instance.
   */
  static buildEncodingFromFile(data: Buffer): HuffmanEncodingV2 {
    const huffmanTree = HuffmanEncodingV2.buildHuffmanTree(data);
    return new HuffmanEncodingV2(huffmanTree.getEncodings(''));
  }

  private static buildHuffmanTree(stringToEncode: Buffer): Node {
    if (stringToEncode.length === 0) {
      throw new Error('Cannot encode an empty string.');
    }

    const endedString = Buffer.from([...stringToEncode, 3]);

    const letterOccurrence = countLetterOccurrences(endedString);
    let subTrees: Node[] = [...letterOccurrence].map((entry) => new ValueNode(...entry));
    while (subTrees.length > 1) {
      subTrees.sort((a, b) => a.getWeight() - b.getWeight());
      const leftTree = subTrees[0];
      const rightTree = subTrees[1];
      if (leftTree && rightTree) {
        const mergedSubtree = new BranchingNode(leftTree, rightTree);
        subTrees = subTrees.slice(2);
        subTrees.push(mergedSubtree);
      }
    }
    if (subTrees[0]) {
      return subTrees[0];
    } else {
      throw new Error("Couldn't build Huffman tree (This error shouldn't be able to occur)");
    }
  }

  /**
   * Encodes an UTF-8 text file with the encoding tree of this class.
   *
   * @param data - Readable stream of the text file.
   * @param output - Writable stream to write the encoded file.
   * @returns Promise that resolves when encoding is complete.
   */
  async encode(buffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const data = Readable.from(buffer);

      const encodingMap = new Map(this.encoding);
      let pushedBits = 0;
      let currentValue = 0;
      const result: number[] = [];

      data.on('data', (chunk) => {
        for (const byte of chunk) {
          const bitString = encodingMap.get(byte as number);
          if (bitString) {
            for (const bit of bitString) {
              pushedBits++;
              currentValue <<= 1;
              if (bit === '1') {
                currentValue |= 1;
              }
              if (pushedBits === 8) {
                result.push(currentValue);
                currentValue = 0;
                pushedBits = 0;
              }
            }
          } else {
            reject(
              new Error(
                `The character '${String.fromCharCode(
                  byte as number,
                )}' doesn't occur in this Huffman tree. Make sure to use the correct Huffman tree.`,
              ),
            );
          }
        }
      });

      data.on('end', () => {
        const bitString = encodingMap.get(3);
        if (bitString) {
          for (const bit of bitString) {
            pushedBits++;
            currentValue <<= 1;
            if (bit === '1') {
              currentValue |= 1;
            }
            if (pushedBits === 8) {
              result.push(currentValue);
              currentValue = 0;
              pushedBits = 0;
            }
          }
        } else {
          reject(
            new Error(
              `The character '${String.fromCharCode(
                3,
              )}' doesn't occur in this Huffman tree. Make sure to use the correct Huffman tree.`,
            ),
          );
        }

        if (pushedBits !== 0) {
          result.push(currentValue << (8 - pushedBits));
        }

        resolve(Buffer.from(result));
      });
    });
  }

  /**
   * Decodes a textfile with the encoding tree of this class.
   *
   * @param data - buffer of the encoded file.
   * @returns buffer  that respresends the decoded file.
   */
  decode(data: Buffer): Buffer {
    const decodingTree = new Map<string, number>();
    for (const x of this.encoding) {
      decodingTree.set(x[1], x[0]);
    }
    const result = [];
    let encodedString = '';
    for (const byte of data) {
      let bitIndex = 7;
      while (bitIndex >= 0) {
        const bit = byte & (1 << bitIndex);
        if (bit > 0) {
          encodedString += '1';
        } else {
          encodedString += '0';
        }
        const decodedChar = decodingTree.get(encodedString);
        if (decodedChar) {
          if (decodedChar === 3) {
            break;
          }
          result.push(decodedChar);
          encodedString = '';
        }
        bitIndex--;
      }
    }
    return Buffer.from(result);
  }
}

/**
 * Maps every byte to how many times it occurs in the text.
 *
 * @param buffer - string buffer
 * @returns map<byte, timesOccured>
 */
function countLetterOccurrences(buffer: Buffer): Map<number, number> {
  return buffer.reduce((result, char) => result.set(char, (result.get(char) || 0) + 1), new Map<number, number>());
}
