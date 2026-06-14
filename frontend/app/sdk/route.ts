import { readFileSync } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';

export async function GET() {
  const sdkPath = join(process.cwd(), '..', 'mobile-sdk', 'index.html');
  try {
    const html = readFileSync(sdkPath, 'utf-8');
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' }
    });
  } catch {
    return new NextResponse('<h1>SDK not found</h1>', { status: 404 });
  }
}
