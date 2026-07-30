<template>
  <div class="text-on-background min-h-screen flex flex-col bg-background">

    <!-- TopAppBar -->
    <header class="fixed top-0 w-full z-50 flex justify-between items-center px-margin-mobile h-12 bg-primary-container">
      <div class="flex items-center gap-sm">
        <button @click="handleBack" aria-label="Go back" class="text-on-primary active:scale-95 transition-transform p-1">
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
        <span class="font-headline-md text-headline-md font-bold text-on-primary">PrintEase</span>
      </div>
      <div class="flex items-center gap-xs">
        <span class="material-symbols-outlined text-on-primary">print</span>
      </div>
    </header>

    <main class="flex-grow pt-20 pb-24 px-margin-mobile max-w-2xl mx-auto w-full">

      <!-- Step indicator with labels and colored connectors -->
      <div class="flex justify-between items-center mb-xl max-w-xs mx-auto">
        <template v-for="(label, i) in stepLabels" :key="i">
          <div class="flex flex-col items-center gap-1">
            <div
              :class="['w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors',
                i <= step ? 'step-active' : 'step-inactive']"
            >{{ i + 1 }}</div>
            <span
              :class="['font-label-bold text-label-bold',
                i <= step ? 'text-on-surface' : 'text-on-surface-variant']"
            >{{ label }}</span>
          </div>
          <!-- Connector line between steps -->
          <div
            v-if="i < stepLabels.length - 1"
            :class="['h-[2px] flex-grow mx-2 mb-5 transition-colors',
              i < step ? 'bg-secondary-container' : 'bg-surface-container']"
          ></div>
        </template>
      </div>

      <!-- ── Step 1: Upload ── -->
      <section v-if="step === 0" class="space-y-xl">
        <h1 class="font-headline-lg-mobile text-headline-lg-mobile text-primary">Upload your file</h1>

        <!-- Upload area -->
        <div
          class="dashed-border bg-surface-container-low p-xl flex flex-col items-center justify-center gap-md cursor-pointer hover:bg-surface-container transition-colors active:scale-[0.98] rounded-xl"
          :class="{ 'bg-secondary-fixed': selectedFile }"
          @click="triggerFileInput"
        >
          <div class="w-16 h-16 rounded-full bg-primary-container/10 flex items-center justify-center">
            <span class="material-symbols-outlined text-primary text-[40px]">
              {{ selectedFile ? 'task' : 'upload_file' }}
            </span>
          </div>
          <div class="text-center">
            <p class="font-body-lg text-body-lg text-on-surface font-semibold">
              {{ selectedFile ? selectedFile.name : 'Tap to upload your file' }}
            </p>
            <p class="font-body-sm text-body-sm text-on-surface-variant">
              {{ selectedFile ? formatFileSize(selectedFile.size) : 'PDF, Word, JPEG, PNG supported' }}
            </p>
          </div>
          <input
            ref="fileInputRef"
            type="file"
            class="hidden"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            @change="handleFileChange"
          />
        </div>

        <!-- OR divider -->
        <div class="flex items-center gap-md">
          <div class="h-[1px] flex-grow bg-outline-variant"></div>
          <span class="font-label-bold text-label-bold text-on-surface-variant">OR</span>
          <div class="h-[1px] flex-grow bg-outline-variant"></div>
        </div>

        <!-- Instructions textarea -->
        <div class="space-y-sm">
          <label class="font-label-bold text-label-bold text-on-surface-variant">Special Instructions</label>
          <textarea
            v-model="form.instructions"
            class="w-full h-32 p-md bg-surface-container-lowest border border-outline-variant focus:ring-2 focus:ring-secondary focus:border-secondary outline-none transition-all font-body-lg text-body-lg placeholder:text-on-surface-variant/50 rounded-xl resize-none"
            placeholder="Type your print instructions here..."
          />
        </div>

        <p v-if="stepError" class="text-error font-body-sm text-body-sm">{{ stepError }}</p>
      </section>

      <!-- ── Step 2: Print settings ── -->
      <section v-if="step === 1" class="mt-md">
        <h2 class="font-headline-md text-headline-md text-primary mb-lg font-bold">Print settings</h2>

        <div class="bg-surface-container-low p-md space-y-md rounded-xl">

          <!-- Copies -->
          <div class="flex items-center justify-between py-xs border-b border-outline-variant/30 pb-md">
            <span class="font-body-lg text-body-lg text-on-surface">Copies</span>
            <div class="flex items-center gap-md bg-surface-container-lowest border border-outline-variant rounded-lg p-xs">
              <button
                @click="form.copies = Math.max(1, form.copies - 1)"
                class="w-10 h-10 flex items-center justify-center text-primary active:scale-90 transition-transform"
              >
                <span class="material-symbols-outlined">remove</span>
              </button>
              <span class="font-bold text-body-lg w-6 text-center">{{ form.copies }}</span>
              <button
                @click="form.copies++"
                class="w-10 h-10 flex items-center justify-center text-primary active:scale-90 transition-transform"
              >
                <span class="material-symbols-outlined">add</span>
              </button>
            </div>
          </div>

          <!-- Colour mode -->
          <div class="flex items-center justify-between py-xs border-b border-outline-variant/30 pb-md">
            <span class="font-body-lg text-body-lg text-on-surface">Colour mode</span>
            <div class="flex p-1 bg-surface-container-high rounded-lg">
              <button
                v-for="opt in colorOpts" :key="opt.val"
                @click="form.colorMode = opt.val"
                :class="['px-sm py-xs font-label-bold text-label-bold rounded transition-colors',
                  form.colorMode === opt.val
                    ? 'bg-surface-container-lowest text-primary'
                    : 'text-on-surface-variant']"
              >{{ opt.label }}</button>
            </div>
          </div>

          <!-- Sides -->
          <div class="flex items-center justify-between py-xs border-b border-outline-variant/30 pb-md">
            <span class="font-body-lg text-body-lg text-on-surface">Sides</span>
            <div class="flex p-1 bg-surface-container-high rounded-lg">
              <button
                v-for="opt in sideOpts" :key="opt.val"
                @click="form.sides = opt.val"
                :class="['px-sm py-xs font-label-bold text-label-bold rounded transition-colors',
                  form.sides === opt.val
                    ? 'bg-surface-container-lowest text-primary'
                    : 'text-on-surface-variant']"
              >{{ opt.label }}</button>
            </div>
          </div>

          <!-- Paper size -->
          <div class="flex items-center justify-between py-xs">
            <span class="font-body-lg text-body-lg text-on-surface">Paper size</span>
            <div class="relative w-32">
              <select
                v-model="form.paperSize"
                class="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-sm py-xs font-label-bold text-label-bold text-primary appearance-none focus:ring-2 focus:ring-secondary-container outline-none"
              >
                <option>A4</option>
                <option>Letter</option>
                <option>A5</option>
                <option>Legal</option>
              </select>
              <span class="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">expand_more</span>
            </div>
          </div>
        </div>

        <!-- Word conversion accuracy note -->
        <div v-if="isWordDoc" class="mt-md flex items-start gap-sm bg-surface-container-low p-md rounded-lg">
          <span class="material-symbols-outlined text-on-surface-variant text-[20px] flex-shrink-0 mt-0.5">info</span>
          <p class="font-body-sm text-body-sm text-on-surface-variant font-normal">
            We convert Word documents to PDF for printing, so spacing or line breaks may shift very slightly. Please check the preview before confirming your order.
          </p>
        </div>

        <!-- Document preview -->
        <div class="mt-xl relative rounded-lg overflow-hidden bg-surface-container-high aspect-[3/2] flex items-center justify-center">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDyX81hZCZCCbGJjWL52Nh0S03AAlIIssBjKUdnFoPqEXq522MNi7j9iuas7ItIbQY0T9AKDE00QDBpj6HVBh09u2jcfH-lYkQdW-SqDwmCzDYvheUp4XeCH5KzVDaNfXYU2SKvJ5F4QpPeX4a3QX_7MeCCRBtCofDBHzoQ9L5PEzhLAPLNHH4DQbIAlVLROlL0WfnAlxjIq0-KrI1CSveLdpN6ZUXlo77sSCdI3CUdJiRgjg4ThCfIr8oeZBqy_AOWlg3BSycH4B0"
            alt="Paper stack preview"
            class="w-full h-full object-cover mix-blend-multiply opacity-80"
          />
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="bg-on-primary/90 p-md rounded-lg border border-outline-variant flex gap-sm items-center">
              <span class="material-symbols-outlined text-secondary-container" style="font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;">description</span>
              <span class="font-label-bold text-label-bold text-primary">
                {{ selectedFile ? selectedFile.name : 'Previewing document.pdf' }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Step 3: Delivery ── -->
      <section v-if="step === 2">
        <h1 class="font-headline-lg-mobile text-headline-lg-mobile text-primary-container mb-xl text-center font-bold">
          How should we get your documents to you?
        </h1>

        <div class="space-y-md">
          <!-- Pickup card -->
          <div
            @click="form.deliveryType = 'pickup'"
            :class="[
              'p-lg rounded-xl border-2 flex items-center gap-md cursor-pointer transition-all active:scale-[0.98]',
              form.deliveryType === 'pickup'
                ? 'border-secondary-container bg-white'
                : 'bg-surface-container border-transparent'
            ]"
          >
            <div
              :class="[
                'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0',
                form.deliveryType === 'pickup'
                  ? 'bg-secondary-fixed text-on-secondary-fixed'
                  : 'bg-surface-container-highest text-primary-container'
              ]"
            >
              <span class="material-symbols-outlined text-[32px]">house</span>
            </div>
            <div class="flex-grow">
              <h3 class="font-headline-md text-headline-md text-primary-container font-bold">Pickup</h3>
              <p class="font-body-sm text-body-sm text-on-surface-variant font-normal">Come collect from us — free</p>
            </div>
            <span
              v-if="form.deliveryType === 'pickup'"
              class="material-symbols-outlined text-secondary-container"
              style="font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;"
            >check_circle</span>
          </div>

          <!-- Delivery card -->
          <div
            @click="form.deliveryType = 'delivery'"
            :class="[
              'p-lg rounded-xl border-2 flex items-center gap-md cursor-pointer transition-all active:scale-[0.98]',
              form.deliveryType === 'delivery'
                ? 'border-secondary-container bg-white'
                : 'bg-surface-container border-transparent'
            ]"
          >
            <div
              :class="[
                'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0',
                form.deliveryType === 'delivery'
                  ? 'bg-secondary-fixed text-on-secondary-fixed'
                  : 'bg-surface-container-highest text-primary-container'
              ]"
            >
              <span class="material-symbols-outlined text-[32px]">local_shipping</span>
            </div>
            <div class="flex-grow">
              <h3 class="font-headline-md text-headline-md text-primary-container font-bold">Delivery</h3>
              <p class="font-body-sm text-body-sm text-on-surface-variant font-normal">Delivered to your house — KES 50 fee</p>
            </div>
            <span
              v-if="form.deliveryType === 'delivery'"
              class="material-symbols-outlined text-secondary-container"
              style="font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;"
            >check_circle</span>
          </div>
        </div>

        <!-- Info note -->
        <div class="mt-xl flex items-start gap-sm bg-surface-container-low p-md rounded-lg">
          <span class="material-symbols-outlined text-on-surface-variant text-[20px] flex-shrink-0 mt-0.5">info</span>
          <p class="font-body-sm text-body-sm text-on-surface-variant font-normal">
            Pay on pickup is only available for pickup orders.
          </p>
        </div>
      </section>

      <!-- ── Step 4: Order summary ── -->
      <section v-if="step === 3" class="mb-xl">

        <!-- Receipt card (torn-ticket style) -->
        <div class="receipt-card p-lg rounded-t-lg mb-gutter">
          <div class="flex justify-between items-start mb-md">
            <div>
              <p class="font-label-bold text-label-bold text-on-surface-variant mb-xs">Document</p>
              <h2 class="font-headline-md text-headline-md text-primary">
                {{ form.fileName ?? 'Custom instructions' }}
              </h2>
            </div>
            <span class="material-symbols-outlined text-primary-container">description</span>
          </div>
          <div class="space-y-md border-t border-outline-variant/30 pt-md">
            <div class="flex justify-between">
              <span class="font-body-sm text-body-sm text-on-surface-variant">Pages</span>
              <span class="font-label-bold text-label-bold text-on-surface">{{ form.pages }}</span>
            </div>
            <div class="flex justify-between">
              <span class="font-body-sm text-body-sm text-on-surface-variant">Copies</span>
              <span class="font-label-bold text-label-bold text-on-surface">{{ form.copies }}</span>
            </div>
            <div class="flex justify-between">
              <span class="font-body-sm text-body-sm text-on-surface-variant">Colour mode</span>
              <span class="font-label-bold text-label-bold text-on-surface">
                {{ form.colorMode === 'bw' ? 'Black & white' : 'Colour' }}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="font-body-sm text-body-sm text-on-surface-variant">Delivery type</span>
              <span class="font-label-bold text-label-bold text-on-surface capitalize">
                {{ form.deliveryType }}
              </span>
            </div>
          </div>
        </div>

        <!-- Cost breakdown -->
        <section class="bg-surface-container-low p-lg rounded-xl mb-xl">
          <h3 class="font-label-bold text-label-bold text-primary mb-md uppercase tracking-widest">
            Pricing Details
          </h3>
          <div class="space-y-sm">
            <div class="flex justify-between">
              <span class="font-body-sm text-body-sm text-on-surface-variant">Print cost</span>
              <span class="font-body-lg text-body-lg text-on-surface">KES {{ costEstimate.printCost }}</span>
            </div>
            <div class="flex justify-between">
              <span class="font-body-sm text-body-sm text-on-surface-variant">Delivery fee</span>
              <span class="font-body-lg text-body-lg text-on-surface">KES {{ costEstimate.deliveryFee }}</span>
            </div>
            <div class="h-px bg-outline-variant my-md"></div>
            <div class="flex justify-between items-center">
              <span class="font-headline-md text-headline-md text-primary">Total Amount</span>
              <span class="font-headline-lg-mobile text-headline-lg-mobile text-secondary-container font-extrabold">
                KES {{ costEstimate.total }}
              </span>
            </div>
          </div>
        </section>

        <!-- Printer image -->
        <div class="w-full h-40 rounded-xl overflow-hidden mb-xl">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAJQY5X-zz8AlzjCjvotCdF-ouZqckaeLXoDwn_BKozkZwz0Cd3BsWJ4uqk72zQIcpu4xZIT9MvnGqgw93z1Jj_Quf6ow8-99CAlumxbSOaMBUXqf-O_ybFxdsRdQQNuQirH3xn5nuUFu89T-2D_Q2Ekyalr7K_qato87ovy4RdQ-4Gu6an3uWTgVjXQBeOt4yyXSryAmNhmzWYPyGE4hHR8lTEElB5k4icOPG41S2M3JY_YFMTA_TWAPMJa_NBAozR_23pZMvp3Fw"
            alt="Professional printing machine in a modern studio"
            class="w-full h-full object-cover grayscale-[20%] opacity-90"
          />
        </div>

        <p v-if="stepError" class="text-error font-body-sm text-body-sm text-center mb-md">{{ stepError }}</p>

        <!-- Actions — inline on step 4 (no fixed bottom bar) -->
        <div class="flex flex-col items-center gap-md">
          <button
            @click="handleNext"
            :disabled="jobs.loading"
            class="w-full bg-secondary-container text-on-primary font-label-bold text-label-bold h-[48px] rounded-lg active:scale-95 transition-all uppercase tracking-widest disabled:opacity-60"
          >
            {{ jobs.loading ? 'Submitting…' : 'Confirm and pay' }}
          </button>
          <button
            @click="handleBack"
            class="text-on-surface-variant font-label-bold text-label-bold hover:text-primary transition-colors"
          >
            Back
          </button>
        </div>

      </section>

    </main>

    <!-- Fixed bottom action bar — hidden on step 4 (actions are inline) -->
    <div
      v-if="step < 3"
      class="fixed bottom-0 left-0 right-0 bg-surface-container-lowest border-t border-outline-variant px-margin-mobile py-md z-40 max-w-2xl mx-auto w-full flex flex-col gap-md"
    >
      <div v-if="step >= 1" class="flex justify-between items-center">
        <span class="font-body-lg text-body-lg text-on-surface-variant">Estimated cost:</span>
        <span class="font-headline-md text-headline-md text-primary">KES {{ costEstimate.total }}</span>
      </div>
      <button
        @click="handleNext"
        :disabled="jobs.loading || uploadLoading"
        class="w-full h-12 text-on-primary font-label-bold text-label-bold rounded-lg uppercase tracking-wider active:scale-[0.98] transition-all disabled:opacity-60"
        style="background-color: #F97316;"
      >
        {{ uploadLoading ? 'Uploading…' : 'Next' }}
      </button>
    </div>

  </div>
</template>

<script setup lang="ts">
import type { SubmitJobPayload, ColorMode, SideMode } from '~/types'

definePageMeta({
  middleware: 'auth',
  requiresAuth: true,
  role: 'customer',
})

const router         = useRouter()
const jobs           = useJobsStore()
const step           = ref(0)
const stepError      = ref('')
const fileInputRef   = ref<HTMLInputElement | null>(null)
const selectedFile   = ref<File | null>(null)
const fileId         = ref<string | null>(null)
const uploadLoading  = ref(false)

const stepLabels = ['Upload', 'Settings', 'Delivery', 'Summary']

const form = reactive<SubmitJobPayload>({
  fileName:     null,
  instructions: '',
  copies:       1,
  colorMode:    'bw',
  sides:        'single',
  paperSize:    'A4',
  deliveryType: 'pickup',
  pages:        1,
})

const colorOpts: Array<{ val: ColorMode; label: string }> = [
  { val: 'bw',    label: 'Black & white' },
  { val: 'color', label: 'Colour' },
]
const sideOpts: Array<{ val: SideMode; label: string }> = [
  { val: 'single', label: 'Single' },
  { val: 'double', label: 'Double sided' },
]

const isWordDoc = computed(() => /\.docx?$/i.test(form.fileName ?? ''))

const costEstimate = computed(() => {
  const pages      = form.pages || 1
  const perPage    = form.colorMode === 'color' ? 20 : 5
  const sidesMult  = form.sides === 'double' ? 1.8 : 1
  const printCost  = Math.round(pages * form.copies * perPage * sidesMult)
  const deliveryFee = form.deliveryType === 'delivery' ? 50 : 0
  return { printCost, deliveryFee, total: printCost + deliveryFee }
})

function triggerFileInput() { fileInputRef.value?.click() }

function handleFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  selectedFile.value = file
  fileId.value = null // reset so it gets uploaded on next
  form.fileName = file.name
  form.pages = file.type === 'application/pdf'
    ? Math.max(1, Math.round(file.size / 51200))
    : 1
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024)    return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

function handleBack() {
  if (step.value > 0) { step.value-- } else { router.push({ name: 'app' }) }
}

async function handleNext() {
  stepError.value = ''

  if (step.value === 0) {
    if (!selectedFile.value && !form.instructions.trim()) {
      stepError.value = 'Please upload a file or enter print instructions.'
      return
    }
    // Upload file to backend if one is selected and not yet uploaded
    if (selectedFile.value && !fileId.value) {
      uploadLoading.value = true
      try {
        const api      = useApi()
        const formData = new FormData()
        formData.append('file', selectedFile.value)
        const res = await api<any>('/files/upload', { method: 'POST', body: formData })
        fileId.value  = res.data.fileId
        form.fileName = res.data.fileName
        form.pages    = res.data.pageCount
      } catch (e: any) {
        stepError.value = e?.data?.message ?? 'File upload failed. Please try again.'
        uploadLoading.value = false
        return
      }
      uploadLoading.value = false
    }
    step.value++
    return
  }

  if (step.value < 3) { step.value++; return }

  const job = await jobs.submitJob({ ...form, fileId: fileId.value ?? undefined } as any)
  if (job) router.push({ name: 'app-payment' })
}
</script>

<style scoped>
.dashed-border {
  background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='12' ry='12' stroke='%23C5C6D0FF' stroke-width='2' stroke-dasharray='8%2c 8' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e");
  border-radius: 12px;
}
.step-active   { background-color: #fd761a; color: white; }
.step-inactive { background-color: #eeeeec; color: #45464f; }

.receipt-card {
  background: #F0EFEB;
  position: relative;
}
.receipt-card::after {
  content: "";
  position: absolute;
  bottom: -8px;
  left: 0;
  right: 0;
  height: 8px;
  background-image: radial-gradient(circle, #F0EFEB 4px, transparent 5px);
  background-size: 12px 12px;
}
</style>
