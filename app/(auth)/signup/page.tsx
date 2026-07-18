'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { UserPlus, Mail, Lock, Briefcase, Loader2 } from 'lucide-react'
import { toast, Toaster } from 'react-hot-toast'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()

  const [businessName, setBusinessName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!businessName || !email || !password) {
      toast.error('Please fill in all fields')
      return
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          business_name: businessName,
        },
      },
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
    } else {
      toast.success('Registration successful! Please check your email or log in.')
      // Redirect to login after signup
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    }
  }

  return (
    <>
      <title>Sign Up | Smart Booking Pro</title>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} />
      <div className="space-y-6">
        <div>
          <h2 className="text-center text-2xl font-bold tracking-tight text-white">
            Create Account
          </h2>
          <p className="mt-2 text-center text-sm text-slate-400">
            Sign up to manage your bookings and team
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSignup}>
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Business Name
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Briefcase size={18} />
              </div>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Star Tent House & DJ"
                className="block w-full pl-10 pr-3 py-2 border border-slate-800 rounded-lg bg-slate-950/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 sm:text-sm transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300">
              Email Address
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail size={18} />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@business.com"
                className="block w-full pl-10 pr-3 py-2 border border-slate-800 rounded-lg bg-slate-950/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 sm:text-sm transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300">
              Password
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock size={18} />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="block w-full pl-10 pr-3 py-2 border border-slate-800 rounded-lg bg-slate-950/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 sm:text-sm transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed select-none transition-all duration-200 cursor-pointer shadow-indigo-500/10 shadow-lg"
          >
            {loading ? (
              <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
            ) : (
              <UserPlus className="-ml-1 mr-2 h-5 w-5" />
            )}
            Register Business
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Sign In
          </Link>
        </p>
      </div>
    </>
  )
}
