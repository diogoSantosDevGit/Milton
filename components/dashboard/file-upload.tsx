'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { EnhancedDataProcessor } from '@/lib/enhanced-data-processor'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const [showMappingUI, setShowMappingUI] = useState(true)

interface ColumnMapping {
  originalColumn: string
  standardField: string
}

export default function FileUpload() {
  const [mappingReview, setMappingReview] = useState<{
    fileName: string
    headers: string[]
    sampleRows: any[]
    mappings: ColumnMapping[]
    detectedType: string
  } | null>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    let headers: string[] = []
    let rows: any[] = []

    if (file.name.endsWith('.csv')) {
      const text = await file.text()
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
      headers = parsed.meta.fields || []
      rows = parsed.data.slice(0, 5)
    } else if (file.name.match(/\.(xlsx|xls)$/)) {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      rows = XLSX.utils.sheet_to_json(sheet)
      headers = Object.keys(rows[0] || {})
      rows = rows.slice(0, 5)
    }

    const ai = new EnhancedDataProcessor()
    const { detectedType, suggestedMappings } = await ai.callAIForMapping(headers, rows)

    setMappingReview({
        fileName: file.name,
            headers,
            sampleRows: rows,
            mappings: suggestedMappings,
            detectedType
            })
            setShowMappingUI(true)
    }

  const applyMapping = async () => {
    if (!mappingReview) return
    const ai = new EnhancedDataProcessor()
    const { mappings, sampleRows, detectedType } = mappingReview
    const result = await ai.convertToStandardFormat(sampleRows, mappings, detectedType)
    localStorage.setItem(detectedType, JSON.stringify(result[detectedType] || []))
    setMappingReview(null)
    setShowMappingUI(false)
  }

  return (
    <div className="space-y-6">
      <input type="file" onChange={handleFileUpload} accept=".csv,.xlsx,.xls" />

      {mappingReview && showMappingUI && (
        <Card>
          <CardHeader>
            <CardTitle>Review AI-Suggested Mapping ({mappingReview.detectedType})</CardTitle>
          </CardHeader>
          <CardContent>
            {mappingReview.mappings.map((m, idx) => (
              <div key={idx} className="flex gap-4 mb-2">
                <span className="w-1/2">{m.originalColumn}</span>
                <select
                  value={m.standardField}
                  onChange={e => {
                    const updated = [...mappingReview.mappings]
                    updated[idx].standardField = e.target.value
                    setMappingReview({ ...mappingReview, mappings: updated })
                  }}
                  className="w-1/2 border px-2 py-1"
                >
                  <option value="unmapped">Ignore</option>
                  <option value="id">ID</option>
                  <option value="date">Date</option>
                  <option value="amount">Amount</option>
                  <option value="name">Name</option>
                  <option value="reference">Reference</option>
                  <option value="category">Category</option>
                  <option value="dealName">Deal Name</option>
                  <option value="clientName">Client Name</option>
                  <option value="phase">Phase</option>
                  <option value="product">Product</option>
                </select>
              </div>
            ))}
            <div className="flex justify-end mt-4 gap-2">
              <Button onClick={applyMapping}>Apply Mapping</Button>
              <Button variant="outline" onClick={() => setMappingReview(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}