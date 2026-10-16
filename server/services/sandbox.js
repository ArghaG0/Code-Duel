const ivm = require('isolated-vm');

const CONSOLE_LIMIT = 10240;
const TRUNCATED = '\n[console output truncated]\n';
function setting(name, fallback, min, max) {
    const value = Number(process.env[name] ?? fallback);
    if (!Number.isInteger(value) || value < min || value > max) {
        throw new Error(`Invalid ${name}`);
    }
    return value;
}

// Never return a guest exception's stack, message, or object to the host client.
function failure(error) {
    const message = typeof error?.message === 'string' ? error.message : '';
    if (/memory limit|disposed/i.test(message)) return 'Memory limit exceeded';
    if (/timed out/i.test(message)) return 'Time limit exceeded';
    if (/could not be cloned|not transferable|Unsupported type/i.test(message)) return 'Unsupported return value: use JSON-compatible data';
    if (error instanceof SyntaxError) return 'Syntax error';
    if (/call stack/i.test(message)) return 'Runtime error: stack overflow';
    return 'Runtime error';
}

// One isolate per request; no host functions, references, or objects enter guest code.
async function runSandbox(code, calls = [null]) {
    const timeout = setting('SANDBOX_TIMEOUT_MS', 3000, 1, 10000);
    const memoryLimit = setting('SANDBOX_MEMORY_MB', 128, 16, 512);
    const isolate = new ivm.Isolate({ memoryLimit });
    const results = [];
    let consoleBytes = 0;
    try {
        for (const call of calls) {
            if (isolate.isDisposed) {
                results.push({ error: 'Memory limit exceeded', output: '' });
                continue;
            }
            let context, readConsole;
            let output = '', actual, error;
            try {
                context = await isolate.createContext();
                // The closure and captured intrinsics cannot be replaced by guest globals.
                // Buffering stays entirely inside the isolate (no callback flood on Node).
                readConsole = await context.eval(`(() => {
                    const text = String, slice = Function.prototype.call.bind(String.prototype.slice);
                    let buffer = '', clipped = false;
                    const limit = ${Math.max(0, CONSOLE_LIMIT - consoleBytes)};
                    const log = (...args) => {
                        for (let i = 0; i < args.length; i++) {
                            if (buffer.length >= limit) { clipped = true; return; }
                            const part = (i ? ' ' : '') + text(args[i]);
                            const remaining = limit - buffer.length;
                            buffer += slice(part, 0, remaining);
                            if (part.length > remaining) clipped = true;
                        }
                        if (buffer.length < limit) buffer += '\\n'; else clipped = true;
                    };
                    globalThis.console = Object.freeze({ log, error: log });
                    return () => ({ buffer, clipped });
                })()`, { timeout, reference: true });
                const deadline = Date.now() + timeout;
                await context.eval(code, { timeout });
                if (call !== null) {
                    const remaining = deadline - Date.now();
                    if (remaining <= 0) throw new Error('Script execution timed out');
                    const value = await context.eval(call, { timeout: remaining, copy: true });
                    // Serialization runs on the copied value with the HOST's intrinsics.
                    try {
                        actual = JSON.stringify(value);
                        if (actual === undefined) throw new Error('unsupported');
                    } catch {
                        error = 'Unsupported return value: use JSON-compatible data';
                    }
                }
            } catch (caught) {
                error = failure(caught);
            } finally {
                if (!isolate.isDisposed && readConsole) {
                    try {
                        const captured = await readConsole.apply(undefined, [], { timeout: 50, result: { copy: true } });
                        const available = CONSOLE_LIMIT - consoleBytes;
                        const bytes = Buffer.from(captured.buffer);
                        const clipped = captured.clipped || bytes.length > available;
                        const budget = Math.max(0, available - (clipped ? Buffer.byteLength(TRUNCATED) : 0));
                        output = bytes.subarray(0, budget).toString('utf8');
                        // Avoid a partial UTF-8 character exceeding the byte budget.
                        while (Buffer.byteLength(output) > budget) output = output.slice(0, -1);
                        if (clipped && available >= Buffer.byteLength(TRUNCATED)) output += TRUNCATED;
                        consoleBytes += Buffer.byteLength(output);
                    } catch { /* A terminated isolate may have no recoverable console. */ }
                }
                readConsole?.release();
                context?.release();
            }
            results.push({ actual, error, output });
        }
        return results;
    } finally {
        if (!isolate.isDisposed) isolate.dispose();
    }
}

module.exports = { runSandbox };
