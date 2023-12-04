// @author Jakob Dilen
// @date 2023-11-27

import { Chalk } from 'chalk';

export const Color = {
  logError,
  logMessage,
};

const color = new Chalk({ level: 1 });

/**
 * Logs an error in a red color.
 * @param log The error  message to log.
 */
function logError(log: string): void {
  const colorLog = color.red(log);
  console.error(colorLog);
}
/**
 * Logs a given message, possibly in a specific color.
 * @param log The message to log.
 * @param RGB A specified color. If this field is left blanck the message is logged in white.
 */
function logMessage(log: string, RGB?: [number, number, number]): void {
  let colorLog: string;
  if (RGB !== undefined) {
    colorLog = color.rgb(RGB[0], RGB[1], RGB[2])(log);
  } else {
    colorLog = color.white(log);
  }
  console.log(colorLog);
}
