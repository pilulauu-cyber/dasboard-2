import { NextResponse } from 'next/server';
import { getSettings, setSettings, getExpenses, setExpenses, Expense } from '@/lib/storage';

// Obtener todas las configuraciones y gastos
export async function GET() {
  try {
    const settings = await getSettings();
    const expenses = await getExpenses();
    return NextResponse.json({ settings, expenses });
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Actualizar configuraciones o gestionar gastos
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type } = body;

    if (type === 'settings') {
      const { settings } = body;
      if (!settings || typeof settings.listingOwners !== 'object') {
        return NextResponse.json({ error: 'Invalid settings structure' }, { status: 400 });
      }
      await setSettings(settings);
      return NextResponse.json({ success: true, settings });
    } 
    
    if (type === 'addExpense') {
      const { expense } = body;
      if (!expense || !expense.owner || !expense.description || typeof expense.amount !== 'number') {
        return NextResponse.json({ error: 'Invalid expense structure' }, { status: 400 });
      }
      
      const newExpense: Expense = {
        id: Math.random().toString(36).substring(2, 9),
        owner: expense.owner,
        description: expense.description,
        amount: expense.amount,
        date: expense.date || new Date().toISOString().split('T')[0],
        category: expense.category || 'otro'
      };

      const expenses = await getExpenses();
      expenses.push(newExpense);
      await setExpenses(expenses);
      
      return NextResponse.json({ success: true, expense: newExpense });
    }

    if (type === 'deleteExpense') {
      const { id } = body;
      if (!id) {
        return NextResponse.json({ error: 'Missing expense ID' }, { status: 400 });
      }

      const expenses = await getExpenses();
      const filteredExpenses = expenses.filter(e => e.id !== id);
      await setExpenses(filteredExpenses);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown request type' }, { status: 400 });
  } catch (error: any) {
    console.error('Error updating settings/expenses:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
