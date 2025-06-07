// components/dashboard/pdf-report-generator.tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileDown, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

// Dynamic import for browser-only PDF generator
let EnhancedPDFGenerator: any = null

interface ReportConfig {
  title: string
  companyName: string
  reportPeriod: string
  includeOverview: boolean
  includeFinancial: boolean
  includeSales: boolean
  includeCashFlow: boolean
}

export function PDFReportGenerator() {
  const [config, setConfig] = useState<ReportConfig>({
    title: 'Monthly Business Report',
    companyName: 'Your Company',
    reportPeriod: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    includeOverview: true,
    includeFinancial: true,
    includeSales: true,
    includeCashFlow: true
  })

  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'generating' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)

  // Initialize client-side services
  useEffect(() => {
    setIsClient(true)
    
    // Load PDF generator dynamically
    const loadPDFGenerator = async () => {
      try {
        const module = await import('@/lib/pdf-generator-enhanced')
        EnhancedPDFGenerator = module.EnhancedPDFGenerator
      } catch (err) {
        console.error('Failed to load PDF generator:', err)
      }
    }
    
    loadPDFGenerator()
  }, [])

  const handleConfigChange = (field: keyof ReportConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }))
  }

  const checkDataAvailability = () => {
    const hasTransactions = !!localStorage.getItem('transactions')
    const hasCRMData = !!localStorage.getItem('crmDeals')
    const hasBudgetData = !!localStorage.getItem('budget')

    return {
      hasTransactions,
      hasCRMData,
      hasBudgetData,
      hasAnyData: hasTransactions || hasCRMData || hasBudgetData
    }
  }

  const generatePDF = async () => {
    if (!isClient || !EnhancedPDFGenerator) {
      setError('PDF generator not available. Please refresh the page.')
      setGenerationStatus('error')
      return
    }
    
    const dataStatus = checkDataAvailability()

  // Don't render until client-side
  if (!isClient) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            Generate PDF Report
          </CardTitle>
          <CardDescription>Loading PDF generator...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }
    
    if (!dataStatus.hasAnyData) {
      setError('No data available. Please upload your financial data first.')
      setGenerationStatus('error')
      return
    }

    setIsGenerating(true)
    setGenerationStatus('generating')
    setError(null)

    try {
      // Add dynamic loading messages
      const statusMessages = [
        'Preparing report configuration...',
        'Capturing dashboard charts...',
        'Rendering financial data...',
        'Generating PDF pages...',
        'Finalizing report...'
      ]

      let currentStep = 0
      const updateStatus = () => {
        if (currentStep < statusMessages.length - 1) {
          currentStep++
          setTimeout(updateStatus, 1500)
        }
      }
      updateStatus()

      const generator = new EnhancedPDFGenerator()
      await generator.generateReport(config)

      setGenerationStatus('success')
      setTimeout(() => setGenerationStatus('idle'), 3000)

    } catch (err) {
      console.error('PDF Generation Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate PDF. Please try again.')
      setGenerationStatus('error')
    } finally {
      setIsGenerating(false)
    }
  }

  const dataStatus = checkDataAvailability()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            Generate PDF Report
          </CardTitle>
          <CardDescription>
            Create a professional PDF report with your current KPIs and analytics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Data Availability Check */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Data Sources:</p>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${dataStatus.hasTransactions ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    Bank Transactions
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${dataStatus.hasCRMData ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    CRM Data
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${dataStatus.hasBudgetData ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    Budget Data
                  </div>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* Report Configuration */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Report Title</Label>
              <Input
                id="title"
                value={config.title}
                onChange={(e) => handleConfigChange('title', e.target.value)}
                placeholder="Monthly Business Report"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="company">Company Name</Label>
              <Input
                id="company"
                value={config.companyName}
                onChange={(e) => handleConfigChange('companyName', e.target.value)}
                placeholder="Your Company Name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="period">Report Period</Label>
            <Select 
              value={config.reportPeriod} 
              onValueChange={(value) => handleConfigChange('reportPeriod', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => {
                  const date = new Date()
                  date.setMonth(date.getMonth() - i)
                  const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                  return (
                    <SelectItem key={monthYear} value={monthYear}>
                      {monthYear}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Section Selection */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Include Sections</Label>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="overview"
                  checked={config.includeOverview}
                  onCheckedChange={(checked) => handleConfigChange('includeOverview', checked)}
                />
                <div className="space-y-1">
                  <Label htmlFor="overview" className="text-sm font-medium cursor-pointer">
                    Overview & Performance
                  </Label>
                  <p className="text-xs text-gray-600">Key metrics and MRR/burn rate charts</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="financial"
                  checked={config.includeFinancial}
                  onCheckedChange={(checked) => handleConfigChange('includeFinancial', checked)}
                />
                <div className="space-y-1">
                  <Label htmlFor="financial" className="text-sm font-medium cursor-pointer">
                    Financial Analysis
                  </Label>
                  <p className="text-xs text-gray-600">Income statement and variance analysis</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="sales"
                  checked={config.includeSales}
                  onCheckedChange={(checked) => handleConfigChange('includeSales', checked)}
                />
                <div className="space-y-1">
                  <Label htmlFor="sales" className="text-sm font-medium cursor-pointer">
                    Sales Pipeline
                  </Label>
                  <p className="text-xs text-gray-600">Pipeline analysis and forecasting</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="cashflow"
                  checked={config.includeCashFlow}
                  onCheckedChange={(checked) => handleConfigChange('includeCashFlow', checked)}
                />
                <div className="space-y-1">
                  <Label htmlFor="cashflow" className="text-sm font-medium cursor-pointer">
                    Cash Flow Analysis
                  </Label>
                  <p className="text-xs text-gray-600">Cash trends and runway analysis</p>
                </div>
              </div>
            </div>
          </div>

          {/* Status Messages */}
          {generationStatus === 'generating' && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Generating your PDF report... This may take a few moments while we capture the charts.
              </AlertDescription>
            </Alert>
          )}

          {generationStatus === 'success' && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                PDF report generated successfully! Check your downloads folder.
              </AlertDescription>
            </Alert>
          )}

          {generationStatus === 'error' && error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Generate Button */}
          <Button 
            onClick={generatePDF} 
            disabled={
              isGenerating || 
              !dataStatus.hasAnyData || 
              (!config.includeOverview && !config.includeFinancial && !config.includeSales && !config.includeCashFlow)
            }
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <FileDown className="mr-2 h-4 w-4" />
                Generate PDF Report
              </>
            )}
          </Button>

          {/* Requirements Note */}
          <div className="text-xs text-gray-600 space-y-1">
            <p><strong>Note:</strong> PDF generation requires:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>At least one data source uploaded (transactions, CRM, or budget)</li>
              <li>At least one section selected</li>
              <li>Modern browser with JavaScript enabled</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}