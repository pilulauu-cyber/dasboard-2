'use client';

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  DollarSign, 
  ShoppingCart, 
  Megaphone, 
  Wallet, 
  Plus, 
  Trash2, 
  Settings, 
  RefreshCw, 
  Layers, 
  User, 
  AlertTriangle, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';

interface DashboardData {
  success: boolean;
  isDemo: boolean;
  timestamp: string;
  errors: Record<string, string>;
  globalKpis: {
    salesToday: number;
    salesYesterday: number;
    grossToday: number;
    grossYesterday: number;
    profitToday: number;
    profitYesterday: number;
    adSpendToday: number;
    adSpendYesterday: number;
  };
  stock: {
    totals: Record<string, { units: number; capital: number }>;
    listings: Array<{
      id: string;
      title: string;
      price: number;
      stock: number;
      unitCost: number;
      capitalInvertido: number;
      owner: 'Guadalupe' | 'Tomás' | 'Compartidos';
      splitPercent: number;
      permalink: string;
      thumbnail: string;
    }>;
  };
  sales: Record<string, Array<{
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
  }>>;
  financials: Record<string, Record<string, {
    gross: number;
    commission: number;
    shipping: number;
    cogs: number;
    net: number;
    profit: number;
    salesCount: number;
  }>>;
  ads: Record<string, Record<string, number>>;
  campaigns: Array<{
    id: string;
    name: string;
    status: string;
    todaySpend: number;
    mtdSpend: number;
    owner: 'Guadalupe' | 'Tomás' | 'Compartidos';
  }>;
  cashFlow: Record<string, {
    disponible: number;
    aLiberar: number;
    retenido: number;
    expenses: number;
    flujoNeto: number;
  }>;
}

interface Expense {
  id: string;
  owner: 'Guadalupe' | 'Tomás' | 'Compartidos';
  description: string;
  amount: number;
  date: string;
  category: 'retiro' | 'insumos' | 'publicidad' | 'otro';
}

interface MeliSettings {
  campaignOwners?: Record<string, 'Guadalupe' | 'Tomás' | 'Compartidos'>;
  listingOwners: Record<string, {
    owner: 'Guadalupe' | 'Tomás' | 'Compartidos';
    splitPercentage?: number;
    unitCost?: number;
  }>;
}

export default function DashboardPage() {
  // Estados principales
  const [data, setData] = useState<DashboardData | null>(null);
  const [settings, setSettings] = useState<MeliSettings>({ listingOwners: {} });
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'Guadalupe' | 'Tomás' | 'General'>('General');
  const [showSettingsView, setShowSettingsView] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [nickname, setNickname] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Filtros de las tablas
  const [stockSearch, setStockSearch] = useState('');
  const [timeRange, setTimeRange] = useState<'today' | 'yesterday' | 'sevenDays' | 'thirtyDays'>('thirtyDays');
  const [salesSearch, setSalesSearch] = useState('');
  const [salesSortField, setSalesSortField] = useState<'volume' | 'profit' | 'margin'>('volume');

  // Estados de formularios
  const [expenseForm, setExpenseForm] = useState({
    owner: 'Guadalupe' as 'Guadalupe' | 'Tomás' | 'Compartidos',
    description: '',
    amount: '',
    category: 'retiro' as 'retiro' | 'insumos' | 'publicidad' | 'otro',
    date: new Date().toISOString().split('T')[0]
  });
  const [showExpensesTable, setShowExpensesTable] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState(false);

  // Cargar datos al iniciar y configurar polling
  useEffect(() => {
    fetchAuthStatus();
    loadAllData();

    // Polling cada 90 segundos para actualizaciones en tiempo real
    const interval = setInterval(() => {
      loadAllData(true);
    }, 90000);

    return () => clearInterval(interval);
  }, []);

  // Verificar estado de autenticación
  const fetchAuthStatus = async () => {
    try {
      const res = await fetch('/api/auth/status');
      const auth = await res.json();
      setAuthorized(auth.authorized);
      if (auth.authorized && auth.nickname) {
        setNickname(auth.nickname);
      } else {
        setNickname('');
      }
    } catch (e) {
      console.error('Error checking auth status:', e);
    }
  };

  // Carga general de datos de dashboard y settings
  const loadAllData = async (isPoll = false) => {
    if (!isPoll) setLoading(true);
    else setRefreshing(true);
    
    try {
      // Sincronizar estado de autenticación
      await fetchAuthStatus();

      // 1. Cargar Dashboard Metrics
      const dashboardRes = await fetch(`/api/dashboard?t=${Date.now()}`);
      if (!dashboardRes.ok) throw new Error('Failed to load dashboard data');
      const dashboardData = await dashboardRes.json();
      setData(dashboardData);

      // Si el backend dice que es demo, forzamos que no está autorizado localmente para estar en sincronía
      if (dashboardData.isDemo) {
        setAuthorized(false);
        setNickname('');
      }

      // 2. Cargar Settings y Gastos
      const settingsRes = await fetch(`/api/settings?t=${Date.now()}`);
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSettings(settingsData.settings || { listingOwners: {} });
        setExpenses(settingsData.expenses || []);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Enviar cambios en settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsSaveSuccess(false);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'settings',
          settings: settings
        })
      });
      if (res.ok) {
        setSettingsSaveSuccess(true);
        setTimeout(() => setSettingsSaveSuccess(false), 3000);
        await loadAllData(true);
      }
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Añadir un gasto personal
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.description || !expenseForm.amount) return;

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'addExpense',
          expense: {
            owner: expenseForm.owner,
            description: expenseForm.description,
            amount: parseFloat(expenseForm.amount),
            date: expenseForm.date,
            category: expenseForm.category
          }
        })
      });

      if (res.ok) {
        setExpenseForm({
          owner: activeTab === 'General' ? 'Guadalupe' : activeTab,
          description: '',
          amount: '',
          category: 'retiro',
          date: new Date().toISOString().split('T')[0]
        });
        await loadAllData(true);
      }
    } catch (err) {
      console.error('Error adding expense:', err);
    }
  };

  // Borrar un gasto
  const handleDeleteExpense = async (id: string) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'deleteExpense',
          id: id
        })
      });
      if (res.ok) {
        await loadAllData(true);
      }
    } catch (err) {
      console.error('Error deleting expense:', err);
    }
  };

  // Helper para dar formato a números como ARS
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(val);
  };

  // Helper para renderizar variaciones porcentuales (delta vs ayer)
  const renderDelta = (current: number, previous: number, invertColor = false) => {
    if (!previous || previous === 0) return null;
    const pct = ((current - previous) / previous) * 100;
    const isPositive = pct >= 0;
    
    let colorClass = '';
    if (invertColor) {
      // Para gastos o publicidad, que suba es negativo (rojo)
      colorClass = isPositive ? 'text-status-red bg-status-red/10' : 'text-status-green bg-status-green/10';
    } else {
      // Para ingresos o ventas, que suba es positivo (verde)
      colorClass = isPositive ? 'text-status-green bg-status-green/10' : 'text-status-red bg-status-red/10';
    }

    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${colorClass}`}>
        {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {isPositive ? '+' : ''}{pct.toFixed(1)}% vs ayer
      </span>
    );
  };

  // Helper para obtener el nombre legible del rango temporal
  const getRangeLabel = (rangeStr: string) => {
    switch (rangeStr) {
      case 'today': return 'Hoy';
      case 'yesterday': return 'Ayer';
      case 'sevenDays': return '7 Días';
      case 'thirtyDays': return '30 Días';
      default: return '';
    }
  };

  // Filtrado y procesamiento del dueño actual para el Dashboard
  const getOwnerMetrics = () => {
    if (!data) return null;
    
    // Si la pestaña activa es General, devolvemos el consolidado
    if (activeTab === 'General') {
      const genFinancials = data.financials[timeRange]?.General || { gross: 0, commission: 0, shipping: 0, cogs: 0, net: 0, profit: 0 };
      return {
        stockUnits: data.stock.totals.General.units,
        stockCapital: data.stock.totals.General.capital,
        gross: genFinancials.gross,
        commission: genFinancials.commission,
        shipping: genFinancials.shipping,
        cogs: genFinancials.cogs,
        net: genFinancials.net,
        profit: genFinancials.profit,
        adSpend: (data.ads.Guadalupe?.[timeRange] || 0) + (data.ads.Tomás?.[timeRange] || 0),
        cashFlow: data.cashFlow.Compartidos,
      };
    }

    // Para Guadalupe o Tomás se devuelven sus métricas individuales (que ya tienen el split sumado desde la API)
    const owner = activeTab;
    const ownerFinancials = data.financials[timeRange]?.[owner] || { gross: 0, commission: 0, shipping: 0, cogs: 0, net: 0, profit: 0 };
    const ownerStock = data.stock.totals[owner] || { units: 0, capital: 0 };
    const ownerAds = data.ads[owner]?.[timeRange] || 0;
    const ownerCashFlow = data.cashFlow[owner] || { disponible: 0, aLiberar: 0, retenido: 0, expenses: 0, flujoNeto: 0 };

    return {
      stockUnits: ownerStock.units,
      stockCapital: ownerStock.capital,
      gross: ownerFinancials.gross,
      commission: ownerFinancials.commission,
      shipping: ownerFinancials.shipping,
      cogs: ownerFinancials.cogs,
      net: ownerFinancials.net,
      profit: ownerFinancials.profit,
      adSpend: ownerAds,
      cashFlow: ownerCashFlow,
    };
  };

  const ownerMetrics = getOwnerMetrics();

  // Filtrado de publicaciones de stock según el input de búsqueda y pestaña activa
  const filteredStockListings = data?.stock.listings.filter(item => {
    const matchesSearch = item.id.toLowerCase().includes(stockSearch.toLowerCase()) || 
                          item.title.toLowerCase().includes(stockSearch.toLowerCase());
    
    if (activeTab === 'General') return matchesSearch;
    
    // Si es Guadalupe/Tomás: mostrar si el item les pertenece directamente OR si es compartido y tienen ratio mayor a 0
    if (activeTab === 'Guadalupe') {
      return matchesSearch && (item.owner === 'Guadalupe' || (item.owner === 'Compartidos' && item.splitPercent > 0));
    } else {
      return matchesSearch && (item.owner === 'Tomás' || (item.owner === 'Compartidos' && item.splitPercent < 100));
    }
  }) || [];

  // Filtrado de ventas por publicación según rango temporal, búsqueda, pestaña y ordenamiento
  const processedSalesListings = (data?.sales[timeRange] || []).map(item => {
    // Calcular métricas relativas basadas en la pestaña
    let multiplier = 1;
    if (activeTab === 'Guadalupe') {
      if (item.owner === 'Guadalupe') multiplier = 1;
      else if (item.owner === 'Tomás') multiplier = 0;
      else multiplier = (settings.listingOwners[item.id]?.splitPercentage ?? 50) / 100;
    } else if (activeTab === 'Tomás') {
      if (item.owner === 'Tomás') multiplier = 1;
      else if (item.owner === 'Guadalupe') multiplier = 0;
      else multiplier = 1 - ((settings.listingOwners[item.id]?.splitPercentage ?? 50) / 100);
    }

    const units = item.units * multiplier;
    const grossRevenue = item.grossRevenue * multiplier;
    const commission = item.commission * multiplier;
    const shipping = item.shipping * multiplier;
    const cogs = item.cogs * multiplier;
    const netRevenue = item.netRevenue * multiplier;
    const profit = item.profit * multiplier;
    const margin = netRevenue > 0 ? (profit / netRevenue) * 100 : 0;

    return {
      ...item,
      units,
      grossRevenue,
      commission,
      shipping,
      cogs,
      netRevenue,
      profit,
      margin
    };
  }).filter(item => {
    const matchesSearch = item.id.toLowerCase().includes(salesSearch.toLowerCase()) || 
                          item.title.toLowerCase().includes(salesSearch.toLowerCase());
    
    // Retornar solo productos que tienen participación del dueño actual
    if (activeTab === 'General') return matchesSearch;
    if (activeTab === 'Guadalupe') {
      return matchesSearch && (item.owner === 'Guadalupe' || (item.owner === 'Compartidos' && (settings.listingOwners[item.id]?.splitPercentage ?? 50) > 0));
    } else {
      return matchesSearch && (item.owner === 'Tomás' || (item.owner === 'Compartidos' && (settings.listingOwners[item.id]?.splitPercentage ?? 50) < 100));
    }
  }) || [];

  // Ordenar lista de ventas
  const sortedSalesListings = [...processedSalesListings].sort((a, b) => {
    let valA = 0;
    let valB = 0;

    if (salesSortField === 'volume') {
      valA = a.units;
      valB = b.units;
    } else if (salesSortField === 'profit') {
      valA = a.profit;
      valB = b.profit;
    } else if (salesSortField === 'margin') {
      valA = a.margin;
      valB = b.margin;
    }

    return valB - valA; // Descendente (mayor a menor)
  });

  // Mostrar indicador de carga inicial
  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground gap-4">
        <RefreshCw className="animate-spin text-accent-gold" size={48} />
        <p className="text-text-secondary text-sm font-semibold tracking-wide">Cargando Dashboard de Inteligencia...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      
      {/* 1. HEADER & BARRA DE ESTADO */}
      <header className="border-b border-card-border bg-card/60 backdrop-blur-md sticky top-0 z-40 px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-accent-gold/10 p-2 rounded-lg border border-accent-gold/20">
            <Layers className="text-accent-gold" size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-text-primary">MELI BI Ops</h1>
            <p className="text-xs text-text-secondary">Mercado Libre Argentina Dashboard</p>
          </div>
        </div>

        {/* Estatus del Modo Demo o Conexión */}
        <div className="flex items-center gap-3">
          {data?.isDemo ? (
            <div className="flex items-center gap-1.5 bg-status-orange/15 border border-status-orange/30 text-status-orange px-2.5 py-1 rounded-lg text-xs font-bold">
              <AlertTriangle size={14} />
              MODO SIMULADOR (DEMO)
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-status-green/15 border border-status-green/30 text-status-green px-2.5 py-1 rounded-lg text-xs font-bold">
              <Info size={14} />
              CONECTADO EN VIVO ({nickname})
            </div>
          )}

          {/* Botón de login/OAuth */}
          {authorized ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary font-semibold hidden md:inline">
                Cuenta: <span className="text-text-primary font-bold">{nickname}</span>
              </span>
              <button 
                onClick={() => {
                  if(confirm('¿Desvincular la cuenta de Mercado Libre?')) {
                    // Para desvincular, borramos localmente
                    fetch('/api/settings', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ type: 'settings', settings: { ...settings, listingOwners: {} } })
                    }).then(() => loadAllData());
                  }
                }}
                className="text-xs font-bold text-text-secondary hover:text-status-red border border-card-border px-3 py-1.5 rounded-lg transition-all-custom"
              >
                Desconectar
              </button>
            </div>
          ) : (
            <a 
              href="/api/auth/login"
              className="bg-accent-gold hover:bg-yellow-400 text-black text-xs font-extrabold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all-custom"
            >
              Vincular MLA <ExternalLink size={12} />
            </a>
          )}

          {/* Botón para forzar recarga */}
          <button 
            disabled={refreshing}
            onClick={() => loadAllData(true)}
            className="p-1.5 rounded-lg border border-card-border hover:bg-card-hover text-text-secondary hover:text-foreground transition-all-custom"
            title="Recargar datos"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* 2. GLOBAL KPI BAR */}
      {data && (
        <section className="bg-card/35 border-b border-card-border px-6 py-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1 border-r border-card-border/50 last:border-0 pr-4">
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Ventas de Hoy</span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-extrabold">{data.globalKpis.salesToday} und</span>
              {renderDelta(data.globalKpis.salesToday, data.globalKpis.salesYesterday)}
            </div>
          </div>
          
          <div className="flex flex-col gap-1 border-r border-card-border/50 last:border-0 pr-4">
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Ingreso Bruto Hoy</span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-extrabold">{formatCurrency(data.globalKpis.grossToday)}</span>
              {renderDelta(data.globalKpis.grossToday, data.globalKpis.grossYesterday)}
            </div>
          </div>

          <div className="flex flex-col gap-1 border-r border-card-border/50 last:border-0 pr-4">
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Ganancia Neta Hoy</span>
            <div className="flex items-baseline gap-2">
              <span className={`text-xl font-extrabold ${data.globalKpis.profitToday >= 0 ? 'text-status-green' : 'text-status-red'}`}>
                {formatCurrency(data.globalKpis.profitToday)}
              </span>
              {renderDelta(data.globalKpis.profitToday, data.globalKpis.profitYesterday)}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Publicidad Hoy</span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-extrabold text-status-orange">{formatCurrency(data.globalKpis.adSpendToday)}</span>
              {renderDelta(data.globalKpis.adSpendToday, data.globalKpis.adSpendYesterday, true)}
            </div>
          </div>
        </section>
      )}

      {/* 3. TABS Y FILTRO PRINCIPAL */}
      <div className="px-6 pt-6 flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex flex-col md:flex-row items-center gap-4 w-full lg:w-auto">
          {/* Selector de Pestaña de Dueño */}
          <div className="bg-card border border-card-border p-1 rounded-xl flex gap-1 w-full md:w-auto">
            <button
              onClick={() => { setActiveTab('General'); setShowSettingsView(false); }}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all-custom ${
                activeTab === 'General' && !showSettingsView
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-text-secondary hover:text-foreground'
              }`}
            >
              <Layers size={14} />
              Vista General
            </button>
            
            <button
              onClick={() => { setActiveTab('Guadalupe'); setShowSettingsView(false); }}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all-custom ${
                activeTab === 'Guadalupe' && !showSettingsView
                  ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/30'
                  : 'text-text-secondary hover:text-foreground'
              }`}
            >
              <User size={14} />
              Guadalupe
            </button>

            <button
              onClick={() => { setActiveTab('Tomás'); setShowSettingsView(false); }}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all-custom ${
                activeTab === 'Tomás' && !showSettingsView
                  ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/30'
                  : 'text-text-secondary hover:text-foreground'
              }`}
            >
              <User size={14} />
              Tomás
            </button>
          </div>

          {/* Selector de Rango Temporal Global */}
          {!showSettingsView && (
            <div className="bg-card border border-card-border p-1 rounded-xl flex gap-1 w-full md:w-auto">
              <button
                onClick={() => setTimeRange('today')}
                className={`flex-1 md:flex-initial px-3.5 py-2 rounded-lg text-xs font-bold transition-all-custom ${
                  timeRange === 'today'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-text-secondary hover:text-foreground'
                }`}
              >
                Hoy
              </button>
              <button
                onClick={() => setTimeRange('yesterday')}
                className={`flex-1 md:flex-initial px-3.5 py-2 rounded-lg text-xs font-bold transition-all-custom ${
                  timeRange === 'yesterday'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-text-secondary hover:text-foreground'
                }`}
              >
                Ayer
              </button>
              <button
                onClick={() => setTimeRange('sevenDays')}
                className={`flex-1 md:flex-initial px-3.5 py-2 rounded-lg text-xs font-bold transition-all-custom ${
                  timeRange === 'sevenDays'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-text-secondary hover:text-foreground'
                }`}
              >
                7 Días
              </button>
              <button
                onClick={() => setTimeRange('thirtyDays')}
                className={`flex-1 md:flex-initial px-3.5 py-2 rounded-lg text-xs font-bold transition-all-custom ${
                  timeRange === 'thirtyDays'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-text-secondary hover:text-foreground'
                }`}
              >
                30 Días
              </button>
            </div>
          )}
        </div>

        {/* Botón de Cambiar a Ajustes */}
        <button
          onClick={() => setShowSettingsView(!showSettingsView)}
          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all-custom w-full md:w-auto ${
            showSettingsView
              ? 'bg-accent-gold text-black border-accent-gold'
              : 'bg-card text-text-primary border-card-border hover:bg-card-hover'
          }`}
        >
          <Settings size={14} />
          {showSettingsView ? 'Volver al Dashboard' : 'Configurar Dueños y Costos'}
        </button>
      </div>

      {/* 4. VISTAS PRINCIPALES */}
      <main className="flex-1 p-6">
        {/* REPORTAR ERRORES PARTICULARES DE LA API */}
        {data && Object.keys(data.errors || {}).filter(k => k !== 'balance' && k !== 'campaigns' && k !== 'adsGuadalupe' && k !== 'adsTomas').length > 0 && (
          <div className="mb-6 bg-status-red/10 border border-status-red/35 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-status-red font-bold text-sm">
              <AlertTriangle size={18} />
              Advertencia: Algunos módulos críticos no pudieron sincronizar correctamente
            </div>
            <ul className="list-disc pl-5 text-xs text-text-secondary flex flex-col gap-1">
              {Object.entries(data.errors)
                .filter(([key]) => key !== 'balance' && key !== 'campaigns' && key !== 'adsGuadalupe' && key !== 'adsTomas')
                .map(([key, err]) => (
                  <li key={key}><strong className="capitalize">{key}</strong>: {err}</li>
                ))}
            </ul>
            <button 
              onClick={() => loadAllData(true)}
              className="mt-1 self-start bg-status-red/20 hover:bg-status-red/35 text-status-red text-xs px-3 py-1.5 rounded-lg font-bold transition-all-custom"
            >
              Reintentar Sincronización
            </button>
          </div>
        )}

        {showSettingsView ? (
          /* ==============================================
             VISTA DE AJUSTES (CONFIGURACIÓN)
             ============================================== */
          <div className="bg-card border border-card-border rounded-2xl p-6 max-w-4xl mx-auto">
            <h2 className="text-xl font-bold tracking-tight mb-2 text-text-primary">Configuración de Cuentas y Publicaciones</h2>
            <p className="text-sm text-text-secondary mb-6">Asigna titulares a las publicaciones, establece los costos de mercadería y configura las IDs de campañas.</p>

            <form onSubmit={handleSaveSettings} className="space-y-6">
              {/* Asignación de Campañas de Publicidad */}
              <div className="pb-6 border-b border-card-border/50 space-y-3">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Asignación de Campañas de Publicidad</h3>
                <div className="border border-card-border rounded-xl overflow-hidden divide-y divide-card-border/50 bg-background/50">
                  {data?.campaigns && data.campaigns.length > 0 ? (
                    data.campaigns.map((camp) => {
                      const currentOwner = settings.campaignOwners?.[camp.id] || 'Compartidos';
                      return (
                        <div key={camp.id} className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                          <div className="md:col-span-5">
                            <div className="text-sm font-bold text-text-primary">{camp.name}</div>
                            <div className="text-[10px] text-text-secondary">
                              ID: {camp.id} • Estado: <span className={camp.status === 'active' ? 'text-status-green font-bold' : 'text-text-muted font-bold'}>{camp.status === 'active' ? 'Activa' : 'Pausada'}</span>
                            </div>
                          </div>
                          <div className="md:col-span-4 text-xs text-text-secondary">
                            Gasto Acumulado (MTD): <span className="font-semibold text-text-primary">{formatCurrency(camp.mtdSpend)}</span>
                          </div>
                          <div className="md:col-span-3">
                            <select
                              value={currentOwner}
                              onChange={(e) => {
                                const owner = e.target.value as 'Guadalupe' | 'Tomás' | 'Compartidos';
                                const newCampaignOwners = { ...settings.campaignOwners };
                                newCampaignOwners[camp.id] = owner;
                                setSettings({ ...settings, campaignOwners: newCampaignOwners });
                              }}
                              className="w-full bg-background border border-card-border rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
                            >
                              <option value="Guadalupe">Guadalupe</option>
                              <option value="Tomás">Tomás</option>
                              <option value="Compartidos">Compartidos (50/50)</option>
                            </select>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-xs text-text-muted italic">
                      No se encontraron campañas de publicidad activas en la cuenta.
                    </div>
                  )}
                </div>
              </div>

              {/* Lista de Publicaciones */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Asignación por Publicación</h3>
                <div className="border border-card-border rounded-xl overflow-hidden divide-y divide-card-border/50 max-h-96 overflow-y-auto">
                  {data?.stock.listings.map((item) => {
                    const currentConfig = settings.listingOwners[item.id] || { owner: 'Compartidos', splitPercentage: 50, unitCost: 0 };
                    
                    return (
                      <div key={item.id} className="p-4 bg-background/50 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                        <div className="md:col-span-4 flex items-center gap-2.5">
                          {item.thumbnail && (
                            <img src={item.thumbnail} alt={item.title} className="w-10 h-10 object-cover rounded bg-card" />
                          )}
                          <div>
                            <div className="text-xs font-semibold text-text-secondary">{item.id}</div>
                            <div className="text-sm font-bold truncate max-w-[200px]" title={item.title}>{item.title}</div>
                          </div>
                        </div>

                        {/* Owner select */}
                        <div className="md:col-span-3">
                          <select
                            value={currentConfig.owner}
                            onChange={(e) => {
                              const owner = e.target.value as 'Guadalupe' | 'Tomás' | 'Compartidos';
                              const newOwners = { ...settings.listingOwners };
                              newOwners[item.id] = { ...currentConfig, owner };
                              setSettings({ ...settings, listingOwners: newOwners });
                            }}
                            className="w-full bg-background border border-card-border rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none"
                          >
                            <option value="Guadalupe">Guadalupe</option>
                            <option value="Tomás">Tomás</option>
                            <option value="Compartidos">Compartidos</option>
                          </select>
                        </div>

                        {/* Split config (if Compartidos) */}
                        <div className="md:col-span-2">
                          {currentConfig.owner === 'Compartidos' ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={currentConfig.splitPercentage ?? 50}
                                onChange={(e) => {
                                  const split = parseInt(e.target.value, 10);
                                  const newOwners = { ...settings.listingOwners };
                                  newOwners[item.id] = { ...currentConfig, splitPercentage: isNaN(split) ? 50 : split };
                                  setSettings({ ...settings, listingOwners: newOwners });
                                }}
                                className="w-16 bg-background border border-card-border rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none"
                              />
                              <span className="text-[10px] text-text-secondary font-bold">% Guada</span>
                            </div>
                          ) : (
                            <span className="text-xs text-text-muted italic">100% {currentConfig.owner}</span>
                          )}
                        </div>

                        {/* Unit Cost (COGS) */}
                        <div className="md:col-span-3 flex items-center gap-2">
                          <span className="text-xs font-bold text-text-secondary">$</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="Costo compra"
                            value={currentConfig.unitCost || ''}
                            onChange={(e) => {
                              const cost = parseFloat(e.target.value);
                              const newOwners = { ...settings.listingOwners };
                              newOwners[item.id] = { ...currentConfig, unitCost: isNaN(cost) ? 0 : cost };
                              setSettings({ ...settings, listingOwners: newOwners });
                            }}
                            className="w-full bg-background border border-card-border rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Botón de guardado */}
              <div className="flex items-center justify-between pt-4 border-t border-card-border/50">
                {settingsSaveSuccess && (
                  <span className="text-xs text-status-green font-bold bg-status-green/10 border border-status-green/20 px-3 py-1.5 rounded-lg">
                    ✓ Configuración guardada correctamente
                  </span>
                )}
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="ml-auto bg-accent-gold hover:bg-yellow-400 text-black px-6 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition-all-custom flex items-center gap-2"
                >
                  {isSavingSettings ? 'Guardando...' : 'Guardar Ajustes'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* ==============================================
             VISTA DEL DASHBOARD DE MÉTRICAS
             ============================================== */
          ownerMetrics && (
            <div className="space-y-6">
              
              {/* FILA 1: TARJETAS FINANCIERAS RESUMIDAS */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Ingresos Brutos */}
                <div className="bg-card border border-card-border rounded-2xl p-5 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-text-secondary">
                    <span className="text-xs font-bold uppercase tracking-wider">Ventas Acumuladas</span>
                    <ShoppingCart size={16} />
                  </div>
                  <div className="text-2xl font-extrabold text-text-primary">
                    {formatCurrency(ownerMetrics.gross)}
                  </div>
                  <div className="text-[10px] text-text-secondary font-medium mt-1">
                    Ingresos brutos del periodo ({getRangeLabel(timeRange)})
                  </div>
                </div>

                {/* Comisiones y Envío */}
                <div className="bg-card border border-card-border rounded-2xl p-5 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-text-secondary">
                    <span className="text-xs font-bold uppercase tracking-wider">Cargos Mercado Libre</span>
                    <DollarSign size={16} />
                  </div>
                  <div className="text-xl font-extrabold text-status-orange">
                    {formatCurrency(ownerMetrics.commission + ownerMetrics.shipping)}
                  </div>
                  <div className="text-[10px] text-text-secondary font-medium mt-1 flex flex-col">
                    <span>Comisión: {formatCurrency(ownerMetrics.commission)}</span>
                    <span>Envío: {formatCurrency(ownerMetrics.shipping)}</span>
                  </div>
                </div>

                {/* Ganancia Neta */}
                <div className="bg-card border border-card-border rounded-2xl p-5 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-text-secondary">
                    <span className="text-xs font-bold uppercase tracking-wider">Ganancia Neta</span>
                    <TrendingUp size={16} />
                  </div>
                  <div className={`text-2xl font-extrabold ${ownerMetrics.profit >= 0 ? 'text-status-green' : 'text-status-red'}`}>
                    {formatCurrency(ownerMetrics.profit)}
                  </div>
                  <div className="text-[10px] text-text-secondary font-medium mt-1">
                    Ventas − COGS − Cargos ML − Publicidad del periodo ({getRangeLabel(timeRange)})
                  </div>
                </div>

                {/* Margen % */}
                <div className="bg-card border border-card-border rounded-2xl p-5 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-text-secondary">
                    <span className="text-xs font-bold uppercase tracking-wider">Margen Neto %</span>
                    <Info size={16} />
                  </div>
                  <div className="text-2xl font-extrabold text-text-primary">
                    {ownerMetrics.net > 0 ? ((ownerMetrics.profit / ownerMetrics.net) * 100).toFixed(1) : '0.0'}%
                  </div>
                  <div className="text-[10px] text-text-secondary font-medium mt-1">
                    Ganancia neta sobre facturación neta del periodo
                  </div>
                </div>

              </div>

              {/* FILA 2: CONTROL DE STOCK & PUBLICIDAD */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* PUBLICIDAD CARD */}
                <div className="bg-card border border-card-border rounded-2xl p-5 flex flex-col justify-between gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Megaphone className="text-status-orange" size={20} />
                      <h3 className="text-sm font-bold tracking-tight text-text-primary uppercase">Campaña de Publicidad</h3>
                    </div>
                    {data?.errors?.campaigns ? (
                      <span 
                        className="text-[10px] font-bold text-status-orange bg-status-orange/15 border border-status-orange/30 px-2 py-0.5 rounded-md flex items-center gap-1 cursor-help animate-pulse" 
                        title="Error de permisos al consultar campañas en Mercado Libre. Asegúrate de que tu aplicación de Mercado Libre tenga configurado el alcance read_campaigns."
                      >
                        Error 403 <Info size={10} />
                      </span>
                    ) : (
                      activeTab !== 'General' && !Object.values(settings.campaignOwners || {}).includes(activeTab) && (
                        <span className="text-[10px] font-bold text-status-orange bg-status-orange/15 border border-status-orange/30 px-2 py-0.5 rounded-md">Sin Campañas</span>
                      )
                    )}
                  </div>

                  <div className="space-y-4 my-2">
                    <div className="flex items-center justify-between pb-3 border-b border-card-border/50">
                      <span className="text-xs text-text-secondary">Gasto Periodo ({getRangeLabel(timeRange)})</span>
                      <span className="text-lg font-extrabold text-status-orange">{formatCurrency(ownerMetrics.adSpend)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-secondary">Gasto de Hoy</span>
                      <span className="text-sm font-bold text-text-primary">
                        {formatCurrency(
                          activeTab === 'General'
                            ? (data?.ads.Guadalupe?.today || 0) + (data?.ads.Tomás?.today || 0)
                            : data?.ads[activeTab]?.today || 0
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="text-[10px] text-text-secondary italic">
                    {activeTab === 'General' 
                      ? 'Consolidado de todas las campañas activas.'
                      : `Este costo se debita de las ganancias de ${activeTab} (incluye campañas individuales y 50% de las compartidas).`
                    }
                  </div>
                </div>

                {/* STOCK SUMMARY CARD */}
                <div className="bg-card border border-card-border rounded-2xl p-5 flex flex-col justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Package className="text-accent-gold" size={20} />
                    <h3 className="text-sm font-bold tracking-tight text-text-primary uppercase">Métricas de Inventario</h3>
                  </div>

                  <div className="space-y-4 my-2">
                    <div className="flex items-center justify-between pb-3 border-b border-card-border/50">
                      <span className="text-xs text-text-secondary">Unidades en Stock</span>
                      <span className="text-lg font-bold text-text-primary">{ownerMetrics.stockUnits} und</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-secondary">Capital Inmovilizado (COGS)</span>
                      <span className="text-lg font-extrabold text-status-green">{formatCurrency(ownerMetrics.stockCapital)}</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-text-secondary">
                    Calculado multiplicando las unidades en stock por el costo de compra manual de cada ítem.
                  </div>
                </div>

                {/* CASH FLOW PANEL */}
                <div className="bg-card border border-card-border rounded-2xl p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet className="text-status-green" size={20} />
                      <h3 className="text-sm font-bold tracking-tight text-text-primary uppercase">Flujo de Caja</h3>
                    </div>
                    {data?.errors?.balance ? (
                      <span 
                        className="inline-flex items-center gap-1 text-[9px] font-bold text-status-orange bg-status-orange/15 border border-status-orange/30 px-2 py-0.5 rounded-lg cursor-help animate-pulse" 
                        title="La API de balance de Mercado Pago devolvió un error 403. Esto indica que tu aplicación de Mercado Libre necesita solicitar y habilitar el alcance de lectura de facturación (read_billing) en tu consola de Mercado Libre Developers."
                      >
                        Error Balance 403 <Info size={10} />
                      </span>
                    ) : (
                      <div className="text-xs font-bold text-text-secondary">¿Cuánto hay para retirar?</div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-background/40 border border-card-border rounded-xl p-2.5">
                      <span className="text-[9px] font-bold text-status-green uppercase tracking-wide">Disponible</span>
                      <div className="text-xs font-extrabold text-status-green truncate mt-1">
                        {formatCurrency(ownerMetrics.cashFlow.disponible)}
                      </div>
                    </div>
                    <div className="bg-background/40 border border-card-border rounded-xl p-2.5">
                      <span className="text-[9px] font-bold text-status-orange uppercase tracking-wide">A Liberar</span>
                      <div className="text-xs font-extrabold text-status-orange truncate mt-1">
                        {formatCurrency(ownerMetrics.cashFlow.aLiberar)}
                      </div>
                    </div>
                    <div className="bg-background/40 border border-card-border rounded-xl p-2.5">
                      <span className="text-[9px] font-bold text-status-red uppercase tracking-wide">Retenido</span>
                      <div className="text-xs font-extrabold text-status-red truncate mt-1">
                        {formatCurrency(ownerMetrics.cashFlow.retenido)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-zinc-900/40 border border-card-border rounded-xl">
                    <span className="text-xs font-bold text-text-secondary">Flujo Neto Retirable:</span>
                    <span className="text-sm font-black text-white">
                      {formatCurrency(ownerMetrics.cashFlow.flujoNeto)}
                    </span>
                  </div>

                  {/* Gastos Personales Mini Register */}
                  <div className="border-t border-card-border/60 pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <button 
                        onClick={() => setShowExpensesTable(!showExpensesTable)}
                        className="text-[10px] text-accent-gold hover:underline font-bold uppercase tracking-wider flex items-center gap-1"
                      >
                        {showExpensesTable ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        Gasto Personal ({formatCurrency(ownerMetrics.cashFlow.expenses)})
                      </button>
                    </div>

                    {/* Formulario */}
                    <form onSubmit={handleAddExpense} className="grid grid-cols-12 gap-1.5 items-center">
                      <input
                        type="text"
                        placeholder="Descripción"
                        value={expenseForm.description}
                        onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                        className="col-span-5 bg-background border border-card-border rounded px-2 py-1 text-[11px] focus:outline-none"
                      />
                      <input
                        type="number"
                        placeholder="Monto"
                        value={expenseForm.amount}
                        onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                        className="col-span-3 bg-background border border-card-border rounded px-2 py-1 text-[11px] focus:outline-none"
                      />
                      <select
                        value={expenseForm.owner}
                        onChange={(e) => setExpenseForm({ ...expenseForm, owner: e.target.value as any })}
                        className="col-span-3 bg-background border border-card-border rounded px-1 py-1 text-[11px] focus:outline-none"
                      >
                        {activeTab === 'General' ? (
                          <>
                            <option value="Guadalupe">Guadalupe</option>
                            <option value="Tomás">Tomás</option>
                            <option value="Compartidos">Compartidos</option>
                          </>
                        ) : (
                          <option value={activeTab}>{activeTab}</option>
                        )}
                      </select>
                      <button
                        type="submit"
                        className="col-span-1 bg-status-green hover:bg-emerald-400 text-black p-1.5 rounded flex items-center justify-center transition-all-custom"
                      >
                        <Plus size={14} />
                      </button>
                    </form>

                    {/* Tabla Colapsable de Gastos */}
                    {showExpensesTable && (
                      <div className="mt-3 max-h-36 overflow-y-auto border border-card-border rounded-lg bg-background/30 text-[10px] divide-y divide-card-border/50">
                        {expenses
                          .filter(e => activeTab === 'General' ? true : e.owner === activeTab)
                          .map((exp) => (
                            <div key={exp.id} className="p-2 flex items-center justify-between gap-1">
                              <div className="truncate pr-1">
                                <span className="text-text-secondary font-bold mr-1 bg-zinc-800 px-1 py-0.5 rounded uppercase">{exp.owner[0]}</span>
                                <span className="font-semibold text-text-primary">{exp.description}</span>
                                <span className="text-text-muted text-[8px] block">{exp.date}</span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className="font-bold text-status-red">-{formatCurrency(exp.amount)}</span>
                                <button
                                  onClick={() => handleDeleteExpense(exp.id)}
                                  className="text-text-muted hover:text-status-red p-1 rounded"
                                >
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            </div>
                          ))}
                        {expenses.filter(e => activeTab === 'General' ? true : e.owner === activeTab).length === 0 && (
                          <div className="p-3 text-center text-text-muted italic text-[10px]">No hay gastos registrados.</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* FILA 3: TABLA DE UNIDADES VENDIDAS & FINANCIAL BREAKDOWN */}
              <div className="bg-card border border-card-border rounded-2xl p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="text-accent-gold" size={20} />
                    <h3 className="text-base font-bold tracking-tight text-text-primary uppercase">Ventas y Rentabilidad por Publicación ({getRangeLabel(timeRange)})</h3>
                  </div>

                  {/* Filtros de Ventas */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Ordenador */}
                    <select
                      value={salesSortField}
                      onChange={(e) => setSalesSortField(e.target.value as any)}
                      className="bg-background border border-card-border rounded-xl px-2.5 py-1.5 text-[10px] font-bold focus:outline-none"
                    >
                      <option value="volume">Ordenar por Volumen</option>
                      <option value="profit">Ordenar por Ganancia</option>
                      <option value="margin">Ordenar por Margen %</option>
                    </select>

                    <input
                      type="text"
                      placeholder="Buscar publicación..."
                      value={salesSearch}
                      onChange={(e) => setSalesSearch(e.target.value)}
                      className="bg-background border border-card-border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-zinc-500 w-full sm:w-40"
                    />
                  </div>
                </div>

                {/* Tabla Interactiva */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs divide-y divide-card-border/60">
                    <thead>
                      <tr className="text-text-secondary font-bold uppercase tracking-wider bg-background/20">
                        <th className="py-3 px-4">Producto</th>
                        <th className="py-3 px-4 text-center">Titular</th>
                        <th className="py-3 px-4 text-center">Unidades</th>
                        <th className="py-3 px-4 text-right">Precio Prom.</th>
                        <th className="py-3 px-4 text-right">Facturación</th>
                        <th className="py-3 px-4 text-right text-status-orange">Cargos ML</th>
                        <th className="py-3 px-4 text-right">Costo COGS</th>
                        <th className="py-3 px-4 text-right text-status-green">Ganancia</th>
                        <th className="py-3 px-4 text-right">Margen %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-card-border/30">
                      {sortedSalesListings.map((item) => {
                        const units = item.units;
                                    
                        return (
                          <tr key={item.id} className="hover:bg-card-hover/40 transition-colors">
                            <td className="py-3.5 px-4 font-semibold text-text-primary">
                              <div className="flex items-center gap-2">
                                {item.thumbnail && (
                                  <img src={item.thumbnail} alt={item.title} className="w-6 h-6 object-cover rounded bg-background" />
                                )}
                                <div className="truncate max-w-[240px]" title={item.title}>{item.title}</div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                item.owner === 'Guadalupe' ? 'bg-accent-blue/15 text-accent-blue' :
                                item.owner === 'Tomás' ? 'bg-accent-purple/15 text-accent-purple' :
                                'bg-accent-teal/15 text-accent-teal'
                              }`}>
                                {item.owner}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center font-extrabold text-white">
                              {units.toFixed(1).endsWith('.0') ? Math.round(units) : units.toFixed(1)}
                            </td>
                            <td className="py-3.5 px-4 text-right text-text-secondary">
                              {formatCurrency(item.price)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-bold">
                              {formatCurrency(item.grossRevenue)}
                            </td>
                            <td className="py-3.5 px-4 text-right text-status-orange">
                              {formatCurrency(item.commission + item.shipping)}
                            </td>
                            <td className="py-3.5 px-4 text-right text-text-secondary">
                              {formatCurrency(item.cogs)}
                            </td>
                            <td className={`py-3.5 px-4 text-right font-extrabold ${item.profit >= 0 ? 'text-status-green' : 'text-status-red'}`}>
                              {formatCurrency(item.profit)}
                            </td>
                            <td className={`py-3.5 px-4 text-right font-bold ${item.margin >= 20 ? 'text-status-green' : item.margin >= 5 ? 'text-status-orange' : 'text-status-red'}`}>
                              {item.margin.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                      {sortedSalesListings.length === 0 && (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-text-muted italic">No se encontraron productos con ventas en este rango.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* FILA 4: TABLA DE STOCK DETALLADO */}
              <div className="bg-card border border-card-border rounded-2xl p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <Package className="text-accent-gold" size={20} />
                    <h3 className="text-base font-bold tracking-tight text-text-primary uppercase">Inventario y Capital Inmovilizado</h3>
                  </div>

                  <input
                    type="text"
                    placeholder="Buscar producto..."
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    className="bg-background border border-card-border rounded-xl px-3 py-1.5 text-xs focus:outline-none w-full sm:w-56"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs divide-y divide-card-border/60">
                    <thead>
                      <tr className="text-text-secondary font-bold uppercase tracking-wider bg-background/20">
                        <th className="py-3 px-4">Producto</th>
                        <th className="py-3 px-4 text-center">Titular</th>
                        <th className="py-3 px-4 text-center">Disponible</th>
                        <th className="py-3 px-4 text-right">Precio Venta</th>
                        <th className="py-3 px-4 text-right">Costo Unitario</th>
                        <th className="py-3 px-4 text-right text-status-green">Capital Stock</th>
                        <th className="py-3 px-4 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-card-border/30">
                      {filteredStockListings.map((item) => {
                        let displayStock = item.stock;
                        let displayCapital = item.capitalInvertido;
                        
                        if (activeTab === 'Guadalupe' && item.owner === 'Compartidos') {
                          displayStock = item.stock * (item.splitPercent / 100);
                          displayCapital = item.capitalInvertido * (item.splitPercent / 100);
                        } else if (activeTab === 'Tomás' && item.owner === 'Compartidos') {
                          displayStock = item.stock * ((100 - item.splitPercent) / 100);
                          displayCapital = item.capitalInvertido * ((100 - item.splitPercent) / 100);
                        }

                        return (
                          <tr key={item.id} className="hover:bg-card-hover/40 transition-colors">
                            <td className="py-3 px-4 font-semibold text-text-primary">
                              <div className="flex items-center gap-2">
                                {item.thumbnail && (
                                  <img src={item.thumbnail} alt={item.title} className="w-6 h-6 object-cover rounded bg-background" />
                                )}
                                <div className="truncate max-w-[320px]" title={item.title}>{item.title}</div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                item.owner === 'Guadalupe' ? 'bg-accent-blue/15 text-accent-blue' :
                                item.owner === 'Tomás' ? 'bg-accent-purple/15 text-accent-purple' :
                                'bg-accent-teal/15 text-accent-teal'
                              }`}>
                                {item.owner} {item.owner === 'Compartidos' ? `(${item.splitPercent}/${100 - item.splitPercent})` : ''}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-extrabold text-white">
                              {displayStock.toFixed(1).endsWith('.0') ? Math.round(displayStock) : displayStock.toFixed(1)} und
                            </td>
                            <td className="py-3 px-4 text-right text-text-secondary font-semibold">
                              {formatCurrency(item.price)}
                            </td>
                            <td className="py-3 px-4 text-right text-text-secondary font-semibold">
                              {item.unitCost > 0 ? formatCurrency(item.unitCost) : <span className="text-text-muted italic">Sin cargar</span>}
                            </td>
                            <td className="py-3 px-4 text-right font-extrabold text-status-green">
                              {formatCurrency(displayCapital)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <a 
                                href={item.permalink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-accent-gold hover:underline font-bold text-[10px]"
                              >
                                Ver ML <ExternalLink size={10} />
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredStockListings.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-text-muted italic">No se encontraron productos en stock.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )
        )}
      </main>

      {/* 5. FOOTER */}
      <footer className="border-t border-card-border bg-card/10 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-text-secondary">
        <div>
          <span>Última sincronización: </span>
          <span className="font-bold text-text-primary">
            {data ? new Date(data.timestamp).toLocaleTimeString() : 'Nunca'}
          </span>
        </div>
        <div>
          <span>Desarrollado para Tomás & Guadalupe • Ops Dashboard</span>
        </div>
      </footer>

    </div>
  );
}
