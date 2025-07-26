// lib/enhanced-data-processor.ts
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export interface StandardizedData {
  transactions?: StandardTransaction[]
  deals?: StandardDeal[]
  budget?: StandardBudget
}

export interface StandardTransaction {
  id: string
  date: string
  description: string
  amount: number
  category: string
  reference?: string
}

export interface StandardDeal {
  id: string
  dealName: string
  phase: string
  amount: number
  clientName: string
  firstAppointment?: string
  closingDate?: string
  product?: string
}

export interface StandardBudget {
  months: string[]
  categories: { [category: string]: { [month: string]: number } }
}

export interface ColumnMapping {
  originalColumn: string
  standardField: string
  confidence: number
  dataType: 'string' | 'number' | 'date' | 'currency'
  transformation?: 'date_conversion' | 'currency_conversion' | 'text_cleanup'
}

export interface DataProcessingResult {
  fileType: 'transactions' | 'deals' | 'budget'
  confidence: number
  suggestedMappings: ColumnMapping[]
  previewData: any[]
  issues: string[]
  needsManualReview: boolean
}

export class EnhancedDataProcessor {
  private aiEndpoint = '/api/openai-analyze'

  async processFile(fileName: string, headers: string[], data: any[]): Promise<DataProcessingResult> {
    try {
      if (!headers || !Array.isArray(headers)) {
        throw new Error('Missing or invalid headers in processFile()')
      }
      if (!data || !Array.isArray(data)) {
        throw new Error('Missing or invalid data in processFile()')
      }
      // 1. Analyze with AI
      let aiAnalysis = await this.analyzeWithAI(fileName, headers, data.slice(0, 5))
      if (!aiAnalysis.mappings || aiAnalysis.mappings.length === 0) {
        console.warn('AI returned no mappings — falling back to rules.')
        aiAnalysis = this.fallbackAnalysis(fileName, headers, data.slice(0, 5))
      }
      
      // 2. Apply rule-based validation
      const validated = this.validateAIAnalysis(aiAnalysis, headers, data)
      
      // 3. Return processing result
      return {
        fileType: validated.fileType,
        confidence: validated.confidence,
        suggestedMappings: validated.mappings,
        previewData: data.slice(0, 10),
        issues: validated.issues,
        needsManualReview: validated.confidence < 0.8
      }
    } catch (error) {
      console.error('File processing failed:', error)
      if (error instanceof Error) {
        throw new Error(`Failed to process file: ${error.message}`)
      } else {
        throw new Error('Failed to process file: Unknown error')
      }
    }
  }

  private async parseFile(file: File): Promise<{ headers: string[], data: any[] }> {
    if (file.name.endsWith('.csv')) {
      return this.parseCSV(file)
    } else if (file.name.match(/\.(xlsx|xls)$/)) {
      return this.parseExcel(file)
    } else {
      throw new Error('Unsupported file format')
    }
  }

  private async parseCSV(file: File): Promise<{ headers: string[], data: any[] }> {
    const text = await file.text()
    
    // Try different delimiters
    const delimiters = [',', ';', '\t', '|']
    let bestResult = null
    let maxColumns = 0

    for (const delimiter of delimiters) {
      const result = Papa.parse(text, {
        header: true,
        delimiter,
        skipEmptyLines: true,
        dynamicTyping: false // Keep as strings for better AI analysis
      })

      if (result.meta.fields && result.meta.fields.length > maxColumns) {
        maxColumns = result.meta.fields.length
        bestResult = result
      }
    }

    if (!bestResult) {
      throw new Error('Could not parse CSV file')
    }

    return {
      headers: bestResult.meta.fields || [],
      data: bestResult.data
    }
  }

  private async parseExcel(file: File): Promise<{ headers: string[], data: any[] }> {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, {
      type: 'buffer', // handles both .xlsx and .xls
      cellDates: true
    })
    
    // Get the first sheet
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    // Convert to JSON with proper options
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false, // Keep formatted values for dates
      dateNF: 'yyyy-mm-dd'
    }) as any[][]

    if (jsonData.length < 2) {
      throw new Error('Excel file must have at least header and data rows')
    }

    const headers = jsonData[0].filter(h => h && h.toString().trim() !== '')
    const dataRows = jsonData.slice(1).map(row => {
      const obj: any = {}
      headers.forEach((header, index) => {
        obj[header] = row[index] || ''
      })
      return obj
    }).filter(row => Object.values(row).some(val => val && val.toString().trim() !== ''))

    return { headers, data: dataRows }
  }

  private async analyzeWithAI(fileName: string, headers: string[], sampleData: any[]): Promise<any> {
    const prompt = this.createAnalysisPrompt(fileName, headers, sampleData)

    console.log('[AI DEBUG] Prompt sent to OpenAI:', prompt)
    
    try {
      const response = await fetch(this.aiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })

      if (!response.ok) {
        throw new Error(`AI analysis failed: ${response.status}`)
      }

      const json = await response.json()
      console.log('[AI DEBUG] Response received from OpenAI:', json)
      return json
    } catch (error) {
      console.warn('AI analysis failed, using fallback:', error)
      return this.fallbackAnalysis(fileName, headers, sampleData)
    }
  }

  private createAnalysisPrompt(fileName: string, headers: string[], sampleData: any[]): string {
    return `Analyze this business data file and provide column mappings.

File: ${fileName}
Headers: ${JSON.stringify(headers)}
Sample Data: ${JSON.stringify(sampleData)}

The file could be:
1. TRANSACTIONS: Bank/financial transactions with date, amount, description, category
2. DEALS/CRM: Sales pipeline data with deal names, amounts, client names, phases
3. BUDGET: Financial planning data with months and budget categories

Respond with ONLY valid JSON:
{
  "fileType": "transactions|deals|budget",
  "confidence": 0.85,
  "reasoning": "Brief explanation of analysis",
  "mappings": [
    {
      "originalColumn": "exact header name",
      "standardField": "mapped field name",
      "confidence": 0.9,
      "dataType": "string|number|date|currency",
      "transformation": "date_conversion|currency_conversion|text_cleanup|none"
    }
  ],
  "issues": ["any data quality issues found"],
  "businessInsights": {
    "detectedLanguage": "en|de|mixed",
    "dateFormat": "detected format",
    "currencyFormat": "detected format",
    "primaryAmount": "main amount column"
  }
}`
  }

  private fallbackAnalysis(fileName: string, headers: string[], sampleData: any[]): any {
    const lowerHeaders = headers.map(h => h.toLowerCase().trim())
    
    // Detect file type
    let fileType = 'transactions'
    let confidence = 0.3

    if (lowerHeaders.some(h => h.includes('deal') || h.includes('client') || h.includes('phase'))) {
      fileType = 'deals'
      confidence = 0.7
    } else if (lowerHeaders.some(h => h.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i))) {
      fileType = 'budget'
      confidence = 0.6
    }

    // Create basic mappings
    const mappings = headers.map(header => ({
      originalColumn: header,
      standardField: this.mapColumnFallback(header, fileType),
      confidence: 0.5,
      dataType: this.detectDataType(header, sampleData),
      transformation: 'none'
    }))

    return {
      fileType,
      confidence,
      reasoning: 'Fallback rule-based analysis',
      mappings,
      issues: [],
      businessInsights: {
        detectedLanguage: 'unknown',
        dateFormat: 'unknown',
        currencyFormat: 'unknown',
        primaryAmount: ''
      }
    }
  }

  private mapColumnFallback(header: string, fileType: string): string {
    const lower = header.toLowerCase().trim()
    
    if (fileType === 'deals') {
      if (lower.includes('deal') && lower.includes('name')) return 'dealName'
      if (lower.includes('client')) return 'clientName'
      if (lower.includes('phase') || lower.includes('stage')) return 'phase'
      if (lower.includes('amount') || lower.includes('value')) return 'amount'
      if (lower.includes('product')) return 'product'
      if (lower.includes('date')) return 'closingDate'
    }
    
    if (fileType === 'transactions') {
      if (lower.includes('buchung') || lower.includes('wertstellung')) return 'date'
      if (lower.includes('umsatz') || lower.includes('betrag')) return 'amount'
      if (lower.includes('verwendungszweck')) return 'reference'
      if (lower.includes('empfänger') || lower.includes('absender') || lower.includes('zahlungspflichtiger')) return 'description'
      if (lower.includes('kategorie') || lower.includes('category')) return 'category'
    }

    return 'unmapped'
  }

  private detectDataType(header: string, sampleData: any[]): 'string' | 'number' | 'date' | 'currency' {
    const lower = header.toLowerCase()
    
    if (lower.includes('date') || lower.includes('datum')) return 'date'
    if (lower.includes('amount') || lower.includes('betrag') || lower.includes('value')) return 'currency'
    
    // Check sample data
    const samples = sampleData.map(row => row[header]).filter(val => val != null && val !== '')
    if (samples.length === 0) return 'string'
    
    const firstSample = samples[0].toString()
    if (firstSample.match(/^\d+([.,]\d+)?$/)) return 'number'
    if (firstSample.match(/\d{4}-\d{2}-\d{2}/) || firstSample.match(/\d{2}[./]\d{2}[./]\d{4}/)) return 'date'
    
    return 'string'
  }

  private validateAIAnalysis(aiResult: any, headers: string[], data: any[]): any {
    const issues = []
    
    // Validate required mappings exist
    const mappings = aiResult.mappings || []
    const mappedFields = mappings.map((m: any) => m.standardField)
    
    if (aiResult.fileType === 'deals') {
      if (!mappedFields.includes('dealName')) issues.push('No deal name column mapped')
      if (!mappedFields.includes('amount')) issues.push('No amount column mapped')
      if (!mappedFields.includes('clientName')) issues.push('No client name column mapped')
    }
    
    if (aiResult.fileType === 'transactions') {
      if (!mappedFields.includes('date')) issues.push('No date column mapped')
      if (!mappedFields.includes('amount')) issues.push('No amount column mapped')
    }
    
    // Adjust confidence based on issues
    let adjustedConfidence = aiResult.confidence || 0.3
    if (issues.length > 0) adjustedConfidence *= 0.7
    
    return {
      ...aiResult,
      confidence: adjustedConfidence,
      issues: [...(aiResult.issues || []), ...issues],
      mappings
    }
  }

  async convertToStandardFormat(
    data: any[], 
    mappings: ColumnMapping[], 
    fileType: 'transactions' | 'deals' | 'budget'
  ): Promise<StandardizedData> {
    switch (fileType) {
      case 'deals':
        return { deals: this.convertToDeals(data, mappings) }
      case 'transactions':
        return { transactions: this.convertToTransactions(data, mappings) }
      case 'budget':
        return { budget: this.convertToBudget(data, mappings) }
      default:
        throw new Error(`Unsupported file type: ${fileType}`)
    }
  }

  private convertToDeals(data: any[], mappings: ColumnMapping[]): StandardDeal[] {
    const fieldMap = Object.fromEntries(
      mappings.map(m => [m.originalColumn, { field: m.standardField, type: m.dataType }])
    )

    return data.map((row, index) => {
      const deal: StandardDeal = {
        id: `deal_${Date.now()}_${index}`,
        dealName: '',
        phase: 'Unknown',
        amount: 0,
        clientName: '',
        firstAppointment: '',
        closingDate: '',
        product: ''
      }

      Object.entries(row).forEach(([column, value]) => {
        const mapping = fieldMap[column]
        console.log('[Mapping Debug]', { column, mappedField: mapping?.field, value })
        // Hard fallback for phase recognition based on value content
        if (!mapping && column.toLowerCase().includes('phase') && typeof value === 'string') {
          const raw = value.toLowerCase()
          if (raw.includes('lead')) {
            deal.phase = 'Lead Generation'
            // After processing, log if Lead Generation
            if (deal.phase === 'Lead Generation') {
              console.log('[Lead Gen Deal]', {
                dealName: deal.dealName,
                amount: deal.amount,
                clientName: deal.clientName,
                closingDate: deal.closingDate
              })
            }
            return
          }
          if (raw.includes('first contact')) {
            deal.phase = 'First Contact'
            return
          }
          if (raw.includes('qual')) {
            deal.phase = 'Need Qualification'
            return
          }
          if (raw.includes('negotiation') || raw.includes('verhandlung')) {
            deal.phase = 'Negotiation'
            return
          }
          if (raw.includes('deal') || raw.includes('gewonnen')) {
            deal.phase = 'Deal'
            return
          }
          if (raw.includes('no deal') || raw.includes('kein')) {
            deal.phase = 'No Deal'
            return
          }
        }
        // Fallback: infer phase if not explicitly mapped
        if (!mapping && column.toLowerCase().includes('phase') && typeof value === 'string') {
          const norm = value.toString().trim().toLowerCase()
          const phaseAliases: { [key: string]: string } = {
            'lead gen': 'Lead Generation',
            'leadgen': 'Lead Generation',
            'lead-generation': 'Lead Generation',
            'leadgeneration': 'Lead Generation',
            'lead generation': 'Lead Generation',
            'lead gen.': 'Lead Generation',
            'lead-gen': 'Lead Generation',
            'lead': 'Lead Generation',
            'first contact': 'First Contact',
            'need qualification': 'Need Qualification',
            'qualifizierung': 'Need Qualification',
            'verhandlung': 'Negotiation',
            'negotiation': 'Negotiation',
            'deal': 'Deal',
            'gewonnen': 'Deal',
            'kein deal': 'No Deal',
            'no deal': 'No Deal'
          }
          deal.phase = phaseAliases[norm] || value
          if (deal.phase === 'Lead Generation') {
            console.log('[Lead Gen Deal]', {
              dealName: deal.dealName,
              amount: deal.amount,
              clientName: deal.clientName,
              closingDate: deal.closingDate
            })
          }
          return
        }
        if (!mapping || !value) return

        const processedValue = this.processValue(value, mapping.type)
        
        switch (mapping.field) {
          case 'dealName':
            deal.dealName = processedValue.toString()
            break
          case 'clientName':
            deal.clientName = processedValue.toString()
            break
          case 'phase':
            // Normalize phase values
            const rawPhase = processedValue.toString().toLowerCase()
            if (['lead generation', 'LEAD GEN', 'lead-gen', 'kontaktaufnahme'].includes(rawPhase)) {
              deal.phase = 'Lead Generation'
            } else if (['first contact', 'FIRST CONTACT'].includes(rawPhase)) {
              deal.phase = 'First Contact'
            } else if (['need qualification', 'NEED QUALIFICATION', 'bedarf'].includes(rawPhase)) {
              deal.phase = 'Need Qualification'
            } else if (['negotiation', 'verhandlungsphase', 'NEGOTIATION'].includes(rawPhase)) {
              deal.phase = 'Negotiation'
            } else if (['deal', 'DEAL', 'abgeschlossen'].includes(rawPhase)) {
              deal.phase = 'Deal'
            } else if (['no deal', 'kein deal', 'NO DEAL'].includes(rawPhase)) {
              deal.phase = 'No Deal'
            } else {
              deal.phase = 'Unknown'
            }
            if (deal.phase === 'Lead Generation') {
              console.log('[Lead Gen Deal]', {
                dealName: deal.dealName,
                amount: deal.amount,
                clientName: deal.clientName,
                closingDate: deal.closingDate
              })
            }
            break
          case 'amount':
            deal.amount = this.parseAmount(processedValue)
            break
          case 'product':
            deal.product = processedValue.toString()
            break
          case 'firstAppointment':
          case 'closingDate':
            deal[mapping.field] = this.parseDate(processedValue)
            break
        }
        // After processing each column, log if Lead Generation
        if (deal.phase === 'Lead Generation') {
          console.log('[Lead Gen Deal]', {
            dealName: deal.dealName,
            amount: deal.amount,
            clientName: deal.clientName,
            closingDate: deal.closingDate
          })
        }
      })

      // Validation and cleanup
      if (!deal.dealName && deal.clientName) {
        deal.dealName = `Deal with ${deal.clientName}`
      }
      if (!deal.clientName) {
        deal.clientName = 'Unknown Client'
      }

      return deal
    }).filter(deal => deal.dealName && (deal.amount > 0 || deal.clientName !== 'Unknown Client'))
  }

  private convertToTransactions(data: any[], mappings: ColumnMapping[]): StandardTransaction[] {
    const fieldMap = Object.fromEntries(
      mappings.map(m => [m.originalColumn, { field: m.standardField, type: m.dataType }])
    )

    return data.map((row, index) => {
      const transaction: StandardTransaction = {
        id: `tx_${Date.now()}_${index}`,
        date: '',
        description: '',
        amount: 0,
        category: 'Other',
        reference: ''
      }

      Object.entries(row).forEach(([column, value]) => {
        const mapping = fieldMap[column]
        if (!mapping || !value) return

        const processedValue = this.processValue(value, mapping.type)
        
        switch (mapping.field) {
          case 'date':
            transaction.date = this.parseDate(processedValue)
            break
          case 'amount':
            transaction.amount = this.parseAmount(processedValue)
            break
          case 'description':
            transaction.description = processedValue.toString()
            break
          case 'category':
            transaction.category = processedValue.toString()
            break
          case 'reference':
            transaction.reference = processedValue.toString()
            break
        }
      })

      return transaction
    }).filter(tx => tx.date && !isNaN(tx.amount))
  }

  private convertToBudget(data: any[], mappings: ColumnMapping[]): StandardBudget {
    // Budget conversion logic - assuming first column is categories, rest are months
    const months = mappings
      .filter(m => m.standardField.startsWith('month_'))
      .map(m => m.standardField.replace('month_', ''))
      .sort()

    const categories: { [category: string]: { [month: string]: number } } = {}

    data.forEach(row => {
      const categoryColumn = mappings.find(m => m.standardField === 'category')?.originalColumn
      if (!categoryColumn || !row[categoryColumn]) return

      const category = row[categoryColumn].toString()
      categories[category] = {}

      mappings
        .filter(m => m.standardField.startsWith('month_'))
        .forEach(mapping => {
          const month = mapping.standardField.replace('month_', '')
          categories[category][month] = this.parseAmount(row[mapping.originalColumn] || 0)
        })
    })

    return { months, categories }
  }

  private processValue(value: any, dataType: string): any {
    if (value == null || value === '') return ''
    
    switch (dataType) {
      case 'date':
        return this.parseDate(value)
      case 'currency':
      case 'number':
        return this.parseAmount(value)
      default:
        return value.toString().trim()
    }
  }

  private parseDate(value: any): string {
    if (!value) return ''
    
    try {
      // Handle Excel serial dates
      if (typeof value === 'number' && value > 25000) {
        const date = new Date((value - 25569) * 86400 * 1000)
        return date.toISOString().split('T')[0]
      }
      
      // Handle various string formats
      if (typeof value === 'string') {
        // German format: DD.MM.YYYY
        if (value.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
          const [day, month, year] = value.split('.')
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
        }
        
        // US format: MM/DD/YYYY
        if (value.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          const [month, day, year] = value.split('/')
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
        }
        
        // ISO format or parseable string
        const parsed = new Date(value)
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0]
        }
      }
      
      return new Date().toISOString().split('T')[0]
    } catch {
      return new Date().toISOString().split('T')[0]
    }
  }

  private parseAmount(value: any): number {
    if (typeof value === 'number') return value
    if (!value) return 0
    
    let cleanValue = value.toString()
      .replace(/[€$£¥\s]/g, '') // Remove currency symbols and spaces
      .replace(/[^\d.,-]/g, '') // Keep only digits, dots, commas, minus
    
    // Handle German format: 1.234,56
    if (cleanValue.includes(',') && cleanValue.includes('.')) {
      const lastComma = cleanValue.lastIndexOf(',')
      const lastDot = cleanValue.lastIndexOf('.')
      if (lastComma > lastDot) {
        cleanValue = cleanValue.replace(/\./g, '').replace(',', '.')
      }
    } else if (cleanValue.includes(',')) {
      // German decimal or US thousands
      const parts = cleanValue.split(',')
      if (parts.length === 2 && parts[1].length <= 2) {
        cleanValue = cleanValue.replace(',', '.')
      } else {
        cleanValue = cleanValue.replace(/,/g, '')
      }
    }
    
    const parsed = parseFloat(cleanValue)
    return isNaN(parsed) ? 0 : parsed
  }
}