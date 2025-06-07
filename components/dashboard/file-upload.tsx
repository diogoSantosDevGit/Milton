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
import { generateAIPromptForUseCase } from '@/lib/ai-prompt-generator'

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

  // State management
  const [files, setFiles] = useState<FileStatus[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedFile, setSelectedFile] = useState<FileStatus | null>(null)
  const router = useRouter()

  // Header mappings for different languages
  const headerMappings: Record<string, string> = {
    // German headers
    'transaktions-id': 'id',
    'transaktions id': 'id',
    'datum des vorgangs': 'date',
    'datum': 'date',
    'name der gegenpartei': 'name',
    'gegenpartei': 'name',
    'empfänger/zahlungspflichtiger': 'name',
    'gesamtbetrag (inkl. mwst.)': 'amount',
    'gesamtbetrag': 'amount',
    'betrag': 'amount',
    'verwendungszweck': 'reference',
    'kategorie': 'category',
    'buchungstext': 'category',
    'personal/hr': 'category',
    'coaches': 'category', 
    'wiederk. programme': 'category',
    'technology': 'category',
    'office': 'category',
    'marketing': 'category',
    'consulting services': 'category',
    'cogs': 'category',
    // English headers
    'transaction id': 'id',
    'id': 'id',
    'date': 'date',
    'transaction date': 'date',
    'name': 'name',
    'description': 'name',
    'payee': 'name',
    'amount': 'amount',
    'total amount': 'amount',
    'reference': 'reference',
    'memo': 'reference',
    'category': 'category',
    'type': 'category',
    // CRM headers
    'datapoint id': 'id',
    'deal name': 'dealName',
    'deal phase': 'phase',
    'client name': 'clientName',
    'date of first appointment': 'firstAppointment',
    'closing date': 'closingDate',
    'product': 'product'
  }

  // OpenAI analysis function
  const analyzeWithOpenAI = async (fileName: string, headers: string[], sampleData: any[]): Promise<AIAnalysisResult> => {
    try {
      console.log('Analyzing file with OpenAI:', fileName)
      
      // Use the new AI prompt generator if use case is selected
      let prompt: string
      if (selectedUseCase) {
        // Import the getUseCase function
        const { getUseCase } = await import('@/types/use-cases')
        const useCase = getUseCase(selectedUseCase)
        if (useCase) {
          const { generateAIPromptForUseCase } = await import('@/types/use-cases')
          prompt = generateAIPromptForUseCase(useCase, fileName, headers, sampleData)
        } else {
          prompt = `You are an expert financial data analyst. Analyze this file: ${fileName} with headers: ${JSON.stringify(headers)} and sample data: ${JSON.stringify(sampleData.slice(0, 3))}`
        }
      } else {
        prompt = `You are an expert financial data analyst. Analyze this file: ${fileName} with headers: ${JSON.stringify(headers)} and sample data: ${JSON.stringify(sampleData.slice(0, 3))}`
      }
  
      // Rest of the function stays the same...
      const response = await fetch('/api/openai-analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      })
  
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`)
      }
  
      const result = await response.json()
      console.log('OpenAI analysis result:', result)
      
      return {
        fileType: result.fileType,
        confidence: result.confidence,
        columnMappings: result.columnMappings,
        reasoning: result.reasoning,
        categories: result.categories || [],
        businessInsights: result.businessInsights
      }
      
    } catch (error) {
      console.error('OpenAI analysis failed:', error)
      console.log('Falling back to rule-based detection...')
      return fallbackAnalysis(fileName, headers, sampleData)
    }
  }

  // Fallback analysis function
  const fallbackAnalysis = (fileName: string, headers: string[], sampleData: any[]): AIAnalysisResult => {
    const hasAmount = headers.some(h => 
      h.toLowerCase().includes('betrag') || 
      h.toLowerCase().includes('amount')
    )
    
    const hasDate = headers.some(h => 
      h.toLowerCase().includes('datum') || 
      h.toLowerCase().includes('date')
    )
    
    if (hasAmount && hasDate) {
      return {
        fileType: 'transactions',
        confidence: 0.6,
        columnMappings: mapTransactionHeaders(headers),
        reasoning: 'Fallback analysis: detected basic transaction structure',
        categories: []
      }
    }

    return {
      fileType: 'unknown',
      confidence: 0.3,
      columnMappings: [],
      reasoning: 'Fallback analysis: could not determine file type',
      categories: []
    }
  }

  // Header mapping functions
  const mapTransactionHeaders = (headers: string[]): ColumnMapping[] => {
    console.log('Mapping transaction headers:', headers)
    
    return headers.map(header => {
      const lowerHeader = header.toLowerCase().trim()
      const mapped = headerMappings[lowerHeader]
      
      console.log(`Header "${header}" -> "${lowerHeader}" -> "${mapped || 'unmapped'}"`)
      
      return {
        originalHeader: header,
        suggestedField: mapped || 'unmapped',
        confidence: mapped ? 0.9 : 0.1,
        aiReasoning: mapped ? `Direct mapping found for "${lowerHeader}"` : 'No direct mapping available'
      }
    })
  }

  // Data processing functions
  const processTransactionFile = async (data: any[], mappings: ColumnMapping[], businessInsights?: any) => {
    console.log('=== Processing Transaction File ===')
    console.log('Mappings received:', mappings)
    console.log('Business insights:', businessInsights)
    console.log('Sample raw data:', data.slice(0, 2))
    
    // Create field mapping from AI suggestions
    const fieldMap = Object.fromEntries(
      mappings.map(m => [m.originalHeader, m.suggestedField])
    )
    
    console.log('Field mapping created:', fieldMap)

    // If no good mappings from AI, try to detect common patterns
    if (mappings.length === 0 || mappings.every(m => m.suggestedField === 'unmapped')) {
      console.log('No AI mappings found, using pattern detection...')
      
      // Get the first row to analyze headers
      const sampleRow = data[0]
      if (sampleRow) {
        Object.keys(sampleRow).forEach(header => {
          const lowerHeader = header.toLowerCase().trim()
          
          // Detect amount columns
          if (lowerHeader.includes('betrag') || lowerHeader.includes('amount') || lowerHeader.includes('total')) {
            fieldMap[header] = 'amount'
          }
          // Detect date columns  
          else if (lowerHeader.includes('datum') || lowerHeader.includes('date')) {
            fieldMap[header] = 'date'
          }
          // Detect name/description columns
          else if (lowerHeader.includes('name') || lowerHeader.includes('gegenpartei') || lowerHeader.includes('beschreibung')) {
            fieldMap[header] = 'name'
          }
          // Detect ID columns
          else if (lowerHeader.includes('id') || lowerHeader.includes('transaction')) {
            fieldMap[header] = 'id'
          }
          // Detect reference columns
          else if (lowerHeader.includes('referenz') || lowerHeader.includes('verwendung') || lowerHeader.includes('memo')) {
            fieldMap[header] = 'reference'
          }
          // Revenue detection for specific columns
          else if (lowerHeader.includes('eingehende') || lowerHeader.includes('wiederk')) {
            fieldMap[header] = 'category'
          }
        })
      }
      
      console.log('Updated field mapping after pattern detection:', fieldMap)
    }

    const transactions = data.map((row, index) => {
      const transaction: any = {}
      
      // Process each field in the row
      Object.entries(row).forEach(([key, value]) => {
        const mappedField = fieldMap[key]
        
        if (mappedField && mappedField !== 'unmapped') {
          if (mappedField === 'amount') {
            let amount = 0
            if (value !== null && value !== undefined && value !== '') {
              if (typeof value === 'string') {
                // Enhanced German number parsing
                let cleanValue = String(value).replace(/[€$£¥\s]/g, '')
                
                // German format: 1.234,56 -> 1234.56
                if (cleanValue.includes(',')) {
                  if (cleanValue.includes('.') && cleanValue.lastIndexOf(',') > cleanValue.lastIndexOf('.')) {
                    // Format: 1.234,56
                    cleanValue = cleanValue.replace(/\./g, '').replace(',', '.')
                  } else if (!cleanValue.includes('.')) {
                    // Format: 1234,56
                    cleanValue = cleanValue.replace(',', '.')
                  }
                }
                
                amount = parseFloat(cleanValue) || 0
              } else {
                amount = parseFloat(value) || 0
              }
            }
            transaction.amount = amount
            console.log(`Parsed amount: ${value} -> ${amount}`)
            
          } else if (mappedField === 'date') {
            // Handle German date formats
            let dateStr = ''
            if (value) {
              dateStr = String(value).trim()
              
              // Convert German date format DD-MM-YYYY to ISO
              if (dateStr.match(/^\d{2}-\d{2}-\d{4}/)) {
                const [day, month, year] = dateStr.split('-')
                dateStr = `${year}-${month}-${day}`
              }
              // Handle DD.MM.YYYY format
              else if (dateStr.match(/^\d{2}\.\d{2}\.\d{4}/)) {
                const [day, month, year] = dateStr.split('.')
                dateStr = `${year}-${month}-${day}`
              }
            }
            transaction.date = dateStr || new Date().toISOString().split('T')[0]
            
          } else if (mappedField === 'category') {
            // Handle multi-column category structure
            if (value && String(value).trim() !== '') {
              transaction.category = `${key}: ${String(value).trim()}`
              transaction.categoryColumn = key
              transaction.categoryValue = String(value).trim()
              
              // Detect if this is revenue based on column name and value
              const columnName = key.toLowerCase()
              const cellValue = String(value).toLowerCase()
              
              if (columnName.includes('eingehende') || 
                  cellValue.includes('wiederk') || 
                  cellValue.includes('programme') ||
                  cellValue.includes('consulting') ||
                  cellValue.includes('revenue')) {
                transaction.isRevenue = true
              }
            }
          } else {
            // Handle other fields
            transaction[mappedField] = value ? String(value).trim() : ''
          }
        }
      })
      
      // Set required defaults
      transaction.id = transaction.id || `tx_${Date.now()}_${index}`
      transaction.name = transaction.name || 'Unknown Transaction'
      transaction.reference = transaction.reference || ''
      
      // Smart category assignment if none found
      if (!transaction.category) {
        if (transaction.amount > 0) {
          transaction.category = 'Revenue'
          transaction.isRevenue = true
        } else {
          transaction.category = 'Expense'
          transaction.isRevenue = false
        }
      }
      
      // Ensure amount is valid
      if (isNaN(transaction.amount)) {
        transaction.amount = 0
      }
      
      return transaction
    }).filter(tx => {
      // More lenient filtering
      const hasValidAmount = !isNaN(tx.amount) && tx.amount !== 0
      const hasDate = tx.date && tx.date !== ''
      const hasName = tx.name && tx.name !== '' && tx.name !== 'Unknown Transaction'
      
      const isValid = hasValidAmount && hasDate
      
      if (!isValid) {
        console.log('Filtered out transaction:', {
          amount: tx.amount,
          date: tx.date,
          name: tx.name,
          reason: { hasValidAmount, hasDate, hasName }
        })
      }
      
      return isValid
    })
    
    console.log(`=== Processing Complete ===`)
    console.log(`Processed ${transactions.length} transactions from ${data.length} rows`)
    console.log('Sample processed transactions:', transactions.slice(0, 3))
    
    // Store data
    localStorage.setItem('transactions', JSON.stringify(transactions))
    localStorage.setItem('aiBusinessInsights', JSON.stringify(businessInsights))
    
    return transactions.length
  }

  const processCRMFile = async (data: any[], mappings: ColumnMapping[]) => {
    const fieldMap = Object.fromEntries(
      mappings.map(m => [m.originalHeader, m.suggestedField])
    )

    const deals = data.map((row, index) => {
      const deal: any = {}
      
      Object.entries(row).forEach(([key, value]) => {
        const mappedField = fieldMap[key]
        if (mappedField && mappedField !== 'unmapped') {
          if (mappedField === 'amount') {
            deal[mappedField] = parseFloat(value as string) || 0
          } else {
            deal[mappedField] = value
          }
        }
      })
      
      deal.id = deal.id || `deal_${Date.now()}_${index}`
      
      return deal
    }).filter(deal => deal.dealName)
    
    localStorage.setItem('crmDeals', JSON.stringify(deals))
    return deals.length
  }

  const processBudgetFile = async (workbook: XLSX.WorkBook) => {
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][]
    
    const months = data[0].slice(1).filter(m => m)
    const budgetData: any = { months: months }
    
    for (let i = 1; i < data.length; i++) {
      const category = data[i][0]
      if (category && category !== '') {
        budgetData[category] = {}
        for (let j = 1; j <= months.length; j++) {
          budgetData[category][months[j-1]] = parseFloat(data[i][j] || 0)
        }
      }
    }
    
    localStorage.setItem('budget', JSON.stringify(budgetData))
    return Object.keys(budgetData).length - 1
  }

  // Apply manual mapping function
  const applyManualMapping = async (fileIndex: number, updatedMappings: ColumnMapping[]) => {
    const file = files[fileIndex]
    if (!file || !file.previewData) return

    try {
      setFiles(prev => prev.map((f, idx) => 
        idx === fileIndex ? { ...f, status: 'processing' } : f
      ))

      let processedCount = 0
      
      if (file.type === 'transactions' || file.detectedHeaders?.some(h => 
        h.toLowerCase().includes('amount') || h.toLowerCase().includes('betrag')
      )) {
        processedCount = await processTransactionFile(file.previewData, updatedMappings)
        
        setFiles(prev => prev.map((f, idx) => 
          idx === fileIndex ? {
            ...f,
            type: 'transactions',
            status: 'success',
            message: `Manually processed ${processedCount} transactions`,
            confidence: 1.0,
            aiUsed: true,
            recordCount: processedCount
          } : f
        ))
      } else if (file.type === 'crm' || file.detectedHeaders?.some(h => 
        h.toLowerCase().includes('deal') || h.toLowerCase().includes('client')
      )) {
        processedCount = await processCRMFile(file.previewData, updatedMappings)
        
        setFiles(prev => prev.map((f, idx) => 
          idx === fileIndex ? {
            ...f,
            type: 'crm',
            status: 'success',
            message: `Manually processed ${processedCount} deals`,
            confidence: 1.0,
            aiUsed: true,
            recordCount: processedCount
          } : f
        ))
      }

      setTimeout(() => {
        window.location.reload()
      }, 1000)

    } catch (error) {
      console.error('Manual mapping failed:', error)
      setFiles(prev => prev.map((f, idx) => 
        idx === fileIndex ? {
          ...f,
          status: 'error',
          message: 'Manual processing failed'
        } : f
      ))
    }
  }

  // Main file upload handler
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
        
        if (aiResult.confidence > 0.5) { // Lower threshold to process more files
          let processedCount = 0
          
          console.log('Processing file with AI result:', aiResult)
          
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
              suggestedMappings: aiResult.columnMappings, // Always store mappings for review
              previewData: fileData.slice(0, 10),
              detectedHeaders: headers
            } : f
          ))
        } else {
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? {
              ...f,
              status: 'needs-mapping',
              message: 'Needs manual review',
              confidence: aiResult.confidence,
              aiUsed: true,
              suggestedMappings: aiResult.columnMappings,
              previewData: fileData.slice(0, 5),
              detectedHeaders: headers
            } : f
          ))
        }

      } catch (error) {
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

  // Helper functions for UI
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
                                        console.log('Apply Mapping clicked for file:', selectedFile?.name)
                                        const fileIndex = files.findIndex(f => f.name === selectedFile?.name)
                                        console.log('Found file at index:', fileIndex)
                                        if (fileIndex !== -1 && selectedFile?.suggestedMappings) {
                                          console.log('Applying mappings:', selectedFile.suggestedMappings)
                                          applyManualMapping(fileIndex, selectedFile.suggestedMappings)
                                        } else {
                                          console.log('Cannot apply - missing data:', { fileIndex, mappings: selectedFile?.suggestedMappings })
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
          <strong>Enhanced Detection:</strong> This system uses intelligent rules + AI fallback to handle:
          • German/English headers • Complex category structures • Various date formats • Multi-column layouts
          Files with low confidence will prompt for manual review before processing.
        </AlertDescription>
      </Alert>
    </div>
  )
}