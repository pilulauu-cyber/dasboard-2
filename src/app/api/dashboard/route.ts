import { NextResponse } from 'next/server';
import { getSettings, getExpenses, getTokens, MeliSettings, Expense } from '@/lib/storage';
import { 
  fetchListings, 
  fetchOrders, 
  fetchCampaignsForRange, 
  fetchMercadoPagoBalance,
  fetchAdvertiserId
} from '@/lib/meli';
import { 
  MOCK_CATALOG, 
  generateMockOrders, 
  getMockAdsAndCashFlow,
  generateMockCampaigns
} from '@/lib/mockData';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const forceDemo = searchParams.get('demo') === 'true';

  try {
    const settings = await getSettings();
    const expenses = await getExpenses();
    const tokens = await getTokens();

    const isDemo = forceDemo || !tokens || !tokens.access_token || !tokens.user_id;

    if (isDemo) {
      const data = compileDashboardData(
        MOCK_CATALOG, 
        generateMockOrders(), 
        settings, 
        expenses, 
        true, // isDemo
        null  // no errors
      );
      return NextResponse.json(data);
    }

    // Modo Live: Hacemos consultas reales
    const sellerId = tokens.user_id;
    const errors: Record<string, string> = {};

    let listings: any[] = [];
    let orders: any[] = [];
    let mpBalance = { disponible: 0, aLiberar: 0, retenido: 0 };
    
    let campsToday: any[] = [];
    let campsYesterday: any[] = [];
    let camps7Days: any[] = [];
    let camps30Days: any[] = [];

    // Calcular strings de fechas para campañas publicitarias (MLA utiliza huso horario de Argentina, manejado localmente)
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const sevenDays = new Date(now);
    sevenDays.setDate(now.getDate() - 7);
    const sevenDaysStr = sevenDays.toISOString().split('T')[0];

    const thirtyDays = new Date(now);
    thirtyDays.setDate(now.getDate() - 30);
    const thirtyDaysStr = thirtyDays.toISOString().split('T')[0];

    // 1. Cargar Publicaciones
    try {
      listings = await fetchListings(sellerId);
    } catch (e: any) {
      console.error('Error fetching listings:', e);
      errors.listings = e.message || 'Error al obtener publicaciones de Mercado Libre.';
    }

    // 2. Cargar Órdenes (Ventas de los últimos 30 días)
    try {
      orders = await fetchOrders(sellerId, 30);
    } catch (e: any) {
      console.error('Error fetching orders:', e);
      errors.orders = e.message || 'Error al obtener ventas de Mercado Libre.';
    }

    // 3. Cargar Balance Financiero
    try {
      const balance = await fetchMercadoPagoBalance();
      mpBalance = balance;
    } catch (e: any) {
      console.error('Error fetching balance:', e);
      errors.balance = e.message || 'Error al obtener balance de Mercado Pago.';
      mpBalance = { disponible: 0, aLiberar: 0, retenido: 0 };
    }

    // 4. Cargar Publicidad para los 4 rangos de fechas (en paralelo)
    try {
      const advertiserId = await fetchAdvertiserId(sellerId);
      const [cToday, cYesterday, c7Days, c30Days] = await Promise.all([
        fetchCampaignsForRange(sellerId, todayStr, todayStr, advertiserId).catch(() => []),
        fetchCampaignsForRange(sellerId, yesterdayStr, yesterdayStr, advertiserId).catch(() => []),
        fetchCampaignsForRange(sellerId, sevenDaysStr, todayStr, advertiserId).catch(() => []),
        fetchCampaignsForRange(sellerId, thirtyDaysStr, todayStr, advertiserId).catch(() => [])
      ]);
      campsToday = cToday;
      campsYesterday = cYesterday;
      camps7Days = c7Days;
      camps30Days = c30Days;
    } catch (e: any) {
      console.error('Error fetching advertising campaigns:', e);
      errors.campaigns = e.message || 'Error al obtener campañas publicitarias de Mercado Libre.';
    }

    // Compilar los datos combinados
    const data = compileDashboardData(
      listings,
      orders,
      settings,
      expenses,
      false, // isDemo
      errors,
      mpBalance,
      campsToday,
      campsYesterday,
      camps7Days,
      camps30Days
    );

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Fatal dashboard aggregation error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}

interface OwnerFinancials {
  gross: number;
  commission: number;
  shipping: number;
  cogs: number;
  net: number;
  profit: number;
  salesCount: number;
}

interface ItemSalesStats {
  id: string;
  title: string;
  thumbnail: string;
  price: number;
  owner: string;
  units: number;
  grossRevenue: number;
  commission: number;
  shipping: number;
  cogs: number;
  netRevenue: number;
  profit: number;
}

// Función auxiliar para compilar y agrupar todas las métricas por dueño para los 4 rangos
function compileDashboardData(
  listings: any[],
  orders: any[],
  settings: MeliSettings,
  expenses: Expense[],
  isDemo: boolean,
  errors: Record<string, string> | null,
  liveBalance?: { disponible: number; aLiberar: number; retenido: number },
  campsToday?: any[],
  campsYesterday?: any[],
  camps7Days?: any[],
  camps30Days?: any[]
) {
  const listingOwners = settings.listingOwners || {};
  const campaignOwners = settings.campaignOwners || {};
  const ranges = ['today', 'yesterday', 'sevenDays', 'thirtyDays'] as const;
  type Range = typeof ranges[number];

  // 1. CONFIGURACIÓN DE PUBLICIDAD Y SALDOS BASE
  const adsData = {
    Guadalupe: { today: 0, yesterday: 0, sevenDays: 0, thirtyDays: 0 },
    Tomás: { today: 0, yesterday: 0, sevenDays: 0, thirtyDays: 0 },
    Compartidos: { today: 0, yesterday: 0, sevenDays: 0, thirtyDays: 0 }
  };

  let campaignsResponseList: any[] = [];
  
  let balanceBase = {
    disponible: 0,
    aLiberar: 0,
    retenido: 0,
    expenses: {
      Guadalupe: 0,
      Tomás: 0,
      Compartidos: 0
    }
  };

  if (isDemo) {
    const demo = getMockAdsAndCashFlow(settings, expenses);
    // Asignar el mapa de publicidad por rangos
    Object.assign(adsData, demo.ads);
    balanceBase = demo.cashFlowBase;
    
    // Generar listado simulado de campañas para retornar en Ajustes (usamos thirtyDays como mtd)
    campaignsResponseList = generateMockCampaigns().map(camp => ({
      id: camp.id,
      name: camp.name,
      status: camp.status,
      todaySpend: camp.todaySpend,
      mtdSpend: camp.thirtyDaysSpend, // El acumulado MTD se mapea al total de los 30 días
      owner: campaignOwners[camp.id] || 'Compartidos'
    }));
  } else {
    // Para Live mode: Consolidar listado de campañas disponibles
    // Mapeamos camps30Days para sacar nombres y estados, y asignarle dueños
    campaignsResponseList = (camps30Days || []).map(camp => {
      const todayCamp = (campsToday || []).find(c => c.id === camp.id);
      return {
        id: camp.id,
        name: camp.name,
        status: camp.status,
        todaySpend: todayCamp?.spend || 0,
        mtdSpend: camp.spend || 0, // 30 días acumulados
        owner: campaignOwners[camp.id] || 'Compartidos'
      };
    });

    // Agrupar los costos de publicidad reales según asignaciones para cada rango
    const groupLiveAds = (campsList: any[], range: Range) => {
      (campsList || []).forEach(camp => {
        const owner = campaignOwners[camp.id] || 'Compartidos';
        if (owner === 'Guadalupe') {
          adsData.Guadalupe[range] += camp.spend || 0;
        } else if (owner === 'Tomás') {
          adsData.Tomás[range] += camp.spend || 0;
        } else {
          adsData.Compartidos[range] += camp.spend || 0;
        }
      });
    };

    groupLiveAds(campsToday || [], 'today');
    groupLiveAds(campsYesterday || [], 'yesterday');
    groupLiveAds(camps7Days || [], 'sevenDays');
    groupLiveAds(camps30Days || [], 'thirtyDays');

    // Dividir los compartidos 50/50 entre Guadalupe y Tomás para todos los rangos
    ranges.forEach(range => {
      adsData.Guadalupe[range] += adsData.Compartidos[range] * 0.5;
      adsData.Tomás[range] += adsData.Compartidos[range] * 0.5;
    });

    // Gasto acumulado de gastos personales por dueño
    const guadaExpensesSum = expenses.filter(e => e.owner === 'Guadalupe').reduce((sum, e) => sum + e.amount, 0);
    const tomasExpensesSum = expenses.filter(e => e.owner === 'Tomás').reduce((sum, e) => sum + e.amount, 0);
    const sharedExpensesSum = expenses.filter(e => e.owner === 'Compartidos').reduce((sum, e) => sum + e.amount, 0);
    
    balanceBase = {
      disponible: liveBalance?.disponible || 0,
      aLiberar: liveBalance?.aLiberar || 0,
      retenido: liveBalance?.retenido || 0,
      expenses: {
        Guadalupe: guadaExpensesSum,
        Tomás: tomasExpensesSum,
        Compartidos: sharedExpensesSum
      }
    };
  }

  // Helper para obtener el ratio de propiedad por publicación
  const getOwnerRatio = (itemId: string): { Guadalupe: number; Tomás: number; Compartidos: number } => {
    const config = listingOwners[itemId];
    if (!config) {
      return { Guadalupe: 0.5, Tomás: 0.5, Compartidos: 1 };
    }
    
    if (config.owner === 'Guadalupe') {
      return { Guadalupe: 1, Tomás: 0, Compartidos: 0 };
    } else if (config.owner === 'Tomás') {
      return { Guadalupe: 0, Tomás: 1, Compartidos: 0 };
    } else {
      const split = config.splitPercentage !== undefined ? config.splitPercentage : 50;
      const guadaRatio = split / 100;
      return { Guadalupe: guadaRatio, Tomás: 1 - guadaRatio, Compartidos: 1 };
    }
  };

  const getListingUnitCost = (itemId: string): number => {
    return listingOwners[itemId]?.unitCost || 0;
  };

  // 2. PROCESAMIENTO DE STOCK (Estático / Punto en el Tiempo)
  const stockDetails = listings.map(item => {
    const itemId = item.id;
    const title = item.title;
    const price = item.price || 0;
    const stock = item.available_quantity || 0;
    const permalink = item.permalink || '';
    const thumbnail = item.thumbnail || '';
    
    const ownerConfig = listingOwners[itemId]?.owner || 'Compartidos';
    const splitPercent = ownerConfig === 'Compartidos' ? (listingOwners[itemId]?.splitPercentage ?? 50) : 100;
    const unitCost = getListingUnitCost(itemId);
    const capitalInvertido = stock * unitCost;

    return {
      id: itemId,
      title,
      price,
      stock,
      unitCost,
      capitalInvertido,
      owner: ownerConfig,
      splitPercent,
      permalink,
      thumbnail
    };
  });

  const stockTotals = {
    Guadalupe: { units: 0, capital: 0 },
    Tomás: { units: 0, capital: 0 },
    Compartidos: { units: 0, capital: 0 },
    General: { units: 0, capital: 0 }
  };

  stockDetails.forEach(item => {
    const ratio = getOwnerRatio(item.id);
    stockTotals.General.units += item.stock;
    stockTotals.General.capital += item.capitalInvertido;

    if (item.owner === 'Guadalupe') {
      stockTotals.Guadalupe.units += item.stock;
      stockTotals.Guadalupe.capital += item.capitalInvertido;
    } else if (item.owner === 'Tomás') {
      stockTotals.Tomás.units += item.stock;
      stockTotals.Tomás.capital += item.capitalInvertido;
    } else {
      stockTotals.Compartidos.units += item.stock;
      stockTotals.Compartidos.capital += item.capitalInvertido;
      
      stockTotals.Guadalupe.units += item.stock * ratio.Guadalupe;
      stockTotals.Guadalupe.capital += item.capitalInvertido * ratio.Guadalupe;
      
      stockTotals.Tomás.units += item.stock * ratio.Tomás;
      stockTotals.Tomás.capital += item.capitalInvertido * ratio.Tomás;
    }
  });

  // 3. PROCESAMIENTO DE VENTAS POR RANGOS DE FECHA
  const now = new Date();
  
  // Límites temporales
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfToday.getDate() - 1);

  const startOf7Days = new Date(startOfToday);
  startOf7Days.setDate(startOfToday.getDate() - 7);

  const startOf30Days = new Date(startOfToday);
  startOf30Days.setDate(startOfToday.getDate() - 30);

  // Inicializar acumuladores de ventas por rango
  const salesByListing: Record<Range, Record<string, ItemSalesStats>> = {
    today: {},
    yesterday: {},
    sevenDays: {},
    thirtyDays: {}
  };

  ranges.forEach(range => {
    listings.forEach(item => {
      salesByListing[range][item.id] = {
        id: item.id,
        title: item.title,
        thumbnail: item.thumbnail || '',
        price: item.price || 0,
        owner: listingOwners[item.id]?.owner || 'Compartidos',
        units: 0,
        grossRevenue: 0,
        commission: 0,
        shipping: 0,
        cogs: 0,
        netRevenue: 0,
        profit: 0
      };
    });
  });

  // Procesar órdenes de Mercado Libre en los acumuladores correspondientes
  orders.forEach((order: any) => {
    const orderDate = new Date(order.date_created);
    const isToday = orderDate >= startOfToday;
    const isYesterday = orderDate >= startOfYesterday && orderDate < startOfToday;
    const is7Days = orderDate >= startOf7Days;
    const is30Days = orderDate >= startOf30Days;

    const orderItems = order.items || order.order_items || [];
    orderItems.forEach((orderItem: any) => {
      const itemId = orderItem.item?.id || orderItem.item_id;
      const title = orderItem.item?.title || orderItem.title || 'Producto';
      const quantity = orderItem.quantity || 1;
      const unitPrice = orderItem.unit_price || orderItem.price || 0;

      const lineGross = unitPrice * quantity;
      
      // Calcular comisión del MLA
      let lineCommission = 0;
      if (order.sale_fee) {
        lineCommission = order.sale_fee * (quantity / (orderItem.quantity || 1));
      } else if (order.payments && order.payments.length > 0) {
        const totalGrossPayment = order.payments.reduce((s: number, p: any) => s + (p.transaction_amount || 0), 0);
        const totalNetPayment = order.payments.reduce((s: number, p: any) => s + (p.net_received_amount || 0), 0);
        const totalFees = Math.max(0, totalGrossPayment - totalNetPayment);
        lineCommission = totalFees * (lineGross / (totalGrossPayment || 1));
      } else {
        lineCommission = lineGross * 0.12;
        if (unitPrice < 23000) {
          lineCommission += 1000 * quantity;
        }
      }

      // Costo de envío pagado por el vendedor
      const lineShipping = (order.shipping_cost || 0) * (lineGross / ((order.total_amount || 1)));
      const unitCost = getListingUnitCost(itemId);
      const lineCogs = unitCost * quantity;

      const addToRange = (range: Range) => {
        // Por si la publicación no estaba en el stock cargado (ej. pausada recientemente)
        if (!salesByListing[range][itemId]) {
          salesByListing[range][itemId] = {
            id: itemId,
            title,
            thumbnail: '',
            price: unitPrice,
            owner: listingOwners[itemId]?.owner || 'Compartidos',
            units: 0,
            grossRevenue: 0,
            commission: 0,
            shipping: 0,
            cogs: 0,
            netRevenue: 0,
            profit: 0
          };
        }
        const stats = salesByListing[range][itemId];
        stats.units += quantity;
        stats.grossRevenue += lineGross;
        stats.commission += lineCommission;
        stats.shipping += lineShipping;
        stats.cogs += lineCogs;
      };

      if (isToday) addToRange('today');
      if (isYesterday) addToRange('yesterday');
      if (is7Days) addToRange('sevenDays');
      if (is30Days) addToRange('thirtyDays');
    });
  });

  // Finalizar cálculos netos y ganancias por ítem
  ranges.forEach(range => {
    Object.keys(salesByListing[range]).forEach(id => {
      const stats = salesByListing[range][id];
      stats.netRevenue = stats.grossRevenue - stats.commission - stats.shipping;
      stats.profit = stats.netRevenue - stats.cogs;
    });
  });

  // 4. TABLAS E INFORMACIÓN FINANCIERA AGRUPADA POR DUEÑO POR RANGO
  const createFinancialsSkeleton = (): Record<string, OwnerFinancials> => ({
    Guadalupe: { gross: 0, commission: 0, shipping: 0, cogs: 0, net: 0, profit: 0, salesCount: 0 },
    Tomás: { gross: 0, commission: 0, shipping: 0, cogs: 0, net: 0, profit: 0, salesCount: 0 },
    Compartidos: { gross: 0, commission: 0, shipping: 0, cogs: 0, net: 0, profit: 0, salesCount: 0 },
    General: { gross: 0, commission: 0, shipping: 0, cogs: 0, net: 0, profit: 0, salesCount: 0 }
  });

  const financials: Record<Range, Record<string, OwnerFinancials>> = {
    today: createFinancialsSkeleton(),
    yesterday: createFinancialsSkeleton(),
    sevenDays: createFinancialsSkeleton(),
    thirtyDays: createFinancialsSkeleton()
  };

  ranges.forEach(range => {
    Object.values(salesByListing[range]).forEach(stats => {
      const ratio = getOwnerRatio(stats.id);
      const fin = financials[range];

      // Suma global
      fin.General.gross += stats.grossRevenue;
      fin.General.commission += stats.commission;
      fin.General.shipping += stats.shipping;
      fin.General.cogs += stats.cogs;
      fin.General.net += stats.netRevenue;
      fin.General.profit += stats.profit;
      fin.General.salesCount += stats.units;

      if (stats.owner === 'Guadalupe') {
        fin.Guadalupe.gross += stats.grossRevenue;
        fin.Guadalupe.commission += stats.commission;
        fin.Guadalupe.shipping += stats.shipping;
        fin.Guadalupe.cogs += stats.cogs;
        fin.Guadalupe.net += stats.netRevenue;
        fin.Guadalupe.profit += stats.profit;
        fin.Guadalupe.salesCount += stats.units;
      } else if (stats.owner === 'Tomás') {
        fin.Tomás.gross += stats.grossRevenue;
        fin.Tomás.commission += stats.commission;
        fin.Tomás.shipping += stats.shipping;
        fin.Tomás.cogs += stats.cogs;
        fin.Tomás.net += stats.netRevenue;
        fin.Tomás.profit += stats.profit;
        fin.Tomás.salesCount += stats.units;
      } else {
        // Compartidos
        fin.Compartidos.gross += stats.grossRevenue;
        fin.Compartidos.commission += stats.commission;
        fin.Compartidos.shipping += stats.shipping;
        fin.Compartidos.cogs += stats.cogs;
        fin.Compartidos.net += stats.netRevenue;
        fin.Compartidos.profit += stats.profit;
        fin.Compartidos.salesCount += stats.units;

        // Dividir entre Guadalupe y Tomás según ratio
        fin.Guadalupe.gross += stats.grossRevenue * ratio.Guadalupe;
        fin.Guadalupe.commission += stats.commission * ratio.Guadalupe;
        fin.Guadalupe.shipping += stats.shipping * ratio.Guadalupe;
        fin.Guadalupe.cogs += stats.cogs * ratio.Guadalupe;
        fin.Guadalupe.net += stats.netRevenue * ratio.Guadalupe;
        fin.Guadalupe.profit += stats.profit * ratio.Guadalupe;
        fin.Guadalupe.salesCount += stats.units * ratio.Guadalupe;

        fin.Tomás.gross += stats.grossRevenue * ratio.Tomás;
        fin.Tomás.commission += stats.commission * ratio.Tomás;
        fin.Tomás.shipping += stats.shipping * ratio.Tomás;
        fin.Tomás.cogs += stats.cogs * ratio.Tomás;
        fin.Tomás.net += stats.netRevenue * ratio.Tomás;
        fin.Tomás.profit += stats.profit * ratio.Tomás;
        fin.Tomás.salesCount += stats.units * ratio.Tomás;
      }
    });

    // Descontar gasto de publicidad del profit neto para Guadalupe, Tomás y General
    financials[range].Guadalupe.profit -= adsData.Guadalupe[range];
    financials[range].Tomás.profit -= adsData.Tomás[range];
    financials[range].General.profit -= (adsData.Guadalupe[range] + adsData.Tomás[range]);
  });

  // 5. CALCULAR METRICAS DEL DÍA Y COMPARATIVAS (Para la barra global de KPIs)
  const todayGross = financials.today.General.gross;
  const yesterdayGross = financials.yesterday.General.gross;
  const todayProfit = financials.today.General.profit;
  const yesterdayProfit = financials.yesterday.General.profit;
  const todayAdSpend = adsData.Guadalupe.today + adsData.Tomás.today;
  const yesterdayAdSpend = adsData.Guadalupe.yesterday + adsData.Tomás.yesterday;

  // 6. CALCULAR SALDOS NETOS DE CASH FLOW (Dinámico únicamente según gastos personales)
  const baseDisp = balanceBase.disponible;
  const baseLib = balanceBase.aLiberar;
  const baseRet = balanceBase.retenido;

  const shareDisp = baseDisp / 2;
  const shareLib = baseLib / 2;
  const shareRet = baseRet / 2;

  const cashFlow = {
    Guadalupe: {
      disponible: shareDisp - balanceBase.expenses.Guadalupe,
      aLiberar: shareLib,
      retenido: shareRet,
      expenses: balanceBase.expenses.Guadalupe,
      flujoNeto: (shareDisp - balanceBase.expenses.Guadalupe) + shareLib
    },
    Tomás: {
      disponible: shareDisp - balanceBase.expenses.Tomás,
      aLiberar: shareLib,
      retenido: shareRet,
      expenses: balanceBase.expenses.Tomás,
      flujoNeto: (shareDisp - balanceBase.expenses.Tomás) + shareLib
    },
    Compartidos: {
      disponible: baseDisp - (balanceBase.expenses.Guadalupe + balanceBase.expenses.Tomás + balanceBase.expenses.Compartidos),
      aLiberar: baseLib,
      retenido: baseRet,
      expenses: balanceBase.expenses.Guadalupe + balanceBase.expenses.Tomás + balanceBase.expenses.Compartidos,
      flujoNeto: baseDisp + baseLib - (balanceBase.expenses.Guadalupe + balanceBase.expenses.Tomás + balanceBase.expenses.Compartidos)
    }
  };

  // Convertir mapas de ventas a listas para retornar en el JSON
  const salesLists: Record<Range, ItemSalesStats[]> = {
    today: Object.values(salesByListing.today),
    yesterday: Object.values(salesByListing.yesterday),
    sevenDays: Object.values(salesByListing.sevenDays),
    thirtyDays: Object.values(salesByListing.thirtyDays)
  };

  return {
    success: true,
    isDemo,
    errors,
    timestamp: new Date().toISOString(),
    globalKpis: {
      salesToday: financials.today.General.salesCount,
      salesYesterday: financials.yesterday.General.salesCount,
      grossToday: Math.round(todayGross),
      grossYesterday: Math.round(yesterdayGross),
      profitToday: Math.round(todayProfit),
      profitYesterday: Math.round(yesterdayProfit),
      adSpendToday: Math.round(todayAdSpend),
      adSpendYesterday: Math.round(yesterdayAdSpend),
    },
    stock: {
      totals: stockTotals,
      listings: stockDetails
    },
    sales: salesLists,
    financials: financials,
    ads: adsData,
    campaigns: campaignsResponseList,
    cashFlow
  };
}
