import React, { useState } from "react";
import { EmailValidation } from "@data8/types";
import createClient from "openapi-fetch";

const API_KEY = import.meta.env.API_KEY;

const emailClient = createClient<EmailValidation.paths>({
  baseUrl: "https://webservices.data-8.co.uk",
});

async function validateEmail(email: string) {
  const { data, error } = await emailClient.POST("/EmailValidation/IsValid.json", {
    headers: { "content-type": "application/json" },
    body: {
      username: "apikey-" + API_KEY,
      email,
      level: "Address"
    },
  });

  if (error) throw new Error(JSON.stringify(error));
  return data;
}

type ValidationResult = Awaited<ReturnType<typeof validateEmail>>;

function ResultCard({ result }: { result: ValidationResult }) {
  if (!result) return null;

  const isValid = result.Result === "Valid";
  return (
    <article style={{ marginTop: "1.5rem", borderLeft: `4px solid ${isValid ? "#2ecc40" : "#ff4136"}`, paddingLeft: "1rem" }}>
      <h3 style={{ color: isValid ? "#2ecc40" : "#ff4136", margin: "0 0 0.5rem" }}>
        {isValid ? "✓ Valid" : "✗ Invalid"}
      </h3>
      <p style={{ margin: 0, color: "#555" }}>{result.Result}</p>
    </article>
  );
}

export default function EmailValidationPage() {
  const [inputValue, setInputValue] = useState("");
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
      const data = await validateEmail(inputValue);
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
