'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { MetricsGrid } from '@/components/dashboard/metrics-grid'
import { LogoutButton } from '@/components/dashboard/logout-button'
import { FileUpload } from '@/components/dashboard/file-upload-old'
import { UploadedFilesDisplay } from '@/components/dashboard/uploaded-files-display'
import { FinancialCharts } from '@/components/dashboard/financial-charts'
import { SalesPipeline } from '@/components/dashboard/sales-pipeline'
import { CashFlowAnalysis } from '@/components/dashboard/cash-flow-analysis'
import { MetricSelector } from '@/components/dashboard/metric-selector'
import { ReportsTab } from '@/components/dashboard/reports-tab'
import { UseCaseSelector } from '@/components/dashboard/use-case-selector'
import { getUseCase } from '@/types/use-cases'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible'
import { ChevronDown, ChevronUp, Upload, FileText, Target } from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    'mrr', 'arr', 'cashBalance', 'burnRate', 'contracted',
    'ltmRevenue', 'netMargin', 'customers'
  ])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isUploadOpen, setIsUploadOpen] = useState(true) // Default to open
  const [isReportsOpen, setIsReportsOpen] = useState(false)
  const [hasUploadedData, setHasUploadedData] = useState(false)
  
  // Use case selection state
  const [selectedUseCase, setSelectedUseCase] = useState<string | null>(null)
  const [useCaseConfirmed, setUseCaseConfirmed] = useState(false)

  useEffect(() => {
    // Check authentication client-side
    const checkAuth = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          router.push('/auth/login')
        } else {
          setUser(user)
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        router.push('/auth/login')
      }
      setLoading(false)
    }

    // Check if user has uploaded data
    const checkUploadedData = () => {
      const transactions = localStorage.getItem('transactions')
      const crmDeals = localStorage.getItem('crmDeals')
      const budget = localStorage.getItem('budget')

      const hasData = !!(transactions || crmDeals || budget)
      setHasUploadedData(hasData)

      // If no data, keep upload section open by default
      if (!hasData) {
        setIsUploadOpen(true)
      }
    }

    // Check if use case was previously selected
    const checkStoredUseCase = () => {
      try {
        const storedUseCase = localStorage.getItem('selectedUseCase')
        const storedConfirmed = localStorage.getItem('useCaseConfirmed')
        
        console.log('🔍 Stored use case:', storedUseCase)
        console.log('🔍 Stored confirmed:', storedConfirmed)
        
        if (storedUseCase && storedConfirmed === 'true') {
          setSelectedUseCase(storedUseCase)
          setUseCaseConfirmed(true)
        } else {
          // For testing - temporarily auto-confirm a default use case
          console.log('⚡ Auto-setting default use case for testing')
          setSelectedUseCase('b2b-startup')
          setUseCaseConfirmed(true)
          localStorage.setItem('selectedUseCase', 'b2b-startup')
          localStorage.setItem('useCaseConfirmed', 'true')
        }
      } catch (error) {
        console.error('Error checking use case:', error)
        // Fallback to default
        setSelectedUseCase('b2b-startup')
        setUseCaseConfirmed(true)
      }
    }

    checkAuth()
    checkUploadedData()
    checkStoredUseCase()
  }, [router])

  // Handle use case selection
  const handleUseCaseSelect = (useCaseId: string) => {
    setSelectedUseCase(useCaseId)
    localStorage.setItem('selectedUseCase', useCaseId)
  }

  // Handle use case confirmation
  const handleUseCaseConfirm = () => {
    setUseCaseConfirmed(true)
    localStorage.setItem('useCaseConfirmed', 'true')
  }

  // Reset use case (for testing)
  const resetUseCase = () => {
    setUseCaseConfirmed(false)
    setSelectedUseCase(null)
    localStorage.removeItem('useCaseConfirmed')
    localStorage.removeItem('selectedUseCase')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Key Performance Indicator Cockpit
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{user.email}</span>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">

          {/* DEBUG INFO - Remove in production */}
          <Card className="mb-4 border-yellow-300 bg-yellow-50">
            <CardHeader>
              <CardTitle className="text-sm">🐛 Debug Info (Remove in production)</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              <div>useCaseConfirmed: <strong>{useCaseConfirmed ? 'true' : 'false'}</strong></div>
              <div>selectedUseCase: <strong>{selectedUseCase || 'null'}</strong></div>
              <div>hasUploadedData: <strong>{hasUploadedData ? 'true' : 'false'}</strong></div>
              <div>isUploadOpen: <strong>{isUploadOpen ? 'true' : 'false'}</strong></div>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={resetUseCase}>
                  Reset Use Case
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  localStorage.clear()
                  window.location.reload()
                }}>
                  Clear All Data
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Use Case Selection Section */}
          {!useCaseConfirmed && (
            <div className="mb-8">
              <UseCaseSelector
                selectedUseCase={selectedUseCase}
                onUseCaseSelect={handleUseCaseSelect}
                onConfirm={handleUseCaseConfirm}
              />
            </div>
          )}

          {/* Show business type badge when confirmed */}
          {useCaseConfirmed && selectedUseCase && (
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-gray-600">Business Type:</span>
                <span className="text-sm font-medium text-blue-600">
                  {getUseCase(selectedUseCase)?.name || selectedUseCase}
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={resetUseCase}
                  className="text-xs"
                >
                  Change
                </Button>
              </div>
            </div>
          )}

          {/* Collapsible Reports Section */}
          <Collapsible open={isReportsOpen} onOpenChange={setIsReportsOpen} className="mb-8">
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Generate Reports
                      </CardTitle>
                      <CardDescription>
                        Export professional PDF reports with your current KPIs and analytics
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="sm">
                      {isReportsOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <ReportsTab />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* File Upload Section - ALWAYS SHOW (Fixed) */}
          <Collapsible open={isUploadOpen} onOpenChange={setIsUploadOpen} className="mb-8">
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5" />
                        Upload Financial Data
                        {hasUploadedData && (
                          <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            Data Loaded
                          </span>
                        )}
                        {!useCaseConfirmed && (
                          <span className="text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                            Use Case Required
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription>
                        Upload your bank transactions, CRM data, and budget files to generate comprehensive insights
                        {!useCaseConfirmed && ' (Select business type first)'}
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="sm">
                      {isUploadOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  {/* Always render the content, just disable if use case not confirmed */}
                  {useCaseConfirmed ? (
                    <>
                      <FileUpload selectedUseCase={selectedUseCase} />
                      <UploadedFilesDisplay />
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Upload className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <h3 className="text-lg font-medium mb-2">Business Type Required</h3>
                      <p className="text-sm">Please select your business type above before uploading files.</p>
                      <Button 
                        className="mt-4" 
                        onClick={() => {
                          setSelectedUseCase('b2b-startup')
                          setUseCaseConfirmed(true)
                          localStorage.setItem('selectedUseCase', 'b2b-startup')
                          localStorage.setItem('useCaseConfirmed', 'true')
                        }}
                      >
                        Quick Start with B2B Startup
                      </Button>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* KPI Tabs - Show regardless of use case for better UX */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4 mb-6 bg-white shadow-sm">
              <TabsTrigger value="overview" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                Overview
              </TabsTrigger>
              <TabsTrigger value="financial" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                Financial Analysis
              </TabsTrigger>
              <TabsTrigger value="sales" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                Sales Pipeline
              </TabsTrigger>
              <TabsTrigger value="cashflow" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                Cash Flow
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Key Metrics</h2>
                <MetricSelector
                  selectedMetrics={selectedMetrics}
                  onMetricsChange={(metrics) => setSelectedMetrics(metrics)}
                />
              </div>
              <MetricsGrid selectedMetrics={selectedMetrics} />
              <h2 className="text-xl font-semibold mb-4 mt-8">Performance Charts</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <FinancialCharts type="mrr-vs-plan" />
                <FinancialCharts type="burn-rate" />
              </div>
            </TabsContent>

            <TabsContent value="financial" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FinancialCharts type="income-statement" />
                <FinancialCharts type="variance-analysis" />
              </div>
              <FinancialCharts type="ytd-performance" />
            </TabsContent>

            <TabsContent value="sales" className="space-y-4">
              <SalesPipeline />
            </TabsContent>

            <TabsContent value="cashflow" className="space-y-4">
              <CashFlowAnalysis />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}