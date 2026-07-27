import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "demo/react",
  envDir: "../../",
  envPrefix: "API_",
});
