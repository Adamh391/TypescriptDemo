import createClient from "openapi-fetch";
import React, { useEffect, useRef, useState } from "react";
import { PredictiveAddress } from "@data8/types";

const API_KEY = import.meta.env.API_KEY;

const client = createClient<PredictiveAddress.paths>({
  baseUrl: "https://webservices.data-8.co.uk",
});

type SearchResults = NonNullable<PredictiveAddress.components["schemas"]["PredictiveAddressSearchResponse"]["Results"]>;
type RetrieveResult = PredictiveAddress.components["schemas"]["PredictiveAddressRetrieveResponse"];
let predictiveAddressSessionId: string | null = null;

async function search(address: string, sessionId: string | null, signal?: AbortSignal) {
  const { data } = await client.POST("/PredictiveAddress/Search.json", {
    signal,
    headers: { "content-type": "application/json" },
    body: {
      username: "apikey-" + API_KEY,
      search: address,
      country: "GB",
      session: sessionId ?? undefined,
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

export default function PredictiveAddressPage() {
  const [address, setAddress] = useState("");
  const [options, setOptions] = useState<SearchResults>([]);
  const [selected, setSelected] = useState<RetrieveResult | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(predictiveAddressSessionId);
  const activeSearchController = useRef<AbortController | null>(null);

  function updateSessionId(nextSessionId: string | null | undefined) {
    if (!nextSessionId) return;
    setSessionId(nextSessionId);
    predictiveAddressSessionId = nextSessionId;
  }

  useEffect(() => {
    activeSearchController.current?.abort();

    if (address.length == 0) {
      setOptions([]);
      return;
    }

    const controller = new AbortController();
    activeSearchController.current = controller;

    search(address, sessionId, controller.signal)
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
  }, [address]);

  async function handleSelect(option: SearchResults[number]) {
    if (option.container) {
      const res = await drilldown(option.value ?? "");
      updateSessionId(res?.SessionID);
      setOptions(res?.Results ?? []);
    } else {
      const res = await retrieve(option.value ?? "");
      setSelected(res ?? null);
      setOptions([]);
    }
  }

  const raw = selected?.Result?.RawAddress;

  return (
    <div>
      <div>
        <input
          placeholder="Enter Address"
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
      <input disabled placeholder="Organisation" value={raw?.Organisation ?? ""} style={{ marginTop: "1rem" }} />
      <input disabled placeholder="Address Line 1" value={[raw?.SubBuildingName, raw?.BuildingName, raw?.BuildingNumber, raw?.ThoroughfareName].filter(Boolean).join(", ") || ""} />
      <input disabled placeholder="Address Line 2" value={[raw?.DependentLocality, raw?.DoubleDependentLocality].filter(Boolean).join(", ") || ""} />
      <input disabled placeholder="Town / City" value={raw?.Locality ?? ""} />
      <input disabled placeholder="County" value={raw?.PostalCounty ?? raw?.AdministrativeCounty ?? ""} />
      <input disabled placeholder="Postcode" value={raw?.Postcode ?? ""} />
      <input disabled placeholder="Country" value={raw?.CountryISO2 ?? ""} />
    </div>
  );
}
