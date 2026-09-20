<template>
  <span :class="['badge', badgeClass]">{{ label }}</span>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  status: string
  type?: 'job' | 'payment' | 'delivery'
}>(), {
  type: 'job',
})

const CONFIG: Record<string, Record<string, string[]>> = {
  job:      { pending: ['badge-pending','Pending'], printing: ['badge-printing','Printing'], ready: ['badge-ready','Ready'], delivered: ['badge-delivered','Delivered'], cancelled: ['badge-cancelled','Cancelled'] },
  payment:  { paid: ['badge-paid','Paid'], unpaid: ['badge-unpaid','Unpaid'], pay_on_pickup: ['badge-pickup-pay','Pay on pickup'] },
  delivery: { pickup: ['badge-pickup','Pickup'], delivery: ['badge-delivery','Delivery'] },
}

const badgeClass = computed(() => CONFIG[props.type]?.[props.status]?.[0] ?? 'badge-delivered')
const label      = computed(() => CONFIG[props.type]?.[props.status]?.[1] ?? props.status)
</script>
