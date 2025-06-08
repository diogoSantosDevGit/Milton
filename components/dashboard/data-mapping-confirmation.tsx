'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  CheckCircle2,
  AlertTriangle,
  FileText,
  ArrowRight,
  Eye
} from 'lucide-react'

interface ColumnMapping {
  original: string
  standardField: string
  confidence: number
  detected: boolean
}

interface DataStructure {
  type: 'single-category' | 'multi-category' | 'unknown'
  language: 'en' | 'de' | 'unknown'
  dateFormat: string
  currencySymbol: string
  amountColumn: string
  dateColumn: string
  descriptionColumn: string
  categoryMapping: ColumnMapping[]
}

interface DetectionResult {
  structure: DataStructure
  sampleData: any[]
  suggestedMappings: ColumnMapping[]
  needsUserConfirmation: boolean
}

interface DataMappingConfirmationProps {
  detectionResult: DetectionResult
  fileName: string
  fileType: 'transactions' | 'crm' | 'budget'
  onConfirm: (confirmedMappings: ColumnMapping[], structure: DataStructure) => void
  onCancel: () => void
}

const getStandardFieldOptions = (type: 'transactions' | 'crm' | 'budget') => {
  switch (type) {
    case 'crm':
      return [
        { value: 'client', label: 'Client', description: 'Client or company name' },
        { value: 'amount', label: 'Deal Amount', description: 'Value of the deal' },
        { value: 'phase', label: 'Phase', description: 'Deal stage' },
        { value: 'product', label: 'Product', description: 'Product category' },
        { value: 'firstContact', label: 'First Contact Date', description: 'Initial client interaction' },
        { value: 'closingDate', label: 'Closing Date', description: 'Expected or actual closing date' },
        { value: 'ignore', label: 'Ignore', description: 'Skip this column' }
      ]
    case 'budget':
      return [
        { value: 'month', label: 'Month', description: 'Reporting month' },
        { value: 'billings', label: 'Billings', description: 'Cash inflow from customers' },
        { value: 'revenue', label: 'Revenue', description: 'Revenue recognized in P&L' },
        { value: 'staff', label: 'Staff Cost', description: 'Personnel expenses' },
        { value: 'marketing', label: 'Marketing Cost', description: 'Marketing and ad spend' },
        { value: 'admin', label: 'Admin Cost', description: 'Administrative expenses' },
        { value: 'cashInflow', label: 'Cash Inflow', description: 'Total cash received' },
        { value: 'cashOutflow', label: 'Cash Outflow', description: 'Cash spent' },
        { value: 'cashBalance', label: 'Cash Balance', description: 'Cash position at month end' },
        { value: 'ignore', label: 'Ignore', description: 'Skip this column' }
      ]
    default:
      return [
        { value: 'date', label: 'Date', description: 'Transaction date' },
        { value: 'amount', label: 'Amount', description: 'Transaction amount' },
        { value: 'description', label: 'Description', description: 'Transaction description/name' },
        { value: 'category', label: 'Category', description: 'Transaction category' },
        { value: 'reference', label: 'Reference', description: 'Transaction reference/ID' },
        { value: 'ignore', label: 'Ignore', description: 'Skip this column' }
      ]
  }
}

export function DataMappingConfirmation({
  detectionResult,
  fileName,
  fileType,
  onConfirm,
  onCancel
}: DataMappingConfirmationProps) {
  const [mappings, setMappings] = useState<ColumnMapping[]>(detectionResult.suggestedMappings)
  const [structure, setStructure] = useState<DataStructure>(detectionResult.structure)

  const standardFieldOptions = getStandardFieldOptions(fileType)
  const availableColumns = Object.keys(detectionResult.sampleData[0] || {})

  const updateMapping = (original: string, newStandardField: string) => {
    setMappings(prev => prev.map(mapping =>
      mapping.original === original
        ? { ...mapping, standardField: newStandardField, confidence: 1.0, detected: true }
        : mapping
    ))
  }

  const addMapping = (original: string, standardField: string) => {
    setMappings(prev => [...prev, {
      original,
      standardField,
      confidence: 1.0,
      detected: true
    }])
  }

  const removeMapping = (original: string) => {
    setMappings(prev => prev.filter(mapping => mapping.original !== original))
  }

  const updateStructure = (field: keyof DataStructure, value: any) => {
    setStructure(prev => ({ ...prev, [field]: value }))
  }

  const isValid = () => {
    const requiredFields = fileType === 'transactions'
      ? ['date', 'amount']
      : fileType === 'crm'
        ? ['client', 'amount']
        : ['month', 'billings']
    return requiredFields.every(field =>
      mappings.some(mapping => mapping.standardField === field)
    )
  }

  const previewNormalizedData = () => {
    return detectionResult.sampleData.slice(0, 3).map((row, index) => {
      const normalized: any = {}
      mappings.forEach(mapping => {
        if (mapping.standardField !== 'ignore') {
          normalized[mapping.standardField] = row[mapping.original]
        }
      })
      return { ...normalized, _rowIndex: index }
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Data Mapping Confirmation
          </CardTitle>
          <CardDescription>
            File: <strong>{fileName}</strong> | Type: <strong>{fileType}</strong>
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Column Mappings</CardTitle>
          <CardDescription>
            Review and adjust the column mapping for this file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mappings.map((mapping, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="font-mono text-sm bg-white px-2 py-1 rounded border">
                  {mapping.original}
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
                <Select value={mapping.standardField} onValueChange={(val) => updateMapping(mapping.original, val)}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {standardFieldOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label} – {option.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeMapping(mapping.original)}>Remove</Button>
            </div>
          ))}

          {/* Unmapped Columns */}
          {availableColumns.filter(col => !mappings.find(m => m.original === col)).map((col, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="font-mono text-sm">{col}</div>
              <Select onValueChange={(val) => addMapping(col, val)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Map to field..." />
                </SelectTrigger>
                <SelectContent>
                  {standardFieldOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label} – {option.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Data Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Data Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr>
                {mappings.filter(m => m.standardField !== 'ignore').map(mapping => (
                  <th key={mapping.standardField} className="text-left p-2">
                    {mapping.standardField}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewNormalizedData().map((row, idx) => (
                <tr key={idx}>
                  {mappings.filter(m => m.standardField !== 'ignore').map(mapping => (
                    <td key={mapping.standardField} className="p-2">
                      {row[mapping.standardField]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {!isValid() && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Please map all required fields to proceed.</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button disabled={!isValid()} onClick={() => onConfirm(mappings, structure)}>
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Confirm & Process Data
        </Button>
      </div>
    </div>
  )
}