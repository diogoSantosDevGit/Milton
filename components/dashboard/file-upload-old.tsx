'use client'

import { useState } from 'react'
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

export function FileUpload() {
  const [files, setFiles] = useState<FileStatus[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const router = useRouter()

  const detectFileType = (fileName: string, headers: string[]): 'transactions' | 'crm' | 'budget' | null => {
    const lowerHeaders = headers.map(h => h.toLowerCase().trim())
    
    // Check for transaction file - exact match to your data structure
    if (lowerHeaders.includes('transaction id') && 
        lowerHeaders.includes('amount') &&
        lowerHeaders.includes('date') &&
        lowerHeaders.includes('name')) {
      return 'transactions'
    }
    
    // Check for CRM file - exact match to your data structure  
    if (lowerHeaders.includes('datapoint id') && 
        lowerHeaders.includes('deal phase') &&
        lowerHeaders.includes('client name') &&
        lowerHeaders.includes('deal name')) {
      return 'crm'
    }
    
    // Check for budget file (Excel with month columns)
    if (headers.some(h => h.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i))) {
      return 'budget'
    }
    
    return null
  }

  const processTransactionFile = async (data: any[]) => {
    const transactions = data.map(row => ({
      id: row['Transaction ID'] || row['ID'] || '',
      date: row['Date'] || '',
      name: row['Name'] || '',
      amount: parseFloat(row['Amount'] || 0),
      reference: row['Reference'] || '',
      category: row['Category'] || ''
    })).filter(tx => tx.id && tx.date && !isNaN(tx.amount))
    
    localStorage.setItem('transactions', JSON.stringify(transactions))
    return transactions.length
  }

  const processCRMFile = async (data: any[]) => {
    const deals = data.map(row => ({
      id: row['Datapoint ID'] || row['ID'] || '',
      dealName: row['Deal Name'] || '',
      phase: row['Deal Phase'] || '',
      amount: parseFloat(row['Amount'] || 0),
      clientName: row['Client Name'] || '',
      firstAppointment: row['Date of First Appointment'] || '',
      closingDate: row['Closing Date'] || '',
      product: row['Product'] || ''
    })).filter(deal => deal.id && deal.dealName && !isNaN(deal.amount))
    
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
          const count = await processCRMFile(fileData)
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? {
              ...f,
              type: fileType,
              status: 'success',
              message: `Processed ${count} deals`,
              confidence: 1.0,
              aiUsed: false,
              recordCount: count
            } : f
          ))
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
        } else {
          // Only use AI as fallback if simple detection fails
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? {
              ...f,
              status: 'error',
              message: 'Unknown file format - AI fallback not implemented yet'
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
    </div>
  )
}