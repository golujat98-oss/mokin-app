'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Settings,
  Building2,
  KeyRound,
  Save,
  Loader2,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react'
import { toast, Toaster } from 'react-hot-toast'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Profile configuration states
  const [businessName, setBusinessName] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')
  const [gstNumber, setGstNumber] = useState('')
  const [pinCode, setPinCode] = useState('')
  const [showPin, setShowPin] = useState(false)

  useEffect(() => {
    async function fetchProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        let profile;
        const { data, error } = await supabase
          .from('profiles')
          .select('business_name, business_address, gst_number, quick_lock_pin')
          .eq('id', user.id)
          .maybeSingle()
        profile = data

        if (!profile && !error) {
          const defaultBusinessName = user.user_metadata?.business_name || 'My Business'
          const { data: newProfile } = await supabase
            .from('profiles')
            .insert({ id: user.id, business_name: defaultBusinessName })
            .select('business_name, business_address, gst_number, quick_lock_pin')
            .maybeSingle()
          profile = newProfile
        }

        if (profile) {
          setBusinessName(profile.business_name || '')
          setBusinessAddress(profile.business_address || '')
          setGstNumber(profile.gst_number || '')
          setPinCode(profile.quick_lock_pin || '')
        }
      } catch (err) {
        console.error(err)
        toast.error('Failed to load profile details')
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [supabase, router])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!businessName.trim()) {
      toast.error('Business name is required')
      return
    }

    if (pinCode && (pinCode.length !== 4 || isNaN(Number(pinCode)))) {
      toast.error('PIN code must be exactly 4 digits')
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Unauthenticated')

      const { error } = await supabase
        .from('profiles')
        .update({
          business_name: businessName.trim(),
          business_address: businessAddress.trim() || null,
          gst_number: gstNumber.trim() || null,
          quick_lock_pin: pinCode || null
        })
        .eq('id', user.id)

      if (error) throw error
      toast.success('Settings updated successfully!')
      
      // Force layout re-fetch of business name
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-slate-400">
        <Loader2 className="animate-spin h-6 w-6 text-indigo-500 mr-2" />
        Loading settings manager...
      </div>
    )
  }

  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} />

      {/* Header bar */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <Settings className="text-indigo-500" />
          Business Configuration
        </h1>
        <p className="text-slate-400 text-sm mt-1">Manage invoicing headers, GST taxation details, and lock screen credentials.</p>
      </div>

      <div className="max-w-2xl bg-slate-900/30 backdrop-blur-md border border-slate-900 p-6 sm:p-8 rounded-2xl shadow-xl">
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Section 1: Business Profile */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-indigo-400 border-b border-slate-900 pb-2">
              <Building2 size={18} />
              <h2 className="text-sm font-bold uppercase tracking-wider">Invoice Branding Headers</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Business Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider">Business / Brand Name</label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Mookin Sound Systems"
                  className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                />
              </div>

              {/* GST Number */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider">GSTIN Number (Optional)</label>
                <input
                  type="text"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                  placeholder="e.g. 22AAAAA0000A1Z5"
                  className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                />
              </div>

              {/* Address */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider">Office Address</label>
                <textarea
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  placeholder="e.g. Suite 101, Business Heights, New Delhi"
                  rows={2}
                  className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Security & Soft lock */}
          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-2 text-indigo-400 border-b border-slate-900 pb-2">
              <KeyRound size={18} />
              <h2 className="text-sm font-bold uppercase tracking-wider">Lock Screen Credentials</h2>
            </div>

            <div className="max-w-xs space-y-1.5 relative">
              <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider">4-Digit Keypad PIN</label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  maxLength={4}
                  pattern="\d*"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 1234"
                  className="block w-full pl-3.5 pr-10 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm tracking-widest font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white"
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 leading-normal mt-1 flex items-center">
                <Lock size={10} className="mr-1 text-slate-650" />
                PIN protects dashboard during 5 minutes of client-side screen inactivity.
              </p>
            </div>
          </div>

          {/* Action button */}
          <div className="flex justify-end pt-6 border-t border-slate-900">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/15 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? (
                <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
              ) : (
                <Save className="-ml-1 mr-2 h-4 w-4" />
              )}
              Save Configuration
            </button>
          </div>

        </form>
      </div>
    </>
  )
}
