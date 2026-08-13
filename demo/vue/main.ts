import { createApp } from "vue";
import App from "./App.vue";

const API_KEY = import.meta.env.API_KEY;

if (!API_KEY) {
	console.error(
		"Missing API_KEY. Add API_KEY=your-key-here to a .env file in the project root and restart the dev server. Get a key at https://portal.data-8.co.uk/development/api-keys"
	);

	const appElement = document.getElementById("app");
	if (appElement) {
		appElement.innerHTML = `
			<main class="container" style="max-width: 760px; margin-top: 2rem">
				<h1 style="color: #b42318">Missing API_KEY environment variable</h1>
				<p>This demo requires an API key in <code>API_KEY</code> before it can call Data8 services.</p>
				<p>Add <code>API_KEY=your-key-here</code> to a <code>.env</code> file in the project root, then restart the dev server.</p>
				<p>If you do not have a key yet, create one at
					<a href="https://portal.data-8.co.uk/development/api-keys" target="_blank" rel="noreferrer">https://portal.data-8.co.uk/development/api-keys</a>.
				</p>
			</main>
		`;
	}
} else {
	createApp(App).mount("#app");
}
