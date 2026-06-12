import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode } from '@/lib/meli';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    console.error('OAuth callback error from Mercado Libre:', error);
    return NextResponse.redirect(new URL(`/?auth_success=false&error=${encodeURIComponent(error)}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?auth_success=false&error=Missing+code', request.url));
  }

  try {
    await exchangeCode(code);
    // Redirigir al inicio indicando que el enlace fue exitoso
    return NextResponse.redirect(new URL('/?auth_success=true', request.url));
  } catch (err: any) {
    console.error('Error in OAuth exchange callback:', err);
    return NextResponse.redirect(new URL(`/?auth_success=false&error=${encodeURIComponent(err.message)}`, request.url));
  }
}
