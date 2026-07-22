'use client'

import React, { useState, useEffect } from 'react'
import { X, Plus, Trash2, FileDown, Calculator, Sparkles, Tag, Receipt } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { downloadBookingPDF, InvoiceItem, InvoiceOptions } from './BookingContract'

interface InvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  booking: any
  profile: any
}

export default function InvoiceModal({ isOpen, onClose, booking, profile }: InvoiceModalProps) {
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount')
  const [discountValue, setDiscountValue] = useState<number>(0)
  const [gstType, setGstType] = useState<'amount' | 'percent'>('percent')
  const [gstValue, setGstValue] = useState<number>(0)
  const [isGenerating, setIsGenerating] = useState<boolean>(false)

  useEffect(() => {
    if (booking && isOpen) {
      if (Array.isArray(booking.items) && booking.items.length > 0) {
        setItems(booking.items)
      } else {
        const initialRate = Number(booking.total_amount) || 0
        setItems([
          {
            id: '1',
            description: booking.program_name_snapshot || 'General Event Service',
            quantity: 1,
            rate: initialRate,
            amount: initialRate
          }
        ])
      }
      setDiscountType('amount')
      setDiscountValue(0)
      setGstType('percent')
      setGstValue(0)
    }
  }, [booking, isOpen])

  if (!isOpen || !booking) return null

  const handleItemChange = (index: number, field: keyof InvoiceItem, val: any) => {
    const updated = [...items]
    const current = { ...updated[index] }

    if (field === 'description') {
      current.description = String(val)
    } else if (field === 'quantity') {
      const q = val === '' ? 1 : Math.max(1, parseInt(val, 10) || 1)
      current.quantity = q
      current.amount = q * (Number(current.rate) || 0)
    } else if (field === 'rate') {
      const r = val === '' ? 0 : Math.max(0, parseFloat(val) || 0)
      current.rate = r
      current.amount = (Number(current.quantity) || 1) * r
    }

    updated[index] = current
    setItems(updated)
  }

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: String(Date.now()),
        description: '',
        quantity: 1,
        rate: 0,
        amount: 0
      }
    ])
  }

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.error('Invoice must contain at least one item.')
      return
    }
    const updated = items.filter((_, i) => i !== index)
    setItems(updated)
  }

  // Calculations
  const subTotal = items.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)

  let discountAmount = 0
  if (discountType === 'percent') {
    discountAmount = subTotal * ((Number(discountValue) || 0) / 100)
  } else {
    discountAmount = Number(discountValue) || 0
  }
  discountAmount = Math.max(0, Math.min(subTotal, discountAmount))

  const subTotalAfterDiscount = Math.max(0, subTotal - discountAmount)

  let gstAmount = 0
  if (gstType === 'percent') {
    gstAmount = subTotalAfterDiscount * ((Number(gstValue) || 0) / 100)
  } else {
    gstAmount = Number(gstValue) || 0
  }
  gstAmount = Math.max(0, gstAmount)

  const grandTotal = subTotalAfterDiscount + gstAmount
  const advancePaid = Number(booking.advance_amount) || 0
  const balanceDue = grandTotal - advancePaid

  const handleDownload = async () => {
    // Validate items
    const invalidItem = items.find(it => !it.description.trim())
    if (invalidItem) {
      toast.error('Please enter a description for all invoice items.')
      return
    }

    setIsGenerating(true)
    const options: InvoiceOptions = {
      items,
      discountType,
      discountValue: Number(discountValue) || 0,
      gstType,
      gstValue: Number(gstValue) || 0
    }

    try {
      await downloadBookingPDF(booking, profile, options)
      toast.success('PDF Invoice downloaded successfully!')
      onClose()
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate PDF invoice.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto select-none animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Receipt size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Itemized PDF Invoice Generator
              </h3>
              <p className="text-xs text-slate-400">
                Customer: <span className="text-white font-medium">{booking.customer_name}</span> ({booking.mobile_number}) • Ref: #{booking.id.substring(0, 6).toUpperCase()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-slate-300 custom-scrollbar">
          
          {/* Items Table Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles size={14} className="text-indigo-400" /> Invoice Items
              </h4>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <Plus size={14} /> Add Item
              </button>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/30">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 text-slate-400 uppercase font-bold border-b border-slate-800 text-[10px]">
                    <th className="py-3 px-3 text-center w-12">S.No</th>
                    <th className="py-3 px-3">Item Description</th>
                    <th className="py-3 px-3 text-center w-24">Quantity</th>
                    <th className="py-3 px-3 text-right w-32">Rate (₹)</th>
                    <th className="py-3 px-3 text-right w-36">Amount (₹)</th>
                    <th className="py-3 px-3 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {items.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-3 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          placeholder="e.g. Sound System & DJ Setup"
                          className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 outline-none transition-colors"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-lg px-2 py-1.5 text-xs text-white text-center outline-none transition-colors"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={item.rate}
                          onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                          className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-white text-right outline-none transition-colors"
                        />
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-white">
                        ₹{(item.amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Remove Item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Discount & GST Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Discount box */}
            <div className="bg-slate-950/40 border border-slate-800/80 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Tag size={13} className="text-emerald-400" /> Optional Discount
                </label>
                <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setDiscountType('amount')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${discountType === 'amount' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                  >
                    ₹ Amount
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('percent')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${discountType === 'percent' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                  >
                    % Percent
                  </button>
                </div>
              </div>
              <input
                type="number"
                min="0"
                value={discountValue || ''}
                onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                placeholder={discountType === 'amount' ? 'Discount amount in ₹' : 'Discount percentage e.g. 10'}
                className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white outline-none transition-colors"
              />
            </div>

            {/* GST Tax box */}
            <div className="bg-slate-950/40 border border-slate-800/80 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Calculator size={13} className="text-sky-400" /> Optional GST Tax
                </label>
                <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setGstType('percent')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${gstType === 'percent' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                  >
                    % GST Rate
                  </button>
                  <button
                    type="button"
                    onClick={() => setGstType('amount')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${gstType === 'amount' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                  >
                    ₹ Amount
                  </button>
                </div>
              </div>
              <input
                type="number"
                min="0"
                value={gstValue || ''}
                onChange={(e) => setGstValue(parseFloat(e.target.value) || 0)}
                placeholder={gstType === 'percent' ? 'e.g. 18 for 18% GST' : 'GST Amount in ₹'}
                className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white outline-none transition-colors"
              />
            </div>
          </div>

          {/* Calculations Summary Card */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between md:justify-start gap-6 text-slate-400">
                <span>Sub Total:</span>
                <span className="font-semibold text-white">₹{subTotal.toLocaleString('en-IN')}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between md:justify-start gap-6 text-rose-400">
                  <span>Discount:</span>
                  <span className="font-semibold">- ₹{discountAmount.toLocaleString('en-IN')}</span>
                </div>
              )}
              {gstAmount > 0 && (
                <div className="flex justify-between md:justify-start gap-6 text-sky-400">
                  <span>GST:</span>
                  <span className="font-semibold">+ ₹{gstAmount.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between md:justify-start gap-6 text-emerald-400">
                <span>Advance Paid:</span>
                <span className="font-semibold">₹{advancePaid.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="flex flex-col md:items-end border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-6">
              <div className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Grand Total</div>
              <div className="text-2xl font-extrabold text-white">₹{grandTotal.toLocaleString('en-IN')}</div>
              <div className="text-xs text-indigo-400 font-bold mt-0.5">
                Balance Due: ₹{(balanceDue > 0 ? balanceDue : 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={isGenerating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer"
          >
            <FileDown size={15} /> Generate & Download PDF
          </button>
        </div>

      </div>
    </div>
  )
}
