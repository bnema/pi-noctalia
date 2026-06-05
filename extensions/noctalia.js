import { existsSync, watch } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const THEME_SCHEMA =
	"https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json";

const REQUIRED_NOCTALIA_KEYS = [
	"mError",
	"mHover",
	"mOnError",
	"mOnPrimary",
	"mOnSecondary",
	"mOnSurface",
	"mOnSurfaceVariant",
	"mOnTertiary",
	"mOutline",
	"mPrimary",
	"mSecondary",
	"mSurface",
	"mSurfaceVariant",
	"mTertiary",
];

const PI_COLOR_TOKENS = [
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

function boolFromEnv(value, fallback) {
	if (value === undefined) return fallback;
	return !["0", "false", "no", "off"].includes(value.toLowerCase());
}

function getDefaultPiThemesDir() {
	return join(homedir(), ".pi", "agent", "themes");
}

function isDefaultPiThemesDir(themeDir) {
	return resolve(themeDir) === resolve(getDefaultPiThemesDir());
}

export function getNoctaliaConfig(env = process.env) {
	const themeName = env.PI_NOCTALIA_THEME_NAME || "noctalia";
	const outputDir = env.PI_NOCTALIA_THEME_DIR || getDefaultPiThemesDir();

	return {
		themeName,
		sourcePath: env.NOCTALIA_COLORS_PATH || join(homedir(), ".config", "noctalia", "colors.json"),
		outputDir,
		outputPath: join(outputDir, `${themeName}.json`),
		autoApply: boolFromEnv(env.PI_NOCTALIA_AUTO_APPLY, true),
		watch: boolFromEnv(env.PI_NOCTALIA_WATCH, true),
	};
}

function assertHexColor(key, value) {
	if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) {
		throw new Error(`Noctalia color ${key} must be a #RRGGBB string`);
	}
	return value.toLowerCase();
}

function normalizeNoctaliaColors(colors) {
	const missing = REQUIRED_NOCTALIA_KEYS.filter((key) => !(key in colors));
	if (missing.length > 0) {
		throw new Error(`Noctalia colors.json is missing: ${missing.join(", ")}`);
	}

	return Object.fromEntries(
		REQUIRED_NOCTALIA_KEYS.map((key) => [key, assertHexColor(key, colors[key])]),
	);
}

function hexToRgb(hex) {
	return {
		r: Number.parseInt(hex.slice(1, 3), 16),
		g: Number.parseInt(hex.slice(3, 5), 16),
		b: Number.parseInt(hex.slice(5, 7), 16),
	};
}

function channelToHex(value) {
	return Math.round(Math.max(0, Math.min(255, value)))
		.toString(16)
		.padStart(2, "0");
}

export function blendHex(baseHex, overlayHex, overlayAmount) {
	const base = hexToRgb(baseHex);
	const overlay = hexToRgb(overlayHex);
	const keepBase = 1 - overlayAmount;

	return `#${channelToHex(base.r * keepBase + overlay.r * overlayAmount)}${channelToHex(
		base.g * keepBase + overlay.g * overlayAmount,
	)}${channelToHex(base.b * keepBase + overlay.b * overlayAmount)}`;
}

export function convertNoctaliaColors(noctaliaColors, options = {}) {
	const c = normalizeNoctaliaColors(noctaliaColors);
	const name = options.themeName || "noctalia";

	const vars = {
		primary: c.mPrimary,
		secondary: c.mSecondary,
		tertiary: c.mTertiary,
		surface: c.mSurface,
		surfaceVariant: c.mSurfaceVariant,
		hover: c.mHover,
		outline: c.mOutline,
		error: c.mError,
		onError: c.mOnError,
		onPrimary: c.mOnPrimary,
		onSecondary: c.mOnSecondary,
		onTertiary: c.mOnTertiary,
		text: c.mOnSurface,
		mutedText: c.mOnSurfaceVariant,
		toolSuccessBg: blendHex(c.mSurfaceVariant, c.mSecondary, 0.16),
		toolErrorBg: blendHex(c.mSurfaceVariant, c.mError, 0.18),
		exportInfoBg: blendHex(c.mSurfaceVariant, c.mPrimary, 0.12),
	};

	const colors = {
		accent: "primary",
		border: "outline",
		borderAccent: "primary",
		borderMuted: "outline",
		success: "secondary",
		error: "error",
		warning: "primary",
		muted: "mutedText",
		dim: "outline",
		text: "text",
		thinkingText: "mutedText",

		selectedBg: "hover",
		userMessageBg: "surfaceVariant",
		userMessageText: "text",
		customMessageBg: "surfaceVariant",
		customMessageText: "text",
		customMessageLabel: "tertiary",
		toolPendingBg: "surfaceVariant",
		toolSuccessBg: "toolSuccessBg",
		toolErrorBg: "toolErrorBg",
		toolTitle: "primary",
		toolOutput: "mutedText",

		mdHeading: "primary",
		mdLink: "secondary",
		mdLinkUrl: "mutedText",
		mdCode: "tertiary",
		mdCodeBlock: "text",
		mdCodeBlockBorder: "outline",
		mdQuote: "mutedText",
		mdQuoteBorder: "outline",
		mdHr: "outline",
		mdListBullet: "secondary",

		toolDiffAdded: "secondary",
		toolDiffRemoved: "error",
		toolDiffContext: "mutedText",

		syntaxComment: "mutedText",
		syntaxKeyword: "primary",
		syntaxFunction: "secondary",
		syntaxVariable: "text",
		syntaxString: "tertiary",
		syntaxNumber: "secondary",
		syntaxType: "primary",
		syntaxOperator: "mutedText",
		syntaxPunctuation: "mutedText",

		thinkingOff: "outline",
		thinkingMinimal: "mutedText",
		thinkingLow: "secondary",
		thinkingMedium: "primary",
		thinkingHigh: "tertiary",
		thinkingXhigh: "error",

		bashMode: "secondary",
	};

	const missingPiTokens = PI_COLOR_TOKENS.filter((token) => !(token in colors));
	if (missingPiTokens.length > 0) {
		throw new Error(`Internal pi-noctalia error: missing Pi theme tokens ${missingPiTokens.join(", ")}`);
	}

	return {
		$schema: THEME_SCHEMA,
		name,
		vars,
		colors,
		export: {
			pageBg: "surface",
			cardBg: "surfaceVariant",
			infoBg: "exportInfoBg",
		},
	};
}

export async function readNoctaliaColors(sourcePath) {
	const raw = await readFile(sourcePath, "utf8");
	return JSON.parse(raw);
}

export async function syncNoctaliaTheme(config = getNoctaliaConfig()) {
	const sourceColors = await readNoctaliaColors(config.sourcePath);
	const theme = convertNoctaliaColors(sourceColors, { themeName: config.themeName });
	const content = `${JSON.stringify(theme, null, "\t")}\n`;

	await mkdir(config.outputDir, { recursive: true });

	if (existsSync(config.outputPath)) {
		const existing = await readFile(config.outputPath, "utf8");
		if (existing === content) {
			return { changed: false, theme, outputPath: config.outputPath };
		}
	}

	const tmpPath = `${config.outputPath}.${process.pid}.${Date.now()}.tmp`;
	await writeFile(tmpPath, content, "utf8");
	await rename(tmpPath, config.outputPath);

	return { changed: true, theme, outputPath: config.outputPath };
}

function formatError(error) {
	return error instanceof Error ? error.message : String(error);
}

function notify(ctx, message, level = "info") {
	ctx.ui?.notify?.(message, level);
}

export default async function piNoctalia(pi) {
	const config = getNoctaliaConfig();
	let watcher = undefined;
	let debounceTimer = undefined;

	async function syncAndMaybeApply(ctx, options = {}) {
		const apply = options.apply ?? config.autoApply;
		const result = await syncNoctaliaTheme(config);

		if (apply) {
			const setResult = ctx.ui.setTheme(config.themeName);
			if (!setResult.success) {
				throw new Error(setResult.error || `Failed to apply theme ${config.themeName}`);
			}
		}

		if (options.notify) {
			const action = apply ? "synced and applied" : "synced";
			const changed = result.changed ? "updated" : "already current";
			notify(ctx, `Noctalia theme ${action} (${changed}).`, "info");
		}

		return result;
	}

	function stopWatcher() {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = undefined;
		}
		if (watcher) {
			watcher.close();
			watcher = undefined;
		}
	}

	function startWatcher(ctx) {
		stopWatcher();
		if (!config.watch) return;

		const sourceDir = dirname(config.sourcePath);
		const sourceFile = basename(config.sourcePath);
		if (!existsSync(sourceDir)) return;

		watcher = watch(sourceDir, { persistent: false }, (_eventType, fileName) => {
			if (fileName && fileName.toString() !== sourceFile) return;

			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = setTimeout(async () => {
				debounceTimer = undefined;
				try {
					await syncAndMaybeApply(ctx);
				} catch (error) {
					notify(ctx, `Noctalia theme sync failed: ${formatError(error)}`, "error");
				}
			}, 100);
		});
	}

	// Best effort pre-sync so the theme exists before resource discovery in normal startup.
	try {
		await syncNoctaliaTheme(config);
	} catch {
		// Reported later from session_start when UI is available.
	}

	pi.on("resources_discover", () => ({
		themePaths: isDefaultPiThemesDir(config.outputDir) ? [] : [config.outputDir],
	}));

	pi.on("session_start", async (_event, ctx) => {
		try {
			await syncAndMaybeApply(ctx);
		} catch (error) {
			notify(ctx, `Noctalia theme sync failed: ${formatError(error)}`, "error");
		} finally {
			startWatcher(ctx);
			ctx.ui.setStatus?.("noctalia", `theme: ${config.themeName}`);
		}
	});

	pi.on("session_shutdown", () => {
		stopWatcher();
	});

	pi.registerCommand("noctalia", {
		description: "Sync/apply the Noctalia-derived Pi theme",
		getArgumentCompletions(prefix) {
			const commands = ["status", "sync", "apply", "help"];
			return commands
				.filter((command) => command.startsWith(prefix.trim()))
				.map((command) => ({ value: command, label: command }));
		},
		handler: async (args, ctx) => {
			const command = args.trim() || "status";

			try {
				if (command === "sync") {
					await syncAndMaybeApply(ctx, { apply: false, notify: true });
					return;
				}

				if (command === "apply") {
					await syncAndMaybeApply(ctx, { apply: true, notify: true });
					return;
				}

				if (command === "status") {
					const existence = existsSync(config.outputPath) ? "present" : "missing";
					notify(
						ctx,
						`Noctalia theme ${existence}. source=${config.sourcePath} output=${config.outputPath} autoApply=${config.autoApply} watch=${config.watch}`,
						"info",
					);
					return;
				}

				if (command === "help") {
					notify(ctx, "Usage: /noctalia status | sync | apply", "info");
					return;
				}

				notify(ctx, `Unknown /noctalia command: ${command}. Try /noctalia help.`, "warning");
			} catch (error) {
				notify(ctx, `Noctalia command failed: ${formatError(error)}`, "error");
			}
		},
	});
}
