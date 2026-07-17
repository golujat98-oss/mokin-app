'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Lock, Delete, Play, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function QuickLock() {
  const supabase = createClient()
  const [locked, setLocked] = useState(false)
  const [pin, setPin] = useState('')
  const [dbPin, setDbPin] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  
  const inactivityTimeout = useRef<NodeJS.Timeout | null>(null)

  // Fetch quick lock pin on mount
  useEffect(() => {
    async function fetchPin() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data } = await supabase
            .from('profiles')
            .select('quick_lock_pin')
            .eq('id', user.id)
            .single()
          
          if (data?.quick_lock_pin) {
            setDbPin(data.quick_lock_pin)
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchPin()
  }, [supabase])

  const lockScreen = useCallback(() => {
    if (dbPin) {
      setLocked(true)
      setPin('')
    }
  }, [dbPin])

  // Inactivity timer logic (5 minutes of inactivity auto locks)
  useEffect(() => {
    if (!dbPin) return

    const resetTimer = () => {
      if (inactivityTimeout.current) clearTimeout(inactivityTimeout.current)
      inactivityTimeout.current = setTimeout(() => {
        lockScreen()
      }, 5 * 60 * 1000) // 5 minutes
    }

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']
    events.forEach((event) => document.addEventListener(event, resetTimer))
    
    resetTimer()

    return () => {
      if (inactivityTimeout.current) clearTimeout(inactivityTimeout.current)
      events.forEach((event) => document.removeEventListener(event, resetTimer))
    }
  }, [dbPin, lockScreen])

  // Handlers for PIN pad input
  const handleNumberClick = (num: number) => {
    if (pin.length < 4) {
      const newPin = pin + num
      setPin(newPin)
      setError(false)

      // Auto check when pin length is 4
      if (newPin.length === 4) {
        if (newPin === dbPin) {
          setLocked(false)
          setPin('')
        } else {
          // Play shake animation or red border
          setError(true)
          setPin('')
          // Clear pin after a brief delay
          setTimeout(() => setError(false), 800)
        }
      }
    }
  }

  const handleDelete = () => {
    setPin(pin.slice(0, -1))
  }

  if (loading || !locked) return null

  return (
    <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl z-[9999] flex flex-col items-center justify-center select-none">
      <div className="w-full max-w-sm px-6 flex flex-col items-center">
        {/* Lock Icon */}
        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white mb-8 shadow-xl shadow-indigo-500/10 transition-all duration-300 ${error ? 'animate-bounce bg-red-600' : ''}`}>
          <Lock size={28} />
        </div>

        <h2 className="text-xl font-semibold text-white tracking-wide mb-1">
          App Locked
        </h2>
        <p className="text-sm text-slate-400 mb-8">
          Enter your 4-digit PIN to unlock
        </p>

        {/* PIN Indicators */}
        <div className="flex gap-4 mb-12">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                index < pin.length
                  ? 'bg-white border-white scale-110 shadow-lg shadow-white/30'
                  : 'border-slate-800 bg-slate-950/40'
              } ${error ? 'border-red-500 bg-red-500' : ''}`}
            />
          ))}
        </div>

        {/* PIN Numeric Pad */}
        <div className="grid grid-cols-3 gap-6 w-full max-w-[280px]">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleNumberClick(num)}
              className="w-16 h-16 rounded-full bg-slate-900/60 border border-slate-800/80 hover:bg-slate-800/80 hover:border-slate-700/80 text-white font-medium text-2xl flex items-center justify-center active:scale-95 transition-all cursor-pointer"
            >
              {num}
            </button>
          ))}
          {/* Backspace */}
          <button
            type="button"
            onClick={handleDelete}
            className="w-16 h-16 rounded-full bg-slate-950 text-slate-400 hover:text-white flex items-center justify-center active:scale-95 transition-colors cursor-pointer"
          >
            <Delete size={22} />
          </button>
          {/* Zero */}
          <button
            type="button"
            onClick={() => handleNumberClick(0)}
            className="w-16 h-16 rounded-full bg-slate-900/60 border border-slate-800/80 hover:bg-slate-800/80 hover:border-slate-700/80 text-white font-medium text-2xl flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          >
            0
          </button>
          {/* Placeholder for symmetry */}
          <div className="w-16 h-16" />
        </div>
      </div>
    </div>
  )
}
