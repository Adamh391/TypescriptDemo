<script setup lang="ts">
import { ref } from "vue";
import createClient from "openapi-fetch";
import { EmailValidation } from "@data8/types";

const API_KEY = import.meta.env.API_KEY;

const client = createClient<EmailValidation.paths>({
  baseUrl: "https://webservices.data-8.co.uk",
});

type ValidationResult = EmailValidation.components["schemas"]["EmailValidationOutput"];

const inputValue = ref("");
const result = ref<ValidationResult | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

async function handleSubmit() {
  if (!inputValue.value.trim()) return;

  loading.value = true;
  error.value = null;
  result.value = null;

  try {
    const { data, error: apiError } = await client.POST("/EmailValidation/IsValid.json", {
      headers: { "content-type": "application/json" },
      body: {
        username: "apikey-" + API_KEY,
        email: inputValue.value,
        level: "Address",
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
      <fieldset role="group">
        <input
          type="email"
          v-model="inputValue"
          placeholder="Enter email address"
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
        borderLeft: `4px solid ${result.Result === 'Valid' ? '#2ecc40' : '#ff4136'}`,
        paddingLeft: '1rem',
      }"
    >
      <h3 :style="{ color: result.Result === 'Valid' ? '#2ecc40' : '#ff4136', margin: '0 0 0.5rem' }">
        {{ result.Result === "Valid" ? "✓ Valid" : "✗ Invalid" }}
      </h3>
      <p style="margin: 0; color: #555">{{ result.Result }}</p>
    </article>
  </div>
</template>
