'use client'

import React from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'

interface AreaChartComponentProps {
  data: any[]
}

export default function AreaChartComponent({ data }: AreaChartComponentProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
        <YAxis
          yAxisId="left"
          stroke="#94a3b8"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000) + 'k' : v}`}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="#10b981"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{ background: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
          labelStyle={{ color: '#fff', fontWeight: 'bold' }}
        />
        <Legend verticalAlign="top" height={36} iconType="circle" />
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="Revenue (₹)"
          stroke="#4f46e5"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorRevenue)"
        />
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="Bookings"
          stroke="#10b981"
          strokeWidth={2}
          fill="none"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
