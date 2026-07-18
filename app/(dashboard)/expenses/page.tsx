'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  CircleDollarSign,
  Plus,
  Trash2,
  Edit2,
  Search,
  Filter,
  Loader2,
  X,
  Save,
  TrendingDown,
  Truck,
  Users2,
  Receipt,
  Wrench
} from 'lucide-react'
import { toast, Toaster } from 'react-hot-toast'

interface Expense {
  id: string
  description: string
  category: string
  amount: number
  expense_date: string
  created_at: string
}

const expenseCategories = [
  { val: 'Helper Wages', label: 'Helper Wages', icon: Users2, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  { val: 'Diesel & Transport', label: 'Diesel & Transport', icon: Truck, color: 'text-sky-400', bg: 'bg-sky-500/10' },
  { val: 'Catering & Food', label: 'Catering & Food', icon: Receipt, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { val: 'Maintenance & Repairs', label: 'Maintenance & Repairs', icon: Wrench, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { val: 'Other', label: 'Other Overheads', icon: CircleDollarSign, color: 'text-rose-450', bg: 'bg-rose-500/10' },
]

export default function ExpensesPage() {
  const supabase = createClient()

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Modal form states
  const [modalOpen, setModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Helper Wages')
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchExpenses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('id, description, category, amount, expense_date, created_at')
        .order('expense_date', { ascending: false })

      if (error) throw error
      setExpenses(data || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load expenses list')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchExpenses()

    // Postgres Realtime Sync
    const channel = supabase
      .channel('db-sync-expenses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
        fetchExpenses()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchExpenses, supabase])

  const handleOpenNew = () => {
    setEditingExpense(null)
    setDescription('')
    setCategory('Helper Wages')
    setAmount('')
    setExpenseDate(new Date().toISOString().split('T')[0])
    setModalOpen(true)
  }

  const handleOpenEdit = (exp: Expense) => {
    setEditingExpense(exp)
    setDescription(exp.description)
    setCategory(exp.category)
    setAmount(String(exp.amount))
    setExpenseDate(exp.expense_date)
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim() || Number(amount) <= 0 || !expenseDate) {
      toast.error('Description, valid amount, and date are required')
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Unauthenticated')

      const payload = {
        description: description.trim(),
        category,
        amount: Number(amount),
        expense_date: expenseDate
      }

      if (editingExpense) {
        const { error } = await supabase
          .from('expenses')
          .update(payload)
          .eq('id', editingExpense.id)

        if (error) throw error
        toast.success('Expense record updated')
      } else {
        const { error } = await supabase
          .from('expenses')
          .insert({
            owner_id: user.id,
            ...payload
          })

        if (error) throw error
        toast.success('New expense logged successfully!')
      }

      setModalOpen(false)
      fetchExpenses()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to save expense')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense record?')) return

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Expense deleted')
      fetchExpenses()
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete expense')
    }
  }

  // Calculate metrics for current month memoized
  const { totalMonthlyOutflow, wagesOutflow, dieselOutflow, maintenanceOutflow } = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    const current = expenses.filter((e) => {
      const d = new Date(e.expense_date)
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
    })

    let total = 0
    let wages = 0
    let diesel = 0
    let maintenance = 0

    current.forEach((e) => {
      total += e.amount
      if (e.category === 'Helper Wages') {
        wages += e.amount
      } else if (e.category === 'Diesel & Transport') {
        diesel += e.amount
      } else if (e.category === 'Maintenance & Repairs') {
        maintenance += e.amount
      }
    })

    return {
      totalMonthlyOutflow: total,
      wagesOutflow: wages,
      dieselOutflow: diesel,
      maintenanceOutflow: maintenance
    }
  }, [expenses])

  // Filtering list memoized
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchesSearch = e.description.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [expenses, searchTerm, categoryFilter])

  const renderCategoryIcon = (catVal: string, size = 16, className = '') => {
    const cat = expenseCategories.find(c => c.val === catVal)
    const IconComp = cat ? cat.icon : CircleDollarSign
    return <IconComp size={size} className={className} />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-slate-400">
        <Loader2 className="animate-spin h-6 w-6 text-indigo-500 mr-2" />
        Loading expenses ledger...
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
            <CircleDollarSign className="text-indigo-500" />
            Expenses Ledger
          </h1>
          <p className="text-slate-400 text-sm mt-1">Track event expenditures, wages, fuel transportation, and equipment overheads.</p>
        </div>
        <div>
          <button
            onClick={handleOpenNew}
            className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-indigo-600/15 active:scale-95 cursor-pointer"
          >
            <Plus size={16} className="mr-2" />
            Log Expense
          </button>
        </div>
      </div>

      {/* MONTHLY SUMMARY METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {/* Total Month */}
        <div className="bg-slate-900/30 border border-slate-900 p-4 rounded-xl flex items-center justify-between shadow-lg">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Ledger (Current Month)</p>
            <h4 className="text-xl font-bold text-white mt-1">₹{totalMonthlyOutflow.toLocaleString('en-IN')}</h4>
          </div>
          <TrendingDown size={18} className="text-rose-450 opacity-60" />
        </div>

        {/* Wages Outflow */}
        <div className="bg-slate-900/30 border border-slate-900 p-4 rounded-xl flex items-center justify-between shadow-lg">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Helper Wages</p>
            <h4 className="text-xl font-bold mt-1 text-indigo-400">₹{wagesOutflow.toLocaleString('en-IN')}</h4>
          </div>
          <Users2 size={18} className="text-indigo-400 opacity-60" />
        </div>

        {/* Transport Outflow */}
        <div className="bg-slate-900/30 border border-slate-900 p-4 rounded-xl flex items-center justify-between shadow-lg">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Diesel & Fuel</p>
            <h4 className="text-xl font-bold text-sky-400 mt-1">₹{dieselOutflow.toLocaleString('en-IN')}</h4>
          </div>
          <Truck size={18} className="text-sky-400 opacity-60" />
        </div>

        {/* Maintenance Outflow */}
        <div className="bg-slate-900/30 border border-slate-900 p-4 rounded-xl flex items-center justify-between shadow-lg">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Maintenance & Repair</p>
            <h4 className="text-xl font-bold text-amber-500 mt-1">₹{maintenanceOutflow.toLocaleString('en-IN')}</h4>
          </div>
          <Wrench size={18} className="text-amber-500 opacity-60" />
        </div>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="bg-slate-900/30 backdrop-blur-md border border-slate-900 p-4 rounded-2xl flex flex-col md:flex-row gap-4 mb-6 shadow-xl">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="Search description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-slate-800 rounded-xl bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
          />
        </div>

        <div className="flex gap-2 items-center">
          <Filter size={16} className="text-slate-500" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="block px-3 py-2 border border-slate-800 rounded-xl bg-slate-950/40 text-slate-350 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm cursor-pointer"
          >
            <option value="all">All Categories</option>
            {expenseCategories.map((c) => (
              <option key={c.val} value={c.val}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* LEDGER INDEX TABLE */}
      {filteredExpenses.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/20 border border-slate-900 rounded-2xl">
          <CircleDollarSign className="h-10 w-10 text-slate-705 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">No expense records found.</p>
        </div>
      ) : (
        <div className="bg-slate-900/20 backdrop-blur-md border border-slate-900 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-950/30">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4">Amount Spent</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/50 text-sm">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-900/20 transition-colors">
                    <td className="py-3.5 px-4 text-slate-300 font-medium">
                      {exp.expense_date}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold ${
                        expenseCategories.find(c => c.val === exp.category)?.bg || 'bg-slate-950/40'
                      } ${
                        expenseCategories.find(c => c.val === exp.category)?.color || 'text-slate-400'
                      }`}>
                        {renderCategoryIcon(exp.category, 12)}
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-white font-medium">
                      {exp.description}
                    </td>
                    <td className="py-3.5 px-4 text-white font-semibold">
                      ₹{exp.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(exp)}
                          title="Edit log"
                          className="p-2 rounded-lg bg-slate-950/40 hover:bg-slate-800 border border-slate-850 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(exp.id)}
                          title="Delete log"
                          className="p-2 rounded-lg bg-slate-950/40 hover:bg-rose-950/20 hover:border-rose-900/40 border border-slate-850 text-slate-400 hover:text-rose-450 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE/EDIT MODAL OVERLAY */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/75 backdrop-blur-md select-none">
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
              <h3 className="font-bold text-lg text-white">
                {editingExpense ? 'Edit Expense Log' : 'Log New Expense'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              {/* Description */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">
                  Expense Description
                </label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Helper transport at Royal Garden event"
                  className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 text-sm transition-all"
                />
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/50 text-slate-350 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm cursor-pointer"
                >
                  {expenseCategories.map((c) => (
                    <option key={c.val} value={c.val}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">
                  Spent Amount (INR)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/50 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
                />
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">
                  Expense Date
                </label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="block w-full px-3.5 py-2.5 border border-slate-800 rounded-lg bg-slate-950/50 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
                />
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
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
