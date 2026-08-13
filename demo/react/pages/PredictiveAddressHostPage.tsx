import React, { useEffect, useMemo, useState } from "react";
import { PredictiveAddressInput, PredictiveAddressRetrieveOptions, RetrieveResult } from "../components/PredictiveAddressInput";
import { usePredictiveAddressCountries } from "../hooks/usePredictiveAddressCountries";

const API_KEY = import.meta.env.API_KEY;

const RETRIEVE_OPTIONS: PredictiveAddressRetrieveOptions = {
  MaxLines: 5,
  FixTownCounty: true,
  FixPostcode: true,
  IncludeCountry: true,
};

const EMPTY_FIELDS = {
  line1: "",
  line2: "",
  line3: "",
  town: "",
  county: "",
  postcode: "",
};

const INPUT_SLOTS = {
  root: {
    style: { fontFamily: "inherit" },
  },
  input: {
    style: {
    },
  },
  dropdown: {
    style: {
      borderRadius: "12px",
      border: "1px solid #94a3b8",
    },
  },
  option: {
    style: {
      padding: "0.65rem 0.8rem",
    },
  },
  currentLocationButton: {
    style: {
      background: "#eff6ff",
      borderColor: "#60a5fa",
      color: "#1d4ed8",
    },
  },
} satisfies React.ComponentProps<typeof PredictiveAddressInput>["slots"];

export default function PredictiveAddressHostPage() {
  const { countries, currentCountryIso2, isLoading, error } = usePredictiveAddressCountries(API_KEY);
  const [country, setCountry] = useState("GB");
  const [fields, setFields] = useState(EMPTY_FIELDS);

  const selectedCountryDetails = useMemo(
    () => countries.find((item) => item.ISO2 === country),
    [countries, country]
  );

  useEffect(() => {
    if (countries.length === 0) {
      return;
    }

    if (countries.some((item) => item.ISO2 === country)) {
      return;
    }

    const preferredCountry = (currentCountryIso2 && countries.some((item) => item.ISO2 === currentCountryIso2)
      ? currentCountryIso2
      : countries.some((item) => item.ISO2 === "GB")
        ? "GB"
        : countries[0]?.ISO2) ?? "GB";

    setCountry(preferredCountry);
  }, [countries, country, currentCountryIso2]);

  function handleSelectedAddress(result: RetrieveResult) {
    const lines = result.Result?.Address?.Lines ?? [];
    setFields({
      line1: lines[0] ?? "",
      line2: lines[1] ?? "",
      line3: lines[2] ?? "",
      town: lines[3] ?? "",
      county: lines[4] ?? "",
      postcode: lines.at(-1) ?? "",
    });
  }

  function handleCountryChange(nextCountry: string) {
    setCountry(nextCountry);
    setFields(EMPTY_FIELDS);
  }

  function handleFieldChange(field: keyof typeof EMPTY_FIELDS, value: string) {
    setFields((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <section style={{ maxWidth: "820px" }}>
      <h2 style={{ marginTop: 0 }}>Predictive Address input host</h2>
      <p style={{ color: "#4b5563", marginTop: 0 }}>
        This page shows the reusable address textbox wired into a normal form. The component emits the selected address back to the host so the rest of the fields can be filled independently.
      </p>

      <div
        style={{
          padding: "1rem",
          border: "1px solid #d6dbe3",
          borderRadius: "14px",
          background: "linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%)",
          boxShadow: "0 16px 45px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div style={{ display: "grid", gap: "0.9rem" }}>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ fontWeight: 600 }}>Country</span>
            <select value={country} onChange={(e) => handleCountryChange(e.target.value)} disabled={isLoading || countries.length === 0}>
              {countries.map((item) => (
                <option key={item.ISO2 ?? ""} value={item.ISO2 ?? ""}>
                  {item.Name} ({item.ISO2})
                </option>
              ))}
            </select>
          </label>

          {error && <p style={{ margin: 0, color: "#b42318" }}>{error}</p>}

          <div style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ fontWeight: 600 }}>Address line 1</span>
            <PredictiveAddressInput
              apiKey={API_KEY}
              country={country}
              disabled={!country}
              value={fields.line1}
              onChange={(event) => handleFieldChange("line1", event.target.value)}
              showCurrentLocation
              supportsGeocoding={selectedCountryDetails?.SupportsGeocoding ?? false}
              retrieveOptions={RETRIEVE_OPTIONS}
              getDisplayText={(result) => result.Result?.Address?.Lines?.[0] ?? ""}
              slots={INPUT_SLOTS}
              onSelectedAddress={handleSelectedAddress}
              placeholder="Enter address line 1"
            />
          </div>

          <div style={{ display: "grid", gap: "0.75rem" }}>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontWeight: 600 }}>Address line 2</span>
              <input value={fields.line2} onChange={(event) => handleFieldChange("line2", event.target.value)} />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontWeight: 600 }}>Address line 3</span>
              <input value={fields.line3} onChange={(event) => handleFieldChange("line3", event.target.value)} />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontWeight: 600 }}>Town</span>
              <input value={fields.town} onChange={(event) => handleFieldChange("town", event.target.value)} />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontWeight: 600 }}>County</span>
              <input value={fields.county} onChange={(event) => handleFieldChange("county", event.target.value)} />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontWeight: 600 }}>Postcode</span>
              <input value={fields.postcode} onChange={(event) => handleFieldChange("postcode", event.target.value)} />
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}