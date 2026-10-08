/*
 * Menu harness: the evolving Construct beside a stand-in menu panel.
 *   ?cleared=N     sectors 1..N cleared
 *   &campaign=1    campaign complete (Construct turns over, The Reverse shows)
 *   &reverse=1     The Reverse cleared
 */
import { installConstructMenu } from "../../src/render/ConstructMenu";

const params = new URLSearchParams(location.search);
const ui = document.getElementById("ui")!;
ui.innerHTML = `<section class="slu-screen" data-screen-id="main-menu"><h1>TRAVERSAL</h1><p>Campaign</p><p>Time Trial</p><p>Challenge</p></section>`;
const cleared = new Set(Array.from({ length: Number(params.get("cleared") ?? 0) }, (_, i) => i + 1));
installConstructMenu(ui, () => ({ cleared, campaignComplete: params.has("campaign"), reverseComplete: params.has("reverse") }));
setTimeout(() => { document.body.dataset.harnessReady = "true"; }, 300);
