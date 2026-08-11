<script setup lang="ts">
import { ref, watch } from "vue";
import createClient from "openapi-fetch";
import { PredictiveAddress } from "@data8/types";

const API_KEY = import.meta.env.API_KEY;

const client = createClient<PredictiveAddress.paths>({
  baseUrl: "https://webservices.data-8.co.uk",
});

type SearchResults = NonNullable<PredictiveAddress.components["schemas"]["PredictiveAddressSearchResponse"]["Results"]>;
type RetrieveResult = PredictiveAddress.components["schemas"]["PredictiveAddressRetrieveResponse"];
let predictiveAddressSessionId: string | null = null;
let activeSearchAbortController: AbortController | null = null;

const address = ref("");
const options = ref<SearchResults>([]);
const selected = ref<RetrieveResult | null>(null);
const sessionId = ref<string | null>(predictiveAddressSessionId);

function updateSessionId(nextSessionId: string | null | undefined) {
  if (!nextSessionId) return;
  sessionId.value = nextSessionId;
  predictiveAddressSessionId = nextSessionId;
}

async function search(query: string, activeSessionId: string | null, signal?: AbortSignal) {
  const { data } = await client.POST("/PredictiveAddress/Search.json", {
    signal,
    headers: { "content-type": "application/json" },
    body: {
      username: "apikey-" + API_KEY,
      country: "GB",
      search: query,
      session: activeSessionId ?? undefined,
    },
  });
  return data;
}

async function drilldown(id: string) {
  const { data } = await client.POST("/PredictiveAddress/DrillDown.json", {
    headers: { "content-type": "application/json" },
    body: { username: "apikey-" + API_KEY, country: "GB", id },
  });
  return data;
}

async function retrieve(id: string) {
  const { data } = await client.POST("/PredictiveAddress/Retrieve.json", {
    headers: { "content-type": "application/json" },
    body: { username: "apikey-" + API_KEY, country: "GB", id },
  });
  return data;
}

watch(address, async (val, _, onCleanup) => {
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
    const res = await search(val, sessionId.value, controller.signal);
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

async function handleSelect(option: SearchResults[number]) {
  if (option.container) {
    const res = await drilldown(option.value ?? "");
    updateSessionId(res?.SessionID);
    options.value = res?.Results ?? [];
  } else {
    const res = await retrieve(option.value ?? "");
    selected.value = res ?? null;
    options.value = [];
  }
}

const raw = ref<RetrieveResult["Result"]>();
watch(selected, (val) => {
  raw.value = val?.Result;
});
</script>

<template>
  <div>
    <div>
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
    <input disabled placeholder="Address Line 1" :value="[raw?.RawAddress?.SubBuildingName, raw?.RawAddress?.BuildingName, raw?.RawAddress?.BuildingNumber, raw?.RawAddress?.ThoroughfareName].filter(Boolean).join(', ') || ''" />
    <input disabled placeholder="Address Line 2" :value="[raw?.RawAddress?.DependentLocality, raw?.RawAddress?.DoubleDependentLocality].filter(Boolean).join(', ') || ''" />
    <input disabled placeholder="Town / City" :value="raw?.RawAddress?.Locality ?? ''" />
    <input disabled placeholder="County" :value="raw?.RawAddress?.PostalCounty ?? raw?.RawAddress?.AdministrativeCounty ?? ''" />
    <input disabled placeholder="Postcode" :value="raw?.RawAddress?.Postcode ?? ''" />
    <input disabled placeholder="Country" :value="raw?.RawAddress?.CountryISO2 ?? ''" />
  </div>
</template>
