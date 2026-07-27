<script setup lang="ts">
import { ref } from "vue";
import EmailValidationPage from "./pages/EmailValidationPage.vue";
import PredictiveAddressPage from "./pages/PredictiveAddressPage.vue";
import BankAccountValidationPage from "./pages/BankAccountValidationPage.vue";

const tabs = [
  { id: "email", label: "Email Validation" },
  { id: "address", label: "Predictive Address" },
  { id: "bank", label: "Bank Account Validation" },
] as const;

const activeTab = ref<string>("email");
</script>

<template>
  <main class="container" style="max-width: 600px; margin-top: 2rem">
    <h1>Data8 Services (Vue)</h1>
    <nav>
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
    <EmailValidationPage v-if="activeTab === 'email'" />
    <PredictiveAddressPage v-if="activeTab === 'address'" />
    <BankAccountValidationPage v-if="activeTab === 'bank'" />
  </main>
</template>
