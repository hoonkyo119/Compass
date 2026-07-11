import { NextResponse } from 'next/server';

const sampleNews = [
  { id: 1, title: 'Sample News Item 1', category: 'technology' },
  { id: 2, title: 'Sample News Item 2', category: 'business' },
  { id: 3, title: 'Sample News Item 3', category: 'sports' },
];

export async function GET() {
  return NextResponse.json({ news: sampleNews });
}
