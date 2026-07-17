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

  const safeBusinessName = profile?.business_name || 'My Business'
  const safeBusinessAddress = profile?.business_address || ''
  const safeGstNumber = profile?.gst_number || ''

  const formattedDate = formatIndianDate(booking.event_date)
  const formattedTime = booking.start_time && booking.end_time
    ? `${format12HourTime(booking.start_time)} - ${format12HourTime(booking.end_time)}`
    : 'Time not specified'

  const element = document.createElement('div')
  element.style.position = 'absolute'
  element.style.left = '-9999px'
  element.style.top = '0'
  element.style.width = '800px'
  element.style.backgroundColor = '#ffffff'
  element.style.color = '#334155'
  element.style.padding = '40px'
  element.style.boxSizing = 'border-box'

  element.innerHTML = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #334155; background: #fff;">
      <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; align-items: flex-start;">
        <div>
          <h2 style="font-size: 24px; font-weight: bold; color: #4f46e5; margin: 0 0 5px 0;">${safeBusinessName}</h2>
          ${safeBusinessAddress ? `<p style="font-size: 10px; color: #64748b; margin: 2px 0;">${safeBusinessAddress}</p>` : ''}
          ${safeGstNumber ? `<p style="font-size: 10px; color: #64748b; margin: 2px 0;">GSTIN: ${safeGstNumber}</p>` : ''}
        </div>
        <div style="text-align: right;">
          <h3 style="font-size: 14px; font-weight: bold; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: 1.5px; background: #f8fafc; padding: 8px 12px; border-radius: 4px;">Booking Invoice</h3>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; margin-bottom: 35px;">
        <div style="width: 48%;">
          <h4 style="font-size: 11px; font-weight: bold; color: #4f46e5; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">Client Details</h4>
          <div style="font-size: 10px; line-height: 1.6;">
            <div style="margin-bottom: 4px;"><strong style="color: #64748b; width: 60px; display: inline-block;">Name:</strong> <span style="color: #1e293b; font-weight: 500;">${booking.customer_name || ''}</span></div>
            <div style="margin-bottom: 4px;"><strong style="color: #64748b; width: 60px; display: inline-block;">Mobile:</strong> <span style="color: #1e293b; font-weight: 500;">${booking.mobile_number || ''}</span></div>
          </div>
        </div>
        <div style="width: 48%;">
          <h4 style="font-size: 11px; font-weight: bold; color: #4f46e5; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">Event Details</h4>
          <div style="font-size: 10px; line-height: 1.6;">
            <div style="margin-bottom: 4px;"><strong style="color: #64748b; width: 60px; display: inline-block;">Date:</strong> <span style="color: #1e293b; font-weight: 500;">${formattedDate}</span></div>
            <div style="margin-bottom: 4px;"><strong style="color: #64748b; width: 60px; display: inline-block;">Time:</strong> <span style="color: #1e293b; font-weight: 500;">${formattedTime}</span></div>
            ${booking.venue_address ? `<div style="margin-bottom: 4px;"><strong style="color: #64748b; width: 60px; display: inline-block;">Venue:</strong> <span style="color: #1e293b; font-weight: 500;">${booking.venue_address}</span></div>` : ''}
          </div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 10px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
        <thead>
          <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
            <th style="padding: 12px 10px; text-align: left; font-weight: bold; color: #475569;">Program / Service Package Description</th>
            <th style="padding: 12px 10px; text-align: right; font-weight: bold; color: #475569; width: 150px;">Rate (INR)</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px 10px; color: #1e293b; font-weight: 500;">${booking.program_name_snapshot || 'General Event Service'}</td>
            <td style="padding: 12px 10px; text-align: right; color: #1e293b; font-weight: bold;">₹${(booking.total_amount || 0).toLocaleString('en-IN')}</td>
          </tr>
        </tbody>
      </table>

      <div style="display: flex; justify-content: flex-end; margin-bottom: 35px;">
        <div style="width: 45%; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-size: 10px; box-sizing: border-box;">
          <div style="display: flex; justify-content: space-between; padding: 4px 0; color: #64748b;">
            <span>Total Cost:</span>
            <span style="font-weight: bold; color: #1e293b;">₹${(booking.total_amount || 0).toLocaleString('en-IN')}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 4px 0; color: #64748b;">
            <span>Advance Paid:</span>
            <span style="font-weight: bold; color: #1e293b;">₹${(booking.advance_amount || 0).toLocaleString('en-IN')}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0 0 0; border-top: 1px solid #e2e8f0; margin-top: 6px; font-weight: bold; color: #4f46e5; font-size: 11px;">
            <span>Balance Due:</span>
            <span>₹${(booking.remaining_amount || 0).toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      ${booking.notes ? `
      <div style="background: #fafafa; border: 1px solid #f1f5f9; border-radius: 4px; padding: 12px; margin-bottom: 30px; font-size: 9px; box-sizing: border-box;">
        <h5 style="margin: 0 0 6px 0; font-weight: bold; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Event Notes & Requirements</h5>
        <p style="margin: 0; color: #334155; line-height: 1.5; white-space: pre-line;">${booking.notes}</p>
      </div>
      ` : ''}

      <div style="margin-top: 10px; margin-bottom: 40px; font-size: 8px; color: #94a3b8; line-height: 1.5;">
        <h5 style="margin: 0 0 6px 0; font-weight: bold; color: #475569; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px;">Standard Invoicing Terms & Conditions</h5>
        <p style="margin: 0 0 3px 0;">1. All payment receipts must be validated with authorized signatory.</p>
        <p style="margin: 0 0 3px 0;">2. The advance booking amount is non-refundable in the case of last-minute event cancellations.</p>
        <p style="margin: 0 0 3px 0;">3. Outstanding balance dues must be cleared on the event date before performance start.</p>
      </div>

      <div style="display: flex; justify-content: space-between; margin-top: 60px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
        <div style="width: 40%; text-align: center;">
          <div style="border-top: 1px solid #cbd5e1; margin-top: 40px; margin-bottom: 5px;"></div>
          <span style="font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Client Signature</span>
        </div>
        <div style="width: 40%; text-align: center;">
          <div style="border-top: 1px solid #cbd5e1; margin-top: 40px; margin-bottom: 5px;"></div>
          <span style="font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Authorized Signatory</span>
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
    pdf.save(`Contract_${(booking.customer_name || 'Booking').replace(/\s+/g, '_')}.pdf`)
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
