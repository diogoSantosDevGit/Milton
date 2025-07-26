'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trash2, RefreshCw, FileText, Database, DollarSign } from 'lucide-react'

interface FileData {
  type: 'transactions' | 'deals' | 'budget'
  label: string
  count: number
  icon: any
  color: string
  lastUpdated?: string
}

export function FileManagement() {
  const [files, setFiles] = useState<FileData[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)

  const checkFiles = () => {
    const fileData: FileData[] = []

    // Check transactions
    const transactions = localStorage.getItem('transactions')
    if (transactions) {
      try {
        const data = JSON.parse(transactions)
        fileData.push({
          type: 'transactions',
          label: 'Bank Transactions',
          count: Array.isArray(data) ? data.length : 0,
          icon: DollarSign,
          color: 'bg-green-100 text-green-800',
          lastUpdated: new Date().toLocaleString()
        })
      } catch (error) {
        console.error('Error parsing transactions:', error)
      }
    }

    // Check CRM deals
    const crmDeals = localStorage.getItem('crmDeals')
    if (crmDeals) {
      try {
        const data = JSON.parse(crmDeals)
        fileData.push({
          type: 'deals',
          label: 'CRM Deals',
          count: Array.isArray(data) ? data.length : 0,
          icon: FileText,
          color: 'bg-blue-100 text-blue-800',
          lastUpdated: new Date().toLocaleString()
        })
      } catch (error) {
        console.error('Error parsing CRM deals:', error)
      }
    }

    // Check budget
    const budget = localStorage.getItem('budget')
    if (budget) {
      try {
        const data = JSON.parse(budget)
        fileData.push({
          type: 'budget',
          label: 'Budget Data',
          count: 1,
          icon: Database,
          color: 'bg-purple-100 text-purple-800',
          lastUpdated: new Date().toLocaleString()
        })
      } catch (error) {
        console.error('Error parsing budget:', error)
      }
    }

    setFiles(fileData)
  }

  const deleteFile = (type: string) => {
    const key = type === 'deals' ? 'crmDeals' : type
    localStorage.removeItem(key)
    checkFiles()
    
    // Trigger a page refresh to update all components
    window.location.reload()
  }

  const refreshFiles = () => {
    setIsRefreshing(true)
    checkFiles()
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  useEffect(() => {
    checkFiles()
    
    // Check for changes every 3 seconds
    const interval = setInterval(checkFiles, 3000)
    
    return () => clearInterval(interval)
  }, [])

  if (files.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">File Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">No Files Uploaded</h3>
            <p className="text-sm">Upload your financial data files to get started.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">File Management</CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshFiles}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {files.map((file) => {
            const Icon = file.icon
            return (
              <div key={file.type} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className={`${file.color} flex items-center gap-1`}>
                    <Icon className="h-3 w-3" />
                    {file.label}
                  </Badge>
                  <span className="text-sm text-gray-600">
                    {file.count} {file.type === 'budget' ? 'file' : 'records'}
                  </span>
                  {file.lastUpdated && (
                    <span className="text-xs text-gray-400">
                      Updated: {file.lastUpdated}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteFile(file.type)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-medium text-blue-800 mb-2">File Management Tips:</h4>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• Delete files to remove them from the system</li>
            <li>• Upload new files to replace existing ones</li>
            <li>• Charts and metrics will update automatically</li>
            <li>• Use the refresh button to check for new uploads</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
} 