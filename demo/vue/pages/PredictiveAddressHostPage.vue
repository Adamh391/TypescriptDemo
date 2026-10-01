<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import createClient from "openapi-fetch";
import type { PredictiveAddress } from "@data8/types";
import { getErrorMessage } from "../../helpers/ApiError";
import PredictiveAddressInput from "../components/PredictiveAddressInput.vue";
import type {
  PredictiveAddressInputSlots,
  PredictiveAddressRetrieveOptions,
  RetrieveResult,
} from "../components/PredictiveAddressInput.vue";

type SupportedCountry = PredictiveAddress.components["schemas"]["PredictiveAddressCountryDetails"];
const API_KEY = import.meta.env.API_KEY;
const APPLICATION_NAME = "Data8VueDemoHost";
const RETRIEVE_OPTIONS: PredictiveAddressRetrieveOptions = {
  MaxLines: 5,
  FixTownCounty: true,
  FixPostcode: true,
  IncludeCountry: true,
};
const EMPTY_FIELDS = { line1: "", line2: "", line3: "", town: "", county: "", postcode: "" };
const INPUT_SLOTS: PredictiveAddressInputSlots = {
  root: { style: { fontFamily: "inherit" } },
  dropdown: { style: { borderRadius: "8px", border: "1px solid var(--data8-border)" } },
  option: { style: { padding: "0.65rem 0.8rem" } },
  currentLocationButton: { style: { background: "#eff6ff", borderColor: "#60a5fa", color: "#1d4ed8" } },
};
const ADDRESS_FIELDS = [
  { key: "line2", label: "Address line 2" },
  { key: "line3", label: "Address line 3" },
  { key: "town", label: "Town" },
  { key: "county", label: "County" },
  { key: "postcode", label: "Postcode" },
] as const;

const countries = ref<SupportedCountry[]>([]);
const country = ref("GB");
const fields = ref({ ...EMPTY_FIELDS });
const isLoading = ref(true);
const error = ref<string | null>(null);
const selectedCountryDetails = computed(() => countries.value.find((item) => item.ISO2 === country.value));
const client = createClient<PredictiveAddress.paths>({ baseUrl: "https://webservices.data-8.co.uk" });
const countriesController = new AbortController();

onMounted(async () => {
  try {
    const { data, error: apiError } = await client.POST("/PredictiveAddress/GetSupportedCountries.json", {
      signal: countriesController.signal,
      headers: { "content-type": "application/json" },
      body: { username: "apikey-" + API_KEY, options: { ApplicationName: APPLICATION_NAME } },
    });
    if (apiError) throw apiError;
    if (!data?.Status?.Success) throw new Error(data?.Status?.ErrorMessage ?? "Loading supported countries failed");
    if (countriesController.signal.aborted) return;
    countries.value = (data.Countries ?? [])
      .filter((item) => item.ISO2 && item.Name)
      .sort((first, second) => (first.Name ?? "").localeCompare(second.Name ?? ""));
    if (!countries.value.some((item) => item.ISO2 === country.value)) {
      country.value = (countries.value.some((item) => item.ISO2 === data.CurrentCountry?.ISO2)
        ? data.CurrentCountry?.ISO2
        : countries.value[0]?.ISO2) ?? "";
    }
  } catch (err) {
    if (!countriesController.signal.aborted) error.value = getErrorMessage(err, "Unable to load supported countries.");
  } finally {
    if (!countriesController.signal.aborted) isLoading.value = false;
  }
});

onBeforeUnmount(() => countriesController.abort());

function handleSelectedAddress(result: RetrieveResult) {
  const lines = result.Result?.Address?.Lines ?? [];
  fields.value = {
    line1: lines[0] ?? "",
    line2: lines[1] ?? "",
    line3: lines[2] ?? "",
    town: lines[3] ?? "",
    county: lines[4] ?? "",
    postcode: lines.at(-1) ?? "",
  };
}
</script>

<template>
  <section class="address-host">
    <h2>Predictive Address component</h2>
    <p :style="{ color: '#4b5563', marginTop: 0 }">
      This page shows the reusable address textbox wired into a normal form. The component emits the selected address
      back to the host so the rest of the fields can be filled independently.
    </p>
    <form @submit.prevent>
      <label>
        <span>Country</span>
        <select
          v-model="country"
          :disabled="isLoading || countries.length === 0"
          @change="fields = { ...EMPTY_FIELDS }"
        >
          <option v-for="item in countries" :key="item.ISO2 ?? ''" :value="item.ISO2 ?? ''">
            {{ item.Name }} ({{ item.ISO2 }})
          </option>
        </select>
      </label>
      <p v-if="error" class="countries-error" role="alert">{{ error }}</p>
      <div class="address-line-one">
        <label for="host-address-line1">Address line 1</label>
        <PredictiveAddressInput
          id="host-address-line1"
          v-model="fields.line1"
          :api-key="API_KEY"
          :country="country"
          :application-name="APPLICATION_NAME"
          :disabled="!country"
          show-current-location
          :supports-geocoding="selectedCountryDetails?.SupportsGeocoding ?? false"
          :retrieve-options="RETRIEVE_OPTIONS"
          :get-display-text="(result) => result.Result?.Address?.Lines?.[0] ?? ''"
          :slots="INPUT_SLOTS"
          placeholder="Enter address line 1"
          @selected-address="handleSelectedAddress"
        />
      </div>
      <label v-for="field in ADDRESS_FIELDS" :key="field.key">
        <span>{{ field.label }}</span>
        <input v-model="fields[field.key]" />
      </label>
    </form>
  </section>
</template>

<style scoped>
.address-host {
  max-width: 820px;
}

h2 {
  margin-top: 0;
}

form {
  display: grid;
  gap: 0.9rem;
}

label,
.address-line-one {
  display: grid;
  gap: 0.35rem;
  margin: 0;
  min-width: 0;
}

label > span,
.address-line-one > label {
  font-weight: 600;
}

input,
select {
  margin-bottom: 0;
}

.countries-error {
  margin: 0;
  color: var(--data8-invalid);
}
</style>