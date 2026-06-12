import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

/** Safely coerce any value to an array */
const toArray = (value) => (Array.isArray(value) ? value : [])

/** Safely read a string property — never throws on undefined/null */
const safeStr = (value) => (typeof value === 'string' ? value : '')

/** Safely format a date — returns fallback for invalid values */
const safeDate = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

const filters = ['All', 'High', 'Low']
const sortOptions = ['Latest', 'Severity']
const API_URL = import.meta.env.VITE_API_URL || ''
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''
const sampleCve = {
  cveId: 'CVE-2024-3094',
  severity: 'High',
  cvssScore: '10.0',
  publishedDate: '2024-03-29',
  description:
    'Malicious code was discovered in XZ Utils versions 5.6.0 and 5.6.1 that could affect SSH authentication on some Linux distributions.',
  affectedVersions: ['xz 5.6.0', 'xz 5.6.1'],
  references: ['https://www.cve.org/CVERecord?id=CVE-2024-3094'],
}

function App() {
  const [data, setData] = useState([])
  const [filter, setFilter] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortOption, setSortOption] = useState('Latest')
  const [aiHealth, setAiHealth] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiResult, setAiResult] = useState(null)
  const [chatQuestion, setChatQuestion] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState('')
  const [chatAnswer, setChatAnswer] = useState('')

  const fetchData = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await axios.get(API_URL, { timeout: 15000 })
      const result = response.data
      if (Array.isArray(result)) {
        setData(result)
      } else if (result && typeof result === 'object') {
        // Handle wrapped responses like { vulnerabilities: [...] }
        const nested = Object.values(result).find(Array.isArray)
        setData(nested || [])
      } else {
        setData([])
      }
    } catch (err) {
      if (err.code === 'ECONNABORTED') {
        setError('Request timed out. The server may be slow — retrying soon.')
      } else if (err.response) {
        setError(`Server error (${err.response.status}). Please try again.`)
      } else if (err.request) {
        setError('Network error — unable to reach the server.')
      } else {
        setError('Unable to load vulnerability data. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const intervalId = setInterval(fetchData, 10000)
    return () => clearInterval(intervalId)
  }, [])

  useEffect(() => {
    const checkAiHealth = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/api/ai/health`, { timeout: 10000 })
        setAiHealth(response.data || { configured: false, provider: 'groq', model: 'unknown' })
      } catch (err) {
        setAiHealth({ configured: false, provider: 'groq', model: 'unknown' })
      }
    }

    checkAiHealth()
  }, [])

  const runAiCheck = async () => {
    setAiLoading(true)
    setAiError('')
    setAiResult(null)

    try {
      const response = await axios.post(`${BACKEND_URL}/api/ai/orchestrate-cve`, {
        cveData: sampleCve,
      }, { timeout: 30000 })
      setAiResult(response.data?.data || null)
    } catch (err) {
      if (err.code === 'ECONNABORTED') {
        setAiError('AI request timed out. The model may be busy — try again.')
      } else {
        setAiError(err.response?.data?.error || err.message || 'AI check failed.')
      }
    } finally {
      setAiLoading(false)
    }
  }

  const runChat = async () => {
    if (!chatQuestion.trim()) {
      setChatError('Please enter a question.')
      return
    }

    setChatLoading(true)
    setChatError('')
    setChatAnswer('')

    try {
      const response = await axios.post(`${BACKEND_URL}/api/chat`, {
        question: chatQuestion.trim(),
      }, { timeout: 30000 })
      setChatAnswer(response.data?.answer || 'No answer returned.')
    } catch (err) {
      if (err.code === 'ECONNABORTED') {
        setChatError('Chat request timed out. Please try again.')
      } else {
        setChatError(err.response?.data?.error || err.message || 'Chat request failed.')
      }
    } finally {
      setChatLoading(false)
    }
  }

  const counts = useMemo(() => {
    const safeData = toArray(data)
    const high = safeData.filter((item) => item?.severity === 'High').length
    const low = safeData.filter((item) => item?.severity === 'Low').length
    return {
      total: safeData.length,
      high,
      low,
    }
  }, [data])

  const chartData = useMemo(
    () => [
      { name: 'High', value: counts.high, fill: '#ef4444' },
      { name: 'Low', value: counts.low, fill: '#22c55e' },
    ],
    [counts.high, counts.low]
  )

  const filteredData = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return toArray(data)
      .filter((item) => {
        if (!item) return false
        if (filter === 'High') return item.severity === 'High'
        if (filter === 'Low') return item.severity === 'Low'
        return true
      })
      .filter((item) => {
        if (!normalizedSearch) return true
        return (
          safeStr(item.server).toLowerCase().includes(normalizedSearch) ||
          safeStr(item.code).toLowerCase().includes(normalizedSearch) ||
          safeStr(item.issue).toLowerCase().includes(normalizedSearch) ||
          safeStr(item.severity).toLowerCase().includes(normalizedSearch)
        )
      })
      .sort((a, b) => {
        if (sortOption === 'Severity') {
          const severityOrder = { High: 1, Low: 2 }
          return (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3)
        }
        return new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
      })
  }, [data, filter, searchTerm, sortOption])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 rounded-[32px] border border-slate-200 bg-white px-6 py-6 shadow-sm sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.24em] text-indigo-600">
              Security Operations
            </p>
            <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
              Vulnerability Dashboard
            </h1>
            <p className="mt-2 text-slate-500">
              Continuous visibility into vulnerability severity and response.
            </p>
          </div>
          <div className="rounded-3xl bg-slate-50 px-4 py-3 text-sm text-slate-600 shadow-sm">
            Auto-refresh every 10 seconds
          </div>
        </header>

        <section className="mb-8 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-indigo-600">
                AI Integration Check
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-900">Groq CVE analyzer</h2>
              <p className="mt-2 text-sm text-slate-500">
                Backend: {BACKEND_URL} / Model: {aiHealth?.model || 'checking...'}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${aiHealth?.configured
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                  }`}
              >
                {aiHealth?.configured ? 'API key configured' : 'API key missing'}
              </span>
              <button
                type="button"
                onClick={runAiCheck}
                disabled={aiLoading}
                className="rounded-2xl border border-slate-900 bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {aiLoading ? 'Running...' : 'Run AI workflow 123'}
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-[32px] border border-slate-200 bg-slate-50 p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-indigo-600">
                  RAG Chat
                </p>
                <h3 className="mt-3 text-xl font-semibold text-slate-900">Ask a security question</h3>
                <p className="mt-2 text-sm text-slate-500">
                  Send a question to the backend RAG chat endpoint and get an answer.
                </p>
              </div>
              <button
                type="button"
                onClick={runChat}
                disabled={chatLoading}
                className="rounded-2xl border border-slate-900 bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {chatLoading ? 'Asking...' : 'Send question'}
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <textarea
                rows={3}
                value={chatQuestion}
                onChange={(event) => setChatQuestion(event.target.value)}
                placeholder="What firewall issue exists?"
                className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />

              {chatError && (
                <div className="rounded-3xl bg-rose-50 p-4 text-sm text-rose-700">
                  {chatError}
                </div>
              )}

              {chatAnswer && (
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Chat answer</p>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{chatAnswer}</p>
                </div>
              )}
            </div>
          </div>

          {aiError && (
            <div className="mt-5 rounded-3xl bg-rose-50 p-5 text-sm text-rose-700">
              {aiError}
            </div>
          )}

          {aiResult && (
            <div className="mt-6 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="rounded-3xl border border-rose-100 bg-rose-50 p-5">
                <p className="text-sm text-rose-700">Workflow status</p>
                <p className="mt-3 text-3xl font-semibold text-rose-800">{aiResult.status}</p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">Executive summary</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {aiResult.outputs?.summary?.executiveSummary || aiResult.outputs?.analysis?.summary}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:col-span-2">
                <p className="text-sm font-semibold text-slate-900">Risk and impact</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Priority: {aiResult.outputs?.summary?.priority || 'N/A'} / Risk score:{' '}
                  {aiResult.outputs?.riskAssessment?.riskScore || 'N/A'}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {aiResult.outputs?.riskAssessment?.businessImpact || aiResult.outputs?.analysis?.impact}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 lg:col-span-2">
                <p className="text-sm font-semibold text-slate-900">Immediate actions</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {toArray(aiResult.outputs?.summary?.immediateActions || aiResult.outputs?.remediation?.remediationSteps).map((step, index) => (
                    <div key={`${step}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                        Step {index + 1}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 lg:col-span-2">
                <p className="text-sm font-semibold text-emerald-900">Owner guidance</p>
                <p className="mt-2 text-sm leading-6 text-emerald-800">
                  {aiResult.outputs?.summary?.ownerGuidance || aiResult.outputs?.analysis?.recommendations}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 lg:col-span-2">
                <p className="text-sm font-semibold text-slate-900">Workflow steps</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {toArray(aiResult.steps).map((step, index) => (
                    <div key={step?.name || index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                        {step?.status || 'Unknown'}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{step?.name || 'Unnamed step'}</p>
                      {step?.error && <p className="mt-2 text-sm leading-6 text-rose-700">{step.error}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-slate-500">Total vulnerabilities</p>
                <p className="mt-3 text-4xl font-semibold text-slate-900">{counts.total}</p>
              </div>
              <div className="rounded-3xl border border-rose-100 bg-rose-50/80 p-6 shadow-sm">
                <p className="text-sm text-rose-700">High severity</p>
                <p className="mt-3 text-4xl font-semibold text-rose-800">{counts.high}</p>
              </div>
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50/80 p-6 shadow-sm">
                <p className="text-sm text-emerald-700">Low severity</p>
                <p className="mt-3 text-4xl font-semibold text-emerald-800">{counts.low}</p>
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap gap-3">
                  {filters.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setFilter(option)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition duration-150 ${option === filter
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-100'
                        }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search issues, servers, codes..."
                    aria-label="Search vulnerabilities"
                    className="w-full min-w-[180px] rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 sm:max-w-xs"
                  />
                  <select
                    value={sortOption}
                    onChange={(event) => setSortOption(event.target.value)}
                    className="w-full min-w-[160px] rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 sm:w-auto"
                  >
                    {sortOptions.map((option) => (
                      <option key={option} value={option}>
                        Sort by {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="rounded-3xl bg-slate-50 p-8 text-center text-slate-600">Loading...</div>
              ) : error ? (
                <div className="rounded-3xl bg-rose-50 p-8 text-center text-rose-700">{error}</div>
              ) : null}
            </div>

            {!loading && !error && (
              <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Server
                        </th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Code
                        </th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Issue
                        </th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Severity
                        </th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Timestamp
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredData.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="px-6 py-12 text-center text-sm text-slate-500">
                            No vulnerabilities match the selected filters.
                          </td>
                        </tr>
                      ) : (
                        filteredData.map((item, index) => (
                          <tr key={`${safeStr(item?.server)}-${safeStr(item?.timestamp)}-${index}`}>
                            <td className="px-6 py-4 text-sm text-slate-900">{item?.server || '—'}</td>
                            <td className="px-6 py-4 text-sm text-slate-900">{item?.code || '—'}</td>
                            <td className="px-6 py-4 text-sm text-slate-900">{item?.issue || '—'}</td>
                            <td className="px-6 py-4 text-sm">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${item?.severity === 'High'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-emerald-100 text-emerald-700'
                                  }`}
                              >
                                {item?.severity || 'Unknown'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-500">
                              {safeDate(item?.timestamp)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <section className="space-y-6 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-indigo-600">
                Severity distribution
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-900">Current risk profile</h2>
              <p className="mt-2 text-sm text-slate-500">
                Visual summary of high versus low issue counts.
              </p>
            </div>

            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={72}
                    outerRadius={110}
                    paddingAngle={4}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [value, 'Count']}
                    wrapperStyle={{ fontSize: '0.9rem' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm text-slate-500">High severity</p>
                <p className="mt-3 text-3xl font-semibold text-rose-700">{counts.high}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm text-slate-500">Low severity</p>
                <p className="mt-3 text-3xl font-semibold text-emerald-700">{counts.low}</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default App
