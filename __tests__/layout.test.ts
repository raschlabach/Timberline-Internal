import { validateLayout } from '../app/api/truckloads/[id]/layout/route'
import { describe, it, expect } from '@jest/globals'

describe('Layout Validation', () => {
  it('should validate a valid layout with non-stacked items', () => {
    const layout = [
      {
        skidId: 1,
        x: 0,
        y: 0,
        width: 48,
        length: 48,
        type: 'skid',
        customerId: 1,
        customerName: 'Test Customer'
      }
    ]
    expect(() => validateLayout(layout)).not.toThrow()
  })

  it('should validate a valid layout with stacked vinyl items', () => {
    const layout = [
      {
        skidId: 1,
        x: 0,
        y: 0,
        width: 48,
        length: 48,
        type: 'vinyl',
        customerId: 1,
        customerName: 'Test Customer',
        stackId: 1,
        stackPosition: 1
      },
      {
        skidId: 2,
        x: 0,
        y: 0,
        width: 48,
        length: 48,
        type: 'vinyl',
        customerId: 1,
        customerName: 'Test Customer',
        stackId: 1,
        stackPosition: 2
      }
    ]
    expect(() => validateLayout(layout)).not.toThrow()
  })

  it('should reject layout with invalid dimensions', () => {
    const layout = [
      {
        skidId: 1,
        x: 0,
        y: 0,
        width: -1, // Invalid width
        length: 48,
        type: 'skid',
        customerId: 1,
        customerName: 'Test Customer'
      }
    ]
    expect(() => validateLayout(layout)).toThrow()
  })

  it('should reject layout with invalid stack positions', () => {
    const layout = [
      {
        skidId: 1,
        x: 0,
        y: 0,
        width: 48,
        length: 48,
        type: 'vinyl',
        customerId: 1,
        customerName: 'Test Customer',
        stackId: 1,
        stackPosition: 1
      },
      {
        skidId: 2,
        x: 0,
        y: 0,
        width: 48,
        length: 48,
        type: 'vinyl',
        customerId: 1,
        customerName: 'Test Customer',
        stackId: 1,
        stackPosition: 1 // Duplicate stack position
      }
    ]
    expect(() => validateLayout(layout)).toThrow()
  })

  it('should reject layout with inconsistent stack positions', () => {
    const layout = [
      {
        skidId: 1,
        x: 0,
        y: 0,
        width: 48,
        length: 48,
        type: 'vinyl',
        customerId: 1,
        customerName: 'Test Customer',
        stackId: 1,
        stackPosition: 1
      },
      {
        skidId: 2,
        x: 10, // Different x position
        y: 0,
        width: 48,
        length: 48,
        type: 'vinyl',
        customerId: 1,
        customerName: 'Test Customer',
        stackId: 1,
        stackPosition: 2
      }
    ]
    expect(() => validateLayout(layout)).toThrow()
  })

  it('should validate layout with mixed skid and vinyl items', () => {
    const layout = [
      {
        skidId: 1,
        x: 0,
        y: 0,
        width: 48,
        length: 48,
        type: 'skid',
        customerId: 1,
        customerName: 'Test Customer'
      },
      {
        skidId: 2,
        x: 50,
        y: 0,
        width: 48,
        length: 48,
        type: 'vinyl',
        customerId: 1,
        customerName: 'Test Customer',
        stackId: 1,
        stackPosition: 1
      },
      {
        skidId: 3,
        x: 50,
        y: 0,
        width: 48,
        length: 48,
        type: 'vinyl',
        customerId: 1,
        customerName: 'Test Customer',
        stackId: 1,
        stackPosition: 2
      }
    ]
    expect(() => validateLayout(layout)).not.toThrow()
  })
}) 