import { randomInt } from "node:crypto";

// Excludes visually ambiguous characters: 0/O, 1/I.
const KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SEGMENT_LENGTH = 4;
const SEGMENT_COUNT = 3;

function randomSegment(): string {
  let segment = "";
  for (let i = 0; i < SEGMENT_LENGTH; i++) {
    segment += KEY_ALPHABET[randomInt(KEY_ALPHABET.length)];
  }
  return segment;
}

/** Generates a key like `SYMBIOS-4F9K-QX7T-2MRN`. */
export function generateKeyValue(prefix: string): string {
  const segments = Array.from({ length: SEGMENT_COUNT }, () => randomSegment());
  return `${prefix}-${segments.join("-")}`;
}
