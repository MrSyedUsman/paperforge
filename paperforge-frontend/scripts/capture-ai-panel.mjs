// Screenshots use intercepted development fixtures; this helper never requests AI.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
export async function captureAiPanel(call, bodySelector, name) {
  await call("Runtime.evaluate",{expression:`(()=>{const body=document.querySelector(${JSON.stringify(bodySelector)});body.scrollTop=0;const badge=document.createElement('p');badge.id='ai-fixture-label';badge.textContent='DEVELOPMENT FIXTURE / No Gemini request';badge.style.cssText='font:600 12px/1.5 system-ui;color:#f7d18b;padding:8px;border:1px solid #796640;border-radius:6px;margin:0 0 12px;background:#292419';body.prepend(badge)})()`});
  const {data}=await call("Page.captureScreenshot",{format:"png"});
  const directory=path.resolve("docs/ai-visuals");fs.mkdirSync(directory,{recursive:true});
  fs.writeFileSync(path.join(directory,`${name}.png`),Buffer.from(data,"base64"));
  await call("Runtime.evaluate",{expression:`document.getElementById('ai-fixture-label')?.remove()`});
  const markup=await call("Runtime.evaluate",{expression:`document.querySelector(${JSON.stringify(bodySelector)}).closest('aside').outerHTML`,returnByValue:true});
  fs.writeFileSync(path.join(os.tmpdir(),`paperforge-visual-${name}.html`),markup.result.value);

}
