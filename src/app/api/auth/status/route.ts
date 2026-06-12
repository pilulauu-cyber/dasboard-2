import { NextResponse } from 'next/server';
import { getTokens } from '@/lib/storage';

export async function GET() {
  try {
    const tokens = await getTokens();
    if (tokens && tokens.access_token) {
      let nickname = 'Conectado';
      try {
        const userRes = await fetch(`https://api.mercadolibre.com/users/${tokens.user_id}`, {
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
            'Accept': 'application/json'
          }
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          nickname = userData.nickname || userData.first_name || 'Conectado';
        }
      } catch (err) {
        console.error('Error fetching user nickname:', err);
      }

      return NextResponse.json({
        authorized: true,
        seller_id: tokens.user_id,
        nickname: nickname,
        expires_at: tokens.expires_at
      });
    }
    return NextResponse.json({ authorized: false });
  } catch (error: any) {
    console.error('Error checking auth status:', error);
    return NextResponse.json({ authorized: false, error: error.message }, { status: 500 });
  }
}
