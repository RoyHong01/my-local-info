export function sanitizeMarkdown(markdown: string): string {
  if (!markdown) return '';

  const normalized = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const normalizedListIndent = normalizeIndentedBulletsAfterOrderedList(normalized);
  const normalizedShortcutLinks = normalizeShortcutCtaLinks(normalizedListIndent);
  const coordinatePattern = /\b(?:좌표|위도|경도|북위|남위|동경|서경|지도상\s*좌표|📍)\b|°[NSWE]|\d+\.\d+\s*[, ]\s*\d+\.\d+/i;

  const lines = normalizedShortcutLinks
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      return !coordinatePattern.test(trimmed);
    });

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function normalizeIndentedBulletsAfterOrderedList(markdown: string): string {
  const lines = markdown.split('\n');
  let lastOrderedListLine = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^\d+\.\s+/.test(trimmed)) {
      lastOrderedListLine = true;
      continue;
    }

    if (!trimmed) {
      continue;
    }

    if (lastOrderedListLine && /^\s{4,}[-*+]\s+/.test(line)) {
      lines[i] = line.replace(/^\s{4,}([-*+]\s+)/, '  $1');
    }

    lastOrderedListLine = false;
  }

  return lines.join('\n');
}

function normalizeShortcutCtaLinks(markdown: string): string {
  const shortcutLinkPattern = /\[[^\]]*바로가기[^\]]*\]\(https?:\/\/[^)\s]+\)/;
  const lines = markdown.split('\n');
  const normalizedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const match = line.match(shortcutLinkPattern);

    if (!match) {
      normalizedLines.push(line);
      continue;
    }

    if (/^\|/.test(trimmed)) {
      normalizedLines.push(line);
      continue;
    }

    const linkMarkdown = match[0];
    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);

    if (listMatch) {
      const [, indent, marker, content] = listMatch;
      const contentLinkIndex = content.indexOf(linkMarkdown);

      if (contentLinkIndex < 0 || content.trim() === linkMarkdown) {
        normalizedLines.push(line);
        continue;
      }

      const contentPrefix = content.slice(0, contentLinkIndex).trimEnd();
      const contentSuffix = content.slice(contentLinkIndex + linkMarkdown.length).trimStart();

      if (contentPrefix) {
        normalizedLines.push(`${indent}${marker} ${contentPrefix}`);
      } else {
        normalizedLines.push(`${indent}${marker}`);
      }

      normalizedLines.push(`${indent}  ${linkMarkdown}`);
      if (contentSuffix) normalizedLines.push(`${indent}  ${contentSuffix}`);
      continue;
    }

    const linkIndex = line.indexOf(linkMarkdown);

    if (linkIndex < 0 || trimmed === linkMarkdown) {
      normalizedLines.push(line);
      continue;
    }

    const prefix = line.slice(0, linkIndex).trimEnd();
    const suffix = line.slice(linkIndex + linkMarkdown.length).trimStart();

    if (prefix) normalizedLines.push(prefix);
    normalizedLines.push('');
    normalizedLines.push(linkMarkdown);
    if (suffix) {
      normalizedLines.push('');
      normalizedLines.push(suffix);
    }
  }

  return normalizedLines.join('\n');
}
