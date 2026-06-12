import { MeliSettings, Expense } from './storage';

export interface MockItem {
  id: string;
  title: string;
  price: number;
  available_quantity: number;
  permalink: string;
  thumbnail: string;
  status: string;
}

export interface MockOrderItem {
  item_id: string;
  title: string;
  price: number;
  quantity: number;
}

export interface MockOrder {
  id: number;
  date_created: string;
  items: MockOrderItem[];
  sale_fee: number;
  shipping_cost: number;
  buyer_username: string;
  payment_status: 'approved' | 'pending' | 'rejected';
}

// Catálogo de ítems simulados en Mercado Libre Argentina
export const MOCK_CATALOG: MockItem[] = [
  {
    id: "MLA1001",
    title: "Termo Stanley Classic Acero Inoxidable 1.4 Litros",
    price: 98500,
    available_quantity: 34,
    permalink: "https://articulo.mercadolibre.com.ar/MLA-1001",
    thumbnail: "https://http2.mlstatic.com/D_NQ_NP_960682-MLA50392942484_062022-O.webp",
    status: "active"
  },
  {
    id: "MLA1002",
    title: "Bombilla Stanley Classic Resorte Acero",
    price: 24900,
    available_quantity: 58,
    permalink: "https://articulo.mercadolibre.com.ar/MLA-1002",
    thumbnail: "https://http2.mlstatic.com/D_NQ_NP_723321-MLA49818293910_042022-O.webp",
    status: "active"
  },
  {
    id: "MLA1003",
    title: "Mate Stanley System Acero Inoxidable Térmico",
    price: 49999,
    available_quantity: 19,
    permalink: "https://articulo.mercadolibre.com.ar/MLA-1003",
    thumbnail: "https://http2.mlstatic.com/D_NQ_NP_824558-MLA50901239922_072022-O.webp",
    status: "active"
  },
  {
    id: "MLA1004",
    title: "Auriculares Inalámbricos Sony WH-1000XM4 Noise Cancelling",
    price: 410000,
    available_quantity: 8,
    permalink: "https://articulo.mercadolibre.com.ar/MLA-1004",
    thumbnail: "https://http2.mlstatic.com/D_NQ_NP_608245-MLA44052942410_112020-O.webp",
    status: "active"
  },
  {
    id: "MLA1005",
    title: "Remera Deportiva Deportiva Anti-Sudor Under Armour",
    price: 29500,
    available_quantity: 72,
    permalink: "https://articulo.mercadolibre.com.ar/MLA-1005",
    thumbnail: "https://http2.mlstatic.com/D_NQ_NP_782245-MLA50123984124_052022-O.webp",
    status: "active"
  },
  {
    id: "MLA1006",
    title: "Parrilla Eléctrica George Foreman Multipropósito",
    price: 135000,
    available_quantity: 12,
    permalink: "https://articulo.mercadolibre.com.ar/MLA-1006",
    thumbnail: "https://http2.mlstatic.com/D_NQ_NP_923845-MLA49823908412_042022-O.webp",
    status: "active"
  },
  {
    id: "MLA1007",
    title: "Cafetera Expreso Philips Serie 2200 Automática",
    price: 890000,
    available_quantity: 5,
    permalink: "https://articulo.mercadolibre.com.ar/MLA-1007",
    thumbnail: "https://http2.mlstatic.com/D_NQ_NP_890245-MLA49223901248_022022-O.webp",
    status: "active"
  },
  {
    id: "MLA1008",
    title: "Termo Lumilagro Luminox Acero 1 Litro",
    price: 36000,
    available_quantity: 45,
    permalink: "https://articulo.mercadolibre.com.ar/MLA-1008",
    thumbnail: "https://http2.mlstatic.com/D_NQ_NP_672312-MLA49283901248_032022-O.webp",
    status: "active"
  }
];

// Generar órdenes simuladas de manera determinística basada en la fecha actual
export function generateMockOrders(): MockOrder[] {
  const orders: MockOrder[] = [];
  const now = new Date();
  
  // Lista de compradores típicos argentinos
  const buyers = ["tomi_sanchez", "guada_lopez", "marcos_galp", "laura_m", "carlos_gardel", "messi_ok", "dieguito_10", "antonio_p"];
  
  // Vamos a generar órdenes para los últimos 30 días
  // Queremos unas pocas hoy, bastantes esta semana, y muchas este mes.
  let orderId = 3209843900;
  
  for (let i = 0; i < 30; i++) {
    const orderDate = new Date(now);
    orderDate.setDate(now.getDate() - i);
    
    // Cuanto más antigua es la fecha, generamos órdenes de manera distribuida.
    // i = 0 es "hoy", generamos de 1 a 3 órdenes
    // i > 0 generamos de 1 a 4 órdenes por día
    const ordersCount = i === 0 ? 3 : Math.floor(Math.sin(i) * 2) + 3; // oscila entre 1 y 5 órdenes
    
    for (let j = 0; j < ordersCount; j++) {
      orderId++;
      
      // Elegir un producto del catálogo aleatoriamente
      const catalogIdx = (orderId + j) % MOCK_CATALOG.length;
      const item = MOCK_CATALOG[catalogIdx];
      const quantity = ((orderId + j) % 2) + 1; // 1 o 2 unidades
      const price = item.price;
      
      // Calcular comisión del MLA (aprox. 12% para Clásica en promedio + $1000 si es menor a $23000)
      const commissionPercent = 0.12;
      let saleFee = price * quantity * commissionPercent;
      if (price < 23000) {
        saleFee += 1000 * quantity;
      }
      
      // Costo de envío pagado por el vendedor (si el producto es caro, el envío suele ser gratis y lo paga el vendedor)
      // En Argentina el envío gratis suele ser obligatorio en productos nuevos > $23000 o $28000.
      const paysShipping = price > 23000;
      const shippingCost = paysShipping ? (5500 * quantity) : 0;
      
      // Definir la hora de la orden
      const hour = (orderId % 16) + 8; // entre las 8:00 y las 24:00
      orderDate.setHours(hour, (orderId % 60), 0, 0);

      orders.push({
        id: orderId,
        date_created: orderDate.toISOString(),
        items: [
          {
            item_id: item.id,
            title: item.title,
            price: price,
            quantity: quantity
          }
        ],
        sale_fee: parseFloat(saleFee.toFixed(2)),
        shipping_cost: shippingCost,
        buyer_username: buyers[orderId % buyers.length],
        payment_status: 'approved'
      });
    }
  }
  
  // Añadimos una orden "retenida" (disputa) y una "pendiente" para simular Cash Flow
  // Orden retenida: hace 5 días
  const heldDate = new Date(now);
  heldDate.setDate(now.getDate() - 5);
  orders.push({
    id: 3999999901,
    date_created: heldDate.toISOString(),
    items: [
      {
        item_id: "MLA1004", // Auriculares caros
        title: MOCK_CATALOG[3].title,
        price: MOCK_CATALOG[3].price,
        quantity: 1
      }
    ],
    sale_fee: MOCK_CATALOG[3].price * 0.12,
    shipping_cost: 6500,
    buyer_username: "comprador_conflictivo",
    payment_status: 'approved' // aprobado pero retenido por reclamo
  });

  // Orden pendiente (a liberar): hace 1 día
  const pendingDate = new Date(now);
  pendingDate.setDate(now.getDate() - 1);
  orders.push({
    id: 3999999902,
    date_created: pendingDate.toISOString(),
    items: [
      {
        item_id: "MLA1001",
        title: MOCK_CATALOG[0].title,
        price: MOCK_CATALOG[0].price,
        quantity: 1
      }
    ],
    sale_fee: MOCK_CATALOG[0].price * 0.12,
    shipping_cost: 5500,
    buyer_username: "pago_pendiente",
    payment_status: 'pending' // pendiente de pago o acreditación
  });

  return orders;
}

// Generar campañas simuladas para el modo Demo con 4 rangos temporales
export function generateMockCampaigns(): any[] {
  const now = new Date();
  
  // Catálogo de campañas de publicidad simuladas con base diaria
  const mockCampaigns = [
    { id: "509849202", name: "Campaña Termos - Stanley", status: "active", baseSpend: 8500 },
    { id: "509849288", name: "Campaña Tecno - Sony/JBL", status: "active", baseSpend: 11200 },
    { id: "509849300", name: "Campaña Co-Branded Compartida", status: "active", baseSpend: 5400 },
    { id: "509849400", name: "Campaña Indumentaria Pausada", status: "paused", baseSpend: 0 }
  ];

  return mockCampaigns.map(camp => {
    // Variación pequeña en tiempo real (segundos) para dar dinamismo a la UI
    const todaySpend = camp.baseSpend > 0 ? camp.baseSpend + (now.getSeconds() % 5) * 100 : 0;
    const yesterdaySpend = todaySpend * 0.95;
    const sevenDaysSpend = todaySpend * 6.8;
    const thirtyDaysSpend = todaySpend * 28.5;

    return {
      id: camp.id,
      name: camp.name,
      status: camp.status,
      todaySpend: parseFloat(todaySpend.toFixed(2)),
      yesterdaySpend: parseFloat(yesterdaySpend.toFixed(2)),
      sevenDaysSpend: parseFloat(sevenDaysSpend.toFixed(2)),
      thirtyDaysSpend: parseFloat(thirtyDaysSpend.toFixed(2))
    };
  });
}

// Generar balances y consolidar gasto de publicidad según la asignación dinámica para los 4 rangos
export function getMockAdsAndCashFlow(settings: MeliSettings, expenses: Expense[]) {
  const campaigns = generateMockCampaigns();
  const campaignOwners = settings.campaignOwners || {};

  // Inicializar totales de gasto publicitario agrupados para los 4 rangos
  const ads = {
    Guadalupe: { today: 0, yesterday: 0, sevenDays: 0, thirtyDays: 0 },
    Tomás: { today: 0, yesterday: 0, sevenDays: 0, thirtyDays: 0 },
    Compartidos: { today: 0, yesterday: 0, sevenDays: 0, thirtyDays: 0 }
  };

  // Agrupar gasto de campañas simuladas según la asignación de dueños
  campaigns.forEach(camp => {
    const owner = campaignOwners[camp.id] || 'Compartidos';
    if (owner === 'Guadalupe') {
      ads.Guadalupe.today += camp.todaySpend;
      ads.Guadalupe.yesterday += camp.yesterdaySpend;
      ads.Guadalupe.sevenDays += camp.sevenDaysSpend;
      ads.Guadalupe.thirtyDays += camp.thirtyDaysSpend;
    } else if (owner === 'Tomás') {
      ads.Tomás.today += camp.todaySpend;
      ads.Tomás.yesterday += camp.yesterdaySpend;
      ads.Tomás.sevenDays += camp.sevenDaysSpend;
      ads.Tomás.thirtyDays += camp.thirtyDaysSpend;
    } else {
      ads.Compartidos.today += camp.todaySpend;
      ads.Compartidos.yesterday += camp.yesterdaySpend;
      ads.Compartidos.sevenDays += camp.sevenDaysSpend;
      ads.Compartidos.thirtyDays += camp.thirtyDaysSpend;
    }
  });

  // Dividir el gasto publicitario de campañas Compartidas 50/50 entre Guadalupe y Tomás
  const ranges: Array<'today' | 'yesterday' | 'sevenDays' | 'thirtyDays'> = ['today', 'yesterday', 'sevenDays', 'thirtyDays'];
  ranges.forEach(range => {
    ads.Guadalupe[range] += ads.Compartidos[range] * 0.5;
    ads.Tomás[range] += ads.Compartidos[range] * 0.5;
  });

  // Saldos base de Cash Flow (Disponible, A Liberar, Retenido) antes de gastos
  const rawDisponible = 450000;
  const rawALiberar = 185000;
  const rawRetenido = 65000;
  
  // Los gastos personales se restan del disponible del dueño correspondiente
  const guadaExpensesSum = expenses.filter(e => e.owner === 'Guadalupe').reduce((sum, e) => sum + e.amount, 0);
  const tomasExpensesSum = expenses.filter(e => e.owner === 'Tomás').reduce((sum, e) => sum + e.amount, 0);
  const sharedExpensesSum = expenses.filter(e => e.owner === 'Compartidos').reduce((sum, e) => sum + e.amount, 0);

  return {
    ads,
    cashFlowBase: {
      disponible: rawDisponible,
      aLiberar: rawALiberar,
      retenido: rawRetenido,
      expenses: {
        Guadalupe: guadaExpensesSum,
        Tomás: tomasExpensesSum,
        Compartidos: sharedExpensesSum
      }
    }
  };
}
