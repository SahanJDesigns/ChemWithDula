import JSZip from 'jszip';
import { McqOptionLetter } from '@/lib/mcq-options';

export interface ParsedZipQuestion {
  qNum: number;
  detectedAnswer: McqOptionLetter;
  rawAnswer: string;
  filename: string;
  previewUrl?: string; // object URL for instant thumbnail preview
  entry: JSZip.JSZipObject;
}

export interface ParsedZipResult {
  title: string;
  questions: ParsedZipQuestion[];
  unmatchedFiles: string[];
}

const ANSWER_MAP: Record<string, McqOptionLetter> = {
  '1': 'a',
  '2': 'b',
  '3': 'c',
  '4': 'd',
  '5': 'e',
  'a': 'a',
  'b': 'b',
  'c': 'c',
  'd': 'd',
  'e': 'e',
};

const QUESTION_FILE_REGEX = /^(?:q(?:uestion)?[_.\s-]*)?(\d+)[_.\s-]+([1-5a-eA-E])\.(png|jpe?g|webp|gif)$/i;

export async function parseExamZipFile(file: File, generatePreviews = true): Promise<ParsedZipResult> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const questions: ParsedZipQuestion[] = [];
  const unmatchedFiles: string[] = [];

  const rawEntries: Array<{
    relativePath: string;
    baseName: string;
    qNum: number;
    detectedAnswer: McqOptionLetter;
    rawAnswer: string;
    entry: JSZip.JSZipObject;
  }> = [];

  zip.forEach((relativePath, entry) => {
    if (entry.dir) return;
    if (relativePath.includes('__MACOSX') || relativePath.startsWith('.') || relativePath.includes('/.')) return;

    const baseName = relativePath.split('/').pop() || relativePath;
    const match = baseName.match(QUESTION_FILE_REGEX);
    if (match) {
      const qNum = parseInt(match[1], 10);
      const rawAns = match[2].toLowerCase();
      const mapped = ANSWER_MAP[rawAns];
      if (mapped) {
        rawEntries.push({
          relativePath,
          baseName,
          qNum,
          detectedAnswer: mapped,
          rawAnswer: match[2],
          entry,
        });
        return;
      }
    }

    unmatchedFiles.push(relativePath);
  });

  // Sort numerically by question number
  rawEntries.sort((a, b) => a.qNum - b.qNum);

  for (const item of rawEntries) {
    let previewUrl: string | undefined = undefined;
    if (generatePreviews) {
      try {
        const blob = await item.entry.async('blob');
        previewUrl = URL.createObjectURL(blob);
      } catch {
        // ignore preview failure
      }
    }

    questions.push({
      qNum: item.qNum,
      detectedAnswer: item.detectedAnswer,
      rawAnswer: item.rawAnswer,
      filename: item.baseName,
      previewUrl,
      entry: item.entry,
    });
  }

  const defaultTitle = file.name.replace(/\.zip$/i, '').trim();

  return {
    title: defaultTitle,
    questions,
    unmatchedFiles,
  };
}
