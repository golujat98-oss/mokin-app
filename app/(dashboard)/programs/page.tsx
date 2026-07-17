'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Layers,
  Plus,
  Trash2,
  Edit2,
  Loader2,
  Save,
  X,
  Music,
  Disc,
  Sparkles,
  Mic,
  Speaker,
  Heart,
  Star,
  Camera,
  Coffee,
  Trophy,
  PartyPopper
} from 'lucide-react'
import { toast, Toaster } from 'react-hot-toast'

interface Program {
  id: string
  name: string
  icon: string
  created_at: string
}

// Icon list options for program cataloging
const iconOptions = [
  { name: 'Music', component: Music, stringVal: 'Music' },
  { name: 'Disc', component: Disc, stringVal: 'Disc' },
  { name: 'Sparkles', component: Sparkles, stringVal: 'Sparkles' },
  { name: 'Mic', component: Mic, stringVal: 'Mic' },
  { name: 'Speaker', component: Speaker, stringVal: 'Speaker' },
  { name: 'Heart', component: Heart, stringVal: 'Heart' },
  { name: 'Star', component: Star, stringVal: 'Star' },
  { name: 'Camera', component: Camera, stringVal: 'Camera' },
  { name: 'Coffee', component: Coffee, stringVal: 'Coffee' },
  { name: 'Trophy', component: Trophy, stringVal: 'Trophy' },
  { name: 'PartyPopper', component: PartyPopper, stringVal: 'PartyPopper' },
]

export default function ProgramsPage() {
  const supabase = createClient()
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProgram, setEditingProgram] = useState<Program | null>(null)
  
  // Form states
  const [name, setName] = useState('')
  const [selectedIcon, setSelectedIcon] = useState('Music')
  const [saving, setSaving] = useState(false)

  const fetchPrograms = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('programs')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setPrograms(data || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load services')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchPrograms()

    // Real-time synchronization
    const channel = supabase
      .channel('db-sync-programs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'programs' }, () => {
        fetchPrograms()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchPrograms, supabase])

  const handleOpenNewModal = () => {
    setEditingProgram(null)
    setName('')
    setSelectedIcon('Music')
    setModalOpen(true)
  }

  const handleOpenEditModal = (program: Program) => {
    setEditingProgram(program)
    setName(program.name)
    setSelectedIcon(program.icon || 'Music')
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Service name is required')
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Unauthenticated')

      if (editingProgram) {
        // Update
        const { error } = await supabase
          .from('programs')
          .update({
            name: name.trim(),
            icon: selectedIcon
          })
          .eq('id', editingProgram.id)

        if (error) throw error
        toast.success('Service updated successfully!')
      } else {
        // Create
        const { error } = await supabase
          .from('programs')
          .insert({
            owner_id: user.id,
            name: name.trim(),
            icon: selectedIcon
          })

        if (error) throw error
        toast.success('New service created!')
      }
      setModalOpen(false)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to save service')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this service? Bookings using this service will preserve its snapshot name.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('programs')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Service deleted')
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete service')
    }
  }

  const renderIcon = (iconName: string, size = 20, className = '') => {
    const option = iconOptions.find(opt => opt.stringVal === iconName)
    const IconComp = option ? option.component : Music
    return <IconComp size={size} className={className} />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-slate-400">
        <Loader2 className="animate-spin h-6 w-6 text-indigo-500 mr-2" />
        Loading services catalog...
      </div>
    )
  }

  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Layers className="text-indigo-500" />
            Services Catalog
          </h1>
          <p className="text-slate-400 text-sm mt-1">Configure service packages and program options for your booking forms.</p>
        </div>
        <div>
          <button
            onClick={handleOpenNewModal}
            className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-indigo-600/15 active:scale-95 cursor-pointer"
          >
            <Plus size={16} className="mr-2" />
            Add Service
          </button>
        </div>
      </div>

      {/* SERVICES GRID */}
      {programs.length === 0 ? (
        <div className="bg-slate-900/10 border border-dashed border-slate-800 rounded-2xl py-16 px-4 text-center max-w-xl mx-auto mt-8">
          <Layers className="stroke-[1.5] h-12 w-12 text-slate-600 mb-4 mx-auto" />
          <h3 className="text-lg font-bold text-white">No custom services defined</h3>
          <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">Create services like "Premium DJ Night", "Stage Setup", or "Wedding sound" to catalog bookings.</p>
          <button
            onClick={handleOpenNewModal}
            className="mt-5 inline-flex items-center bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2.5 rounded-xl font-medium cursor-pointer"
          >
            <Plus size={16} className="mr-2" /> Create First Service
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {programs.map((program) => (
            <div
              key={program.id}
              className="bg-slate-900/30 backdrop-blur-md border border-slate-900 hover:border-slate-800/80 rounded-2xl p-5 flex items-center justify-between shadow-xl transition-all duration-200"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center text-indigo-400 shrink-0">
                  {renderIcon(program.icon || 'Music', 22)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-white truncate">{program.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Created {new Date(program.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 ml-4">
                <button
                  onClick={() => handleOpenEditModal(program)}
                  title="Edit service"
                  className="p-2 rounded-lg bg-slate-950/40 hover:bg-slate-800/60 border border-slate-850 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => handleDelete(program.id)}
                  title="Delete service"
                  className="p-2 rounded-lg bg-slate-950/40 hover:bg-rose-950/20 hover:border-rose-900/40 border border-slate-850 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE/EDIT MODAL OVERLAY */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/75 backdrop-blur-md select-none">
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
              <h3 className="font-bold text-lg text-white">
                {editingProgram ? 'Edit Service' : 'Add New Service'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6">
              {/* Name Input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">
                  Service Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. DJ Sound & Lights (Premium)"
                  className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 text-sm transition-all"
                />
              </div>

              {/* Icon grid selector */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-300">
                  Choose Icon Category
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                  {iconOptions.map((opt) => {
                    const isSelected = selectedIcon === opt.stringVal
                    const IconComponent = opt.component
                    return (
                      <button
                        key={opt.stringVal}
                        type="button"
                        onClick={() => setSelectedIcon(opt.stringVal)}
                        title={opt.name}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                            : 'bg-slate-950/60 hover:bg-slate-800 border border-slate-850 text-slate-400 hover:text-white'
                        }`}
                      >
                        <IconComponent size={18} />
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-800 rounded-xl text-sm font-medium text-slate-400 hover:text-white bg-slate-950/20 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-4 py-2 rounded-xl transition-all shadow-lg shadow-indigo-600/15 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {saving ? (
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  ) : (
                    <Save className="-ml-1 mr-2 h-4 w-4" />
                  )}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
