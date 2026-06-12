import { getTokens, setTokens } from './storage';

const ML_API_BASE = 'https://api.mercadolibre.com';

// Variables de entorno necesarias
const APP_ID = process.env.ML_APP_ID || '';
const CLIENT_SECRET = process.env.ML_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.ML_REDIRECT_URI || '';

// Generar URL de autorización para Mercado Libre Argentina (MLA)
export function getAuthUrl(): string {
  return `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
}

// Intercambiar código de autorización por tokens
export async function exchangeCode(code: string): Promise<any> {
  const url = `${ML_API_BASE}/oauth/token`;
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: APP_ID,
    client_secret: CLIENT_SECRET,
    code,
    redirect_uri: REDIRECT_URI,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to exchange authorization code: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  // Guardar tokens y calcular fecha de expiración (expires_in suele ser 21600 segundos, que son 6 horas)
  const tokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user_id: String(data.user_id),
    expires_at: Date.now() + (data.expires_in * 1000),
  };

  await setTokens(tokens);
  return tokens;
}

// Refrescar el token de acceso
export async function refreshAccessToken(refreshToken: string): Promise<any> {
  const url = `${ML_API_BASE}/oauth/token`;
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: APP_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh token: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  const tokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user_id: String(data.user_id),
    expires_at: Date.now() + (data.expires_in * 1000),
  };

  await setTokens(tokens);
  return tokens;
}

// Obtener un token de acceso válido (con refresco automático si expira en menos de 5 minutos)
export async function getValidAccessToken(): Promise<string> {
  const tokens = await getTokens();
  if (!tokens || !tokens.access_token) {
    throw new Error('No OAuth tokens found. Please authorize the ML account.');
  }

  // Margen de 5 minutos
  const isExpired = Date.now() > (tokens.expires_at - 300000);
  if (isExpired) {
    console.log('Token expirado o próximo a expirar. Refrescando...');
    try {
      const newTokens = await refreshAccessToken(tokens.refresh_token);
      return newTokens.access_token;
    } catch (e) {
      console.error('Error refrescando token, usando el actual como fallback desesperado:', e);
      return tokens.access_token;
    }
  }

  return tokens.access_token;
}

// Helper para llamadas fetch a Mercado Libre con reintentos para Rate Limit (429)
async function meliFetch(path: string, options: RequestInit = {}, retries = 3, delay = 1000): Promise<Response> {
  const token = await getValidAccessToken();
  const url = path.startsWith('http') ? path : `${ML_API_BASE}${path}`;
  
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
  };

  const response = await fetch(url, { ...options, headers });

  if (response.status === 429 && retries > 0) {
    const retryAfterHeader = response.headers.get('Retry-After');
    const waitTime = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : delay;
    console.warn(`[ML API 429] Demasiadas solicitudes. Esperando ${waitTime}ms antes de reintentar... (${retries} reintentos restantes)`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    return meliFetch(path, options, retries - 1, delay * 2);
  }

  return response;
}

// 1. Obtener publicaciones del vendedor
export async function fetchListings(sellerId: string): Promise<any[]> {
  // Primero buscamos los IDs de todas las publicaciones activas del vendedor
  let itemIds: string[] = [];
  let offset = 0;
  const limit = 50;
  let hasMore = true;

  // Hacemos una carga máxima de hasta 100 publicaciones para evitar timeouts del servidor
  while (hasMore && itemIds.length < 100) {
    const url = `/users/${sellerId}/items/search?status=active&limit=${limit}&offset=${offset}`;
    const response = await meliFetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to search seller items: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    const results = data.results || [];
    itemIds = [...itemIds, ...results];
    
    if (results.length < limit || itemIds.length >= 100) {
      hasMore = false;
    } else {
      offset += limit;
    }
  }

  if (itemIds.length === 0) return [];

  // Luego consultamos los detalles de las publicaciones en lotes de 20
  const details: any[] = [];
  const chunkSize = 20;
  for (let i = 0; i < itemIds.length; i += chunkSize) {
    const chunk = itemIds.slice(i, i + chunkSize);
    const url = `/items?ids=${chunk.join(',')}`;
    const response = await meliFetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch items details chunk starting at index ${i}`);
      continue;
    }
    const data = await response.json();
    
    // Mercado Libre responde con un array de { code: 200, body: {...} }
    for (const res of data) {
      if (res.code === 200 && res.body) {
        details.push(res.body);
      }
    }
  }

  return details;
}

// 2. Obtener órdenes (Ventas)
export async function fetchOrders(sellerId: string, days = 30): Promise<any[]> {
  const dateTo = new Date();
  const dateFrom = new Date();
  dateFrom.setDate(dateTo.getDate() - days);

  // Formatear fechas para la API de ML (Formato ISO 8601 UTC estándar)
  const dateFromStr = dateFrom.toISOString();
  const dateToStr = dateTo.toISOString();

  const url = `/orders/search?seller=${sellerId}&order.date_created.from=${encodeURIComponent(dateFromStr)}&order.date_created.to=${encodeURIComponent(dateToStr)}&limit=50`;
  const response = await meliFetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch orders: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.results || [];
}

// Helper para obtener el advertiser_id asociado a la cuenta de publicidad
export async function fetchAdvertiserId(sellerId: string): Promise<string> {
  try {
    const response = await meliFetch(`/advertising/advertisers?product_id=PADS`);
    if (response.ok) {
      const data = await response.json();
      const list = data.advertisers || [];
      if (list.length > 0 && list[0].advertiser_id) {
        return String(list[0].advertiser_id);
      }
    }
  } catch (e) {
    console.error('Error fetching advertiser_id, falling back to sellerId:', e);
  }
  return sellerId; // Fallback
}

// 3. Obtener campañas publicitarias con métricas para un rango específico
export async function fetchCampaignsForRange(
  sellerId: string, 
  dateFromStr: string, 
  dateToStr: string, 
  advertiserId?: string
): Promise<any[]> {
  try {
    const siteId = 'MLA'; // Argentina
    const advId = advertiserId || sellerId;
    const url = `/marketplace/advertising/${siteId}/advertisers/${advId}/product_ads/campaigns/search?date_from=${dateFromStr}&date_to=${dateToStr}&metrics=investment`;
    const response = await meliFetch(url);

    if (!response.ok) {
      throw new Error(`Campaign API returned status ${response.status}`);
    }

    const data = await response.json();
    const campaigns = data.results || [];

    return campaigns.map((camp: any) => ({
      id: String(camp.id),
      name: camp.name || `Campaña ${camp.id}`,
      status: camp.status || 'unknown',
      spend: camp.metrics?.investment || 0
    }));
  } catch (error) {
    console.error(`Error fetching campaigns for range ${dateFromStr} - ${dateToStr}:`, error);
    throw error;
  }
}


// 4. Obtener saldos de Mercado Pago (Disponible, A Liberar, Retenido)
export async function fetchMercadoPagoBalance(): Promise<{ disponible: number; aLiberar: number; retenido: number }> {
  try {
    // Nota: Aunque el saldo detallado exacto requiere la API de conciliación de Mercado Pago (Releases Report),
    // Mercado Pago ofrece un endpoint para consultar el saldo acumulado en tiempo real:
    // GET https://api.mercadopago.com/users/{user_id}/mercadopago_account/balance (solo disponible con tokens MP/ML)
    // Sin embargo, este endpoint en ocasiones está restringido. Usaremos un endpoint secundario o fallaremos graciosamente.
    const tokens = await getTokens();
    if (!tokens || !tokens.user_id) throw new Error("No authorized seller ID");

    // Endpoint directo del balance del usuario en ML/MP
    const response = await meliFetch(`/users/${tokens.user_id}/mercadopago_account/balance`);
    
    if (!response.ok) {
      throw new Error(`Balance API returned status ${response.status}`);
    }

    const data = await response.json();
    
    // Mapear los campos de respuesta:
    // - disponible: data.available_balance
    // - a liberar: data.unavailable_balance (dinero en proceso de liberación)
    // - retenido: data.reserved_balance (disputas, reclamos, etc.)
    return {
      disponible: data.available_balance || 0,
      aLiberar: data.unavailable_balance || 0,
      retenido: data.reserved_balance || 0
    };
  } catch (error) {
    console.error("Error fetching Mercado Pago balance:", error);
    throw error;
  }
}
