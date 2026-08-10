import type { ReportData } from '~/types'

export function useAdminReports() {
  async function fetchReportData(): Promise<ReportData> {
    const api = useApi()
    const res = await api<any>('/admin/reports')
    return res.data as ReportData
  }

  return { fetchReportData }
}
