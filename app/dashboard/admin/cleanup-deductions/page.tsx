'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function CleanupDeductionsPage() {
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message?: string; deletedCount?: number; truckloadIds?: number[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runCleanup = async () => {
    if (!confirm('This will delete all manual deductions from one-driver truckloads. Are you sure?')) {
      return
    }

    setIsRunning(true)
    setResult(null)
    setError(null)

    try {
      const response = await fetch('/api/admin/cleanup-one-driver-deductions', {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setResult({
          success: true,
          message: data.message,
          deletedCount: data.deletedCount,
          truckloadIds: data.truckloadIds
        })
      } else {
        setError(data.error || 'Failed to cleanup deductions')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Cleanup One-Driver Deductions</CardTitle>
          <CardDescription>
            This will delete all manual deductions from truckloads where all orders have the same driver.
            Split load deductions will be preserved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={runCleanup}
            disabled={isRunning}
            variant="destructive"
            className="w-full"
          >
            {isRunning ? 'Running Cleanup...' : 'Run Cleanup'}
          </Button>

          {result && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-800 mb-2">Success!</h3>
              <p className="text-green-700">{result.message}</p>
              {result.deletedCount !== undefined && (
                <p className="text-green-700 mt-2">
                  <strong>Deleted {result.deletedCount} deductions</strong>
                </p>
              )}
              {result.truckloadIds && result.truckloadIds.length > 0 && (
                <p className="text-green-700 mt-2 text-sm">
                  Affected truckloads: {result.truckloadIds.length}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-semibold text-red-800 mb-2">Error</h3>
              <p className="text-red-700">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

