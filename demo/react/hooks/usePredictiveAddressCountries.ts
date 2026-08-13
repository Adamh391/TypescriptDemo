import { useEffect, useState } from "react";
import createClient from "openapi-fetch";
import { PredictiveAddress } from "@data8/types";

export type SupportedCountryDetails = PredictiveAddress.components["schemas"]["PredictiveAddressCountryDetails"];
const DEFAULT_APPLICATION_NAME = "@data8/react-predictiveaddress";

const client = createClient<PredictiveAddress.paths>({
  baseUrl: "https://webservices.data-8.co.uk",
});

export interface UsePredictiveAddressCountriesResult {
  countries: SupportedCountryDetails[];
  currentCountryIso2: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Loads the list of supported predictive-address countries for a given API key.
 */
export function usePredictiveAddressCountries(
  apiKey: string,
  applicationName: string = DEFAULT_APPLICATION_NAME
): UsePredictiveAddressCountriesResult {
  const [countries, setCountries] = useState<SupportedCountryDetails[]>([]);
  const [currentCountryIso2, setCurrentCountryIso2] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadCountries() {
      setIsLoading(true);
      setError(null);

      try {
        const { data } = await client.POST("/PredictiveAddress/GetSupportedCountries.json", {
          headers: { "content-type": "application/json" },
          body: {
            username: "apikey-" + apiKey,
            options: {
              ApplicationName: applicationName,
            },
          },
        });

        if (!isActive) return;

        const supported = (data?.Countries ?? [])
          .filter((item) => item.ISO2 && item.Name)
          .sort((a, b) => (a.Name ?? "").localeCompare(b.Name ?? ""));

        setCountries(supported);
        setCurrentCountryIso2(data?.CurrentCountry?.ISO2 ?? null);
      } catch {
        if (!isActive) return;
        setCountries([]);
        setCurrentCountryIso2(null);
        setError("Unable to load supported countries.");
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadCountries();

    return () => {
      isActive = false;
    };
  }, [apiKey, applicationName]);

  return {
    countries,
    currentCountryIso2,
    isLoading,
    error,
  };
}
