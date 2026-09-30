<script setup lang="ts">
import { ref, computed } from "vue";
import type { PhoneValidation } from "@data8/types";
import createClient from "openapi-fetch";

const API_KEY = import.meta.env.API_KEY;

const phoneClient = createClient<PhoneValidation.paths>({
  baseUrl: "https://webservices.data-8.co.uk",
});

async function validatePhone(telephoneNumber: string) {
  const { data, error } = await phoneClient.POST("/PhoneValidation/IsValid.json", {
    headers: { "content-type": "application/json" },
    body: {
      username: "apikey-" + API_KEY,
      telephoneNumber,
      defaultCountry: "GB",
      options: {},
    },
  });

  if (error) throw new Error(JSON.stringify(error));
  return data;
}

type ValidationResult = Awaited<ReturnType<typeof validatePhone>>;

type DetailRow = {
  label: string;
  value: string;
};

function formatFieldName(field: string) {
  return field
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function shouldSkipPath(pathSegments: string[]) {
  if (pathSegments.length === 1 && pathSegments[0].toLowerCase() === "status") {
    return true;
  }

  return pathSegments.some((segment) => segment.toLowerCase() === "rawaddress");
}

function buildDisplayLabel(path: string) {
  const segments = path.split(".").filter(Boolean);
  const dedupedSegments = segments.filter((segment, index) => {
    const previous = segments[index - 1];
    return index === 0 || segment.toLowerCase() !== previous.toLowerCase();
  });

  return formatFieldName(dedupedSegments.join(" "));
}

function collectDetailRows(value: unknown, prefix = ""): DetailRow[] {
  if (value === null || value === undefined) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => {
      const nextPrefix = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
      return collectDetailRows(item, nextPrefix);
    });
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, nestedValue]) => {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      const pathSegments = nextPrefix.split(".").filter(Boolean);
      if (shouldSkipPath(pathSegments)) return [];
      return collectDetailRows(nestedValue, nextPrefix);
    });
  }

  const normalized = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value).trim();
  if (!normalized) return [];

  return [{ label: buildDisplayLabel(prefix || "value"), value: normalized }];
}

const inputValue = ref("");
const result = ref<ValidationResult | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

// Formerly computed inside ResultCard
const isValid = computed(() => result.value?.Result?.ValidationResult === "Valid");
const detailRows = computed(() => collectDetailRows(result.value?.Result));

async function handleSubmit() {
  if (!inputValue.value.trim()) return;

  loading.value = true;
  error.value = null;
  result.value = null;

  try {
    const data = await validatePhone(inputValue.value);
    result.value = data;
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
      <div :style="{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }">
        <input
          v-model="inputValue"
          placeholder="Enter phone number"
          required
          :disabled="loading"
          :style="{ width: '100%' }"
        />
        <button type="submit" :aria-busy="loading" :disabled="loading">
          {{ loading ? "Validating…" : "Validate" }}
        </button>
      </div>
    </form>

    <p v-if="error" :style="{ color: '#ff4136' }">{{ error }}</p>

    <!-- Formerly the ResultCard component -->
    <article
      v-if="result"
      :style="{
        marginTop: '1.5rem',
        borderLeft: `4px solid ${isValid ? '#2ecc40' : '#ff4136'}`,
        paddingLeft: '1rem',
      }"
    >
      <h3 :style="{ color: isValid ? '#2ecc40' : '#ff4136', margin: '0 0 0.5rem' }">
        {{ isValid ? "✓ Valid" : "✗ Invalid" }}
      </h3>
      <p :style="{ margin: 0, color: '#555' }">{{ result.Result?.ValidationResult }}</p>
      <dl
        v-if="detailRows.length > 0"
        :style="{
          marginTop: '0.75rem',
          display: 'grid',
          gridTemplateColumns: 'minmax(180px, 1fr) 2fr',
          gap: '0.3rem 0.8rem',
        }"
      >
        <template v-for="(row, index) in detailRows" :key="`${row.label}-${index}`">
          <dt :style="{ margin: 0, fontWeight: 600 }">{{ row.label }}</dt>
          <dd :style="{ margin: 0, color: '#333' }">{{ row.value }}</dd>
        </template>
      </dl>
    </article>
  </div>
</template>
