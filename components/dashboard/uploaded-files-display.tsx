'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { FileText, Database, DollarSign } from 'lucide-react'

interface UploadedFile {
  type: 'transactions' | 'deals' | 'budget'
  label: string
  count: number
  icon: any
  color: string
}

export function UploadedFilesDisplay() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])

  useEffect(() => {
    const checkUploadedFiles = () => {
      const files: UploadedFile[] = []

      // Check transactions
      const transactions = localStorage.getItem('transactions')
      if (transactions) {
        const data = JSON.parse(transactions)
        files.push({
          type: 'transactions',
          label: 'Bank Transactions',
          count: data.length,
          icon: DollarSign,
          color: 'bg-green-100 text-green-800'
        })
      }

      // Check CRM deals
      const crmDeals = localStorage.getItem('crmDeals')
      if (crmDeals) {
        const data = JSON.parse(crmDeals)
        files.push({
          type: 'deals',
          label: 'CRM Deals',
          count: data.length,
          icon: FileText,
          color: 'bg-blue-100 text-blue-800'
        })
      }

      // Check budget
      const budget = localStorage.getItem('budget')
      if (budget) {
        files.push({
          type: 'budget',
          label: 'Budget Data',
          count: 1,
          icon: Database,
          color: 'bg-purple-100 text-purple-800'
        })
      }

      setUploadedFiles(files)
    }

    checkUploadedFiles()
  }, [])

  if (uploadedFiles.length === 0) {
    return (
      <div className="text-sm text-gray-500 mt-2">
        No files uploaded yet
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="text-sm font-medium text-gray-700">Currently loaded files:</div>
      <div className="flex flex-wrap gap-2">
        {uploadedFiles.map((file) => {
          const Icon = file.icon
          return (
            <Badge key={file.type} variant="secondary" className={`${file.color} flex items-center gap-1`}>
              <Icon className="h-3 w-3" />
              {file.label} ({file.count} {file.type === 'budget' ? 'file' : 'records'})
            </Badge>
          )
        })}
      </div>
    </div>
  )
}