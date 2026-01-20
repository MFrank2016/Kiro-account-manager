import { useState, useEffect, useRef, useCallback } from 'react'
import { Button, Badge, Input } from '../ui'
import { Trash2, RefreshCw, Download, Search, X, Copy, ChevronDown, ChevronUp, ArrowDownToLine, Pause } from 'lucide-react'

interface LogEntry {
  timestamp: string
  level: string
  category: string
  message: string
  data?: unknown
}

interface ProxyDetailedLogsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// 自定义下拉框组件
interface DropdownOption {
  value: string
  label: string
  icon?: React.ReactNode
}

interface CustomDropdownProps {
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

function CustomDropdown({ value, options, onChange, placeholder, className }: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(opt => opt.value === value)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={dropdownRef} className={`relative ${className || ''}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative h-9 px-3 pr-8 rounded-lg border border-border bg-background/50 text-sm cursor-pointer hover:border-primary/50 focus:border-primary focus:outline-none transition-all flex items-center gap-2 min-w-[120px]"
      >
        {selectedOption?.icon}
        <span className="flex-1 text-left truncate">{selectedOption?.label || placeholder}</span>
        <ChevronDown className={`w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-full py-1 rounded-lg border border-border bg-popover shadow-lg z-50 animate-in fade-in-0 zoom-in-95">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
              className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-accent transition-colors ${
                option.value === value ? 'bg-accent text-accent-foreground' : ''
              }`}
            >
              {option.icon}
              <span>{option.label}</span>
              {option.value === value && (
                <svg className="w-4 h-4 ml-auto text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function ProxyDetailedLogsDialog({ open, onOpenChange }: ProxyDetailedLogsDialogProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const loadLogs = useCallback(async () => {
    try {
      const result = await window.api.proxyGetLogs()
      setLogs(result)
    } catch (error) {
      console.error('Failed to load logs:', error)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setLoading(true)
      loadLogs().finally(() => setLoading(false))
      
      // 每 2 秒刷新一次
      pollIntervalRef.current = setInterval(loadLogs, 2000)
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [open, loadLogs])

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const handleClearLogs = async () => {
    try {
      await window.api.proxyClearLogs()
      setLogs([])
    } catch (error) {
      console.error('Failed to clear logs:', error)
    }
  }

  const handleExportLogs = () => {
    const content = logs.map(log => {
      const dataStr = log.data ? ` | ${JSON.stringify(log.data)}` : ''
      return `[${log.timestamp}] [${log.level}] [${log.category}] ${log.message}${dataStr}`
    }).join('\n')

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `proxy-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.log`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopyLog = (log: LogEntry) => {
    const dataStr = log.data ? `\nData: ${JSON.stringify(log.data, null, 2)}` : ''
    const content = `[${log.timestamp}] [${log.level}] [${log.category}]\n${log.message}${dataStr}`
    navigator.clipboard.writeText(content)
  }

  const toggleExpand = (index: number) => {
    const newExpanded = new Set(expandedLogs)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedLogs(newExpanded)
  }

  // 获取所有类别
  const categories = Array.from(new Set(logs.map(log => log.category))).sort()

  // 过滤日志
  const filteredLogs = logs.filter(log => {
    if (levelFilter !== 'all' && log.level !== levelFilter) return false
    if (categoryFilter !== 'all' && log.category !== categoryFilter) return false
    if (searchText) {
      const search = searchText.toLowerCase()
      return (
        log.message.toLowerCase().includes(search) ||
        log.category.toLowerCase().includes(search) ||
        (log.data && JSON.stringify(log.data).toLowerCase().includes(search))
      )
    }
    return true
  })

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'bg-destructive/20 text-destructive border-destructive/30'
      case 'WARN': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
      case 'INFO': return 'bg-primary/20 text-primary border-primary/30'
      case 'DEBUG': return 'bg-muted text-muted-foreground border-muted'
      default: return 'bg-muted text-muted-foreground border-muted'
    }
  }

  const getLevelRowBg = (level: string) => {
    switch (level) {
      case 'ERROR': return 'bg-destructive/5 hover:bg-destructive/10'
      case 'WARN': return 'bg-yellow-500/5 hover:bg-yellow-500/10'
      case 'INFO': return 'hover:bg-primary/5'
      case 'DEBUG': return 'hover:bg-muted/50'
      default: return 'hover:bg-muted/50'
    }
  }

  const formatTime = (timestamp: string) => {
    try {
      if (!timestamp) return '-'
      const date = new Date(timestamp)
      if (isNaN(date.getTime())) return timestamp || '-'
      return date.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false 
      }) + '.' + date.getMilliseconds().toString().padStart(3, '0')
    } catch {
      return timestamp || '-'
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => onOpenChange(false)}>
      <div 
        className="bg-card border border-border rounded-xl shadow-2xl max-w-[90vw] w-[1200px] h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold">反代详细日志</h2>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="font-mono">
              {filteredLogs.length} / {logs.length} 条
            </Badge>
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-destructive/10 hover:text-destructive" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 工具栏 */}
        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 border-b border-border bg-muted/20 flex-wrap">
          {/* 搜索 */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索日志内容..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-9 pr-9 h-9 bg-background/50 border-border focus:border-primary"
            />
            {searchText && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full"
                onClick={() => setSearchText('')}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          {/* 级别过滤 */}
          <CustomDropdown
            value={levelFilter}
            onChange={setLevelFilter}
            options={[
              { value: 'all', label: '全部级别', icon: <span className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500" /> },
              { value: 'ERROR', label: 'ERROR', icon: <span className="w-3 h-3 rounded-full bg-red-500" /> },
              { value: 'WARN', label: 'WARN', icon: <span className="w-3 h-3 rounded-full bg-yellow-500" /> },
              { value: 'INFO', label: 'INFO', icon: <span className="w-3 h-3 rounded-full bg-blue-500" /> },
              { value: 'DEBUG', label: 'DEBUG', icon: <span className="w-3 h-3 rounded-full bg-gray-400" /> },
            ]}
          />

          {/* 类别过滤 */}
          <CustomDropdown
            value={categoryFilter}
            onChange={setCategoryFilter}
            className="min-w-[140px]"
            options={[
              { value: 'all', label: '全部类别', icon: <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg> },
              ...categories.map(cat => ({ 
                value: cat, 
                label: cat,
                icon: <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>
              }))
            ]}
          />

          <div className="h-6 w-px bg-border" />

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadLogs}
              disabled={loading}
              className="h-9 px-3 hover:border-primary/50"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportLogs}
              disabled={logs.length === 0}
              className="h-9 px-3 hover:border-primary/50"
            >
              <Download className="w-4 h-4 mr-1.5" />
              导出
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearLogs}
              disabled={logs.length === 0}
              className="h-9 px-3 text-destructive hover:bg-destructive/10 hover:border-destructive/50"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              清空
            </Button>
          </div>

          <div className="h-6 w-px bg-border" />

          {/* 自动滚动 */}
          <Button
            variant={autoScroll ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoScroll(!autoScroll)}
            className="h-9 px-3"
          >
            {autoScroll ? (
              <>
                <ArrowDownToLine className="w-4 h-4 mr-1.5" />
                自动滚动
              </>
            ) : (
              <>
                <Pause className="w-4 h-4 mr-1.5" />
                暂停滚动
              </>
            )}
          </Button>
        </div>

        {/* 日志列表 */}
        <div className="flex-1 overflow-auto bg-muted/10" ref={scrollRef}>
          <div className="p-3 font-mono text-xs space-y-0.5">
            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm">{logs.length === 0 ? '暂无日志记录' : '没有匹配的日志'}</span>
                {logs.length === 0 && (
                  <span className="text-xs mt-1 opacity-70">发起反代请求后日志将显示在这里</span>
                )}
              </div>
            ) : (
              filteredLogs.map((log, index) => {
                const isExpanded = expandedLogs.has(index)
                const hasData = log.data !== undefined && log.data !== null

                return (
                  <div
                    key={index}
                    className={`group rounded-lg px-3 py-2 transition-colors ${getLevelRowBg(log.level)}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* 时间 */}
                      <span className="text-muted-foreground whitespace-nowrap flex-shrink-0 tabular-nums">
                        {formatTime(log.timestamp)}
                      </span>

                      {/* 级别 */}
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] px-1.5 py-0.5 flex-shrink-0 font-semibold ${getLevelColor(log.level)}`}
                      >
                        {log.level}
                      </Badge>

                      {/* 类别 */}
                      <span className="text-primary/80 flex-shrink-0 font-medium">[{log.category}]</span>

                      {/* 消息 */}
                      <span className="flex-1 break-all text-foreground/90">{log.message}</span>

                      {/* 操作按钮 */}
                      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                        {hasData && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-6 h-6 rounded-full hover:bg-primary/10"
                            onClick={() => toggleExpand(index)}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-6 h-6 rounded-full hover:bg-primary/10"
                          onClick={() => handleCopyLog(log)}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* 展开的数据 */}
                    {isExpanded && hasData && (
                      <pre className="mt-2 ml-24 p-3 rounded-lg bg-muted/50 border border-border text-primary overflow-x-auto text-[11px]">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
