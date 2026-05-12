'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CharcoalDashboardData, CharcoalCustomer, CharcoalHistoryData } from '@/types/charcoal'

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export function useCharcoalDashboard() {
  return useQuery<CharcoalDashboardData & { lastSkid: any }>({
    queryKey: ['charcoal', 'dashboard'],
    queryFn: () => fetchJson('/api/charcoal/dashboard'),
    refetchInterval: 30_000,
  })
}

export function useCharcoalCustomers() {
  return useQuery<{ customers: CharcoalCustomer[] }>({
    queryKey: ['charcoal', 'customers'],
    queryFn: () => fetchJson('/api/charcoal/customers'),
  })
}

export function useCharcoalHistory(from: string, to: string) {
  return useQuery<CharcoalHistoryData>({
    queryKey: ['charcoal', 'history', from, to],
    queryFn: () => fetchJson(`/api/charcoal/history?from=${from}&to=${to}`),
    enabled: !!from && !!to,
  })
}

export function useCreateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { customer_id: string; quantity: number; due_date?: string; notes?: string }) =>
      fetchJson('/api/charcoal/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['charcoal', 'dashboard'] }) },
  })
}

export function useUpdateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; customer_id?: string; quantity?: number; due_date?: string; notes?: string; status?: string }) =>
      fetchJson(`/api/charcoal/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['charcoal', 'dashboard'] }) },
  })
}

export function useDeleteOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/charcoal/orders/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['charcoal', 'dashboard'] }) },
  })
}

export function useReorderOrders() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      fetchJson('/api/charcoal/orders/reorder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderedIds }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['charcoal', 'dashboard'] }) },
  })
}

export function useCreateSkid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { is_walnut_creek: boolean; notes?: string; wrapped_at?: string }) =>
      fetchJson('/api/charcoal/skids', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['charcoal', 'dashboard'] }) },
  })
}

export function useUpdateSkid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; is_walnut_creek?: boolean; notes?: string; wrapped_at?: string }) =>
      fetchJson(`/api/charcoal/skids/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['charcoal', 'dashboard'] }) },
  })
}

export function useDeleteSkid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/charcoal/skids/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['charcoal', 'dashboard'] }) },
  })
}

export function useCreateProjection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { count: number; ready_date: string; is_walnut_creek: boolean; notes?: string }) =>
      fetchJson('/api/charcoal/projected', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['charcoal', 'dashboard'] }) },
  })
}

export function useUpdateProjection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; count?: number; ready_date?: string; is_walnut_creek?: boolean; notes?: string }) =>
      fetchJson(`/api/charcoal/projected/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['charcoal', 'dashboard'] }) },
  })
}

export function useDeleteProjection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/charcoal/projected/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['charcoal', 'dashboard'] }) },
  })
}

export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; contact_name?: string; phone?: string; email?: string; notes?: string; is_walnut_creek?: boolean }) =>
      fetchJson('/api/charcoal/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['charcoal', 'customers'] })
      qc.invalidateQueries({ queryKey: ['charcoal', 'dashboard'] })
    },
  })
}

export function useUpdateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; contact_name?: string; phone?: string; email?: string; notes?: string; is_walnut_creek?: boolean }) =>
      fetchJson(`/api/charcoal/customers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['charcoal', 'customers'] })
      qc.invalidateQueries({ queryKey: ['charcoal', 'dashboard'] })
    },
  })
}

export function useDeleteCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/charcoal/customers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['charcoal', 'customers'] })
    },
  })
}
