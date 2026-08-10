export type ColorMode = 'bw' | 'color'
export type SideMode = 'single' | 'double'
export type PaperSize = 'A4' | 'A5' | 'Letter' | 'Legal'
export type DeliveryType = 'pickup' | 'delivery'
export type PaymentMethod = 'mpesa' | 'pay_on_pickup'
export type PaymentStatus = 'paid' | 'unpaid' | 'pay_on_pickup'
export type JobStatus = 'pending' | 'printing' | 'ready' | 'delivered'
export type UserRole = 'customer' | 'clerk' | 'admin'
export type AlertType = 'unpaid' | 'wait' | 'delivery'

export interface User {
  id: string
  name: string
  phone: string
  houseNumber?: string
  estate?: string
  role?: UserRole
  notifSms?: boolean
  notifWhatsapp?: boolean
  creditBalance?: number
  loyaltyPoints?: number
}

export interface Job {
  id: string
  userId: string
  fileName: string | null
  fileType: string | null
  instructions: string | null
  pages: number
  copies: number
  colorMode: ColorMode
  sides: SideMode
  paperSize: PaperSize
  deliveryType: DeliveryType
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  mpesaRef: string | null
  status: JobStatus
  cost: number
  deliveryFee: number
  createdAt: string
  updatedAt: string
  notifySms: boolean
  notifyWhatsapp: boolean
  adminNotes: string
  total?: number
  // Admin-enriched display fields (present only in the admin queue)
  customerName?: string
  houseNumber?: string
  phone?: string
}

export interface AdminStats {
  jobsToday: number
  pending: number
  completed: number
  revenueToday: number
}

export interface Alert {
  id: number
  type: AlertType
  message: string
  jobId: string
}

export interface Customer {
  id: string
  name: string
  houseNumber: string
  phone: string
  totalJobs: number
  totalSpent: number
  payOnPickupCount: number
  mpesaCount: number
}

export interface Pricing {
  bwPerPage: number
  colorPerPage: number
  doubleSidedMultiplier: number
  deliveryFee: number
}

export interface CostParams {
  pages: number
  copies: number
  colorMode: ColorMode
  sides: SideMode
  deliveryType: DeliveryType
}

export interface CostResult {
  printCost: number
  deliveryFee: number
  total: number
}

export interface LoginPayload {
  phone: string
  password: string
}

export interface SignupPayload {
  name: string
  phone: string
  houseNumber: string
  estate: string
  password: string
  confirm?: string
}

export interface SubmitJobPayload {
  fileId?: string
  fileName: string | null
  instructions: string
  copies: number
  colorMode: ColorMode
  sides: SideMode
  paperSize: PaperSize
  deliveryType: DeliveryType
  pages: number
  paymentMethod?: PaymentMethod
}

export interface AppNotification {
  id: string
  jobId: string
  trigger: string
  channel: 'sms' | 'whatsapp' | 'push'
  status: 'sent' | 'failed'
  sentAt: string
}

// ── Admin: Reports ────────────────────────────────────────────────────────────

export interface ReportData {
  dailyRevenue: { date: string; revenue: number }[]
  jobsByDayOfWeek: { day: string; count: number }[]
  jobsByStatus: { status: string; count: number }[]
  averageFulfillmentMinutes: number
  paymentMethodSplit: { method: string; count: number }[]
  topCustomers: { name: string; totalSpent: number; totalJobs: number }[]
}

// ── Admin: Settings ───────────────────────────────────────────────────────────

export interface DayHours {
  open: boolean
  from: string
  to: string
}

export interface BusinessHours {
  mon: DayHours; tue: DayHours; wed: DayHours
  thu: DayHours; fri: DayHours; sat: DayHours; sun: DayHours
}

export interface BusinessInfo {
  name: string
  phone: string
  address: string
  hours: BusinessHours
}

export interface NotificationChannelPrefs {
  sms: boolean
  whatsapp: boolean
  push: boolean
}

export type NotificationTrigger =
  | 'job_received'
  | 'payment_confirmed'
  | 'printing_started'
  | 'job_ready'
  | 'job_delivered'
  | 'payment_failed'

export type NotificationMatrix = Record<NotificationTrigger, NotificationChannelPrefs>

export interface SettingsState {
  business: BusinessInfo
  pricing: Pricing
  notificationMatrix: NotificationMatrix
}

// ── Admin: Staff ──────────────────────────────────────────────────────────────

export interface StaffMember {
  id: string
  name: string
  phone: string
  role: 'admin' | 'clerk'
  active: boolean
  joinedAt: string
}

// Augment vue-router RouteMeta with our custom page meta fields
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    role?: UserRole
  }
}
