<template>
  <footer class="w-full flex flex-col items-center gap-sm py-xl px-margin-mobile text-center bg-surface-container border-t border-outline-variant">
    <div class="flex flex-col gap-xs mb-md">
      <span class="font-headline-md text-headline-md text-primary font-bold">PrintEase</span>
      <p class="font-body-sm text-body-sm text-on-surface-variant font-normal">
        Business Hours: 08:00 – 18:00 (Mon–Sat)
      </p>
      <a
        href="https://wa.me/0742900269"
        class="flex items-center justify-center gap-xs font-label-bold text-label-bold text-secondary hover:text-secondary-container transition-colors"
      >
        <span class="material-symbols-outlined text-[18px]">chat</span>
        WhatsApp Support
      </a>
    </div>
    <nav class="flex flex-wrap justify-center gap-md mb-md">
      <span class="font-body-sm text-body-sm text-on-surface-variant hover:text-secondary cursor-pointer transition-colors">Business Hours</span>
      <!-- <span class="font-body-sm text-body-sm text-on-surface-variant hover:text-secondary cursor-pointer transition-colors">WhatsApp Support</span> -->
      <NuxtLink
        to="/privacy"
        class="font-body-sm text-body-sm text-on-surface-variant hover:text-secondary cursor-pointer transition-colors"
      >Privacy Policy</NuxtLink>
    </nav>
    <p class="font-body-sm text-body-sm text-on-surface-variant/60 font-normal">
      © 2026 PrintEase. All rights reserved.
    </p>
  </footer>
</template>
