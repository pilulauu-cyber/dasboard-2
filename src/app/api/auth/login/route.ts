import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/meli';

export async function GET() {
  try {
    const url = getAuthUrl();
    return NextResponse.redirect(url);
  } catch (error: any) {
    console.error('Error in login route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
