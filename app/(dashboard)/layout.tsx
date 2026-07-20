'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  Calendar,
  Layers,
  Users,
  Package,
  CircleDollarSign,
  Settings,
  LogOut,
  Menu,
  X,
  Lock,
  User,
  Loader2,
  BarChart3,
  PhoneCall,
  Plus
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import QuickLock from '@/components/auth/QuickLock'
import BannerAd from '@/components/ads/BannerAd'

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Bookings', href: '/bookings', icon: Calendar },
  { name: 'Programs', href: '/programs', icon: Layers },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Expenses', href: '/expenses', icon: CircleDollarSign },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Contact Us', href: '/contact', icon: PhoneCall },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState<string>('Mookin Business')
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    async function fetchUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUserEmail(user.email ?? null)
          // Fetch profile metadata
          let profile;
          const { data, error: profileError } = await supabase
            .from('profiles')
            .select('business_name')
            .eq('id', user.id)
            .maybeSingle()
          profile = data
          
          if (!profile && !profileError) {
            const defaultBusinessName = user.user_metadata?.business_name || 'My Business'
            const { data: newProfile } = await supabase
              .from('profiles')
              .insert({ id: user.id, business_name: defaultBusinessName })
              .select('business_name')
              .maybeSingle()
            profile = newProfile
          }
          
          if (profile?.business_name) {
            setBusinessName(profile.business_name)
          }
        } else {
          router.push('/login')
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchUser()
  }, [supabase, router])

  const handleLogout = async () => {
    setLoggingOut(true)
    const { error } = await supabase.auth.signOut()
    if (!error) {
      setMobileMenuOpen(false)
      router.push('/login')
      router.refresh()
    } else {
      setLoggingOut(false)
    }
  }



  const triggerSoftLock = async () => {
    // We can trigger by forcing reload which checks lock PIN, 
    // or by custom dispatch event that QuickLock.tsx listens to!
    window.location.reload()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="animate-spin h-8 w-8 text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex relative overflow-hidden">
      {/* Background radial gradients for depth */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-violet-500/5 blur-[120px] pointer-events-none" />

      {/* Render QuickLock soft PIN wrapper */}
      <QuickLock />

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex md:w-64 flex-col bg-slate-900/20 border-r border-slate-900 backdrop-blur-xl shrink-0 z-20">
        {/* App Logo & Header */}
        <div className="h-16 flex items-center px-6 gap-2 border-b border-slate-900">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-indigo-500/20">
            M
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent tracking-tight">
            {businessName}
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link key={item.name} href={item.href}>
                <span
                  className={`flex items-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/40 border border-transparent'
                  }`}
                >
                  <Icon size={18} className="mr-3" />
                  {item.name}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* User Profile & Lock/Logout */}
        <div className="p-4.5 border-t border-slate-900 bg-slate-950/40">
          <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-slate-900/40 border border-slate-900/80 hover:border-slate-800 hover:bg-slate-900/60 transition-all duration-200 shadow-inner group cursor-default">
            <div className="w-8.5 h-8.5 rounded-full bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center text-indigo-400 shadow-sm group-hover:scale-105 transition-transform duration-200">
              <User size={15} className="stroke-[2.5]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Session Profile</p>
              <p className="text-xs font-semibold text-white truncate mt-0.5" title={userEmail || ''}>{userEmail}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3.5">
            <button
              onClick={triggerSoftLock}
              title="Quick Lock"
              className="flex-1 h-9 rounded-lg bg-slate-900/50 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-indigo-400 flex items-center justify-center active:scale-95 transition-all duration-200 cursor-pointer shadow-sm"
            >
              <Lock size={14} className="stroke-[2]" />
            </button>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="flex-1 h-9 rounded-lg bg-slate-900/50 hover:bg-rose-500/10 hover:border-rose-500/20 border border-slate-800 text-slate-400 hover:text-rose-400 flex items-center justify-center active:scale-95 transition-all duration-200 cursor-pointer shadow-sm"
            >
              <LogOut size={14} className="stroke-[2]" />
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE HEADER & CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10 md:pb-0">
        {/* Mobile Header Bar */}
        <header className="md:hidden h-16 flex items-center justify-between px-4 bg-slate-900/30 border-b border-slate-900 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-base shadow-md">
              M
            </div>
            <span className="font-bold text-sm truncate max-w-[150px] text-white">
              {businessName}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={triggerSoftLock}
              className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white bg-slate-950/40"
            >
              <Lock size={16} />
            </button>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white bg-slate-950/40"
            >
              <Menu size={16} />
            </button>
          </div>
        </header>

        {/* MOBILE NAVIGATION SIDE DRAWER */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileMenuOpen(false)}
                className="fixed inset-0 bg-slate-950 z-[40]"
              />

              {/* Drawer Container */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 w-64 bg-slate-900 border-l border-slate-800 z-[50] flex flex-col"
              >
                {/* Header (fixed) */}
                <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
                  <span className="font-bold text-sm text-slate-300">Navigation</span>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 rounded-lg text-slate-400 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Scroll Wrapper (flex-1 min-h-0 overflow-hidden) */}
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                  {/* Navigation (overflow-y-auto) */}
                  <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
                    {navItems.map((item) => {
                      const isActive = pathname === item.href
                      const Icon = item.icon
                      return (
                        <Link key={item.name} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                          <span
                            className={`flex items-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
                              isActive
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
                                : 'text-slate-400 hover:text-white hover:bg-slate-900/40 border border-transparent'
                            }`}
                          >
                            <Icon size={18} className="mr-3" />
                            {item.name}
                          </span>
                        </Link>
                      )
                    })}
                  </nav>
                </div>

                {/* Footer (Logout) */}
                <div className="p-4 border-t border-slate-800 shrink-0">
                  <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="w-full py-2.5 rounded-xl bg-red-950/20 border border-red-900/40 text-red-400 font-medium text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loggingOut ? (
                      <Loader2 className="animate-spin h-4 w-4" />
                    ) : (
                      <LogOut size={16} />
                    )}
                    {loggingOut ? 'Logging out...' : 'Logout'}
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* MAIN ROUTE CONTENT SCROLLABLE VIEW */}
        <main className="flex-1 overflow-y-auto p-4 pb-48 md:p-8 space-y-4">
          <BannerAd placement="top" />
          <div>{children}</div>
          <BannerAd placement="bottom" />
        </main>
      </div>

      {/* Floating Action Button (FAB) for Mobile Quick Bookings */}
      {!mobileMenuOpen && (
        <div className="md:hidden fixed bottom-[calc(7.8rem+env(safe-area-inset-bottom))] right-4 z-40">
          <Link href="/bookings?new=true">
            <button className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-650 text-white flex items-center justify-center shadow-lg shadow-purple-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer">
              <Plus size={22} className="stroke-[3.5]" />
            </button>
          </Link>
        </div>
      )}

      {/* MOBILE COMPACT BOTTOM NAVIGATION BAR */}
      {/* Only rendered on small screens to give quick, thumb-friendly access to primary sections */}
      {!mobileMenuOpen && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0a0a0a]/95 border-t border-slate-900 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 px-4 shadow-[0_-8px_30px_rgba(0,0,0,0.6)] backdrop-blur-md">
          <nav className="h-16 bg-slate-900/40 border border-white/[0.05] grid grid-cols-5 items-center justify-items-center rounded-2xl relative w-full">
            {navItems.slice(0, 5).map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <Link key={item.name} href={item.href} className="relative py-1 w-full flex justify-center">
                  <span
                    className={`flex flex-col items-center justify-center w-full max-w-[64px] h-12 rounded-xl transition-all duration-300 relative ${
                      isActive ? 'text-indigo-400 scale-105 font-bold' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="activeTabGlow"
                        className="absolute inset-0 bg-indigo-500/10 border border-indigo-500/20 rounded-xl -z-10 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <Icon size={20} className={isActive ? 'stroke-[2.5]' : 'stroke-[2]'} />
                    <span className="text-[9px] min-[375px]:text-[10px] mt-0.5 font-extrabold uppercase tracking-normal text-center truncate w-full px-0.5">{item.name}</span>
                  </span>
                </Link>
              )
            })}
          </nav>
        </div>
      )}
    </div>
  )
}
