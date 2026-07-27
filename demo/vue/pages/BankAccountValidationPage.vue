<script setup lang="ts">
import { ref } from "vue";
import createClient from "openapi-fetch";
import { BankAccountValidation } from "@data8/types";

const API_KEY = import.meta.env.API_KEY;

const client = createClient<BankAccountValidation.paths>({
  baseUrl: "https://webservices.data-8.co.uk",
});

type ValidationResult = BankAccountValidation.components["schemas"]["BankAccountValidationResponse"];

const sortCode = ref("");
const accountNumber = ref("");
const result = ref<ValidationResult | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

async function handleSubmit() {
  if (!sortCode.value.trim() || !accountNumber.value.trim()) return;

  loading.value = true;
  error.value = null;
  result.value = null;

  try {
    const { data, error: apiError } = await client.POST("/BankAccountValidation/IsValid.json", {
      headers: { "content-type": "application/json" },
      body: {
        username: "apikey-" + API_KEY,
        bankAccountNumber: accountNumber.value,
        sortCode: sortCode.value,
      },
    });

    if (apiError) throw new Error(JSON.stringify(apiError));
    result.value = data ?? null;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Validation failed";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div>
    <form @submit.prevent="handleSubmit">
      <fieldset :style="{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }">
        <input
          type="text"
          v-model="sortCode"
          placeholder="Enter sort code"
          required
          :disabled="loading"
        />
        <input
          type="text"
          v-model="accountNumber"
          placeholder="Enter account number"
          required
          :disabled="loading"
        />
        <button type="submit" :aria-busy="loading" :disabled="loading">
          {{ loading ? "Validating…" : "Validate" }}
        </button>
      </fieldset>
    </form>

    <p v-if="error" style="color: #ff4136">{{ error }}</p>

    <article
      v-if="result"
      :style="{
        marginTop: '1.5rem',
        borderLeft: `4px solid ${result.Valid === 'Valid' ? '#2ecc40' : '#ff4136'}`,
        paddingLeft: '1rem',
      }"
    >
      <h3 :style="{ color: result.Valid === 'Valid' ? '#2ecc40' : '#ff4136', margin: '0 0 0.5rem' }">
        {{ result.Valid === "Valid" ? "✓ Valid" : "✗ Invalid" }}
      </h3>
      <p style="margin: 0; color: #555">{{ result.Valid }}</p>
    </article>
  </div>
</template>
