import { expect, describe, it, beforeEach } from 'vitest';
import { HuffmanEncoding } from './huffman.mjs';

describe('HuffmanEncoding', () => {
  let text: string;
  let huffman: HuffmanEncoding;
  let textBuffer: Buffer;

  beforeEach(() => {
    text = 'mississippi river';
    huffman = HuffmanEncoding.buildEncodingFromFile(Buffer.from(text));
    textBuffer = Buffer.from(text);
  });

  describe('buildEncodingFromFile', () => {
    it('throws an error when encoding the empty string ', () => {
      const emptyString = Buffer.from('');
      expect(() => HuffmanEncoding.buildEncodingFromFile(emptyString)).toThrow();
    });
    it(`constructs the correct encoding for 'mississippi river'`, () => {
      const expectedTree: [number, string][] = [
        [115, '00'], // s
        [114, '010'], // r
        [109, '0110'], //m
        [32, '0111'], // SPACE
        [105, '10'], // i
        [118, '1100'], // v
        [101, '1101'], // e
        [3, '1110'], // END OF TEXT
        [112, '1111'], // p
      ];

      // a prefix free tree that respects the frequency analysis.
      const expectedResult = new HuffmanEncoding(expectedTree);

      const actualTree = HuffmanEncoding.buildEncodingFromFile(textBuffer);
      expect(actualTree).toEqual(expectedResult);
    });
    // it('Throws an error when the file is bigger than 5MB', () => {
    //   text = fs.readFileSync('assets/textfiles-huffman/shakespeare.txt', 'ascii');
    //   const textBuff = Buffer.from(text);
    //   expect(() => HuffmanEncoding.buildEncodingFromFile(textBuff)).toThrow();
    // });
  });

  describe('encode', () => {
    it(`correctly encodes 'mississippi river' with the corresponding huffman tree`, () => {
      //    m      i       s       s       i       s       s       i       p       p       i          SPACE
      //    0110   10      00      00      10      00      00      10      1111    1111    10         0111

      //    r       i       v       e       r       END OF TEXT
      //    010     10      1100    1101    010     1110

      // => 01101000 00100000 10111111 11100111 01010110 01101010 ----1110     (binary)
      // =>    68       20       bf       e7       56       6a       e0        (hex)
      const expectedEncoding = Buffer.from('6820bfe7566ae0', 'hex');

      const actualEncoding = huffman.encode(textBuffer);
      expect(actualEncoding).toEqual(expectedEncoding);
    });
    it('throws an error when a symbol doesnt occure in the huffman tree', () => {
      const katakanaInText = text + String.fromCharCode(12484);
      expect(() => huffman.encode(Buffer.from(katakanaInText))).toThrow();
    });
  });
  describe('decode', () => {
    it('decodes back to the original buffer.', () => {
      const EncodedText = huffman.encode(textBuffer);

      const actualResult = huffman.decode(EncodedText);
      expect(actualResult).toEqual(textBuffer);
      expect(actualResult.toString()).toEqual(text);
    });
  });
});
