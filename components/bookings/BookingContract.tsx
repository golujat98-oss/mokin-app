'use client'

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

export async function downloadBookingPDF(booking: any, profile: any) {
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
  const qrUrl = meta.qr_code_url || ''
  const signatureUrl = meta.signature_url || ''

  // Format date and timing strings
  const formattedDate = formatIndianDate(booking.event_date)
  const formattedTime = booking.start_time && booking.end_time
    ? `${format12HourTime(booking.start_time)} - ${format12HourTime(booking.end_time)}`
    : 'Time not specified'

  // Payment Status Badge Logic
  const total = Number(booking.total_amount) || 0
  const advance = Number(booking.advance_amount) || 0
  const remaining = Number(booking.remaining_amount) || 0

  let statusLabel = 'PAYMENT PENDING'
  let statusColor = '#ef4444' // red
  let statusBg = '#fee2e2'

  if (remaining === 0) {
    statusLabel = 'PAID IN FULL'
    statusColor = '#10b981' // green
    statusBg = '#d1fae5'
  } else if (advance > 0) {
    statusLabel = 'PARTIALLY PAID'
    statusColor = '#f59e0b' // amber
    statusBg = '#fef3c7'
  }

  const element = document.createElement('div')
  element.style.position = 'absolute'
  element.style.left = '-9999px'
  element.style.top = '0'
  element.style.width = '800px'
  element.style.backgroundColor = '#ffffff'
  element.style.color = '#334155'
  element.style.boxSizing = 'border-box'

  element.innerHTML = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; background: #ffffff; min-height: 1120px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
      
      {/* Top Section */}
      <div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f1f5f9; padding-bottom: 24px; margin-bottom: 24px;">
          {/* Logo & Company details */}
          <div style="display: flex; gap: 16px; align-items: center; max-width: 65%;">
            ${logoUrl ? `
              <img src="${logoUrl}" style="max-height: 70px; max-width: 120px; object-fit: contain; border-radius: 8px; border: 1px solid #e2e8f0; padding: 2px;" />
            ` : `
              <div style="width: 55px; height: 55px; background: #4f46e5; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 22px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.15);">${safeBusinessName[0].toUpperCase()}</div>
            `}
            <div style="font-size: 11px; color: #475569; line-height: 1.5;">
              <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 3px 0; tracking-tight: -0.025em;">${safeBusinessName}</h2>
              ${ownerName ? `<p style="margin: 0; font-weight: 600; color: #334155;">Proprietor: ${ownerName}</p>` : ''}
              ${safeBusinessAddress ? `<p style="margin: 0; color: #64748b;">${safeBusinessAddress}${city ? `, ${city}` : ''}${stateName ? `, ${stateName}` : ''}${pincode ? ` - ${pincode}` : ''}</p>` : ''}
              <div style="margin-top: 3px; display: flex; flex-wrap: wrap; gap: 8px; color: #64748b;">
                ${mobile ? `<span>📞 ${mobile}</span>` : ''}
                ${email ? `<span>✉️ ${email}</span>` : ''}
                ${website ? `<span>🌐 ${website}</span>` : ''}
              </div>
              ${safeGstNumber ? `<p style="margin: 3px 0 0 0; font-weight: 700; color: #4f46e5; font-size: 10px; text-transform: uppercase;">GSTIN: ${safeGstNumber}</p>` : ''}
            </div>
          </div>

          {/* Invoice Header details */}
          <div style="text-align: right; min-width: 30%;">
            <h1 style="font-size: 22px; font-weight: 900; color: #4f46e5; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 0.5px;">INVOICE</h1>
            <div style="font-size: 11px; color: #475569; line-height: 1.6;">
              <div><strong style="color: #0f172a;">Invoice No:</strong> ${invoicePrefix}-${(booking.id || '').substring(0, 6).toUpperCase()}</div>
              <div><strong style="color: #0f172a;">Date:</strong> ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
              <div><strong style="color: #0f172a;">Booking Ref:</strong> #${(booking.id || '').substring(0, 8).toUpperCase()}</div>
            </div>
          </div>
        </div>

        {/* Client & Event Section */}
        <div style="display: flex; justify-content: space-between; gap: 20px; margin-bottom: 28px;">
          {/* Bill To */}
          <div style="width: 48%; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; background-color: #f8fafc;">
            <h4 style="font-size: 9px; font-weight: bold; color: #64748b; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px;">BILL TO</h4>
            <div style="font-size: 11px; line-height: 1.6; color: #334155;">
              <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">${booking.customer_name || ''}</div>
              <div><strong>Phone:</strong> ${booking.mobile_number || ''}</div>
              <div><strong>Logged Date:</strong> ${new Date(booking.created_at || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            </div>
          </div>

          {/* Event details */}
          <div style="width: 48%; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; background-color: #f8fafc;">
            <h4 style="font-size: 9px; font-weight: bold; color: #64748b; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px;">EVENT SUMMARY</h4>
            <div style="font-size: 11px; line-height: 1.6; color: #334155;">
              <div><strong>Event Date:</strong> <span style="font-weight: 600; color: #0f172a;">${formattedDate}</span></div>
              <div><strong>Timings:</strong> ${formattedTime}</div>
              <div><strong>Service:</strong> <span style="font-weight: 600; color: #4f46e5;">${booking.program_name_snapshot || 'General Event'}</span></div>
              ${booking.venue_address ? `<div style="text-overflow: ellipsis; white-space: nowrap; overflow: hidden;"><strong>Venue:</strong> ${booking.venue_address}</div>` : ''}
            </div>
          </div>
        </div>

        {/* Table of Services */}
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 11px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <thead>
            <tr style="background: #0f172a; color: #ffffff;">
              <th style="padding: 12px 16px; text-align: left; font-weight: 700; text-transform: uppercase; font-size: 9px;">Item Description</th>
              <th style="padding: 12px 16px; text-align: right; font-weight: 700; text-transform: uppercase; font-size: 9px; width: 180px;">Line Total (INR)</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background-color: #ffffff; border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 14px 16px; color: #0f172a; font-weight: 600;">
                <div>${booking.program_name_snapshot || 'General Event Service'}</div>
                <div style="font-size: 9px; color: #64748b; font-weight: normal; margin-top: 4px;">Service contract for event booked on ${formattedDate}</div>
              </td>
              <td style="padding: 14px 16px; text-align: right; color: #0f172a; font-weight: 700; font-size: 13px;">₹${(booking.total_amount || 0).toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>

        {/* Payment Summary Block & Ribbon */}
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 24px;">
          {/* Status stamp banner */}
          <div style="flex-1; display: flex; align-items: center; justify-content: center; height: 95px; border-radius: 12px; background: ${statusBg}; border: 1px solid ${statusColor}40;">
            <div style="text-align: center; color: ${statusColor};">
              <div style="font-size: 9px; font-weight: bold; text-transform: uppercase; tracking-wider: 0.1em; opacity: 0.85;">Payment Status</div>
              <div style="font-size: 18px; font-weight: 900; letter-spacing: 0.5px; margin-top: 4px;">${statusLabel}</div>
            </div>
          </div>

          {/* Totals Table */}
          <div style="width: 45%; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; background: #ffffff;">
            <div style="display: flex; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid #f1f5f9; font-size: 11px; color: #475569;">
              <span>Total Price:</span>
              <span style="font-weight: 700; color: #0f172a;">₹${(booking.total_amount || 0).toLocaleString('en-IN')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid #f1f5f9; font-size: 11px; color: #475569;">
              <span>Advance Paid:</span>
              <span style="font-weight: 700; color: #10b981;">₹${(booking.advance_amount || 0).toLocaleString('en-IN')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 12px 14px; font-size: 13px; font-weight: 800; color: #ffffff; background-color: #4f46e5;">
              <span>Balance Due:</span>
              <span>₹${(booking.remaining_amount || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Special Notes / Event Requirements */}
        ${booking.notes ? `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 24px; font-size: 10px; box-sizing: border-box;">
          <h5 style="margin: 0 0 6px 0; font-weight: bold; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px;">Special Instructions</h5>
          <p style="margin: 0; color: #475569; line-height: 1.6; white-space: pre-line;">${booking.notes}</p>
        </div>
        ` : ''}
      </div>

      {/* Bottom Section */}
      <div style="margin-top: auto;">
        {/* Terms & Assets Grid */}
        <div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; border-top: 1px solid #f1f5f9; padding-top: 20px; margin-bottom: 24px;">
          {/* Left: Terms & Conditions and QR */}
          <div style="width: 55%; display: flex; flex-direction: column; gap: 12px;">
            <div style="font-size: 9px; color: #64748b; line-height: 1.5;">
              <h5 style="margin: 0 0 6px 0; font-weight: bold; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Terms & Conditions</h5>
              <p style="margin: 0; white-space: pre-line;">${invoiceFooter}</p>
            </div>
            
            ${qrUrl ? `
              <div style="display: flex; gap: 10px; align-items: center;">
                <img src="${qrUrl}" style="width: 65px; height: 65px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 3px;" />
                <span style="font-size: 8px; color: #64748b; font-weight: 600; text-transform: uppercase; tracking-wider: 0.05em;">Scan to Pay via UPI</span>
              </div>
            ` : ''}
          </div>

          {/* Right: Signature Seal & Signed Box */}
          <div style="width: 35%; display: flex; flex-direction: column; align-items: flex-end; text-align: right; gap: 8px;">
            ${signatureUrl ? `
              <div style="display: flex; flex-direction: column; align-items: flex-end;">
                <img src="${signatureUrl}" style="height: 50px; max-width: 130px; object-fit: contain; margin-bottom: 4px;" />
                <span style="font-size: 8px; color: #94a3b8; font-style: italic; margin-right: 15px;">Authorized Stamp/Seal</span>
              </div>
            ` : `
              <div style="height: 50px;"></div>
            `}
            <div style="border-top: 1px solid #cbd5e1; margin-top: 6px; width: 100%;"></div>
            <span style="font-size: 8px; color: #475569; font-weight: bold; text-transform: uppercase; tracking-wider: 0.05em; display: block;">Authorized Signatory</span>
          </div>
        </div>

        {/* Bottom Bar branding */}
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 12px;">
          <span>Thank you for your business!</span>
          <span style="font-weight: 700; color: #4f46e5; text-transform: uppercase; tracking-wider: 0.05em;">Generated by Smart Booking Pro</span>
        </div>
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
    
    // A4 dimensions: 595.28 x 841.89 points
    const pdf = new jsPDF('p', 'pt', 'a4')
    const imgWidth = 595.28
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
    pdf.save(`Invoice_${(booking.customer_name || 'Booking').replace(/\s+/g, '_')}_${booking.id.substring(0, 6).toUpperCase()}.pdf`)
  } catch (err) {
    console.error('jsPDF generation error:', err)
    throw err
  } finally {
    document.body.removeChild(element)
  }
}

// Default export placeholder so it doesn't break page imports until page is modified
export default function BookingContractPlaceholder() {
  return null
}
