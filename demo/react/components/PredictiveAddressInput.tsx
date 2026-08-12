import createClient from "openapi-fetch";
import React, { forwardRef, useEffect, useId, useRef, useState } from "react";
import { PredictiveAddress } from "@data8/types";

type SearchResults = NonNullable<PredictiveAddress.components["schemas"]["PredictiveAddressSearchResponse"]["Results"]>;
type RetrieveResult = PredictiveAddress.components["schemas"]["PredictiveAddressRetrieveResponse"];

const DEFAULT_APPLICATION_NAME = "@data8/react-predictiveaddress";

export type PredictiveAddressRetrieveOptions = Record<string, unknown>;

/**
 * Slot props that customize the internal DOM elements without replacing the
 * predictive search behavior.
 */
export interface PredictiveAddressInputSlots {
  /** Props merged onto the outer wrapper element. */
  root?: React.HTMLAttributes<HTMLDivElement>;
  /** Props merged onto the textbox element. */
  input?: React.InputHTMLAttributes<HTMLInputElement>;
  /** Props merged onto the dropdown list element. */
  dropdown?: React.HTMLAttributes<HTMLUListElement>;
  /** Props merged onto each dropdown option row. */
  option?: React.LiHTMLAttributes<HTMLLIElement>;
  /** Props merged onto each dropdown option row while hovered. */
  optionHover?: React.LiHTMLAttributes<HTMLLIElement>;
  /** Props merged onto the embedded current-location button. */
  currentLocationButton?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  /** Props merged onto the location error message. */
  locationError?: React.HTMLAttributes<HTMLParagraphElement>;
}

/**
 * Props for the reusable Predictive Address textbox.
 *
 * Use `defaultValue` for an initial value that the user can later edit freely,
 * or `value` plus `onChange` for a fully controlled input.
 */
export interface PredictiveAddressInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue" | "value" | "onChange"> {
  /** Data8 API key used for lookup requests. */
  apiKey: string;
  /** ISO2 country code used for search and retrieve requests. */
  country: string;
  /** Show a clickable current-location icon inside the textbox when the selected country supports geocoding. */
  showCurrentLocation?: boolean;
  /** Application name reported in Data8 request options; defaults to `@data8/react-predictiveaddress`. */
  applicationName?: string;
  /** Optional geocoding support flag from the host; when omitted, this control resolves support internally. */
  supportsGeocoding?: boolean;
  /** Optional retrieve options object passed directly to the Data8 retrieve endpoint. */
  retrieveOptions?: PredictiveAddressRetrieveOptions;
  /** Resolves the text shown in the textbox after a selection is made. */
  getDisplayText?: (result: RetrieveResult) => string;
  /** Themeable slot props for the internal DOM structure. */
  slots?: PredictiveAddressInputSlots;
  /** Controlled textbox value. */
  value?: string;
  /** Initial textbox value for uncontrolled usage. */
  defaultValue?: string;
  /** Standard textbox change handler. */
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  /** Called when the user selects a full address result. */
  onSelectedAddress: (result: RetrieveResult) => void;
}

const client = createClient<PredictiveAddress.paths>({
  baseUrl: "https://webservices.data-8.co.uk",
});

async function search(
  address: string,
  apiKey: string,
  country: string,
  sessionId: string | null,
  applicationName: string,
  signal?: AbortSignal
) {
  const { data } = await client.POST("/PredictiveAddress/Search.json", {
    signal,
    headers: { "content-type": "application/json" },
    body: {
      username: "apikey-" + apiKey,
      search: address,
      country,
      session: sessionId ?? undefined,
      options: {
        ApplicationName: applicationName,
      },
    },
  });
  return data;
}

async function drilldown(id: string, apiKey: string, country: string, applicationName: string) {
  const { data } = await client.POST("/PredictiveAddress/DrillDown.json", {
    headers: { "content-type": "application/json" },
    body: {
      username: "apikey-" + apiKey,
      country,
      id,
      options: {
        ApplicationName: applicationName,
      },
    },
  });
  return data;
}

async function retrieve(
  id: string,
  apiKey: string,
  country: string,
  applicationName: string,
  retrieveOptions?: PredictiveAddressRetrieveOptions
) {
  const { data } = await client.POST("/PredictiveAddress/Retrieve.json", {
    headers: { "content-type": "application/json" },
    body: {
      username: "apikey-" + apiKey,
      country,
      id,
      options: {
        ApplicationName: applicationName,
        ...(retrieveOptions ?? {}),
      },
    },
  });
  return data;
}

function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (value: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") {
        ref(value);
      } else {
        (ref as React.MutableRefObject<T | null>).current = value;
      }
    }
  };
}

export const PredictiveAddressInput = forwardRef<HTMLInputElement, PredictiveAddressInputProps>(
  function PredictiveAddressInput(
    {
      apiKey,
      country,
      showCurrentLocation = false,
      applicationName = DEFAULT_APPLICATION_NAME,
      supportsGeocoding,
      retrieveOptions,
      getDisplayText,
      slots,
      value,
      defaultValue,
      onChange,
      onSelectedAddress,
      disabled,
      onFocus,
      onBlur,
      onKeyDown,
      placeholder = "Enter Address",
      style,
      ...inputProps
    },
    ref
  ) {
    const [internalValue, setInternalValue] = useState(defaultValue ?? "");
    const [searchQuery, setSearchQuery] = useState<string | null>(null);
    const [options, setOptions] = useState<SearchResults>([]);
    const [isResultsOpen, setIsResultsOpen] = useState(false);
    const [highlightedOptionIndex, setHighlightedOptionIndex] = useState<number | null>(null);
    const [resolvedSupportsGeocoding, setResolvedSupportsGeocoding] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const suppressNextSearchRef = useRef(false);
    const activeSearchController = useRef<AbortController | null>(null);
    const resultsContainerRef = useRef<HTMLDivElement | null>(null);
    const listboxRef = useRef<HTMLUListElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const listboxId = useId();

    const currentValue = value ?? internalValue;
    const activeQuery = searchQuery ?? currentValue;

    const rootSlotProps = slots?.root ?? {};
    const inputSlotProps = slots?.input ?? {};
    const dropdownSlotProps = slots?.dropdown ?? {};
    const optionSlotProps = slots?.option ?? {};
    const optionHoverSlotProps = slots?.optionHover ?? {};
    const currentLocationButtonSlotProps = slots?.currentLocationButton ?? {};
    const locationErrorSlotProps = slots?.locationError ?? {};
    const canUseCurrentLocation = supportsGeocoding ?? resolvedSupportsGeocoding;

    useEffect(() => {
      if (supportsGeocoding !== undefined) {
        return;
      }

      let isActive = true;

      client.POST("/PredictiveAddress/GetSupportedCountries.json", {
        headers: { "content-type": "application/json" },
        body: {
          username: "apikey-" + apiKey,
          options: {
            ApplicationName: applicationName,
          },
        },
      })
        .then((res) => {
          if (!isActive) return;

          const supported = (res.data?.Countries ?? []).filter((item) => item.ISO2 && item.SupportsGeocoding);
          setResolvedSupportsGeocoding(supported.some((item) => item.ISO2 === country));
        })
        .catch(() => {
          if (isActive) {
            setResolvedSupportsGeocoding(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [apiKey, applicationName, country, supportsGeocoding]);

    useEffect(() => {
      setOptions([]);
      setIsResultsOpen(false);
      setHighlightedOptionIndex(null);
      sessionIdRef.current = null;
      setSearchQuery(null);
      setLocationError(null);
      activeSearchController.current?.abort();
    }, [country, apiKey]);

    useEffect(() => {
      function handlePointerDown(event: PointerEvent) {
        const target = event.target as Node | null;
        if (!resultsContainerRef.current || !target) return;

        if (!resultsContainerRef.current.contains(target)) {
          setIsResultsOpen(false);
        }
      }

      document.addEventListener("pointerdown", handlePointerDown);
      return () => {
        document.removeEventListener("pointerdown", handlePointerDown);
      };
    }, []);

    useEffect(() => {
      if (suppressNextSearchRef.current) {
        suppressNextSearchRef.current = false;
        return;
      }

      activeSearchController.current?.abort();

      if (activeQuery.length === 0 || disabled) {
        setOptions([]);
        setIsResultsOpen(false);
        setHighlightedOptionIndex(null);
        return;
      }

      const controller = new AbortController();
      activeSearchController.current = controller;

      const timeoutId = window.setTimeout(() => {
        search(activeQuery, apiKey, country, sessionIdRef.current, applicationName, controller.signal)
          .then((res) => {
            if (controller.signal.aborted) return;
            sessionIdRef.current = res?.SessionID ?? null;
            setOptions(res?.Results ?? []);
            setHighlightedOptionIndex(null);
            setIsResultsOpen((res?.Results?.length ?? 0) > 0);
          })
          .catch((error: unknown) => {
            if (error instanceof DOMException && error.name === "AbortError") return;
            throw error;
          });
      }, 250);

      return () => {
        window.clearTimeout(timeoutId);
        controller.abort();
        if (activeSearchController.current === controller) {
          activeSearchController.current = null;
        }
      };
    }, [activeQuery, apiKey, applicationName, country, disabled]);

    function handleUseCurrentLocation() {
      // Keep keyboard interaction anchored to the textbox so arrow keys
      // control the listbox instead of scrolling the page.
      inputRef.current?.focus();

      if (!navigator.geolocation) {
        setLocationError("Geolocation is not supported by this browser.");
        return;
      }

      setIsLocating(true);
      setLocationError(null);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const latitude = position.coords.latitude.toFixed(6);
          const longitude = position.coords.longitude.toFixed(6);
          setSearchQuery(`${latitude}, ${longitude}`);
          setIsResultsOpen(false);
          inputRef.current?.focus();
          setIsLocating(false);
        },
        (error) => {
          setLocationError(error.message || "Unable to retrieve your location.");
          setIsLocating(false);
        }
      );
    }

    async function handleSelect(option: SearchResults[number]) {
      if (option.container) {
        const res = await drilldown(option.value ?? "", apiKey, country, applicationName);
        sessionIdRef.current = res?.SessionID ?? null;
        setOptions(res?.Results ?? []);
        setHighlightedOptionIndex(null);
        setIsResultsOpen((res?.Results?.length ?? 0) > 0);
        return;
      }

      const res = await retrieve(option.value ?? "", apiKey, country, applicationName, retrieveOptions);
      if (!res) {
        setOptions([]);
        setIsResultsOpen(false);
        return;
      }

      suppressNextSearchRef.current = true;
      setInternalValue(getDisplayText?.(res) ?? res.Result?.Address?.Lines?.[0] ?? option.label ?? currentValue);
      setSearchQuery(null);
      setOptions([]);
      setHighlightedOptionIndex(null);
      setIsResultsOpen(false);
      onSelectedAddress(res);
    }

    useEffect(() => {
      if (!isResultsOpen || highlightedOptionIndex == null) {
        return;
      }

      const optionElement = listboxRef.current?.querySelector<HTMLElement>(`#${listboxId}-option-${highlightedOptionIndex}`);
      optionElement?.scrollIntoView({ block: "nearest" });
    }, [highlightedOptionIndex, isResultsOpen, listboxId]);

    return (
      <div
        {...rootSlotProps}
        ref={resultsContainerRef}
        style={{ position: "relative", ...rootSlotProps.style }}
      >
        {showCurrentLocation && canUseCurrentLocation && (
          <button
            {...currentLocationButtonSlotProps}
            type="button"
            onMouseDown={(event) => {
              event.stopPropagation();
              currentLocationButtonSlotProps.onMouseDown?.(event);
            }}
            onClick={handleUseCurrentLocation}
            disabled={isLocating || disabled}
            title={currentLocationButtonSlotProps.title ?? "Use current location"}
            aria-label={currentLocationButtonSlotProps["aria-label"] ?? "Use current location"}
            style={{
              position: "absolute",
              right: "0.35rem",
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 2,
              width: "1.8rem",
              height: "1.8rem",
              borderRadius: "999px",
              border: "1px solid #cbd5e1",
              background: "#fff",
              color: "#1f2937",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
              cursor: isLocating || disabled ? "not-allowed" : "pointer",
              ...currentLocationButtonSlotProps.style,
            }}
          >
            ⦿
          </button>
        )}
        <input
          {...inputProps}
          {...inputSlotProps}
          ref={mergeRefs(ref, inputRef)}
          type={inputProps.type ?? "text"}
          role="combobox"
          aria-expanded={isResultsOpen}
          aria-haspopup="listbox"
          aria-owns={isResultsOpen ? listboxId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={highlightedOptionIndex != null ? `${listboxId}-option-${highlightedOptionIndex}` : undefined}
          value={currentValue}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete={inputProps.autoComplete ?? "off"}
          style={{
            marginBottom: 0,
            boxShadow: "none",
            paddingRight: showCurrentLocation && canUseCurrentLocation ? "2.4rem" : undefined,
            ...style,
            ...inputSlotProps.style,
          }}
          onFocus={(event) => {
            setIsResultsOpen(options.length > 0);
            onFocus?.(event);
          }}
          onBlur={onBlur}
          onKeyDown={(event) => {
            if (isResultsOpen && options.length > 0) {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setHighlightedOptionIndex((current) => (current == null ? 0 : Math.min(current + 1, options.length - 1)));
              }

              if (event.key === "ArrowUp") {
                event.preventDefault();
                setHighlightedOptionIndex((current) => {
                  if (current == null) return null;
                  if (current <= 0) {
                    inputRef.current?.focus();
                    return null;
                  }
                  return current - 1;
                });
              }

              if (event.key === "Enter" && highlightedOptionIndex != null) {
                event.preventDefault();
                void handleSelect(options[highlightedOptionIndex]);
              }
            }

            if (event.key === "Escape") {
              setIsResultsOpen(false);
              setHighlightedOptionIndex(null);
            }
            onKeyDown?.(event);
          }}
          onChange={(event) => {
            if (value === undefined) {
              setInternalValue(event.target.value);
            }
            setSearchQuery(null);
            setIsResultsOpen(true);
            onChange?.(event);
          }}
        />
        {isResultsOpen && options.length > 0 && (
          <ul
            {...dropdownSlotProps}
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            style={{
              position: "absolute",
              top: "calc(100% + 0.25rem)",
              left: 0,
              right: 0,
              zIndex: 20,
              margin: 0,
              padding: 0,
              listStyle: "none",
              border: "1px solid #ccc",
              borderRadius: "0 0 4px 4px",
              background: "#fff",
              maxHeight: "250px",
              overflowY: "auto",
              boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
              ...dropdownSlotProps.style,
            }}
          >
            {options.map((option, index) => (
              <li
                {...optionSlotProps}
                key={`${option.value}-${index}`}
                role="option"
                id={`${listboxId}-option-${index}`}
                aria-selected={highlightedOptionIndex === index}
                className={
                  highlightedOptionIndex === index
                    ? [optionSlotProps.className, optionHoverSlotProps.className].filter(Boolean).join(" ")
                    : optionSlotProps.className
                }
                style={{
                  padding: "0.5rem",
                  cursor: "pointer",
                  borderBottom: "1px solid #eee",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                  background: highlightedOptionIndex === index ? "#eaf1ff" : option.container ? "#f6f9ff" : undefined,
                  fontWeight: option.container ? 600 : undefined,
                  ...optionSlotProps.style,
                  ...(highlightedOptionIndex === index ? optionHoverSlotProps.style : undefined),
                }}
                onMouseEnter={(event) => {
                  setHighlightedOptionIndex(index);
                  optionSlotProps.onMouseEnter?.(event);
                  optionHoverSlotProps.onMouseEnter?.(event);
                }}
                onMouseLeave={(event) => {
                  setHighlightedOptionIndex((current) => (current === index ? null : current));
                  optionSlotProps.onMouseLeave?.(event);
                  optionHoverSlotProps.onMouseLeave?.(event);
                }}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  optionSlotProps.onMouseDown?.(event);
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  optionSlotProps.onClick?.(event);
                  setHighlightedOptionIndex(null);
                  void handleSelect(option);
                }}
              >
                <span>{option.label}</span>
                {option.container && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: "1.6rem",
                      height: "1.6rem",
                      padding: "0 0.45rem",
                      borderRadius: "999px",
                      background: "#dbe8ff",
                      color: "#163c96",
                      fontSize: "0.75rem",
                      lineHeight: 1,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                    aria-label={option.items ? `${option.items} items available` : "Contains additional results"}
                    title={option.items ? `${option.items} items` : "More results"}
                  >
                    {typeof option.items === "number" && option.items > 0 ? option.items : ">"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {locationError && (
          <p
            {...locationErrorSlotProps}
            style={{
              margin: "0.35rem 0 0",
              color: "#b42318",
              fontSize: "0.875rem",
              ...locationErrorSlotProps.style,
            }}
          >
            {locationError}
          </p>
        )}
      </div>
    );
  }
);

export type { RetrieveResult };