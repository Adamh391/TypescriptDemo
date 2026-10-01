<script setup lang="ts">
import { ref } from "vue";
import EmailValidationPage from "./pages/EmailValidationPage.vue";
import PredictiveAddressPage from "./pages/PredictiveAddressPage.vue";
import PredictiveAddressHostPage from "./pages/PredictiveAddressHostPage.vue";
import BankAccountValidationPage from "./pages/BankAccountValidationPage.vue";
import PhoneValidationPage from "./pages/PhoneValidationPage.vue";

const tabs = [
  { id: "email", label: "Email Validation" },
  { id: "address", label: "Predictive Address" },
  { id: "address-input", label: "Predictive Address Component" },
  { id: "bank", label: "Bank Account Validation" },
  { id: "phone", label: "Phone Validation" },
] as const;

const activeTab = ref<string>("email");
</script>

<template>
  <main class="container demo-shell">
    <header class="demo-header">
      <div>
        <h1 class="demo-brand-title">Data<span>8</span></h1>
        <p class="demo-brand-subtitle">Vue demonstration</p>
      </div>
    </header>
    <nav class="service-tabs" aria-label="Data8 services">
      <ul>
        <li v-for="tab in tabs" :key="tab.id">
          <a
            href="#"
            @click.prevent="activeTab = tab.id"
            :aria-current="activeTab === tab.id ? 'page' : undefined"
          >
            {{ tab.label }}
          </a>
        </li>
      </ul>
    </nav>
    <section class="demo-content">
      <EmailValidationPage v-if="activeTab === 'email'" />
      <PredictiveAddressPage v-if="activeTab === 'address'" />
      <PredictiveAddressHostPage v-if="activeTab === 'address-input'" />
      <BankAccountValidationPage v-if="activeTab === 'bank'" />
      <PhoneValidationPage v-if="activeTab === 'phone'" />
    </section>
  </main>
</template>
