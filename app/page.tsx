'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Paperclip, ArrowLeft, File, X, Loader2, MessageCircle, Wifi, WifiOff, CheckCheck, Image, Trash2 } from 'lucide-react'

interface Channel { id: number; name: string; description?: string; color?: string }
interface Message { id: number; channel_id: number; sender: string; content: string; attachments: Attachment[]; created_at: string; read_at: string | null }
interface Attachment { url: string; filename: string; type: string; size: number }

const AVATARS: Record<string, string> = {
  cd16: '/cd16-avatar.svg',
  cd7: 'https://q3kmdq0bwilkumjv.public.blob.vercel-storage.com/cd7-avatar-EHTr0BokQe7RGySGt5YLuzgolBJRKh.png',
  cd18: '/cd18-avatar.svg',
}

export default function WhatsApp() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [sender, setSender] = useState('humano')
  const [showSidebar, setShowSidebar] = useState(true)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<Attachment[]>([])
  const [dbInitialized, setDbInitialized] = useState(false)
  const [connected, setConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('Conectando...')
  const [isDragging, setIsDragging] = useState(false)
  const [selectedMessages, setSelectedMessages] = useState<Set<number>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/init').then(r => r.json()).then(() => { setDbInitialized(true); loadChannels() }).catch(console.error)
  }, [])

  const loadChannels = async () => {
    try {
      const res = await fetch('/api/channels')
      const data = await res.json()
      setChannels(data)
      if (data.length > 0 && !selectedChannel) setSelectedChannel(data[0])
    } catch (error) { console.error('Error:', error) }
  }

  const loadMessages = useCallback(async () => {
    if (!selectedChannel) return
    try {
      const res = await fetch(`/api/messages?channel=${selectedChannel.id}&limit=100`)
      const data = await res.json()
      if (Array.isArray(data)) setMessages(data)
    } catch (error) { console.error('Error:', error) }
  }, [selectedChannel])

  useEffect(() => {
    if (!selectedChannel || !dbInitialized) return
    if (eventSourceRef.current) eventSourceRef.current.close()
    
    loadMessages()
    setConnectionStatus('Conectando...')
    
    const eventSource = new EventSource(`/api/subscribe?channel=${selectedChannel.id}`)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => { 
      setConnected(true)
      setConnectionStatus('Tiempo real')
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'connected') { setConnected(true); setConnectionStatus('Tiempo real') }
        else if (data.type === 'message') {
          setMessages(prev => {
            if (prev.find(m => m.id === data.data.id)) return prev
            return [...prev, data.data]
          })
        }
      } catch (e) { console.error('SSE error:', e) }
    }
    eventSource.onerror = () => { 
      setConnected(false)
      setConnectionStatus('Polling...')
      if (!pollingRef.current) {
        pollingRef.current = setInterval(() => {
          loadMessages()
        }, 3000)
      }
    }

    return () => { 
      eventSource.close()
      setConnected(false)
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [selectedChannel, dbInitialized, loadMessages])

  useEffect(() => {
    const container = messagesEndRef.current?.parentElement
    if (container) {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200
      if (isNearBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [messages])

  useEffect(() => {
    if (!selectedChannel || !dbInitialized) return
    
    const interval = setInterval(() => {
      loadMessages()
    }, 3000)
    
    return () => clearInterval(interval)
  }, [selectedChannel, dbInitialized, loadMessages])

  const uploadFile = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const data = await res.json()
    if (data.url) return { url: data.url, filename: data.filename || file.name, type: data.type || file.type, size: data.size || file.size }
    return null
  }

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/') || item.kind === 'file') {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            setUploading(true)
            const uploaded = await uploadFile(file)
            if (uploaded) setPendingFiles(prev => [...prev, uploaded])
            setUploading(false)
          }
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [])

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false) }
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files.length === 0) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const uploaded = await uploadFile(file)
      if (uploaded) setPendingFiles(prev => [...prev, uploaded])
    }
    setUploading(false)
  }

  const handleSend = async () => {
    if ((!newMessage.trim() && pendingFiles.length === 0) || !selectedChannel) return
    
    const msgContent = newMessage.trim() || '📎 Archivo'
    const msgAttachments = [...pendingFiles]
    const tempId = -Date.now()
    
    const tempMsg: Message = {
      id: tempId,
      channel_id: selectedChannel.id,
      sender,
      content: msgContent,
      attachments: msgAttachments,
      created_at: new Date().toISOString(),
      read_at: null
    }
    
    setMessages(prev => [...prev, tempMsg])
    setNewMessage('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setPendingFiles([])
    setLoading(true)
    
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: selectedChannel.id, sender, content: msgContent, attachments: msgAttachments })
      })
      const realMsg = await res.json()
      
      if (realMsg.id) {
        setMessages(prev => prev.map(m => m.id === tempId ? realMsg : m))
      }
    } catch (error) { 
      console.error('Error:', error)
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setNewMessage(msgContent)
      setPendingFiles(msgAttachments)
    }
    setLoading(false)
  }

  const handleDelete = async (msgId: number) => {
    setMessages(prev => prev.filter(m => m.id !== msgId))
    
    try {
      await fetch('/api/messages/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: msgId })
      })
    } catch (error) {
      console.error('Error deleting:', error)
      loadMessages()
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedMessages.size === 0) return
    if (!confirm(`¿Eliminar ${selectedMessages.size} mensaje(s)?`)) return
    
    const idsToDelete = Array.from(selectedMessages)
    
    // Optimistic delete
    setMessages(prev => prev.filter(m => !selectedMessages.has(m.id)))
    setSelectedMessages(new Set())
    setIsSelectionMode(false)
    
    // Delete each message
    for (const msgId of idsToDelete) {
      try {
        await fetch('/api/messages/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: msgId })
        })
      } catch (error) {
        console.error('Error deleting:', error)
      }
    }
  }

  const toggleMessageSelection = (msgId: number) => {
    if (msgId < 0) return // Don't select temp messages
    setSelectedMessages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(msgId)) {
        newSet.delete(msgId)
      } else {
        newSet.add(msgId)
      }
      return newSet
    })
  }

  const handleMessageClick = (e: React.MouseEvent, msgId: number) => {
    e.stopPropagation()
    if (isSelectionMode) {
      toggleMessageSelection(msgId)
    } else {
      // Long press or single click toggles single selection for backwards compat
      if (selectedMessages.has(msgId)) {
        setSelectedMessages(new Set())
      } else {
        setSelectedMessages(new Set([msgId]))
      }
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const uploaded = await uploadFile(file)
      if (uploaded) setPendingFiles(prev => [...prev, uploaded])
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  const isImage = (type: string) => type?.startsWith('image/')
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const isOwnMessage = (s: string) => s === 'humano' || s === 'human'

  const COLOR_MAP: Record<string, string> = {
    red: 'bg-red-500', green: 'bg-green-500', blue: 'bg-blue-500', yellow: 'bg-yellow-500',
    purple: 'bg-purple-500', orange: 'bg-orange-500', pink: 'bg-pink-500', cyan: 'bg-cyan-500',
    teal: 'bg-teal-500', indigo: 'bg-indigo-500', amber: 'bg-amber-500', lime: 'bg-lime-500',
    emerald: 'bg-emerald-500', violet: 'bg-violet-500', fuchsia: 'bg-fuchsia-500', rose: 'bg-rose-500',
    sky: 'bg-sky-500', gray: 'bg-gray-500',
  }

  const renderAvatar = (senderName: string, size: string = 'w-10 h-10', channelColor?: string | null) => {
    const avatarUrl = AVATARS[senderName]
    if (avatarUrl) return <img src={avatarUrl} alt={senderName} className={`${size} rounded-full object-cover`} />
    
    // Priority: 1) channel color from DB, 2) hardcoded legacy map, 3) fallback gray
    const legacyColors: Record<string, string> = { 'General': 'bg-blue-500', 'CD6': 'bg-purple-500', 'CD7': 'bg-green-500', 'CD8': 'bg-cyan-500', 'CD9': 'bg-rose-500', 'CD10': 'bg-amber-500', 'cd6': 'bg-purple-500', 'cd5': 'bg-orange-500', 'cd7': 'bg-green-500', 'cd8': 'bg-cyan-500', 'cd9': 'bg-rose-500', 'cd10': 'bg-amber-500', 'CD11': 'bg-indigo-500', 'cd11': 'bg-indigo-500', 'ia': 'bg-purple-500', 'CD12': 'bg-lime-500', 'cd12': 'bg-lime-500', 'CD13': 'bg-sky-500', 'cd13': 'bg-sky-500', 'CD14': 'bg-teal-500', 'cd14': 'bg-teal-500', 'CD15': 'bg-fuchsia-500', 'cd15': 'bg-fuchsia-500', 'CD16': 'bg-emerald-500', 'cd16': 'bg-emerald-500', 'CD17': 'bg-violet-500', 'cd17': 'bg-violet-500', 'CD18': 'bg-red-500', 'cd18': 'bg-red-500', 'Onboarding': 'bg-yellow-500', 'CD19': 'bg-yellow-500', 'cd19': 'bg-yellow-500', 'CD20': 'bg-pink-500', 'cd20': 'bg-pink-500', 'CG4': 'bg-red-600', 'cg4': 'bg-red-600', 'CG5': 'bg-yellow-500', 'cg5': 'bg-yellow-500', 'CD28': 'bg-red-500', 'cd28': 'bg-red-500', 'CD28-Angel': 'bg-red-500', 'cd28-angel': 'bg-red-500', 'CD37': 'bg-red-600', 'cd37': 'bg-red-600', 'CD37 Mi-Circulo': 'bg-red-600', 'CD38': 'bg-green-600', 'cd38': 'bg-green-600', 'CD37 Marejadas': 'bg-green-600', 'CD38 Debate HOA': 'bg-blue-600', 'cd38-debate': 'bg-blue-600', 'CD38 Mi-Circulo': 'bg-red-600', 'cd38-mi-circulo': 'bg-red-600', 'CD39 Onboarding': 'bg-yellow-500', 'cd39': 'bg-yellow-500', 'cd39-onboarding': 'bg-yellow-500', 'CD39 Carpinteria Placito': 'bg-green-500', 'cd39-carpinteria-placito': 'bg-green-500', 'CD39 Carpinteria': 'bg-green-500', 'CD39 Cierres': 'bg-red-500', 'cd39-cierres': 'bg-red-500', 'CD40': 'bg-yellow-500', 'cd40': 'bg-yellow-500', 'CD40 Onboarding': 'bg-yellow-500', 'CD40 Cheat Sheet': 'bg-green-500', 'CD40 Cheat Sheet 2': 'bg-red-500', 'cd40-cheat-sheet-2': 'bg-red-500', 'cd40-cheat-sheet': 'bg-green-500', 'cd40-onboarding': 'bg-yellow-500', 'CD40 Cheat Sheet 3': 'bg-yellow-500', 'CD40 Law': 'bg-blue-600', 'CD41 Onboarding': 'bg-yellow-400', 'cd41-onboarding': 'bg-yellow-400', 'cd40-law': 'bg-blue-600', 'cd40-cheat-sheet-3': 'bg-yellow-500', 'sistema': 'bg-gray-600' }
    
    const bgClass = (channelColor && COLOR_MAP[channelColor]) || legacyColors[senderName] || 'bg-gray-500'
    return <div className={`${size} rounded-full flex items-center justify-center text-white font-bold ${bgClass}`}>{senderName.charAt(0).toUpperCase()}</div>
  }

  const exitSelectionMode = () => {
    setIsSelectionMode(false)
    setSelectedMessages(new Set())
  }

  return (
    <div className="h-screen flex bg-[#ECE5DD]" onClick={() => { if (!isSelectionMode) setSelectedMessages(new Set()) }}>
      <div className={`${showSidebar || !selectedChannel ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-80 bg-white border-r`}>
        <div className="bg-[#075E54] text-white p-4 flex items-center gap-3">
          <MessageCircle size={28} />
          <div>
            <h1 className="font-bold text-lg">WhatsDuendesApp</h1>
            <p className="text-xs text-green-200">Canal Humano ↔ IA</p>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {channels.map(channel => (
            <div key={channel.id} onClick={() => { setSelectedChannel(channel); setShowSidebar(false); exitSelectionMode() }}
              className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${selectedChannel?.id === channel.id ? 'bg-green-50' : ''}`}>
              <div className="flex items-center gap-3">
                {renderAvatar(channel.name, 'w-12 h-12', channel.color)}
                <div><p className="font-semibold">{channel.name}</p><p className="text-sm text-gray-500">{channel.description || `Canal ${channel.id}`}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedChannel && (
        <div className={`${!showSidebar || !isMobile ? 'flex' : 'hidden'} flex-1 flex flex-col relative`}
          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
          <div className="bg-[#075E54] text-white p-3 flex items-center gap-3 sticky top-0 z-10">
            <button onClick={() => setShowSidebar(true)} className="md:hidden p-1"><ArrowLeft size={24} /></button>
            {renderAvatar(selectedChannel.name, 'w-10 h-10', selectedChannel.color)}
            <div className="flex-1">
              <p className="font-semibold">{selectedChannel.name}</p>
              <p className="text-xs flex items-center gap-1">
                {connected ? <><Wifi size={12} className="text-green-300" /><span className="text-green-200">{connectionStatus}</span></> : <><WifiOff size={12} className="text-red-300" /><span className="text-red-200">{connectionStatus}</span></>}
              </p>
            </div>
            {/* Selection mode toggle */}
            <button 
              onClick={() => { 
                if (isSelectionMode) {
                  exitSelectionMode()
                } else {
                  setIsSelectionMode(true)
                }
              }}
              className={`p-2 rounded-full ${isSelectionMode ? 'bg-white/20' : 'hover:bg-white/10'}`}
              title={isSelectionMode ? 'Cancelar selección' : 'Seleccionar mensajes'}
            >
              {isSelectionMode ? <X size={20} /> : <Trash2 size={20} />}
            </button>
          </div>

          {isDragging && (
            <div className="absolute inset-0 bg-green-500 bg-opacity-20 z-50 flex items-center justify-center border-4 border-dashed border-green-500 m-2 rounded-lg">
              <div className="bg-white p-6 rounded-lg shadow-lg text-center"><Image size={48} className="mx-auto text-green-500 mb-2" /><p className="text-lg font-semibold">Suelta para subir</p></div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" viewBox=\"0 0 60 60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"none\" fill-rule=\"evenodd\"%3E%3Cg fill=\"%23d5dbd6\" fill-opacity=\"0.4\"%3E%3Cpath d=\"M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')" }}>
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500"><p>No hay mensajes aún</p></div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`flex gap-2 ${isOwnMessage(msg.sender) ? 'justify-end' : 'justify-start'}`}>
                  {!isOwnMessage(msg.sender) && renderAvatar(msg.sender, 'w-8 h-8 flex-shrink-0')}
                  <div 
                    className={`relative max-w-[75%] md:max-w-[55%] rounded-lg p-3 shadow cursor-pointer transition-all ${isOwnMessage(msg.sender) ? 'bg-[#DCF8C6] rounded-tr-none' : 'bg-white rounded-tl-none'} ${msg.id < 0 ? 'opacity-70' : ''} ${selectedMessages.has(msg.id) ? 'ring-2 ring-red-500 bg-red-50' : ''}`} 
                    style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
                    onClick={(e) => handleMessageClick(e, msg.id)}
                  >
                    {/* Checkbox for selection mode */}
                    {isSelectionMode && msg.id > 0 && (
                      <div className={`absolute -left-2 -top-2 w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedMessages.has(msg.id) ? 'bg-red-500 border-red-500' : 'bg-white border-gray-400'}`}>
                        {selectedMessages.has(msg.id) && <span className="text-white text-xs">✓</span>}
                      </div>
                    )}
                    
                    {/* Single delete button (non-selection mode) */}
                    {!isSelectionMode && selectedMessages.has(msg.id) && msg.id > 0 && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); if(confirm('¿Eliminar este mensaje?')) handleDelete(msg.id); setSelectedMessages(new Set()) }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-lg hover:bg-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    
                    {!isOwnMessage(msg.sender) && (
                      <p className={`text-xs font-semibold mb-1 ${msg.sender === 'ia' ? 'text-purple-600' : msg.sender === 'cd6' ? 'text-blue-600' : msg.sender === 'cd10' ? 'text-amber-600' : 'text-green-600'}`}>
                        {msg.sender === 'ia' ? '🤖 IA' : msg.sender === 'cd5' ? '🟠 CD5' : msg.sender === 'cd6' ? '🔵 CD6' : msg.sender === 'cd10' ? '🟡 CD10' : msg.sender === 'cd11' ? '🟣 CD11' : msg.sender}
                      </p>
                    )}
                    {msg.attachments?.length > 0 && (
                      <div className="mb-2 space-y-2">
                        {msg.attachments.map((att, i) => (
                          <div key={i}>
                            {isImage(att.type) ? (
                              <img src={att.url} alt={att.filename} className="max-w-full rounded cursor-pointer" onClick={() => window.open(att.url, '_blank')} />
                            ) : (
                              <a href={att.url} target="_blank" className="flex items-center gap-2 p-2 bg-gray-100 rounded hover:bg-gray-200">
                                <File size={20} /><span className="text-sm truncate max-w-[200px]">{att.filename}</span>
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[10px] text-gray-500">{formatTime(msg.created_at)}</span>
                      {isOwnMessage(msg.sender) && (msg.read_at ? <CheckCheck size={14} className="text-blue-500" /> : <CheckCheck size={14} className="text-gray-400" />)}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Floating delete button when messages are selected */}
          {selectedMessages.size > 0 && isSelectionMode && (
            <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-20">
              <button 
                onClick={handleDeleteSelected}
                className="bg-red-500 text-white px-6 py-3 rounded-full shadow-lg hover:bg-red-600 flex items-center gap-2 font-semibold"
              >
                <Trash2 size={20} />
                Eliminar {selectedMessages.size} mensaje{selectedMessages.size > 1 ? 's' : ''}
              </button>
            </div>
          )}

          {pendingFiles.length > 0 && (
            <div className="bg-gray-100 p-2 flex gap-2 overflow-x-auto">
              {pendingFiles.map((file, i) => (
                <div key={i} className="relative bg-white rounded p-2 min-w-[100px]">
                  <button onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><X size={12} /></button>
                  {isImage(file.type) ? <img src={file.url} alt="" className="w-20 h-20 object-cover rounded" /> : <div className="w-20 h-20 flex items-center justify-center"><File size={32} className="text-gray-400" /></div>}
                  <p className="text-[10px] truncate mt-1">{file.filename}</p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-[#F0F0F0] p-3 flex items-end gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="p-2 text-gray-600 hover:text-[#075E54] disabled:opacity-50">
              {uploading ? <Loader2 className="animate-spin" size={24} /> : <Paperclip size={24} />}
            </button>
            <textarea ref={textareaRef} value={newMessage} onChange={e => { setNewMessage(e.target.value); const ta = textareaRef.current; if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 200) + 'px' } }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); const ta = textareaRef.current; if (ta) { ta.style.height = 'auto' } }}}
              placeholder="Escribe un mensaje..." rows={1} className="flex-1 p-3 rounded-2xl border-none outline-none resize-none" style={{ minHeight: '44px', maxHeight: '200px', overflowY: 'auto' }} />
            <button onClick={handleSend} disabled={loading || (!newMessage.trim() && pendingFiles.length === 0)} className="bg-[#075E54] text-white p-3 rounded-full disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
