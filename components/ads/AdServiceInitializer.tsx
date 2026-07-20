'use client'

import { useEffect } from 'react'
import { AdService } from '@/lib/adService'

export default function AdServiceInitializer() {
  useEffect(() => {
    AdService.initialize()
  }, [])

  return null
}
