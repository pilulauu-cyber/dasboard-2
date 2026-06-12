import fs from 'fs';
import path from 'path';
import { createClient } from '@vercel/kv';

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

const kvClient = (KV_URL && KV_TOKEN) ? createClient({ url: KV_URL, token: KV_TOKEN }) : null;
const IS_KV_AVAILABLE = !!kvClient;

const LOCAL_DB_PATH = path.join(process.cwd(), 'meli_db.json');

// Interface para base de datos local
interface LocalDB {
  tokens?: any;
  settings?: {
    campaignOwners?: Record<string, 'Guadalupe' | 'Tomás' | 'Compartidos'>;
    listingOwners: Record<string, {
      owner: 'Guadalupe' | 'Tomás' | 'Compartidos';
      splitPercentage?: number;
      unitCost?: number;
    }>;
  };
  expenses?: any[];
}

function readLocalDB(): LocalDB {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const data = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading local DB:', error);
  }
  // Intento en /tmp por si el sistema de archivos del servidor es de solo lectura (como en Vercel sin KV)
  try {
    const tmpPath = path.join('/tmp', 'meli_db.json');
    if (fs.existsSync(tmpPath)) {
      const data = fs.readFileSync(tmpPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {}
  return {};
}

function writeLocalDB(data: LocalDB) {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.warn('Error writing local DB in cwd, trying /tmp:', error);
    try {
      const tmpPath = path.join('/tmp', 'meli_db.json');
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to write to /tmp as well:', e);
    }
  }
}

export async function getTokens(): Promise<any | null> {
  if (IS_KV_AVAILABLE && kvClient) {
    try {
      return await kvClient.get('meli_tokens');
    } catch (e) {
      console.error('Failed to fetch tokens from Vercel KV:', e);
    }
  }
  return readLocalDB().tokens || null;
}

export async function setTokens(tokens: any): Promise<void> {
  if (IS_KV_AVAILABLE && kvClient) {
    try {
      await kvClient.set('meli_tokens', tokens);
      return;
    } catch (e) {
      console.error('Failed to set tokens in Vercel KV:', e);
    }
  }
  const db = readLocalDB();
  db.tokens = tokens;
  writeLocalDB(db);
}

export interface MeliSettings {
  campaignOwners?: Record<string, 'Guadalupe' | 'Tomás' | 'Compartidos'>;
  listingOwners: Record<string, {
    owner: 'Guadalupe' | 'Tomás' | 'Compartidos';
    splitPercentage?: number; // default: 50% para Guadalupe / 50% para Tomás
    unitCost?: number; // Costo unitario (COGS)
  }>;
}

export async function getSettings(): Promise<MeliSettings> {
  if (IS_KV_AVAILABLE && kvClient) {
    try {
      const settings = await kvClient.get<MeliSettings>('meli_settings');
      return settings || { listingOwners: {} };
    } catch (e) {
      console.error('Failed to fetch settings from Vercel KV:', e);
    }
  }
  return readLocalDB().settings || { listingOwners: {} };
}

export async function setSettings(settings: MeliSettings): Promise<void> {
  if (IS_KV_AVAILABLE && kvClient) {
    try {
      await kvClient.set('meli_settings', settings);
      return;
    } catch (e) {
      console.error('Failed to set settings in Vercel KV:', e);
    }
  }
  const db = readLocalDB();
  db.settings = settings;
  writeLocalDB(db);
}

export interface Expense {
  id: string;
  owner: 'Guadalupe' | 'Tomás' | 'Compartidos';
  description: string;
  amount: number;
  date: string;
  category: 'retiro' | 'insumos' | 'publicidad' | 'otro';
}

export async function getExpenses(): Promise<Expense[]> {
  if (IS_KV_AVAILABLE && kvClient) {
    try {
      const expenses = await kvClient.get<Expense[]>('meli_expenses');
      return expenses || [];
    } catch (e) {
      console.error('Failed to fetch expenses from Vercel KV:', e);
    }
  }
  return readLocalDB().expenses || [];
}

export async function setExpenses(expenses: Expense[]): Promise<void> {
  if (IS_KV_AVAILABLE && kvClient) {
    try {
      await kvClient.set('meli_expenses', expenses);
      return;
    } catch (e) {
      console.error('Failed to set expenses in Vercel KV:', e);
    }
  }
  const db = readLocalDB();
  db.expenses = expenses;
  writeLocalDB(db);
}
