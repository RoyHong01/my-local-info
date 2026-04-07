export function sanitizeMarkdown(markdown: string): string {
  if (!markdown) return '';

  const normalized = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const coordinatePattern = /\b(?:좌표|위도|경도|북위|남위|동경|서경|지도상\s*좌표|📍)\b|°[NSWE]|\d+\.\d+\s*[, ]\s*\d+\.\d+/i;

  const lines = normalized
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      return !coordinatePattern.test(trimmed);
    });

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
