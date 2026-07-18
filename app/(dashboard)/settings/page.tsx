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
  EyeOff,
  User,
  Phone,
  Mail,
  Globe,
  QrCode,
  FileText,
  UploadCloud,
  MapPin
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

  // Business profile metadata states
  const [ownerName, setOwnerName] = useState('')
  const [mobile, setMobile] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('')
  const [stateName, setStateName] = useState('')
  const [pincodeVal, setPincodeVal] = useState('')
  const [website, setWebsite] = useState('')

  // Invoicing states
  const [invoicePrefix, setInvoicePrefix] = useState('INV')
  const [invoiceNumber, setInvoiceNumber] = useState('1001')
  const [invoiceFooter, setInvoiceFooter] = useState('')

  // Asset states
  const [logoUrl, setLogoUrl] = useState('')
  const [qrUrl, setQrUrl] = useState('')
  const [signatureUrl, setSignatureUrl] = useState('')

  // File upload state trackers
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingQr, setUploadingQr] = useState(false)
  const [uploadingSignature, setUploadingSignature] = useState(false)

  useEffect(() => {
    async function fetchProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        let profile
        const { data, error } = await supabase
          .from('profiles')
          .select('business_name, business_address, gst_number, quick_lock_pin, business_logo_url')
          .eq('id', user.id)
          .maybeSingle()
        profile = data

        if (!profile && !error) {
          const defaultBusinessName = user.user_metadata?.business_name || 'My Business'
          const { data: newProfile } = await supabase
            .from('profiles')
            .insert({ id: user.id, business_name: defaultBusinessName })
            .select('business_name, business_address, gst_number, quick_lock_pin, business_logo_url')
            .maybeSingle()
          profile = newProfile
        }

        const meta = user.user_metadata || {}

        if (profile) {
          setBusinessName(profile.business_name || '')
          setBusinessAddress(profile.business_address || '')
          setGstNumber(profile.gst_number || '')
          setPinCode(profile.quick_lock_pin || '')
          setLogoUrl(profile.business_logo_url || '')
        }

        // Load metadata configurations
        setOwnerName(meta.owner_name || '')
        setMobile(meta.mobile || '')
        setWhatsapp(meta.whatsapp || '')
        setEmail(meta.email || user.email || '')
        setCity(meta.city || '')
        setStateName(meta.state || '')
        setPincodeVal(meta.pincode || '')
        setWebsite(meta.website || '')
        setInvoicePrefix(meta.invoice_prefix || 'INV')
        setInvoiceNumber(meta.invoice_number || '1001')
        setInvoiceFooter(meta.invoice_footer || '')
        setQrUrl(meta.qr_code_url || '')
        setSignatureUrl(meta.signature_url || '')

      } catch (err) {
        console.error(err)
        toast.error('Failed to load profile details')
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [supabase, router])

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    bucket: string,
    setUrl: (url: string) => void,
    setUploading: (u: boolean) => void
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Unauthenticated')

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${bucket}-${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        // Fallback to data URL base64 representation if storage bucket is not configured
        console.warn('Storage upload error, falling back to FileReader', uploadError)
        const reader = new FileReader()
        reader.onloadend = () => {
          setUrl(reader.result as string)
          toast.success('Image loaded locally (base64 storage)')
          setUploading(false)
        }
        reader.readAsDataURL(file)
        return
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath)

      setUrl(publicUrl)
      toast.success('Asset uploaded successfully!')
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'File upload failed')
    } finally {
      setUploading(false)
    }
  }

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

      // 1. Update profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          business_name: businessName.trim(),
          business_address: businessAddress.trim() || null,
          gst_number: gstNumber.trim() || null,
          quick_lock_pin: pinCode || null,
          business_logo_url: logoUrl || null
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      // 2. Update user metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          owner_name: ownerName.trim(),
          mobile: mobile.trim(),
          whatsapp: whatsapp.trim(),
          email: email.trim(),
          city: city.trim(),
          state: stateName.trim(),
          pincode: pincodeVal.trim(),
          website: website.trim(),
          invoice_prefix: invoicePrefix.trim(),
          invoice_number: invoiceNumber.trim(),
          invoice_footer: invoiceFooter.trim(),
          qr_code_url: qrUrl,
          signature_url: signatureUrl
        }
      })

      if (authError) throw authError

      toast.success('Settings and Business Profile saved successfully!')
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to save configuration settings')
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
      <title>Settings | Smart Booking Pro</title>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} />

      {/* Header bar */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <Settings className="text-indigo-500" />
          Business Profile & Configuration
        </h1>
        <p className="text-slate-400 text-sm mt-1">Configure business headers, invoice prefixes, signatures, and keypad lock settings.</p>
      </div>

      <div className="max-w-4xl bg-slate-900/30 backdrop-blur-md border border-slate-900 p-6 sm:p-8 rounded-2xl shadow-xl">
        <form onSubmit={handleSave} className="space-y-8">

          {/* SECTION 1: IDENTITY & BRANDING */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-indigo-400 border-b border-slate-900 pb-2">
              <Building2 size={18} />
              <h2 className="text-sm font-bold uppercase tracking-wider">Identity & Branding</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Logo Upload */}
              <div className="flex flex-col items-center justify-center bg-slate-950/20 border border-slate-800 rounded-2xl p-4 text-center">
                <span className="text-xs font-semibold text-slate-450 uppercase tracking-wider mb-3">Business Logo</span>
                <div className="relative w-24 h-24 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden mb-3">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <User size={36} className="text-slate-650" />
                  )}
                  {uploadingLogo && (
                    <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center">
                      <Loader2 className="animate-spin text-indigo-500" size={18} />
                    </div>
                  )}
                </div>
                <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition-colors">
                  <UploadCloud size={12} />
                  <span>Choose Logo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'logos', setLogoUrl, setUploadingLogo)}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Identity Fields */}
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider">Owner / Manager Name</label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="e.g. Rajesh Kumar"
                    className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider">GSTIN Number</label>
                  <input
                    type="text"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                    placeholder="e.g. 22AAAAA0000A1Z5"
                    className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider">Website URL</label>
                  <input
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="e.g. www.mookinsounds.com"
                    className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: CONTACT INFORMATION */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-indigo-400 border-b border-slate-900 pb-2">
              <Phone size={18} />
              <h2 className="text-sm font-bold uppercase tracking-wider">Contact Information</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider">Business Mobile</label>
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider">WhatsApp Number</label>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider">Business Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. contact@business.com"
                  className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: LOCATION ADDRESS */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-indigo-400 border-b border-slate-900 pb-2">
              <MapPin size={18} />
              <h2 className="text-sm font-bold uppercase tracking-wider">Office Location</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5 sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider">Office Address</label>
                <textarea
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  placeholder="e.g. Suite 101, Business Heights"
                  rows={2}
                  className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Mumbai"
                  className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider">State</label>
                <input
                  type="text"
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                  placeholder="e.g. Maharashtra"
                  className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider">Pincode</label>
                <input
                  type="text"
                  value={pincodeVal}
                  onChange={(e) => setPincodeVal(e.target.value)}
                  placeholder="e.g. 400001"
                  className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: INVOICE CONFIGURATIONS */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-indigo-400 border-b border-slate-900 pb-2">
              <FileText size={18} />
              <h2 className="text-sm font-bold uppercase tracking-wider">Invoicing Configurations</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider">Invoice Prefix</label>
                <input
                  type="text"
                  value={invoicePrefix}
                  onChange={(e) => setInvoicePrefix(e.target.value)}
                  placeholder="e.g. INV"
                  className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider">Next Invoice Number</label>
                <input
                  type="number"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="e.g. 1001"
                  className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider">Invoice Footer terms</label>
                <textarea
                  value={invoiceFooter}
                  onChange={(e) => setInvoiceFooter(e.target.value)}
                  placeholder="e.g. Thank you for choosing Rajesh sound! The advance payment is non-refundable."
                  rows={2}
                  className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                />
              </div>

              {/* QR Upload Column */}
              <div className="flex flex-col items-center justify-center bg-slate-950/20 border border-slate-800 rounded-2xl p-4 text-center">
                <span className="text-xs font-semibold text-slate-450 uppercase tracking-wider mb-3">UPI QR Code</span>
                <div className="relative w-24 h-24 bg-slate-900 border border-slate-880 rounded-xl flex items-center justify-center overflow-hidden mb-3">
                  {qrUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrUrl} alt="UPI QR" className="w-full h-full object-contain" />
                  ) : (
                    <QrCode size={36} className="text-slate-650" />
                  )}
                  {uploadingQr && (
                    <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center">
                      <Loader2 className="animate-spin text-indigo-500" size={18} />
                    </div>
                  )}
                </div>
                <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition-colors">
                  <UploadCloud size={12} />
                  <span>Choose QR File</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'qrs', setQrUrl, setUploadingQr)}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Signature Upload Column */}
              <div className="flex flex-col items-center justify-center bg-slate-950/20 border border-slate-800 rounded-2xl p-4 text-center sm:col-span-2">
                <span className="text-xs font-semibold text-slate-450 uppercase tracking-wider mb-3">Authorized Signature Seal</span>
                <div className="relative w-full max-w-xs h-24 bg-slate-900 border border-slate-880 rounded-xl flex items-center justify-center overflow-hidden mb-3">
                  {signatureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={signatureUrl} alt="Signature" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-slate-650 text-xs font-semibold">No signature loaded</span>
                  )}
                  {uploadingSignature && (
                    <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center">
                      <Loader2 className="animate-spin text-indigo-500" size={18} />
                    </div>
                  )}
                </div>
                <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition-colors">
                  <UploadCloud size={12} />
                  <span>Choose Signature</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'signatures', setSignatureUrl, setUploadingSignature)}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* SECTION 5: SECURITY & LOCKPIN */}
          <div className="space-y-5">
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
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white cursor-pointer"
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 leading-normal mt-1 flex items-center">
                <Lock size={10} className="mr-1 text-slate-650" />
                PIN protects dashboard during client-side inactivity lock screens.
              </p>
            </div>
          </div>

          {/* Actions Footer */}
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
              Save Business Configuration
            </button>
          </div>

        </form>
      </div>
    </>
  )
}
