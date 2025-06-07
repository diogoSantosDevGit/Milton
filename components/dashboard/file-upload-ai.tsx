// components/dashboard/file-upload.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileSpreadsheet, AlertCircle, Check, X, Brain, Zap, Settings, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

interface FileStatus {
  name: string
  type: 'transactions' | 'crm' | 'budget' | 'unknown' | null
  status: 'pending' | 'processing' | 'ai-analyzing' | 'success' | 'error' | 'needs-mapping'
  message?: string
  confidence?: number
  aiUsed?: boolean
  recordCount?: number
  suggestedMappings?: ColumnMapping[]
  previewData?: any[]
  detectedHeaders?: string[]
  aiReasoning?: string
}

interface ColumnMapping {
  originalHeader: string
  suggestedField: string
  confidence: number
  aiReasoning?: string
}

interface FileUploadProps {
  selectedUseCase: string | null
}

interface AIAnalysisResult {
  fileType: 'transactions' | 'crm' | 'budget' | 'unknown'
  confidence: number
  columnMappings: ColumnMapping[]
  reasoning: string
  categories: string[]
  businessInsights?: {
    revenueColumns: string[]
    expenseColumns: string[]
    recurringRevenue: string[]
    dateFormat: string
    numberFormat: string
    primaryAmountColumn: string
  }
}

export function FileUpload({ selectedUseCase = null }: FileUploadProps) {
  const [files, setFiles] = useState<FileStatus[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedFile, setSelectedFile] = useState<FileStatus | null>(null)
  const router = useRouter()

  // FIXED: Excel date conversion utility
  const convertExcelDate = (excelDate: any): string => {
    if (typeof excelDate === 'string' && excelDate.match(/^\d{4}-\d{2}-\d{2}/)) {
      return excelDate // Already in correct format
    }
    
    if (typeof excelDate === 'number') {
      // Excel serial date number to JavaScript Date
      const jsDate = new Date((excelDate - 25569) * 86400 * 1000)
      return jsDate.toISOString().split('T')[0] // Return YYYY-MM-DD
    }
    
    if (typeof excelDate === 'string') {
      // Handle German date formats
      if (excelDate.match(/^\d{2}\.\d{2}\.\d{4}/)) {
        const [day, month, year] = excelDate.split('.')
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      }
      
      if (excelDate.match(/^\d{2}-\d{2}-\d{4}/)) {
        const [day, month, year] = excelDate.split('-')
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      }
      
      // Try parsing as regular date
      try {
        const parsed = new Date(excelDate)
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0]
        }
      } catch (e) {
        console.warn('Date parsing failed for:', excelDate)
      }
    }
    
    // Fallback to current date
    console.warn('Using current date as fallback for:', excelDate)
    return new Date().toISOString().split('T')[0]
  }

  // FIXED: Enhanced number parsing
  const parseAmount = (value: any): number => {
    if (typeof value === 'number') return value
    
    if (typeof value === 'string') {
      // Remove currency symbols and spaces
      let cleanValue = value.replace(/[€$£¥\s]/g, '')
      
      // Handle German number format (1.234,56)
      if (cleanValue.includes(',') && cleanValue.includes('.')) {
        // Check if it's German format: 1.234,56
        const lastComma = cleanValue.lastIndexOf(',')
        const lastDot = cleanValue.lastIndexOf('.')
        if (lastComma > lastDot) {
          // German format: remove dots, replace comma with dot
          cleanValue = cleanValue.replace(/\./g, '').replace(',', '.')
        }
      } else if (cleanValue.includes(',')) {
        // Could be German decimal (1234,56) or US thousands (1,234)
        const parts = cleanValue.split(',')
        if (parts.length === 2 && parts[1].length <= 2) {
          // German decimal: 1234,56
          cleanValue = cleanValue.replace(',', '.')
        } else {
          // US thousands: 1,234,567
          cleanValue = cleanValue.replace(/,/g, '')
        }
      }
      
      const parsed = parseFloat(cleanValue)
      return isNaN(parsed) ? 0 : parsed
    }
    
    return 0
  }

  // OpenAI analysis function (unchanged)
  const analyzeWithOpenAI = async (fileName: string, headers: string[], sampleData: any[]): Promise<AIAnalysisResult> => {
    try {
      console.log('🧠 Analyzing file with OpenAI:', fileName)
      
      let prompt: string
      if (selectedUseCase) {
        try {
          const { getUseCase } = await import('@/types/use-cases')
          const useCase = getUseCase(selectedUseCase)
          if (useCase) {
            const { generateAIPromptForUseCase } = await import('@/lib/ai-prompt-generator')
            prompt = generateAIPromptForUseCase(selectedUseCase, fileName, headers, sampleData)
          } else {
            prompt = createFallbackPrompt(fileName, headers, sampleData)
          }
        } catch (error) {
          console.warn('Use case imports failed, using fallback prompt:', error)
          prompt = createFallbackPrompt(fileName, headers, sampleData)
        }
      } else {
        prompt = createFallbackPrompt(fileName, headers, sampleData)
      }

      const response = await fetch('/api/openai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`)
      }

      const result = await response.json()
      console.log('🧠 OpenAI analysis result:', result)
      
      return {
        fileType: result.fileType,
        confidence: result.confidence,
        columnMappings: result.columnMappings || [],
        reasoning: result.reasoning,
        categories: result.categories || [],
        businessInsights: result.businessInsights
      }
      
    } catch (error) {
      console.error('❌ OpenAI analysis failed:', error)
      console.log('🔄 Falling back to rule-based detection...')
      return fallbackAnalysis(fileName, headers, sampleData)
    }
  }

  const createFallbackPrompt = (fileName: string, headers: string[], sampleData: any[]): string => {
    return `You are an expert financial data analyst. Analyze this file and determine its type and column mappings.

File: ${fileName}
Headers: ${JSON.stringify(headers)}
Sample data: ${JSON.stringify(sampleData.slice(0, 3))}

Respond with valid JSON only:
{
  "fileType": "transactions|crm|budget|unknown",
  "confidence": 0.7,
  "reasoning": "Brief explanation",
  "columnMappings": [
    {
      "originalHeader": "exact header name",
      "suggestedField": "id|date|amount|name|category|reference|dealName|phase|clientName|product|unmapped",
      "confidence": 0.8,
      "aiReasoning": "Why this mapping makes sense"
    }
  ],
  "businessInsights": {
    "revenueColumns": [],
    "expenseColumns": [],
    "recurringRevenue": [],
    "primaryAmountColumn": "",
    "dateFormat": "detected format",
    "numberFormat": "detected format"
  }
}`
  }

  // Enhanced fallback analysis
  const fallbackAnalysis = (fileName: string, headers: string[], sampleData: any[]): AIAnalysisResult => {
    console.log('🔄 Running fallback analysis for:', fileName)
    
    const lowerHeaders = headers.map(h => h.toLowerCase().trim())
    
    // Enhanced detection patterns
    const hasTransactionPatterns = lowerHeaders.some(h => 
      h.includes('amount') || h.includes('betrag') || 
      h.includes('transaction') || h.includes('date') || h.includes('datum')
    )
    
    const hasCRMPatterns = lowerHeaders.some(h => 
      h.includes('deal') || h.includes('client') || h.includes('phase') || 
      h.includes('pipeline') || h.includes('opportunity')
    )
    
    const hasBudgetPatterns = headers.some(h => 
      h.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i) ||
      h.toLowerCase().includes('budget') || h.toLowerCase().includes('plan')
    )

    let fileType: 'transactions' | 'crm' | 'budget' | 'unknown' = 'unknown'
    let confidence = 0.3

    if (hasCRMPatterns) {
      fileType = 'crm'
      confidence = 0.7
    } else if (hasTransactionPatterns) {
      fileType = 'transactions' 
      confidence = 0.7
    } else if (hasBudgetPatterns) {
      fileType = 'budget'
      confidence = 0.6
    }

    // Generate basic column mappings
    const columnMappings: ColumnMapping[] = headers.map(header => {
      const lowerHeader = header.toLowerCase().trim()
      let suggestedField = 'unmapped'
      let confidence = 0.1

      // Enhanced mapping logic
      if (lowerHeader.includes('amount') || lowerHeader.includes('betrag') || lowerHeader.includes('gesamtbetrag')) {
        suggestedField = 'amount'
        confidence = 0.9
      } else if (lowerHeader.includes('date') || lowerHeader.includes('datum')) {
        suggestedField = 'date'
        confidence = 0.9
      } else if (lowerHeader.includes('name') || lowerHeader.includes('gegenpartei') || lowerHeader.includes('empfänger')) {
        suggestedField = 'name'
        confidence = 0.8
      } else if (lowerHeader.includes('category') || lowerHeader.includes('kategorie')) {
        suggestedField = 'category'
        confidence = 0.8
      } else if (lowerHeader.includes('reference') || lowerHeader.includes('verwendungszweck')) {
        suggestedField = 'reference'
        confidence = 0.8
      } else if (lowerHeader.includes('id') || lowerHeader.includes('transaction')) {
        suggestedField = 'id'
        confidence = 0.8
      } 
      // CRM mappings
      else if (lowerHeader.includes('deal')) {
        suggestedField = 'dealName'
        confidence = 0.8
      } else if (lowerHeader.includes('phase') || lowerHeader.includes('stage')) {
        suggestedField = 'phase'
        confidence = 0.8
      } else if (lowerHeader.includes('client')) {
        suggestedField = 'clientName'
        confidence = 0.8
      } else if (lowerHeader.includes('product')) {
        suggestedField = 'product'
        confidence = 0.7
      }

      return {
        originalHeader: header,
        suggestedField,
        confidence,
        aiReasoning: `Fallback analysis: ${confidence > 0.5 ? 'Pattern match' : 'No clear pattern'} for "${lowerHeader}"`
      }
    })

    return {
      fileType,
      confidence,
      columnMappings,
      reasoning: `Fallback analysis: Detected ${fileType} file with ${confidence * 100}% confidence`,
      categories: [],
      businessInsights: {
        revenueColumns: [],
        expenseColumns: [],
        recurringRevenue: [],
        dateFormat: 'unknown',
        numberFormat: 'unknown', 
        primaryAmountColumn: columnMappings.find(m => m.suggestedField === 'amount')?.originalHeader || ''
      }
    }
  }

  // FIXED: Enhanced transaction processing with proper date handling
  const processTransactionFile = async (data: any[], mappings: ColumnMapping[], businessInsights?: any) => {
    console.log('💰 Processing Transaction File')
    console.log('📊 Input data rows:', data.length)
    console.log('🗂️ Column mappings:', mappings)
    console.log('🧠 Business insights:', businessInsights)
    
    if (!data || data.length === 0) {
      throw new Error('No transaction data provided')
    }

    // Create field mapping from AI suggestions
    const fieldMap = Object.fromEntries(
      mappings
        .filter(m => m.suggestedField !== 'unmapped' && m.suggestedField !== 'ignore')
        .map(m => [m.originalHeader, m.suggestedField])
    )
    
    console.log('🗺️ Field mapping created:', fieldMap)

    const transactions = data
      .map((row, index) => {
        const transaction: any = {
          id: `tx_${Date.now()}_${index}`,
          date: '',
          name: 'Unknown Transaction',
          amount: 0,
          reference: '',
          category: 'Other'
        }
        
        // Process each field in the row
        Object.entries(row).forEach(([key, value]) => {
          const mappedField = fieldMap[key]
          
          if (mappedField && value !== null && value !== undefined && value !== '') {
            if (mappedField === 'amount') {
              transaction.amount = parseAmount(value)
            } else if (mappedField === 'date') {
              transaction.date = convertExcelDate(value)
            } else {
              transaction[mappedField] = String(value).trim()
            }
          }
        })
        
        // Enhanced category detection using business insights
        if (businessInsights?.revenueColumns?.length > 0) {
          const isRevenueTransaction = businessInsights.revenueColumns.some((col: string) => 
            Object.keys(row).includes(col) && row[col] && String(row[col]).trim() !== ''
          )
          if (isRevenueTransaction) {
            transaction.isRevenue = true
            transaction.category = transaction.category === 'Other' ? 'Revenue' : transaction.category
          }
        }
        
        // RELAXED VALIDATION: Only require date and valid amount
        if (!transaction.date || transaction.date === '' || isNaN(transaction.amount)) {
          console.log('⚠️ Skipping invalid transaction:', transaction)
          return null
        }
        
        return transaction
      })
      .filter(tx => tx !== null) // Remove invalid transactions
    
    console.log(`✅ Processed ${transactions.length} valid transactions`)
    console.log('📝 Sample processed transaction:', transactions[0])
    
    // Store data
    localStorage.setItem('transactions', JSON.stringify(transactions))
    if (businessInsights) {
      localStorage.setItem('aiBusinessInsights', JSON.stringify(businessInsights))
    }
    
    return transactions.length
  }

  // FIXED: Enhanced CRM processing with relaxed validation
  const processCRMFile = async (data: any[], mappings: ColumnMapping[]) => {
    console.log('🤝 Processing CRM File')
    console.log('📊 Input data rows:', data.length)
    console.log('🗂️ Column mappings:', mappings)
    
    if (!data || data.length === 0) {
      throw new Error('No CRM data provided')
    }

    // Create field mapping from AI suggestions
    const fieldMap = Object.fromEntries(
      mappings
        .filter(m => m.suggestedField !== 'unmapped' && m.suggestedField !== 'ignore')
        .map(m => [m.originalHeader, m.suggestedField])
    )
    
    console.log('🗺️ CRM Field mapping:', fieldMap)

    const deals = data
      .map((row, index) => {
        const deal: any = {
          id: `deal_${Date.now()}_${index}`,
          dealName: '',
          phase: 'Unknown',
          amount: 0,
          clientName: '',
          firstAppointment: '',
          closingDate: '',
          product: 'Unknown Product'
        }
        
        // Process each field in the row
        Object.entries(row).forEach(([key, value]) => {
          const mappedField = fieldMap[key]
          
          if (mappedField && value !== null && value !== undefined && value !== '') {
            if (mappedField === 'amount') {
              deal.amount = parseAmount(value)
            } else if (mappedField === 'firstAppointment' || mappedField === 'closingDate') {
              deal[mappedField] = convertExcelDate(value)
            } else {
              deal[mappedField] = String(value).trim()
            }
          }
        })
        
        // MUCH MORE RELAXED VALIDATION: Accept deal if it has ANY meaningful field
        const hasId = deal.id && deal.id !== ''
        const hasDealName = deal.dealName && deal.dealName !== ''
        const hasAmount = !isNaN(deal.amount) && deal.amount !== 0
        const hasClient = deal.clientName && deal.clientName !== ''
        
        // Accept if has ID + (dealName OR amount OR client)
        if (hasId && (hasDealName || hasAmount || hasClient)) {
          // Fill in missing required fields with defaults from available data
          if (!deal.dealName) {
            deal.dealName = deal.clientName ? `Deal with ${deal.clientName}` : `Deal ${index + 1}`
          }
          if (!deal.clientName) {
            deal.clientName = 'Unknown Client'
          }
          return deal
        }
        
        console.log('⚠️ Skipping invalid deal:', deal)
        return null
      })
      .filter(deal => deal !== null) // Remove invalid deals
    
    console.log(`✅ Processed ${deals.length} valid deals`)
    console.log('📝 Sample processed deal:', deals[0])
    
    localStorage.setItem('crmDeals', JSON.stringify(deals))
    return deals.length
  }

  // Budget processing (unchanged)
  const processBudgetFile = async (workbook: XLSX.WorkBook) => {
    console.log('📊 Processing Budget File')
    
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][]
    
    console.log('📋 Raw budget data rows:', data.length)
    
    if (!data || data.length < 2) {
      throw new Error('Budget file must have at least header and data rows')
    }
    
    // Extract months from header row
    const months = data[0].slice(1).filter(m => m && String(m).trim() !== '')
    console.log('📅 Detected months:', months)
    
    if (months.length === 0) {
      throw new Error('No month columns detected in budget file')
    }
    
    const budgetData: any = { months: months }
    
    // Process each category row (skip header)
    let processedCategories = 0
    for (let i = 1; i < data.length; i++) {
      const category = data[i][0]
      if (category && String(category).trim() !== '') {
        budgetData[category] = {}
        for (let j = 1; j <= months.length; j++) {
          const value = data[i][j]
          budgetData[category][months[j-1]] = parseFloat(value) || 0
        }
        processedCategories++
      }
    }
    
    console.log(`✅ Processed ${processedCategories} budget categories`)
    console.log('📝 Budget data structure:', Object.keys(budgetData))
    
    localStorage.setItem('budget', JSON.stringify(budgetData))
    return processedCategories
  }

  // Apply manual mapping function (updated with fixes)
  const applyManualMapping = async (fileIndex: number, updatedMappings: ColumnMapping[]) => {
    const file = files[fileIndex]
    if (!file || !file.previewData) return

    try {
      console.log('🔧 Applying manual mapping for:', file.name)
      
      setFiles(prev => prev.map((f, idx) => 
        idx === fileIndex ? { ...f, status: 'processing' } : f
      ))

      let processedCount = 0
      
      if (file.type === 'transactions') {
        processedCount = await processTransactionFile(file.previewData, updatedMappings)
        
        setFiles(prev => prev.map((f, idx) => 
          idx === fileIndex ? {
            ...f,
            status: 'success',
            message: `Manually processed ${processedCount} transactions`,
            confidence: 1.0,
            recordCount: processedCount
          } : f
        ))
      } else if (file.type === 'crm') {
        processedCount = await processCRMFile(file.previewData, updatedMappings)
        
        setFiles(prev => prev.map((f, idx) => 
          idx === fileIndex ? {
            ...f,
            status: 'success',
            message: `Manually processed ${processedCount} deals`,
            confidence: 1.0,
            recordCount: processedCount
          } : f
        ))
      }

      setTimeout(() => {
        window.location.reload()
      }, 1000)

    } catch (error) {
      console.error('❌ Manual mapping failed:', error)
      setFiles(prev => prev.map((f, idx) => 
        idx === fileIndex ? {
          ...f,
          status: 'error',
          message: `Manual processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        } : f
      ))
    }
  }

  // Main file upload handler (rest unchanged)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files
    if (!uploadedFiles || uploadedFiles.length === 0) return

    setIsProcessing(true)
    const newFiles: FileStatus[] = Array.from(uploadedFiles).map(file => ({
      name: file.name,
      type: null,
      status: 'pending'
    }))
    
    setFiles(newFiles)

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i]
      
      setFiles(prev => prev.map((f, idx) => 
        idx === i ? { ...f, status: 'processing' } : f
      ))
      
      try {
        let headers: string[] = []
        let fileData: any[] = []
        
        if (file.name.endsWith('.csv')) {
          const text = await file.text()
          const result = Papa.parse(text, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            delimiter: ';'
          })
          
          headers = result.meta.fields || []
          fileData = result.data
          
        } else if (file.name.match(/\.(xlsx|xls)$/)) {
          const arrayBuffer = await file.arrayBuffer()
          const workbook = XLSX.read(arrayBuffer, { type: 'array' })
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          
          const sheetData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][]
          headers = sheetData[0]?.filter(h => h) || []
          fileData = XLSX.utils.sheet_to_json(firstSheet)
        }

        if (fileData.length === 0) {
          throw new Error('No data found in file')
        }

        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'ai-analyzing' } : f
        ))

        // Use OpenAI for enhanced AI detection
        const aiResult = await analyzeWithOpenAI(file.name, headers, fileData)
        
        console.log(`🎯 AI Analysis complete for ${file.name}:`, aiResult)
        
        if (aiResult.confidence > 0.5) {
          let processedCount = 0
          
          if (aiResult.fileType === 'transactions') {
            processedCount = await processTransactionFile(fileData, aiResult.columnMappings, aiResult.businessInsights)
          } else if (aiResult.fileType === 'crm') {
            processedCount = await processCRMFile(fileData, aiResult.columnMappings)
          } else if (aiResult.fileType === 'budget') {
            const arrayBuffer = await file.arrayBuffer()
            const workbook = XLSX.read(arrayBuffer, { type: 'array' })
            processedCount = await processBudgetFile(workbook)
          }

          setFiles(prev => prev.map((f, idx) => 
            idx === i ? {
              ...f,
              type: aiResult.fileType,
              status: 'success',
              message: `AI processed ${processedCount} records`,
              confidence: aiResult.confidence,
              aiUsed: true,
              recordCount: processedCount,
              aiReasoning: aiResult.reasoning,
              suggestedMappings: aiResult.columnMappings,
              previewData: fileData.slice(0, 10),
              detectedHeaders: headers
            } : f
          ))
        } else {
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? {
              ...f,
              status: 'needs-mapping',
              message: 'Low confidence - needs manual review',
              confidence: aiResult.confidence,
              aiUsed: true,
              suggestedMappings: aiResult.columnMappings,
              previewData: fileData.slice(0, 5),
              detectedHeaders: headers,
              aiReasoning: aiResult.reasoning
            } : f
          ))
        }

      } catch (error) {
        console.error(`❌ Processing failed for ${file.name}:`, error)
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? {
            ...f,
            status: 'error',
            message: error instanceof Error ? error.message : 'Processing failed'
          } : f
        ))
      }
    }

    setIsProcessing(false)
    
    const hasSuccess = newFiles.some(f => f.status === 'success')
    if (hasSuccess) {
      setTimeout(() => {
        router.refresh()
        window.location.reload()
      }, 2000)
    }
  }

  // Helper functions for UI (same as before)
  const getStatusIcon = (status: FileStatus['status']) => {
    switch (status) {
      case 'success':
        return <Check className="h-4 w-4 text-green-500" />
      case 'error':
        return <X className="h-4 w-4 text-red-500" />
      case 'processing':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
      case 'ai-analyzing':
        return <Brain className="h-4 w-4 text-purple-500 animate-pulse" />
      case 'needs-mapping':
        return <Settings className="h-4 w-4 text-orange-500" />
      default:
        return <FileSpreadsheet className="h-4 w-4 text-gray-400" />
    }
  }

  const getFileTypeLabel = (type: FileStatus['type'], status: FileStatus['status']) => {
    if (status === 'ai-analyzing') return 'AI Analyzing...'
    if (status === 'needs-mapping') return 'Needs Review'
    
    switch (type) {
      case 'transactions':
        return 'Bank Transactions'
      case 'crm':
        return 'CRM Data'
      case 'budget':
        return 'Budget/Plan'
      default:
        return 'Processing...'
    }
  }

  const getConfidenceBadge = (confidence?: number, aiUsed?: boolean) => {
    if (!confidence) return null
    
    const variant = confidence > 0.8 ? 'default' : confidence > 0.6 ? 'secondary' : 'outline'
    const icon = aiUsed ? <Brain className="h-3 w-3" /> : <Zap className="h-3 w-3" />
    
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        {icon}
        {Math.round(confidence * 100)}%
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-center w-full">
          <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 border-gray-300">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              {isProcessing ? (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500">Processing files with enhanced AI...</p>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 mb-3 text-gray-400" />
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">
                    Multi-language support: German/English headers, various formats
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    🧠 Enhanced AI + Rules Engine for complex file structures
                  </p>
                </>
              )}
            </div>
            <input
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              disabled={isProcessing}
              multiple
            />
          </label>
        </div>
      </div>

      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">File Analysis Results</CardTitle>
            <CardDescription>
              Enhanced detection with multi-language support and AI fallback
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(file.status)}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{file.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-gray-500">
                          {getFileTypeLabel(file.type, file.status)}
                        </p>
                        {getConfidenceBadge(file.confidence, file.aiUsed)}
                        
                        {(file.status === 'needs-mapping' || file.status === 'success') && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant={file.status === 'needs-mapping' ? "outline" : "ghost"}
                                size="sm"
                                onClick={() => setSelectedFile(file)}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                {file.status === 'needs-mapping' ? 'Review Required' : 'Review Mapping'}
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-6xl max-h-[80vh] overflow-hidden" aria-describedby="dialog-description">
                              <DialogHeader>
                                <DialogTitle>Review File Mapping - {file.name}</DialogTitle>
                                <DialogDescription id="dialog-description">
                                  Review and adjust the AI-suggested column mappings for your data file.
                                </DialogDescription>
                              </DialogHeader>
                              
                              <Tabs defaultValue="mappings" className="w-full h-full flex flex-col">
                                <TabsList className="flex-shrink-0">
                                  <TabsTrigger value="mappings">Column Mappings</TabsTrigger>
                                  <TabsTrigger value="preview">Data Preview</TabsTrigger>
                                </TabsList>
                                
                                <TabsContent value="mappings" className="flex-1 overflow-y-auto space-y-4">
                                  <div className="grid gap-4">
                                    {file.suggestedMappings?.map((mapping, idx) => (
                                      <div key={idx} className="flex items-center gap-4 p-3 border rounded">
                                        <div className="flex-1 min-w-0">
                                          <Label className="text-sm font-medium truncate block">{mapping.originalHeader}</Label>
                                        </div>
                                        <div className="flex-1">
                                          <Select 
                                            value={mapping.suggestedField}
                                            onValueChange={(value) => {
                                              if (selectedFile?.suggestedMappings) {
                                                const updatedMappings = [...selectedFile.suggestedMappings]
                                                updatedMappings[idx] = { ...mapping, suggestedField: value }
                                                setSelectedFile({ ...selectedFile, suggestedMappings: updatedMappings })
                                                setFiles(prev => prev.map(f => 
                                                  f.name === selectedFile.name 
                                                    ? { ...f, suggestedMappings: updatedMappings }
                                                    : f
                                                ))
                                              }
                                            }}
                                          >
                                            <SelectTrigger>
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="id">ID</SelectItem>
                                              <SelectItem value="date">Date</SelectItem>
                                              <SelectItem value="name">Name</SelectItem>
                                              <SelectItem value="amount">Amount</SelectItem>
                                              <SelectItem value="category">Category</SelectItem>
                                              <SelectItem value="reference">Reference</SelectItem>
                                              <SelectItem value="dealName">Deal Name</SelectItem>
                                              <SelectItem value="phase">Phase</SelectItem>
                                              <SelectItem value="clientName">Client Name</SelectItem>
                                              <SelectItem value="product">Product</SelectItem>
                                              <SelectItem value="unmapped">Unmapped</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <Badge variant={mapping.confidence > 0.7 ? 'default' : 'secondary'}>
                                          {Math.round(mapping.confidence * 100)}%
                                        </Badge>
                                      </div>
                                    ))}
                                  </div>
                                  
                                  <div className="flex gap-2 pt-4 border-t">
                                    <Button 
                                      onClick={() => {
                                        const fileIndex = files.findIndex(f => f.name === selectedFile?.name)
                                        if (fileIndex !== -1 && selectedFile?.suggestedMappings) {
                                          applyManualMapping(fileIndex, selectedFile.suggestedMappings)
                                        }
                                      }}
                                      disabled={!selectedFile?.suggestedMappings}
                                    >
                                      Apply Mapping
                                    </Button>
                                    <Button variant="outline">Save as Template</Button>
                                  </div>
                                </TabsContent>
                                
                                <TabsContent value="preview" className="flex-1 overflow-hidden">
                                  <div className="h-full flex flex-col">
                                    <div className="flex-1 overflow-auto border rounded">
                                      <div className="min-w-full">
                                        <table className="w-full border-collapse text-xs">
                                          <thead className="bg-gray-50 sticky top-0 z-10">
                                            <tr>
                                              {file.detectedHeaders?.slice(0, 6).map((header, idx) => (
                                                <th key={idx} className="border p-2 text-left font-medium min-w-[120px] max-w-[200px]">
                                                  <div className="truncate" title={header}>
                                                    {header}
                                                  </div>
                                                </th>
                                              ))}
                                              {(file.detectedHeaders?.length || 0) > 6 && (
                                                <th className="border p-2 text-left font-medium w-16">
                                                  +{(file.detectedHeaders?.length || 0) - 6}
                                                </th>
                                              )}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {file.previewData?.slice(0, 15).map((row, idx) => (
                                              <tr key={idx} className="hover:bg-gray-50">
                                                {file.detectedHeaders?.slice(0, 6).map((header, headerIdx) => (
                                                  <td key={headerIdx} className="border p-2 min-w-[120px] max-w-[200px]">
                                                    <div className="truncate" title={row[header]?.toString() || ''}>
                                                      {row[header]?.toString() || ''}
                                                    </div>
                                                  </td>
                                                ))}
                                                {(file.detectedHeaders?.length || 0) > 6 && (
                                                  <td className="border p-2 text-gray-500 text-center">...</td>
                                                )}
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                    <div className="text-sm text-gray-500 mt-2 flex-shrink-0">
                                      Showing first 15 rows and 6 columns. Total: {file.previewData?.length || 0} rows, {file.detectedHeaders?.length || 0} columns.
                                    </div>
                                  </div>
                                </TabsContent>
                              </Tabs>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    {file.message && (
                      <p className={`text-xs ${
                        file.status === 'error' ? 'text-red-600' : 
                        file.status === 'needs-mapping' ? 'text-orange-600' :
                        'text-green-600'
                      }`}>
                        {file.message}
                      </p>
                    )}
                    {file.recordCount && (
                      <p className="text-xs text-gray-500 mt-1">
                        {file.recordCount} records
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>FIXED Issues:</strong> ✅ Excel date conversion ✅ Relaxed validation ✅ German number format ✅ Better field mapping
          Files should now process correctly and show proper metrics in the dashboard.
        </AlertDescription>
      </Alert>
    </div>
  )
}