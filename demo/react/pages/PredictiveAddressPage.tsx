import createClient from "openapi-fetch";
import React, { useEffect, useRef, useState } from "react";
import { PredictiveAddress } from "@data8/types";

const API_KEY = import.meta.env.API_KEY;

const client = createClient<PredictiveAddress.paths>({
  baseUrl: "https://webservices.data-8.co.uk",
});

type SearchResults = NonNullable<PredictiveAddress.components["schemas"]["PredictiveAddressSearchResponse"]["Results"]>;
type RetrieveResult = PredictiveAddress.components["schemas"]["PredictiveAddressRetrieveResponse"];
type SupportedCountry = PredictiveAddress.components["schemas"]["PredictiveAddressCountryDetails"];
let predictiveAddressSessionId: string | null = null;

async function getSupportedCountries() {
  const { data } = await client.POST("/PredictiveAddress/GetSupportedCountries.json", {
    headers: { "content-type": "application/json" },
    body: { username: "apikey-" + API_KEY },
  });
  return data;
}

async function search(address: string, country: string, sessionId: string | null, signal?: AbortSignal) {
  const { data } = await client.POST("/PredictiveAddress/Search.json", {
    signal,
    headers: { "content-type": "application/json" },
    body: {
      username: "apikey-" + API_KEY,
      search: address,
      country,
      session: sessionId ?? undefined,
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

export default function PredictiveAddressPage() {
  const [address, setAddress] = useState("");
  const [options, setOptions] = useState<SearchResults>([]);
  const [selected, setSelected] = useState<RetrieveResult | null>(null);
  const [countries, setCountries] = useState<SupportedCountry[]>([]);
  const [selectedCountry, setSelectedCountry] = useState("GB");
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(predictiveAddressSessionId);
  const activeSearchController = useRef<AbortController | null>(null);

  function updateSessionId(nextSessionId: string | null | undefined) {
    if (!nextSessionId) return;
    setSessionId(nextSessionId);
    predictiveAddressSessionId = nextSessionId;
  }

  useEffect(() => {
    getSupportedCountries().then((res) => {
      const supported = (res?.Countries ?? []).filter((country) => country.ISO2 && country.Name) as SupportedCountry[];
      setCountries(supported);

      const defaultCountry = res?.CurrentCountry?.ISO2
        ?? (supported.some((country) => country.ISO2 === "GB") ? "GB" : supported[0]?.ISO2)
        ?? "GB";
      setSelectedCountry(defaultCountry);
    });
  }, []);

  useEffect(() => {
    activeSearchController.current?.abort();

    if (address.length == 0) {
      setOptions([]);
      return;
    }

    const controller = new AbortController();
    activeSearchController.current = controller;

    search(address, selectedCountry, sessionId, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        updateSessionId(res?.SessionID);
        setOptions(res?.Results ?? []);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        throw error;
      });

    return () => {
      controller.abort();
    };
  }, [address, selectedCountry]);

  function handleCountryChange(country: string) {
    setSelectedCountry(country);
    setSessionId(null);
    predictiveAddressSessionId = null;
    setOptions([]);
    setSelected(null);
    setLocationError(null);
  }

  function handleUseCurrentLocation() {
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
        setAddress(`${latitude}, ${longitude}`);
        setSelected(null);
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
      const res = await drilldown(option.value ?? "", selectedCountry);
      updateSessionId(res?.SessionID);
      setOptions(res?.Results ?? []);
    } else {
      const res = await retrieve(option.value ?? "", selectedCountry);
      setSelected(res ?? null);
      setOptions([]);
    }
  }

  const raw = selected?.Result?.RawAddress;
  const formattedLines = selected?.Result?.Address?.Lines ?? [];
  const selectedCountryDetails = countries.find((country) => country.ISO2 === selectedCountry);

  return (
    <div>
      <div>
        <select
          value={selectedCountry}
          onChange={(e) => handleCountryChange(e.target.value)}
          disabled={countries.length === 0}
          style={{ marginBottom: "0.5rem" }}
        >
          {countries.map((country) => (
            <option key={country.ISO2} value={country.ISO2 ?? ""}>
              {country.Name} ({country.ISO2})
            </option>
          ))}
        </select>
        {selectedCountryDetails?.SupportsGeocoding && (
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
            style={{ width: "100%", marginBottom: "0.5rem" }}
          >
            {isLocating ? "Getting current location..." : "Use Current Location"}
          </button>
        )}
        {locationError && <p style={{ color: "#b42318", marginTop: 0, marginBottom: "0.5rem" }}>{locationError}</p>}
        <input
          placeholder="Enter Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          style={{ marginBottom: 0, boxShadow: "none", borderRadius: options.length > 0 ? "4px 4px 0 0" : undefined }}
        />
        {options.length > 0 && (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", border: "1px solid #ccc", borderTop: "none", borderRadius: "0 0 4px 4px", background: "#fff", maxHeight: "250px", overflowY: "scroll" }}>
            {options.map((option, i) => (
              <li
                key={`${option.value}-${i}`}
                style={{
                  padding: "0.5rem",
                  cursor: "pointer",
                  borderBottom: "1px solid #eee",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                  background: option.container ? "#f6f9ff" : undefined,
                  fontWeight: option.container ? 600 : undefined,
                }}
                onClick={() => handleSelect(option)}
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
      </div>
      <div aria-hidden="true" style={{ margin: "1rem 0", borderTop: "2px solid #d1d5db" }} />
      <input disabled placeholder="Organisation" value={raw?.Organisation ?? ""} style={{ marginTop: "1rem" }} />
      <input disabled placeholder="Address Line 1" value={formattedLines[0] ?? ""} />
      <input disabled placeholder="Address Line 2" value={formattedLines[1] ?? ""} />
      <input disabled placeholder="Town / City" value={formattedLines[2] ?? ""} />
      <input disabled placeholder="County" value={formattedLines[3] ?? ""} />
      <input disabled placeholder="Postcode" value={formattedLines[4] ?? ""} />
      <input disabled placeholder="Country" value={raw?.Location?.Country ?? raw?.CountryISO2 ?? ""} />
    </div>
  );
}
