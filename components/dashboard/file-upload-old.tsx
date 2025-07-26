'use client'

import { useState } from 'react'
import { EnhancedDataProcessor } from '@/lib/enhanced-data-processor'
import { useRouter } from 'next/navigation'
import { Upload, FileSpreadsheet, AlertCircle, Check, X, Brain, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

interface FileStatus {
  name: string
  type: 'transactions' | 'crm' | 'budget' | 'unknown' | null
  status: 'pending' | 'processing' | 'success' | 'error'
  message?: string
  confidence?: number
  aiUsed?: boolean
  recordCount?: number
}

interface ColumnMapping {
  originalColumn: string
  standardField: string
}

export function FileUpload() {
  const [files, setFiles] = useState<FileStatus[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [mappingReviewFile, setMappingReviewFile] = useState<{ 
    fileName: string, 
    data: any[], 
    mappings: ColumnMapping[], 
    fileIndex: number,
    detectedType: 'transactions' | 'crm'  // Add this to track the detected type
  } | null>(null)
  const router = useRouter()

  const detectFileType = (fileName: string, headers: string[]): 'transactions' | 'crm' | 'budget' | null => {
    const lowerHeaders = headers.map(h => h.toLowerCase().trim())
    
    // Check for transaction file - English or German headers
    const hasTransactionFields = (
      lowerHeaders.includes('transaction id') ||
      lowerHeaders.includes('id')
    ) && (
      lowerHeaders.includes('amount') ||
      lowerHeaders.includes('gesamtbetrag (inkl. mwst.)') ||
      lowerHeaders.includes('betrag')
    ) && (
      lowerHeaders.includes('date') ||
      lowerHeaders.includes('datum des vorgangs (lokal)')
    ) && (
      lowerHeaders.includes('name') ||
      lowerHeaders.includes('name der gegenpartei')
    ) && (
      lowerHeaders.includes('reference') ||
      lowerHeaders.includes('verwendungszweck')
    )

    if (hasTransactionFields) {
      return 'transactions'
    }
    
    // Check for CRM file - flexible patterns for HubSpot and other CRM exports
    const hasCRMIndicators = lowerHeaders.some(h => 
      h.includes('deal') || h.includes('company') || h.includes('account') ||
      h.includes('stage') || h.includes('phase') || h.includes('opportunity') ||
      // German terms
      h.includes('unternehmen') || h.includes('firma') || h.includes('geschäft') ||
      h.includes('stufe') || h.includes('verkauf')
    )

    const hasAmountColumn = lowerHeaders.some(h => 
      h.includes('amount') || h.includes('value') || h.includes('betrag') || h.includes('wert')
    )

    if (hasCRMIndicators && hasAmountColumn) {
      return 'crm'
    }
    
    // Check for budget file (Excel with month columns)
    if (headers.some(h => h.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i))) {
      return 'budget'
    }
    
    return null
  }

  // Enhanced detection for AI-processed files
  const detectFileTypeForAI = (headers: string[]): 'transactions' | 'crm' => {
    const lowerHeaders = headers.map(h => h.toLowerCase().trim())
    
    // Strong indicators for transaction files
    const transactionIndicators = [
      'transaction', 'datum', 'verwendungszweck', 'reference', 
      'gegenpartei', 'counterparty', 'bank', 'iban', 'bic'
    ]
    
    // Strong indicators for CRM files
    const crmIndicators = [
      'deal', 'opportunity', 'stage', 'phase', 'company', 
      'client', 'customer', 'pipeline', 'close date', 'closing'
    ]
    
    const transactionScore = transactionIndicators.filter(indicator => 
      lowerHeaders.some(h => h.includes(indicator))
    ).length
    
    const crmScore = crmIndicators.filter(indicator => 
      lowerHeaders.some(h => h.includes(indicator))
    ).length
    
    // If we have more transaction indicators, it's likely a transaction file
    return transactionScore > crmScore ? 'transactions' : 'crm'
  }

  const processTransactionFile = async (data: any[]) => {
    const transactions = data.map((row, idx) => {
      // Normalize possible German or custom fields
      const id = row['Transaction ID'] || row['ID'] || `txn_${idx}`
      const date = row['Date'] || row['Datum des Vorgangs (lokal)'] || ''
      const name = row['Name'] || row['Name der Gegenpartei'] || row['Name der Gegenpartei'] || ''
      const amountRaw = row['Amount'] || row['Gesamtbetrag (inkl. MwSt.)'] || row['Betrag'] || ''
      const reference = row['Reference'] || row['Verwendungszweck'] || ''
      const category = row['Category'] || row['Kategorie'] || ''

      // Handle comma as decimal separator (if needed)
      const amount = typeof amountRaw === 'string'
        ? parseFloat(amountRaw.replace('.', '').replace(',', '.'))
        : parseFloat(amountRaw)

      return { id, date, name, amount, reference, category }
    }).filter(tx => tx.id && tx.date && !isNaN(tx.amount))

    localStorage.setItem('transactions', JSON.stringify(transactions))
    return transactions.length
  }

  const processCRMFile = async (data: any[]) => {
    console.log('🤝 Processing CRM File - Headers available:', Object.keys(data[0] || {}))
    
    const deals = data.map((row, index) => {
      // Get all available keys to find the right columns
      const keys = Object.keys(row)
      console.log('Sample row keys:', keys)
      
      // Flexible field mapping - find columns by pattern matching
      const findColumn = (patterns: string[]) => {
        const key = keys.find(k => 
          patterns.some(pattern => k.toLowerCase().includes(pattern.toLowerCase()))
        )
        return key ? row[key] : ''
      }
      
      const deal = {
        id: row['ID'] || row['Datapoint ID'] || `deal_${index}`,
        dealName: findColumn(['Deal Name', 'Deal Title', 'Name', 'Titel', 'Geschäft']),
        phase: findColumn(['Stage', 'Phase', 'Deal Stage', 'Deal Phase', 'Stufe', 'Status']),
        amount: parseFloat(findColumn(['Amount', 'Value', 'Deal Amount', 'Betrag', 'Wert']) || 0),
        clientName: findColumn(['Company', 'Client', 'Account', 'Customer', 'Unternehmen', 'Firma', 'Kunde']),
        firstAppointment: findColumn(['Create Date', 'Created', 'First Contact', 'Erstellt']),
        closingDate: findColumn(['Close Date', 'Closing Date', 'Expected Close', 'Abschluss']),
        product: findColumn(['Product', 'Type', 'Category', 'Produkt', 'Typ']) || 'Standard'
      }
      
      // Log the first few deals to see what we're getting
      if (index < 3) {
        console.log(`Deal ${index}:`, deal)
      }
      
      return deal
    }).filter(deal => deal.dealName && !isNaN(deal.amount) && deal.amount >= 0)
    
    console.log(`✅ Processed ${deals.length} deals from ${data.length} rows`)
    localStorage.setItem('crmDeals', JSON.stringify(deals))
    return deals.length
  }

  const processBudgetFile = async (workbook: XLSX.WorkBook) => {
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][]
    
    // Extract budget data - assuming first column is categories and rest are months
    const months = data[0].slice(1).filter(m => m) // Skip first cell, get month headers
    const budgetData: any = { months: months }
    
    // Process each row (skip header)
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
    return Object.keys(budgetData).length - 1 // Subtract 1 for 'months' key
  }

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

    // Process each file
    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i]
      
      // Update status to processing
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
            skipEmptyLines: true
          })
          
          headers = result.meta.fields || []
          fileData = result.data
          
        } else if (file.name.match(/\.(xlsx|xls)$/)) {
          console.log('[EXCEL HEADERS]', headers)
          const arrayBuffer = await file.arrayBuffer()
          const workbook = XLSX.read(arrayBuffer, { type: 'array' })
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          
          const sheetData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][]
          headers = sheetData[0]?.filter(h => h) || []
          
          // Convert to objects
          fileData = XLSX.utils.sheet_to_json(firstSheet)
          
        } else {
          throw new Error('Unsupported file format')
        }

        if (fileData.length === 0) {
          throw new Error('No data found in file')
        }

        // Call simple detection first (same as your original logic)
        const fileType = detectFileType(file.name, headers)
        
        if (fileType === 'transactions') {
          const count = await processTransactionFile(fileData)
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? {
              ...f,
              type: fileType,
              status: 'success',
              message: `Processed ${count} transactions`,
              confidence: 1.0,
              aiUsed: false,
              recordCount: count
            } : f
          ))
        } else if (fileType === 'crm') {
          // AI-enhanced CRM data processing
          const processor = new EnhancedDataProcessor()
          // Use processor to extract headers and fileData from CSV/Excel
          const parsed = file.name.endsWith('.csv')
            ? await processor['parseCSV'](file)
            : await processor['parseExcel'](file)
          const headers = parsed.headers
          const fileData = parsed.data
          // --- Debugging and validation for AI Mapping ---
          console.log('[AI Mapping] Headers:', headers)
          console.log('[AI Mapping] Sample data:', fileData.slice(0, 3))

          if (!headers || headers.length === 0 || !fileData || fileData.length === 0) {
            throw new Error('Parsed file had no headers or data to process')
          }
          // -----------------------------------------------
          const processed = await processor.processFile(file.name, headers, fileData)

          console.log('[AI FILE DETECTION]', { detectedType, processed })
          
          // Update file type before showing mapping
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? { ...f, type: 'crm' } : f
          ))
          
          setMappingReviewFile({ 
            fileName: file.name,
            data: fileData,
            mappings: processed.suggestedMappings,
            fileIndex: i,
            detectedType: 'crm'
          })
          continue
        } else if (fileType === 'budget' && file.name.match(/\.(xlsx|xls)$/)) {
          // Need to read the Excel file again for budget processing
          const arrayBuffer = await file.arrayBuffer()
          const workbook = XLSX.read(arrayBuffer, { type: 'array' })
          const count = await processBudgetFile(workbook)
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? {
              ...f,
              type: fileType,
              status: 'success',
              message: `Processed ${count} budget categories`,
              confidence: 1.0,
              aiUsed: false,
              recordCount: count
            } : f
          ))
        } 
        
        else {
          // File type not immediately detected - use AI processor
          const processor = new EnhancedDataProcessor()
          const parsed = file.name.endsWith('.csv')
            ? await processor['parseCSV'](file)
            : await processor['parseExcel'](file)

          const headers = parsed.headers
          const fileData = parsed.data

          if (!headers || headers.length === 0 || !fileData || fileData.length === 0) {
            throw new Error('Parsed file had no headers or data to process')
          }

          // Detect if this is actually a transaction file or CRM file
          const detectedType = detectFileTypeForAI(headers)
          
          // Update the file type in state
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? { ...f, type: detectedType } : f
          ))

          const processed = await processor.processFile(file.name, headers, fileData)

          setMappingReviewFile({
            fileName: file.name,
            data: fileData,
            mappings: processed.suggestedMappings,
            fileIndex: i,
            detectedType: detectedType  // Pass the detected type
          })
          continue
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
    
    // Refresh dashboard if any files processed successfully
    const hasSuccess = newFiles.some(f => f.status === 'success')
    if (hasSuccess) {
      setTimeout(() => {
        router.refresh()
        window.location.reload()
      }, 2000)
    }
  }

  const getFileIcon = (status: FileStatus['status']) => {
    switch (status) {
      case 'success':
        return <Check className="h-4 w-4 text-green-500" />
      case 'error':
        return <X className="h-4 w-4 text-red-500" />
      case 'processing':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
      default:
        return <FileSpreadsheet className="h-4 w-4 text-gray-400" />
    }
  }

  const getFileTypeLabel = (type: FileStatus['type']) => {
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

  const getMappingOptions = (fileType: 'transactions' | 'crm' | null) => {
    if (fileType === 'transactions') {
      return [
        { value: 'id', label: 'Transaction ID' },
        { value: 'date', label: 'Date' },
        { value: 'name', label: 'Counterparty Name' },
        { value: 'amount', label: 'Amount' },
        { value: 'currency', label: 'Currency' },
        { value: 'reference', label: 'Reference' },
        { value: 'category', label: 'Category' },
        { value: 'unmapped', label: 'Ignore' }
      ]
    }
    return [
      { value: 'dealName', label: 'Deal Name' },
      { value: 'clientName', label: 'Client Name' },
      { value: 'amount', label: 'Amount' },
      { value: 'phase', label: 'Phase' },
      { value: 'firstAppointment', label: 'First Appointment' },
      { value: 'closingDate', label: 'Closing Date' },
      { value: 'product', label: 'Product' },
      { value: 'unmapped', label: 'Ignore' }
    ]
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
                  <p className="text-sm text-gray-500">Processing files with AI...</p>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 mb-3 text-gray-400" />
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">
                    Upload multiple files: Bank transactions (CSV), CRM data (CSV), Budget (Excel)
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    ✨ Enhanced with AI for better file detection
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
            <CardTitle className="text-lg">Uploaded Files</CardTitle>
            <CardDescription>
              Files are analyzed using rule-based detection and AI fallback
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-center space-x-3">
                    {getFileIcon(file.status)}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{file.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-gray-500">
                          {file.type ? getFileTypeLabel(file.type) : 'Processing...'}
                        </p>
                        {getConfidenceBadge(file.confidence, file.aiUsed)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    {file.message && (
                      <p className={`text-xs ${file.status === 'error' ? 'text-red-600' : 'text-green-600'}`}>
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
          Upload your financial data files to generate comprehensive KPIs and insights. 
          Our AI-enhanced system automatically detects file types and standardizes the data format.
          Supported formats: Bank transactions (CSV), CRM/Sales data (CSV), Budget/Plan (Excel)
        </AlertDescription>
      </Alert>

      {mappingReviewFile && (
        <Card className="mt-6 border-yellow-400 border-2 bg-yellow-50">
          <CardHeader>
            <CardTitle>Review and Apply Column Mapping</CardTitle>
            <CardDescription>
              Review the AI-suggested mappings and apply them manually to standardize your{' '}
              {{
                transactions: 'transaction data',
                crm: 'CRM data',
                budget: 'budget data'
              }[mappingReviewFile.detectedType] ?? 'data'}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mappingReviewFile.mappings.map((mapping, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="w-1/2">
                    <p className="text-sm font-medium">{mapping.originalColumn}</p>
                  </div>
                  <div className="w-1/2">
                    <select
                      className="w-full border rounded px-2 py-1 text-sm"
                      value={mapping.standardField}
                      onChange={(e) => {
                        const updated = [...mappingReviewFile.mappings]
                        updated[idx].standardField = e.target.value
                        setMappingReviewFile({ ...mappingReviewFile, mappings: updated })
                      }}
                    >
                      {getMappingOptions(mappingReviewFile.detectedType).map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                onClick={async () => {
                  const processor = new EnhancedDataProcessor()
                  const fileType = mappingReviewFile.detectedType

                  const result = await processor.convertToStandardFormat(
                    mappingReviewFile.data,
                    mappingReviewFile.mappings,
                    fileType === 'transactions' ? 'transactions' : 'deals'
                  )

                  // Map fileType to the correct property in the result
                  const resultKey = fileType === 'transactions' ? 'transactions' : 'deals'
                  const processedData = result[resultKey] || []

                  const storageKey = fileType === 'transactions' ? 'transactions' : 'crmDeals'
                  localStorage.setItem(storageKey, JSON.stringify(processedData))

                  const count = processedData.length

                  setFiles(prev => prev.map((f, idx) =>
                    idx === mappingReviewFile.fileIndex
                      ? {
                          ...f,
                          type: fileType,
                          status: 'success',
                          message: `Processed ${count} ${fileType}`,
                          confidence: 1.0,
                          aiUsed: true,
                          recordCount: count
                        }
                      : f
                  ))
                
                  setMappingReviewFile(null)
                }}
              >
                Apply Mapping
              </Button>
              <Button variant="outline" onClick={() => setMappingReviewFile(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}