import { Chalk } from 'chalk';

/**
 * Systems of functions to check for the presence of types of characters.
 */
class Entropy {
  upperCase = 0;
  lowerCase = 0;
  numbers = 0;
  specialChar = 0;

  /**
   * Checks if the character is uppercase.
   * @param ch the inspected character.
   */
  isUpperCase = (ch: string) => {
    if (/[A-Z]/.test(ch)) this.upperCase = 1;
  };

  /**
   * Checks if the character is lowercase.
   * @param ch the inspected character.
   */
  isLowerCase = (ch: string) => {
    if (/[a-z]/.test(ch)) this.lowerCase = 1;
  };

  /**
   * Checks if the character is a number.
   * @param ch the inspected character.
   */
  isNumber = (ch: string) => {
    if (!isNaN(+ch)) this.numbers = 1;
  };

  /**
   * Checks if the character is a special character.
   * @param ch the inspected character.
   */
  isSpecialCharacter = (ch: string) => {
    if (/[^A-Za-z0-9\s]/.test(ch)) this.specialChar = 1;
  };
}

/**
 * Calculates the total entropy of a given password.
 * @param password
 * @returns a float representing the total entropy.
 */
export function passwordEntropy(password: string): number {
  const passentro = new Entropy();
  for (const ch of password) {
    passentro.isLowerCase(ch);
    passentro.isUpperCase(ch);
    passentro.isNumber(ch);
    passentro.isSpecialCharacter(ch);
  }
  const totalEntropy =
    26 * passentro.lowerCase + 26 * passentro.upperCase + 10 * passentro.numbers + 32 * passentro.specialChar;
  return Math.log2(totalEntropy) * password.length;
}

/**
 * Returns the strength of a password.
 * @param password the password to be checked.
 * @returns WEAK | MEDIUM | STRONG
 */
export function passwordStrength(password: string): string {
  const color = new Chalk({ level: 1 });
  if (password.length === 0) {
    return color.red('WEAK');
  }
  const strength = passwordEntropy(password);
  if (strength < 45) {
    return color.red('WEAK');
  } else if (strength < 85) {
    return color.yellow('MEDIUM');
  } else return color.green('STRONG');
}
