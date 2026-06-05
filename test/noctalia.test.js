import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import piNoctalia, { convertNoctaliaColors, getNoctaliaConfig, syncNoctaliaTheme } from "../extensions/noctalia.js";

const sampleColors = {
	mError: "#ff8080",
	mHover: "#282828",
	mOnError: "#000000",
	mOnHover: "#ffffff",
	mOnPrimary: "#000000",
	mOnSecondary: "#000000",
	mOnSurface: "#ffffff",
	mOnSurfaceVariant: "#a0a0a0",
	mOnTertiary: "#000000",
	mOutline: "#505050",
	mPrimary: "#ffc799",
	mSecondary: "#99ffe4",
	mShadow: "#000000",
	mSurface: "#0c0c0c",
	mSurfaceVariant: "#1c1c1c",
	mTertiary: "#fbadff",
};

const requiredPiTokens = [
	"accent",
	"border",
	"borderAccent",
	"borderMuted",
	"success",
	"error",
	"warning",
	"muted",
	"dim",
	"text",
	"thinkingText",
	"selectedBg",
	"userMessageBg",
	"userMessageText",
	"customMessageBg",
	"customMessageText",
	"customMessageLabel",
	"toolPendingBg",
	"toolSuccessBg",
	"toolErrorBg",
	"toolTitle",
	"toolOutput",
	"mdHeading",
	"mdLink",
	"mdLinkUrl",
	"mdCode",
	"mdCodeBlock",
	"mdCodeBlockBorder",
	"mdQuote",
	"mdQuoteBorder",
	"mdHr",
	"mdListBullet",
	"toolDiffAdded",
	"toolDiffRemoved",
	"toolDiffContext",
	"syntaxComment",
	"syntaxKeyword",
	"syntaxFunction",
	"syntaxVariable",
	"syntaxString",
	"syntaxNumber",
	"syntaxType",
	"syntaxOperator",
	"syntaxPunctuation",
	"thinkingOff",
	"thinkingMinimal",
	"thinkingLow",
	"thinkingMedium",
	"thinkingHigh",
	"thinkingXhigh",
	"bashMode",
];

function createPiHarness() {
	const handlers = new Map();
	const commands = new Map();
	return {
		pi: {
			on(eventName, handler) {
				handlers.set(eventName, handler);
			},
			registerCommand(name, command) {
				commands.set(name, command);
			},
		},
		handlers,
		commands,
	};
}

function createCtx() {
	const notifications = [];
	const themes = [];
	const statuses = [];
	return {
		notifications,
		themes,
		statuses,
		ui: {
			notify(message, level) {
				notifications.push({ message, level });
			},
			setTheme(themeName) {
				themes.push(themeName);
				return { success: true };
			},
			setStatus(key, value) {
				statuses.push({ key, value });
			},
		},
	};
}

async function waitForJsonFile(path, timeoutMs = 1500) {
	const deadline = Date.now() + timeoutMs;
	let lastError;
	while (Date.now() < deadline) {
		try {
			return JSON.parse(await readFile(path, "utf8"));
		} catch (error) {
			lastError = error;
			await new Promise((resolve) => setTimeout(resolve, 25));
		}
	}
	throw lastError;
}

async function waitForAppliedTheme(ctx, themeName, timeoutMs = 1500) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (ctx.themes.includes(themeName)) return;
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
	assert.fail(`Timed out waiting for theme ${themeName} to be applied`);
}

test("convertNoctaliaColors creates a complete Pi theme", () => {
	const theme = convertNoctaliaColors(sampleColors, { themeName: "noctalia-test" });

	assert.equal(theme.name, "noctalia-test");
	assert.equal(theme.vars.primary, sampleColors.mPrimary);
	assert.equal(theme.vars.secondary, sampleColors.mSecondary);
	assert.equal(theme.colors.accent, "primary");
	assert.deepEqual(Object.keys(theme.colors).sort(), requiredPiTokens.sort());
});

test("convertNoctaliaColors rejects missing or invalid colors", () => {
	assert.throws(() => convertNoctaliaColors({ ...sampleColors, mPrimary: "orange" }), /mPrimary/);

	const { mSecondary: _removed, ...missingSecondary } = sampleColors;
	assert.throws(() => convertNoctaliaColors(missingSecondary), /mSecondary/);
});

test("syncNoctaliaTheme writes atomically and skips unchanged output", async () => {
	const dir = await mkdtemp(join(tmpdir(), "pi-noctalia-"));
	try {
		const sourcePath = join(dir, "colors.json");
		const outputDir = join(dir, "themes");
		const outputPath = join(outputDir, "noctalia-test.json");
		const config = {
			...getNoctaliaConfig({
				NOCTALIA_COLORS_PATH: sourcePath,
				PI_NOCTALIA_THEME_NAME: "noctalia-test",
			}),
			sourcePath,
			outputDir,
			outputPath,
		};

		await writeFile(sourcePath, JSON.stringify(sampleColors), "utf8");

		const first = await syncNoctaliaTheme(config);
		assert.equal(first.changed, true);

		const written = JSON.parse(await readFile(outputPath, "utf8"));
		assert.equal(written.name, "noctalia-test");
		assert.equal(written.colors.bashMode, "secondary");

		const second = await syncNoctaliaTheme(config);
		assert.equal(second.changed, false);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("extension watcher syncs colors created after initial session_start failure", async () => {
	const dir = await mkdtemp(join(tmpdir(), "pi-noctalia-"));
	const sourceDir = join(dir, "noctalia");
	const sourcePath = join(sourceDir, "colors.json");
	const outputDir = join(dir, "themes");
	const outputPath = join(outputDir, "noctalia-late.json");
	const config = {
		...getNoctaliaConfig({
			NOCTALIA_COLORS_PATH: sourcePath,
			PI_NOCTALIA_THEME_NAME: "noctalia-late",
			PI_NOCTALIA_AUTO_APPLY: "1",
			PI_NOCTALIA_WATCH: "1",
		}),
		outputDir,
		outputPath,
	};

	const { pi, handlers } = createPiHarness();
	let ctx;
	try {
		await piNoctalia(pi, config);
		ctx = createCtx();

		await handlers.get("session_start")({}, ctx);
		assert.match(ctx.notifications.at(-1).message, /sync failed/);

		await mkdir(sourceDir, { recursive: true });
		await writeFile(sourcePath, JSON.stringify(sampleColors), "utf8");

		const generated = await waitForJsonFile(outputPath);
		assert.equal(generated.name, "noctalia-late");
		await waitForAppliedTheme(ctx, "noctalia-late");
	} finally {
		handlers.get("session_shutdown")?.();
		await rm(dir, { recursive: true, force: true });
	}
});

test("getNoctaliaConfig writes to Pi's default global theme directory", () => {
	const config = getNoctaliaConfig({ PI_NOCTALIA_THEME_NAME: "noctalia-default-dir" });

	assert.match(config.outputDir, /\.pi[/\\]agent[/\\]themes$/);
	assert.match(config.outputPath, /noctalia-default-dir\.json$/);
});

test("/noctalia command reports status, syncs, and applies the generated theme", async () => {
	const dir = await mkdtemp(join(tmpdir(), "pi-noctalia-"));
	try {
		const sourcePath = join(dir, "colors.json");
		const outputDir = join(dir, "themes");
		const outputPath = join(outputDir, "noctalia-command.json");
		const config = {
			...getNoctaliaConfig({
				NOCTALIA_COLORS_PATH: sourcePath,
				PI_NOCTALIA_THEME_NAME: "noctalia-command",
				PI_NOCTALIA_AUTO_APPLY: "0",
				PI_NOCTALIA_WATCH: "0",
			}),
			outputDir,
			outputPath,
		};

		await writeFile(sourcePath, JSON.stringify(sampleColors), "utf8");

		const { pi, commands } = createPiHarness();
		await piNoctalia(pi, config);
		const command = commands.get("noctalia");
		assert.ok(command);
		assert.deepEqual(command.getArgumentCompletions("a"), [{ value: "apply", label: "apply" }]);

		const ctx = createCtx();
		await command.handler("status", ctx);
		assert.match(ctx.notifications.at(-1).message, /Noctalia theme present/);

		await command.handler("sync", ctx);
		const synced = JSON.parse(await readFile(outputPath, "utf8"));
		assert.equal(synced.name, "noctalia-command");
		assert.deepEqual(ctx.themes, []);

		await command.handler("apply", ctx);
		assert.deepEqual(ctx.themes, ["noctalia-command"]);

		await command.handler("wat", ctx);
		assert.equal(ctx.notifications.at(-1).level, "warning");
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
