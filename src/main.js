import { mount } from "svelte";
import "@wokwi/elements";
import App from "./App.svelte";

const app = mount(App, { target: document.getElementById("app") });

export default app;
