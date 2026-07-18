'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Phone, Mail, Instagram, Copy, Check, ShieldCheck, Music, HelpCircle, ExternalLink } from 'lucide-react'
import { toast, Toaster } from 'react-hot-toast'

export default function ContactPage() {
  const [copiedPhone, setCopiedPhone] = useState(false)
  const [copiedInsta, setCopiedInsta] = useState(false)

  const handleCopy = (text: string, type: 'phone' | 'instagram') => {
    navigator.clipboard.writeText(text)
    toast.success(`${type === 'phone' ? 'Phone number' : 'Instagram handle'} copied to clipboard!`)
    if (type === 'phone') {
      setCopiedPhone(true)
      setTimeout(() => setCopiedPhone(false), 2000)
    } else {
      setCopiedInsta(true)
      setTimeout(() => setCopiedInsta(false), 2000)
    }
  }

  // EDIT EMAIL HERE: Feel free to update this email address placeholder.
  const emailAddress = 'support@smartbookingpro.com'

  return (
    <>
      <title>Contact | Smart Booking Pro</title>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} />
      
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Contact Us</h1>
        <p className="text-slate-400 text-sm mt-1">Get in touch with the creator of Smart Booking Pro.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Creator Info Profile Card (Left 1 col or full) */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-900 p-6 rounded-3xl flex flex-col items-center text-center shadow-xl relative overflow-hidden group">
            {/* Ambient glows inside card */}
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-indigo-500/10 blur-2xl group-hover:scale-150 transition-all duration-500" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-violet-500/10 blur-2xl group-hover:scale-150 transition-all duration-500" />
            
            {/* Avatar / Icon container */}
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white font-extrabold text-3xl shadow-lg shadow-indigo-500/25 mb-4 relative z-10 border border-indigo-400/20">
              <Music className="w-10 h-10 animate-pulse text-white" />
            </div>

            <h2 className="text-2xl font-bold text-white tracking-tight relative z-10">DJ Golu</h2>
            <p className="text-indigo-400 text-xs font-semibold uppercase tracking-wider mt-1.5 relative z-10">Smart Booking Pro Creator</p>
            
            <p className="text-slate-400 text-sm mt-4 px-4 relative z-10">
              Passionate about crafting premium software solutions for businesses. Feel free to reach out for customizations, support, or feedback.
            </p>

            <div className="mt-8 pt-6 border-t border-slate-800/60 w-full flex items-center justify-between text-xs text-slate-500 relative z-10">
              <span className="flex items-center gap-1">
                <ShieldCheck size={14} className="text-indigo-500/70" /> Secured System
              </span>
              <span>v1.0.0</span>
            </div>
          </div>
          
          {/* Quick FAQ / Info glassmorphism list */}
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-900 p-6 rounded-3xl shadow-xl flex flex-col gap-4">
            <h3 className="text-sm font-bold text-white tracking-wider uppercase mb-2 flex items-center gap-2">
              <HelpCircle className="text-indigo-400" size={16} /> Help & FAQ
            </h3>
            <div className="space-y-3.5">
              <div>
                <p className="text-xs font-bold text-slate-300">Need customizations?</p>
                <p className="text-xs text-slate-400 mt-0.5">Contact Golu directly to discuss custom features or styling edits for your business workflow.</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-300">Reporting a bug?</p>
                <p className="text-xs text-slate-400 mt-0.5">Please share a screenshot or description of the issue to expedite the fix.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Methods Cards Grid (Right 2 cols) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Phone Contact Card */}
          <div className="bg-slate-900/30 backdrop-blur-md border border-slate-900 p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl relative overflow-hidden group hover:border-slate-800/80 transition-all duration-300">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center text-emerald-400 shadow-md">
                <Phone size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-wide">Phone Call Support</h3>
                <p className="text-slate-400 text-xs mt-0.5">Available for queries, emergency fixes, and direct voice calls.</p>
                <p className="text-emerald-400 font-mono font-semibold text-lg mt-2 tracking-wider">+91 96444 14418</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleCopy('+919644414418', 'phone')}
                className="p-3 rounded-xl bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80 text-slate-400 hover:text-white flex items-center justify-center transition-all duration-150 active:scale-95 cursor-pointer"
                title="Copy to Clipboard"
              >
                {copiedPhone ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
              </button>
              <a
                href="tel:+919644414418"
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-sm px-5 py-3 rounded-xl transition-all duration-150 shadow-lg shadow-emerald-600/15 active:scale-95 cursor-pointer"
              >
                <Phone size={16} />
                Call Now
              </a>
            </div>
          </div>

          {/* Instagram Contact Card */}
          <div className="bg-slate-900/30 backdrop-blur-md border border-slate-900 p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl relative overflow-hidden group hover:border-slate-800/80 transition-all duration-300">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-pink-500/10 border border-pink-500/15 flex items-center justify-center text-pink-400 shadow-md">
                <Instagram size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-wide">Instagram Profile</h3>
                <p className="text-slate-400 text-xs mt-0.5">Follow the creator, check updates, and chat via Direct Messages.</p>
                <p className="text-pink-400 font-semibold text-lg mt-2 tracking-wide">@golu_jat_98</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleCopy('@golu_jat_98', 'instagram')}
                className="p-3 rounded-xl bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80 text-slate-400 hover:text-white flex items-center justify-center transition-all duration-150 active:scale-95 cursor-pointer"
                title="Copy to Clipboard"
              >
                {copiedInsta ? <Check size={18} className="text-pink-400" /> : <Copy size={18} />}
              </button>
              <a
                href="https://instagram.com/golu_jat_98"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-medium text-sm px-5 py-3 rounded-xl transition-all duration-150 shadow-lg shadow-pink-600/15 active:scale-95 cursor-pointer animate-pulse-slow"
              >
                <Instagram size={16} />
                Open Instagram
                <ExternalLink size={12} className="opacity-75" />
              </a>
            </div>
          </div>

          {/* Email Contact Card */}
          <div className="bg-slate-900/30 backdrop-blur-md border border-slate-900 p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl relative overflow-hidden group hover:border-slate-800/80 transition-all duration-300">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center text-indigo-400 shadow-md">
                <Mail size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-wide">Official Email Inquiry</h3>
                <p className="text-slate-400 text-xs mt-0.5">Send feature proposals, business licensing questions, or official feedback.</p>
                <p className="text-indigo-400 font-semibold text-lg mt-2 tracking-wide font-mono">{emailAddress}</p>
              </div>
            </div>
            
            <div>
              <a
                href={`mailto:${emailAddress}`}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium text-sm px-5 py-3 rounded-xl transition-all duration-150 shadow-lg shadow-indigo-600/15 w-full md:w-auto justify-center active:scale-95 cursor-pointer"
              >
                <Mail size={16} />
                Email Us
              </a>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
