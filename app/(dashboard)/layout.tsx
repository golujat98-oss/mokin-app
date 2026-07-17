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
  PhoneCall
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import QuickLock from '@/components/auth/QuickLock'

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
          let { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('business_name')
            .eq('id', user.id)
            .maybeSingle()
          
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

  // Temporary debugging hook to trace the mobile drawer components at runtime
  useEffect(() => {
    if (!mobileMenuOpen) return

    const intervalId = setInterval(() => {
      const drawer = document.getElementById('debug-drawer')
      const scrollWrapper = document.getElementById('debug-scroll-wrapper')
      const footer = document.getElementById('debug-footer')
      const bottomNav = document.getElementById('debug-bottom-nav')
      
      console.log('=== SIDEBAR DEBUGGING INFO ===')
      console.log('Viewport Height (window.innerHeight):', window.innerHeight)
      console.log('Viewport Width (window.innerWidth):', window.innerWidth)
      
      if (drawer) {
        const rect = drawer.getBoundingClientRect()
        console.log('Drawer rect:', {
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
          zIndex: window.getComputedStyle(drawer).zIndex
        })
      } else {
        console.log('Drawer NOT found in DOM!')
      }

      if (scrollWrapper) {
        const rect = scrollWrapper.getBoundingClientRect()
        console.log('ScrollWrapper rect:', {
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height
        })
      } else {
        console.log('ScrollWrapper NOT found in DOM!')
      }

      if (footer) {
        const rect = footer.getBoundingClientRect()
        console.log('Footer rect:', {
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
          visible: rect.height > 0 && rect.width > 0,
          inViewport: rect.bottom <= window.innerHeight && rect.top >= 0
        })
      } else {
        console.log('Footer NOT found in DOM!')
      }

      if (bottomNav) {
        const rect = bottomNav.getBoundingClientRect()
        console.log('BottomNav rect:', {
          top: rect.top,
          bottom: rect.bottom,
          zIndex: window.getComputedStyle(bottomNav).zIndex
        })
      } else {
        console.log('BottomNav NOT found in DOM!')
      }
    }, 1000)

    return () => clearInterval(intervalId)
  }, [mobileMenuOpen])

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
        <div className="p-4 border-t border-slate-900 bg-slate-950/20">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-950/40 border border-slate-900">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
              <User size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400 truncate">Logged in as</p>
              <p className="text-xs font-semibold text-white truncate">{userEmail}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={triggerSoftLock}
              title="Quick Lock"
              className="flex-1 py-2 rounded-lg bg-slate-950/50 hover:bg-slate-900 border border-slate-800/80 text-slate-400 hover:text-white flex items-center justify-center active:scale-95 transition-all cursor-pointer"
            >
              <Lock size={15} />
            </button>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="flex-1 py-2 rounded-lg bg-slate-950/50 hover:bg-red-950/20 hover:border-red-900/40 border border-slate-800/80 text-slate-400 hover:text-red-400 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE HEADER & CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10 pb-16 md:pb-0">
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
                id="debug-drawer"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 w-64 bg-slate-900 border-l border-slate-800 z-[50] flex flex-col"
                style={{ border: '3px solid red' }}
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
                <div id="debug-scroll-wrapper" className="flex-1 min-h-0 overflow-hidden flex flex-col" style={{ border: '3px solid blue' }}>
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
                <div id="debug-footer" className="p-4 border-t border-slate-800 shrink-0" style={{ border: '3px solid green' }}>
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
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>

      {/* MOBILE COMPACT BOTTOM NAVIGATION BAR */}
      {/* Only rendered on small screens to give quick, thumb-friendly access to primary sections */}
      {!mobileMenuOpen && (
        <nav id="debug-bottom-nav" className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900/80 border-t border-slate-800 backdrop-blur-lg flex items-center justify-around px-2 z-30" style={{ border: '3px solid yellow' }}>
          {navItems.slice(0, 5).map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link key={item.name} href={item.href}>
                <span
                  className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg transition-all ${
                    isActive ? 'text-indigo-400' : 'text-slate-500'
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-[10px] mt-0.5 font-medium">{item.name}</span>
                </span>
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}
