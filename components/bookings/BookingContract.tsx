'use client'

export interface InvoiceItem {
  id?: string
  description: string
  quantity: number
  rate?: number
  amount?: number
}

export interface InvoiceOptions {
  items: InvoiceItem[]
  discountType?: 'amount' | 'percent'
  discountValue?: number
  gstType?: 'amount' | 'percent'
  gstValue?: number
}

const formatIndianDate = (dateStr: string) => {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  const year = parseInt(parts[0], 10)
  const monthIdx = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${day} ${months[monthIdx]} ${year}`
}

const format12HourTime = (timeStr: string | null | undefined) => {
  if (!timeStr) return ''
  const parts = timeStr.split(':')
  if (parts.length < 2) return timeStr
  let hour = parseInt(parts[0], 10)
  const minute = parts[1]
  const period = hour >= 12 ? 'PM' : 'AM'
  if (hour > 12) hour -= 12
  if (hour === 0) hour = 12
  return `${hour}:${minute} ${period}`
}

// Calculate estimated vertical height (in px) for an item row in the invoice table
const estimateItemRowHeight = (item: InvoiceItem): number => {
  const desc = item.description || ''
  const lineCount = Math.max(1, Math.ceil(desc.length / 48))
  return 20 + lineCount * 14
}

interface PageChunk {
  items: InvoiceItem[]
  showFullHeader: boolean
  showSummaryAndFooter: boolean
}

export async function downloadBookingPDF(booking: any, profile: any, options?: InvoiceOptions) {
  if (typeof window === 'undefined') return

  // Dynamically load libraries to prevent Next.js SSR build errors
  const html2canvas = (await import('html2canvas')).default
  const { jsPDF } = await import('jspdf')

  // Fetch full profile and auth metadata for additional branding assets
  const { createClient } = await import('@/lib/supabase/client')
  const supabase = createClient()

  let fullProfile = profile
  let meta: any = {}
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      meta = user.user_metadata || {}
      const { data: dbProfile } = await supabase
        .from('profiles')
        .select('business_name, business_address, gst_number, business_logo_url')
        .eq('id', user.id)
        .maybeSingle()
      if (dbProfile) {
        fullProfile = dbProfile
      }
    }
  } catch (err) {
    console.error('Failed to resolve full user metadata details', err)
  }

  const safeBusinessName = fullProfile?.business_name || 'My Business'
  const safeBusinessAddress = fullProfile?.business_address || ''
  const safeGstNumber = fullProfile?.gst_number || ''
  const logoUrl = fullProfile?.business_logo_url || ''

  const ownerName = meta.owner_name || ''
  const mobile = meta.mobile || ''
  const email = meta.email || ''
  const website = meta.website || ''
  const city = meta.city || ''
  const stateName = meta.state || ''
  const pincode = meta.pincode || ''

  const invoicePrefix = meta.invoice_prefix || 'INV'
  const invoiceFooter = meta.invoice_footer || '1. All payments must be validated with authorized signature.\n2. The advance booking amount is non-refundable.'
  const qrUrl = meta.qr_code_url && !meta.qr_code_url.startsWith('data:') ? meta.qr_code_url : ''
  const signatureUrl = meta.signature_url && !meta.signature_url.startsWith('data:') ? meta.signature_url : ''

  // Format date and timing strings
  const formattedDate = formatIndianDate(booking.event_date)
  const formattedTime = booking.start_time && booking.end_time
    ? `${format12HourTime(booking.start_time)} - ${format12HourTime(booking.end_time)}`
    : 'Time not specified'

  // 1. Resolve booking total & advance paid (booking.total_price is single source of truth)
  const bookingTotal = Math.max(0, 
    Number(booking.total_amount) || 
    Number(booking.total_price) || 
    Number(booking.total_cost) || 
    Number(booking.total) || 
    Number(booking.amount) || 
    0
  )

  const advancePaid = Math.max(0, 
    Number(booking.advance_amount) || 
    Number(booking.advance_paid) || 
    Number(booking.advance) || 
    0
  )

  // 2. Load reference equipment/service items (no rates/amounts)
  const rawItems = options?.items && Array.isArray(options.items) && options.items.length > 0
    ? options.items
    : (Array.isArray(booking.items) && booking.items.length > 0 ? booking.items : [])

  let items: InvoiceItem[] = []
  if (rawItems.length > 0) {
    items = rawItems.map((it: any) => ({
      description: it.description || it.name || it.item_name || 'Service',
      quantity: Math.max(1, Number(it.quantity) || Number(it.qty) || 1)
    }))
  } else {
    items = [
      {
        description: booking.program_name_snapshot || booking.program_name || booking.service || 'General Event Service',
        quantity: 1
      }
    ]
  }

  // 3. Billing calculation using bookingTotal as single source of truth
  let discount = 0
  if (options?.discountType === 'percent') {
    discount = bookingTotal * ((Number(options.discountValue) || 0) / 100)
  } else {
    discount = Number(options?.discountValue) || 0
  }
  discount = Math.max(0, Math.min(bookingTotal, discount))

  const subTotalAfterDiscount = Math.max(0, bookingTotal - discount)

  let gst = 0
  if (options?.gstType === 'percent') {
    gst = subTotalAfterDiscount * ((Number(options.gstValue) || 0) / 100)
  } else {
    gst = Number(options?.gstValue) || 0
  }
  gst = Math.max(0, gst)

  const grandTotal = subTotalAfterDiscount + gst
  const balanceDue = grandTotal - advancePaid

  // Payment Status Badge Logic
  let statusLabel = 'PAYMENT PENDING'
  let statusColor = '#ef4444' // red
  let statusBg = '#fee2e2'

  if (balanceDue <= 0) {
    statusLabel = 'PAID IN FULL'
    statusColor = '#10b981' // green
    statusBg = '#d1fae5'
  } else if (advancePaid > 0) {
    statusLabel = 'PARTIALLY PAID'
    statusColor = '#f59e0b' // amber
    statusBg = '#fef3c7'
  }

  // Dynamic multi-page smart chunking algorithm based on estimated layout heights
  const buildPageChunks = (allItems: InvoiceItem[], venueLength: number = 0): PageChunk[] => {
    if (!allItems || allItems.length === 0) {
      return [{ items: [], showFullHeader: true, showSummaryAndFooter: true }]
    }

    const venueExtraLines = Math.max(0, Math.ceil(venueLength / 38) - 1)
    const page1HeaderHeight = 290 + venueExtraLines * 16

    const SUMMARY_FOOTER_HEIGHT = 380
    const CONTINUATION_FOOTER_HEIGHT = 35
    const CONTINUATION_HEADER_HEIGHT = 75

    const page1SingleMaxTable = Math.max(150, 1059 - page1HeaderHeight - SUMMARY_FOOTER_HEIGHT)
    const page1MultiMaxTable = Math.max(250, 1059 - page1HeaderHeight - CONTINUATION_FOOTER_HEIGHT)

    const middleMaxTable = 1059 - CONTINUATION_HEADER_HEIGHT - CONTINUATION_FOOTER_HEIGHT
    const lastMaxTableWithSummary = 1059 - CONTINUATION_HEADER_HEIGHT - SUMMARY_FOOTER_HEIGHT

    const totalItemsHeight = allItems.reduce((sum, item) => sum + estimateItemRowHeight(item), 0)

    if (totalItemsHeight <= page1SingleMaxTable) {
      return [{ items: allItems, showFullHeader: true, showSummaryAndFooter: true }]
    }

    const pageChunks: PageChunk[] = []
    let currentIndex = 0

    // Page 1 chunk
    const p1Items: InvoiceItem[] = []
    let p1Height = 0
    while (currentIndex < allItems.length) {
      const item = allItems[currentIndex]
      const h = estimateItemRowHeight(item)
      if (p1Items.length > 0 && p1Height + h > page1MultiMaxTable) {
        break
      }
      p1Items.push(item)
      p1Height += h
      currentIndex++
    }
    pageChunks.push({ items: p1Items, showFullHeader: true, showSummaryAndFooter: false })

    // Subsequent page chunks
    while (currentIndex < allItems.length) {
      let remainingHeight = 0
      for (let i = currentIndex; i < allItems.length; i++) {
        remainingHeight += estimateItemRowHeight(allItems[i])
      }

      if (remainingHeight <= lastMaxTableWithSummary) {
        pageChunks.push({
          items: allItems.slice(currentIndex),
          showFullHeader: false,
          showSummaryAndFooter: true
        })
        currentIndex = allItems.length
        break
      } else if (remainingHeight <= middleMaxTable) {
        pageChunks.push({
          items: allItems.slice(currentIndex),
          showFullHeader: false,
          showSummaryAndFooter: false
        })
        currentIndex = allItems.length

        // Dedicated Final Summary Page
        pageChunks.push({
          items: [],
          showFullHeader: false,
          showSummaryAndFooter: true
        })
        break
      } else {
        const midItems: InvoiceItem[] = []
        let midHeight = 0
        while (currentIndex < allItems.length) {
          const item = allItems[currentIndex]
          const h = estimateItemRowHeight(item)
          if (midItems.length > 0 && midHeight + h > middleMaxTable) {
            break
          }
          midItems.push(item)
          midHeight += h
          currentIndex++
        }
        pageChunks.push({
          items: midItems,
          showFullHeader: false,
          showSummaryAndFooter: false
        })
      }
    }

    return pageChunks
  }

  const itemChunks = buildPageChunks(items, (booking.venue_address || '').length)
  const totalPages = itemChunks.length
  const createdElements: HTMLDivElement[] = []

  let itemCounter = 0

  itemChunks.forEach((chunkInfo, pageIndex) => {
    const isFirstPage = chunkInfo.showFullHeader
    const isLastPage = chunkInfo.showSummaryAndFooter
    const chunkItems = chunkInfo.items

    const pageEl = document.createElement('div')
    pageEl.style.position = 'absolute'
    pageEl.style.left = '-9999px'
    pageEl.style.top = '0'
    pageEl.style.width = '794px'
    pageEl.style.height = '1123px'
    pageEl.style.backgroundColor = '#ffffff'
    pageEl.style.color = '#334155'
    pageEl.style.boxSizing = 'border-box'

    const rowsHtml = chunkItems.map((item, idx) => {
      const sNo = itemCounter + idx + 1
      return `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 9px 12px; text-align: center; color: #475569; font-weight: 600; font-size: 10px; width: 55px; border-right: 1px solid #e2e8f0;">${sNo}</td>
          <td style="padding: 9px 12px; color: #0f172a; font-weight: 600; font-size: 10px; border-right: 1px solid #e2e8f0; word-break: break-word;">
            <div>${item.description}</div>
          </td>
          <td style="padding: 9px 12px; text-align: center; color: #0f172a; font-weight: 700; font-size: 10px; width: 90px;">${item.quantity}</td>
        </tr>
      `
    }).join('')

    itemCounter += chunkItems.length

    let topSectionHtml = ''
    if (isFirstPage) {
      topSectionHtml = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 16px;">
          <div style="display: flex; gap: 14px; align-items: center; max-width: 65%;">
            ${logoUrl ? `
              <img src="${logoUrl}" style="max-height: 65px; max-width: 120px; object-fit: contain; border-radius: 6px; border: 1px solid #e2e8f0; padding: 2px;" />
            ` : `
              <div style="width: 48px; height: 48px; background: #4f46e5; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.15);">${safeBusinessName[0].toUpperCase()}</div>
            `}
            <div style="font-size: 10px; color: #475569; line-height: 1.4;">
              <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 2px 0; letter-spacing: -0.02em;">${safeBusinessName}</h2>
              ${ownerName ? `<p style="margin: 0; font-weight: 600; color: #334155;">Proprietor: ${ownerName}</p>` : ''}
              ${safeBusinessAddress ? `<p style="margin: 0; color: #64748b;">${safeBusinessAddress}${city ? `, ${city}` : ''}${stateName ? `, ${stateName}` : ''}${pincode ? ` - ${pincode}` : ''}</p>` : ''}
              <div style="margin-top: 2px; display: flex; flex-wrap: wrap; gap: 8px; color: #64748b;">
                ${mobile ? `<span>📞 ${mobile}</span>` : ''}
                ${email ? `<span>✉️ ${email}</span>` : ''}
                ${website ? `<span>🌐 ${website}</span>` : ''}
              </div>
              ${safeGstNumber ? `<div style="margin-top: 3px;"><span style="display: inline-block; background-color: #f1f5f9; color: #2563eb; font-weight: 700; font-size: 9px; padding: 1px 5px; border-radius: 4px; border: 1px solid #cbd5e1; text-transform: uppercase;">GSTIN: ${safeGstNumber}</span></div>` : ''}
            </div>
          </div>

          <div style="text-align: right; min-width: 30%;">
            <h1 style="font-size: 22px; font-weight: 900; color: #4f46e5; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">TAX INVOICE</h1>
            <div style="font-size: 10px; color: #475569; line-height: 1.5;">
              <div><strong style="color: #0f172a;">Invoice No:</strong> ${invoicePrefix}-${(booking.id || '').substring(0, 6).toUpperCase()}</div>
              <div><strong style="color: #0f172a;">Date:</strong> ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
              <div><strong style="color: #0f172a;">Booking Ref:</strong> #${(booking.id || '').substring(0, 8).toUpperCase()}</div>
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; gap: 14px; margin-bottom: 16px; align-items: stretch;">
          <div style="width: 48.5%; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; background-color: #f8fafc; box-sizing: border-box;">
            <h4 style="font-size: 9px; font-weight: 800; color: #64748b; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 3px;">BILL TO</h4>
            <div style="font-size: 10px; line-height: 1.5; color: #334155;">
              <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 2px; word-break: break-word;">${booking.customer_name || ''}</div>
              <div><strong>Phone:</strong> ${booking.mobile_number || ''}</div>
              <div><strong>Logged Date:</strong> ${new Date(booking.created_at || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            </div>
          </div>

          <div style="width: 48.5%; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; background-color: #f8fafc; box-sizing: border-box;">
            <h4 style="font-size: 9px; font-weight: 800; color: #64748b; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 3px;">EVENT SUMMARY</h4>
            <div style="font-size: 10px; line-height: 1.5; color: #334155;">
              <div><strong>Event Date:</strong> <span style="font-weight: 600; color: #0f172a;">${formattedDate}</span></div>
              <div><strong>Timings:</strong> ${formattedTime}</div>
              <div style="word-break: break-word;"><strong>Service:</strong> <span style="font-weight: 600; color: #4f46e5;">${booking.program_name_snapshot || 'General Event'}</span></div>
              ${booking.venue_address ? `<div style="word-break: break-word; white-space: normal; line-height: 1.4;"><strong>Venue:</strong> ${booking.venue_address}</div>` : ''}
            </div>
          </div>
        </div>
      `
    } else {
      topSectionHtml = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 14px;">
          <div>
            <h3 style="font-size: 15px; font-weight: 800; color: #0f172a; margin: 0;">${safeBusinessName}</h3>
            <span style="font-size: 8px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">TAX INVOICE CONTINUATION — PAGE ${pageIndex + 1} OF ${totalPages}</span>
          </div>
          <div style="text-align: right; font-size: 10px; color: #475569;">
            <strong style="color: #4f46e5;">Invoice No:</strong> ${invoicePrefix}-${(booking.id || '').substring(0, 6).toUpperCase()}
          </div>
        </div>
      `
    }

    let bottomSectionHtml = ''
    if (isLastPage) {
      bottomSectionHtml = `
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; margin-top: 12px; margin-bottom: 12px;">
            <div style="flex: 1; display: flex; align-items: center; justify-content: center; height: 135px; border-radius: 8px; background: ${statusBg}; border: 1px solid ${statusColor}40;">
              <div style="text-align: center; color: ${statusColor};">
                <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.85;">Payment Status</div>
                <div style="font-size: 18px; font-weight: 900; letter-spacing: 0.5px; margin-top: 4px;">${statusLabel}</div>
              </div>
            </div>

            <div style="width: 52%; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              <div style="display: flex; justify-content: space-between; padding: 7px 12px; border-bottom: 1px solid #f1f5f9; font-size: 10px; color: #475569;">
                <span>Total Event Amount:</span>
                <span style="font-weight: 700; color: #0f172a;">₹${bookingTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              ${discount > 0 ? `
              <div style="display: flex; justify-content: space-between; padding: 6px 12px; border-bottom: 1px solid #f1f5f9; font-size: 10px; color: #ef4444;">
                <span>Discount ${options?.discountType === 'percent' ? `(${options.discountValue}%)` : ''}:</span>
                <span style="font-weight: 700;">- ₹${discount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              ` : ''}
              ${gst > 0 ? `
              <div style="display: flex; justify-content: space-between; padding: 6px 12px; border-bottom: 1px solid #f1f5f9; font-size: 10px; color: #2563eb;">
                <span>GST Tax ${options?.gstType === 'percent' ? `(${options.gstValue}%)` : ''}:</span>
                <span style="font-weight: 700;">+ ₹${gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 11px; font-weight: 800; color: #0f172a; background-color: #f8fafc;">
                <span>Grand Total:</span>
                <span>₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 7px 12px; border-bottom: 1px solid #f1f5f9; font-size: 10px; color: #475569;">
                <span>Advance Paid:</span>
                <span style="font-weight: 700; color: #10b981;">₹${advancePaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 9px 12px; font-size: 12px; font-weight: 800; color: #ffffff; background-color: ${balanceDue > 0 ? '#4f46e5' : '#059669'};">
                <span>Balance Due:</span>
                <span>₹${(balanceDue > 0 ? balanceDue : 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          ${booking.notes ? `
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; margin-bottom: 12px; font-size: 9px; box-sizing: border-box;">
            <h5 style="margin: 0 0 3px 0; font-weight: bold; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 2px;">Special Instructions</h5>
            <p style="margin: 0; color: #475569; line-height: 1.4; white-space: pre-line;">${booking.notes}</p>
          </div>
          ` : ''}

          <div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; border-top: 1px solid #e2e8f0; padding-top: 12px; margin-bottom: 12px;">
            <div style="width: 55%; display: flex; flex-direction: column; gap: 6px;">
              <div style="font-size: 8.5px; color: #64748b; line-height: 1.4;">
                <h5 style="margin: 0 0 3px 0; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Terms & Conditions</h5>
                <p style="margin: 0; white-space: pre-line;">${invoiceFooter}</p>
              </div>
              
              ${qrUrl ? `
                <div style="display: flex; gap: 8px; align-items: center;">
                  <img src="${qrUrl}" style="width: 50px; height: 50px; border: 1px solid #e2e8f0; border-radius: 4px; padding: 2px;" />
                  <span style="font-size: 8px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Scan to Pay via UPI</span>
                </div>
              ` : ''}
            </div>

            <div style="width: 38%; display: flex; flex-direction: column; align-items: flex-end; text-align: right; gap: 3px;">
              ${signatureUrl ? `
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                  <img src="${signatureUrl}" style="height: 38px; max-width: 120px; object-fit: contain; margin-bottom: 2px;" />
                  <span style="font-size: 8px; color: #94a3b8; font-style: italic;">Authorized Stamp/Seal</span>
                </div>
              ` : `
                <div style="height: 38px;"></div>
              `}
              <div style="border-top: 1px solid #cbd5e1; margin-top: 4px; width: 100%;"></div>
              <span style="font-size: 8px; color: #475569; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; display: block;">Authorized Signatory</span>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 6px;">
            <span>Thank you for your business! ${totalPages > 1 ? `(Page ${pageIndex + 1} of ${totalPages})` : ''}</span>
            <span style="font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.05em;">Generated by Smart Booking Pro</span>
          </div>
        </div>
      `
    } else {
      bottomSectionHtml = `
        <div style="border-top: 1px solid #e2e8f0; padding-top: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #64748b;">
          <span style="font-style: italic; font-weight: 600; color: #4f46e5;">Continued on Page ${pageIndex + 2}...</span>
          <span style="font-weight: 700; color: #94a3b8;">Page ${pageIndex + 1} of ${totalPages}</span>
        </div>
      `
    }

    const tableHtml = chunkItems.length > 0 ? `
      <div style="margin-bottom: 6px; font-weight: 800; font-size: 9px; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.8px;">
        Included Services & Equipment Reference List
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
        <thead>
          <tr style="background: #0f172a; color: #ffffff;">
            <th style="padding: 8px 12px; text-align: center; font-weight: 700; text-transform: uppercase; font-size: 9px; width: 55px; border-right: 1px solid #334155;">S.No</th>
            <th style="padding: 8px 12px; text-align: left; font-weight: 700; text-transform: uppercase; font-size: 9px; border-right: 1px solid #334155;">Item Description</th>
            <th style="padding: 8px 12px; text-align: center; font-weight: 700; text-transform: uppercase; font-size: 9px; width: 90px;">Quantity</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    ` : `
      <div style="font-weight: 800; font-size: 10px; color: #4f46e5; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">CONTRACT SUMMARY & PAYMENT DETAILS</div>
    `

    pageEl.innerHTML = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 32px 36px; color: #1e293b; background: #ffffff; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          ${topSectionHtml}
          ${tableHtml}
        </div>

        ${bottomSectionHtml}
      </div>
    `

    document.body.appendChild(pageEl)
    createdElements.push(pageEl)
  })

  try {
    const pdf = new jsPDF('p', 'pt', 'a4')

    for (let i = 0; i < createdElements.length; i++) {
      const pageEl = createdElements[i]
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      })
      const imgData = canvas.toDataURL('image/png')

      if (i > 0) pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, 0, 595.28, 841.89)
    }

    pdf.save(`Invoice_${(booking.customer_name || 'Booking').replace(/\s+/g, '_')}_${booking.id.substring(0, 6).toUpperCase()}.pdf`)
  } catch (err) {
    console.error('jsPDF generation error:', err)
    throw err
  } finally {
    createdElements.forEach(el => {
      if (document.body.contains(el)) {
        document.body.removeChild(el)
      }
    })
  }
}

export async function downloadBookingsListPDF(bookings: any[], profile: any) {
  if (typeof window === 'undefined') return

  const html2canvas = (await import('html2canvas')).default
  const { jsPDF } = await import('jspdf')
  
  const safeBusinessName = profile?.business_name || 'My Business'
  const safeBusinessAddress = profile?.business_address || ''
  
  // Calculate summary metrics
  const activeBookings = bookings.filter(b => b.status !== 'cancelled')
  const totalBookings = bookings.length
  const totalRevenue = activeBookings.reduce((sum, b) => sum + Number(b.total_amount || 0), 0)
  const totalAdvance = activeBookings.reduce((sum, b) => sum + Number(b.advance_amount || 0), 0)
  const totalDues = activeBookings.reduce((sum, b) => sum + Number(b.remaining_amount || 0), 0)

  const element = document.createElement('div')
  element.style.position = 'absolute'
  element.style.left = '-9999px'
  element.style.top = '0'
  element.style.width = '800px'
  element.style.backgroundColor = '#ffffff'
  element.style.color = '#334155'
  element.style.boxSizing = 'border-box'

  let rowsHtml = ''
  bookings.forEach((b) => {
    const remaining = Number(b.remaining_amount) || 0
    let dueStyle = 'color: #10b981; font-weight: 700;'
    let dueLabel = 'Paid'
    if (remaining > 0) {
      dueStyle = 'color: #f59e0b; font-weight: 700;'
      dueLabel = `₹${remaining.toLocaleString('en-IN')}`
    }
    
    let statusBg = '#fee2e2'
    let statusColor = '#ef4444'
    if (b.status === 'confirmed') {
      statusBg = '#d1fae5'
      statusColor = '#10b981'
    } else if (b.status === 'completed') {
      statusBg = '#e0e7ff'
      statusColor = '#4f46e5'
    } else if (b.status === 'pending') {
      statusBg = '#fef3c7'
      statusColor = '#d97706'
    }

    rowsHtml += `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 10px;">
        <td style="padding: 10px 8px; font-weight: 600; color: #0f172a;">
          <div>${b.customer_name}</div>
          <div style="font-size: 8px; color: #64748b; font-weight: normal; margin-top: 2px;">${b.mobile_number}</div>
        </td>
        <td style="padding: 10px 8px; color: #334155;">${formatIndianDate(b.event_date)}</td>
        <td style="padding: 10px 8px; color: #4f46e5; font-weight: 600;">${b.program_name_snapshot || 'General'}</td>
        <td style="padding: 10px 8px; text-align: right; font-weight: 600;">₹${(Number(b.total_amount) || 0).toLocaleString('en-IN')}</td>
        <td style="padding: 10px 8px; text-align: right; color: #10b981;">₹${(Number(b.advance_amount) || 0).toLocaleString('en-IN')}</td>
        <td style="padding: 10px 8px; text-align: right; ${dueStyle}">${dueLabel}</td>
        <td style="padding: 10px 8px; text-align: center;">
          <span style="background-color: ${statusBg}; color: ${statusColor}; padding: 3px 8px; border-radius: 9999px; font-size: 8px; font-weight: 700; text-transform: uppercase;">
            ${b.status}
          </span>
        </td>
      </tr>
    `
  })

  element.innerHTML = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; background: #ffffff; min-height: 1120px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 20px;">
          <div>
            <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">${safeBusinessName}</h2>
            ${safeBusinessAddress ? `<p style="margin: 0; font-size: 11px; color: #64748b;">${safeBusinessAddress}</p>` : ''}
            <p style="margin: 4px 0 0 0; font-size: 10px; color: #94a3b8; font-weight: 600;">BOOKINGS SUMMARY REPORT</p>
          </div>
          <div style="text-align: right;">
            <h1 style="font-size: 18px; font-weight: 900; color: #4f46e5; margin: 0 0 4px 0;">REPORT</h1>
            <p style="margin: 0; font-size: 10px; color: #64748b;">Generated: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
        </div>

        <!-- Metrics cards -->
        <div style="display: flex; gap: 12px; margin-bottom: 24px; box-sizing: border-box;">
          <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; background-color: #f8fafc; text-align: center;">
            <div style="font-size: 8px; font-weight: bold; color: #64748b; text-transform: uppercase;">Total Bookings</div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 4px;">${totalBookings}</div>
          </div>
          <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; background-color: #f8fafc; text-align: center;">
            <div style="font-size: 8px; font-weight: bold; color: #64748b; text-transform: uppercase;">Total Revenue</div>
            <div style="font-size: 16px; font-weight: 800; color: #4f46e5; margin-top: 4px;">₹${totalRevenue.toLocaleString('en-IN')}</div>
          </div>
          <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; background-color: #f8fafc; text-align: center;">
            <div style="font-size: 8px; font-weight: bold; color: #64748b; text-transform: uppercase;">Total Collected</div>
            <div style="font-size: 16px; font-weight: 800; color: #10b981; margin-top: 4px;">₹${totalAdvance.toLocaleString('en-IN')}</div>
          </div>
          <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; background-color: #f8fafc; text-align: center;">
            <div style="font-size: 8px; font-weight: bold; color: #64748b; text-transform: uppercase;">Outstanding Dues</div>
            <div style="font-size: 16px; font-weight: 800; color: #f59e0b; margin-top: 4px;">₹${totalDues.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <!-- Table -->
        <table style="width: 100%; border-collapse: collapse; box-sizing: border-box;">
          <thead>
            <tr style="background: #0f172a; color: #ffffff; font-size: 9px; text-transform: uppercase; font-weight: 700;">
              <th style="padding: 10px 8px; text-align: left;">Client Details</th>
              <th style="padding: 10px 8px; text-align: left;">Date</th>
              <th style="padding: 10px 8px; text-align: left;">Program</th>
              <th style="padding: 10px 8px; text-align: right; width: 90px;">Total</th>
              <th style="padding: 10px 8px; text-align: right; width: 90px;">Advance</th>
              <th style="padding: 10px 8px; text-align: right; width: 90px;">Balance</th>
              <th style="padding: 10px 8px; text-align: center; width: 90px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <!-- Footer -->
      <div style="border-top: 1px solid #f1f5f9; padding-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #94a3b8;">
        <span>This report compiles live database transaction logs.</span>
        <span style="font-weight: 700; color: #4f46e5; text-transform: uppercase; tracking-wider: 0.05em;">Generated by Smart Booking Pro</span>
      </div>
    </div>
  `

  document.body.appendChild(element)

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    })
    const imgData = canvas.toDataURL('image/png')

    const pdf = new jsPDF('p', 'pt', 'a4')
    const imgWidth = 595.28
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
    pdf.save(`Bookings_Report_${new Date().toISOString().split('T')[0]}.pdf`)
  } catch (err) {
    console.error('jsPDF list generation error:', err)
    throw err
  } finally {
    document.body.removeChild(element)
  }
}

export default function BookingContractPlaceholder() {
  return null
}
