'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, Lock, Loader2 } from 'lucide-react'

export default function Login() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      
      const data = await res.json()
      
      if (data.success) {
        router.push('/')
        router.refresh()
      } else {
        setError('Contraseña incorrecta')
      }
    } catch (err) {
      setError('Error de conexión')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#ECE5DD] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="bg-[#075E54] w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle size={40} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">WhatsDuendesApp</h1>
          <p className="text-gray-500 mt-2">Canal privado Humano ↔ IA</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full pl-12 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#075E54]"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-[#075E54] text-white py-3 rounded-lg font-semibold hover:bg-opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
