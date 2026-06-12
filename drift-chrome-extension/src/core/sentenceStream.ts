// Flush complete sentences out of a growing buffer so TTS can start speaking
// sentence 1 while the brain is still generating sentence 2 (low time-to-first-
// audio). A sentence ends at .!? followed by whitespace or end-of-buffer, so a
// decimal like "3.14" mid-stream stays buffered until more text proves the break.
// Pure → unit-testable.

export function takeSentences(buffer: string): { sentences: string[]; rest: string } {
  const sentences: string[] = [];
  const re = /[^.!?]*[.!?]+(?=\s|$)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(buffer))) {
    const s = m[0].trim();
    if (s) sentences.push(s);
    lastIndex = re.lastIndex;
  }
  return { sentences, rest: buffer.slice(lastIndex) };
}
