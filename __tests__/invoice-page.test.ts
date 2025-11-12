import { describe, it, expect } from '@jest/globals'

describe('Invoice Page component modules', () => {
  it('should import TruckloadInvoicePage without throwing', async () => {
    const mod = await import('../components/invoices/truckload-invoice-page')
    expect(mod).toBeDefined()
    expect(typeof mod.default).toBe('function')
  })

  it('should import invoice page route without throwing', async () => {
    const mod = await import('../app/dashboard/invoices/page')
    expect(mod).toBeDefined()
    expect(typeof mod.default).toBe('function')
  })
})


