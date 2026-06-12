import { NextResponse } from 'next/server';
import { getTokens } from '@/lib/storage';

const ML_API_BASE = 'https://api.mercadolibre.com';

export async function GET() {
  try {
    const tokens = await getTokens();
    if (!tokens || !tokens.access_token) {
      return NextResponse.json({ error: 'No tokens found in storage' });
    }

    const headers = {
      'Authorization': `Bearer ${tokens.access_token}`,
      'Accept': 'application/json',
    };

    const debugInfo: any = {
      userId: tokens.user_id,
      timestamp: new Date().toISOString(),
    };

    // 1. Consultar /advertising/advertisers?product_id=PADS
    try {
      const advRes = await fetch(`${ML_API_BASE}/advertising/advertisers?product_id=PADS`, { headers });
      debugInfo.advertisersStatus = advRes.status;
      if (advRes.ok) {
        debugInfo.advertisers = await advRes.json();
      } else {
        debugInfo.advertisersError = await advRes.text();
      }
    } catch (e: any) {
      debugInfo.advertisersException = e.message;
    }

    // 2. Consultar /marketplace/advertising/MLA/advertisers
    try {
      const advMarketRes = await fetch(`${ML_API_BASE}/marketplace/advertising/MLA/advertisers`, { headers });
      debugInfo.marketplaceAdvertisersStatus = advMarketRes.status;
      if (advMarketRes.ok) {
        debugInfo.marketplaceAdvertisers = await advMarketRes.json();
      } else {
        debugInfo.marketplaceAdvertisersError = await advMarketRes.text();
      }
    } catch (e: any) {
      debugInfo.marketplaceAdvertisersException = e.message;
    }

    // 3. Consultar campañas usando sellerId como advertiserId (últimos 30 días)
    const sellerId = tokens.user_id;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    try {
      const searchUrl = `${ML_API_BASE}/marketplace/advertising/MLA/advertisers/${sellerId}/product_ads/campaigns/search?date_from=${thirtyDaysAgoStr}&date_to=${todayStr}&metrics=investment`;
      const searchRes = await fetch(searchUrl, { headers });
      debugInfo.searchWithSellerId = {
        url: searchUrl,
        status: searchRes.status,
      };
      if (searchRes.ok) {
        debugInfo.searchWithSellerId.data = await searchRes.json();
      } else {
        debugInfo.searchWithSellerId.error = await searchRes.text();
      }
    } catch (e: any) {
      debugInfo.searchWithSellerIdException = e.message;
    }

    // 4. Buscar con todos los parámetros omitidos para ver si devuelve campañas sin filtros
    try {
      const searchUrlNoFilter = `${ML_API_BASE}/marketplace/advertising/MLA/advertisers/${sellerId}/product_ads/campaigns/search`;
      const searchResNoFilter = await fetch(searchUrlNoFilter, { headers });
      debugInfo.searchNoFilter = {
        url: searchUrlNoFilter,
        status: searchResNoFilter.status,
      };
      if (searchResNoFilter.ok) {
        debugInfo.searchNoFilter.data = await searchResNoFilter.json();
      } else {
        debugInfo.searchNoFilter.error = await searchResNoFilter.text();
      }
    } catch (e: any) {
      debugInfo.searchNoFilterException = e.message;
    }

    return NextResponse.json(debugInfo);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
