'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Message {
  id: number
  channel_id: number
  sender: string
  content: string
  attachments: any[] | null
  created_at: string
}

interface Channel {
  id: number
  name: string
  created_at: string
}

export default function Home() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const [files, setFiles] = useState<File[]>([])
  const [dragActive, setDragActive] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [installPrompt, setInstallPrompt] = useState<any>(null)

  // Load channels
  useEffect(() => {
    fetch('/api/channels')
      .then(res => res.json())
      .then(data => {
        setChannels(data.channels || [])
        if (data.channels?.length > 0) {
          setSelectedChannel(data.channels[0])
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Load messages when channel changes
  useEffect(() => {
    if (!selectedChannel) return
    
    const loadMessages = () => {
      fetch(`/api/messages?channel_id=${selectedChannel.id}&limit=100`)
        .then(res => res.json())
        .then(data => setMessages(data.messages || []))
    }
    
    loadMessages()
    const interval = setInterval(loadMessages, 5000) // Polling 5s
    return () => clearInterval(interval)
  }, [selectedChannel])

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // PWA Install prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const result = await installPrompt.userChoice
    if (result.outcome === 'accepted') {
      setInstallPrompt(null)
    }
  }

  const handleSend = async () => {
    if ((!newMessage.trim() && files.length === 0) || !selectedChannel || sending) return
    
    setSending(true)
    try {
      let attachments: any[] = []
      
      // Upload files first
      if (files.length > 0) {
        for (const file of files) {
          const formData = new FormData()
          formData.append('file', file)
          const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
          const uploadData = await uploadRes.json()
          if (uploadData.url) {
            attachments.push({
              url: uploadData.url,
              filename: file.name,
              type: file.type,
              size: file.size
            })
          }
        }
      }
      
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: selectedChannel.id,
          sender: 'human',
          content: newMessage || (files.length > 0 ? '📎 Archivo adjunto' : ''),
          attachments: attachments.length > 0 ? attachments : null
        })
      })
      
      setNewMessage('')
      setFiles([])
      
      // Refresh messages
      const res = await fetch(`/api/messages?channel_id=${selectedChannel.id}&limit=100`)
      const data = await res.json()
      setMessages(data.messages || [])
    } catch (err) {
      console.error('Error sending:', err)
    }
    setSending(false)
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)])
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)])
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-whatsapp-green">
        <div className="text-white text-xl animate-pulse">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar - Channels */}
      <div className={`${showSidebar ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-80 bg-whatsapp-sidebar border-r border-gray-700 ${selectedChannel && 'hidden md:flex'}`}>
        {/* Header */}
        <div className="bg-whatsapp-dark p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-whatsapp-green flex items-center justify-center text-white font-bold">
              🐝
            </div>
            <span className="text-white font-semibold">WhatsDuendes</span>
          </div>
          {installPrompt && (
            <button onClick={handleInstall} className="text-xs bg-whatsapp-light text-white px-2 py-1 rounded">
              Instalar
            </button>
          )}
        </div>
        
        {/* Channel List */}
        <div className="flex-1 overflow-y-auto">
          {channels.map(channel => (
            <div
              key={channel.id}
              onClick={() => { setSelectedChannel(channel); setShowSidebar(false) }}
              className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-whatsapp-dark/50 border-b border-gray-700/50 ${selectedChannel?.id === channel.id ? 'bg-whatsapp-dark/70' : ''}`}
            >
              <div className="w-12 h-12 rounded-full bg-whatsapp-teal flex items-center justify-center text-white text-lg">
                {channel.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="text-white font-medium">{channel.name}</div>
                <div className="text-gray-400 text-sm truncate">Canal de comunicación</div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Footer */}
        <div className="p-2 text-center text-gray-500 text-xs border-t border-gray-700">
          Hecho con 🧡 por Colmena 2026
        </div>
      </div>

      {/* Chat Area */}
      {selectedChannel ? (
        <div 
          className="flex-1 flex flex-col h-full"
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {/* Chat Header */}
          <div className="bg-whatsapp-dark p-3 flex items-center gap-3 shadow-md">
            <button 
              onClick={() => setShowSidebar(true)} 
              className="md:hidden text-white text-xl"
            >
              ←
            </button>
            <div className="w-10 h-10 rounded-full bg-whatsapp-teal flex items-center justify-center text-white font-bold">
              {selectedChannel.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="text-white font-medium">{selectedChannel.name}</div>
              <div className="text-green-400 text-xs">En línea</div>
            </div>
          </div>

          {/* Messages */}
          <div className={`flex-1 overflow-y-auto p-4 chat-bg scrollbar-hide ${dragActive ? 'bg-green-100' : ''}`}>
            {dragActive && (
              <div className="fixed inset-0 bg-green-500/20 flex items-center justify-center z-50 pointer-events-none">
                <div className="bg-white p-6 rounded-xl shadow-lg text-center">
                  <div className="text-4xl mb-2">📎</div>
                  <div className="text-gray-600">Suelta para adjuntar</div>
                </div>
              </div>
            )}
            
            {messages.map(msg => (
              <div 
                key={msg.id} 
                className={`flex mb-2 ${msg.sender === 'human' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] px-3 py-2 shadow ${msg.sender === 'human' ? 'message-sent' : 'message-received'}`}>
                  {/* Attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mb-2">
                      {msg.attachments.map((att: any, i: number) => (
                        <div key={i}>
                          {att.type?.startsWith('image/') ? (
                            <img src={att.url} alt={att.filename} className="max-w-full rounded mb-1" />
                          ) : (
                            <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm flex items-center gap-1">
                              📄 {att.filename}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-gray-800 whitespace-pre-wrap break-words">{msg.content}</div>
                  <div className="text-gray-500 text-xs text-right mt-1">
                    {formatTime(msg.created_at)}
                    {msg.sender === 'human' && <span className="ml-1 text-blue-500">✓✓</span>}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* File Preview */}
          {files.length > 0 && (
            <div className="bg-gray-100 px-4 py-2 flex gap-2 flex-wrap">
              {files.map((file, i) => (
                <div key={i} className="bg-white rounded px-2 py-1 flex items-center gap-2 text-sm shadow">
                  <span className="truncate max-w-[100px]">{file.name}</span>
                  <button onClick={() => removeFile(i)} className="text-red-500 font-bold">×</button>
                </div>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="bg-whatsapp-input p-2 flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              className="hidden"
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-600 hover:bg-gray-200 rounded-full"
            >
              📎
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Escribe un mensaje..."
              className="flex-1 px-4 py-2 rounded-full border-none outline-none bg-white"
            />
            <button
              onClick={handleSend}
              disabled={sending || (!newMessage.trim() && files.length === 0)}
              className="p-2 bg-whatsapp-green text-white rounded-full disabled:opacity-50"
            >
              {sending ? '⏳' : '➤'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-whatsapp-dark">
          <div className="text-center text-gray-400">
            <div className="text-6xl mb-4">💬</div>
            <div>Selecciona un canal para comenzar</div>
          </div>
        </div>
      )}
    </div>
  )
}
