import type { User, Job, AdminStats, Alert, Customer, Pricing, CostParams, CostResult } from '~/types'

export const CURRENT_USER: User = {
  id: 'usr_001',
  name: 'John Kamau',
  phone: '0712345678',
  houseNumber: '14B',
  estate: 'Westlands Gardens',
}

export const JOBS: Job[] = [
  {
    id: 'JOB-1042',
    userId: 'usr_001',
    fileName: 'CV_John_Kamau.pdf',
    fileType: 'pdf',
    instructions: null,
    pages: 4,
    copies: 2,
    colorMode: 'bw',
    sides: 'single',
    paperSize: 'A4',
    deliveryType: 'pickup',
    paymentMethod: 'mpesa',
    paymentStatus: 'paid',
    mpesaRef: 'QHX3K8P2',
    status: 'ready',
    cost: 80,
    deliveryFee: 0,
    createdAt: '2026-05-27T09:14:00Z',
    updatedAt: '2026-05-27T09:42:00Z',
    notifySms: true,
    notifyWhatsapp: false,
    adminNotes: '',
  },
  {
    id: 'JOB-1041',
    userId: 'usr_001',
    fileName: null,
    fileType: null,
    instructions: 'Business cards — name: John Kamau, phone: 0712345678, title: Software Engineer. 50 copies, colour, glossy finish.',
    pages: 1,
    copies: 50,
    colorMode: 'color',
    sides: 'single',
    paperSize: 'A5',
    deliveryType: 'delivery',
    paymentMethod: 'mpesa',
    paymentStatus: 'paid',
    mpesaRef: 'QHX2K1P9',
    status: 'delivered',
    cost: 500,
    deliveryFee: 50,
    createdAt: '2026-05-24T14:00:00Z',
    updatedAt: '2026-05-25T10:00:00Z',
    notifySms: true,
    notifyWhatsapp: true,
    adminNotes: 'Delivered at gate.',
  },
  {
    id: 'JOB-1039',
    userId: 'usr_001',
    fileName: 'Maths_Homework.pdf',
    fileType: 'pdf',
    instructions: null,
    pages: 3,
    copies: 1,
    colorMode: 'bw',
    sides: 'single',
    paperSize: 'A4',
    deliveryType: 'pickup',
    paymentMethod: 'pay_on_pickup',
    paymentStatus: 'pay_on_pickup',
    mpesaRef: null,
    status: 'printing',
    cost: 15,
    deliveryFee: 0,
    createdAt: '2026-05-27T08:50:00Z',
    updatedAt: '2026-05-27T09:31:00Z',
    notifySms: true,
    notifyWhatsapp: false,
    adminNotes: '',
  },
]

export const ALL_JOBS: Job[] = [
  ...JOBS,
  {
    id: 'JOB-1043',
    userId: 'usr_002',
    fileName: 'School_Report.pdf',
    fileType: 'pdf',
    instructions: null,
    pages: 6,
    copies: 1,
    colorMode: 'color',
    sides: 'double',
    paperSize: 'A4',
    deliveryType: 'delivery',
    paymentMethod: 'mpesa',
    paymentStatus: 'paid',
    mpesaRef: 'QHX5M3R7',
    status: 'printing',
    cost: 120,
    deliveryFee: 50,
    createdAt: '2026-05-27T09:10:00Z',
    updatedAt: '2026-05-27T09:31:00Z',
    notifySms: true,
    notifyWhatsapp: true,
    adminNotes: '',
    customerName: 'Amina Osei',
    houseNumber: '7A',
    phone: '0723456789',
  },
  {
    id: 'JOB-1044',
    userId: 'usr_003',
    fileName: 'Invoice_Template.docx',
    fileType: 'docx',
    instructions: null,
    pages: 2,
    copies: 5,
    colorMode: 'bw',
    sides: 'single',
    paperSize: 'A4',
    deliveryType: 'pickup',
    paymentMethod: 'mpesa',
    paymentStatus: 'paid',
    mpesaRef: 'QHX9N4T1',
    status: 'ready',
    cost: 50,
    deliveryFee: 0,
    createdAt: '2026-05-27T08:30:00Z',
    updatedAt: '2026-05-27T09:10:00Z',
    notifySms: false,
    notifyWhatsapp: true,
    adminNotes: '',
    customerName: 'Peter Njoroge',
    houseNumber: '22C',
    phone: '0734567890',
  },
  {
    id: 'JOB-1045',
    userId: 'usr_004',
    fileName: null,
    fileType: null,
    instructions: 'Print and laminate one A4 flyer for a birthday party.',
    pages: 1,
    copies: 1,
    colorMode: 'color',
    sides: 'single',
    paperSize: 'A4',
    deliveryType: 'pickup',
    paymentMethod: 'pay_on_pickup',
    paymentStatus: 'pay_on_pickup',
    mpesaRef: null,
    status: 'pending',
    cost: 50,
    deliveryFee: 0,
    createdAt: '2026-05-27T09:45:00Z',
    updatedAt: '2026-05-27T09:45:00Z',
    notifySms: true,
    notifyWhatsapp: false,
    adminNotes: '',
    customerName: 'Grace Wanjiku',
    houseNumber: '3F',
    phone: '0745678901',
  },
]

export const ADMIN_STATS: AdminStats = {
  jobsToday: 14,
  pending: 5,
  completed: 9,
  revenueToday: 640,
}

export const ALERTS: Alert[] = [
  { id: 1, type: 'unpaid',   message: 'House 3F — pay on pickup job waiting',    jobId: 'JOB-1045' },
  { id: 2, type: 'wait',     message: 'House 14B — waiting 42 min, check queue', jobId: 'JOB-1042' },
  { id: 3, type: 'delivery', message: 'House 7A — delivery not yet dispatched',   jobId: 'JOB-1043' },
]

export const CUSTOMERS: Customer[] = [
  { id: 'usr_001', name: 'John Kamau',    houseNumber: '14B', phone: '0712345678', totalJobs: 7,  totalSpent: 1240, payOnPickupCount: 1, mpesaCount: 6  },
  { id: 'usr_002', name: 'Amina Osei',    houseNumber: '7A',  phone: '0723456789', totalJobs: 3,  totalSpent: 380,  payOnPickupCount: 0, mpesaCount: 3  },
  { id: 'usr_003', name: 'Peter Njoroge', houseNumber: '22C', phone: '0734567890', totalJobs: 12, totalSpent: 2100, payOnPickupCount: 2, mpesaCount: 10 },
  { id: 'usr_004', name: 'Grace Wanjiku', houseNumber: '3F',  phone: '0745678901', totalJobs: 2,  totalSpent: 80,   payOnPickupCount: 1, mpesaCount: 1  },
]

export const PRICING: Pricing = {
  bwPerPage: 5,
  colorPerPage: 20,
  doubleSidedMultiplier: 1.8,
  deliveryFee: 50,
}

export function calculateCost({ pages, copies, colorMode, sides, deliveryType }: CostParams): CostResult {
  const perPage = colorMode === 'color' ? PRICING.colorPerPage : PRICING.bwPerPage
  const sidesMult = sides === 'double' ? PRICING.doubleSidedMultiplier : 1
  const printCost = Math.round(pages * copies * perPage * sidesMult)
  const deliveryFee = deliveryType === 'delivery' ? PRICING.deliveryFee : 0
  return { printCost, deliveryFee, total: printCost + deliveryFee }
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = { pending: 'Pending', printing: 'Printing', ready: 'Ready', delivered: 'Delivered' }
  return map[status] ?? status
}

export function getPaymentLabel(method: string): string {
  const map: Record<string, string> = { mpesa: 'M-Pesa', pay_on_pickup: 'Pay on pickup' }
  return map[method] ?? method
}

// ── Admin: Report Data ────────────────────────────────────────────────────────

export const REPORT_DATA = {
  dailyRevenue: [
    { date: '2026-06-17', revenue: 420 },
    { date: '2026-06-18', revenue: 610 },
    { date: '2026-06-19', revenue: 390 },
    { date: '2026-06-20', revenue: 520 },
    { date: '2026-06-21', revenue: 480 },
    { date: '2026-06-22', revenue: 150 },
    { date: '2026-06-23', revenue: 210 },
    { date: '2026-06-24', revenue: 640 },
    { date: '2026-06-25', revenue: 710 },
    { date: '2026-06-26', revenue: 540 },
    { date: '2026-06-27', revenue: 620 },
    { date: '2026-06-28', revenue: 490 },
    { date: '2026-06-29', revenue: 580 },
    { date: '2026-06-30', revenue: 640 },
  ],
  jobsByDayOfWeek: [
    { day: 'Mon', count: 18 },
    { day: 'Tue', count: 22 },
    { day: 'Wed', count: 19 },
    { day: 'Thu', count: 25 },
    { day: 'Fri', count: 30 },
    { day: 'Sat', count: 14 },
    { day: 'Sun', count: 6 },
  ],
  jobsByStatus: [
    { status: 'pending',   count: 5  },
    { status: 'printing',  count: 3  },
    { status: 'ready',     count: 4  },
    { status: 'delivered', count: 47 },
  ],
  averageFulfillmentMinutes: 47,
  paymentMethodSplit: [
    { method: 'mpesa',        count: 38 },
    { method: 'pay_on_pickup', count: 21 },
  ],
  topCustomers: [
    { name: 'John Kamau',   totalSpent: 2450, totalJobs: 14 },
    { name: 'Amina Osei',   totalSpent: 1890, totalJobs: 11 },
    { name: 'Peter Njoroge',totalSpent: 1640, totalJobs: 9  },
    { name: 'Grace Wanjiku',totalSpent: 1210, totalJobs: 7  },
    { name: 'David Mwangi', totalSpent:  980, totalJobs: 6  },
  ],
}

// ── Admin: Settings Dummy ─────────────────────────────────────────────────────

export const SETTINGS_DUMMY = {
  business: {
    name:    'PrintEase Store',
    phone:   '0712345678',
    address: '14 Westlands Avenue, Nairobi',
    hours: {
      mon: { open: true,  from: '07:00', to: '20:00' },
      tue: { open: true,  from: '07:00', to: '20:00' },
      wed: { open: true,  from: '07:00', to: '20:00' },
      thu: { open: true,  from: '07:00', to: '20:00' },
      fri: { open: true,  from: '07:00', to: '20:00' },
      sat: { open: true,  from: '08:00', to: '18:00' },
      sun: { open: false, from: '08:00', to: '14:00' },
    },
  },
  pricing: {
    bwPerPage:              5,
    colorPerPage:          20,
    doubleSidedMultiplier:  1.8,
    deliveryFee:           50,
  },
  notificationMatrix: {
    job_received:      { sms: true,  whatsapp: true,  push: true  },
    payment_confirmed: { sms: true,  whatsapp: true,  push: true  },
    printing_started:  { sms: false, whatsapp: true,  push: true  },
    job_ready:         { sms: true,  whatsapp: true,  push: true  },
    job_delivered:     { sms: true,  whatsapp: false, push: true  },
    payment_failed:    { sms: true,  whatsapp: true,  push: true  },
  },
}

// ── Admin: Staff Dummy ────────────────────────────────────────────────────────

export const STAFF_DUMMY = [
  {
    id:       'staff_001',
    name:     'Admin User',
    phone:    '0700000000',
    role:     'admin'  as const,
    active:   true,
    joinedAt: '2024-01-15T08:00:00.000Z',
  },
  {
    id:       'staff_002',
    name:     'Mary Waweru',
    phone:    '0722111222',
    role:     'clerk' as const,
    active:   true,
    joinedAt: '2024-03-01T08:00:00.000Z',
  },
  {
    id:       'staff_003',
    name:     'James Oduya',
    phone:    '0733444555',
    role:     'clerk' as const,
    active:   false,
    joinedAt: '2024-05-20T08:00:00.000Z',
  },
]
