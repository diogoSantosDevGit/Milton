'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { MetricsGrid } from '@/components/dashboard/metrics-grid'
import { LogoutButton } from '@/components/dashboard/logout-button'
import { FileUpload } from '@/components/dashboard/file-upload'
import { UploadedFilesDisplay } from '@/components/dashboard/uploaded-files-display'
import { FinancialCharts } from '@/components/dashboard/financial-charts'
import { SalesPipeline } from '@/components/dashboard/sales-pipeline'
import { CashFlowAnalysis } from '@/components/dashboard/cash-flow-analysis'
import { MetricSelector } from '@/components/dashboard/metric-selector'
import { ReportsTab } from '@/components/dashboard/reports-tab'
import { UseCaseSelector } from '@/components/dashboard/use-case-selector'

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
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [isReportsOpen, setIsReportsOpen] = useState(false)
  const [hasUploadedData, setHasUploadedData] = useState(false)
  
  // NEW: Use case selection state
  const [selectedUseCase, setSelectedUseCase] = useState<string | null>(null)
  const [useCaseConfirmed, setUseCaseConfirmed] = useState(false)

  console.log('=== DASHBOARD DEBUG ===')
  console.log('useCaseConfirmed:', useCaseConfirmed)
  console.log('selectedUseCase:', selectedUseCase)
  console.log('hasUploadedData:', hasUploadedData)
  console.log('localStorage useCaseConfirmed:', localStorage.getItem('useCaseConfirmed'))
  console.log('localStorage selectedUseCase:', localStorage.getItem('selectedUseCase'))
  console.log('!useCaseConfirmed result:', !useCaseConfirmed)
  console.log('========================')

// ADD THIS NEW SECTION
try {
  console.log('UseCaseSelector import check:', typeof UseCaseSelector)
} catch (error) {
  console.error('UseCaseSelector import error:', error)
}

  useEffect(() => {
    // Check authentication client-side
    const checkAuth = async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
      } else {
        setUser(user)
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

    // NEW: Check if use case was previously selected
    const checkStoredUseCase = () => {
      const storedUseCase = localStorage.getItem('selectedUseCase')
      const storedConfirmed = localStorage.getItem('useCaseConfirmed')
      
      if (storedUseCase && storedConfirmed === 'true') {
        setSelectedUseCase(storedUseCase)
        setUseCaseConfirmed(true)
      }
    }

    checkAuth()
    checkUploadedData()
    checkStoredUseCase()
  }, [router])

  // NEW: Handle use case selection
  const handleUseCaseSelect = (useCaseId: string) => {
    setSelectedUseCase(useCaseId)
    localStorage.setItem('selectedUseCase', useCaseId)
  }

  // NEW: Handle use case confirmation
  const handleUseCaseConfirm = () => {
    setUseCaseConfirmed(true)
    localStorage.setItem('useCaseConfirmed', 'true')
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

      {/* TEMPORARY DEBUG BUTTON - Remove after testing */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <Button 
          onClick={() => {
            localStorage.clear()
            window.location.reload()
          }}
          variant="destructive"
          size="sm"
        >
          🔄 Reset Everything (Debug)
        </Button>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">

          {/* NEW: Use Case Selection Section */}
          {true && (
            <div className="mb-8">
              <Card className="border-2 border-red-500">
                <CardHeader>
                  <CardTitle>TEST: Use Case Selector Should Show Here</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>useCaseConfirmed: {useCaseConfirmed ? 'true' : 'false'}</p>
                  <p>selectedUseCase: {selectedUseCase || 'null'}</p>
                  <Button onClick={() => setUseCaseConfirmed(true)}>
                    Test: Set Confirmed
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Show business type badge when confirmed */}
          {useCaseConfirmed && selectedUseCase && (
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-gray-600">Business Type:</span>
                <span className="text-sm font-medium text-blue-600">B2B Startup</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setUseCaseConfirmed(false)
                    localStorage.removeItem('useCaseConfirmed')
                  }}
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

          {/* UPDATED: File Upload Section - Only show when use case is confirmed */}
          {useCaseConfirmed && (
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
                        </CardTitle>
                        <CardDescription>
                          Upload your bank transactions, CRM data, and budget files to generate comprehensive insights
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
                    {/* UPDATED: Pass selected use case to FileUpload */}
                    <FileUpload selectedUseCase={selectedUseCase} />
                    <UploadedFilesDisplay />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* KPI Tabs - Only show when use case is confirmed */}
          {useCaseConfirmed && (
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
          )}
        </div>
      </main>
    </div>
  )
}