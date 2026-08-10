<template>
  <div class="space-y-5 max-w-4xl">

    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Settings</h1>
      <p class="text-sm text-gray-500 mt-0.5">Manage your store configuration</p>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto">
      <button
        v-for="tab in tabs"
        :key="tab"
        @click="activeTab = tab"
        :class="[
          'px-4 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
          activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
        ]"
      >{{ tab }}</button>
    </div>

    <div v-if="loading" class="space-y-4">
      <AdminSkeletonCard v-for="i in 3" :key="i" />
    </div>

    <template v-else-if="settings">

      <!-- ── Business tab ──────────────────────────────────────────────────── -->
      <template v-if="activeTab === 'Business'">
        <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
          <h2 class="font-bold text-gray-900">Store information</h2>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-gray-500 mb-1.5">Store name</label>
              <input v-model="settings.business.name" type="text" class="input-field" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-500 mb-1.5">Phone number</label>
              <input v-model="settings.business.phone" type="text" class="input-field" />
            </div>
            <div class="sm:col-span-2">
              <label class="block text-xs font-semibold text-gray-500 mb-1.5">Address</label>
              <input v-model="settings.business.address" type="text" class="input-field" />
            </div>
          </div>

          <div>
            <h3 class="font-semibold text-gray-900 text-sm mb-3">Business hours</h3>
            <div class="space-y-2">
              <div
                v-for="day in dayKeys"
                :key="day"
                class="flex items-center gap-4 py-2 border-b border-gray-50 last:border-0"
              >
                <span class="w-8 text-sm font-medium text-gray-700 capitalize">{{ day }}</span>
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <div
                    @click="settings.business.hours[day].open = !settings.business.hours[day].open"
                    :class="['w-9 h-5 rounded-full flex items-center px-0.5 cursor-pointer transition-colors', settings.business.hours[day].open ? 'bg-primary' : 'bg-gray-200']"
                  >
                    <div :class="['w-4 h-4 rounded-full bg-white shadow transition-transform', settings.business.hours[day].open ? 'translate-x-4' : '']" />
                  </div>
                  <span class="text-xs text-gray-500">{{ settings.business.hours[day].open ? 'Open' : 'Closed' }}</span>
                </label>
                <template v-if="settings.business.hours[day].open">
                  <input v-model="settings.business.hours[day].from" type="time" class="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  <span class="text-gray-400 text-xs">to</span>
                  <input v-model="settings.business.hours[day].to" type="time" class="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/30" />
                </template>
              </div>
            </div>
          </div>

          <button @click="saveSettings" class="save-btn">Save changes</button>
        </div>
      </template>

      <!-- ── Pricing tab ───────────────────────────────────────────────────── -->
      <template v-else-if="activeTab === 'Pricing'">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <h2 class="font-bold text-gray-900">Pricing configuration</h2>

            <div>
              <label class="block text-xs font-semibold text-gray-500 mb-1.5">B&W per page (KES)</label>
              <input v-model.number="settings.pricing.bwPerPage" type="number" min="1" class="input-field" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-500 mb-1.5">Colour per page (KES)</label>
              <input v-model.number="settings.pricing.colorPerPage" type="number" min="1" class="input-field" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-500 mb-1.5">Double-sided multiplier</label>
              <input v-model.number="settings.pricing.doubleSidedMultiplier" type="number" step="0.1" min="1" class="input-field" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-500 mb-1.5">Delivery fee (KES)</label>
              <input v-model.number="settings.pricing.deliveryFee" type="number" min="0" class="input-field" />
            </div>

            <button @click="saveSettings" class="save-btn">Save pricing</button>
          </div>

          <!-- Live preview -->
          <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <h2 class="font-bold text-gray-900">Live preview</h2>
            <p class="text-xs text-gray-400">Cost estimate for a typical job:</p>

            <div class="space-y-3">
              <div v-for="ex in pricingExamples" :key="ex.label" class="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                <div>
                  <p class="text-sm font-medium text-gray-700">{{ ex.label }}</p>
                  <p class="text-xs text-gray-400">{{ ex.desc }}</p>
                </div>
                <p class="font-bold text-gray-900">KES {{ ex.cost }}</p>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- ── Staff tab ─────────────────────────────────────────────────────── -->
      <template v-else-if="activeTab === 'Staff'">
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="font-bold text-gray-900">Staff members</h2>
            <button @click="addModalOpen = true" class="save-btn">
              <span class="material-symbols-outlined" style="font-size:16px;">add</span>
              Add staff
            </button>
          </div>

          <div class="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-gray-50 border-b border-gray-100 text-left">
                  <th class="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Name</th>
                  <th class="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400 hidden sm:table-cell">Phone</th>
                  <th class="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Role</th>
                  <th class="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Status</th>
                  <th class="px-5 py-3 w-12" />
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-50">
                <tr v-for="member in adminStore.staff" :key="member.id" class="hover:bg-gray-50 transition-colors">
                  <td class="px-5 py-3">
                    <p class="font-medium text-gray-900">{{ member.name }}</p>
                    <p class="text-xs text-gray-400">Joined {{ formatDate(member.joinedAt) }}</p>
                  </td>
                  <td class="px-5 py-3 text-gray-600 hidden sm:table-cell">{{ member.phone }}</td>
                  <td class="px-5 py-3">
                    <span :class="['px-2.5 py-1 rounded-full text-xs font-semibold capitalize', member.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600']">
                      {{ member.role }}
                    </span>
                  </td>
                  <td class="px-5 py-3">
                    <span :class="['px-2.5 py-1 rounded-full text-xs font-semibold', member.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500']">
                      {{ member.active ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td class="px-5 py-3">
                    <button
                      v-if="member.active"
                      @click="() => { deactivateTarget = member.id; confirmOpen = true }"
                      class="text-xs text-red-500 hover:text-red-700 font-medium"
                    >Deactivate</button>
                    <button
                      v-else
                      @click="adminStore.reactivateStaff(member.id)"
                      class="text-xs text-green-600 hover:text-green-800 font-medium"
                    >Reactivate</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Add staff modal -->
        <Transition name="overlay">
          <div
            v-if="addModalOpen"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            @click.self="addModalOpen = false"
          >
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
              <h3 class="font-bold text-gray-900">Add staff member</h3>

              <div>
                <label class="block text-xs font-semibold text-gray-500 mb-1.5">Full name</label>
                <input v-model="newStaff.name" type="text" class="input-field" placeholder="Jane Doe" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-500 mb-1.5">Phone</label>
                <input v-model="newStaff.phone" type="text" class="input-field" placeholder="0712345678" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-500 mb-1.5">Password</label>
                <input v-model="newStaff.password" type="password" class="input-field" placeholder="Min 8 characters" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-500 mb-1.5">Role</label>
                <select v-model="newStaff.role" class="input-field">
                  <option value="clerk">Clerk</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div class="flex gap-3 pt-2">
                <button @click="addModalOpen = false" class="flex-1 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                <button @click="addStaff" :disabled="addingStaff" class="flex-1 save-btn disabled:opacity-50">
                  {{ addingStaff ? 'Adding…' : 'Add member' }}
                </button>
              </div>
            </div>
          </div>
        </Transition>

        <!-- Deactivate confirm -->
        <AdminConfirmDialog
          v-model="confirmOpen"
          title="Deactivate staff member?"
          description="This staff member will lose access to the admin panel. You can reactivate them at any time."
          confirm-label="Deactivate"
          :danger="true"
          @confirm="doDeactivate"
        />
      </template>

      <!-- ── Notifications tab ──────────────────────────────────────────────── -->
      <template v-else>
        <div class="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div class="px-5 py-3.5 border-b border-gray-100">
            <h2 class="font-bold text-gray-900">Notification matrix</h2>
            <p class="text-xs text-gray-400 mt-0.5">Choose which channels fire for each event. Changes save automatically.</p>
          </div>
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-100 text-left">
                <th class="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Event</th>
                <th class="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400 text-center">SMS</th>
                <th class="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400 text-center">WhatsApp</th>
                <th class="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400 text-center">Push</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <tr v-for="trigger in notifTriggers" :key="trigger.key" class="hover:bg-gray-50 transition-colors">
                <td class="px-5 py-3.5">
                  <p class="font-medium text-gray-900">{{ trigger.label }}</p>
                </td>
                <td v-for="channel in ['sms', 'whatsapp', 'push'] as const" :key="channel" class="px-5 py-3.5 text-center">
                  <button
                    @click="toggleNotif(trigger.key, channel)"
                    :class="[
                      'w-9 h-5 rounded-full flex items-center px-0.5 transition-colors mx-auto',
                      settings.notificationMatrix[trigger.key]?.[channel] ? 'bg-primary' : 'bg-gray-200',
                    ]"
                  >
                    <div :class="['w-4 h-4 rounded-full bg-white shadow transition-transform', settings.notificationMatrix[trigger.key]?.[channel] ? 'translate-x-4' : '']" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

    </template>

  </div>
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { SettingsState, NotificationTrigger } from '~/types'

definePageMeta({ layout: 'admin', middleware: 'auth', requiresAuth: true, role: 'admin' })

const adminStore = useAdminStore()

const tabs      = ['Business', 'Pricing', 'Staff', 'Notifications']
const activeTab = ref('Business')
const loading   = ref(false)

const settings = ref<SettingsState | null>(null)

const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

const notifTriggers: { key: NotificationTrigger; label: string }[] = [
  { key: 'job_received',      label: 'Job received'          },
  { key: 'payment_confirmed', label: 'Payment confirmed'     },
  { key: 'printing_started',  label: 'Printing started'      },
  { key: 'job_ready',         label: 'Job ready for pickup'  },
  { key: 'job_delivered',     label: 'Job delivered'         },
  { key: 'payment_failed',    label: 'Payment failed'        },
]

// ── Pricing preview ──────────────────────────────────────────────────────────
const pricingExamples = computed(() => {
  if (!settings.value) return []
  const p = settings.value.pricing
  return [
    {
      label: '10 pages B&W, 1 copy',
      desc:  'Single-sided, pickup',
      cost:  Math.round(10 * 1 * p.bwPerPage * 1),
    },
    {
      label: '5 pages colour, 2 copies',
      desc:  'Single-sided, pickup',
      cost:  Math.round(5 * 2 * p.colorPerPage * 1),
    },
    {
      label: '20 pages B&W, 1 copy',
      desc:  'Double-sided, delivery',
      cost:  Math.round(20 * 1 * p.bwPerPage * p.doubleSidedMultiplier) + p.deliveryFee,
    },
  ]
})

// ── Staff ────────────────────────────────────────────────────────────────────
const addModalOpen    = ref(false)
const addingStaff     = ref(false)
const confirmOpen     = ref(false)
const deactivateTarget = ref<string | null>(null)

const newStaff = reactive({ name: '', phone: '', password: '', role: 'clerk' as 'clerk' | 'admin' })

async function addStaff() {
  if (!newStaff.name || !newStaff.phone || !newStaff.password) {
    toast.error('Please fill all fields')
    return
  }
  addingStaff.value = true
  await adminStore.createStaff({ ...newStaff })
  Object.assign(newStaff, { name: '', phone: '', password: '', role: 'clerk' })
  addingStaff.value = false
  addModalOpen.value = false
}

async function doDeactivate() {
  if (!deactivateTarget.value) return
  await adminStore.deactivateStaff(deactivateTarget.value)
  deactivateTarget.value = null
}

// ── Notifications auto-save ──────────────────────────────────────────────────
let notifTimer: ReturnType<typeof setTimeout> | null = null

function toggleNotif(trigger: NotificationTrigger, channel: 'sms' | 'whatsapp' | 'push') {
  if (!settings.value) return
  settings.value.notificationMatrix[trigger][channel] = !settings.value.notificationMatrix[trigger][channel]
  if (notifTimer) clearTimeout(notifTimer)
  notifTimer = setTimeout(() => {
    adminStore.saveSettings({ notificationMatrix: settings.value!.notificationMatrix })
  }, 800)
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-KE', { year: 'numeric', month: 'short' })
}

async function saveSettings() {
  if (!settings.value) return
  await adminStore.saveSettings(settings.value)
}

onMounted(async () => {
  loading.value = true
  await Promise.all([
    adminStore.fetchSettings(),
    adminStore.fetchStaff(),
  ])
  settings.value = adminStore.settings
  loading.value = false
})
</script>

<style scoped>
.input-field {
  @apply w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors;
}
.save-btn {
  @apply flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-all active:scale-[0.98] hover:opacity-90;
  background-color: #021745;
}
.overlay-enter-active, .overlay-leave-active { transition: opacity 0.18s ease; }
.overlay-enter-from, .overlay-leave-to { opacity: 0; }
</style>
