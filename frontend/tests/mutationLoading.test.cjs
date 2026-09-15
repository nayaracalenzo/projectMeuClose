const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

test("deleteRequest activates global loading and blocks a repeated click", async () => {
  let finish;
  let calls = 0;
  const api = {
    interceptors: { request: { use() {} } },
    delete: () => { calls += 1; return new Promise((resolve) => { finish = resolve; }); },
  };
  const filename = path.resolve(__dirname, "../src/services/request.ts");
  const source = fs.readFileSync(filename, "utf8").replace("import.meta.env.VITE_API_URL", "undefined");
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: (name) => {
    if (name === "axios") return { create: () => api };
    if (name === "../utils/auth") return { getStoredToken: () => null };
    throw Error(`Unexpected dependency: ${name}`);
  } }, { filename });
  const loading = [];
  exports.subscribeToMutationLoading(() => loading.push(exports.getMutationLoadingSnapshot()));
  const pending = exports.deleteRequest("/receivables/42", { reason: "TEST", previewToken: "TEST" });
  assert.equal(exports.getMutationLoadingSnapshot(), true);
  await assert.rejects(exports.deleteRequest("/receivables/42", {}), { name: "MutationInProgressError" });
  assert.equal(calls, 1);
  finish({ data: { message: "ok" } }); await pending;
  assert.equal(exports.getMutationLoadingSnapshot(), false);
  assert.deepEqual(loading, [true, false]);
});
