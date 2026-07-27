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

const address = ref("");
const options = ref<SearchResults>([]);
const selected = ref<RetrieveResult | null>(null);

async function search(query: string) {
  const { data } = await client.POST("/PredictiveAddress/Search.json", {
    headers: { "content-type": "application/json" },
    body: { username: "apikey-" + API_KEY, country: "GB", search: query },
  });
  return data;
}

async function drilldown(id: string) {
  const { data } = await client.POST("/PredictiveAddress/DrillDown.json", {
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

watch(address, async (val) => {
  if (val.length <= 3) { options.value = []; return; }
  const res = await search(val);
  options.value = res?.Results ?? [];
});

async function handleSelect(option: SearchResults[number]) {
  if (option.container) {
    const res = await drilldown(option.value ?? "");
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
          :style="{ padding: '0.5rem', cursor: 'pointer', borderBottom: '1px solid #eee' }"
          @click="handleSelect(option)"
        >
          {{ option.label }}
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
