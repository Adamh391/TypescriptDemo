import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import EmailValidationPage from "./pages/EmailValidationPage";
import PredictiveAddressPage from "./pages/PredictiveAddressPage";
import BankAccountValidationPage from "./pages/BankAccountValidationPage";

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

createRoot(document.getElementById("root")!).render(<App />);
