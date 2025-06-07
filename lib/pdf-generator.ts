// lib/pdf-generator.ts
import jsPDF from 'jspdf'

interface ReportConfig {
  title: string
  companyName: string
  reportPeriod: string
  includeOverview: boolean
  includeFinancial: boolean
  includeSales: boolean
  includeCashFlow: boolean
  // Enhanced card selections
  overviewCards: {
    metricsGrid: boolean
    performanceCharts: boolean
  }
  financialCards: {
    revenueBreakdown: boolean
    expenseAnalysis: boolean
    varianceReport: boolean
  }
  salesCards: {
    pipelineMetrics: boolean
    pipelineByStage: boolean
    pipelineByClosingDate: boolean
    dealSources: boolean
  }
  cashFlowCards: {
    currentBalance: boolean
    monthlyBurnRate: boolean
    cashRunway: boolean
    monthlyTrend: boolean
    inflowOutflowBreakdown: boolean
  }
}

interface MetricsData {
  mrr: number
  arr: number
  cashBalance: number
  burnRate: number
  contracted: number
  ltmRevenue: number
  netMargin: number
  customers: number
}

// Standard layout measurements (in mm)
const LAYOUT = {
  margin: 20,           // 2cm margins
  headerHeight: 40,     // Header space
  contentWidth: 257,    // A4 landscape width minus margins
  contentHeight: 147,   // A4 landscape height minus margins
  gap: 10,              // Standard gap between elements
  
  // Layout A: Two Column (2:1 ratio)
  layoutA: {
    leftWidth: 171,     // Big column
    rightWidth: 76,     // Small column (257-171-10)
  },
  
  // Layout B: Three Column (2:2:1 ratio)
  layoutB: {
    col1Width: 102,     // First column
    col2Width: 102,     // Second column  
    col3Width: 43,      // Third column (257-102-102-20)
  },
  
  // Layout C: Two Row (stacked)
  layoutC: {
    topHeight: 68.5,    // Top half (147-10)/2
    bottomHeight: 68.5, // Bottom half
  }
}

export async function generateUnifiedPDF(config: ReportConfig): Promise<void> {
  console.log('🚀 Starting PDF generation with standardized layouts...')
  
  try {
    const pdf = new jsPDF('landscape', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()

    // Layout Helper Functions
    const addSlideHeader = (title: string) => {
      pdf.setFillColor(52, 73, 94)
      pdf.rect(0, 0, pageWidth, LAYOUT.headerHeight, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(20)
      pdf.setFont('helvetica', 'bold')
      pdf.text(title, LAYOUT.margin, 25)
      pdf.setFontSize(10)
      pdf.text('[LOGO]', pageWidth - 40, 25)
    }

    const getContentStartY = () => LAYOUT.headerHeight + 10
    const getContentStartX = () => LAYOUT.margin

    // Simple, reliable metric card with REDUCED PADDING + VISUAL DEBUGGING
    const addMetricCard = (x: number, y: number, width: number, height: number, metric: any) => {
      // VISUAL DEBUG: Draw card boundary in red
      pdf.setDrawColor(255, 0, 0) // Red
      pdf.setLineWidth(1)
      pdf.rect(x, y, width, height, 'S')
      
      // Card background
      pdf.setFillColor(249, 250, 251)
      pdf.roundedRect(x, y, width, height, 3, 3, 'F')
      pdf.setDrawColor(229, 231, 235)
      pdf.setLineWidth(0.5)
      pdf.roundedRect(x, y, width, height, 3, 3, 'S')

      const padding = 6  // Reduced from 8 to 6
      
      // VISUAL DEBUG: Draw content area in blue
      pdf.setDrawColor(0, 0, 255) // Blue
      pdf.setLineWidth(0.5)
      pdf.rect(x + padding, y + padding, width - (padding * 2), height - (padding * 2), 'S')
      
      // Title - Fixed position and size
      pdf.setTextColor(75, 85, 99)
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'bold')
      const titleY = y + 12  // Reduced from 15 to 12
      pdf.text(metric.title, x + padding, titleY)
      
      // VISUAL DEBUG: Draw title baseline in green
      pdf.setDrawColor(0, 255, 0) // Green
      pdf.setLineWidth(0.3)
      pdf.line(x + padding, titleY, x + width - padding, titleY)

      // Value - Fixed position with more space
      pdf.setTextColor(metric.color[0], metric.color[1], metric.color[2])
      pdf.setFontSize(16)
      pdf.setFont('helvetica', 'bold')
      const valueY = y + 26  // Reduced from 32 to 26
      pdf.text(metric.value, x + padding, valueY)
      
      // VISUAL DEBUG: Draw value baseline in green
      pdf.setDrawColor(0, 255, 0) // Green
      pdf.line(x + padding, valueY, x + width - padding, valueY)

      // Progress bar - Fixed position with adequate space from value
      if (metric.progress !== undefined) {
        const barY = y + height - 12  // Keep same distance from bottom
        const barWidth = width - (padding * 2)
        
        // VISUAL DEBUG: Draw progress bar area in orange
        pdf.setDrawColor(255, 165, 0) // Orange
        pdf.setLineWidth(0.5)
        pdf.rect(x + padding, barY - 2, barWidth, 8, 'S')
        
        pdf.setFillColor(229, 231, 235)
        pdf.rect(x + padding, barY, barWidth, 4, 'F')
        
        pdf.setFillColor(metric.color[0], metric.color[1], metric.color[2])
        pdf.rect(x + padding, barY, barWidth * (metric.progress / 100), 4, 'F')
      }

      // Subtitle - Fixed position with tighter spacing
      pdf.setTextColor(107, 114, 128)
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      const subtitleY = y + height - (metric.progress !== undefined ? 20 : 8)  // Tighter spacing
      pdf.text(metric.subtitle || '', x + padding, subtitleY)
      
      // VISUAL DEBUG: Draw subtitle baseline in green
      pdf.setDrawColor(0, 255, 0) // Green
      pdf.line(x + padding, subtitleY, x + width - padding, subtitleY)
      
      // VISUAL DEBUG: Add card index number for identification
      pdf.setTextColor(255, 0, 0)
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.text(`${Math.floor(Math.random() * 100)}`, x + 2, y + 12)
    }

    // Simple, reliable data table with fixed spacing
    const addDataTable = (x: number, y: number, width: number, data: any[], title: string) => {
      // Table title
      pdf.setTextColor(51, 65, 85)
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.text(title, x, y)

      const tableY = y + 18  // Fixed spacing below title
      const rowHeight = 14   // Larger row height for better spacing
      const colWidth = width / data[0].cols.length
      const tablePadding = 5

      // Table header
      pdf.setFillColor(52, 73, 94)
      pdf.rect(x, tableY, width, rowHeight, 'F')
      
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'bold')
      
      data[0].cols.forEach((col: string, index: number) => {
        pdf.text(col, x + index * colWidth + tablePadding, tableY + 9)
      })

      // Table rows
      data.slice(1).forEach((row, rowIndex) => {
        const currentY = tableY + (rowIndex + 1) * rowHeight
        
        if (rowIndex % 2 === 0) {
          pdf.setFillColor(248, 250, 252)
          pdf.rect(x, currentY, width, rowHeight, 'F')
        }

        pdf.setTextColor(51, 65, 85)
        pdf.setFontSize(8)
        pdf.setFont('helvetica', 'normal')

        row.cols.forEach((cell: string, colIndex: number) => {
          if (cell.includes('+')) {
            pdf.setTextColor(16, 185, 129)
          } else if (cell.includes('-') && cell.includes('€')) {
            pdf.setTextColor(239, 68, 68)
          } else {
            pdf.setTextColor(51, 65, 85)
          }
          
          pdf.text(cell, x + colIndex * colWidth + tablePadding, currentY + 9)
        })
      })

      return tableY + (data.length) * rowHeight + 20  // Return next Y position with buffer
    }

    // Simple, reliable insights box with FIXED EMOJI and better spacing
    const addInsightsBox = (x: number, y: number, width: number, height: number, insight: string) => {
      const padding = 10
      
      pdf.setFillColor(239, 246, 255)
      pdf.roundedRect(x, y, width, height, 3, 3, 'F')
      pdf.setDrawColor(147, 197, 253)
      pdf.setLineWidth(0.5)
      pdf.roundedRect(x, y, width, height, 3, 3, 'S')

      // FIXED EMOJI: Use simple bullet instead of emoji
      pdf.setTextColor(30, 64, 175)
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'bold')
      pdf.text('■ Key Insights', x + padding, y + 18)  // Increased Y position for better spacing

      // BETTER CONTENT SPACING: More space below title
      pdf.setTextColor(30, 64, 175)
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      const lines = pdf.splitTextToSize(insight, width - (padding * 2))
      pdf.text(lines, x + padding, y + 32)  // Increased Y position for more breathing room
    }

    // Add page boundary visualization and layout debugging
    const addPageBoundaryDebug = () => {
      // Draw page margins in thick red
      pdf.setDrawColor(255, 0, 0) // Red
      pdf.setLineWidth(2)
      pdf.rect(LAYOUT.margin, LAYOUT.margin, 
               pageWidth - (LAYOUT.margin * 2), 
               pageHeight - (LAYOUT.margin * 2), 'S')
      
      // Draw content area in blue
      pdf.setDrawColor(0, 0, 255) // Blue
      pdf.setLineWidth(1)
      pdf.rect(LAYOUT.margin, LAYOUT.headerHeight + 10, 
               LAYOUT.contentWidth, LAYOUT.contentHeight - 10, 'S')
      
      // Add dimension labels
      pdf.setTextColor(255, 0, 0)
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      pdf.text(`Page: ${pageWidth}x${pageHeight}mm`, 10, 10)
      pdf.text(`Content: ${LAYOUT.contentWidth}x${LAYOUT.contentHeight}mm`, 10, 20)
      pdf.text(`Margin: ${LAYOUT.margin}mm`, 10, 30)
    }
    const formatCurrency = (value: number): string => {
      const absValue = Math.abs(value)
      if (absValue >= 1000000) return `€${(value / 1000000).toFixed(1)}M`
      else if (absValue >= 1000) return `€${(value / 1000).toFixed(1)}k`
      return `€${value.toFixed(0)}`
    }

    const getCurrentMetrics = (): MetricsData => {
      const transactions = localStorage.getItem('transactions')
      const deals = localStorage.getItem('crmDeals')
      
      if (!transactions) {
        return { mrr: 0, arr: 0, cashBalance: 0, burnRate: 0, contracted: 0, ltmRevenue: 0, netMargin: 0, customers: 0 }
      }
      
      try {
        const transactionData = JSON.parse(transactions)
        const dealData = deals ? JSON.parse(deals) : []
        
        const now = new Date()
        const currentMonthTx = transactionData.filter((t: any) => {
          const date = new Date(t.date || t.Date)
          return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
        })
        
        const mrr = currentMonthTx
          .filter((t: any) => (t.category || t.Category) === 'Subscription' && (t.amount || t.Amount) > 0)
          .reduce((sum: number, t: any) => sum + (t.amount || t.Amount), 0)
        
        const cashBalance = transactionData.reduce((sum: number, t: any) => sum + (t.amount || t.Amount), 0)
        
        const monthlyRevenue = currentMonthTx
          .filter((t: any) => (t.amount || t.Amount) > 0)
          .reduce((sum: number, t: any) => sum + (t.amount || t.Amount), 0)
        
        const monthlyExpenses = Math.abs(currentMonthTx
          .filter((t: any) => (t.amount || t.Amount) < 0)
          .reduce((sum: number, t: any) => sum + (t.amount || t.Amount), 0))
        
        const netMargin = monthlyRevenue > 0 ? ((monthlyRevenue - monthlyExpenses) / monthlyRevenue * 100) : 0
        
        const contracted = dealData
          .filter((d: any) => ['Negotiation', 'Deal'].includes(d.phase))
          .reduce((sum: number, d: any) => sum + (d.amount || 0), 0)
        
        const customers = new Set(dealData.map((d: any) => d.clientName).filter(Boolean)).size

        return {
          mrr: Math.round(mrr),
          arr: Math.round(mrr * 12),
          cashBalance: Math.round(cashBalance),
          burnRate: Math.round(Math.max(0, monthlyExpenses - monthlyRevenue)),
          contracted: Math.round(contracted),
          ltmRevenue: Math.round(mrr),
          netMargin: Math.round(netMargin),
          customers: customers
        }
      } catch (error) {
        console.error('Error parsing data:', error)
        return { mrr: 0, arr: 0, cashBalance: 0, burnRate: 0, contracted: 0, ltmRevenue: 0, netMargin: 0, customers: 0 }
      }
    }

    // 1. COVER SLIDE - Layout D (Full Width)
    pdf.setFillColor(245, 245, 245)
    pdf.rect(0, 0, pageWidth * 0.6, pageHeight, 'F')
    
    pdf.setFillColor(52, 73, 94)
    pdf.rect(pageWidth * 0.6, 0, pageWidth * 0.4, pageHeight, 'F')

    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(42)
    pdf.setFont('helvetica', 'bold')
    
    const titleLines = pdf.splitTextToSize(config.title.toUpperCase(), pageWidth * 0.35)
    const titleY = pageHeight * 0.3
    titleLines.forEach((line: string, index: number) => {
      pdf.text(line, pageWidth * 0.62, titleY + (index * 15))
    })

    pdf.setFontSize(24)
    pdf.setFont('helvetica', 'normal')
    pdf.text(config.companyName, pageWidth * 0.62, pageHeight * 0.5)

    pdf.setFontSize(18)
    pdf.text(config.reportPeriod, pageWidth * 0.62, pageHeight * 0.8)

    pdf.setFontSize(10)
    pdf.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth * 0.62, pageHeight * 0.9)

    const metrics = getCurrentMetrics()

    // 2. OVERVIEW SLIDE - Layout A (Two Column) with CONDITIONAL CARD RENDERING
    if (config.includeOverview) {
      pdf.addPage()
      addSlideHeader('Key Metrics Overview')
      
      // VISUAL DEBUG: Add page boundaries and measurements
      addPageBoundaryDebug()
      
      const startX = getContentStartX()
      const startY = getContentStartY()
      
      // VISUAL DEBUG: Mark start position
      pdf.setFillColor(255, 0, 0)
      pdf.circle(startX, startY, 2, 'F')
      pdf.setTextColor(255, 0, 0)
      pdf.setFontSize(8)
      pdf.text(`Start: ${startX},${startY}`, startX + 5, startY)

      let currentY = startY

      // CONDITIONAL: Metrics Grid
      if (config.overviewCards?.metricsGrid) {
        const metricsArray = [
          { title: 'MRR', value: formatCurrency(metrics.mrr), color: [16, 185, 129], progress: 85, subtitle: 'Monthly Recurring Revenue' },
          { title: 'ARR', value: formatCurrency(metrics.arr), color: [59, 130, 246], progress: 75, subtitle: 'Annual Recurring Revenue' },
          { title: 'Cash Balance', value: formatCurrency(metrics.cashBalance), color: metrics.cashBalance >= 0 ? [16, 185, 129] : [239, 68, 68], progress: 70, subtitle: 'Total cash on hand' },
          { title: 'Net Burn', value: `${formatCurrency(metrics.burnRate)}/mo`, color: metrics.burnRate > 0 ? [239, 68, 68] : [16, 185, 129], progress: 60, subtitle: 'Monthly net cash burn' },
          { title: 'Contracted', value: formatCurrency(metrics.contracted), color: [139, 92, 246], progress: 90, subtitle: 'Pipeline in negotiation/closed' },
          { title: 'Customers', value: metrics.customers.toString(), color: [59, 130, 246], progress: 80, subtitle: 'Active customer count' }
        ]

        // Metrics grid in left column
        const cardWidth = (LAYOUT.layoutA.leftWidth - LAYOUT.gap) / 2
        const cardHeight = 40
        const rowSpacing = 12

        // VISUAL DEBUG: Draw grid structure
        pdf.setDrawColor(255, 165, 0) // Orange
        pdf.setLineWidth(1)
        pdf.rect(startX, currentY, LAYOUT.layoutA.leftWidth, (cardHeight * 3) + (rowSpacing * 2), 'S')

        metricsArray.forEach((metric, index) => {
          const col = index % 2
          const row = Math.floor(index / 2)
          const x = startX + col * (cardWidth + LAYOUT.gap)
          const y = currentY + row * (cardHeight + rowSpacing)
          
          // VISUAL DEBUG: Show card position calculation
          pdf.setTextColor(255, 0, 0)
          pdf.setFontSize(6)
          pdf.text(`Card ${index}: ${x},${y}`, x, y - 2)
          
          addMetricCard(x, y, cardWidth, cardHeight, metric)
        })

        currentY += (cardHeight * 3) + (rowSpacing * 2) + 20 // Move below metrics grid
      }

      // CONDITIONAL: Performance Charts (placeholder for now)
      if (config.overviewCards?.performanceCharts) {
        // Add performance charts section
        pdf.setTextColor(51, 65, 85)
        pdf.setFontSize(14)
        pdf.setFont('helvetica', 'bold')
        pdf.text('Performance Charts', startX, currentY)
        
        // Placeholder for charts
        pdf.setDrawColor(200, 200, 200)
        pdf.setLineWidth(1)
        pdf.rect(startX, currentY + 10, LAYOUT.layoutA.leftWidth, 40, 'S')
        
        pdf.setTextColor(150, 150, 150)
        pdf.setFontSize(10)
        pdf.text('MRR vs Plan Chart (Coming Soon)', startX + 10, currentY + 25)
        pdf.text('Burn Rate Trends Chart (Coming Soon)', startX + 10, currentY + 40)
        
        currentY += 60
      }

      // Right column: Insights - only if we have content to show insights for
      if (config.overviewCards?.metricsGrid || config.overviewCards?.performanceCharts) {
        const insightsX = startX + LAYOUT.layoutA.leftWidth + LAYOUT.gap
        const insightsHeight = 60
        
        // VISUAL DEBUG: Draw insights area
        pdf.setDrawColor(128, 0, 128) // Purple
        pdf.setLineWidth(1)
        pdf.rect(insightsX, startY, LAYOUT.layoutA.rightWidth, insightsHeight, 'S')
        
        addInsightsBox(insightsX, startY, LAYOUT.layoutA.rightWidth, insightsHeight, 'Strong MRR growth with healthy cash runway. Monitor burn rate to extend runway beyond current projection.')
      }
    }

    // 3. FINANCIAL SLIDE - Layout B (Three Column) with CONDITIONAL CARD RENDERING
    if (config.includeFinancial) {
      pdf.addPage()
      addSlideHeader('Financial Analysis')
      
      const startX = getContentStartX()
      const startY = getContentStartY()
      
      let currentTableX = startX
      let tableCount = 0
      
      // Count enabled tables to determine layout
      const enabledTables = [
        config.financialCards?.revenueBreakdown,
        config.financialCards?.expenseAnalysis,
        config.financialCards?.varianceReport
      ].filter(Boolean).length
      
      const tableWidth = enabledTables > 1 ? LAYOUT.layoutB.col1Width : LAYOUT.contentWidth * 0.7
      const insightsWidth = enabledTables > 1 ? LAYOUT.layoutB.col3Width : LAYOUT.contentWidth * 0.25
      
      // CONDITIONAL: Revenue Breakdown Table
      if (config.financialCards?.revenueBreakdown) {
        const revenueData = [
          { cols: ['Revenue Source', 'Current', 'Previous', 'Change'] },
          { cols: ['Subscription', formatCurrency(metrics.mrr), formatCurrency(metrics.mrr * 0.87), '+15.0%'] },
          { cols: ['Services', formatCurrency(12500), formatCurrency(8700), '+43.7%'] },
          { cols: ['Consulting', formatCurrency(6800), formatCurrency(7200), '-5.6%'] }
        ]
        
        addDataTable(currentTableX, startY, tableWidth, revenueData, 'Revenue Breakdown')
        currentTableX += tableWidth + LAYOUT.gap
        tableCount++
      }
      
      // CONDITIONAL: Expense Analysis Table  
      if (config.financialCards?.expenseAnalysis) {
        const expenseData = [
          { cols: ['Category', 'Budget', 'Actual', 'Variance'] },
          { cols: ['Salaries', '€28k', '€26.5k', '-€1.5k'] },
          { cols: ['Marketing', '€8k', '€9.2k', '+€1.2k'] },
          { cols: ['Operations', '€5.5k', '€5.1k', '-€400'] }
        ]
        
        addDataTable(currentTableX, startY, tableWidth, expenseData, 'Expense Analysis')
        currentTableX += tableWidth + LAYOUT.gap
        tableCount++
      }

      // CONDITIONAL: Budget Variance Report (placeholder for now)
      if (config.financialCards?.varianceReport) {
        const varianceData = [
          { cols: ['Category', 'Budget', 'Actual', '% Variance'] },
          { cols: ['Total Revenue', '€45k', '€48.3k', '+7.3%'] },
          { cols: ['Total Expenses', '€41.5k', '€40.8k', '-1.7%'] },
          { cols: ['Net Profit', '€3.5k', '€7.5k', '+114%'] }
        ]
        
        addDataTable(currentTableX, startY, tableWidth, varianceData, 'Budget Variance Report')
        tableCount++
      }
      
      // Right column: Insights - only if we have tables to comment on
      if (tableCount > 0) {
        const rightX = startX + (tableWidth * Math.min(tableCount, 2)) + (LAYOUT.gap * Math.min(tableCount, 2))
        addInsightsBox(rightX, startY, insightsWidth, 60, 'Revenue growing faster than expenses. Marketing overspend offset by salary savings. Net margin improving.')
      }
    }

    // 4. SALES SLIDE - Layout C (Stacked) with CONDITIONAL CARD RENDERING
    if (config.includeSales) {
      pdf.addPage()
      addSlideHeader('Sales Pipeline Analysis')
      
      // VISUAL DEBUG: Add page boundaries
      addPageBoundaryDebug()
      
      const startX = getContentStartX()
      const startY = getContentStartY()
      
      let currentY = startY

      // CONDITIONAL: Pipeline Metrics Cards
      if (config.salesCards?.pipelineMetrics) {
        const salesMetrics = [
          { title: 'Total Pipeline', value: '€1.2M', color: [59, 130, 246], subtitle: 'All active deals' },
          { title: 'Active Deals', value: '34', color: [16, 185, 129], subtitle: 'In progress' },
          { title: 'Win Rate', value: '68%', color: [16, 185, 129], subtitle: 'Last 90 days' },
          { title: 'Avg Deal Size', value: '€35.3k', color: [59, 130, 246], subtitle: 'Current pipeline' }
        ]

        // FIXED METRIC CARD LAYOUT - proper width calculation
        const totalGaps = (salesMetrics.length - 1) * LAYOUT.gap  // 3 gaps between 4 cards
        const availableCardWidth = LAYOUT.contentWidth - totalGaps  // 257 - 30 = 227mm
        const metricCardWidth = availableCardWidth / salesMetrics.length  // 227/4 = 56.75mm each
        const metricCardHeight = 40  // Same as overview cards

        // VISUAL DEBUG: Show spacing calculations
        pdf.setTextColor(255, 0, 0)
        pdf.setFontSize(8)
        pdf.text(`Card width: ${metricCardWidth.toFixed(1)}mm, Total gaps: ${totalGaps}mm`, startX, currentY - 10)

        // VISUAL DEBUG: Draw metric section boundary
        pdf.setDrawColor(255, 165, 0) // Orange
        pdf.setLineWidth(1)
        pdf.rect(startX, currentY, LAYOUT.contentWidth, metricCardHeight + 10, 'S')

        salesMetrics.forEach((metric, index) => {
          const x = startX + index * (metricCardWidth + LAYOUT.gap)
          const y = currentY
          
          // VISUAL DEBUG: Show individual card boundaries
          pdf.setDrawColor(128, 0, 128) // Purple
          pdf.setLineWidth(0.5)
          pdf.rect(x, y, metricCardWidth, metricCardHeight, 'S')
          
          addMetricCard(x, y, metricCardWidth, metricCardHeight, metric)
        })

        currentY += metricCardHeight + 20  // Move below metric cards
      }

      // CONDITIONAL: Pipeline by Stage Table
      if (config.salesCards?.pipelineByStage) {
        const tableStartY = currentY
        
        // VISUAL DEBUG: Draw table section boundary
        pdf.setDrawColor(0, 128, 0) // Green
        pdf.setLineWidth(1)
        const remainingHeight = (pageHeight - LAYOUT.margin) - tableStartY
        pdf.rect(startX, tableStartY, LAYOUT.contentWidth, Math.min(remainingHeight, 80), 'S')
        pdf.setTextColor(0, 128, 0)
        pdf.setFontSize(8)
        pdf.text(`Table area: ${Math.min(remainingHeight, 80).toFixed(1)}mm height`, startX, tableStartY - 5)
        
        const pipelineData = [
          { cols: ['Stage', 'Deals', 'Total Value', 'Avg Deal Size', 'Conversion Rate'] },
          { cols: ['Lead Generation', '12', '€180k', '€15k', '25%'] },
          { cols: ['Need Qualification', '8', '€320k', '€40k', '60%'] },
          { cols: ['Negotiation', '5', '€275k', '€55k', '85%'] },
          { cols: ['Closed Won', '9', '€425k', '€47.2k', '100%'] }
        ]
        
        addDataTable(startX, tableStartY, LAYOUT.contentWidth, pipelineData, 'Pipeline by Stage')
        currentY += 80
      }

      // CONDITIONAL: Pipeline by Closing Date - FIX THE LOGIC
      if (config.salesCards?.pipelineByClosingDate) {
        const closingDateData = [
          { cols: ['Closing Month', 'Deals', 'Total Value', 'Probability'] },
          { cols: ['This Month', '5', '€275k', '85%'] },
          { cols: ['Next Month', '8', '€420k', '60%'] },
          { cols: ['Q1 2025', '12', '€680k', '40%'] }
        ]
        
        // VISUAL DEBUG: Show that this section is being rendered
        pdf.setTextColor(255, 0, 0)
        pdf.setFontSize(8)
        pdf.text(`RENDERING: Pipeline by Closing Date at Y=${currentY}`, startX, currentY - 5)
        
        addDataTable(startX, currentY, LAYOUT.contentWidth, closingDateData, 'Pipeline by Closing Date')
        currentY += 80 // Increase spacing
      }

      // CONDITIONAL: Deal Sources - FIX THE LOGIC  
      if (config.salesCards?.dealSources) {
        const sourcesData = [
          { cols: ['Source', 'Deals', 'Value', 'Conversion Rate'] },
          { cols: ['Inbound', '15', '€520k', '45%'] },
          { cols: ['Referrals', '8', '€380k', '65%'] },
          { cols: ['Outbound', '11', '€300k', '25%'] }
        ]
        
        // VISUAL DEBUG: Show that this section is being rendered
        pdf.setTextColor(255, 0, 0)
        pdf.setFontSize(8)
        pdf.text(`RENDERING: Deal Sources at Y=${currentY}`, startX, currentY - 5)
        
        addDataTable(startX, currentY, LAYOUT.contentWidth, sourcesData, 'Deal Sources & Channels')
        currentY += 80
      }
    }

    // 5. CASH FLOW SLIDE - Layout A (Two Column) with CONDITIONAL CARD RENDERING
    if (config.includeCashFlow) {
      pdf.addPage()
      addSlideHeader('Cash Flow Analysis')
      
      // VISUAL DEBUG: Add page boundaries
      addPageBoundaryDebug()
      
      const startX = getContentStartX()
      const startY = getContentStartY()
      
      let currentY = startY
      let leftColumnUsed = false
      let rightColumnUsed = false

      // CONDITIONAL: Current Balance Card - FIX THE POSITIONING
      if (config.cashFlowCards?.currentBalance) {
        // VISUAL DEBUG: Show that this section is being rendered
        pdf.setTextColor(255, 0, 0)
        pdf.setFontSize(8)
        pdf.text(`RENDERING: Current Balance Card at X=${startX}, Y=${currentY}`, startX, currentY - 5)
        
        const balanceCard = {
          title: 'Current Balance',
          value: formatCurrency(metrics.cashBalance),
          color: metrics.cashBalance >= 0 ? [16, 185, 129] : [239, 68, 68],
          progress: 70,
          subtitle: 'Total cash on hand'
        }
        
        addMetricCard(startX, currentY, 120, 40, balanceCard)
        leftColumnUsed = true
      }

      // CONDITIONAL: Monthly Burn Rate Card (next to Current Balance) - FIX THE POSITIONING
      if (config.cashFlowCards?.monthlyBurnRate) {
        // VISUAL DEBUG: Show that this section is being rendered
        const burnX = leftColumnUsed ? startX + 130 : startX
        pdf.setTextColor(255, 0, 0)
        pdf.setFontSize(8)
        pdf.text(`RENDERING: Burn Rate Card at X=${burnX}, Y=${currentY}`, burnX, currentY - 5)
        
        const burnCard = {
          title: 'Monthly Burn Rate',
          value: `${formatCurrency(metrics.burnRate)}/mo`,
          color: metrics.burnRate > 0 ? [239, 68, 68] : [16, 185, 129],
          progress: 60,
          subtitle: 'Net monthly cash burn'
        }
        
        addMetricCard(burnX, currentY, 120, 40, burnCard)
        rightColumnUsed = true
      }

      // Move down if we rendered cards above
      if (leftColumnUsed || rightColumnUsed) {
        currentY += 60
      }

      // CONDITIONAL: Cash Runway Analysis
      if (config.cashFlowCards?.cashRunway) {
        const runway = metrics.burnRate > 0 ? Math.round(Math.abs(metrics.cashBalance) / metrics.burnRate) : 999
        
        // VISUAL DEBUG: Draw runway section boundary
        pdf.setDrawColor(255, 165, 0) // Orange
        pdf.setLineWidth(1)
        pdf.rect(startX, currentY, LAYOUT.layoutA.leftWidth, 80, 'S')
        
        pdf.setTextColor(51, 65, 85)
        pdf.setFontSize(14)
        pdf.setFont('helvetica', 'bold')
        pdf.text('Cash Runway Analysis', startX, currentY + 15)
        
        // Large runway display
        pdf.setTextColor(59, 130, 246)
        pdf.setFontSize(48)
        pdf.setFont('helvetica', 'bold')
        const runwayText = runway > 100 ? '∞' : runway.toString()
        const runwayX = startX + (LAYOUT.layoutA.leftWidth / 2)
        pdf.text(runwayText, runwayX, currentY + 50, { align: 'center' })
        
        pdf.setTextColor(107, 114, 128)
        pdf.setFontSize(16)
        pdf.setFont('helvetica', 'normal')
        pdf.text('Months Remaining', runwayX, currentY + 65, { align: 'center' })
        
        leftColumnUsed = true
      }

      // CONDITIONAL: Monthly Trend Table (right column)
      if (config.cashFlowCards?.monthlyTrend) {
        const rightX = startX + LAYOUT.layoutA.leftWidth + LAYOUT.gap
        
        // VISUAL DEBUG: Draw right column boundary
        pdf.setDrawColor(128, 0, 128) // Purple
        pdf.setLineWidth(1)
        pdf.rect(rightX, currentY, LAYOUT.layoutA.rightWidth, 80, 'S')
        
        const cashFlowData = [
          { cols: ['Month', 'Inflow', 'Outflow', 'Net Flow'] },
          { cols: ['Oct 2024', '€52.3k', '€61.2k', '-€8.9k'] },
          { cols: ['Nov 2024', '€58.7k', '€64.1k', '-€5.4k'] },
          { cols: ['Dec 2024', '€64.5k', '€48.9k', '+€15.6k'] }
        ]
        
        addDataTable(rightX, currentY, LAYOUT.layoutA.rightWidth, cashFlowData, 'Monthly Trend')
        rightColumnUsed = true
      }

      // Move down if we rendered runway or trend table
      if (leftColumnUsed || rightColumnUsed) {
        currentY += 90
      }

      // CONDITIONAL: Inflow/Outflow Breakdown - FIX THE LOGIC
      if (config.cashFlowCards?.inflowOutflowBreakdown) {
        // VISUAL DEBUG: Show that this section is being rendered
        pdf.setTextColor(255, 0, 0)
        pdf.setFontSize(8)
        pdf.text(`RENDERING: Inflow/Outflow Breakdown at Y=${currentY}`, startX, currentY - 5)
        
        const inflowOutflowData = [
          { cols: ['Category', 'Inflow', 'Outflow', 'Net'] },
          { cols: ['Operations', '€45k', '€38k', '+€7k'] },
          { cols: ['Investments', '€0', '€5k', '-€5k'] },
          { cols: ['Financing', '€10k', '€2k', '+€8k'] }
        ]
        
        addDataTable(startX, currentY, LAYOUT.contentWidth, inflowOutflowData, 'Inflow/Outflow Breakdown')
        currentY += 80 // Increase spacing
      }

      // Bottom insights - only if we have any cash flow content
      const hasAnyCashFlowContent = config.cashFlowCards?.currentBalance || 
                                   config.cashFlowCards?.monthlyBurnRate || 
                                   config.cashFlowCards?.cashRunway || 
                                   config.cashFlowCards?.monthlyTrend || 
                                   config.cashFlowCards?.inflowOutflowBreakdown

      if (hasAnyCashFlowContent) {
        const runway = metrics.burnRate > 0 ? Math.round(Math.abs(metrics.cashBalance) / metrics.burnRate) : 999
        const insightsHeight = 40
        addInsightsBox(startX, currentY, LAYOUT.contentWidth, insightsHeight, `Improving cash flow trend with ${runway} months runway. December shows positive cash generation.`)
      }
    }

    // Save the PDF
    const fileName = `${config.companyName.replace(/\s+/g, '_')}_Report_${new Date().toISOString().split('T')[0]}.pdf`
    pdf.save(fileName)
    
    console.log('✅ PDF generated successfully with standardized layouts!')

  } catch (error) {
    console.error('❌ PDF generation failed:', error)
    throw error
  }
}