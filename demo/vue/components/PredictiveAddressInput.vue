<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useAttrs, useId, watch } from "vue";
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, LiHTMLAttributes } from "vue";
import createClient from "openapi-fetch";
import type { PredictiveAddress } from "@data8/types";
import { getErrorMessage } from "../../helpers/ApiError";

export type RetrieveResult = PredictiveAddress.components["schemas"]["PredictiveAddressRetrieveResponse"];
export type PredictiveAddressRetrieveOptions = Record<string, unknown>;
type SearchResults = NonNullable<PredictiveAddress.components["schemas"]["PredictiveAddressSearchResponse"]["Results"]>;

const DEFAULT_APPLICATION_NAME = "Data8VueDemo";

export interface PredictiveAddressInputSlots {
  root?: HTMLAttributes;
  input?: InputHTMLAttributes;
  dropdown?: HTMLAttributes;
  option?: LiHTMLAttributes;
  optionHover?: LiHTMLAttributes;
  currentLocationButton?: ButtonHTMLAttributes;
  errorMessage?: HTMLAttributes;
}

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{
  apiKey: string;
  country: string;
  modelValue?: string;
  defaultValue?: string;
  showCurrentLocation?: boolean;
  applicationName?: string;
  supportsGeocoding?: boolean;
  retrieveOptions?: PredictiveAddressRetrieveOptions;
  getDisplayText?: (result: RetrieveResult) => string;
  slots?: PredictiveAddressInputSlots;
  disabled?: boolean;
  placeholder?: string;
}>(), {
  defaultValue: "",
  showCurrentLocation: false,
  applicationName: DEFAULT_APPLICATION_NAME,
  supportsGeocoding: undefined,
  disabled: false,
  placeholder: "Enter Address",
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
  selectedAddress: [result: RetrieveResult];
}>();
const attrs = useAttrs();
const inputAttrs = computed(() => {
  const { onFocus, onBlur, onInput, onKeydown, onKeyDown, ...inputAttributes } = attrs;
  return inputAttributes;
});
const inputSlotProps = computed(() => {
  const { onFocus, onBlur, onInput, onKeydown, ...inputAttributes } = props.slots?.input ?? {};
  return inputAttributes;
});
const optionSlotProps = computed(() => {
  const {
    onMouseenter, onMouseleave, onMousedown, onClick, ...optionAttributes
  } = props.slots?.option ?? {};
  return optionAttributes;
});
const currentLocationButtonSlotProps = computed(() => {
  const { onMousedown, onClick, ...buttonAttributes } = props.slots?.currentLocationButton ?? {};
  return buttonAttributes;
});
const client = createClient<PredictiveAddress.paths>({ baseUrl: "https://webservices.data-8.co.uk" });
const internalValue = ref(props.defaultValue);
const currentValue = computed(() => props.modelValue ?? internalValue.value);
const searchQuery = ref<string | null>(null);
const options = ref<SearchResults>([]);
const isResultsOpen = ref(false);
const highlightedOptionIndex = ref<number | null>(null);
const resolvedSupportsGeocoding = ref(false);
const canUseCurrentLocation = computed(() => props.supportsGeocoding ?? resolvedSupportsGeocoding.value);
const isLocating = ref(false);
const errorMessage = ref<string | null>(null);
const rootRef = ref<HTMLDivElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const listboxRef = ref<HTMLUListElement | null>(null);
const listboxId = useId();
let sessionId: string | null = null;
let searchController: AbortController | null = null;
let interactionRequestId = 0;
let suppressSearch = false;

defineExpose({ input: inputRef, focus: () => inputRef.value?.focus() });

function clearResults() {
  options.value = [];
  isResultsOpen.value = false;
  highlightedOptionIndex.value = null;
}

function invokeAttributeHandler(name: string, event: Event) {
  const handler = attrs[name] as ((event: Event) => void) | Array<(event: Event) => void> | undefined;
  if (Array.isArray(handler)) {
    handler.forEach((callback) => callback(event));
  } else {
    handler?.(event);
  }
}

function invokeSlotHandler(slot: Record<string, unknown> | undefined, name: string, event: Event) {
  const handler = slot?.[name] as ((event: Event) => void) | Array<(event: Event) => void> | undefined;
  if (Array.isArray(handler)) {
    handler.forEach((callback) => callback(event));
  } else {
    handler?.(event);
  }
}

watch(() => [props.country, props.apiKey], () => {
  sessionId = null;
  searchQuery.value = null;
  errorMessage.value = null;
  isLocating.value = false;
  interactionRequestId += 1;
  searchController?.abort();
  clearResults();
}, { flush: "sync" });

watch(() => [props.apiKey, props.country, props.applicationName, props.supportsGeocoding], async (_, __, onCleanup) => {
  resolvedSupportsGeocoding.value = false;
  if (props.supportsGeocoding !== undefined) return;

  const controller = new AbortController();
  onCleanup(() => controller.abort());
  try {
    const { data, error } = await client.POST("/PredictiveAddress/GetSupportedCountries.json", {
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: {
        username: "apikey-" + props.apiKey,
        options: { ApplicationName: props.applicationName },
      },
    });
    if (error) throw error;
    if (!data?.Status?.Success) throw new Error(data?.Status?.ErrorMessage ?? "Loading supported countries failed");
    if (controller.signal.aborted) return;
    resolvedSupportsGeocoding.value = (data.Countries ?? []).some(
      (country) => country.ISO2 === props.country && country.SupportsGeocoding
    );
  } catch (error) {
    if (!controller.signal.aborted) {
      errorMessage.value = getErrorMessage(error, "Error loading supported countries");
    }
  }
}, { immediate: true });

watch(
  [currentValue, searchQuery, () => props.apiKey, () => props.country, () => props.applicationName, () => props.disabled],
  (_, __, onCleanup) => {
    errorMessage.value = null;
    if (suppressSearch) return;
    clearResults();

    const query = searchQuery.value ?? currentValue.value;
    if (!query.length || props.disabled) return;

    const controller = new AbortController();
    searchController = controller;
    const timeoutId = window.setTimeout(async () => {
      try {
        const { data, error } = await client.POST("/PredictiveAddress/Search.json", {
          signal: controller.signal,
          headers: { "content-type": "application/json" },
          body: {
            username: "apikey-" + props.apiKey,
            search: query,
            country: props.country,
            session: sessionId ?? undefined,
            options: { ApplicationName: props.applicationName },
          },
        });
        if (error) throw error;
        if (!data?.Status?.Success) throw new Error(data?.Status?.ErrorMessage ?? "Predictive address search failed");
        if (controller.signal.aborted) return;
        sessionId = data.SessionID ?? null;
        options.value = data.Results ?? [];
        highlightedOptionIndex.value = null;
        isResultsOpen.value = options.value.length > 0;
      } catch (error) {
        if (controller.signal.aborted) return;
        errorMessage.value = getErrorMessage(error, "Error searching predictive address");
        clearResults();
      }
    }, 250);
    onCleanup(() => {
      window.clearTimeout(timeoutId);
      controller.abort();
      if (searchController === controller) searchController = null;
    });
  },
  { immediate: true }
);

function handleInput(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  if (props.modelValue === undefined) internalValue.value = value;
  interactionRequestId += 1;
  isLocating.value = false;
  errorMessage.value = null;
  searchQuery.value = null;
  isResultsOpen.value = true;
  emit("update:modelValue", value);
  invokeAttributeHandler("onInput", event);
}

function handleFocus(event: FocusEvent) {
  isResultsOpen.value = options.value.length > 0;
  invokeAttributeHandler("onFocus", event);
}

function handleBlur(event: FocusEvent) {
  invokeAttributeHandler("onBlur", event);
}

function handleCurrentLocationMouseDown(event: MouseEvent) {
  invokeSlotHandler(props.slots?.currentLocationButton as Record<string, unknown> | undefined, "onMousedown", event);
}

function handleOptionMouseEnter(index: number, event: MouseEvent) {
  highlightedOptionIndex.value = index;
  invokeSlotHandler(props.slots?.option as Record<string, unknown> | undefined, "onMouseenter", event);
  invokeSlotHandler(props.slots?.optionHover as Record<string, unknown> | undefined, "onMouseenter", event);
}

function handleOptionMouseLeave(index: number, event: MouseEvent) {
  if (highlightedOptionIndex.value === index) highlightedOptionIndex.value = null;
  invokeSlotHandler(props.slots?.option as Record<string, unknown> | undefined, "onMouseleave", event);
  invokeSlotHandler(props.slots?.optionHover as Record<string, unknown> | undefined, "onMouseleave", event);
}

function handleOptionMouseDown(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
  invokeSlotHandler(props.slots?.option as Record<string, unknown> | undefined, "onMousedown", event);
}

function handleOptionClick(option: SearchResults[number], event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
  invokeSlotHandler(props.slots?.option as Record<string, unknown> | undefined, "onClick", event);
  highlightedOptionIndex.value = null;
  void handleSelect(option);
}

function handleUseCurrentLocation() {
  const requestId = ++interactionRequestId;
  inputRef.value?.focus();
  if (!navigator.geolocation) {
    errorMessage.value = "Geolocation is not supported by this browser.";
    return;
  }
  isLocating.value = true;
  errorMessage.value = null;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (requestId !== interactionRequestId) return;
      searchQuery.value = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
      isResultsOpen.value = false;
      inputRef.value?.focus();
      isLocating.value = false;
    },
    (error) => {
      if (requestId !== interactionRequestId) return;
      errorMessage.value = error.message || "Unable to retrieve your location.";
      isLocating.value = false;
    }
  );
}

async function handleSelect(option: SearchResults[number]) {
  const requestId = ++interactionRequestId;
  isLocating.value = false;
  errorMessage.value = null;
  const body = {
    username: "apikey-" + props.apiKey,
    country: props.country,
    id: option.value ?? "",
    options: { ApplicationName: props.applicationName },
  };
  try {
    if (option.container) {
      const { data, error } = await client.POST("/PredictiveAddress/DrillDown.json", {
        headers: { "content-type": "application/json" },
        body,
      });
      if (error) throw error;
      if (!data?.Status?.Success) throw new Error(data?.Status?.ErrorMessage ?? "Predictive address drilldown failed");
      if (requestId !== interactionRequestId) return;
      sessionId = data.SessionID ?? null;
      options.value = data.Results ?? [];
      highlightedOptionIndex.value = null;
      isResultsOpen.value = options.value.length > 0;
      return;
    }

    const { data, error } = await client.POST("/PredictiveAddress/Retrieve.json", {
      headers: { "content-type": "application/json" },
      body: { ...body, options: { ...body.options, ...props.retrieveOptions } },
    });
    if (error) throw error;
    if (!data?.Status?.Success) throw new Error(data?.Status?.ErrorMessage ?? "Predictive address retrieve failed");
    if (requestId !== interactionRequestId) return;

    const value = props.getDisplayText?.(data) ?? data.Result?.Address?.Lines?.[0] ?? option.label ?? currentValue.value;
    suppressSearch = true;
    internalValue.value = value;
    searchQuery.value = null;
    clearResults();
    emit("update:modelValue", value);
    emit("selectedAddress", data);
    await nextTick();
    suppressSearch = false;
  } catch (error) {
    if (requestId === interactionRequestId) {
      errorMessage.value = getErrorMessage(error, "Error loading the selected address");
    }
  }
}

function handleKeyDown(event: KeyboardEvent) {
  if (isResultsOpen.value && options.value.length) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      highlightedOptionIndex.value = highlightedOptionIndex.value === null
        ? 0 : Math.min(highlightedOptionIndex.value + 1, options.value.length - 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (highlightedOptionIndex.value !== null && highlightedOptionIndex.value <= 0) {
        inputRef.value?.focus();
        highlightedOptionIndex.value = null;
      } else if (highlightedOptionIndex.value !== null) {
        highlightedOptionIndex.value -= 1;
      }
    } else if (event.key === "Enter" && highlightedOptionIndex.value !== null) {
      event.preventDefault();
      void handleSelect(options.value[highlightedOptionIndex.value]);
    }
  }
  if (event.key === "Escape") {
    isResultsOpen.value = false;
    highlightedOptionIndex.value = null;
  }
  invokeAttributeHandler("onKeydown", event);
  invokeAttributeHandler("onKeyDown", event);
}

watch([highlightedOptionIndex, isResultsOpen], () => {
  if (isResultsOpen.value && highlightedOptionIndex.value !== null) {
    const option = listboxRef.value?.children[highlightedOptionIndex.value];
    option?.scrollIntoView({ block: "nearest" });
  }
}, { flush: "post" });

function handlePointerDown(event: PointerEvent) {
  if (event.target instanceof Node && !rootRef.value?.contains(event.target)) {
    isResultsOpen.value = false;
  }
}

onMounted(() => document.addEventListener("pointerdown", handlePointerDown));
onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handlePointerDown);
  searchController?.abort();
  interactionRequestId += 1;
});
</script>

<template>
  <div v-bind="slots?.root" ref="rootRef">
    <div style="position: relative">
      <button
        v-if="showCurrentLocation && canUseCurrentLocation"
        v-bind="currentLocationButtonSlotProps"
        class="current-location"
        type="button"
        :disabled="isLocating || disabled"
        :title="slots?.currentLocationButton?.title ?? 'Use current location'"
        :aria-label="slots?.currentLocationButton?.['aria-label'] ?? 'Use current location'"
        @mousedown.stop="handleCurrentLocationMouseDown"
        @click="handleUseCurrentLocation"
      >
        &#10687;
      </button>
      <input
        v-bind="{ ...inputAttrs, ...inputSlotProps }"
        ref="inputRef"
        :type="slots?.input?.type ?? (attrs.type as InputHTMLAttributes['type']) ?? 'text'"
        role="combobox"
        :aria-expanded="isResultsOpen"
        aria-haspopup="listbox"
        :aria-owns="isResultsOpen ? listboxId : undefined"
        aria-autocomplete="list"
        :aria-activedescendant="highlightedOptionIndex !== null ? `${listboxId}-option-${highlightedOptionIndex}` : undefined"
        :value="currentValue"
        :disabled="disabled"
        :placeholder="placeholder"
        :autocomplete="slots?.input?.autocomplete ?? (attrs.autocomplete as InputHTMLAttributes['autocomplete']) ?? 'off'"
        :style="[
          { marginBottom: 0, boxShadow: 'none', paddingRight: showCurrentLocation && canUseCurrentLocation ? '2.4rem' : undefined },
          attrs.style as HTMLAttributes['style'], slots?.input?.style,
        ]"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown="handleKeyDown"
      />
      <ul
        v-if="isResultsOpen && options.length"
        v-bind="slots?.dropdown"
        :id="listboxId"
        ref="listboxRef"
        class="address-results"
        role="listbox"
      >
        <li
          v-for="(option, index) in options"
          :id="`${listboxId}-option-${index}`"
          :key="`${option.value}-${index}`"
          v-bind="optionSlotProps"
          role="option"
          :aria-selected="highlightedOptionIndex === index"
          :class="[slots?.option?.class, { container: option.container, highlighted: highlightedOptionIndex === index }, highlightedOptionIndex === index ? slots?.optionHover?.class : undefined]"
          :style="[slots?.option?.style, highlightedOptionIndex === index ? slots?.optionHover?.style : undefined]"
          @mouseenter="handleOptionMouseEnter(index, $event)"
          @mouseleave="handleOptionMouseLeave(index, $event)"
          @mousedown="handleOptionMouseDown"
          @click="handleOptionClick(option, $event)"
        >
          <span>{{ option.label }}</span>
          <span
            v-if="option.container"
            class="result-count"
            :aria-label="option.items ? `${option.items} items available` : 'Contains additional results'"
            :title="option.items ? `${option.items} items` : 'More results'"
          >{{ typeof option.items === 'number' && option.items > 0 ? option.items : '>' }}</span>
        </li>
      </ul>
    </div>
    <p v-if="errorMessage" v-bind="slots?.errorMessage" class="address-error">{{ errorMessage }}</p>
  </div>
</template>

<style scoped>
.current-location {
  position: absolute;
  right: 0.35rem;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  width: 1.8rem;
  height: 1.8rem;
  padding: 0;
  margin: 0;
  border-radius: 999px;
  border: 1px solid var(--data8-border);
  background: var(--data8-white);
  color: var(--data8-ink);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
  cursor: pointer;
}
.current-location:disabled { cursor: not-allowed; }
.address-results {
  position: absolute;
  top: calc(100% + 0.25rem);
  left: 0;
  right: 0;
  z-index: 20;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--data8-border);
  border-radius: 0 0 4px 4px;
  background: var(--data8-white);
  color: var(--data8-ink);
  max-height: 250px;
  overflow-y: auto;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.12);
}
.address-results li {
  margin: 0;
  padding: 0.5rem;
  list-style: none;
  cursor: pointer;
  border-bottom: 1px solid var(--data8-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  overflow-wrap: anywhere;
}
.address-results li.container { background: #f6f9ff; font-weight: 600; }
.address-results li.highlighted { background: #eaf1ff; }
.result-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.6rem;
  height: 1.6rem;
  padding: 0 0.45rem;
  border-radius: 999px;
  background: #dbe8ff;
  color: #163c96;
  font-size: 0.75rem;
  line-height: 1;
  font-weight: 700;
  flex-shrink: 0;
}
.address-error { margin: 0.35rem 0 0; color: var(--data8-invalid); font-size: 0.875rem; }
</style>