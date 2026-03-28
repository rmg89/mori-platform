'use client'
import { useState, useRef } from 'react'
import { Sparkles, Upload, X, Copy, Check, RefreshCw, Image as ImageIcon } from 'lucide-react'

const TONES = [
  { id: 'professional', label: 'Professional', desc: 'Polished, authoritative' },
  { id: 'inspiring',    label: 'Inspiring',    desc: 'Motivational, uplifting' },
  { id: 'conversational', label: 'Conversational', desc: 'Warm, approachable' },
  { id: 'bold',         label: 'Bold',         desc: 'Direct, powerful' },
]

export default function AIToolsPage() {
  const [imageDesc, setImageDesc] = useState('')
  const [prompt, setPrompt] = useState('')
  const [tone, setTone] = useState('inspiring')
  const [preview, setPreview] = useState<string | null>(null)
  const [captions, setCaptions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    // Auto-populate description hint
    setImageDesc(`Photo: ${file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')}`)
  }

  const handleGenerate = async () => {
    if (!imageDesc && !prompt) return
    setLoading(true)
    setCaptions([])

    try {
      const res = await fetch('/api/ai/instagram-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_description: imageDesc, topic_prompt: prompt, tone }),
      })
      const data = await res.json()
      setCaptions(data.captions || [])
    } catch {
      setCaptions(['Error generating captions. Please check your API key and try again.'])
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = (idx: number, text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(idx)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-ink-800 flex items-center justify-center">
            <Sparkles size={16} className="text-gold" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-ink">AI Tools</h1>
        </div>
        <p className="text-ink-400 text-sm">Claude-powered tools to support Mori's content and communications.</p>
        <div className="accent-line mt-3 w-24" />
      </div>

      {/* Tool card */}
      <div className="bg-white border border-ink-100 rounded-2xl overflow-hidden">
        {/* Card header */}
        <div className="px-7 py-5 border-b border-ink-100 bg-parchment flex items-center gap-3">
          <ImageIcon size={18} className="text-gold" />
          <div>
            <h2 className="font-display text-lg font-semibold">Instagram Caption Generator</h2>
            <p className="text-xs text-ink-400">Upload a photo or describe it, add a direction, and get 3 polished caption options.</p>
          </div>
        </div>

        <div className="p-7 grid grid-cols-2 gap-8">
          {/* Inputs */}
          <div className="space-y-5">
            {/* Image upload */}
            <div>
              <label className="block text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">
                Photo (optional)
              </label>
              {preview ? (
                <div className="relative rounded-xl overflow-hidden border border-ink-100">
                  <img src={preview} alt="Preview" className="w-full h-40 object-cover" />
                  <button
                    onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value = '' }}
                    className="absolute top-2 right-2 p-1 bg-ink/70 text-white rounded-full hover:bg-ink transition-all"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full h-32 border-2 border-dashed border-ink-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-gold/40 hover:bg-parchment transition-all text-ink-400"
                >
                  <Upload size={20} />
                  <span className="text-xs">Click to upload image</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
            </div>

            {/* Image description */}
            <div>
              <label className="block text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">
                Photo Description
              </label>
              <textarea
                value={imageDesc}
                onChange={e => setImageDesc(e.target.value)}
                placeholder="Describe the photo — setting, mood, what's happening, who's in it..."
                className="w-full h-24 text-sm bg-parchment border border-ink-100 rounded-xl p-3.5 outline-none focus:border-gold/40 resize-none placeholder:text-ink-300 transition-all"
              />
            </div>

            {/* Topic / direction */}
            <div>
              <label className="block text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">
                Topic or Direction *
              </label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="e.g. 'Keynote at Wharton — talking about negotiation and finding your voice' or 'Celebrating the new book launch'"
                className="w-full h-24 text-sm bg-parchment border border-ink-100 rounded-xl p-3.5 outline-none focus:border-gold/40 resize-none placeholder:text-ink-300 transition-all"
              />
            </div>

            {/* Tone */}
            <div>
              <label className="block text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">
                Tone
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TONES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTone(t.id)}
                    className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                      tone === t.id
                        ? 'border-gold/50 bg-gold/10 text-ink'
                        : 'border-ink-100 hover:border-ink-200 text-ink-500'
                    }`}
                  >
                    <p className="font-medium text-xs">{t.label}</p>
                    <p className="text-[10px] text-ink-400 mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading || (!imageDesc && !prompt)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-ink text-cream rounded-xl text-sm font-medium hover:bg-ink-700 transition-all disabled:opacity-40"
            >
              {loading ? (
                <><RefreshCw size={14} className="animate-spin" /> Generating with Claude…</>
              ) : (
                <><Sparkles size={14} /> Generate Captions</>
              )}
            </button>
          </div>

          {/* Output */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Generated Captions</p>

            {!loading && captions.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-ink-300 py-16">
                <Sparkles size={32} className="mb-3 opacity-30" />
                <p className="text-sm text-center">Captions will appear here.<br />Fill in the inputs and click Generate.</p>
              </div>
            )}

            {loading && (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-28 bg-parchment rounded-xl animate-pulse" />
                ))}
              </div>
            )}

            {captions.map((caption, i) => (
              <div key={i} className="relative group bg-parchment border border-ink-100 rounded-xl p-4 animate-slide-up hover:border-gold/30 transition-all">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] font-semibold text-gold uppercase tracking-widest mb-2">Option {i + 1}</p>
                  <button
                    onClick={() => handleCopy(i, caption)}
                    className="flex items-center gap-1 text-[10px] text-ink-400 hover:text-gold transition-all opacity-0 group-hover:opacity-100"
                  >
                    {copied === i ? <Check size={11} className="text-sage" /> : <Copy size={11} />}
                    {copied === i ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-wrap">{caption}</p>
              </div>
            ))}

            {captions.length > 0 && (
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-ink-200 text-ink-500 text-xs rounded-xl hover:bg-parchment transition-all"
              >
                <RefreshCw size={12} />
                Regenerate
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Future tools placeholder */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        {['Email Newsletter Draft', 'LinkedIn Post Generator'].map(tool => (
          <div key={tool} className="bg-white border border-dashed border-ink-200 rounded-2xl px-6 py-5 flex items-center gap-3 opacity-50">
            <Sparkles size={16} className="text-ink-300" />
            <div>
              <p className="text-sm font-medium text-ink-500">{tool}</p>
              <p className="text-xs text-ink-300">Coming soon</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
