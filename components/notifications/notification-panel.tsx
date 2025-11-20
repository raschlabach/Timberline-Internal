"use client"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Paperclip, X, AlertCircle } from "lucide-react"

interface Notification {
  id: number
  type: string
  title: string
  message: string
  order_id: number
  document_attachment_id: number
  is_dismissed: boolean
  dismissed_by: number | null
  dismissed_at: string | null
  created_at: string
  order_exists: number | null
}

interface NotificationPanelProps {
  className?: string
}

export function NotificationPanel({ className = "" }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const lastNotificationIdRef = useRef<number | null>(null)

  const fetchNotifications = async (forceRefresh = false) => {
    // Don't show loading spinner on background refreshes
    if (forceRefresh) {
      setIsLoading(true)
    }
    try {
      const response = await fetch('/api/notifications', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        }
      })
      if (response.ok) {
        const data = await response.json()
        const newNotifications = data.notifications || []
        
        // Check if we have new notifications (compare with last known ID)
        const hasNewNotifications = lastNotificationIdRef.current === null || 
          newNotifications.some((n: Notification) => 
            n.id > (lastNotificationIdRef.current || 0)
          )
        
        if (hasNewNotifications && lastNotificationIdRef.current !== null) {
          // Only update if there are actually new notifications to avoid unnecessary re-renders
          const latestId = newNotifications[0]?.id || lastNotificationIdRef.current
          if (latestId > (lastNotificationIdRef.current || 0)) {
            setNotifications(newNotifications)
            lastNotificationIdRef.current = latestId
          }
        } else {
          setNotifications(newNotifications)
          if (newNotifications.length > 0) {
            lastNotificationIdRef.current = newNotifications[0].id
          }
        }
      } else {
        console.error('Failed to fetch notifications:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const dismissNotification = async (notificationId: number) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notificationId })
      })

      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
      }
    } catch (error) {
      console.error('Error dismissing notification:', error)
    }
  }

  const dismissAllNotifications = async () => {
    try {
      await Promise.all(
        notifications.map(notification => 
          fetch('/api/notifications', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ notificationId: notification.id })
          })
        )
      )
      setNotifications([])
    } catch (error) {
      console.error('Error dismissing all notifications:', error)
    }
  }

  useEffect(() => {
    // Initial fetch with loading state
    fetchNotifications(true)
    
    // Listen for notification update events (local events for immediate refresh)
    const handleNotificationUpdate = () => {
      fetchNotifications(false)
    }
    window.addEventListener('notificationUpdate', handleNotificationUpdate)
    
    // Poll for new notifications every 5 seconds (works across all users/devices)
    // This ensures all users see new notifications within 5 seconds
    const interval = setInterval(() => {
      fetchNotifications(false)
    }, 5000)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('notificationUpdate', handleNotificationUpdate)
    }
  }, [])

  if (isLoading) {
    return (
      <div className={`p-4 ${className}`}>
        <Card className="p-3">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </Card>
      </div>
    )
  }

  if (notifications.length === 0) {
    return null
  }

  return (
    <div className={`p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          Notifications
        </h3>
        {notifications.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={dismissAllNotifications}
            className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
          >
            Dismiss All
          </Button>
        )}
      </div>
      
      <div className="space-y-2">
        {notifications.map((notification) => (
          <Card key={notification.id} className="p-3 border-l-4 border-l-amber-400">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Paperclip className="w-3 h-3 text-red-500 flex-shrink-0" />
                  <span className="text-xs font-medium text-gray-900 truncate">
                    {notification.title}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mb-1">
                  {notification.message}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs px-1 py-0">
                    Order #{notification.order_id}
                  </Badge>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dismissNotification(notification.id)}
                className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
