import "./style.css";
import { startPlatform } from "./platform";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// Picks the platform for this build (the artifact runtime or the web server) and, on the web,
// shows the sign-in screen first. Everything the app needs from its host goes through getPlatform().
await startPlatform();
$("version").textContent = `v${__APP_VERSION__}`;
$("status").textContent = "Ready.";

// Feature modules the app added (`pack add <module>`, e.g. `ai`) each put a file in src/modules/
// that exports mount(root); they are mounted here in name order. With none, this is the whole page.
type Module = { mount(root: HTMLElement): void | Promise<void> };
const modules = import.meta.glob<Module>("./modules/*.ts", { eager: true });
const root = document.querySelector<HTMLElement>("main") ?? document.body;
for (const name of Object.keys(modules).sort()) await modules[name]!.mount(root);
