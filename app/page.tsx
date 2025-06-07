import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MetricsGrid } from '@/components/dashboard/metrics-grid'
import { LogoutButton } from '@/components/dashboard/logout-button'
import { FileUpload } from '@/components/dashboard/file-upload'
import { FinancialCharts } from '@/components/dashboard/financial-charts'
import { SalesPipeline } from '@/components/dashboard/sales-pipeline'
import { CashFlowAnalysis } from '@/components/dashboard/cash-flow-analysis'
import { UploadedFilesDisplay } from '@/components/dashboard/uploaded-files-display'




export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
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
          {/* File Upload Section */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Upload Financial Data</CardTitle>
              <CardDescription>
                Upload your bank transactions, CRM data, and budget files to generate comprehensive insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload />
            </CardContent>
          </Card>

          {/* KPI Tabs */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="financial">Financial Analysis</TabsTrigger>
              <TabsTrigger value="sales">Sales Pipeline</TabsTrigger>
              <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <MetricsGrid />
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