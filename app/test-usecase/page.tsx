'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function TestUseCasePage() {
  const [selectedUseCase, setSelectedUseCase] = useState<string | null>(null)
  const [useCaseConfirmed, setUseCaseConfirmed] = useState(false)

  useEffect(() => {
    // Check localStorage
    const storedUseCase = localStorage.getItem('selectedUseCase')
    const storedConfirmed = localStorage.getItem('useCaseConfirmed')
    
    console.log('🔍 Test - Stored use case:', storedUseCase)
    console.log('🔍 Test - Stored confirmed:', storedConfirmed)
    
    if (storedUseCase && storedConfirmed === 'true') {
      setSelectedUseCase(storedUseCase)
      setUseCaseConfirmed(true)
    }
  }, [])

  const resetUseCase = () => {
    setUseCaseConfirmed(false)
    setSelectedUseCase(null)
    localStorage.removeItem('useCaseConfirmed')
    localStorage.removeItem('selectedUseCase')
    console.log('✅ Use case reset')
  }

  const setB2BStartup = () => {
    setSelectedUseCase('b2b-startup')
    setUseCaseConfirmed(true)
    localStorage.setItem('selectedUseCase', 'b2b-startup')
    localStorage.setItem('useCaseConfirmed', 'true')
    console.log('✅ B2B Startup set')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold mb-8 text-center">🧪 Use Case Test Page</h1>
      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Current State</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p><strong>Selected Use Case:</strong> {selectedUseCase || 'null'}</p>
            <p><strong>Confirmed:</strong> {useCaseConfirmed ? 'true' : 'false'}</p>
            <p><strong>localStorage selectedUseCase:</strong> {localStorage.getItem('selectedUseCase') || 'null'}</p>
            <p><strong>localStorage useCaseConfirmed:</strong> {localStorage.getItem('useCaseConfirmed') || 'null'}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4 justify-center">
        <Button onClick={resetUseCase} variant="destructive">
          Reset Use Case
        </Button>
        <Button onClick={setB2BStartup} variant="default">
          Set B2B Startup
        </Button>
        <Button onClick={() => window.location.reload()} variant="outline">
          Reload Page
        </Button>
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-gray-600">
          After resetting, go back to the dashboard to see the use case selector.
        </p>
        <Button 
          onClick={() => window.location.href = '/dashboard'} 
          className="mt-4"
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  )
} 