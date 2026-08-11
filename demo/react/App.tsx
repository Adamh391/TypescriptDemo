import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import EmailValidationPage from "./pages/EmailValidationPage";
import PredictiveAddressPage from "./pages/PredictiveAddressPage";
import BankAccountValidationPage from "./pages/BankAccountValidationPage";

const API_KEY = import.meta.env.API_KEY;

function MissingApiKeyMessage() {
  return (
    <main className="container" style={{ maxWidth: "760px", marginTop: "2rem" }}>
      <h1 style={{ color: "#b42318" }}>Missing API_KEY environment variable</h1>
      <p>
        This demo requires an API key in <code>API_KEY</code> before it can call Data8 services.
      </p>
      <p>
        Add <code>API_KEY=your-key-here</code> to a <code>.env</code> file in the project root,
        then restart the dev server.
      </p>
      <p>
        If you do not have a key yet, create one at{" "}
        <a href="https://portal.data-8.co.uk/development/api-keys" target="_blank" rel="noreferrer">
          https://portal.data-8.co.uk/development/api-keys
        </a>
        .
      </p>
    </main>
  );
}

const tabs = [
  { id: "email", label: "Email Validation", component: EmailValidationPage },
  { id: "address", label: "Predictive Address", component: PredictiveAddressPage },
  { id: "bank", label: "Bank Account Validation", component: BankAccountValidationPage },
] as const;

function App() {
  const [activeTab, setActiveTab] = useState<string>("email");
  const ActiveComponent = tabs.find((t) => t.id === activeTab)!.component;

  return (
    <main className="container" style={{ maxWidth: "600px", marginTop: "2rem" }}>
      <h1>Data8 Services</h1>
      <nav>
        <ul>
          {tabs.map((tab) => (
            <li key={tab.id}>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setActiveTab(tab.id); }}
                aria-current={activeTab === tab.id ? "page" : undefined}
              >
                {tab.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <section style={{ marginTop: "1.5rem" }}>
        <ActiveComponent />
      </section>
    </main>
  );
}

const root = createRoot(document.getElementById("root")!);

if (!API_KEY) {
  console.error(
    "Missing API_KEY. Add API_KEY=your-key-here to a .env file in the project root and restart the dev server. Get a key at https://portal.data-8.co.uk/development/api-keys"
  );
  root.render(<MissingApiKeyMessage />);
} else {
  root.render(<App />);
}
