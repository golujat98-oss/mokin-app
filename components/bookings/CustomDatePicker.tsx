'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'

interface BookingDayInfo {
  event_date: string
  status: string
}

interface CustomDatePickerProps {
  value: string // YYYY-MM-DD
  onChange: (val: string) => void
  bookings?: BookingDayInfo[]
  placeholder?: string
}

export default function CustomDatePicker({
  value,
  onChange,
  bookings = [],
  placeholder = 'Select event date'
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Parse initial selected date
  const selectedDateObj = useMemo(() => {
    if (!value) return null
    const parts = value.split('-')
    if (parts.length !== 3) return null
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
  }, [value])

  // Calendar navigation state (month/year view)
  const [navDate, setNavDate] = useState(() => {
    if (selectedDateObj) {
      return new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), 1)
    }
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })

  // Synchronize navigation date if value changes
  useEffect(() => {
    if (selectedDateObj) {
      setNavDate(new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), 1))
    }
  }, [selectedDateObj])

  // Close calendar popover on outside click
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isOpen])

  // Get days in a month
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  // Get day of week for 1st day of month
  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay()
  }

  // Month navigation handlers
  const handlePrevMonth = () => {
    setNavDate(new Date(navDate.getFullYear(), navDate.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setNavDate(new Date(navDate.getFullYear(), navDate.getMonth() + 1, 1))
  }

  // Calendar grid math
  const gridCells = useMemo(() => {
    const year = navDate.getFullYear()
    const month = navDate.getMonth()

    const daysInMonth = getDaysInMonth(year, month)
    const firstDayIndex = getFirstDayOfMonth(year, month)

    const cells = []

    // Previous month padding cells
    const prevMonth = month - 1
    const prevMonthYear = prevMonth < 0 ? year - 1 : year
    const prevMonthIdx = prevMonth < 0 ? 11 : prevMonth
    const daysInPrevMonth = getDaysInMonth(prevMonthYear, prevMonthIdx)

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i
      const dateStr = `${prevMonthYear}-${String(prevMonthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      cells.push({ day, isCurrentMonth: false, dateStr })
    }

    // Current month cells
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      cells.push({ day, isCurrentMonth: true, dateStr })
    }

    // Next month padding cells
    const totalCells = Math.ceil(cells.length / 7) * 7
    const nextDaysNeeded = totalCells - cells.length
    const nextMonthVal = month + 1
    const nextMonthYear = nextMonthVal > 11 ? year + 1 : year
    const nextMonthIdx = nextMonthVal > 11 ? 0 : nextMonthVal

    for (let day = 1; day <= nextDaysNeeded; day++) {
      const dateStr = `${nextMonthYear}-${String(nextMonthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      cells.push({ day, isCurrentMonth: false, dateStr })
    }

    return cells
  }, [navDate])

  // Check today's date
  const todayStr = useMemo(() => {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  }, [])

  // Map bookings to fast-lookup record
  const bookingsMap = useMemo(() => {
    const map: Record<string, BookingDayInfo[]> = {}
    bookings.forEach((b) => {
      if (b.event_date) {
        if (!map[b.event_date]) {
          map[b.event_date] = []
        }
        map[b.event_date].push(b)
      }
    })
    return map
  }, [bookings])

  // Format date display label in input trigger field
  const displayLabel = useMemo(() => {
    if (!selectedDateObj) return ''
    const day = selectedDateObj.getDate()
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const month = months[selectedDateObj.getMonth()]
    const year = selectedDateObj.getFullYear()
    return `${day} ${month} ${year}`
  }, [selectedDateObj])

  const selectDay = (dateStr: string) => {
    onChange(dateStr)
    setIsOpen(false)
  }

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-[42px] px-3.5 border border-slate-800 rounded-lg bg-slate-950/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 text-sm flex items-center justify-between transition-all duration-250 cursor-pointer active:scale-[0.99] text-left hover:border-slate-700"
      >
        <span className={displayLabel ? 'text-white' : 'text-slate-500'}>
          {displayLabel || placeholder}
        </span>
        <CalendarIcon size={16} className="text-slate-450 hover:text-indigo-400 transition-colors" />
      </button>

      {/* Calendar Dropdown Modal Panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 sm:left-auto sm:w-[320px] top-[48px] z-50 bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150">
          
          {/* Navigation Month & Year Selector Header */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-black text-white uppercase tracking-wider">
              {months[navDate.getMonth()]} {navDate.getFullYear()}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg border border-slate-900 bg-slate-900/60 hover:bg-slate-800 hover:text-white text-slate-400 transition-all cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg border border-slate-900 bg-slate-900/60 hover:bg-slate-800 hover:text-white text-slate-400 transition-all cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Days of Week Header Grid */}
          <div className="grid grid-cols-7 gap-1 mb-1 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            {daysOfWeek.map((day) => (
              <div key={day} className="py-1">{day}</div>
            ))}
          </div>

          {/* Grid Cells days of Month */}
          <div className="grid grid-cols-7 gap-1">
            {gridCells.map((cell, idx) => {
              const isSelected = value === cell.dateStr
              const isToday = cell.dateStr === todayStr
              const dayBookings = bookingsMap[cell.dateStr] || []
              const hasBookings = dayBookings.length > 0

              let cellStyle = `h-9 w-full rounded-xl text-xs font-bold relative flex flex-col items-center justify-center cursor-pointer select-none transition-all duration-150 `
              
              if (!cell.isCurrentMonth) {
                cellStyle += `text-slate-800 opacity-20 cursor-default hover:bg-transparent pointer-events-none`
              } else if (isSelected) {
                cellStyle += `bg-indigo-600 text-white shadow-md shadow-indigo-600/10 scale-105`
              } else {
                cellStyle += `bg-slate-900/40 border border-slate-900/40 text-slate-300 hover:bg-slate-900 hover:border-slate-800 active:scale-90 `
                if (isToday) {
                  cellStyle += `ring-1.5 ring-indigo-500/80 bg-indigo-500/5 text-indigo-400 border-transparent `
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!cell.isCurrentMonth}
                  onClick={() => selectDay(cell.dateStr)}
                  className={cellStyle}
                >
                  <span>{cell.day}</span>
                  
                  {/* Colored status dots on calendar dates */}
                  {cell.isCurrentMonth && hasBookings && (
                    <div className="absolute bottom-1.5 flex gap-0.5 justify-center items-center">
                      {dayBookings.slice(0, 3).map((b, bIdx) => {
                        let dotColor = 'bg-slate-500'
                        if (b.status === 'confirmed') dotColor = 'bg-emerald-500'
                        else if (b.status === 'pending') dotColor = 'bg-amber-500'
                        else if (b.status === 'completed') dotColor = 'bg-indigo-500'
                        else if (b.status === 'cancelled') dotColor = 'bg-rose-500'
                        return (
                          <span
                            key={bIdx}
                            className={`w-1 h-1 rounded-full shrink-0 ${dotColor}`}
                          />
                        )
                      })}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

        </div>
      )}
    </div>
  )
}
