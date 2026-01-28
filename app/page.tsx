'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Paperclip, ArrowLeft, File, X, Loader2, MessageCircle, Wifi, WifiOff, Check, CheckCheck } from 'lucide-react'

interface Channel { id: number; name: string; description?: string }
interface Message { id: number; channel_id: number; sender: string; content: string; attachments: Attachment[]; created_at: string; read_at: string | null }
interface Attachment { url: string; filename: string; type: string; size: number }

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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

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
      setMessages(Array.isArray(data) ? data : [])
    } catch (error) { console.error('Error:', error) }
  }, [selectedChannel])

  useEffect(() => {
    if (!selectedChannel || !dbInitialized) return
    if (eventSourceRef.current) eventSourceRef.current.close()
    
    loadMessages()
    setConnectionStatus('Conectando...')
    
    const eventSource = new EventSource(`/api/subscribe?channel=${selectedChannel.id}`)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => { setConnected(true); setConnectionStatus('🟢 Tiempo real') }
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'connected') { setConnected(true); setConnectionStatus('🟢 Tiempo real') }
        else if (data.type === 'message') {
          setMessages(prev => {
            if (prev.find(m => m.id === data.data.id)) return prev
            return [...prev, data.data]
          })
        }
      } catch (e) { console.error('SSE error:', e) }
    }
    eventSource.onerror = () => { setConnected(false); setConnectionStatus('🔴 Reconectando...') }

    return () => { eventSource.close(); setConnected(false) }
  }, [selectedChannel, dbInitialized, loadMessages])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleSend = async () => {
    if ((!newMessage.trim() && pendingFiles.length === 0) || !selectedChannel) return
    setLoading(true)
    try {
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: selectedChannel.id, sender, content: newMessage.trim() || '📎 Archivo', attachments: pendingFiles })
      })
      setNewMessage('')
      setPendingFiles([])
      if (!connected) loadMessages()
    } catch (error) { console.error('Error:', error) }
    setLoading(false)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    setUploading(true)
    for (const file of Array.from(files)) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        const data = await res.json()
        if (data.url) setPendingFiles(prev => [...prev, { url: data.url, filename: data.filename, type: data.type, size: data.size }])
      } catch (error) { console.error('Upload error:', error) }
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  const isImage = (type: string) => type?.startsWith('image/')
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const isOwnMessage = (s: string) => s === 'humano' || s === 'human'

  return (
    <div className="h-screen flex bg-[#ECE5DD]">
      {/* Sidebar */}
      <div className={`${showSidebar || !selectedChannel ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-80 bg-white border-r`}>
        <div className="bg-[#075E54] text-white p-4 flex items-center gap-3">
          <MessageCircle size={28} />
          <div>
            <h1 className="font-bold text-lg">WhatsDuendesApp</h1>
            <p className="text-xs text-green-200">Canal Humano ↔ IA</p>
          </div>
        </div>
        
        <div className="p-3 bg-gray-50 border-b">
          <select value={sender} onChange={e => setSender(e.target.value)} className="w-full p-2 rounded border text-sm">
            <option value="humano">👤 Humano</option>
            <option value="ia">🤖 IA</option>
            <option value="cd6">🔵 CD6</option>
            <option value="cd7">🟢 CD7</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {channels.map(channel => (
            <div key={channel.id} onClick={() => { setSelectedChannel(channel); setShowSidebar(false) }}
              className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${selectedChannel?.id === channel.id ? 'bg-green-50' : ''}`}>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold ${
                  channel.name === 'General' ? 'bg-blue-500' : channel.name === 'CD6' ? 'bg-purple-500' : 'bg-green-500'}`}>
                  {channel.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold">{channel.name}</p>
                  <p className="text-sm text-gray-500">{channel.description || 'Canal'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat */}
      {selectedChannel && (
        <div className={`${!showSidebar || !isMobile ? 'flex' : 'hidden'} flex-1 flex flex-col`}>
          <div className="bg-[#075E54] text-white p-3 flex items-center gap-3">
            <button onClick={() => setShowSidebar(true)} className="md:hidden p-1"><ArrowLeft size={24} /></button>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
              selectedChannel.name === 'General' ? 'bg-blue-500' : selectedChannel.name === 'CD6' ? 'bg-purple-500' : 'bg-green-500'}`}>
              {selectedChannel.name.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="font-semibold">{selectedChannel.name}</p>
              <p className="text-xs flex items-center gap-1">
                {connected ? <Wifi size={12} className="text-green-300" /> : <WifiOff size={12} className="text-red-300" />}
                <span className={connected ? 'text-green-200' : 'text-red-200'}>{connectionStatus}</span>
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" viewBox=\"0 0 60 60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"none\" fill-rule=\"evenodd\"%3E%3Cg fill=\"%23d5dbd6\" fill-opacity=\"0.4\"%3E%3Cpath d=\"M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')" }}>
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500"><p>No hay mensajes aún</p></div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`flex ${isOwnMessage(msg.sender) ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] md:max-w-[60%] rounded-lg p-3 shadow ${
                    isOwnMessage(msg.sender) ? 'bg-[#DCF8C6] rounded-tr-none' : 'bg-white rounded-tl-none'}`}
                    style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                    {!isOwnMessage(msg.sender) && (
                      <p className={`text-xs font-semibold mb-1 ${msg.sender === 'ia' ? 'text-purple-600' : msg.sender === 'cd6' ? 'text-blue-600' : 'text-green-600'}`}>
                        {msg.sender === 'ia' ? '🤖 IA' : msg.sender === 'cd6' ? '🔵 CD6' : '🟢 CD7'}
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
                    <p className="text-sm whitespace-pre-wrap" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{msg.content}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[10px] text-gray-500">{formatTime(msg.created_at)}</span>
                      {isOwnMessage(msg.sender) && (
                        <span className={msg.read_at ? 'text-blue-500' : 'text-gray-400'}>
                          <CheckCheck size={14} />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

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
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="p-2 text-gray-600 hover:text-[#075E54] disabled:opacity-50">
              {uploading ? <Loader2 className="animate-spin" size={24} /> : <Paperclip size={24} />}
            </button>
            <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }}}
              placeholder="Escribe un mensaje..." rows={1} className="flex-1 p-3 rounded-full border-none outline-none resize-none max-h-32" style={{ minHeight: '44px' }} />
            <button onClick={handleSend} disabled={loading || (!newMessage.trim() && pendingFiles.length === 0)} className="bg-[#075E54] text-white p-3 rounded-full disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
