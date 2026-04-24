import { getDb } from './client'
import type { Order, OrderStatus } from './types'

export async function createOrder(
  order: Omit<Order, 'id' | 'created_at' | 'status'>
): Promise<Order> {
  const { data, error } = await getDb()
    .from('orders')
    .insert({ ...order, status: 'open' })
    .select()
    .single()

  if (error) throw new Error(`createOrder: ${error.message}`)
  return data as Order
}

export async function getOpenOrders(fromTokenId: string, toTokenId: string): Promise<Order[]> {
  const now = new Date().toISOString()
  const { data, error } = await getDb()
    .from('orders')
    .select('*')
    .eq('from_token_id', fromTokenId)
    .eq('to_token_id', toTokenId)
    .eq('status', 'open')
    .gt('expires_at', now)
    .order('to_amount', { ascending: true }) // best price (lowest ask) first

  if (error) throw new Error(`getOpenOrders: ${error.message}`)
  return (data ?? []) as Order[]
}

export async function getOrderById(id: string): Promise<Order | null> {
  const { data, error } = await getDb()
    .from('orders')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data as Order
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  const { error } = await getDb()
    .from('orders')
    .update({ status })
    .eq('id', id)

  if (error) throw new Error(`updateOrderStatus: ${error.message}`)
}

export async function getOrdersByMaker(makerAddress: string): Promise<Order[]> {
  const { data, error } = await getDb()
    .from('orders')
    .select('*')
    .eq('maker_address', makerAddress)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw new Error(`getOrdersByMaker: ${error.message}`)
  return (data ?? []) as Order[]
}

export async function expireOldOrders(): Promise<void> {
  const now = new Date().toISOString()
  await getDb()
    .from('orders')
    .update({ status: 'expired' })
    .eq('status', 'open')
    .lt('expires_at', now)
}
