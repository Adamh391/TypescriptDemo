import React, { useState } from "react";
import { EmailValidation } from "@data8/types";
import createClient from "openapi-fetch";

const API_KEY = import.meta.env.API_KEY;

const emailClient = createClient<EmailValidation.paths>({
  baseUrl: "https://webservices.data-8.co.uk",
});

function toNameRecord(fullName: string): EmailValidation.components["schemas"]["Name"] | undefined {
  const trimmed = fullName.trim();
  if (!trimmed) return undefined;

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { Forename: parts[0] };
  }

  return {
    Forename: parts[0],
    Surname: parts.slice(1).join(" "),
  };
}

async function validateEmail(email: string, fullName: string) {
  const name = toNameRecord(fullName);
  const { data, error } = await emailClient.POST("/EmailValidation/Cleanse.json", {
    headers: { "content-type": "application/json" },
    body: {
      username: "apikey-" + API_KEY,
      email,
      level: "Address",
      record: name ? { Name: name } : undefined,
      options: {
        ParseName: true,
        OutputNameCheck: true,
      },
    },
  });

  if (error) throw new Error(JSON.stringify(error));
  return data;
}

type ValidationResult = Awaited<ReturnType<typeof validateEmail>>;

type DetailRow = {
  label: string;
  value: string;
};

function formatFieldName(field: string) {
  return field
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function shouldSkipPath(pathSegments: string[]) {
  if (pathSegments.length === 1 && pathSegments[0].toLowerCase() === "status") {
    return true;
  }

  return pathSegments.some((segment) => segment.toLowerCase() === "rawaddress");
}

function buildDisplayLabel(path: string) {
  const segments = path.split(".").filter(Boolean);
  const dedupedSegments = segments.filter((segment, index) => {
    const previous = segments[index - 1];
    return index === 0 || segment.toLowerCase() !== previous.toLowerCase();
  });

  return formatFieldName(dedupedSegments.join(" "));
}

function collectDetailRows(value: unknown, prefix = ""): DetailRow[] {
  if (value === null || value === undefined) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => {
      const nextPrefix = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
      return collectDetailRows(item, nextPrefix);
    });
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, nestedValue]) => {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      const pathSegments = nextPrefix.split(".").filter(Boolean);
      if (shouldSkipPath(pathSegments)) return [];
      return collectDetailRows(nestedValue, nextPrefix);
    });
  }

  const normalized = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value).trim();
  if (!normalized) return [];

  return [{ label: buildDisplayLabel(prefix || "value"), value: normalized }];
}

function ResultCard({ result }: { result: ValidationResult }) {
  if (!result) return null;

  const isValid = result.Result === "Valid";
  const detailRows = collectDetailRows(result);

  return (
    <article style={{ marginTop: "1.5rem", borderLeft: `4px solid ${isValid ? "#2ecc40" : "#ff4136"}`, paddingLeft: "1rem" }}>
      <h3 style={{ color: isValid ? "#2ecc40" : "#ff4136", margin: "0 0 0.5rem" }}>
        {isValid ? "✓ Valid" : "✗ Invalid"}
      </h3>
      <p style={{ margin: 0, color: "#555" }}>{result.Result}</p>
      {detailRows.length > 0 && (
        <dl style={{ marginTop: "0.75rem", display: "grid", gridTemplateColumns: "minmax(180px, 1fr) 2fr", gap: "0.3rem 0.8rem" }}>
          {detailRows.map((row, index) => (
            <React.Fragment key={`${row.label}-${index}`}>
              <dt style={{ margin: 0, fontWeight: 600 }}>{row.label}</dt>
              <dd style={{ margin: 0, color: "#333" }}>{row.value}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}
    </article>
  );
}

export default function EmailValidationPage() {
  const [inputValue, setInputValue] = useState("");
  const [nameValue, setNameValue] = useState("");
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputValue.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await validateEmail(inputValue, nameValue);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <fieldset role="group">
          <input
            type="text"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            placeholder="Enter name (optional)"
            disabled={loading}
          />
          <input
            type="email"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter email address"
            required
            disabled={loading}
          />
          <button type="submit" aria-busy={loading} disabled={loading}>
            {loading ? "Validating…" : "Validate"}
          </button>
        </fieldset>
      </form>

      {error && <p style={{ color: "#ff4136" }}>{error}</p>}
      {result && <ResultCard result={result} />}
    </div>
  );
}
