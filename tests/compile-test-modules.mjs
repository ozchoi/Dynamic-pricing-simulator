import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const outDir = path.join(root, ".tmp-tests", "src", "lib");
const files = ["types.ts", "calculations.ts", "adjustmentAnalysis.ts", "quoteRecords.ts"];

fs.rmSync(path.join(root, ".tmp-tests"), { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const file of files) {
  const sourcePath = path.join(root, "src", "lib", file);
  const source = fs.readFileSync(sourcePath, "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    },
    fileName: sourcePath,
    reportDiagnostics: true
  });

  const errors = result.diagnostics?.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error) ?? [];
  if (errors.length) {
    for (const error of errors) {
      console.error(ts.flattenDiagnosticMessageText(error.messageText, "\n"));
    }
    process.exit(1);
  }

  fs.writeFileSync(path.join(outDir, file.replace(/\.ts$/, ".js")), result.outputText);
}
