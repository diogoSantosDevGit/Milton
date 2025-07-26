'use client'

import { useState } from 'react'
import { EnhancedDataProcessor } from '@/lib/enhanced-data-processor'
import { ColumnMapping, FileType } from '@/types/schema'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText } from 'lucide-react'

interface MappingReview {
  fileName: string
  headers: string[]
  sampleRows: any[]
  fullData: any[] // Add full data storage
  mappings: ColumnMapping[]
  detectedType: string
  confidence: number
  issues: string[]
}

interface FileUploadProps {
  selectedUseCase?: string | null
}

export default function FileUpload({ selectedUseCase }: FileUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [mappingReview, setMappingReview] = useState<MappingReview | null>(null)
  const [showMappingUI, setShowMappingUI] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setIsProcessing(true)
    setMappingReview(null)
    setShowMappingUI(false)

    try {
      // Process the first file for now (we can enhance to handle multiple files later)
      const file = files[0]
      console.log('Processing file:', file.name)

      // Step 1: Parse the raw file
      const { headers, data } = await parseRawFile(file)
      console.log('🔍 Parsed file with headers:', headers.length, 'and data rows:', data.length)
      console.log('🔍 Headers:', headers)
      console.log('🔍 Sample data:', data.slice(0, 3))
      
      // Step 2: Send to AI for analysis (AI-first approach)
      const ai = new EnhancedDataProcessor()
      console.log('Calling AI for mapping...')
      console.log('Headers:', headers)
      console.log('Sample data:', data.slice(0, 3))
      
      let aiResult
      try {
        aiResult = await ai.callAIForMapping(headers, data.slice(0, 10))
        console.log('AI result received:', aiResult)
      } catch (aiError) {
        console.error('AI mapping failed:', aiError)
        throw new Error(`AI analysis failed: ${aiError instanceof Error ? aiError.message : 'Unknown error'}`)
      }

      // Step 3: Present mapping UI for user review
      setMappingReview({
        fileName: file.name,
        headers,
        sampleRows: data.slice(0, 5),
        fullData: data, // Store the full dataset
        mappings: aiResult.suggestedMappings,
        detectedType: aiResult.detectedType,
        confidence: 0.8, // Default confidence
        issues: []
      })
      console.log('🔍 Set mapping review with full data rows:', data.length)
      setShowMappingUI(true)
      setUploadedFiles(files)
    } catch (error) {
      console.error('File processing failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Failed to process file: ${errorMessage}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const applyMapping = async () => {
    if (!mappingReview) return

    setIsProcessing(true)
    try {
      const ai = new EnhancedDataProcessor()
      const { mappings, fullData, detectedType } = mappingReview
      
      console.log('🔍 Converting to standard format...')
      console.log('🔍 Using full data count:', fullData.length)
      console.log('🔍 Detected type:', detectedType)
      
      // Convert to standard format using AI mappings with FULL DATA
      const result = await ai.convertToStandardFormat(fullData, mappings, detectedType as FileType)
      
      // Store the processed data
      const dataKey = detectedType === 'deals' ? 'crmDeals' : 'transactions'
      const dataToStore = result[detectedType as keyof typeof result] || []
      localStorage.setItem(dataKey, JSON.stringify(dataToStore))
      
      if (Array.isArray(dataToStore)) {
        console.log(`Stored ${dataToStore.length} records with key: ${dataKey}`)
        console.log('Sample data:', dataToStore.slice(0, 2))
      } else {
        console.log(`Stored budget data with key: ${dataKey}`)
      }
      
      setMappingReview(null)
      setShowMappingUI(false)
      setUploadedFiles([])
      alert(`Successfully processed ${mappingReview.fileName} as ${detectedType}`)
    } catch (error) {
      console.error('Failed to apply mapping:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Failed to apply mapping: ${errorMessage}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <input 
          type="file" 
          onChange={handleFileUpload} 
          accept=".csv,.xlsx,.xls"
          multiple
          disabled={isProcessing}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {isProcessing && (
          <div className="text-sm text-gray-600">Processing file with AI...</div>
        )}
        {uploadedFiles.length > 0 && (
          <div className="text-sm text-green-600">
            {uploadedFiles.length} file(s) uploaded successfully
          </div>
        )}
      </div>

      {/* File Upload Results Display */}
      {mappingReview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              File Analysis Results
              <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                Enhanced detection with multi-language support and AI fallback
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{mappingReview.fileName}</div>
                    <div className="text-xs text-gray-500">
                      Detected as: <span className="font-medium">{mappingReview.detectedType}</span>
                    </div>
                  </div>
                </div>
                                  <div className="text-right">
                    <div className="text-sm font-medium text-green-600">
                      {Math.round(mappingReview.confidence * 100)}% confidence
                    </div>
                    <div className="text-xs text-gray-500">
                      Processed {mappingReview.fullData.length} records
                    </div>
                  </div>
              </div>
              
              {mappingReview.issues.length > 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-medium text-yellow-800 mb-2">Issues Found:</h4>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {mappingReview.issues.map((issue, idx) => (
                      <li key={idx}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {mappingReview && showMappingUI && (
        <Card>
          <CardHeader>
            <CardTitle>
              Review AI-Suggested Mapping ({mappingReview.detectedType})
              {mappingReview.confidence && (
                <span className="ml-2 text-sm text-gray-500">
                  Confidence: {Math.round(mappingReview.confidence * 100)}%
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mappingReview.issues.length > 0 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <h4 className="font-medium text-yellow-800 mb-2">Issues Found:</h4>
                <ul className="text-sm text-yellow-700">
                  {mappingReview.issues.map((issue, idx) => (
                    <li key={idx}>• {issue}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="space-y-3">
              {mappingReview.mappings.map((mapping, idx) => (
                <div key={idx} className="flex items-center gap-4 p-3 border rounded">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{mapping.originalColumn}</div>
                    <div className="text-xs text-gray-500">
                      Confidence: {Math.round(mapping.confidence * 100)}% | 
                      Type: {mapping.dataType}
                    </div>
                  </div>
                  <select
                    value={mapping.standardField}
                    onChange={e => {
                      const updated = [...mappingReview.mappings]
                      updated[idx].standardField = e.target.value
                      setMappingReview({ ...mappingReview, mappings: updated })
                    }}
                    className="flex-1 border px-3 py-2 rounded text-sm"
                  >
                    <option value="unmapped">Ignore</option>
                    <option value="id">ID</option>
                    <option value="date">Date</option>
                    <option value="amount">Amount</option>
                    <option value="description">Description</option>
                    <option value="reference">Reference</option>
                    <option value="category">Category</option>
                    <option value="dealName">Deal Name</option>
                    <option value="clientName">Client Name</option>
                    <option value="phase">Phase</option>
                    <option value="product">Product</option>
                    <option value="firstAppointment">First Appointment</option>
                    <option value="closingDate">Closing Date</option>
                  </select>
                </div>
              ))}
            </div>
            
            <div className="flex justify-end mt-6 gap-2">
              <Button 
                onClick={applyMapping} 
                disabled={isProcessing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isProcessing ? 'Processing...' : 'Apply Mapping'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setMappingReview(null)
                  setShowMappingUI(false)
                  setUploadedFiles([])
                }}
                disabled={isProcessing}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Helper function to parse raw files
async function parseRawFile(file: File): Promise<{ headers: string[], data: any[] }> {
  if (file.name.endsWith('.csv')) {
    return parseCSVFile(file)
  } else if (file.name.match(/\.(xlsx|xls)$/)) {
    return parseExcelFile(file)
  } else {
    throw new Error('Unsupported file format. Please upload a CSV or Excel file.')
  }
}

async function parseCSVFile(file: File): Promise<{ headers: string[], data: any[] }> {
  try {
    const text = await file.text()
    
    // Try to import Papa with better error handling
    let Papa
    try {
      const papaModule = await import('papaparse')
      Papa = papaModule.default || papaModule
      if (!Papa || !Papa.parse) {
        throw new Error('Papa module not properly loaded')
      }
    } catch (importError) {
      console.error('Failed to import Papa:', importError)
      throw new Error('CSV processing library not available.')
    }
    
    const result = Papa.parse(text, { 
      header: true, 
      skipEmptyLines: true,
      dynamicTyping: false // Keep as strings for better AI analysis
    })
    
    return {
      headers: result.meta.fields || [],
      data: result.data
    }
  } catch (error) {
    console.error('CSV parsing failed:', error)
    throw new Error(`Failed to parse CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

async function parseExcelFile(file: File): Promise<{ headers: string[], data: any[] }> {
  try {
    const buffer = await file.arrayBuffer()
    
    // Try to import XLSX with better error handling
    let XLSX
    try {
      const xlsxModule = await import('xlsx')
      XLSX = xlsxModule.default || xlsxModule
      if (!XLSX || !XLSX.read) {
        throw new Error('XLSX module not properly loaded')
      }
    } catch (importError) {
      console.error('Failed to import XLSX:', importError)
      throw new Error('Excel processing library not available. Please try uploading a CSV file instead.')
    }
    
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })
    
    if (rows.length < 2) {
      throw new Error('Excel file must have at least header and data rows')
    }
    
    const headers = (rows[0] as any[]).filter(h => h && h.toString().trim() !== '')
    const dataRows = (rows.slice(1) as any[][]).map(row => {
      const obj: any = {}
      headers.forEach((header, index) => {
        obj[header] = row[index] || ''
      })
      return obj
    }).filter(row => Object.values(row).some(val => val && val.toString().trim() !== ''))
    
    return { headers, data: dataRows }
  } catch (error) {
    console.error('Excel parsing failed:', error)
    throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}