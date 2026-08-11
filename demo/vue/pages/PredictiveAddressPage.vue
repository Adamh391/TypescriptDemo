<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import createClient from "openapi-fetch";
import { PredictiveAddress } from "@data8/types";

const API_KEY = import.meta.env.API_KEY;

const client = createClient<PredictiveAddress.paths>({
  baseUrl: "https://webservices.data-8.co.uk",
});

type SearchResults = NonNullable<PredictiveAddress.components["schemas"]["PredictiveAddressSearchResponse"]["Results"]>;
type RetrieveResult = PredictiveAddress.components["schemas"]["PredictiveAddressRetrieveResponse"];
type SupportedCountry = PredictiveAddress.components["schemas"]["PredictiveAddressCountryDetails"];
let predictiveAddressSessionId: string | null = null;
let activeSearchAbortController: AbortController | null = null;

const address = ref("");
const options = ref<SearchResults>([]);
const selected = ref<RetrieveResult | null>(null);
const countries = ref<SupportedCountry[]>([]);
const selectedCountry = ref("GB");
const sessionId = ref<string | null>(predictiveAddressSessionId);

async function getSupportedCountries() {
  const { data } = await client.POST("/PredictiveAddress/GetSupportedCountries.json", {
    headers: { "content-type": "application/json" },
    body: { username: "apikey-" + API_KEY },
  });
  return data;
}

function updateSessionId(nextSessionId: string | null | undefined) {
  if (!nextSessionId) return;
  sessionId.value = nextSessionId;
  predictiveAddressSessionId = nextSessionId;
}

async function search(query: string, country: string, activeSessionId: string | null, signal?: AbortSignal) {
  const { data } = await client.POST("/PredictiveAddress/Search.json", {
    signal,
    headers: { "content-type": "application/json" },
    body: {
      username: "apikey-" + API_KEY,
      country,
      search: query,
      session: activeSessionId ?? undefined,
    },
  });
  return data;
}

async function drilldown(id: string, country: string) {
  const { data } = await client.POST("/PredictiveAddress/DrillDown.json", {
    headers: { "content-type": "application/json" },
    body: { username: "apikey-" + API_KEY, country, id },
  });
  return data;
}

async function retrieve(id: string, country: string) {
  const { data } = await client.POST("/PredictiveAddress/Retrieve.json", {
    headers: { "content-type": "application/json" },
    body: {
      username: "apikey-" + API_KEY,
      country,
      id,
      options: {
        MaxLines: 4,
        FixTownCounty: true,
        FixPostcode: true,
        Formatter: "NoOrganisationFormatter",
        IncludeCountry: true,
      },
    },
  });
  return data;
}

onMounted(async () => {
  const res = await getSupportedCountries();
  const supported = (res?.Countries ?? []).filter((country) => country.ISO2 && country.Name) as SupportedCountry[];
  countries.value = supported;

  selectedCountry.value = res?.CurrentCountry?.ISO2
    ?? (supported.some((country) => country.ISO2 === "GB") ? "GB" : supported[0]?.ISO2)
    ?? "GB";
});

function handleCountryChange(country: string) {
  selectedCountry.value = country;
}

watch([address, selectedCountry], async ([val, country], _, onCleanup) => {
  activeSearchAbortController?.abort();

  if (val.length == 0) {
    options.value = [];
    return;
  }

  const controller = new AbortController();
  activeSearchAbortController = controller;

  onCleanup(() => {
    controller.abort();
    if (activeSearchAbortController === controller) {
      activeSearchAbortController = null;
    }
  });

  try {
    const res = await search(val, country, sessionId.value, controller.signal);
    if (controller.signal.aborted) return;
    updateSessionId(res?.SessionID);
    options.value = res?.Results ?? [];
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    throw error;
  } finally {
    if (activeSearchAbortController === controller) {
      activeSearchAbortController = null;
    }
  }
});

watch(selectedCountry, () => {
  sessionId.value = null;
  predictiveAddressSessionId = null;
  options.value = [];
  selected.value = null;
});

async function handleSelect(option: SearchResults[number]) {
  if (option.container) {
    const res = await drilldown(option.value ?? "", selectedCountry.value);
    updateSessionId(res?.SessionID);
    options.value = res?.Results ?? [];
  } else {
    const res = await retrieve(option.value ?? "", selectedCountry.value);
    selected.value = res ?? null;
    options.value = [];
  }
}

const raw = ref<RetrieveResult["Result"]>();
const formattedLines = ref<string[]>([]);
watch(selected, (val) => {
  raw.value = val?.Result;
  formattedLines.value = val?.Result?.Address?.Lines ?? [];
});
</script>

<template>
  <div>
    <div>
      <select
        v-model="selectedCountry"
        @change="handleCountryChange(($event.target as HTMLSelectElement).value)"
        :disabled="countries.length === 0"
        :style="{ marginBottom: '0.5rem' }"
      >
        <option
          v-for="country in countries"
          :key="country.ISO2"
          :value="country.ISO2 ?? ''"
        >
          {{ country.Name }} ({{ country.ISO2 }})
        </option>
      </select>
      <input
        placeholder="Enter Address"
        @input="address = ($event.target as HTMLInputElement).value"
        :style="{ marginBottom: 0, boxShadow: 'none', borderRadius: options.length > 0 ? '4px 4px 0 0' : undefined }"
      />
      <ul
        v-if="options.length > 0"
        :style="{ margin: 0, padding: 0, listStyle: 'none', border: '1px solid #ccc', borderTop: 'none', borderRadius: '0 0 4px 4px', background: '#fff', maxHeight: '250px', overflowY: 'scroll' }"
      >
        <li
          v-for="(option, i) in options"
          :key="`${option.value}-${i}`"
          :style="{
            padding: '0.5rem',
            cursor: 'pointer',
            borderBottom: '1px solid #eee',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            background: option.container ? '#f6f9ff' : undefined,
            fontWeight: option.container ? 600 : undefined,
          }"
          @click="handleSelect(option)"
        >
          <span>{{ option.label }}</span>
          <span
            v-if="option.container"
            :style="{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '1.6rem',
              height: '1.6rem',
              padding: '0 0.45rem',
              borderRadius: '999px',
              background: '#dbe8ff',
              color: '#163c96',
              fontSize: '0.75rem',
              lineHeight: 1,
              fontWeight: 700,
              flexShrink: 0,
            }"
            :aria-label="typeof option.items === 'number' && option.items > 0 ? `${option.items} items available` : 'Contains additional results'"
            :title="typeof option.items === 'number' && option.items > 0 ? `${option.items} items` : 'More results'"
          >
            {{ typeof option.items === "number" && option.items > 0 ? option.items : ">" }}
          </span>
        </li>
      </ul>
    </div>
    <input disabled placeholder="Organisation" :value="raw?.RawAddress?.Organisation ?? ''" style="margin-top: 1rem" />
    <input disabled placeholder="Address Line 1" :value="formattedLines[0] ?? ''" />
    <input disabled placeholder="Address Line 2" :value="formattedLines[1] ?? ''" />
    <input disabled placeholder="Town / City" :value="formattedLines[2] ?? ''" />
    <input disabled placeholder="County" :value="formattedLines[3] ?? ''" />
    <input disabled placeholder="Postcode" :value="formattedLines[4] ?? ''" />
    <input disabled placeholder="Country" :value="raw?.RawAddress?.Location?.Country ?? raw?.RawAddress?.CountryISO2 ?? ''" />
  </div>
</template>
