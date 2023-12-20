import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'node-html-parser';

export const GET = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  if (!url) return;

  const response = await fetch(url, { method: 'GET' });
  const text = await response.text();
  const doc = parse(text).querySelector('#doc');

  const markdown = doc?.childNodes[0].rawText;
  if (!markdown) return;

  const lines = markdown.split('\n');
  const firstTitleIndex = lines.findIndex((line) => line.startsWith('#'));
  const secondTitleIndex = lines.findIndex(
    (line, i) => i > firstTitleIndex && line.startsWith('#'),
  );
  const thridTitleIndex = lines.findIndex(
    (line, i) => i > secondTitleIndex && line.startsWith('#'),
  );

  const title = lines[firstTitleIndex].replace('# ', '');
  let description = lines.slice(secondTitleIndex + 1, thridTitleIndex).join('\n');
  description = description.replace(/^\n+/, '');

  return NextResponse.json({ title, description });
};
