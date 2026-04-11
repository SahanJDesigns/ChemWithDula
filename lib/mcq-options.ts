/** Five-option MCQ: DB columns option_a … option_e, letters a–e. */

export const MCQ_OPTION_KEYS = ['option_a', 'option_b', 'option_c', 'option_d', 'option_e'] as const;
export type McqOptionKey = (typeof MCQ_OPTION_KEYS)[number];

export const MCQ_OPTION_VALUES = ['a', 'b', 'c', 'd', 'e'] as const;
export type McqOptionLetter = (typeof MCQ_OPTION_VALUES)[number];

export const MCQ_OPTION_LABELS: Record<McqOptionLetter, string> = {
  a: 'A',
  b: 'B',
  c: 'C',
  d: 'D',
  e: 'E',
};
