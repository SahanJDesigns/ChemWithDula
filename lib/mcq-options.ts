/** Five-option MCQ: DB columns option_a … option_e, letters a–e. */

export const MCQ_OPTION_KEYS = ['option_a', 'option_b', 'option_c', 'option_d', 'option_e'] as const;
export type McqOptionKey = (typeof MCQ_OPTION_KEYS)[number];

export const MCQ_OPTION_IMAGE_KEYS = [
  'option_a_image_url',
  'option_b_image_url',
  'option_c_image_url',
  'option_d_image_url',
  'option_e_image_url',
] as const;
export type McqOptionImageKey = (typeof MCQ_OPTION_IMAGE_KEYS)[number];

export const MCQ_OPTION_VALUES = ['a', 'b', 'c', 'd', 'e'] as const;
export type McqOptionLetter = (typeof MCQ_OPTION_VALUES)[number];

export const MCQ_OPTION_LABELS: Record<McqOptionLetter, string> = {
  a: '1',
  b: '2',
  c: '3',
  d: '4',
  e: '5',
};

export const OPTION_KEY_TO_IMAGE_KEY: Record<McqOptionKey, McqOptionImageKey> = {
  option_a: 'option_a_image_url',
  option_b: 'option_b_image_url',
  option_c: 'option_c_image_url',
  option_d: 'option_d_image_url',
  option_e: 'option_e_image_url',
};

export const OPTION_LETTER_TO_IMAGE_KEY: Record<McqOptionLetter, McqOptionImageKey> = {
  a: 'option_a_image_url',
  b: 'option_b_image_url',
  c: 'option_c_image_url',
  d: 'option_d_image_url',
  e: 'option_e_image_url',
};

export function isImageUrl(str?: string | null): boolean {
  if (!str) return false;
  const s = str.trim().toLowerCase();
  return (
    s.startsWith('http://') ||
    s.startsWith('https://') ||
    s.startsWith('/uploads/') ||
    s.startsWith('data:image/') ||
    /\.(png|jpe?g|webp|gif|svg)$/i.test(s)
  );
}

export function getOptionImageUrl(question: any, letter: McqOptionLetter): string | null {
  if (!question) return null;
  const imgKey = OPTION_LETTER_TO_IMAGE_KEY[letter];
  const directImg = question[imgKey];
  if (directImg && typeof directImg === 'string' && directImg.trim()) {
    return directImg.trim();
  }
  const textKey = `option_${letter}`;
  const textVal = question[textKey];
  if (textVal && isImageUrl(textVal)) {
    return textVal.trim();
  }
  return null;
}

